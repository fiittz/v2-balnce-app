import { useState } from "react";
import { Loader2, Building2, User, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpdateTransaction } from "@/hooks/useTransactions";
import { Badge } from "@/components/ui/badge";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  transaction_date: string;
  account_id: string | null;
  notes: string | null;
  category_id: string | null;
}

interface BusinessExpenseReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flaggedTransactions: Transaction[];
  companyAccountId: string;
  onComplete: () => void;
}

export default function BusinessExpenseReviewDialog({
  open,
  onOpenChange,
  flaggedTransactions,
  companyAccountId,
  onComplete,
}: BusinessExpenseReviewDialogProps) {
  const updateTransaction = useUpdateTransaction({ silent: true });
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const pending = flaggedTransactions.filter((t) => !resolved.has(t.id));

  const stripReviewTag = (notes: string | null): string => {
    if (!notes) return "";
    return notes.replace(/\s*\[PENDING_BUSINESS_REVIEW\]/g, "").trim();
  };

  const handleBusiness = async (txn: Transaction) => {
    setProcessing((prev) => new Set(prev).add(txn.id));
    try {
      await updateTransaction.mutateAsync({
        id: txn.id,
        account_id: companyAccountId,
        notes: stripReviewTag(txn.notes) + " [MOVED_FROM_PERSONAL]",
      });
      setResolved((prev) => new Set(prev).add(txn.id));
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(txn.id);
        return next;
      });
    }
  };

  const handlePersonal = async (txn: Transaction) => {
    setProcessing((prev) => new Set(prev).add(txn.id));
    try {
      await updateTransaction.mutateAsync({
        id: txn.id,
        notes: stripReviewTag(txn.notes),
      });
      setResolved((prev) => new Set(prev).add(txn.id));
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(txn.id);
        return next;
      });
    }
  };

  const handleConfirmAllBusiness = async () => {
    setBulkProcessing(true);
    try {
      for (const txn of pending) {
        await handleBusiness(txn);
      }
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && resolved.size > 0) {
      onComplete();
      setResolved(new Set());
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Review Business Expenses
            <Badge variant="secondary">{pending.length} remaining</Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            These transactions on your personal account look like business expenses. Confirm to move them to your
            company account.
          </p>
        </DialogHeader>

        <div className="space-y-3 my-4">
          {flaggedTransactions.map((txn) => {
            const isResolved = resolved.has(txn.id);
            const isProcessing = processing.has(txn.id);

            return (
              <div
                key={txn.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isResolved ? "bg-muted/50 opacity-60" : "bg-card"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{txn.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(txn.transaction_date).toLocaleDateString("en-IE")}</span>
                    <span className="font-semibold text-foreground">
                      {txn.amount < 0 ? "-" : ""}€{Math.abs(txn.amount).toFixed(2)}
                    </span>
                  </div>
                </div>

                {isResolved ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBusiness(txn)}
                      disabled={isProcessing || bulkProcessing}
                      className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
                    >
                      {isProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Building2 className="w-3 h-3 mr-1" />}
                      Business
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handlePersonal(txn)}
                      disabled={isProcessing || bulkProcessing}
                    >
                      <User className="w-3 h-3 mr-1" />
                      Personal
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-col">
          {pending.length > 1 && (
            <Button
              onClick={handleConfirmAllBusiness}
              disabled={bulkProcessing || pending.length === 0}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {bulkProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Building2 className="w-4 h-4 mr-2" />
              )}
              Confirm All as Business ({pending.length})
            </Button>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Confirmed business expenses will be moved to your company account as deductible expenses.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
