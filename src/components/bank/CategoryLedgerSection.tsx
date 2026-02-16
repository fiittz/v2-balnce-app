import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowUpRight, ArrowDownLeft, CheckCircle2, Link2, Loader2, MessageSquare, Pencil, Camera } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import TransactionEditDialog from "./TransactionEditDialog";
import TransactionRowActions from "./TransactionRowActions";
import InlineCategoryPicker from "./InlineCategoryPicker";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense" | string;
  transaction_date: string;
  vat_amount: number | null;
  is_reconciled: boolean | null;
  category_id: string | null;
  category?: { name: string } | null;
  account_id?: string | null;
  notes?: string | null;
  receipt_url?: string | null;
}

interface CategoryLedgerSectionProps {
  categoryName: string;
  transactions: Transaction[];
  total: number;
  type: "income" | "expense";
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onMatchSingle?: (id: string) => void;
  matchingTxId?: string | null;
  defaultExpanded?: boolean;
  onDeleteTransaction?: (id: string) => void;
}

export default function CategoryLedgerSection({
  categoryName,
  transactions,
  total,
  type,
  selectionMode,
  selectedIds,
  onToggleSelection,
  onMatchSingle,
  matchingTxId,
  defaultExpanded = false,
  onDeleteTransaction,
}: CategoryLedgerSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [categorizingTxId, setCategorizingTxId] = useState<string | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);

  const isIncome = type === "income";
  const isUncategorized = categoryName === "Uncategorized";

  if (transactions.length === 0) return null;

  return (
    <div className="bg-card rounded-xl card-shadow overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          isUncategorized
            ? "bg-amber-100 dark:bg-amber-950/40"
            : isIncome
              ? "bg-green-100 dark:bg-green-950/40"
              : "bg-red-100 dark:bg-red-950/40"
        }`}>
          {isExpanded ? (
            <ChevronDown className={`w-5 h-5 ${
              isUncategorized
                ? "text-amber-600"
                : isIncome ? "text-green-600" : "text-red-600"
            }`} />
          ) : (
            <ChevronRight className={`w-5 h-5 ${
              isUncategorized
                ? "text-amber-600"
                : isIncome ? "text-green-600" : "text-red-600"
            }`} />
          )}
        </div>

        <div className="flex-1 text-left">
          <h3 className="font-semibold">{categoryName}</h3>
          <p className="text-sm text-muted-foreground">
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="text-right">
          <p className={`font-bold text-lg ${isIncome ? "text-green-600" : "text-red-600"}`}>
            {isIncome ? "+" : "-"}€{total.toFixed(2)}
          </p>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          {transactions.map((transaction, index) => (
            <div
              key={transaction.id}
              className={`p-4 pl-14 flex items-center gap-4 group ${
                index !== transactions.length - 1 ? "border-b border-border" : ""
              } ${selectedIds.has(transaction.id) ? "bg-primary/5" : ""} ${
                !selectionMode ? "cursor-pointer hover:bg-muted/50" : ""
              }`}
              onClick={selectionMode ? () => onToggleSelection(transaction.id) : () => setEditingTransaction(transaction)}
            >
              {selectionMode && (
                <Checkbox
                  checked={selectedIds.has(transaction.id)}
                  onCheckedChange={() => onToggleSelection(transaction.id)}
                  className="shrink-0"
                />
              )}

              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                transaction.type === "income" ? "bg-green-100" : "bg-red-100"
              }`}>
                {transaction.type === "income" ? (
                  <ArrowDownLeft className="w-4 h-4 text-green-600" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 text-red-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate text-sm">{transaction.description}</p>
                  {!selectionMode && (
                    <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
                {transaction.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                    <MessageSquare className="w-3 h-3 shrink-0" />
                    {transaction.notes}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(transaction.transaction_date), "d MMM yyyy")}
                  </span>

                  <InlineCategoryPicker
                    transactionId={transaction.id}
                    currentCategory={transaction.category}
                    currentCategoryId={transaction.category_id}
                    transactionDescription={transaction.description}
                    currentVatRate={transaction.vat_amount}
                    isOpen={categorizingTxId === transaction.id}
                    onOpenChange={(open) => setCategorizingTxId(open ? transaction.id : null)}
                  />

                  {!selectionMode && (
                    <>
                      {transaction.is_reconciled ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Matched
                        </span>
                      ) : onMatchSingle && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMatchSingle(transaction.id);
                          }}
                          disabled={matchingTxId === transaction.id}
                          className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium flex items-center gap-1 hover:bg-amber-200 transition-colors"
                        >
                          {matchingTxId === transaction.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Link2 className="w-3 h-3" />
                          )}
                          Match
                        </button>
                      )}
                      {transaction.receipt_url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReceiptPreviewUrl(transaction.receipt_url!);
                          }}
                          className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1 hover:bg-green-200 transition-colors"
                        >
                          <Camera className="w-3 h-3" />
                          Receipt
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {!selectionMode && (
                <TransactionRowActions
                  transactionId={transaction.id}
                  onCategorize={(id) => setCategorizingTxId(id)}
                  onDelete={(id) => onDeleteTransaction?.(id)}
                />
              )}

              <div className="text-right">
                <p className={`font-semibold ${transaction.type === "income" ? "text-green-600" : ""}`}>
                  {transaction.type === "income" ? "+" : "-"}€{Math.abs(transaction.amount).toFixed(2)}
                </p>
                {transaction.vat_amount && transaction.vat_amount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    VAT €{transaction.vat_amount.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TransactionEditDialog
        transaction={editingTransaction}
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
      />

      {/* Receipt Preview Dialog */}
      <Dialog open={!!receiptPreviewUrl} onOpenChange={(open) => !open && setReceiptPreviewUrl(null)}>
        <DialogContent className="sm:max-w-lg">
          {receiptPreviewUrl && (
            <img
              src={receiptPreviewUrl}
              alt="Receipt"
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
