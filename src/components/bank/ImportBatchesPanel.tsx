import { useState } from "react";
import { format, parseISO } from "date-fns";
import { FileSpreadsheet, Trash2, Loader2, ChevronRight, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  useImportBatches,
  useDeleteImportBatch,
  useBulkDeleteImportBatches,
  ImportBatch,
} from "@/hooks/useImportBatches";

interface ImportBatchesPanelProps {
  onSelectBatch?: (batchId: string) => void;
}

const ImportBatchesPanel = ({ onSelectBatch }: ImportBatchesPanelProps) => {
  const { data: batches, isLoading } = useImportBatches();
  const deleteBatch = useDeleteImportBatch();
  const bulkDelete = useBulkDeleteImportBatches();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<"single" | "selected">("selected");
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (batches) {
      setSelectedIds(new Set(batches.map((b) => b.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleDeleteSingle = (batchId: string) => {
    setSingleDeleteId(batchId);
    setDeleteTarget("single");
    setShowDeleteDialog(true);
  };

  const handleDeleteSelected = () => {
    setDeleteTarget("selected");
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (deleteTarget === "single" && singleDeleteId) {
      await deleteBatch.mutateAsync(singleDeleteId);
      setSingleDeleteId(null);
    } else if (deleteTarget === "selected" && selectedIds.size > 0) {
      await bulkDelete.mutateAsync(Array.from(selectedIds));
      clearSelection();
    }
    setShowDeleteDialog(false);
  };

  const totalTransactions = batches?.reduce((sum, b) => sum + (b.row_count || 0), 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!batches || batches.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-8 card-shadow text-center">
        <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium">No imports yet</p>
        <p className="text-sm text-muted-foreground">Upload a CSV file to see your import history here</p>
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{" "}
              {deleteTarget === "single"
                ? "this import"
                : `${selectedIds.size} import${selectedIds.size !== 1 ? "s" : ""}`}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all transactions from {deleteTarget === "single" ? "this" : "the selected"}{" "}
              import{deleteTarget === "selected" && selectedIds.size !== 1 ? "s" : ""}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBatch.isPending || bulkDelete.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Summary Stats */}
      <div className="bg-card rounded-2xl p-4 card-shadow mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">
                {batches.length} import{batches.length !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-muted-foreground">{totalTransactions} total transactions</p>
            </div>
          </div>
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selectedIds.size}
            </Button>
          )}
        </div>
      </div>

      {/* Selection Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedIds.size === batches.length && batches.length > 0}
            onCheckedChange={(checked) => (checked ? selectAll() : clearSelection())}
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
          </span>
        </div>
        {selectedIds.size > 0 && (
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        )}
      </div>

      {/* Batches List */}
      <div className="bg-card rounded-2xl card-shadow overflow-hidden">
        {batches.map((batch, index) => (
          <div
            key={batch.id}
            className={`p-4 flex items-center gap-4 ${
              index !== batches.length - 1 ? "border-b border-border" : ""
            } ${selectedIds.has(batch.id) ? "bg-primary/5" : ""}`}
          >
            <Checkbox
              checked={selectedIds.has(batch.id)}
              onCheckedChange={() => toggleSelection(batch.id)}
              className="shrink-0"
            />
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{batch.filename || "CSV Import"}</p>
              <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                <span>{format(parseISO(batch.created_at || new Date().toISOString()), "d MMM yyyy, HH:mm")}</span>
                <span>•</span>
                <span>{batch.row_count || 0} transactions</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteSingle(batch.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              {onSelectBatch && (
                <Button variant="ghost" size="icon" onClick={() => onSelectBatch(batch.id)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default ImportBatchesPanel;
