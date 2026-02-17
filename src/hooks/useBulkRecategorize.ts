import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { autoCategorise, findMatchingCategory } from "@/lib/autocat";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import { useVendorCache } from "@/hooks/useVendorCache";
import { useUserCorrections } from "@/hooks/useUserCorrections";
import { useCreateJob } from "@/hooks/useProcessingJobs";
import { detectTrips, classifyTripExpense, extractBaseLocation } from "@/lib/tripDetection";
import type { DetectTripsInput } from "@/lib/tripDetection";
import { ensureNewCategories } from "@/lib/seedCategories";

interface RecategorizeResult {
  total: number;
  categorized: number;
  skipped: number;
  failed: number;
}

export function useBulkRecategorize() {
  const { user, profile } = useAuth();
  const { data: onboarding } = useOnboardingSettings();
  const { vendorCache } = useVendorCache();
  const { userCorrections } = useUserCorrections();
  const queryClient = useQueryClient();
  
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<RecategorizeResult | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>("");

  const mapVatTypeToRate = (vatType: string | undefined | null): number => {
    const vt = (vatType || "").toLowerCase();
    if (vt.includes("23")) return 23;
    if (vt.includes("13.5") || vt.includes("13,5")) return 13.5;
    if (vt.includes("9") && !vt.includes("23")) return 9;
    if (vt.includes("4.8") || vt.includes("livestock")) return 4.8;
    if (vt.includes("zero")) return 0;
    if (vt.includes("exempt") || vt.includes("n/a")) return 0;
    return 23;
  };

  const runRecategorize = async (): Promise<RecategorizeResult> => {
    if (!user?.id) {
      toast.error("Not authenticated");
      return { total: 0, categorized: 0, skipped: 0, failed: 0 };
    }

    setIsRunning(true);
    setProgress(0);
    setStats(null);
    setCurrentPhase("Loading transactions...");

    try {
      // Fetch uncategorized transactions
      const { data: uncategorized, error: fetchError } = await supabase
        .from("transactions")
        .select("id, description, amount, type, transaction_date, category_id")
        .eq("user_id", user.id)
        .is("category_id", null)
        .order("transaction_date", { ascending: false });

      if (fetchError) throw fetchError;

      if (!uncategorized || uncategorized.length === 0) {
        toast.info("No uncategorized transactions found");
        setIsRunning(false);
        return { total: 0, categorized: 0, skipped: 0, failed: 0 };
      }

      setCurrentPhase(`Categorizing ${uncategorized.length} transactions...`);

      const [{ data: categories }, { data: accounts }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("accounts").select("*").order("account_type").order("name"),
      ]);

      if (!categories || categories.length === 0) {
        toast.error("No categories found");
        setIsRunning(false);
        return { total: uncategorized.length, categorized: 0, skipped: uncategorized.length, failed: 0 };
      }

      const result: RecategorizeResult = {
        total: uncategorized.length,
        categorized: 0,
        skipped: 0,
        failed: 0,
      };

      const BATCH_SIZE = 20;

      for (let i = 0; i < uncategorized.length; i += BATCH_SIZE) {
        const batch = uncategorized.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async (txn) => {
            try {
              const txnDirection = txn.type === "income" ? "income" : "expense";
              
              const engineResult = autoCategorise({
                amount: txn.amount,
                date: txn.transaction_date,
                currency: "EUR",
                description: txn.description,
                merchant_name: txn.description,
                transaction_type: undefined,
                direction: txnDirection,
                user_industry: (onboarding as Record<string, unknown>)?.business_type || profile?.business_type || "",
                user_business_type: (onboarding as Record<string, unknown>)?.business_type || profile?.business_type || "",
                receipt_text: undefined,
              }, vendorCache, userCorrections);

              const matchedCategory = findMatchingCategory(
                engineResult.category,
                categories,
                txnDirection
              );

              if (!matchedCategory || engineResult.confidence_score < 50) {
                return { status: "skipped" as const };
              }

              const vatRate = mapVatTypeToRate(engineResult.vat_type);

              const { error: updateError } = await supabase
                .from("transactions")
                .update({
                  category_id: matchedCategory.id,
                  // Do NOT overwrite account_id — it holds the bank account reference
                  vat_rate: vatRate,
                  notes: engineResult.notes || null,
                })
                .eq("id", txn.id);

              if (updateError) return { status: "failed" as const };
              return { status: "categorized" as const };
            } catch {
              return { status: "failed" as const };
            }
          })
        );

        batchResults.forEach((r) => {
          if (r.status === "fulfilled") {
            if (r.value.status === "categorized") result.categorized++;
            else if (r.value.status === "skipped") result.skipped++;
            else result.failed++;
          } else {
            result.failed++;
          }
        });

        setProgress(Math.round(((i + batch.length) / uncategorized.length) * 100));
      }

      setStats(result);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });

      if (result.categorized > 0) {
        toast.success(`Categorized ${result.categorized} transactions`);
      }

      return result;
    } catch (error) {
      console.error("Bulk categorize error:", error);
      toast.error("Failed to categorize transactions");
      return { total: 0, categorized: 0, skipped: 0, failed: 0 };
    } finally {
      setIsRunning(false);
      setCurrentPhase("");
    }
  };

  const createJob = useCreateJob();

  const runServerRecategorize = async () => {
    if (!user?.id) {
      toast.error("Not authenticated");
      return;
    }

    setIsRunning(true);
    setCurrentPhase("Collecting uncategorized transactions...");

    try {
      const { data: uncategorized, error } = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", user.id)
        .is("category_id", null);

      if (error) throw error;

      if (!uncategorized || uncategorized.length === 0) {
        toast.info("No uncategorized transactions found");
        setIsRunning(false);
        setCurrentPhase("");
        return;
      }

      await createJob.mutateAsync({
        job_type: "categorization",
        total_items: uncategorized.length,
        input_data: {
          transaction_ids: uncategorized.map((t) => t.id),
          business_type: (onboarding as Record<string, unknown>)?.business_type || profile?.business_type || "",
        },
      });

      toast.success(`Server-side categorization started for ${uncategorized.length} transactions`);
    } catch (err) {
      console.error("Server categorize error:", err);
      toast.error("Failed to start server-side categorization. Trying client-side...");
      await runRecategorize();
    } finally {
      setIsRunning(false);
      setCurrentPhase("");
    }
  };

  const runRecategorizeMiscellaneous = async (): Promise<RecategorizeResult> => {
    if (!user?.id) {
      toast.error("Not authenticated");
      return { total: 0, categorized: 0, skipped: 0, failed: 0 };
    }

    setIsRunning(true);
    setProgress(0);
    setStats(null);
    setCurrentPhase("Finding Miscellaneous transactions...");

    try {
      // Find the Miscellaneous Expenses category
      const { data: miscCats } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", "Miscellaneous Expenses");

      if (!miscCats || miscCats.length === 0) {
        toast.info("No Miscellaneous Expenses category found");
        setIsRunning(false);
        return { total: 0, categorized: 0, skipped: 0, failed: 0 };
      }

      const miscCatId = miscCats[0].id;

      // Fetch all transactions with Miscellaneous category
      const { data: miscTransactions, error: fetchError } = await supabase
        .from("transactions")
        .select("id, description, amount, type, transaction_date, category_id")
        .eq("user_id", user.id)
        .eq("category_id", miscCatId)
        .order("transaction_date", { ascending: false });

      if (fetchError) throw fetchError;

      if (!miscTransactions || miscTransactions.length === 0) {
        toast.info("No Miscellaneous transactions to recategorize");
        setIsRunning(false);
        return { total: 0, categorized: 0, skipped: 0, failed: 0 };
      }

      setCurrentPhase(`Re-categorizing ${miscTransactions.length} Miscellaneous transactions...`);

      const [{ data: categories }, { data: accounts }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("accounts").select("*").order("account_type").order("name"),
      ]);

      if (!categories || categories.length === 0) {
        toast.error("No categories found");
        setIsRunning(false);
        return { total: miscTransactions.length, categorized: 0, skipped: miscTransactions.length, failed: 0 };
      }

      const result: RecategorizeResult = {
        total: miscTransactions.length,
        categorized: 0,
        skipped: 0,
        failed: 0,
      };

      const BATCH_SIZE = 20;

      for (let i = 0; i < miscTransactions.length; i += BATCH_SIZE) {
        const batch = miscTransactions.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async (txn) => {
            try {
              const txnDirection = txn.type === "income" ? "income" : "expense";

              const engineResult = autoCategorise({
                amount: txn.amount,
                date: txn.transaction_date,
                currency: "EUR",
                description: txn.description,
                merchant_name: txn.description,
                transaction_type: undefined,
                direction: txnDirection,
                user_industry: (onboarding as Record<string, unknown>)?.business_type || profile?.business_type || "",
                user_business_type: (onboarding as Record<string, unknown>)?.business_type || profile?.business_type || "",
                receipt_text: undefined,
              }, vendorCache, userCorrections);

              const matchedCategory = findMatchingCategory(
                engineResult.category,
                categories,
                txnDirection
              );

              // Only update if the new category is different from Miscellaneous
              if (!matchedCategory || matchedCategory.id === miscCatId || engineResult.confidence_score < 40) {
                return { status: "skipped" as const };
              }

              const vatRate = mapVatTypeToRate(engineResult.vat_type);

              const { error: updateError } = await supabase
                .from("transactions")
                .update({
                  category_id: matchedCategory.id,
                  // Do NOT overwrite account_id — it holds the bank account reference
                  vat_rate: vatRate,
                  notes: engineResult.notes || null,
                })
                .eq("id", txn.id);

              if (updateError) return { status: "failed" as const };
              return { status: "categorized" as const };
            } catch {
              return { status: "failed" as const };
            }
          })
        );

        batchResults.forEach((r) => {
          if (r.status === "fulfilled") {
            if (r.value.status === "categorized") result.categorized++;
            else if (r.value.status === "skipped") result.skipped++;
            else result.failed++;
          } else {
            result.failed++;
          }
        });

        setProgress(Math.round(((i + batch.length) / miscTransactions.length) * 100));
      }

      setStats(result);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });

      if (result.categorized > 0) {
        toast.success(`Recategorized ${result.categorized} of ${result.total} Miscellaneous transactions`);
      } else {
        toast.info(`${result.total} Miscellaneous transactions reviewed — none could be reclassified`);
      }

      return result;
    } catch (error) {
      console.error("Misc recategorize error:", error);
      toast.error("Failed to recategorize miscellaneous transactions");
      return { total: 0, categorized: 0, skipped: 0, failed: 0 };
    } finally {
      setIsRunning(false);
      setCurrentPhase("");
    }
  };

  /**
   * Re-run ALL transactions through the latest autocat rules + trip detection.
   * Unlike runRecategorize (uncategorized only) or runRecategorizeMiscellaneous,
   * this processes every transaction regardless of current category.
   */
  const runRecategorizeAll = async (): Promise<RecategorizeResult> => {
    if (!user?.id) {
      toast.error("Not authenticated");
      return { total: 0, categorized: 0, skipped: 0, failed: 0 };
    }

    setIsRunning(true);
    setProgress(0);
    setStats(null);
    setCurrentPhase("Loading all transactions...");

    try {
      const { data: allTxns, error: fetchError } = await supabase
        .from("transactions")
        .select("id, description, amount, type, transaction_date, category_id")
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false });

      if (fetchError) throw fetchError;

      if (!allTxns || allTxns.length === 0) {
        toast.info("No transactions found");
        setIsRunning(false);
        return { total: 0, categorized: 0, skipped: 0, failed: 0 };
      }

      setCurrentPhase(`Re-categorizing ${allTxns.length} transactions...`);

      // Ensure newer categories exist (Director's Drawings, Medical Expenses)
      await ensureNewCategories(user.id);

      const [{ data: categories }, { data: accounts }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("accounts").select("*").order("account_type").order("name"),
      ]);

      if (!categories || categories.length === 0) {
        toast.error("No categories found");
        setIsRunning(false);
        return { total: allTxns.length, categorized: 0, skipped: allTxns.length, failed: 0 };
      }

      const result: RecategorizeResult = {
        total: allTxns.length,
        categorized: 0,
        skipped: 0,
        failed: 0,
      };

      const BATCH_SIZE = 20;

      for (let i = 0; i < allTxns.length; i += BATCH_SIZE) {
        const batch = allTxns.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async (txn) => {
            try {
              const txnDirection = txn.type === "income" ? "income" : "expense";

              const engineResult = autoCategorise({
                amount: txn.amount,
                date: txn.transaction_date,
                currency: "EUR",
                description: txn.description,
                merchant_name: txn.description,
                transaction_type: undefined,
                direction: txnDirection,
                user_industry: (onboarding as Record<string, unknown>)?.business_type || profile?.business_type || "",
                user_business_type: (onboarding as Record<string, unknown>)?.business_type || profile?.business_type || "",
                receipt_text: undefined,
              }, vendorCache, userCorrections);

              const matchedCategory = findMatchingCategory(
                engineResult.category,
                categories,
                txnDirection
              );

              if (!matchedCategory || engineResult.confidence_score < 40) {
                // Clear category so it shows as uncategorized for manual review
                await supabase
                  .from("transactions")
                  .update({ category_id: null, notes: "Auto-categorization uncertain — needs manual review." })
                  .eq("id", txn.id);
                return { status: "skipped" as const };
              }

              const vatRate = mapVatTypeToRate(engineResult.vat_type);

              const { error: updateError } = await supabase
                .from("transactions")
                .update({
                  category_id: matchedCategory.id,
                  // Do NOT overwrite account_id — it holds the bank account reference
                  vat_rate: vatRate,
                  notes: engineResult.notes || null,
                })
                .eq("id", txn.id);

              if (updateError) return { status: "failed" as const };
              return { status: "categorized" as const };
            } catch {
              return { status: "failed" as const };
            }
          })
        );

        batchResults.forEach((r) => {
          if (r.status === "fulfilled") {
            if (r.value.status === "categorized") result.categorized++;
            else if (r.value.status === "skipped") result.skipped++;
            else result.failed++;
          } else {
            result.failed++;
          }
        });

        setProgress(Math.round(((i + batch.length) / allTxns.length) * 70));
      }

      // --- Phase 2: Trip detection on all expenses ---
      setCurrentPhase("Detecting business trips...");

      const baseLocation = extractBaseLocation(profile?.address ?? null);
      const tripInput: DetectTripsInput[] = allTxns
        .filter((t) => t.type === "expense" && t.transaction_date)
        .map((t) => ({
          id: t.id,
          description: t.description,
          amount: Math.abs(t.amount),
          date: t.transaction_date,
          type: "expense" as const,
        }));

      const detectedTrips = detectTrips(tripInput, baseLocation);

      if (detectedTrips.length > 0) {
        // Find the Travel & Accommodation / Vehicle Expenses categories
        const travelCat = categories.find((c) => c.name === "Travel & Accommodation");
        const motorCat = categories.find((c) => c.name === "Vehicle Expenses");

        let tripUpdated = 0;
        for (const trip of detectedTrips) {
          for (const txn of trip.transactions) {
            let expenseType = classifyTripExpense(txn.description);
            // During a trip, unclassified expenses default to subsistence
            if (expenseType === "other") expenseType = "subsistence";
            const isTransport = expenseType === "transport";
            const cat = isTransport ? (motorCat || travelCat) : travelCat;
            if (!cat) continue;

            const vatRate = isTransport ? 0 : expenseType === "accommodation" ? 13.5 : 23;

            const { error } = await supabase
              .from("transactions")
              .update({
                category_id: cat.id,
                // Do NOT overwrite account_id — it holds the bank account reference
                vat_rate: vatRate,
                notes: `[Trip] Business trip to ${trip.location} (${trip.startDate}${trip.endDate !== trip.startDate ? " – " + trip.endDate : ""})`,
              })
              .eq("id", txn.id);

            if (!error) tripUpdated++;
          }
        }

        if (tripUpdated > 0) {
          toast.success(`Detected ${detectedTrips.length} trip(s), updated ${tripUpdated} transactions`);
        }
      }

      // --- Phase 3: Invoice-based trip override ---
      // Transactions categorized as Drawings/personal that fall within an invoice
      // job period should be overridden to Travel & Accommodation (trip expense).
      setCurrentPhase("Matching expenses to invoice trips...");

      const travelCatForInvoice = categories.find((c) => c.name === "Travel & Accommodation");
      if (travelCatForInvoice) {
        const { data: invoices } = await supabase
          .from("invoices")
          .select("id, invoice_number, invoice_date, notes, customer:customers(name, address)")
          .eq("user_id", user.id);

        if (invoices && invoices.length > 0) {
          // Build date ranges from invoices (job_start_date/job_end_date from notes, or ±2 days)
          const invoiceRanges: { start: string; end: string }[] = [];
          for (const inv of invoices) {
            let jobStart: string | null = null;
            let jobEnd: string | null = null;
            try {
              const notesObj = inv.notes ? JSON.parse(inv.notes) : null;
              if (notesObj) {
                jobStart = notesObj.job_start_date || null;
                jobEnd = notesObj.job_end_date || null;
              }
            } catch { /* not JSON */ }

            if (jobStart && jobEnd) {
              invoiceRanges.push({ start: jobStart, end: jobEnd });
            } else {
              // Fallback: ±2 days of invoice date
              const d = new Date(inv.invoice_date);
              const start = new Date(d);
              start.setDate(start.getDate() - 2);
              const end = new Date(d);
              end.setDate(end.getDate() + 2);
              invoiceRanges.push({
                start: start.toISOString().slice(0, 10),
                end: end.toISOString().slice(0, 10),
              });
            }
          }

          // Find expense transactions currently in Drawings that fall within a trip period
          const drawingsCatIds = categories
            .filter((c) => c.name.toLowerCase().includes("drawing"))
            .map((c) => c.id);

          if (drawingsCatIds.length > 0) {
            let invoiceTripOverrides = 0;
            for (const txn of allTxns) {
              if (txn.type !== "expense") continue;
              if (!drawingsCatIds.includes(txn.category_id)) continue;
              const txDate = txn.transaction_date;
              if (!txDate) continue;

              const isInTripPeriod = invoiceRanges.some(
                (r) => txDate >= r.start && txDate <= r.end
              );
              if (!isInTripPeriod) continue;

              // Override to Travel & Accommodation
              const { error } = await supabase
                .from("transactions")
                .update({
                  category_id: travelCatForInvoice.id,
                  notes: `[Trip] Expense during invoice job period — reclassified from drawings.`,
                })
                .eq("id", txn.id);

              if (!error) invoiceTripOverrides++;
            }

            if (invoiceTripOverrides > 0) {
              toast.success(`Reclassified ${invoiceTripOverrides} drawings as trip expenses`);
            }
          }
        }
      }

      setProgress(100);
      setStats(result);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });

      if (result.categorized > 0) {
        toast.success(`Re-categorized ${result.categorized} of ${result.total} transactions`);
      }

      return result;
    } catch (error) {
      console.error("Full recategorize error:", error);
      toast.error("Failed to recategorize transactions");
      return { total: 0, categorized: 0, skipped: 0, failed: 0 };
    } finally {
      setIsRunning(false);
      setCurrentPhase("");
    }
  };

  return {
    runRecategorize,
    runRecategorizeMiscellaneous,
    runRecategorizeAll,
    runServerRecategorize,
    isRunning,
    progress,
    stats,
    currentPhase,
  };
}
