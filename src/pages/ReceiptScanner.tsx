import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Upload, Loader2, RefreshCw, AlertCircle, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraCapture } from "@/components/receipt/CameraCapture";
import { ReceiptPreview } from "@/components/receipt/ReceiptPreview";
import { useReceiptScanner } from "@/hooks/useReceiptScanner";
import { useAuth } from "@/hooks/useAuth";
import { useCreateExpense } from "@/hooks/useExpenses";
import { useExpenseCategories } from "@/hooks/useCategories";
import { categorizeTransaction, calculateVat, VAT_RATES } from "@/services/categorization";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";

const parseVatRateToNumeric = (vatRateStr: string): number => {
  const num = parseFloat(
    vatRateStr
      .replace("standard_", "")
      .replace("reduced_", "")
      .replace("second_reduced_", "")
      .replace("livestock_", "")
      .replace("_", ".")
  );
  return isNaN(num) ? 0 : num;
};

const ReceiptScanner = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createExpense = useCreateExpense();
  const { data: categories } = useExpenseCategories();
  const [isSaving, setIsSaving] = useState(false);

  const {
    state,
    imageData,
    receiptData,
    confidence,
    error,
    startCamera,
    captureImage,
    uploadFile,
    processImage,
    updateReceiptData,
    reset,
    uploadReceipt,
  } = useReceiptScanner();

  // Auto-process when image is captured
  useEffect(() => {
    if (state === "processing" && imageData) {
      processImage();
    }
  }, [state, imageData, processImage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        return;
      }
      uploadFile(file);
    }
  };

  const handleConfirm = async () => {
    if (!receiptData || !user) return;

    setIsSaving(true);
    try {
      // Upload receipt image
      const receiptUrl = await uploadReceipt(user.id);

      // AI categorization
      const vatRateStr = receiptData.vat_rate || "standard_23";
      let categoryId: string | null = null;
      let finalVatRate = vatRateStr;

      if (categories && categories.length > 0) {
        try {
          const catResult = await categorizeTransaction(
            { description: receiptData.supplier_name || "Expense", amount: receiptData.total_amount, date: receiptData.date || new Date().toISOString() },
            categories,
            profile?.business_type
          );
          if (catResult.category_id) {
            categoryId = catResult.category_id;
          } else if (catResult.category_name) {
            const match = categories.find(c => c.name.toLowerCase() === catResult.category_name.toLowerCase());
            if (match) categoryId = match.id;
          }
          if (catResult.vat_rate) finalVatRate = catResult.vat_rate;
        } catch {
          // Categorization failed — save without category
        }
      }

      // If OCR suggested a category and AI didn't find one, try matching by name
      if (!categoryId && receiptData.suggested_category && categories) {
        const match = categories.find(c => c.name.toLowerCase().includes(receiptData.suggested_category!.toLowerCase()));
        if (match) categoryId = match.id;
      }

      // Calculate VAT
      const total = receiptData.total_amount;
      const { vat: vatAmount } = calculateVat(total, finalVatRate);
      const numericVatRate = parseVatRateToNumeric(finalVatRate);

      await createExpense.mutateAsync({
        amount: total,
        vat_amount: receiptData.vat_amount ?? vatAmount,
        vat_rate: numericVatRate,
        category_id: categoryId,
        description: receiptData.supplier_name || "Scanned Receipt",
        expense_date: receiptData.date || new Date().toISOString().split("T")[0],
        receipt_url: receiptUrl,
        notes: receiptData.invoice_number ? `Invoice: ${receiptData.invoice_number}` : null,
      });

      reset();
      toast.success("Expense saved — scan another receipt or go back.");
    } catch (err) {
      console.error("Failed to save expense:", err);
      toast.error("Failed to save expense. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Camera view - full screen without layout
  if (state === "camera") {
    return (
      <CameraCapture
        onCapture={captureImage}
        onClose={() => reset()}
      />
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="w-24" />
          <div className="flex-1 text-center">
            <h1 className="font-semibold text-xl">Scan Receipt</h1>
          </div>
          <div className="w-24" />
        </div>
      </header>

      {/* Idle State - Choose method */}
      {state === "idle" && (
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
          <div className="w-full max-w-md space-y-4">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Capture Receipt</h2>
              <p className="text-muted-foreground">
                Take a photo or upload an image to extract expense details automatically
              </p>
            </div>

            <Button
              onClick={startCamera}
              className="w-full h-16 bg-foreground text-background hover:bg-foreground/90 rounded-xl text-lg font-semibold flex items-center justify-center gap-3"
            >
              <Camera className="w-6 h-6" />
              Take Photo
            </Button>

            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full h-16 rounded-xl text-lg font-semibold flex items-center justify-center gap-3 border-2"
            >
              <Upload className="w-6 h-6" />
              Upload Image
            </Button>

            <Button
              onClick={() => navigate("/receipts/bulk")}
              variant="outline"
              className="w-full h-16 rounded-xl text-lg font-semibold flex items-center justify-center gap-3 border-2"
            >
              <Files className="w-6 h-6" />
              Bulk Upload
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <p className="text-center text-sm text-muted-foreground mt-6">
              We will automatically extract supplier, amounts, VAT, and more
            </p>
          </div>
        </main>
      )}

      {/* Processing State */}
      {(state === "uploading" || state === "processing") && (
        <main className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-center">
            {imageData && (
              <div className="w-48 h-64 mx-auto mb-6 rounded-xl overflow-hidden bg-muted">
                <img 
                  src={imageData} 
                  alt="Receipt" 
                  className="w-full h-full object-cover opacity-50"
                />
              </div>
            )}
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {state === "uploading" ? "Uploading..." : "Processing Receipt"}
            </h2>
            <p className="text-muted-foreground">
              {state === "processing" && "AI is extracting details..."}
            </p>
          </div>
        </main>
      )}

      {/* Error State */}
      {state === "error" && (
        <main className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Processing Failed</h2>
            <p className="text-muted-foreground mb-6">{error || "Something went wrong. Please try again."}</p>
            <Button onClick={reset} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          </div>
        </main>
      )}

      {/* Preview State */}
      {state === "preview" && imageData && receiptData && (
        <ReceiptPreview
          imageData={imageData}
          receiptData={receiptData}
          confidence={confidence}
          onDataChange={updateReceiptData}
          onConfirm={handleConfirm}
          onRetake={reset}
          isSaving={isSaving}
        />
      )}
    </AppLayout>
  );
};

export default ReceiptScanner;
