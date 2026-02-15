import { useState, useRef, useMemo, useCallback } from "react";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/useTransactions";
import { useQueryClient } from "@tanstack/react-query";
import { parse } from "date-fns";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import { autoCategorise, findMatchingCategory } from "@/lib/autocat";
import { supabase } from "@/integrations/supabase/client";
import { useCreateImportBatch } from "@/hooks/useImportBatches";
import { detectTrips, extractBaseLocation, type DetectedTrip, type DetectTripsInput } from "@/lib/tripDetection";
import { useTripRecategorize } from "@/hooks/useTripRecategorize";
import { useInvoiceTripMatcher, type InvoiceTrip } from "@/hooks/useInvoiceTripMatcher";
import TripReviewPanel from "./TripReviewPanel";

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  reference?: string;
}

interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  credit?: string;
  debit?: string;
  reference?: string;
}

interface CSVImportDialogProps {
  onImportComplete?: () => void;
  selectedFinancialAccountId?: string | null;
}

const CSVImportDialog = ({ onImportComplete, selectedFinancialAccountId }: CSVImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing" | "trip-review">("upload");
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: "",
    description: "",
    amount: "",
  });
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [duplicateFingerprints, setDuplicateFingerprints] = useState<Set<string>>(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const queryClient = useQueryClient();
  const createTransaction = useCreateTransaction({ silent: true });
  const updateTransaction = useUpdateTransaction({ silent: true });
  const createImportBatch = useCreateImportBatch();
  const { data: categories = [] } = useCategories(); // Get all categories (income + expense)
  const { data: accounts = [] } = useAccounts(); // Get all accounts for Chart of Accounts linking
  const { profile, user } = useAuth();
  const { data: onboarding } = useOnboardingSettings();
  
  const [currentFilename, setCurrentFilename] = useState<string>("");
  const [totalDataRows, setTotalDataRows] = useState<number>(0);
  
  const [categorizingProgress, setCategorizingProgress] = useState(0);
  const [isCategorizing, setIsCategorizing] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [detectedTrips, setDetectedTrips] = useState<DetectedTrip[]>([]);
  const { recategorizeTrips, isRunning: isTripProcessing } = useTripRecategorize();
  const { invoiceTrips } = useInvoiceTripMatcher();
  const [matchedInvoiceTrips, setMatchedInvoiceTrips] = useState<InvoiceTrip[]>([]);

  const parseAmount = (value: string): number => {
    if (!value) return 0;
    let cleaned = value.trim();
    if (!cleaned) return 0;
    // Handle parenthetical negatives: (50.00) → -50.00
    cleaned = cleaned.replace(/\((.+)\)/, "-$1");
    // Handle DR/CR suffixes common in Irish bank CSVs
    const isDebit = /\bDR\b/i.test(cleaned);
    const isCredit = /\bCR\b/i.test(cleaned);
    cleaned = cleaned.replace(/\b(DR|CR)\b/gi, "");
    // Remove currency symbols, spaces, and any non-numeric chars except . , -
    cleaned = cleaned.replace(/[^0-9.,-]/g, "");
    // Handle European format: 1.234,56 → 1234.56
    if (/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }
    // Remove commas used as thousand separators in standard format
    cleaned = cleaned.replace(/,/g, "");
    let num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    // Apply DR/CR sign
    if (isDebit && num > 0) num = -num;
    if (isCredit && num < 0) num = -num;
    return num;
  };

  const parseDate = (dateStr: string): string => {
    const formats = [
      "dd/MM/yyyy",
      "MM/dd/yyyy",
      "yyyy-MM-dd",
      "dd-MM-yyyy",
      "d/M/yyyy",
      "dd MMM yyyy",
    ];

    for (const fmt of formats) {
      try {
        const parsed = parse(dateStr, fmt, new Date());
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split("T")[0];
        }
      } catch {
        continue;
      }
    }
    return new Date().toISOString().split("T")[0];
  };

  const parseTransactionsFromMapping = (
    data: string[][],
    hdrs: string[],
    map: ColumnMapping
  ): ParsedTransaction[] => {
    const hasAmount = map.amount && map.amount !== "__none__";
    const hasCredit = map.credit && map.credit !== "__none__";
    const hasDebit = map.debit && map.debit !== "__none__";

    if (!map.date || !map.description || (!hasAmount && !hasCredit)) {
      console.log("[CSV Import] Missing required mapping:", { date: map.date, desc: map.description, amount: map.amount, credit: map.credit });
      return [];
    }

    const dateIdx = hdrs.indexOf(map.date);
    const descIdx = hdrs.indexOf(map.description);
    const amountIdx = hasAmount ? hdrs.indexOf(map.amount) : -1;
    const creditIdx = hasCredit ? hdrs.indexOf(map.credit!) : -1;
    const debitIdx = hasDebit ? hdrs.indexOf(map.debit!) : -1;
    const refIdx = map.reference && map.reference !== "__none__" ? hdrs.indexOf(map.reference) : -1;

    console.log("[CSV Import] Column indices:", { dateIdx, descIdx, amountIdx, creditIdx, debitIdx, refIdx });
    console.log("[CSV Import] Headers count:", hdrs.length, "Data rows:", data.length);

    const nonEmptyRows = data.filter(row => row.some(cell => cell.trim()));
    console.log("[CSV Import] Non-empty rows:", nonEmptyRows.length);

    let droppedZeroAmount = 0;
    let droppedShortRow = 0;

    const results = nonEmptyRows
      .map((row, idx) => {
        // Check if row has enough columns
        const neededIdx = Math.max(dateIdx, descIdx, amountIdx, creditIdx, debitIdx);
        if (row.length <= neededIdx) {
          droppedShortRow++;
          console.log(`[CSV Import] Row ${idx + 1} too short: ${row.length} cols, need ${neededIdx + 1}. Raw: ${row.join("|").substring(0, 100)}`);
          return null;
        }

        let amount = 0;
        let type: "income" | "expense" = "expense";

        if (creditIdx >= 0 && debitIdx >= 0) {
          const creditRaw = (row[creditIdx] || "").trim();
          const debitRaw = (row[debitIdx] || "").trim();
          const credit = parseAmount(creditRaw || "0");
          const debit = parseAmount(debitRaw || "0");

          if (credit > 0 && debit > 0) {
            amount = Math.abs(credit - debit);
            type = credit >= debit ? "income" : "expense";
          } else if (credit > 0) {
            amount = credit;
            type = "income";
          } else if (Math.abs(debit) > 0) {
            amount = Math.abs(debit);
            type = "expense";
          } else if (creditRaw && !debitRaw) {
            amount = 0;
            type = "income";
          } else {
            amount = 0;
            type = "expense";
          }
        } else if (creditIdx >= 0) {
          amount = parseAmount(row[creditIdx] || "0");
          type = "income";
          amount = Math.abs(amount);
        } else if (debitIdx >= 0) {
          amount = parseAmount(row[debitIdx] || "0");
          type = "expense";
          amount = Math.abs(amount);
        } else if (amountIdx >= 0) {
          const rawVal = row[amountIdx] || "";
          amount = parseAmount(rawVal);
          type = amount >= 0 ? "income" : "expense";
          amount = Math.abs(amount);
          if (amount === 0 && rawVal.trim()) {
            console.log(`[CSV Import] Row ${idx + 1} amount parsed to 0 from raw value: "${rawVal}"`);
          }
        }

        return {
          date: parseDate(row[dateIdx] || ""),
          description: row[descIdx]?.trim() || "Unknown",
          amount,
          type,
          reference: refIdx >= 0 ? row[refIdx]?.trim() : undefined,
        } as ParsedTransaction;
      })
      .filter((t): t is ParsedTransaction => {
        if (t === null) return false;
        if (t.amount === 0 && t.description === "Unknown") {
          droppedZeroAmount++;
          return false;
        }
        if (t.amount === 0) {
          droppedZeroAmount++;
          console.log(`[CSV Import] Keeping zero-amount: "${t.description}" on ${t.date}`);
        }
        return true;
      });

    console.log(`[CSV Import] Parse summary: ${nonEmptyRows.length} rows → ${results.length} transactions (${droppedShortRow} short rows, ${droppedZeroAmount} zero-amount)`);
    return results;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCurrentFilename(file.name);
    setIsLoading(true);
    const reader = new FileReader();
    
    reader.onerror = () => {
      setIsLoading(false);
      toast.error("Failed to read file");
    };
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || text.trim().length === 0) {
          toast.error("File appears to be empty");
          setIsLoading(false);
          return;
        }
        
        // Handle different line endings (Windows \r\n, old Mac \r, Unix \n)
        const lines = text.split(/\r\n|\r|\n/).filter(line => line.trim());

        // Detect delimiter: check first line for tabs vs commas vs semicolons
        const firstLine = lines[0] || "";
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const delimiter = tabCount >= commaCount && tabCount >= semicolonCount ? "\t"
          : semicolonCount > commaCount ? ";"
          : ",";

        console.log(`[CSV Import] Lines: ${lines.length}, Delimiter: "${delimiter === "\t" ? "TAB" : delimiter}", Tabs: ${tabCount}, Commas: ${commaCount}, Semicolons: ${semicolonCount}`);
        console.log(`[CSV Import] First line preview: ${firstLine.substring(0, 200)}`);

        const parsed = lines.map(line => {
          // For tab-delimited files, simple split is sufficient
          if (delimiter === "\t") {
            return line.split("\t").map(cell => cell.trim().replace(/^"|"$/g, ""));
          }

          // Handle quoted CSV values for comma/semicolon-delimited
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          const delim = delimiter;

          for (let ci = 0; ci < line.length; ci++) {
            const char = line[ci];
            if (char === '"') {
              // Handle escaped quotes ("") inside quoted fields
              if (inQuotes && ci + 1 < line.length && line[ci + 1] === '"') {
                current += '"';
                ci++; // skip next quote
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === delim && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        });

        if (parsed.length < 2) {
          toast.error("CSV file must have headers and at least one row");
          setIsLoading(false);
          return;
        }

        // Clean headers - replace empty ones with placeholder names and ensure uniqueness
        const seenHeaders = new Map<string, number>();
        const cleanHeaders = parsed[0].map((h, idx) => {
          let headerName = h.trim() || `Column ${idx + 1}`;
          
          // Make header unique if duplicate
          const count = seenHeaders.get(headerName) || 0;
          if (count > 0) {
            headerName = `${headerName} (${count + 1})`;
          }
          seenHeaders.set(headerName, count + 1);
          
          return headerName;
        });
        
        // Filter out rows that are mostly empty — keep any row with at least 2 non-empty cells
        const validData = parsed.slice(1).filter(row => {
          const nonEmptyCells = row.filter(cell => cell.trim()).length;
          return nonEmptyCells >= 2;
        });
        
        if (validData.length === 0) {
          toast.error("No valid data rows found in CSV");
          setIsLoading(false);
          return;
        }

        console.log("[CSV Import] Headers:", cleanHeaders.join(" | "));
        console.log(`[CSV Import] Header count: ${cleanHeaders.length}`);
        console.log(`[CSV Import] First row col count: ${parsed[1]?.length}, Last row col count: ${parsed[parsed.length - 1]?.length}`);
        console.log(`[CSV Import] Total data rows: ${parsed.length - 1}, Valid rows (>=2 cells): ${validData.length}, Dropped: ${parsed.length - 1 - validData.length}`);

        // Log column counts for all rows to find misaligned ones
        const colCounts = new Map<number, number>();
        validData.forEach(row => {
          const c = row.length;
          colCounts.set(c, (colCounts.get(c) || 0) + 1);
        });
        console.log("[CSV Import] Column count distribution:", Object.fromEntries(colCounts));

        // Log first data row for verification
        if (validData.length > 0) {
          console.log("[CSV Import] First data row sample:", validData[0].map((v, i) => `[${i}]${cleanHeaders[i]}=${v}`).join(", "));
        }
        
        // Set headers and data first
        setHeaders(cleanHeaders);
        setCsvData(validData);
        setTotalDataRows(validData.length);
        
        // Auto-detect bank format and pre-fill mapping
        const headersLower = cleanHeaders.map(h => h.toLowerCase());
        const isAIB = headersLower.some(h => h.includes("posted transactions date") || h.includes("posted account"));
        const isRevolut = headersLower.some(h => (h.includes("completed") && h.includes("date")) || (h.includes("started") && h.includes("date")));
        const isBOI = headersLower.some(h => h.includes("posting date") && h.includes("narrative"));
        
        let autoMapping: ColumnMapping | null = null;
        let bankName = "";
        
        if (isAIB) {
          bankName = "AIB";
          const dateCol = cleanHeaders.find((_, i) => 
            headersLower[i].includes("posted transactions date") || headersLower[i].includes("transaction date")
          ) || "";
          const descCol = cleanHeaders.find((_, i) => 
            headersLower[i] === "description1" || headersLower[i].includes("description")
          ) || "";
          const creditCol = cleanHeaders.find((_, i) => headersLower[i].includes("credit")) || "";
          const debitCol = cleanHeaders.find((_, i) => headersLower[i].includes("debit")) || "";
          
          if (dateCol && descCol && (creditCol || debitCol)) {
            autoMapping = {
              date: dateCol,
              description: descCol,
              amount: "__none__",
              credit: creditCol || undefined,
              debit: debitCol || undefined,
            };
          }
        } else if (isRevolut) {
          bankName = "Revolut";
          // Prefer "completed" date over "started" date
          const dateCol = cleanHeaders.find((_, i) => headersLower[i].includes("completed") && headersLower[i].includes("date"))
            || cleanHeaders.find((_, i) => headersLower[i].includes("started") && headersLower[i].includes("date"))
            || "";
          const descCol = cleanHeaders.find((_, i) => headersLower[i] === "description") || "";
          const amountCol = cleanHeaders.find((_, i) => headersLower[i] === "amount") || "";
          
          if (dateCol && descCol && amountCol) {
            autoMapping = { date: dateCol, description: descCol, amount: amountCol };
          }
        } else {
          // Generic auto-detect for common column names
          const dateCol = cleanHeaders.find((_, i) => 
            headersLower[i].includes("date") && !headersLower[i].includes("balance")
          ) || "";
          const descCol = cleanHeaders.find((_, i) => 
            headersLower[i].includes("description") || headersLower[i].includes("narrative") || headersLower[i].includes("details")
          ) || "";
          const amountCol = cleanHeaders.find((_, i) => headersLower[i] === "amount") || "";
          const creditCol = cleanHeaders.find((_, i) => headersLower[i].includes("credit") && !headersLower[i].includes("card")) || "";
          const debitCol = cleanHeaders.find((_, i) => headersLower[i].includes("debit")) || "";
          
          if (dateCol && descCol && (amountCol || creditCol || debitCol)) {
            autoMapping = {
              date: dateCol,
              description: descCol,
              amount: amountCol || "__none__",
              credit: creditCol || undefined,
              debit: debitCol || undefined,
            };
          }
        }
        
        if (autoMapping) {
          console.log(`${bankName || "Bank"} format auto-detected:`, autoMapping);
          setMapping(autoMapping);
          
          // Auto-parse transactions and skip to preview
          const transactions = parseTransactionsFromMapping(validData, cleanHeaders, autoMapping);
          if (transactions.length > 0) {
            setParsedTransactions(transactions);
            const dropped = validData.length - transactions.length;
            const dropMsg = dropped > 0 ? ` (${dropped} rows skipped — zero amount)` : "";
            toast.success(`${bankName ? bankName + " format detected! " : ""}${transactions.length} of ${validData.length} transactions ready${dropMsg}`);
            setStep("preview");
          } else {
            toast.success(`${bankName ? bankName + " format detected! " : ""}Columns auto-mapped. Please verify.`);
            setStep("map");
          }
        } else {
          toast.success(`Found ${validData.length} rows to import`);
          setStep("map");
        }
      } catch (error) {
        console.error("CSV parsing error:", error);
        toast.error("Failed to parse CSV file");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // Check for duplicate transactions against existing database
  const checkForDuplicates = async (transactions: ParsedTransaction[]): Promise<Set<string>> => {
    if (!user?.id) return new Set();
    
    setIsCheckingDuplicates(true);
    try {
      // Fetch existing transactions
      const { data: existingTransactions } = await supabase
        .from("transactions")
        .select("transaction_date, description, amount")
        .eq("user_id", user.id);
      
      // Create fingerprints for existing transactions
      const existingFingerprints = new Set(
        existingTransactions?.map(t => 
          `${t.transaction_date}|${t.description.toLowerCase().trim()}|${Math.abs(t.amount).toFixed(2)}`
        ) || []
      );
      
      // Find duplicates
      const duplicates = new Set<string>();
      transactions.forEach(t => {
        const fingerprint = `${t.date}|${t.description.toLowerCase().trim()}|${Math.abs(t.amount).toFixed(2)}`;
        if (existingFingerprints.has(fingerprint)) {
          duplicates.add(fingerprint);
        }
      });
      
      return duplicates;
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      return new Set();
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const handleMapping = async () => {
    const transactions = parseTransactionsFromMapping(csvData, headers, mapping);
    
    if (transactions.length === 0) {
      toast.error("No valid transactions found. Please check your column mappings.");
      return;
    }

    setParsedTransactions(transactions);
    
    // Check for duplicates
    const duplicates = await checkForDuplicates(transactions);
    setDuplicateFingerprints(duplicates);
    
    if (duplicates.size > 0) {
      toast.warning(`Found ${duplicates.size} potential duplicate transactions`);
    }
    
    setStep("preview");
  };

  // Helper to check if transaction is a duplicate
  const isDuplicate = useCallback((t: ParsedTransaction): boolean => {
    const fingerprint = `${t.date}|${t.description.toLowerCase().trim()}|${Math.abs(t.amount).toFixed(2)}`;
    return duplicateFingerprints.has(fingerprint);
  }, [duplicateFingerprints]);

  // Get transactions to import (filtered by skip duplicates setting)
  const transactionsToImport = useMemo(() => {
    if (!skipDuplicates || duplicateFingerprints.size === 0) {
      return parsedTransactions;
    }
    return parsedTransactions.filter(t => !isDuplicate(t));
  }, [parsedTransactions, skipDuplicates, duplicateFingerprints, isDuplicate]);

  const duplicateCount = useMemo(() => {
    return parsedTransactions.filter(t => isDuplicate(t)).length;
  }, [parsedTransactions, isDuplicate]);

  const handleImport = async () => {
    if (transactionsToImport.length === 0) {
      toast.error("No transactions to import after filtering duplicates");
      return;
    }

    // Only use an account_id that actually exists in the database (otherwise inserts will fail
    // with a foreign key error). If the selected id is a local-only value, import as unassigned.
    const accountIdToAssign =
      selectedFinancialAccountId && accounts.some(a => a.id === selectedFinancialAccountId)
        ? selectedFinancialAccountId
        : null;

    setStep("importing");
    setImportProgress(0);

    // Create import batch first
    let importBatchId: string | null = null;
    try {
      const batch = await createImportBatch.mutateAsync({
        filename: currentFilename || "CSV Import",
        row_count: transactionsToImport.length,
      });
      importBatchId = batch.id;
    } catch (err) {
      console.error("Failed to create import batch:", err);
      // Continue without batch tracking if it fails
    }

    let success = 0;
    const createdTransactions: Array<{ id: string; description: string; amount: number; type: string; date: string }> = [];

    // Bulk insert all transactions in one request to avoid rate limits
    const rowsToInsert = transactionsToImport.map(t => ({
      transaction_date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      reference: t.reference || null,
      is_reconciled: false,
      import_batch_id: importBatchId,
      account_id: accountIdToAssign,
      user_id: user!.id,
    }));

    // Insert in chunks of 50 to stay within Supabase payload limits
    const CHUNK_SIZE = 50;
    for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
      const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
      const chunkStartIdx = i;

      try {
        const { data, error } = await supabase
          .from("transactions")
          .insert(chunk)
          .select("id");

        if (error) {
          console.error(`[CSV Import] Bulk insert failed for chunk ${i / CHUNK_SIZE + 1}:`, error);
          toast.error(`Failed to save transactions: ${error.message}`);
        } else if (data) {
          data.forEach((row, idx) => {
            const t = transactionsToImport[chunkStartIdx + idx];
            createdTransactions.push({
              id: row.id,
              description: t.description,
              amount: t.amount,
              type: t.type,
              date: t.date,
            });
          });
          success += data.length;
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[CSV Import] Bulk insert exception for chunk ${i / CHUNK_SIZE + 1}:`, err);
        toast.error(`Failed to save transactions: ${errMsg || "Unknown error"}`);
      }

      setImportProgress(Math.round(((i + chunk.length) / rowsToInsert.length) * 100));
    }

    const skippedMsg = skipDuplicates && duplicateCount > 0
      ? ` (${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} skipped)`
      : '';
    const failedCount = transactionsToImport.length - success;
    const failMsg = failedCount > 0 ? ` (${failedCount} failed to save)` : '';
    toast.success(`Imported ${success} of ${transactionsToImport.length} transactions${skippedMsg}${failMsg}. Now auto-categorizing...`);
    if (failedCount > 0) {
      console.error(`[CSV Import] ${failedCount} transactions failed to insert into database`);
    }

    // Refresh transaction list after bulk insert
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    await queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["invoices"] });

    const mapVatTypeToRate = (vatType: string | undefined | null): string => {
      const vt = (vatType || "").toLowerCase();
      if (vt.includes("23")) return "standard_23";
      if (vt.includes("13.5") || vt.includes("13,5")) return "reduced_13_5";
      if (vt.includes("9") && !vt.includes("23")) return "second_reduced_9";
      if (vt.includes("4.8") || vt.includes("livestock")) return "livestock_4_8";
      if (vt.includes("zero")) return "zero_rated";
      if (vt.includes("exempt") || vt.includes("n/a")) return "exempt";
      return "standard_23";
    };

    // Auto-categorize imported transactions using local engine
    if (createdTransactions.length > 0) {
      setIsCategorizing(true);
      setCategorizingProgress(0);

      // Fetch categories directly to ensure we have them
      let categoriesToUse = categories;
      if (categoriesToUse.length === 0) {
        console.log("[AutoCat] Categories not loaded, fetching directly...");
        const { data: fetchedCategories } = await supabase
          .from("categories")
          .select("*")
          .order("name");
        categoriesToUse = fetchedCategories || [];
        console.log(`[AutoCat] Fetched ${categoriesToUse.length} categories`);
      }

      if (categoriesToUse.length === 0) {
        console.warn("[AutoCat] No categories available, skipping categorization");
        setIsCategorizing(false);
        toast.warning("No categories found. Please set up categories first.");
      } else {
        let categorized = 0;
        let successfulCategorizations = 0;
        const CAT_BATCH_SIZE = 5;

        for (let i = 0; i < createdTransactions.length; i += CAT_BATCH_SIZE) {
          const batch = createdTransactions.slice(i, i + CAT_BATCH_SIZE);

          const results = await Promise.allSettled(
            batch.map(async (txn) => {
              try {
                const txnDirection = txn.type === "income" ? "income" : "expense";
                const engineResult = autoCategorise({
                  amount: txn.amount,
                  date: txn.date,
                  currency: "EUR",
                  description: txn.description,
                  merchant_name: txn.description,
                  transaction_type: undefined,
                  direction: txnDirection,
                  user_industry: onboarding?.business_type || profile?.business_type || "",
                  user_business_type: onboarding?.business_type || profile?.business_type || "",
                  user_business_description: onboarding?.business_description || "",
                  receipt_text: undefined,
                });

                // Use flexible category matching with mapping
                const matchedCategory = findMatchingCategory(
                  engineResult.category,
                  categoriesToUse,
                  txnDirection
                );

                const vatDeductible = (engineResult as Record<string, unknown>).vat_deductible ?? true;
                const needsReceipt = (engineResult as Record<string, unknown>).needs_receipt ?? false;
                
                console.log(`[AutoCat] "${txn.description}" → ${engineResult.category} | VAT: ${vatDeductible ? "✓" : "✗"} | Conf: ${engineResult.confidence_score}% → DB: ${matchedCategory?.name || "NO MATCH"}`);

                if (matchedCategory && engineResult.confidence_score >= 50) {
                  // Build explanation with VAT info
                  let explanation = engineResult.business_purpose;
                  if (needsReceipt) {
                    explanation += " [RECEIPT REQUIRED for VAT claim]";
                  }
                  if (engineResult.notes) {
                    explanation += ` ${engineResult.notes}`;
                  }

                  const vatRateStr = mapVatTypeToRate(engineResult.vat_type);

                  // Only update category, VAT, and notes — do NOT overwrite account_id
                  // (account_id is the bank account set during import, not chart of accounts)
                  await updateTransaction.mutateAsync({
                    id: txn.id,
                    category_id: matchedCategory.id,
                    vat_rate: parseFloat(vatRateStr.replace("standard_", "").replace("reduced_", "").replace("_", ".")) || 0,
                    notes: explanation.trim(),
                    is_reconciled: false,
                  });
                  return true;
                }
                return false;
              } catch (error) {
                console.error("Categorization error for", txn.description, error);
                return false;
              }
            })
          );

          successfulCategorizations += results.filter(r => r.status === "fulfilled" && r.value).length;
          categorized += batch.length;
          setCategorizingProgress(Math.round((categorized / createdTransactions.length) * 100));

          // Small delay between batches
          if (i + CAT_BATCH_SIZE < createdTransactions.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        setIsCategorizing(false);
        toast.success(`Auto-categorized ${successfulCategorizations} of ${createdTransactions.length} transactions`);
      }
    }

    // Refresh transaction lists after bulk import
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    await queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
    await queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["invoices"] });

    // --- Trip detection ---
    // Build input from created transactions (we need id + description + amount + date + type)
    const tripInput: DetectTripsInput[] = createdTransactions.map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      date: t.date,
      type: t.type as "income" | "expense",
    }));

    const baseLocation = extractBaseLocation(profile?.address);
    const trips = detectTrips(tripInput, baseLocation);

    if (trips.length > 0) {
      setDetectedTrips(trips);
      // Match invoice trips to detected trips
      const matched = invoiceTrips.filter((it) =>
        trips.some((t) => it.matchedTrip?.id === t.id)
      );
      setMatchedInvoiceTrips(matched);
      setStep("trip-review");
      return; // Don't close yet — show trip review
    }

    // No trips detected — close as before
    handleReset();
    setOpen(false);

    // Call the completion callback after a small delay to ensure DB writes complete
    if (onImportComplete) {
      setTimeout(() => {
        onImportComplete();
      }, 300);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setCsvData([]);
    setHeaders([]);
    setMapping({ date: "", description: "", amount: "" });
    setParsedTransactions([]);
    setDuplicateFingerprints(new Set());
    setSkipDuplicates(true);
    setImportProgress(0);
    setCategorizingProgress(0);
    setIsCategorizing(false);
    setDetectedTrips([]);
    setMatchedInvoiceTrips([]);
    setTotalDataRows(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleTripConfirm = async (confirmedTrips: DetectedTrip[]) => {
    await recategorizeTrips(confirmedTrips, matchedInvoiceTrips);
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    handleReset();
    setOpen(false);
    if (onImportComplete) {
      setTimeout(() => onImportComplete(), 300);
    }
  };

  const handleTripSkip = () => {
    handleReset();
    setOpen(false);
    if (onImportComplete) {
      setTimeout(() => onImportComplete(), 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) handleReset();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import Bank Statement
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="border-2 border-dashed border-primary rounded-xl p-8 text-center">
                <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin mb-3" />
                <p className="font-medium">Processing CSV file...</p>
                <p className="text-sm text-muted-foreground mt-1">Please wait</p>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Drop your CSV file here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isLoading}
            />
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="text-sm font-medium mb-2">Supported formats:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• AIB, BOI, Ulster Bank, Revolut CSV exports</li>
                <li>• Standard CSV with Date, Description, Amount columns</li>
                <li>• Separate Credit/Debit columns supported</li>
              </ul>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map your CSV columns to transaction fields. Found {csvData.length} rows.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Date Column *</label>
                <Select value={mapping.date} onValueChange={(v) => setMapping(m => ({ ...m, date: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select date column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => (
                      <SelectItem key={`date-${i}`} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Description Column *</label>
                <Select value={mapping.description} onValueChange={(v) => setMapping(m => ({ ...m, description: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select description column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => (
                      <SelectItem key={`desc-${i}`} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Amount Column *</label>
                <Select value={mapping.amount} onValueChange={(v) => setMapping(m => ({ ...m, amount: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select amount column (or use Credit/Debit)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (use Credit/Debit)</SelectItem>
                    {headers.map((h, i) => (
                      <SelectItem key={`amt-${i}`} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Credit Column</label>
                  <Select value={mapping.credit || "__none__"} onValueChange={(v) => setMapping(m => ({ ...m, credit: v === "__none__" ? "" : v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={`credit-${i}`} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Debit Column</label>
                  <Select value={mapping.debit || "__none__"} onValueChange={(v) => setMapping(m => ({ ...m, debit: v === "__none__" ? "" : v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={`debit-${i}`} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Reference Column</label>
                <Select value={mapping.reference || "__none__"} onValueChange={(v) => setMapping(m => ({ ...m, reference: v === "__none__" ? "" : v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {headers.map((h, i) => (
                      <SelectItem key={`ref-${i}`} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleReset} className="flex-1" disabled={isCheckingDuplicates}>
                Back
              </Button>
              <Button onClick={handleMapping} className="flex-1" disabled={isCheckingDuplicates}>
                {isCheckingDuplicates ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking duplicates...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {/* Rows dropped warning */}
            {totalDataRows > 0 && parsedTransactions.length < totalDataRows && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 dark:bg-blue-900/20 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                      {parsedTransactions.length} of {totalDataRows} rows parsed
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                      {totalDataRows - parsedTransactions.length} rows had zero or invalid amounts and were skipped.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Duplicate warning banner */}
            {duplicateCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">
                      Found {duplicateCount} potential duplicate{duplicateCount > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Transactions with matching date, description, and amount already exist.
                    </p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs text-amber-700">Skip duplicates (recommended)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {skipDuplicates && duplicateCount > 0 
                  ? `Importing ${transactionsToImport.length} of ${parsedTransactions.length} transactions`
                  : `Ready to import ${parsedTransactions.length} transactions`
                }
              </p>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  {transactionsToImport.filter(t => t.type === "income").length} income
                </span>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
                  {transactionsToImport.filter(t => t.type === "expense").length} expense
                </span>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto border rounded-xl divide-y">
              {parsedTransactions.slice(0, 15).map((t, i) => {
                const isTransactionDuplicate = isDuplicate(t);
                const willBeSkipped = isTransactionDuplicate && skipDuplicates;
                
                return (
                  <div 
                    key={i} 
                    className={`p-3 flex items-center justify-between text-sm ${
                      isTransactionDuplicate ? 'bg-amber-50' : ''
                    } ${willBeSkipped ? 'opacity-50' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium truncate ${willBeSkipped ? 'line-through' : ''}`}>
                          {t.description}
                        </p>
                        {isTransactionDuplicate && (
                          <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] rounded shrink-0">
                            Duplicate
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.date}</p>
                    </div>
                    <p className={`font-semibold ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                      {t.type === "income" ? "+" : "-"}€{t.amount.toFixed(2)}
                    </p>
                  </div>
                );
              })}
              {parsedTransactions.length > 15 && (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  +{parsedTransactions.length - 15} more transactions
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("map")} className="flex-1">
                Back
              </Button>
              <Button onClick={handleImport} className="flex-1" disabled={transactionsToImport.length === 0}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Import {transactionsToImport.length} Transactions
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
            <div>
              <p className="font-medium">
                {isCategorizing ? "Auto-categorizing transactions..." : "Importing transactions..."}
              </p>
              <p className="text-sm text-muted-foreground">
                {isCategorizing ? `${categorizingProgress}%` : `${importProgress}%`} complete
              </p>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${isCategorizing ? categorizingProgress : importProgress}%` }}
              />
            </div>
            {isCategorizing && (
              <p className="text-xs text-muted-foreground">
                AI is analyzing merchants and assigning categories...
              </p>
            )}
          </div>
        )}

        {step === "trip-review" && (
          <TripReviewPanel
            trips={detectedTrips}
            onConfirm={handleTripConfirm}
            onSkip={handleTripSkip}
            isProcessing={isTripProcessing}
            invoiceMatches={matchedInvoiceTrips}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CSVImportDialog;
