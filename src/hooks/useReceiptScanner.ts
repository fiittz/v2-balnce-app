import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { processReceipt, type ReceiptData, type ReceiptResult } from "@/services/aiServices";
import { useExpenseCategories } from "@/hooks/useCategories";
import { toast } from "sonner";

export type ScannerState = "idle" | "camera" | "uploading" | "processing" | "preview" | "error";

interface UseReceiptScannerReturn {
  state: ScannerState;
  imageData: string | null;
  receiptData: ReceiptData | null;
  confidence: number;
  rawText: string | null;
  error: string | null;
  startCamera: () => void;
  captureImage: (imageData: string) => void;
  uploadFile: (file: File) => void;
  processImage: () => Promise<void>;
  updateReceiptData: (data: ReceiptData) => void;
  reset: () => void;
  uploadReceipt: (userId: string) => Promise<string | null>;
}

export const useReceiptScanner = (): UseReceiptScannerReturn => {
  const [state, setState] = useState<ScannerState>("idle");
  const [imageData, setImageData] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [rawText, setRawText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { data: categories } = useExpenseCategories();

  const startCamera = useCallback(() => {
    setState("camera");
    setError(null);
  }, []);

  const captureImage = useCallback((data: string) => {
    setImageData(data);
    setState("processing");
  }, []);

  const uploadFile = useCallback((file: File) => {
    setState("uploading");
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageData(result);
      setState("processing");
    };
    reader.onerror = () => {
      setError("Failed to read file");
      setState("error");
    };
    reader.readAsDataURL(file);
  }, []);

  const processImage = useCallback(async () => {
    if (!imageData) {
      setError("No image to process");
      setState("error");
      return;
    }

    try {
      setState("processing");
      
      // Extract base64 data and MIME type (remove data:image/...;base64, prefix)
      const base64Data = imageData.split(",")[1];
      const mimeType = imageData.split(",")[0]?.match(/:(.*?);/)?.[1] || "image/jpeg";

      const result: ReceiptResult = await processReceipt(base64Data, categories || undefined, mimeType);
      
      if (result.success && result.data) {
        setReceiptData(result.data);
        setConfidence(result.data.confidence);
        setRawText(result.raw_text);
        setState("preview");
        
        if (result.data.confidence < 0.75) {
          toast.warning("Low confidence extraction. Please verify the details.");
        }
      } else {
        throw new Error("OCR processing returned no data");
      }
    } catch (err) {
      console.error("OCR processing error:", err);
      const message = err instanceof Error ? err.message : "Failed to process receipt";
      setError(message);
      setState("error");
      toast.error(message);
    }
  }, [imageData, categories]);

  const updateReceiptData = useCallback((data: ReceiptData) => {
    setReceiptData(data);
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setImageData(null);
    setReceiptData(null);
    setConfidence(0);
    setRawText(null);
    setError(null);
  }, []);

  const uploadReceipt = useCallback(async (userId: string): Promise<string | null> => {
    if (!imageData) return null;
    
    try {
      // Convert base64 to blob
      const base64Data = imageData.split(",")[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });
      
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${userId}/${timestamp}-receipt.jpg`;
      
      const { data, error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filename, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });
      
      if (uploadError) {
        console.error("Upload error:", uploadError);
        return null;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(data.path);
      
      return urlData.publicUrl;
    } catch (err) {
      console.error("Receipt upload error:", err);
      return null;
    }
  }, [imageData]);

  return {
    state,
    imageData,
    receiptData,
    confidence,
    rawText,
    error,
    startCamera,
    captureImage,
    uploadFile,
    processImage,
    updateReceiptData,
    reset,
    uploadReceipt,
  };
};
