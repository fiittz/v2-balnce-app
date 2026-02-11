import { useBackgroundTasks } from "@/contexts/BackgroundTasksContext";

// Re-export types from context for backwards compatibility
export type { FileStatus, BulkReceiptFile, BulkUploadState } from "@/contexts/BackgroundTasksContext";

export function useBulkReceiptUpload() {
  const {
    receiptState,
    totalFiles,
    queuedFiles,
    processedFiles,
    errorFiles,
    addReceiptFiles,
    removeFile,
    clearReceipts,
    startReceiptProcessing,
    manualMatch,
  } = useBackgroundTasks();

  return {
    ...receiptState,
    totalFiles,
    queuedFiles,
    processedFiles,
    errorFiles,
    addFiles: addReceiptFiles,
    removeFile,
    clearAll: clearReceipts,
    startProcessing: startReceiptProcessing,
    manualMatch,
  };
}
