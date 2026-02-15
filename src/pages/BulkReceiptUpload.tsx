import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Loader2, CheckCircle2, XCircle, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBulkReceiptUpload } from "@/hooks/useBulkReceiptUpload";
import { BulkReceiptGrid } from "@/components/receipt/BulkReceiptGrid";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";

const BulkReceiptUpload = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Callback ref to set webkitdirectory on mount
  const setFolderRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      node.setAttribute("webkitdirectory", "true");
      node.setAttribute("directory", "true");
      (folderInputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
    }
  }, []);

  const {
    files,
    phase,
    currentIndex,
    totalFiles,
    processedFiles,
    errorFiles,
    matchedCount,
    notMatchedCount,
    addFiles,
    removeFile,
    clearAll,
    startProcessing,
    manualMatch,
  } = useBulkReceiptUpload();

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    },
    [addFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      // Reset input so same files can be re-added
      e.target.value = "";
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAllReceipts = async () => {
    if (!confirm("Delete ALL receipts from the database? This cannot be undone.")) return;
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      // Unlink receipts from transactions
      await supabase
        .from("transactions")
        .update({ receipt_url: null })
        .eq("user_id", user.id)
        .not("receipt_url", "is", null);

      // Delete all receipts from DB
      const { error } = await supabase
        .from("receipts")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      clearAll();
      toast.success("All receipts deleted");
    } catch (err) {
      toast.error("Failed to delete receipts");
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const isProcessing = phase === "ocr" || phase === "matching";
  const queuedCount = files.filter((f) => f.status === "queued").length;

  return (
    <AppLayout>
      {/* Header */}
      <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/scanner")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-xl">Bulk Receipt Upload</h1>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleDeleteAllReceipts}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 space-y-6 max-w-4xl mx-auto w-full">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
            ${isProcessing ? "opacity-50 cursor-not-allowed border-muted" : "border-primary/30 hover:border-primary hover:bg-primary/5"}`}
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium mb-1">
            {isProcessing ? "Processing in progress..." : "Drop files here or click to browse"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isProcessing
              ? `Processing ${currentIndex} of ${totalFiles - queuedCount + currentIndex}...`
              : "JPG, PNG, WebP, HEIC, PDF up to 10MB each."}
          </p>
        </div>

        {/* Upload Folder button - separate from drop zone */}
        {!isProcessing && (
          <Button
            variant="outline"
            className="w-full h-14 rounded-xl text-base font-semibold flex items-center justify-center gap-3 border-2"
            onClick={() => folderInputRef.current?.click()}
          >
            <FolderOpen className="w-6 h-6" />
            Upload Entire Folder
          </Button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
        <input
          ref={setFolderRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />

        {/* Action bar */}
        {files.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground">
              {totalFiles} receipt{totalFiles !== 1 ? "s" : ""} added
              {errorFiles > 0 && (
                <span className="text-destructive ml-2">({errorFiles} failed)</span>
              )}
            </div>
            <div className="flex gap-2">
              {phase === "idle" && queuedCount > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={clearAll}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                  <Button size="sm" onClick={startProcessing}>
                    <Upload className="w-4 h-4 mr-1" />
                    Process {queuedCount} Receipt{queuedCount !== 1 ? "s" : ""}
                  </Button>
                </>
              )}
              {isProcessing && (
                <Button disabled size="sm">
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {phase === "ocr" ? "Processing OCR..." : "Matching..."}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Progress bar during OCR */}
        {phase === "ocr" && totalFiles > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>OCR Progress</span>
              <span>{currentIndex} / {totalFiles - queuedCount + currentIndex}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{
                  width: `${((processedFiles + errorFiles) / totalFiles) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Summary bar when done */}
        {phase === "done" && (
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{matchedCount} matched</span>
            </div>
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">{notMatchedCount} not matched</span>
            </div>
            {errorFiles > 0 && (
              <div className="text-sm text-muted-foreground">
                {errorFiles} OCR error{errorFiles !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}

        {/* Receipt grid */}
        <BulkReceiptGrid
          files={files}
          onRemove={removeFile}
          onManualMatch={manualMatch}
          phase={phase}
        />
      </main>
    </AppLayout>
  );
};

export default BulkReceiptUpload;
