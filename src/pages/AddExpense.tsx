import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Upload, Sparkles, Loader2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExpenseCategories } from "@/hooks/useCategories";
import { useSuppliers, useCreateSupplier } from "@/hooks/useSuppliers";
import { useCreateExpense } from "@/hooks/useExpenses";
import { useAuth } from "@/hooks/useAuth";
import { calculateVat, VAT_RATES, categorizeTransaction } from "@/services/categorization";
import { toast } from "sonner";
// VAT rate types for Irish system
type VatRate = "standard_23" | "reduced_13_5" | "second_reduced_9" | "livestock_4_8" | "zero_rated" | "exempt";

const vatRateLabels: Record<VatRate, string> = {
  standard_23: "23%",
  reduced_13_5: "13.5%",
  second_reduced_9: "9%",
  livestock_4_8: "4.8%",
  zero_rated: "0%",
  exempt: "Exempt",
};

const AddExpense = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { data: categories, isLoading: categoriesLoading } = useExpenseCategories();
  const { data: suppliers } = useSuppliers();
  const createExpense = useCreateExpense();
  const createSupplier = useCreateSupplier();

  // Get pre-filled data from receipt scanner
  const prefillSupplier = searchParams.get("supplier");
  const prefillDate = searchParams.get("date");
  const prefillTotal = searchParams.get("total");
  const prefillVat = searchParams.get("vat");
  const prefillVatRate = searchParams.get("vatRate") as VatRate | null;
  const prefillNet = searchParams.get("net");
  const prefillInvoiceNumber = searchParams.get("invoiceNumber");
  const prefillCategory = searchParams.get("category");
  const prefillReceiptUrl = searchParams.get("receiptUrl");

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedVat, setSelectedVat] = useState<VatRate>(prefillVatRate || "standard_23");
  const [amount, setAmount] = useState(prefillTotal || "");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [description, setDescription] = useState(prefillSupplier || "");
  const [expenseDate, setExpenseDate] = useState(prefillDate || new Date().toISOString().split("T")[0]);
  const [invoiceNumber, setInvoiceNumber] = useState(prefillInvoiceNumber || "");
  const [receiptUrl, setReceiptUrl] = useState(prefillReceiptUrl || "");
  const [isAiCategorizing, setIsAiCategorizing] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  
  // Initialize from prefill data
  useEffect(() => {
    if (prefillCategory && categories) {
      const match = categories.find(c => 
        c.name.toLowerCase().includes(prefillCategory.toLowerCase())
      );
      if (match) setSelectedCategory(match.id);
    }
  }, [prefillCategory, categories]);

  // Calculate VAT amounts
  const total = parseFloat(amount) || 0;
  const { net: netAmount, vat: vatAmount } = calculateVat(total, selectedVat);

  // Get selected category details
  const selectedCategoryData = categories?.find(c => c.id === selectedCategory);

  // Auto-categorize when description changes
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (description.length > 3 && categories && categories.length > 0) {
        setIsAiCategorizing(true);
        try {
        const result = await categorizeTransaction(
            { description, amount: total, date: new Date().toISOString() },
            categories,
            profile?.business_type
          );
          
          if (result.category_id) {
            setSelectedCategory(result.category_id);
          } else if (result.category_name) {
            // Find by name if ID not provided
            const match = categories.find(c => 
              c.name.toLowerCase() === result.category_name.toLowerCase()
            );
            if (match) setSelectedCategory(match.id);
          }
          
          if (result.vat_rate) {
            setSelectedVat(result.vat_rate as VatRate);
          }
          
          setAiExplanation(result.explanation);
          setAiConfidence(result.confidence);
        } catch (error) {
          console.error("AI categorization failed:", error);
        } finally {
          setIsAiCategorizing(false);
        }
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [description, categories, profile?.business_type, total]);

  // Update VAT rate when category changes (use vat_rate from category)
  useEffect(() => {
    if (selectedCategoryData?.vat_rate) {
      // Map numeric vat_rate to string format
      const rate = selectedCategoryData.vat_rate;
      if (rate === 23) setSelectedVat("standard_23");
      else if (rate === 13.5) setSelectedVat("reduced_13_5");
      else if (rate === 9) setSelectedVat("second_reduced_9");
      else if (rate === 4.8) setSelectedVat("livestock_4_8");
      else if (rate === 0) setSelectedVat("zero_rated");
    }
  }, [selectedCategoryData]);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      await createExpense.mutateAsync({
        amount: total,
        vat_amount: vatAmount,
        vat_rate: parseFloat(selectedVat.replace("standard_", "").replace("reduced_", "").replace("second_reduced_", "").replace("livestock_", "").replace("_", ".")) || 0,
        category_id: selectedCategory,
        supplier_id: supplierId,
        description: description || "Expense",
        expense_date: expenseDate,
      });
      navigate("/dashboard");
    } catch (error) {
      // Error handled in hook
    }
  };

  // Get icon component dynamically
  const getIconComponent = (iconName: string | null) => {
    if (!iconName) return LucideIcons.Folder;
    const pascalCase = iconName.split("-").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
    return (LucideIcons as any)[pascalCase] || LucideIcons.Folder;
  };

  return (
    <AppLayout>
      <div className="flex-1">
        {/* Header */}
        <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="w-24" />
            <div className="flex-1 text-center">
              <h1 className="font-semibold text-xl">Add Expense</h1>
            </div>
            <div className="w-24" />
          </div>
        </header>

        <main className="px-6 py-6 pb-32 max-w-2xl mx-auto space-y-6">
        {/* Description (for AI categorization) */}
        <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Description</Label>
              {isAiCategorizing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI categorizing...</span>
                </div>
              )}
            </div>
            <Input
              placeholder="e.g., Timber from Woodies, Fuel at Circle K"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-14 rounded-xl text-base"
            />
            {aiExplanation && aiConfidence !== null && (
              <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg mt-2">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="text-foreground">{aiExplanation}</p>
                  <p className="text-muted-foreground mt-1">
                    Confidence: {Math.round(aiConfidence * 100)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Supplier */}
        <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in">
          <div className="space-y-2">
            <Label className="font-medium">Supplier</Label>
            <Select value={supplierId || ""} onValueChange={setSupplierId}>
              <SelectTrigger className="h-14 rounded-xl text-base">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
                <SelectItem value="new">+ Add new supplier</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Category Selection */}
        <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in" style={{ animationDelay: "0.05s" }}>
          <Label className="font-medium mb-4 block">Category</Label>
          {categoriesLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-4 rounded-xl bg-muted animate-pulse h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
              {categories?.map((cat) => {
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                      selectedCategory === cat.id
                        ? "bg-foreground text-background border-foreground"
                        : "bg-muted border-transparent hover:border-border"
                    }`}
                  >
                    <span className="text-xs font-medium text-center leading-tight">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <Label className="font-medium mb-4 block">Total Amount (incl. VAT)</Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">€</span>
            <Input 
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="h-20 pl-10 text-4xl font-bold rounded-xl text-center"
            />
          </div>
        </div>

        {/* VAT Category */}
        <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in" style={{ animationDelay: "0.15s" }}>
          <Label className="font-medium mb-4 block">VAT Rate</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(vatRateLabels) as [VatRate, string][]).map(([rate, label]) => (
              <button
                key={rate}
                onClick={() => setSelectedVat(rate)}
                className={`px-5 py-3 rounded-full border-2 font-medium transition-all ${
                  selectedVat === rate
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent border-foreground/20 hover:border-foreground/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Receipt Upload */}
        <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <Label className="font-medium mb-4 block">Receipt</Label>
          <div 
            className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-foreground/40 transition-colors"
            onClick={() => navigate("/scanner")}
          >
            <Upload className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-medium">Upload or scan receipt</p>
            <p className="text-sm text-muted-foreground">Tap to capture or select file</p>
          </div>
        </div>

        {/* Summary */}
        {amount && parseFloat(amount) > 0 && (
          <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in">
            <h2 className="font-semibold text-lg mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Amount</span>
                <span className="font-medium">€{netAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT</span>
                <span className="font-medium">€{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-border">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-xl">€{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="max-w-2xl mx-auto">
          <Button 
            onClick={handleSave}
            disabled={createExpense.isPending || !amount}
            className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 rounded-xl text-lg font-semibold disabled:opacity-50"
          >
            {createExpense.isPending ? "Saving..." : "Save Expense"}
          </Button>
        </div>
      </div>
      </div>
    </AppLayout>
  );
};

export default AddExpense;
