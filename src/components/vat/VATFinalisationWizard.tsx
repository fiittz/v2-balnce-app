import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Loader2, X, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  VATWizardData,
  initialWizardData,
  useVATWizardData,
  useSaveVATWizard,
  useFinaliseVATReturn,
  useExpensesForPeriod,
} from "@/hooks/useVATWizard";
import { SalesSection } from "./wizard/SalesSection";
import { PurchasesSection } from "./wizard/PurchasesSection";
import { HighRiskVATSection } from "./wizard/HighRiskVATSection";
import { EUPurchasesSection } from "./wizard/EUPurchasesSection";
import { NonEUPurchasesSection } from "./wizard/NonEUPurchasesSection";
import { AdjustmentsSection } from "./wizard/AdjustmentsSection";
import { ComplianceSection } from "./wizard/ComplianceSection";

interface VATFinalisationWizardProps {
  open: boolean;
  onClose: () => void;
  onReportGenerated?: () => void;
  vatReturnId: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
}

const STEPS = [
  { id: 1, title: "Sales (Output VAT)", description: "Confirm all sales are entered" },
  { id: 2, title: "Purchases (Input VAT)", description: "Verify expense completeness" },
  { id: 3, title: "High-Risk VAT", description: "Food & motor expenses" },
  { id: 4, title: "EU Purchases", description: "Reverse charge review" },
  { id: 5, title: "Non-EU Purchases", description: "Import VAT details" },
  { id: 6, title: "Adjustments", description: "Credit notes & corrections" },
  { id: 7, title: "Compliance", description: "Final declarations" },
];

export function VATFinalisationWizard({
  open,
  onClose,
  onReportGenerated,
  vatReturnId,
  periodStart,
  periodEnd,
  periodLabel,
}: VATFinalisationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<VATWizardData>({
    ...initialWizardData,
    vat_return_id: vatReturnId,
  });
  const [blockingError, setBlockingError] = useState<string | null>(null);

  const { data: existingData, isLoading: loadingExisting } = useVATWizardData(vatReturnId);
  const { data: expenses, isLoading: loadingExpenses } = useExpensesForPeriod(periodStart, periodEnd);
  const saveWizard = useSaveVATWizard();
  const finaliseReturn = useFinaliseVATReturn();

  // Load existing data
  useEffect(() => {
    if (existingData) {
      setWizardData({
        ...initialWizardData,
        vat_return_id: vatReturnId,
        all_sales_added: existingData.all_sales_added as VATWizardData["all_sales_added"],
        unpaid_invoices: existingData.unpaid_invoices || false,
        unpaid_invoices_list: (existingData.unpaid_invoices_list as VATWizardData["unpaid_invoices_list"]) || [],
        special_sales: existingData.special_sales || [],
        special_sales_notes: existingData.special_sales_notes || "",
        all_expenses_added: existingData.all_expenses_added as VATWizardData["all_expenses_added"],
        missing_receipts: existingData.missing_receipts || false,
        missing_receipts_list: (existingData.missing_receipts_list as VATWizardData["missing_receipts_list"]) || [],
        food_vat_claim: existingData.food_vat_claim as VATWizardData["food_vat_claim"],
        motor_vat_claim: existingData.motor_vat_claim as VATWizardData["motor_vat_claim"],
        remove_non_allowed_vat: existingData.remove_non_allowed_vat,
        remove_non_allowed_reason: existingData.remove_non_allowed_reason || "",
        eu_purchases: existingData.eu_purchases || false,
        eu_purchase_ids: existingData.eu_purchase_ids || [],
        eu_reverse_charge_flags:
          (existingData.eu_reverse_charge_flags as VATWizardData["eu_reverse_charge_flags"]) || {},
        non_eu_purchases: existingData.non_eu_purchases || false,
        non_eu_purchase_details:
          (existingData.non_eu_purchase_details as VATWizardData["non_eu_purchase_details"]) || [],
        credit_notes: existingData.credit_notes || false,
        credit_notes_details: (existingData.credit_notes_details as VATWizardData["credit_notes_details"]) || [],
        manual_adjustments: existingData.manual_adjustments || false,
        manual_adjustment_amount: existingData.manual_adjustment_amount || 0,
        manual_adjustment_reason: existingData.manual_adjustment_reason || "",
        manual_adjustment_attachment: existingData.manual_adjustment_attachment || "",
        late_transactions: existingData.late_transactions || false,
        late_transactions_list: (existingData.late_transactions_list as VATWizardData["late_transactions_list"]) || [],
        reviewed_flagged_transactions: existingData.reviewed_flagged_transactions || false,
        confirm_accuracy: existingData.confirm_accuracy || false,
        lock_period: existingData.lock_period || false,
        vat_notes: existingData.vat_notes || "",
        declaration_true_and_complete: existingData.declaration_true_and_complete || false,
        declaration_penalties_understood: existingData.declaration_penalties_understood || false,
        declaration_period_lock_understood: existingData.declaration_period_lock_understood || false,
      });
    }
  }, [existingData, vatReturnId]);

  const updateData = (updates: Partial<VATWizardData>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
    setBlockingError(null);
  };

  // Check if can proceed without side effects (for disabled state)
  const isStepValid = (): boolean => {
    switch (currentStep) {
      case 1:
        return wizardData.all_sales_added === "yes";
      case 2:
        return wizardData.all_expenses_added === "yes";
      case 3:
        return wizardData.food_vat_claim !== null && wizardData.motor_vat_claim !== null;
      case 4:
      case 5:
      case 6:
        return true;
      case 7:
        return (
          wizardData.reviewed_flagged_transactions &&
          wizardData.confirm_accuracy &&
          wizardData.declaration_true_and_complete &&
          wizardData.declaration_penalties_understood &&
          wizardData.declaration_period_lock_understood
        );
      default:
        return true;
    }
  };

  // Validate and set error messages (only call on user action)
  const validateAndProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        if (wizardData.all_sales_added === "no" || wizardData.all_sales_added === "not_sure") {
          setBlockingError("VAT cannot be finalised until all sales for this period are entered.");
          return false;
        }
        return wizardData.all_sales_added === "yes";
      case 2:
        if (wizardData.all_expenses_added === "no" || wizardData.all_expenses_added === "not_sure") {
          setBlockingError("VAT cannot be finalised until all expenses for this period are entered.");
          return false;
        }
        return wizardData.all_expenses_added === "yes";
      case 3:
        return wizardData.food_vat_claim !== null && wizardData.motor_vat_claim !== null;
      case 4:
      case 5:
      case 6:
        return true;
      case 7:
        if (!wizardData.reviewed_flagged_transactions) {
          setBlockingError("You must review flagged transactions before finalising.");
          return false;
        }
        return (
          wizardData.confirm_accuracy &&
          wizardData.declaration_true_and_complete &&
          wizardData.declaration_penalties_understood &&
          wizardData.declaration_period_lock_understood
        );
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!validateAndProceed()) return;

    // Save progress
    await saveWizard.mutateAsync(wizardData);

    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
      setBlockingError(null);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      setBlockingError(null);
    }
  };

  const handleFinalise = async () => {
    if (!validateAndProceed()) return;

    await saveWizard.mutateAsync(wizardData);
    await finaliseReturn.mutateAsync({
      vatReturnId,
      lockPeriod: wizardData.lock_period,
    });

    onClose();
    onReportGenerated?.();
  };

  const progress = (currentStep / STEPS.length) * 100;

  if (loadingExisting) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              VAT Finalisation — {periodLabel}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Progress */}
          <div className="space-y-2 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Step {currentStep} of {STEPS.length}
              </span>
              <span className="text-muted-foreground">{STEPS[currentStep - 1].title}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </DialogHeader>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {blockingError && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{blockingError}</p>
            </div>
          )}

          {currentStep === 1 && <SalesSection data={wizardData} onUpdate={updateData} />}
          {currentStep === 2 && <PurchasesSection data={wizardData} onUpdate={updateData} />}
          {currentStep === 3 && <HighRiskVATSection data={wizardData} onUpdate={updateData} />}
          {currentStep === 4 && (
            <EUPurchasesSection
              data={wizardData}
              onUpdate={updateData}
              expenses={expenses || []}
              isLoading={loadingExpenses}
            />
          )}
          {currentStep === 5 && (
            <NonEUPurchasesSection
              data={wizardData}
              onUpdate={updateData}
              expenses={expenses || []}
              isLoading={loadingExpenses}
            />
          )}
          {currentStep === 6 && <AdjustmentsSection data={wizardData} onUpdate={updateData} />}
          {currentStep === 7 && <ComplianceSection data={wizardData} onUpdate={updateData} />}
        </div>

        {/* Footer Navigation */}
        <div className="flex-shrink-0 flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep < STEPS.length ? (
            <Button onClick={handleNext} disabled={saveWizard.isPending}>
              {saveWizard.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleFinalise}
              disabled={finaliseReturn.isPending || !isStepValid()}
              className="bg-green-600 hover:bg-green-700"
            >
              {finaliseReturn.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-2" />
              )}
              Finalise VAT Return
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
