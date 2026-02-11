import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Sparkles, Loader2, CheckCircle2, AlertCircle,
  Tag, FileText, Upload, Trash2, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useUnmatchedTransactions, useUpdateTransaction } from "@/hooks/useTransactions";
import { useExpenseCategories } from "@/hooks/useCategories";
import { categorizeTransaction } from "@/services/categorization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface ProcessingResult {
  id: string;
  status: "pending" | "processing" | "success" | "error";
  category?: string;
  vatRate?: string;
  confidence?: number;
  error?: string;
}

const BulkProcessor = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: transactions, isLoading, refetch } = useUnmatchedTransactions();
  const { data: categories } = useExpenseCategories();
  const updateTransaction = useUpdateTransaction();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<Map<string, ProcessingResult>>(new Map());

  const allSelected = transactions?.length === selectedIds.size && selectedIds.size > 0;
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions?.map(t => t.id) || []));
    }
  };

  const toggleOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkCategorize = async () => {
    if (selectedIds.size === 0 || !categories) return;

    setIsProcessing(true);
    const newResults = new Map<string, ProcessingResult>();

    // Initialize all as pending
    selectedIds.forEach(id => {
      newResults.set(id, { id, status: "pending" });
    });
    setResults(new Map(newResults));

    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedIds) {
      const transaction = transactions?.find(t => t.id === id);
      if (!transaction) continue;

      // Update to processing
      newResults.set(id, { id, status: "processing" });
      setResults(new Map(newResults));

      try {
        // Call AI categorization
        const result = await categorizeTransaction(
          {
            description: transaction.description,
            amount: transaction.amount,
            date: transaction.transaction_date,
            type: transaction.type as "income" | "expense",
          },
          categories as any,
          profile?.business_type || undefined
        );

        // Find category ID
        let categoryId: string | null = null;
        if (result.category_id) {
          categoryId = result.category_id;
        } else if (result.category_name) {
          const match = categories.find(c => 
            c.name.toLowerCase() === result.category_name.toLowerCase()
          );
          if (match) categoryId = match.id;
        }

        // Update the transaction
        await updateTransaction.mutateAsync({
          id,
          category_id: categoryId,
          vat_rate: result.vat_rate as any,
          notes: result.explanation || null,
        });

        newResults.set(id, {
          id,
          status: "success",
          category: result.category_name,
          vatRate: result.vat_rate,
          confidence: result.confidence,
        });
        successCount++;
      } catch (error) {
        newResults.set(id, {
          id,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        errorCount++;
      }

      setResults(new Map(newResults));
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setIsProcessing(false);
    toast.success(`Categorized ${successCount} transactions${errorCount > 0 ? `, ${errorCount} failed` : ""}`);
    refetch();
  };

  const stats = useMemo(() => {
    const total = transactions?.length || 0;
    const processed = Array.from(results.values()).filter(r => r.status === "success").length;
    const highConfidence = Array.from(results.values()).filter(r => (r.confidence || 0) >= 0.8).length;
    return { total, processed, highConfidence };
  }, [transactions, results]);

  return (
    <div className="min-h-screen bg-secondary pb-8">
      {/* Header */}
      <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="font-semibold text-xl">Bulk Processor</h1>
        </div>
      </header>

      <main className="px-6 py-6 max-w-2xl mx-auto space-y-5">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl p-4 card-shadow text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Uncategorized</p>
          </div>
          <div className="bg-card rounded-xl p-4 card-shadow text-center">
            <p className="text-2xl font-bold text-primary">{selectedIds.size}</p>
            <p className="text-xs text-muted-foreground">Selected</p>
          </div>
          <div className="bg-card rounded-xl p-4 card-shadow text-center">
            <p className="text-2xl font-bold text-green-600">{stats.highConfidence}</p>
            <p className="text-xs text-muted-foreground">High Conf.</p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-card rounded-2xl p-4 card-shadow flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={allSelected}
              onCheckedChange={toggleAll}
              className="w-5 h-5"
            />
            <span className="text-sm font-medium">
              {allSelected ? "Deselect All" : "Select All"}
            </span>
          </div>
          <Button
            onClick={handleBulkCategorize}
            disabled={!someSelected || isProcessing}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Categorize Selected
          </Button>
        </div>

        {/* Transactions List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !transactions || transactions.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 card-shadow text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-3" />
            <p className="font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground">
              No uncategorized transactions to process
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl card-shadow overflow-hidden">
            {transactions.map((transaction, index) => {
              const result = results.get(transaction.id);
              const isSelected = selectedIds.has(transaction.id);
              
              return (
                <div 
                  key={transaction.id}
                  className={`p-4 flex items-center gap-4 ${
                    index !== transactions.length - 1 ? "border-b border-border" : ""
                  } ${result?.status === "success" ? "bg-green-50" : ""}`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(transaction.id)}
                    disabled={isProcessing}
                    className="w-5 h-5"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{transaction.description}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(transaction.transaction_date), "d MMM yyyy")}
                      </span>
                      <span className={`text-xs font-medium ${
                        transaction.type === "income" ? "text-green-600" : "text-red-600"
                      }`}>
                        {transaction.type === "income" ? "+" : "-"}€{Math.abs(transaction.amount).toFixed(2)}
                      </span>
                      
                      {/* Result indicator */}
                      {result?.status === "processing" && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Processing
                        </span>
                      )}
                      {result?.status === "success" && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {result.category}
                        </span>
                      )}
                      {result?.status === "error" && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Error
                        </span>
                      )}
                    </div>
                  </div>

                  {result?.confidence !== undefined && (
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        result.confidence >= 0.8 ? "text-green-600" : 
                        result.confidence >= 0.6 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {Math.round(result.confidence * 100)}%
                      </p>
                      <p className="text-xs text-muted-foreground">confidence</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Processing Summary */}
        {stats.processed > 0 && !isProcessing && (
          <div className="bg-green-50 rounded-2xl p-6 card-shadow">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h3 className="font-semibold text-green-800">Processing Complete</h3>
            </div>
            <p className="text-sm text-green-700">
              Successfully categorized {stats.processed} transactions. 
              {stats.highConfidence > 0 && ` ${stats.highConfidence} with high confidence (80%+).`}
            </p>
            <Button
              onClick={() => navigate("/bank")}
              variant="outline"
              className="mt-4 border-green-600 text-green-700 hover:bg-green-100"
            >
              View in Bank Feed
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default BulkProcessor;
