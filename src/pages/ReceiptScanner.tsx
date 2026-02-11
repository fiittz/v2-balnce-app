import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Upload, Loader2, RefreshCw, AlertCircle, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraCapture } from "@/components/receipt/CameraCapture";
import { ReceiptPreview } from "@/components/receipt/ReceiptPreview";
import { useReceiptScanner } from "@/hooks/useReceiptScanner";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";

const ReceiptScanner = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
    
    // Upload receipt image and get URL
    const receiptUrl = await uploadReceipt(user.id);
    
    // Navigate to expense form with pre-filled data
    const params = new URLSearchParams();
    params.set("supplier", receiptData.supplier_name || "");
    params.set("date", receiptData.date || "");
    params.set("total", receiptData.total_amount.toString());
    params.set("vat", receiptData.vat_amount?.toString() || "");
    params.set("vatRate", receiptData.vat_rate || "standard_23");
    params.set("net", receiptData.net_amount?.toString() || "");
    params.set("invoiceNumber", receiptData.invoice_number || "");
    params.set("category", receiptData.suggested_category || "");
    if (receiptUrl) params.set("receiptUrl", receiptUrl);
    
    navigate(`/expense?${params.toString()}`);
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
        />
      )}
    </AppLayout>
  );
};

export default ReceiptScanner;
