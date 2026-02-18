import { useState } from "react";
import { X, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import BulkCategoryPicker from "./BulkCategoryPicker";
import { useBulkUpdateTransactions, useBulkDeleteTransactions } from "@/hooks/useTransactions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FloatingActionBarProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
}

export default function FloatingActionBar({ selectedIds, onClearSelection }: FloatingActionBarProps) {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const bulkUpdate = useBulkUpdateTransactions();
  const bulkDelete = useBulkDeleteTransactions();

  const count = selectedIds.size;
  if (count === 0) return null;

  const ids = Array.from(selectedIds);

  const handleCategorize = (categoryId: string) => {
    bulkUpdate.mutate({ ids, updates: { category_id: categoryId } }, { onSuccess: () => onClearSelection() });
  };

  const handleMarkReviewed = () => {
    bulkUpdate.mutate({ ids, updates: { is_reconciled: true } }, { onSuccess: () => onClearSelection() });
  };

  const handleDelete = () => {
    bulkDelete.mutate(ids, {
      onSuccess: () => {
        onClearSelection();
        setShowDeleteDialog(false);
      },
    });
  };

  const isLoading = bulkUpdate.isPending || bulkDelete.isPending;

  return (
    <>
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
        <div className="bg-foreground text-background rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
          <span className="text-sm font-medium whitespace-nowrap">{count} selected</span>

          <div className="w-px h-6 bg-background/20" />

          <BulkCategoryPicker
            open={showCategoryPicker}
            onOpenChange={setShowCategoryPicker}
            onSelect={handleCategorize}
          />

          <Button variant="secondary" size="sm" className="gap-2" onClick={handleMarkReviewed} disabled={isLoading}>
            <CheckCircle2 className="w-4 h-4" />
            Reviewed
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isLoading}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>

          <button onClick={onClearSelection} className="p-1.5 rounded-full hover:bg-background/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {count} transaction{count !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected transactions will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDelete.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
