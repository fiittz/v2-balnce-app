import { useState, useEffect } from "react";
import { Loader2, MessageSquare, BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateTransaction } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense" | string;
  transaction_date: string;
  account_id?: string | null;
  notes?: string | null;
}

interface TransactionEditDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TransactionEditDialog({
  transaction,
  open,
  onOpenChange,
}: TransactionEditDialogProps) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const updateTransaction = useUpdateTransaction();
  const { data: accounts } = useAccounts();

  // Reset state when transaction changes
  useEffect(() => {
    if (open && transaction) {
      setAccountId(transaction.account_id || null);
      setNotes(transaction.notes || "");
    }
  }, [open, transaction]);

  // Group accounts by type
  const groupedAccounts = accounts?.reduce((groups, account) => {
    const type = account.account_type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
    return groups;
  }, {} as Record<string, typeof accounts>) || {};

  const accountTypes = ["Income", "Cost of Sales", "Expense", "VAT", "Payroll", "Fixed Assets", "Current Assets", "Current Liabilities", "Equity"];

  const handleSave = async () => {
    if (!transaction) return;

    await updateTransaction.mutateAsync({
      id: transaction.id,
      account_id: accountId,
      notes: notes.trim() || null,
    });
    onOpenChange(false);
  };

  const currentAccount = accounts?.find(a => a.id === accountId);

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Transaction Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="font-medium text-sm truncate">{transaction.description}</p>
            <p className={`text-2xl font-bold mt-1 ${transaction.type === "income" ? "text-green-600" : ""}`}>
              {transaction.type === "income" ? "+" : "-"}€{Math.abs(transaction.amount).toFixed(2)}
            </p>
          </div>

          {/* Account Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Accounting Code
            </Label>
            <Select
              value={accountId || "unassigned"}
              onValueChange={(v) => setAccountId(v === "unassigned" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account">
                  {currentAccount ? (
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {currentAccount.account_number || "-"}
                      </span>
                      {currentAccount.name}
                    </span>
                  ) : (
                    "Unassigned"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="unassigned">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {accountTypes.map(type => {
                  const typeAccounts = groupedAccounts[type];
                  if (!typeAccounts?.length) return null;
                  return (
                    <div key={type}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                        {type}
                      </div>
                      {typeAccounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          <span className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground w-14">
                              {account.account_number || "-"}
                            </span>
                            {account.name}
                          </span>
                        </SelectItem>
                      ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <Label htmlFor="notes" className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Accounting Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Add a comment for accounting purposes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Notes are visible in reports and useful for audit trails.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateTransaction.isPending}
            className="flex-1"
          >
            {updateTransaction.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
