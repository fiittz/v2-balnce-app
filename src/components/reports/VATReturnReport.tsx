import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  Globe,
  Truck,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useVATReturns, useVATSummary } from "@/hooks/useVATData";
import { useVATWizardData } from "@/hooks/useVATWizard";

export function VATReturnReport() {
  const [searchParams] = useSearchParams();
  const periodStart = searchParams.get("period");

  const { data: vatReturns, isLoading: returnsLoading } = useVATReturns();

  // Find the return for this period
  const vatReturn = vatReturns?.find((r) => r.period_start === periodStart);

  const { data: finalisationData, isLoading: finalisationLoading } = useVATWizardData(vatReturn?.id);
  const { data: vatSummary, isLoading: summaryLoading } = useVATSummary(
    vatReturn?.period_start || "",
    vatReturn?.period_end || "",
  );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    sales: true,
    purchases: true,
    highRisk: false,
    euPurchases: false,
    nonEuPurchases: false,
    adjustments: false,
    compliance: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isLoading = returnsLoading || finalisationLoading || summaryLoading;

  if (!periodStart) {
    return (
      <div className="bg-card rounded-2xl p-6 card-shadow">
        <p className="text-muted-foreground">Select a VAT period to view the report.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl p-6 card-shadow flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vatReturn) {
    return (
      <div className="bg-card rounded-2xl p-6 card-shadow">
        <p className="text-muted-foreground">No VAT return found for this period.</p>
      </div>
    );
  }

  const BooleanIndicator = ({
    value,
    trueLabel = "Yes",
    falseLabel = "No",
  }: {
    value: boolean | null | undefined;
    trueLabel?: string;
    falseLabel?: string;
  }) => (
    <span className={`inline-flex items-center gap-1 ${value ? "text-green-600" : "text-muted-foreground"}`}>
      {value ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {value ? trueLabel : falseLabel}
    </span>
  );

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "N/A";
    try {
      return format(parseISO(date), "d MMM yyyy");
    } catch {
      return date;
    }
  };

  const specialSalesLabels: Record<string, string> = {
    zero_rated: "Zero-Rated Sales",
    exempt: "Exempt Sales",
    eu_b2b: "EU B2B Sales",
    eu_b2c: "EU B2C Sales",
    exports: "Exports",
    reverse_charge_supplies: "Reverse Charge Supplies",
  };

  const foodVatLabels: Record<string, string> = {
    no: "No food VAT claimed",
    allowed_staff_canteen: "Staff canteen (allowed)",
    not_allowed_exclude: "Not allowed - excluded",
  };

  const motorVatLabels: Record<string, string> = {
    fuel_only: "Fuel only",
    fuel_and_other: "Fuel and other motor costs",
    none: "No motor VAT claimed",
  };

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="bg-card rounded-2xl p-6 card-shadow">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6" />
              VAT Return Report
            </h2>
            <p className="text-muted-foreground mt-1">
              Period: {formatDate(vatReturn.period_start)} - {formatDate(vatReturn.period_end)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={vatReturn.status === "ready" || vatReturn.status === "submitted" ? "default" : "secondary"}>
              {(vatReturn.status || "draft").charAt(0).toUpperCase() + (vatReturn.status || "draft").slice(1)}
            </Badge>
          </div>
        </div>

        {/* VAT Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">VAT on Sales</span>
            </div>
            <p className="text-2xl font-bold">€{(vatReturn.vat_on_sales || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{vatSummary?.salesCount || 0} invoices</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-sm">VAT on Purchases</span>
            </div>
            <p className="text-2xl font-bold text-green-600">€{(vatReturn.vat_on_purchases || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{vatSummary?.purchasesCount || 0} expenses</p>
          </div>
          <div className="bg-foreground text-background rounded-xl p-4">
            <span className="text-sm opacity-70">Net VAT</span>
            {(() => {
              const netVat = (vatReturn.vat_on_sales || 0) - (vatReturn.vat_on_purchases || 0);
              return (
                <>
                  <p className={`text-2xl font-bold ${netVat < 0 ? "text-green-400" : "text-primary"}`}>
                    {netVat < 0 ? "-" : ""}€{Math.abs(netVat).toFixed(2)}
                  </p>
                  <p className="text-xs opacity-60">{netVat < 0 ? "Refund due" : "Amount owed"}</p>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Finalisation Questionnaire Data */}
      {finalisationData ? (
        <div className="bg-card rounded-2xl p-6 card-shadow space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileCheck className="w-5 h-5" />
            Finalisation Questionnaire
          </h3>
          <p className="text-sm text-muted-foreground">
            Completed: {finalisationData.completed_at ? formatDate(finalisationData.completed_at) : "In progress"}
          </p>

          {/* Section 1: Sales */}
          <Collapsible open={openSections.sales} onOpenChange={() => toggleSection("sales")}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors">
              <span className="font-medium">Section 1: Sales (Output VAT)</span>
              {openSections.sales ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-3 px-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">All sales added?</span>
                <Badge variant={finalisationData.all_sales_added === "yes" ? "default" : "destructive"}>
                  {finalisationData.all_sales_added || "Not answered"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unpaid invoices?</span>
                <BooleanIndicator value={finalisationData.unpaid_invoices} />
              </div>
              {finalisationData.unpaid_invoices &&
                (finalisationData.unpaid_invoices_list as { description: string; amount: number }[])?.length > 0 && (
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-800 mb-2">Unpaid Invoices:</p>
                    <ul className="text-sm text-amber-700 space-y-1">
                      {(finalisationData.unpaid_invoices_list as { description: string; amount: number }[]).map(
                        (item, i) => (
                          <li key={i}>
                            • {item.description}: €{item.amount}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              {finalisationData.special_sales && finalisationData.special_sales.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-sm">Special Sales Types:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {finalisationData.special_sales.map((s) => (
                      <Badge key={s} variant="outline">
                        {specialSalesLabels[s] || s}
                      </Badge>
                    ))}
                  </div>
                  {finalisationData.special_sales_notes && (
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      Notes: {finalisationData.special_sales_notes}
                    </p>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Section 2: Purchases */}
          <Collapsible open={openSections.purchases} onOpenChange={() => toggleSection("purchases")}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors">
              <span className="font-medium">Section 2: Purchases (Input VAT)</span>
              {openSections.purchases ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-3 px-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">All expenses added?</span>
                <Badge variant={finalisationData.all_expenses_added === "yes" ? "default" : "destructive"}>
                  {finalisationData.all_expenses_added || "Not answered"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Missing receipts?</span>
                <BooleanIndicator value={finalisationData.missing_receipts} />
              </div>
              {finalisationData.missing_receipts &&
                (finalisationData.missing_receipts_list as { description: string; amount: number }[])?.length > 0 && (
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-800 mb-2">Missing Receipts:</p>
                    <ul className="text-sm text-amber-700 space-y-1">
                      {(finalisationData.missing_receipts_list as { description: string; amount: number }[]).map(
                        (item, i) => (
                          <li key={i}>
                            • {item.description}: €{item.amount}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
            </CollapsibleContent>
          </Collapsible>

          {/* Section 3: High-Risk VAT */}
          <Collapsible open={openSections.highRisk} onOpenChange={() => toggleSection("highRisk")}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors">
              <span className="font-medium">Section 3: High-Risk VAT Categories</span>
              {openSections.highRisk ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-3 px-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Food VAT claim</span>
                <span className="font-medium">
                  {foodVatLabels[finalisationData.food_vat_claim || ""] || "Not specified"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Motor VAT claim</span>
                <span className="font-medium">
                  {motorVatLabels[finalisationData.motor_vat_claim || ""] || "Not specified"}
                </span>
              </div>
              {finalisationData.remove_non_allowed_vat !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Non-allowed VAT removed?</span>
                  <BooleanIndicator value={finalisationData.remove_non_allowed_vat} />
                </div>
              )}
              {finalisationData.remove_non_allowed_reason && (
                <p className="text-sm text-muted-foreground italic">
                  Reason: {finalisationData.remove_non_allowed_reason}
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Section 4: EU Purchases */}
          <Collapsible open={openSections.euPurchases} onOpenChange={() => toggleSection("euPurchases")}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span className="font-medium">Section 4: EU Purchases (Reverse Charge)</span>
              </div>
              {openSections.euPurchases ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-3 px-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Has EU purchases?</span>
                <BooleanIndicator value={finalisationData.eu_purchases} />
              </div>
              {finalisationData.eu_purchases &&
                finalisationData.eu_purchase_ids &&
                finalisationData.eu_purchase_ids.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-800">
                      {finalisationData.eu_purchase_ids.length} EU purchase(s) flagged for reverse charge
                    </p>
                  </div>
                )}
            </CollapsibleContent>
          </Collapsible>

          {/* Section 5: Non-EU Purchases */}
          <Collapsible open={openSections.nonEuPurchases} onOpenChange={() => toggleSection("nonEuPurchases")}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                <span className="font-medium">Section 5: Non-EU Purchases</span>
              </div>
              {openSections.nonEuPurchases ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-3 px-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Has non-EU purchases?</span>
                <BooleanIndicator value={finalisationData.non_eu_purchases} />
              </div>
              {finalisationData.non_eu_purchases &&
                finalisationData.non_eu_purchase_details?.length > 0 &&
                (() => {
                  const goodsCount = finalisationData.non_eu_purchase_details.filter(
                    (d) => d.import_type === "goods",
                  ).length;
                  const servicesCount = finalisationData.non_eu_purchase_details.filter(
                    (d) => d.import_type === "services",
                  ).length;
                  return (
                    <div className="bg-purple-50 rounded-lg p-3 space-y-1">
                      {goodsCount > 0 && (
                        <p className="text-sm font-medium text-purple-800">
                          {goodsCount} goods import(s) — postponed accounting (PA1)
                        </p>
                      )}
                      {servicesCount > 0 && (
                        <p className="text-sm font-medium text-purple-800">
                          {servicesCount} service reverse charge(s) — self-account VAT (T1/T2)
                        </p>
                      )}
                    </div>
                  );
                })()}
            </CollapsibleContent>
          </Collapsible>

          {/* Section 6: Adjustments */}
          <Collapsible open={openSections.adjustments} onOpenChange={() => toggleSection("adjustments")}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors">
              <span className="font-medium">Section 6: Adjustments & Corrections</span>
              {openSections.adjustments ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-3 px-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit notes?</span>
                <BooleanIndicator value={finalisationData.credit_notes} />
              </div>
              {finalisationData.credit_notes &&
                (finalisationData.credit_notes_details as { description: string; amount: number }[])?.length > 0 && (
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm font-medium mb-2">Credit Notes:</p>
                    <ul className="text-sm space-y-1">
                      {(finalisationData.credit_notes_details as { description: string; amount: number }[]).map(
                        (item, i) => (
                          <li key={i}>
                            • {item.description}: €{item.amount}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Manual adjustments?</span>
                <BooleanIndicator value={finalisationData.manual_adjustments} />
              </div>
              {finalisationData.manual_adjustments && finalisationData.manual_adjustment_amount !== 0 && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm">
                    <span className="font-medium">Amount:</span> €{finalisationData.manual_adjustment_amount}
                  </p>
                  {finalisationData.manual_adjustment_reason && (
                    <p className="text-sm mt-1">
                      <span className="font-medium">Reason:</span> {finalisationData.manual_adjustment_reason}
                    </p>
                  )}
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Late transactions?</span>
                <BooleanIndicator value={finalisationData.late_transactions} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 7: Compliance */}
          <Collapsible open={openSections.compliance} onOpenChange={() => toggleSection("compliance")}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors">
              <span className="font-medium">Section 7: Compliance & Declarations</span>
              {openSections.compliance ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-3 px-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Flagged transactions reviewed?</span>
                <BooleanIndicator value={finalisationData.reviewed_flagged_transactions} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Accuracy confirmed?</span>
                <BooleanIndicator value={finalisationData.confirm_accuracy} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period locked?</span>
                <BooleanIndicator value={finalisationData.lock_period} />
              </div>
              {finalisationData.vat_notes && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm font-medium mb-1">Notes:</p>
                  <p className="text-sm text-muted-foreground">{finalisationData.vat_notes}</p>
                </div>
              )}
              <div className="border-t pt-3 mt-3 space-y-2">
                <p className="text-sm font-medium">Declarations:</p>
                <div className="flex items-center gap-2">
                  {finalisationData.declaration_true_and_complete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="text-sm">Information is true and complete</span>
                </div>
                <div className="flex items-center gap-2">
                  {finalisationData.declaration_penalties_understood ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="text-sm">Penalties understood</span>
                </div>
                <div className="flex items-center gap-2">
                  {finalisationData.declaration_period_lock_understood ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="text-sm">Period lock understood</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : (
        <div className="bg-card rounded-2xl p-6 card-shadow">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            <p>Finalisation questionnaire not completed for this period.</p>
          </div>
        </div>
      )}

      {/* Export Button */}
      <div className="flex justify-end">
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export PDF
        </Button>
      </div>
    </div>
  );
}
