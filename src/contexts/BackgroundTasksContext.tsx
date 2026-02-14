/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { processReceipt, type ReceiptData } from "@/services/aiServices";
import { useExpenseCategories } from "@/hooks/useCategories";
import {
  matchReceiptToTransaction,
  linkReceiptToTransaction,
  type MatchResult,
} from "@/lib/receiptMatcher";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useCreateJob } from "@/hooks/useProcessingJobs";

export type FileStatus = "queued" | "processing" | "done" | "error" | "matching" | "matched" | "not_matched";

export interface BulkReceiptFile {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
  imageUrl?: string;
  receiptDbId?: string;
  receiptData?: ReceiptData;
  matchResult?: MatchResult;
}

export interface BulkUploadState {
  files: BulkReceiptFile[];
  phase: "idle" | "ocr" | "matching" | "done";
  currentIndex: number;
  matchedCount: number;
  notMatchedCount: number;
}

interface BackgroundTasksContextValue {
  receiptState: BulkUploadState;
  totalFiles: number;
  queuedFiles: number;
  processedFiles: number;
  errorFiles: number;
  addReceiptFiles: (files: File[]) => void;
  removeFile: (fileId: string) => void;
  clearReceipts: () => void;
  startReceiptProcessing: () => Promise<void>;
  startServerSideProcessing: () => Promise<void>;
  manualMatch: (fileId: string, transactionId: string) => Promise<void>;
}

const BackgroundTasksContext = createContext<BackgroundTasksContextValue | null>(null);

export function useBackgroundTasks() {
  const ctx = useContext(BackgroundTasksContext);
  if (!ctx) {
    throw new Error("useBackgroundTasks must be used within BackgroundTasksProvider");
  }
  return ctx;
}

export function BackgroundTasksProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [state, setState] = useState<BulkUploadState>({
    files: [],
    phase: "idle",
    currentIndex: 0,
    matchedCount: 0,
    notMatchedCount: 0,
  });
  const abortRef = useRef(false);
  const { data: categories } = useExpenseCategories();

  // Use refs to access latest state inside async loops without stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  const updateFile = useCallback((fileId: string, updates: Partial<BulkReceiptFile>) => {
    setState((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.id === fileId ? { ...f, ...updates } : f)),
    }));
  }, []);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const uploadToStorage = useCallback(async (file: File, uid: string): Promise<string> => {
    const dataUrl = await fileToBase64(file);
    const base64Data = dataUrl.split(",")[1];
    const byteChars = atob(base64Data);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: file.type || "image/jpeg" });

    const filename = `${uid}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { data, error } = await supabase.storage
      .from("receipts")
      .upload(filename, blob, { contentType: file.type || "image/jpeg", upsert: false });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const { data: urlData } = supabase.storage
      .from("receipts")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }, []);

  const saveReceiptRecord = async (
    uid: string,
    imageUrl: string,
    receiptData: ReceiptData
  ): Promise<string> => {
    const { data, error } = await supabase
      .from("receipts")
      .insert([{
        user_id: uid,
        image_url: imageUrl,
        vendor_name: receiptData.supplier_name,
        amount: receiptData.total_amount,
        vat_amount: receiptData.vat_amount,
        vat_rate: receiptData.vat_rate ? parseFloat(receiptData.vat_rate.replace(/[^0-9.]/g, "")) || null : null,
        receipt_date: receiptData.date,
        ocr_data: JSON.parse(JSON.stringify(receiptData)),
      }])
      .select("id")
      .single();

    if (error) throw new Error(`DB insert failed: ${error.message}`);
    return data.id;
  };

  const addReceiptFiles = useCallback((newFiles: File[]) => {
    const validFiles = newFiles.filter((f) => {
      if (!f.type.startsWith("image/")) return false;
      if (f.size > 5 * 1024 * 1024) return false;
      return true;
    });

    if (validFiles.length < newFiles.length) {
      toast.warning(
        `${newFiles.length - validFiles.length} file(s) skipped (not an image or >5MB)`
      );
    }

    const entries: BulkReceiptFile[] = validFiles.map((file, i) => ({
      id: `${Date.now()}-${i}-${file.name}`,
      file,
      status: "queued" as const,
    }));

    setState((prev) => ({
      ...prev,
      files: [...prev.files, ...entries],
    }));
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setState((prev) => ({
      ...prev,
      files: prev.files.filter((f) => f.id !== fileId),
    }));
  }, []);

  const clearReceipts = useCallback(() => {
    abortRef.current = true;
    setState({
      files: [],
      phase: "idle",
      currentIndex: 0,
      matchedCount: 0,
      notMatchedCount: 0,
    });
  }, []);

  const runMatching = useCallback(async (uid: string) => {
    setState((prev) => ({ ...prev, phase: "matching" }));

    let matched = 0;
    let notMatched = 0;

    const snapshot = await new Promise<BulkReceiptFile[]>((resolve) => {
      setState((prev) => {
        resolve(prev.files);
        return prev;
      });
    });

    const doneFiles = snapshot.filter(
      (f) => f.status === "done" && f.receiptData && f.receiptDbId
    );

    for (const entry of doneFiles) {
      if (abortRef.current) break;

      updateFile(entry.id, { status: "matching" });

      try {
        const result = await matchReceiptToTransaction(
          uid,
          entry.receiptDbId!,
          entry.receiptData!.total_amount,
          entry.receiptData!.supplier_name,
          entry.receiptData!.date
        );

        if (result.autoMatched && result.transactionId) {
          await linkReceiptToTransaction(
            entry.receiptDbId!,
            result.transactionId,
            entry.imageUrl!,
            entry.receiptData!.vat_amount,
            entry.receiptData!.vat_rate
              ? parseFloat(entry.receiptData!.vat_rate.replace(/[^0-9.]/g, "")) || null
              : null
          );
          updateFile(entry.id, { status: "matched", matchResult: result });
          matched++;
        } else {
          updateFile(entry.id, { status: "not_matched", matchResult: result });
          notMatched++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Matching failed";
        updateFile(entry.id, {
          status: "not_matched",
          matchResult: {
            receiptId: entry.receiptDbId!,
            transactionId: null,
            score: 0,
            explanation: msg,
            autoMatched: false,
          },
        });
        notMatched++;
      }
    }

    setState((prev) => ({
      ...prev,
      phase: "done",
      matchedCount: matched,
      notMatchedCount: notMatched,
    }));

    toast.success(`Matching complete: ${matched} matched, ${notMatched} need review`);
  }, [updateFile]);

  const startReceiptProcessing = useCallback(async () => {
    if (!userId) {
      toast.error("Not authenticated");
      return;
    }

    abortRef.current = false;
    setState((prev) => ({ ...prev, phase: "ocr", currentIndex: 0 }));

    // Snapshot queued files at start
    const filesToProcess = stateRef.current.files.filter((f) => f.status === "queued");

    for (let i = 0; i < filesToProcess.length; i++) {
      if (abortRef.current) break;

      const entry = filesToProcess[i];
      setState((prev) => ({ ...prev, currentIndex: i + 1 }));
      updateFile(entry.id, { status: "processing" });

      try {
        const imageUrl = await uploadToStorage(entry.file, userId);

        const dataUrl = await fileToBase64(entry.file);
        const base64Data = dataUrl.split(",")[1];
        const result = await processReceipt(base64Data, categories || undefined);

        if (!result.success || !result.data) {
          throw new Error("OCR returned no data");
        }

        const receiptDbId = await saveReceiptRecord(userId, imageUrl, result.data);

        updateFile(entry.id, {
          status: "done",
          imageUrl,
          receiptDbId,
          receiptData: result.data,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Processing failed";
        updateFile(entry.id, { status: "error", error: msg });
      }
    }

    if (!abortRef.current) {
      await runMatching(userId);
    }
  }, [userId, categories, updateFile, runMatching, uploadToStorage]);

  const createJob = useCreateJob();

  const startServerSideProcessing = useCallback(async () => {
    if (!userId) {
      toast.error("Not authenticated");
      return;
    }

    const filesToProcess = stateRef.current.files.filter((f) => f.status === "queued");
    if (filesToProcess.length === 0) {
      toast.info("No files to process");
      return;
    }

    setState((prev) => ({ ...prev, phase: "ocr" }));
    toast.info(`Uploading ${filesToProcess.length} receipts...`);

    // Upload all files to storage first
    const filePaths: string[] = [];
    for (const entry of filesToProcess) {
      try {
        updateFile(entry.id, { status: "processing" });
        const imageUrl = await uploadToStorage(entry.file, userId);
        const path = `${userId}/${entry.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        filePaths.push(path);
        updateFile(entry.id, { status: "done", imageUrl });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        updateFile(entry.id, { status: "error", error: msg });
      }
    }

    if (filePaths.length === 0) {
      toast.error("No files uploaded successfully");
      setState((prev) => ({ ...prev, phase: "done" }));
      return;
    }

    // Create server-side job
    try {
      await createJob.mutateAsync({
        job_type: "receipt_ocr",
        total_items: filePaths.length,
        input_data: {
          file_paths: filePaths,
          categories: categories?.map((c) => ({ id: c.id, name: c.name, type: c.type })) || [],
        },
      });
      setState((prev) => ({ ...prev, phase: "done" }));
      toast.success("Processing started server-side. Check progress in the status bar.");
    } catch (err) {
      toast.error("Failed to start server-side processing. Falling back to client-side.");
      // Fallback to client-side processing
      await startReceiptProcessing();
    }
  }, [userId, categories, updateFile, createJob, startReceiptProcessing, uploadToStorage]);

  const manualMatch = useCallback(
    async (fileId: string, transactionId: string) => {
      const entry = stateRef.current.files.find((f) => f.id === fileId);
      if (!entry || !entry.receiptDbId || !entry.imageUrl) return;

      try {
        await linkReceiptToTransaction(
          entry.receiptDbId,
          transactionId,
          entry.imageUrl,
          entry.receiptData?.vat_amount,
          entry.receiptData?.vat_rate
            ? parseFloat(entry.receiptData.vat_rate.replace(/[^0-9.]/g, "")) || null
            : null
        );

        updateFile(fileId, {
          status: "matched",
          matchResult: {
            receiptId: entry.receiptDbId,
            transactionId,
            score: 1.0,
            explanation: "Manually assigned",
            autoMatched: false,
          },
        });

        setState((prev) => ({
          ...prev,
          matchedCount: prev.matchedCount + 1,
          notMatchedCount: Math.max(0, prev.notMatchedCount - 1),
        }));

        toast.success("Receipt linked to transaction");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Link failed";
        toast.error(msg);
      }
    },
    [updateFile]
  );

  const totalFiles = state.files.length;
  const queuedFiles = state.files.filter((f) => f.status === "queued").length;
  const processedFiles = state.files.filter((f) =>
    ["done", "matched", "not_matched", "matching"].includes(f.status)
  ).length;
  const errorFiles = state.files.filter((f) => f.status === "error").length;

  const value: BackgroundTasksContextValue = {
    receiptState: state,
    totalFiles,
    queuedFiles,
    processedFiles,
    errorFiles,
    addReceiptFiles,
    removeFile,
    clearReceipts,
    startReceiptProcessing,
    startServerSideProcessing,
    manualMatch,
  };

  return (
    <BackgroundTasksContext.Provider value={value}>
      {children}
    </BackgroundTasksContext.Provider>
  );
}
