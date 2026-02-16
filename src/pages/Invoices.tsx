import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Clock, CheckCircle, Download } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useInvoices } from "@/hooks/useInvoices";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { generateInvoiceHTML } from "@/lib/invoiceHtml";
import { VAT_RATES } from "@/services/categorization";

const statusConfig = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Clock },
  paid: { label: "Paid", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: Clock },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", icon: FileText },
};

const Invoices = () => {
  const navigate = useNavigate();
  const { data: accounts } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const { data: invoices, isLoading } = useInvoices(
    selectedAccountId ? { account_id: selectedAccountId } : undefined
  );
  const { data: onboarding } = useOnboardingSettings();
  const { data: bankAccounts } = useAccounts("bank");
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const primaryBank = bankAccounts?.[0];

  const buildInvoiceHtml = async (invoice: Record<string, unknown>) => {
    // Fetch customer details
    let customer = { name: "Customer", email: "", phone: "", address: "", vat_number: "" };
    if (invoice.customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("*")
        .eq("id", invoice.customer_id)
        .single();
      if (cust) customer = cust as typeof customer;
    }

    // Parse notes JSON for line items + extra data
    let notesObj: Record<string, unknown> | null = null;
    let comment = "";
    try {
      notesObj = invoice.notes ? JSON.parse(invoice.notes) : null;
    } catch {
      comment = invoice.notes || "";
    }

    const lineItems = notesObj?.line_items || [];
    const invoiceType = notesObj?.invoice_type || "invoice";
    const supplyDate = notesObj?.supply_date || "";
    const rctEnabled = notesObj?.rct_enabled || false;
    const rctRate = notesObj?.rct_rate || 0;
    const rctAmount = notesObj?.rct_amount || 0;
    const poNumber = notesObj?.po_number || "";
    if (notesObj?.comment) comment = notesObj.comment;

    const items = lineItems.map((item: Record<string, unknown>) => {
      const lineTotal = (item.qty as number) * (item.price as number);
      const vatRate = VAT_RATES[item.vatRate as keyof typeof VAT_RATES] || 0;
      const itemVat = lineTotal * vatRate;
      return {
        description: item.description,
        qty: item.qty,
        price: item.price,
        vatRate: item.vatRate,
        unitType: item.unitType || "items",
        lineTotal,
        vat_amount: itemVat,
        total_amount: lineTotal + itemVat,
      };
    });

    return {
      html: generateInvoiceHTML({
        invoiceType,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        supplierName: onboarding?.business_name || profile?.business_name || "",
        supplierAddress: profile?.address || "",
        supplierVatNumber: onboarding?.vat_number || profile?.vat_number || "",
        supplierIban: primaryBank?.iban || "",
        supplierBic: primaryBank?.bic || "",
        customerName: customer.name,
        customerEmail: customer.email || "",
        customerPhone: customer.phone || "",
        customerAddress: customer.address || "",
        customerTaxNumber: customer.vat_number || "",
        customerPoNumber: poNumber,
        invoiceDate: invoice.invoice_date,
        supplyDate,
        dueDate: invoice.due_date || undefined,
        items,
        subtotal: invoice.subtotal || 0,
        vatAmount: invoice.vat_amount || 0,
        total: invoice.total || 0,
        rctEnabled,
        rctRate,
        rctAmount,
        comment,
      }),
      customer,
    };
  };

  const generatePdfBlob = async (html: string): Promise<Blob> => {
    // Render HTML in a hidden container
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "794px"; // A4 width in px at 96dpi
    container.innerHTML = html;
    document.body.appendChild(container);

    // Wait for content to render
    await new Promise((r) => setTimeout(r, 300));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      width: 794,
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // Handle multi-page if content is longer than one page
    const pageHeight = pdf.internal.pageSize.getHeight();
    let position = 0;

    if (pdfHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    } else {
      while (position < pdfHeight) {
        pdf.addImage(imgData, "PNG", 0, -position, pdfWidth, pdfHeight);
        position += pageHeight;
        if (position < pdfHeight) pdf.addPage();
      }
    }

    return pdf.output("blob");
  };

  const handleDownloadPdf = async (e: React.MouseEvent, invoice: Record<string, unknown>) => {
    e.stopPropagation();
    setLoadingId(invoice.id);
    try {
      const { html } = await buildInvoiceHtml(invoice);
      const blob = await generatePdfBlob(html);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoice_number || "Invoice"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="flex-1">
        <PageHeader
          title="Invoices"
          rightContent={
            <Button
              onClick={() => navigate("/invoice")}
              className="rounded-xl"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Invoice
            </Button>
          }
        />

        <main className="px-6 py-6 pb-24 max-w-4xl mx-auto">
          {accounts && accounts.length > 1 && (
            <div className="mb-6">
              <Select
                value={selectedAccountId || "all"}
                onValueChange={(v) => setSelectedAccountId(v === "all" ? null : v)}
              >
                <SelectTrigger className="h-12 rounded-xl text-base w-full max-w-xs">
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-2xl p-5 card-shadow animate-pulse">
                  <div className="h-5 bg-muted rounded w-1/3 mb-3" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : !invoices?.length ? (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
              <h2 className="text-xl font-semibold mb-2">No invoices yet</h2>
              <p className="text-muted-foreground mb-6">Create your first invoice to get started</p>
              <Button onClick={() => navigate("/invoice")} className="rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice: Record<string, unknown>, index: number) => {
                const status = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.draft;
                const StatusIcon = status.icon;
                const isLoading = loadingId === invoice.id;

                return (
                  <div
                    key={invoice.id}
                    className="bg-card rounded-2xl p-5 card-shadow animate-fade-in cursor-pointer hover:shadow-lg transition-shadow"
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => navigate(`/invoice/${invoice.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-lg">{invoice.invoice_number}</span>
                          <Badge className={`${status.color} border-0`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          {invoice.customer?.name || "Unknown Customer"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {invoice.invoice_date ? format(new Date(invoice.invoice_date), "d MMM yyyy") : "No date"}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <span className="text-xl font-bold">€{Number(invoice.total || 0).toFixed(2)}</span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            disabled={isLoading}
                            onClick={(e) => handleDownloadPdf(e, invoice)}
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            PDF
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </AppLayout>
  );
};

export default Invoices;
