import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { findMatchingCategory } from "@/lib/autocat";
import { findMatchingAccount, getDefaultAccount } from "@/lib/accountMapping";
import type { DetectedTrip, TripExpenseType } from "@/lib/tripDetection";
import { SUBSISTENCE_RATES } from "@/lib/revenueRates";
import type { InvoiceTrip } from "@/hooks/useInvoiceTripMatcher";

interface TripRecategorizeResult {
  total: number;
  updated: number;
  failed: number;
}

/**
 * Map a trip expense type to the autocat category name used for
 * looking up the database category via CATEGORY_NAME_MAP.
 */
function tripExpenseToAutocatCategory(expenseType: TripExpenseType): string {
  switch (expenseType) {
    case "accommodation":
      return "Travel & Subsistence";
    case "subsistence":
      return "Travel & Subsistence";
    case "transport":
      return "Motor/travel";
    case "other":
      return "Travel & Subsistence";
  }
}

function tripExpenseToVatType(expenseType: TripExpenseType): string {
  switch (expenseType) {
    case "accommodation":
      return "Reduced 13.5%"; // VAT not deductible but rate is 13.5%
    case "subsistence":
      return "Standard 23%";
    case "transport":
      return "Zero";
    case "other":
      return "Standard 23%";
  }
}

function mapVatTypeToRate(vatType: string): number {
  const vt = vatType.toLowerCase();
  if (vt.includes("23")) return 23;
  if (vt.includes("13.5") || vt.includes("13,5")) return 13.5;
  if (vt.includes("9") && !vt.includes("23")) return 9;
  if (vt.includes("zero")) return 0;
  if (vt.includes("exempt") || vt.includes("n/a")) return 0;
  return 23;
}

export function useTripRecategorize() {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const recategorizeTrips = async (
    confirmedTrips: DetectedTrip[],
    invoiceMatches: InvoiceTrip[] = []
  ): Promise<TripRecategorizeResult> => {
    setIsRunning(true);
    setProgress(0);

    const result: TripRecategorizeResult = { total: 0, updated: 0, failed: 0 };

    try {
      // Fetch categories and accounts
      const [{ data: categories }, { data: accounts }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("accounts").select("*").order("account_type").order("name"),
      ]);

      if (!categories || categories.length === 0) {
        toast.error("No categories found");
        setIsRunning(false);
        return result;
      }

      // Build a map of trip ID → invoice match for quick lookup
      const invoiceMatchByTripId = new Map<string, InvoiceTrip>();
      for (const match of invoiceMatches) {
        if (match.matchedTrip) {
          invoiceMatchByTripId.set(match.matchedTrip.id, match);
        }
      }

      // Flatten all transactions from all trips
      const allTxns = confirmedTrips.flatMap((trip) => {
        const invoiceMatch = invoiceMatchByTripId.get(trip.id);
        return trip.transactions.map((txn) => ({
          ...txn,
          tripLocation: trip.location,
          tripStart: trip.startDate,
          tripEnd: trip.endDate,
          invoiceMatch,
        }));
      });

      result.total = allTxns.length;

      const BATCH_SIZE = 10;

      for (let i = 0; i < allTxns.length; i += BATCH_SIZE) {
        const batch = allTxns.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async (txn) => {
            try {
              const autocatCategory = tripExpenseToAutocatCategory(txn.expenseType);
              const vatType = tripExpenseToVatType(txn.expenseType);

              const matchedCategory = findMatchingCategory(
                autocatCategory,
                categories,
                "expense"
              );

              // Fall back to Motor/travel or Subsistence if no Travel & Subsistence category
              const fallbackCategory =
                matchedCategory ||
                findMatchingCategory("Motor/travel", categories, "expense") ||
                findMatchingCategory("Subsistence", categories, "expense");

              const matchedAccount =
                findMatchingAccount(
                  autocatCategory,
                  "expense",
                  vatType,
                  accounts || []
                ) || getDefaultAccount("expense", accounts || []);

              const vatRate = mapVatTypeToRate(vatType);

              const tripNote =
                txn.tripStart === txn.tripEnd
                  ? `Business trip to ${txn.tripLocation} on ${txn.tripStart}.`
                  : `Business trip to ${txn.tripLocation} (${txn.tripStart} to ${txn.tripEnd}).`;

              const vatNote =
                txn.expenseType === "accommodation"
                  ? " Hotel VAT not deductible (Section 60(2)(a)(i))."
                  : "";

              // Revenue subsistence rate annotation
              let revenueRateNote = "";
              if (txn.invoiceMatch) {
                const inv = txn.invoiceMatch;
                if (txn.expenseType === "accommodation" && inv.suggestedSubsistence.nights > 0) {
                  revenueRateNote = ` [Subsistence] €${SUBSISTENCE_RATES.overnight.normal} overnight rate — Revenue civil service rate.`;
                } else if (txn.expenseType === "subsistence") {
                  revenueRateNote = ` [Subsistence] €${SUBSISTENCE_RATES.day_trip.ten_hours} day rate — Revenue civil service rate.`;
                }
                if (inv.invoiceNumber) {
                  revenueRateNote += ` Linked to Invoice ${inv.invoiceNumber}.`;
                }
              }

              const { error } = await supabase
                .from("transactions")
                .update({
                  category_id: fallbackCategory?.id || null,
                  account_id: matchedAccount?.id || null,
                  vat_rate: vatRate,
                  notes: `[Trip] ${tripNote} ${txn.expenseType}.${vatNote}${revenueRateNote}`.trim(),
                  is_reconciled: false,
                })
                .eq("id", txn.id);

              if (error) return false;
              return true;
            } catch {
              return false;
            }
          })
        );

        batchResults.forEach((r) => {
          if (r.status === "fulfilled" && r.value) result.updated++;
          else result.failed++;
        });

        setProgress(Math.round(((i + batch.length) / allTxns.length) * 100));

        if (i + BATCH_SIZE < allTxns.length) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });

      if (result.updated > 0) {
        toast.success(
          `Updated ${result.updated} transaction${result.updated > 1 ? "s" : ""} as business travel`
        );
      }

      return result;
    } catch (error) {
      console.error("Trip recategorize error:", error);
      toast.error("Failed to update trip transactions");
      return result;
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  };

  return { recategorizeTrips, isRunning, progress };
}
