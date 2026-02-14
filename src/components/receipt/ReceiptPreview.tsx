import { Check, AlertTriangle, Sparkles, Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReceiptData } from "@/services/aiServices";

interface ReceiptPreviewProps {
  imageData: string;
  receiptData: ReceiptData;
  confidence: number;
  onDataChange: (data: ReceiptData) => void;
  onConfirm: () => void;
  onRetake: () => void;
  isSaving?: boolean;
}

const vatRateLabels: Record<string, string> = {
  standard_23: "23%",
  reduced_13_5: "13.5%",
  second_reduced_9: "9%",
  livestock_4_8: "4.8%",
  zero_rated: "0%",
  exempt: "Exempt",
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.85) return "text-green-500";
  if (confidence >= 0.65) return "text-amber-500";
  return "text-red-500";
};

const getConfidenceBg = (confidence: number) => {
  if (confidence >= 0.85) return "bg-green-100";
  if (confidence >= 0.65) return "bg-amber-100";
  return "bg-red-100";
};

export const ReceiptPreview = ({
  imageData,
  receiptData,
  confidence,
  onDataChange,
  onConfirm,
  onRetake,
  isSaving,
}: ReceiptPreviewProps) => {
  const updateField = <K extends keyof ReceiptData>(field: K, value: ReceiptData[K]) => {
    onDataChange({ ...receiptData, [field]: value });
  };

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      {/* Image Preview */}
      <div className="h-40 mx-6 mb-4 rounded-2xl overflow-hidden bg-muted">
        <img 
          src={imageData} 
          alt="Captured receipt" 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Confidence Score */}
      <div className="mx-6 mb-4">
        <div className={`flex items-center gap-3 p-4 rounded-xl ${getConfidenceBg(confidence)}`}>
          {confidence >= 0.75 ? (
            <Check className={`w-6 h-6 ${getConfidenceColor(confidence)}`} />
          ) : (
            <AlertTriangle className={`w-6 h-6 ${getConfidenceColor(confidence)}`} />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold">AI Extraction</span>
            </div>
            <p className={`text-sm ${getConfidenceColor(confidence)}`}>
              {Math.round(confidence * 100)}% confidence
              {confidence < 0.75 && " - Please verify details"}
            </p>
          </div>
        </div>
      </div>

      {/* Extracted Fields */}
      <div className="flex-1 mx-6 bg-card rounded-2xl p-6 overflow-y-auto card-shadow">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Edit2 className="w-5 h-5" />
          Extracted Data
        </h2>

        <div className="space-y-4">
          {/* Supplier */}
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Supplier</Label>
            <Input
              value={receiptData.supplier_name || ""}
              onChange={(e) => updateField("supplier_name", e.target.value)}
              placeholder="Supplier name"
              className="h-12 rounded-xl"
            />
          </div>

          {/* Date */}
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Date</Label>
            <Input
              type="date"
              value={receiptData.date || ""}
              onChange={(e) => updateField("date", e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          {/* Invoice Number */}
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Invoice/Receipt No.</Label>
            <Input
              value={receiptData.invoice_number || ""}
              onChange={(e) => updateField("invoice_number", e.target.value)}
              placeholder="Optional"
              className="h-12 rounded-xl"
            />
          </div>

          {/* Total Amount */}
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Total Amount</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">€</span>
              <Input
                type="number"
                step="0.01"
                value={receiptData.total_amount || ""}
                onChange={(e) => updateField("total_amount", parseFloat(e.target.value) || 0)}
                className="h-12 pl-10 rounded-xl text-lg font-semibold"
              />
            </div>
          </div>

          {/* VAT Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">VAT Rate</Label>
              <Select
                value={receiptData.vat_rate || "standard_23"}
                onValueChange={(v) => updateField("vat_rate", v)}
              >
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(vatRateLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">VAT Amount</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                <Input
                  type="number"
                  step="0.01"
                  value={receiptData.vat_amount || ""}
                  onChange={(e) => updateField("vat_amount", parseFloat(e.target.value) || 0)}
                  className="h-12 pl-10 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Net Amount */}
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Net Amount</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
              <Input
                type="number"
                step="0.01"
                value={receiptData.net_amount || ""}
                onChange={(e) => updateField("net_amount", parseFloat(e.target.value) || 0)}
                className="h-12 pl-10 rounded-xl"
              />
            </div>
          </div>

          {/* Suggested Category */}
          {receiptData.suggested_category && (
            <div className="p-3 bg-primary/10 rounded-xl">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Suggested category:</span>
                <span className="font-medium">{receiptData.suggested_category}</span>
              </div>
            </div>
          )}

          {/* Line Items (if any) */}
          {receiptData.line_items && receiptData.line_items.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Line Items</Label>
              <div className="bg-muted rounded-xl p-3 space-y-2 max-h-32 overflow-y-auto">
                {receiptData.line_items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="truncate flex-1">{item.description}</span>
                    <span className="font-medium ml-2">€{item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mx-6 mt-4 mb-6">
        <Button
          onClick={onRetake}
          variant="outline"
          className="flex-1 h-14 rounded-xl font-semibold border-2"
        >
          Retake
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isSaving}
          className="flex-1 h-14 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              Use Data
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
