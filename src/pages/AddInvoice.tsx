import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Upload, X, FileText } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateInvoice, useInvoice, useUpdateInvoice } from "@/hooks/useInvoices";
import { supabase } from "@/integrations/supabase/client";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import { useAuth } from "@/hooks/useAuth";
import { VAT_RATES } from "@/services/categorization";
import { generateInvoiceHTML } from "@/lib/invoiceHtml";
import { toast } from "sonner";
// VAT rate types for Irish system
type VatRate = "standard_23" | "reduced_13_5" | "second_reduced_9" | "livestock_4_8" | "zero_rated" | "exempt";

interface LineItem {
  id: number;
  description: string;
  qty: number;
  price: number;
  vatRate: VatRate;
}

const vatRateLabels: Record<VatRate, string> = {
  standard_23: "23%",
  reduced_13_5: "13.5%",
  second_reduced_9: "9%",
  livestock_4_8: "4.8%",
  zero_rated: "0%",
  exempt: "Exempt",
};

const AddInvoice = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const isEditMode = !!editId;
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const { data: existingInvoice } = useInvoice(editId);
  const { data: onboarding } = useOnboardingSettings();
  const { user, profile } = useAuth();

  // Set correct default VAT rate based on business settings
  const rctActive = !!(onboarding as any)?.rct_status && (onboarding as any).rct_status !== "not_applicable";
  const businessChargesVAT = (onboarding as any)?.vat_registered === true && !rctActive;
  const defaultVatRate: VatRate = businessChargesVAT ? "standard_23" : "zero_rated";

  // Determine if business is construction-related
  const CONSTRUCTION_ACTIVITIES = [
    "carpentry_joinery", "general_construction", "electrical_contracting",
    "plumbing_heating", "bricklaying_masonry", "plastering_drylining",
    "painting_decorating", "roofing", "groundworks_civil", "landscaping",
    "tiling_stonework", "steel_fabrication_welding", "quantity_surveying",
    "project_management", "site_supervision", "property_maintenance",
    "property_development",
  ];
  const primaryActivity = (onboarding as any)?.primary_activity || "";
  const secondaryActivities: string[] = (onboarding as any)?.secondary_activities || [];
  const isConstructionTrade = CONSTRUCTION_ACTIVITIES.includes(primaryActivity) ||
    secondaryActivities.some((a: string) => CONSTRUCTION_ACTIVITIES.includes(a));

  // Filter VAT rates based on business type
  const availableVatRates = (() => {
    if (!businessChargesVAT) {
      return { zero_rated: "No VAT", exempt: "Exempt" } as Record<VatRate, string>;
    }
    if (!isConstructionTrade) {
      return { standard_23: "23%", zero_rated: "0%", exempt: "Exempt" } as Record<VatRate, string>;
    }
    return vatRateLabels;
  })();

  const [invoiceType, setInvoiceType] = useState<"quote" | "invoice">("invoice");
  const [rctEnabled, setRctEnabled] = useState(false);
  const [rctRate, setRctRate] = useState<number>(20);
  const [comment, setComment] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, description: "", qty: 1, price: 0, vatRate: defaultVatRate }
  ]);

  // Supplier details state (your business) - pre-filled from onboarding
  const [supplierName, setSupplierName] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierVatNumber, setSupplierVatNumber] = useState("");

  // Pre-fill supplier details from onboarding/profile
  useEffect(() => {
    if (onboarding || profile) {
      setSupplierName(onboarding?.business_name || profile?.business_name || "");
      setSupplierAddress(profile?.address || "");
      setSupplierVatNumber(onboarding?.vat_number || profile?.vat_number || "");
    }
  }, [onboarding, profile]);

  // Load existing invoice for edit mode
  useEffect(() => {
    if (existingInvoice && isEditMode) {
      setInvoiceDate(existingInvoice.invoice_date || new Date().toISOString().split("T")[0]);

      // Load customer details from FK
      if (existingInvoice.customer_id && user) {
        supabase
          .from("customers")
          .select("*")
          .eq("id", existingInvoice.customer_id)
          .single()
          .then(({ data: cust }) => {
            if (cust) {
              setCustomerName(cust.name || "");
              setCustomerEmail(cust.email || "");
              setCustomerPhone(cust.phone || "");
              setCustomerAddress(cust.address || "");
              setCustomerTaxNumber(cust.vat_number || "");
            }
          });
      }

      // Parse extra data from notes JSON
      let notesObj: any = null;
      try {
        notesObj = existingInvoice.notes ? JSON.parse(existingInvoice.notes) : null;
      } catch {
        // notes is plain text, not JSON
        setComment(existingInvoice.notes || "");
      }

      if (notesObj) {
        setComment(notesObj.comment || "");
        setInvoiceType(notesObj.invoice_type || "invoice");
        setSupplyDate(notesObj.supply_date || "");
        setJobStartDate(notesObj.job_start_date || "");
        setJobEndDate(notesObj.job_end_date || "");
        setRctEnabled(notesObj.rct_enabled || false);
        setRctRate(notesObj.rct_rate || 20);

        const items = notesObj.line_items;
        if (Array.isArray(items) && items.length > 0) {
          setLineItems(items.map((item: any, idx: number) => ({
            id: idx + 1,
            description: item.description || "",
            qty: item.qty || 1,
            price: item.price || 0,
            vatRate: item.vatRate || defaultVatRate,
          })));
        }
      }
    }
  }, [existingInvoice, isEditMode, user]);

  // Customer details state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerTaxNumber, setCustomerTaxNumber] = useState("");
  
  // Date of supply (tax point)
  const [supplyDate, setSupplyDate] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);

  // Job start/end dates for trip detection
  const [jobStartDate, setJobStartDate] = useState("");
  const [jobEndDate, setJobEndDate] = useState("");

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Logo must be less than 2MB");
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogo(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogo(null);
    setLogoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { id: Date.now(), description: "", qty: 1, price: 0, vatRate: defaultVatRate }]);
  };

  const removeLineItem = (id: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: number, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Calculate totals
  // When RCT applies, VAT reverse charge means subcontractor does NOT charge VAT
  const subtotal = lineItems.reduce((sum, item) => sum + (item.qty * item.price), 0);

  const vatAmount = rctEnabled ? 0 : lineItems.reduce((sum, item) => {
    const lineTotal = item.qty * item.price;
    const vatRate = VAT_RATES[item.vatRate] || 0;
    return sum + (lineTotal * vatRate);
  }, 0);

  const total = subtotal + vatAmount;

  // RCT is deducted from the gross payment (subtotal when reverse charge applies)
  const rctAmount = rctEnabled ? (subtotal * (rctRate / 100)) : 0;
  const netReceivable = total - rctAmount;

  const handleSave = async () => {
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    if (!customerName.trim()) {
      toast.error("Please enter customer name");
      return;
    }

    if (!customerAddress.trim()) {
      toast.error("Please enter customer address");
      return;
    }

    if (lineItems.every(item => !item.description || item.price <= 0)) {
      toast.error("Please add at least one line item");
      return;
    }

    const validItems = lineItems.filter(item => item.description && item.price > 0);

    try {
      // Upsert customer record
      const { data: existingCustomers } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", customerName.trim())
        .limit(1);

      let customerId: string;

      if (existingCustomers && existingCustomers.length > 0) {
        customerId = existingCustomers[0].id;
        await supabase
          .from("customers")
          .update({
            email: customerEmail.trim() || null,
            phone: customerPhone.trim() || null,
            address: customerAddress.trim() || null,
            vat_number: customerTaxNumber.trim() || null,
          })
          .eq("id", customerId);
      } else {
        const { data: newCustomer, error: custError } = await supabase
          .from("customers")
          .insert({
            user_id: user.id,
            name: customerName.trim(),
            email: customerEmail.trim() || null,
            phone: customerPhone.trim() || null,
            address: customerAddress.trim() || null,
            vat_number: customerTaxNumber.trim() || null,
          })
          .select("id")
          .single();

        if (custError) throw custError;
        customerId = newCustomer.id;
      }

      // Pack extra data into notes JSON
      const notesData = JSON.stringify({
        comment: comment || null,
        invoice_type: invoiceType,
        supply_date: supplyDate || null,
        job_start_date: jobStartDate || null,
        job_end_date: jobEndDate || null,
        rct_enabled: rctEnabled,
        rct_rate: rctEnabled ? rctRate : 0,
        rct_amount: rctEnabled ? rctAmount : 0,
        line_items: validItems.map(item => ({
          description: item.description,
          qty: item.qty,
          price: item.price,
          vatRate: item.vatRate,
        })),
      });

      const invoiceData = {
        invoice_date: invoiceDate,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        subtotal,
        vat_amount: vatAmount,
        total,
        notes: notesData,
        customer_id: customerId,
      };

      if (isEditMode && editId) {
        await updateInvoice.mutateAsync({ id: editId, ...invoiceData });
      } else {
        await createInvoice.mutateAsync({
          invoice: { ...invoiceData, status: "draft" },
        });
      }
      navigate("/invoices");
    } catch (error) {
      console.error("Save invoice error:", error);
    }
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePreviewPdf = async () => {
    if (!customerName.trim()) {
      toast.error("Please enter customer name to preview");
      return;
    }

    if (lineItems.every(item => !item.description || item.price <= 0)) {
      toast.error("Please add at least one line item");
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const validItems = lineItems.filter(item => item.description && item.price > 0);

      const items = validItems.map(item => {
        const lineTotal = item.qty * item.price;
        const vatRate = rctEnabled ? 0 : (VAT_RATES[item.vatRate] || 0);
        const itemVat = lineTotal * vatRate;
        return {
          description: item.description,
          qty: item.qty,
          price: item.price,
          vatRate: rctEnabled ? "zero_rated" as VatRate : item.vatRate,
          lineTotal,
          vat_amount: itemVat,
          total_amount: lineTotal + itemVat,
        };
      });

      const html = generateInvoiceHTML({
        invoiceType,
        supplierName,
        supplierAddress,
        supplierVatNumber,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        customerTaxNumber,
        invoiceDate,
        supplyDate,
        items,
        subtotal,
        vatAmount,
        total,
        rctEnabled,
        rctRate,
        rctAmount,
        comment,
      });

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      } else {
        toast.error("Please allow popups to preview the invoice");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF preview");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex-1">
        {/* Header */}
        <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="font-semibold text-xl">{isEditMode ? "Edit Invoice" : "Add Invoice"}</h1>
          </div>
        </header>

        <main className="px-6 py-6 pb-32 max-w-2xl mx-auto space-y-6">
        {/* Logo Upload */}
        <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in">
          <Label className="font-medium mb-3 block">Company Logo</Label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleLogoUpload}
            accept="image/*"
            className="hidden"
          />
          {logo ? (
            <div className="relative inline-block">
              <img
                src={logo}
                alt="Company logo"
                className="h-20 max-w-[200px] object-contain rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={removeLogo}
                className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-border rounded-xl hover:border-foreground/40 transition-colors"
            >
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-muted-foreground">Upload logo</span>
            </button>
          )}
          <p className="text-xs text-muted-foreground mt-2">PNG, JPG up to 2MB</p>
        </div>




        {/* Customer & Invoice Details */}
        <div className="bg-card rounded-2xl p-6 card-shadow space-y-5 animate-fade-in">
          <h2 className="font-semibold text-lg">Customer Details</h2>
          
          <div className="space-y-2">
            <Label className="font-medium">Type</Label>
            <div className="flex gap-2">
              {(["quote", "invoice"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setInvoiceType(type)}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium capitalize transition-all ${
                    invoiceType === type
                      ? "bg-foreground text-background border-foreground"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-medium">Customer Name *</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
              className="h-14 rounded-xl text-base"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-medium">Customer Email</Label>
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com"
              className="h-14 rounded-xl text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-medium">Phone</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+353 1234567"
                className="h-14 rounded-xl text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Invoice Date *</Label>
              <Input 
                type="date" 
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="h-14 rounded-xl text-base"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-medium">Customer Address *</Label>
            <AddressAutocomplete
              value={customerAddress}
              onChange={setCustomerAddress}
              placeholder="Start typing a town or address..."
              className="h-14 rounded-xl text-base"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-medium">Company Tax No.</Label>
            <Input
              value={customerTaxNumber}
              onChange={(e) => setCustomerTaxNumber(e.target.value)}
              placeholder="e.g. IE1234567X"
              className="h-14 rounded-xl text-base"
            />
            <p className="text-xs text-muted-foreground">If applicable</p>
          </div>

          <div className="space-y-2">
            <Label className="font-medium">Date of Supply (Tax Point)</Label>
            <Input
              type="date"
              value={supplyDate}
              onChange={(e) => setSupplyDate(e.target.value)}
              className="h-14 rounded-xl text-base"
            />
            <p className="text-xs text-muted-foreground">Leave blank if same as invoice date</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-medium">Job Start Date</Label>
              <Input
                type="date"
                value={jobStartDate}
                onChange={(e) => setJobStartDate(e.target.value)}
                className="h-14 rounded-xl text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Job End Date</Label>
              <Input
                type="date"
                value={jobEndDate}
                onChange={(e) => setJobEndDate(e.target.value)}
                className="h-14 rounded-xl text-base"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Used for trip detection — matches expenses within this date range</p>
        </div>

        {/* Line Items */}
        <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Line Items</h2>
            <Button 
              onClick={addLineItem}
              variant="outline"
              size="sm"
              className="rounded-lg"
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>

          <div className="space-y-4">
            {lineItems.map((item, index) => (
              <div key={item.id} className="p-4 bg-muted rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                  {lineItems.length > 1 && (
                    <button onClick={() => removeLineItem(item.id)} className="text-destructive p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Input 
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                  className="h-12 rounded-lg"
                />
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Qty</Label>
                    <Input 
                      type="number"
                      value={item.qty}
                      onChange={(e) => updateLineItem(item.id, "qty", parseInt(e.target.value) || 0)}
                      className="h-12 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Price (€)</Label>
                    <Input 
                      type="number"
                      value={item.price}
                      onChange={(e) => updateLineItem(item.id, "price", parseFloat(e.target.value) || 0)}
                      className="h-12 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">VAT</Label>
                    <Select 
                      value={item.vatRate} 
                      onValueChange={(v) => updateLineItem(item.id, "vatRate", v as VatRate)}
                    >
                      <SelectTrigger className="h-12 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(availableVatRates) as [VatRate, string][]).map(([rate, label]) => (
                          <SelectItem key={rate} value={rate}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RCT Toggle — only visible for construction trades */}
        {isConstructionTrade && <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">RCT Applies</h3>
              <p className="text-sm text-muted-foreground">Enable for relevant contract tax</p>
            </div>
            <Switch checked={rctEnabled} onCheckedChange={setRctEnabled} />
          </div>
          
          {rctEnabled && (
            <div className="mt-4 pt-4 border-t border-border">
              <Label className="text-sm font-medium mb-2 block">RCT Rate</Label>
              <div className="flex gap-2">
                {[0, 20, 35].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setRctRate(rate)}
                    className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                      rctRate === rate
                        ? "bg-foreground text-background border-foreground"
                        : "border-foreground/20 hover:border-foreground/40"
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {rctRate === 0 && "Subcontractor is fully tax compliant"}
                {rctRate === 20 && "Standard RCT rate"}
                {rctRate === 35 && "Non-compliant or unknown subcontractor"}
              </p>
            </div>
          )}
        </div>}

        {/* Comments */}
        <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in" style={{ animationDelay: "0.18s" }}>
          <Label className="font-semibold text-lg mb-3 block">Notes / Comments</Label>
          <Textarea
            placeholder="Add any notes or comments for this invoice..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[100px] rounded-xl resize-none"
          />
        </div>

        {/* Summary */}
        <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <h2 className="font-semibold text-lg mb-4">Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">€{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT</span>
              <span className="font-medium">
                {rctEnabled ? "€0.00 (Reverse Charge)" : `€${vatAmount.toFixed(2)}`}
              </span>
            </div>
            {rctEnabled && (
              <p className="text-xs text-amber-600">
                VAT reverse charge applies — principal contractor accounts for VAT
              </p>
            )}
            {rctEnabled && (
              <div className="flex justify-between text-amber-600">
                <span>RCT Deduction ({rctRate}%)</span>
                <span className="font-medium">-€{rctAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-border">
              <span className="font-semibold text-lg">
                {rctEnabled ? "Net Receivable" : "Total"}
              </span>
              <span className="font-bold text-2xl">
                €{(rctEnabled ? netReceivable : total).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Action Buttons */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-40">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Button 
            onClick={handlePreviewPdf}
            disabled={isGeneratingPdf}
            variant="outline"
            className="flex-1 h-14 rounded-xl text-lg font-semibold"
          >
            <FileText className="w-5 h-5 mr-2" />
            {isGeneratingPdf ? "Generating..." : "Preview PDF"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={createInvoice.isPending || updateInvoice.isPending}
            className="flex-1 h-14 bg-foreground text-background hover:bg-foreground/90 rounded-xl text-lg font-semibold disabled:opacity-50"
          >
            {(createInvoice.isPending || updateInvoice.isPending) ? "Saving..." : isEditMode ? "Update Invoice" : "Save Invoice"}
          </Button>
        </div>
      </div>
      </div>
    </AppLayout>
  );
};

export default AddInvoice;
