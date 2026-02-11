import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";

export interface VATQuestionnaireData {
  // Section 1: VAT Registration
  vatNumber: string;
  vatBasis: "cash_basis" | "invoice_basis";
  vatFrequency: "bi_monthly" | "quarterly" | "annual";
  // Section 2: Sales Review
  salesComplete: boolean;
  salesNotes: string;
  hasExemptSales: boolean;
  exemptSalesAmount: number;
  hasZeroRatedSales: boolean;
  zeroRatedSalesAmount: number;
  // Section 3: Purchases Review
  purchasesComplete: boolean;
  purchasesNotes: string;
  hasDisallowedVAT: boolean;
  disallowedVATNotes: string;
  // Section 4: Adjustments
  hasAdjustments: boolean;
  adjustmentAmount: number;
  adjustmentNotes: string;
  // Section 5: Intrastat / EU
  hasEUSales: boolean;
  euSalesAmount: number;
  hasEUPurchases: boolean;
  euPurchasesAmount: number;
  // Section 6: Declaration
  finalDeclaration: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (data: VATQuestionnaireData) => void;
  // Auto-populated data
  vatNumber?: string;
  vatBasis?: string;
  outputVat?: number;
  inputVat?: number;
  netVat?: number;
  periodStart?: string;
  periodEnd?: string;
}

const initialData: VATQuestionnaireData = {
  vatNumber: "",
  vatBasis: "cash_basis",
  vatFrequency: "bi_monthly",
  salesComplete: false,
  salesNotes: "",
  hasExemptSales: false,
  exemptSalesAmount: 0,
  hasZeroRatedSales: false,
  zeroRatedSalesAmount: 0,
  purchasesComplete: false,
  purchasesNotes: "",
  hasDisallowedVAT: false,
  disallowedVATNotes: "",
  hasAdjustments: false,
  adjustmentAmount: 0,
  adjustmentNotes: "",
  hasEUSales: false,
  euSalesAmount: 0,
  hasEUPurchases: false,
  euPurchasesAmount: 0,
  finalDeclaration: false,
};

const SECTIONS = [
  "VAT Registration",
  "Sales Review",
  "Purchases Review",
  "Adjustments",
  "EU / Intrastat",
  "Declaration",
];

const fmtEur = (v: number) =>
  `€${v.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function VATExportQuestionnaire({
  open, onOpenChange, onComplete,
  vatNumber, vatBasis, outputVat = 0, inputVat = 0, netVat = 0,
  periodStart, periodEnd,
}: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<VATQuestionnaireData>({
    ...initialData,
    vatNumber: vatNumber || "",
    vatBasis: (vatBasis as "cash_basis" | "invoice_basis") || "cash_basis",
  });

  const update = <K extends keyof VATQuestionnaireData>(key: K, val: VATQuestionnaireData[K]) =>
    setData(prev => ({ ...prev, [key]: val }));

  const canProceed = () => {
    if (step === 0) return data.vatNumber.length > 0;
    if (step === 1) return data.salesComplete;
    if (step === 2) return data.purchasesComplete;
    if (step === 5) return data.finalDeclaration;
    return true;
  };

  const handleComplete = () => {
    onComplete(data);
    setStep(0);
    setData({ ...initialData, vatNumber: vatNumber || "", vatBasis: (vatBasis as any) || "cash_basis" });
  };

  const progress = ((step + 1) / SECTIONS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            VAT Return Export — {SECTIONS[step]}
          </DialogTitle>
          <Progress value={progress} className="h-1.5 mt-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Step {step + 1} of {SECTIONS.length}
            {periodStart && periodEnd && ` • ${periodStart} to ${periodEnd}`}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-2">
            {/* Section 1: VAT Registration */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label>VAT Registration Number</Label>
                  <Input
                    value={data.vatNumber}
                    onChange={e => update("vatNumber", e.target.value)}
                    placeholder="IE1234567T"
                  />
                </div>
                <div className="space-y-2">
                  <Label>VAT Accounting Basis</Label>
                  <Select value={data.vatBasis} onValueChange={v => update("vatBasis", v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash_basis">Cash Basis</SelectItem>
                      <SelectItem value="invoice_basis">Invoice Basis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Return Frequency</Label>
                  <Select value={data.vatFrequency} onValueChange={v => update("vatFrequency", v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bi_monthly">Bi-monthly (VAT3)</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Section 2: Sales Review */}
            {step === 1 && (
              <>
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span>Output VAT (on Sales)</span><span className="font-medium">{fmtEur(outputVat)}</span></div>
                  <div className="flex justify-between"><span>Input VAT (on Purchases)</span><span className="font-medium">{fmtEur(inputVat)}</span></div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>{netVat >= 0 ? "VAT Payable" : "VAT Refundable"}</span>
                    <span>{fmtEur(Math.abs(netVat))}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.salesComplete} onCheckedChange={v => update("salesComplete", !!v)} id="sc" />
                  <Label htmlFor="sc">I confirm all sales income for this period is captured</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.hasExemptSales} onCheckedChange={v => update("hasExemptSales", !!v)} id="es" />
                  <Label htmlFor="es">I have VAT-exempt sales this period</Label>
                </div>
                {data.hasExemptSales && (
                  <div className="space-y-2 ml-6">
                    <Label>Exempt Sales Amount</Label>
                    <Input type="number" value={data.exemptSalesAmount || ""} onChange={e => update("exemptSalesAmount", Number(e.target.value))} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.hasZeroRatedSales} onCheckedChange={v => update("hasZeroRatedSales", !!v)} id="zr" />
                  <Label htmlFor="zr">I have zero-rated sales (exports, RCT reverse charge)</Label>
                </div>
                {data.hasZeroRatedSales && (
                  <div className="space-y-2 ml-6">
                    <Label>Zero-Rated Sales Amount</Label>
                    <Input type="number" value={data.zeroRatedSalesAmount || ""} onChange={e => update("zeroRatedSalesAmount", Number(e.target.value))} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input value={data.salesNotes} onChange={e => update("salesNotes", e.target.value)} placeholder="Any notes about sales..." />
                </div>
              </>
            )}

            {/* Section 3: Purchases Review */}
            {step === 2 && (
              <>
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between"><span>Input VAT Claimed</span><span className="font-medium">{fmtEur(inputVat)}</span></div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Section 59/60 rules applied — meals, entertainment, petrol, passenger vehicles excluded.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.purchasesComplete} onCheckedChange={v => update("purchasesComplete", !!v)} id="pc" />
                  <Label htmlFor="pc">I confirm all purchase invoices/receipts are captured</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.hasDisallowedVAT} onCheckedChange={v => update("hasDisallowedVAT", !!v)} id="dv" />
                  <Label htmlFor="dv">I have additional non-deductible VAT to exclude</Label>
                </div>
                {data.hasDisallowedVAT && (
                  <div className="space-y-2 ml-6">
                    <Label>Details</Label>
                    <Input value={data.disallowedVATNotes} onChange={e => update("disallowedVATNotes", e.target.value)} placeholder="e.g. Staff party, client gifts..." />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input value={data.purchasesNotes} onChange={e => update("purchasesNotes", e.target.value)} placeholder="Any notes about purchases..." />
                </div>
              </>
            )}

            {/* Section 4: Adjustments */}
            {step === 3 && (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.hasAdjustments} onCheckedChange={v => update("hasAdjustments", !!v)} id="adj" />
                  <Label htmlFor="adj">I have VAT adjustments for this period</Label>
                </div>
                {data.hasAdjustments && (
                  <>
                    <div className="space-y-2 ml-6">
                      <Label>Adjustment Amount (positive = owe more, negative = owe less)</Label>
                      <Input type="number" value={data.adjustmentAmount || ""} onChange={e => update("adjustmentAmount", Number(e.target.value))} />
                    </div>
                    <div className="space-y-2 ml-6">
                      <Label>Reason</Label>
                      <Input value={data.adjustmentNotes} onChange={e => update("adjustmentNotes", e.target.value)} placeholder="e.g. Bad debt relief, capital goods adjustment..." />
                    </div>
                  </>
                )}
                {!data.hasAdjustments && (
                  <p className="text-sm text-muted-foreground">
                    Adjustments include bad debt relief (S.63), capital goods scheme (S.64), and self-supply corrections.
                  </p>
                )}
              </>
            )}

            {/* Section 5: EU / Intrastat */}
            {step === 4 && (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.hasEUSales} onCheckedChange={v => update("hasEUSales", !!v)} id="eus" />
                  <Label htmlFor="eus">I made sales to EU VAT-registered customers</Label>
                </div>
                {data.hasEUSales && (
                  <div className="space-y-2 ml-6">
                    <Label>EU Sales Amount</Label>
                    <Input type="number" value={data.euSalesAmount || ""} onChange={e => update("euSalesAmount", Number(e.target.value))} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox checked={data.hasEUPurchases} onCheckedChange={v => update("hasEUPurchases", !!v)} id="eup" />
                  <Label htmlFor="eup">I made purchases from EU suppliers</Label>
                </div>
                {data.hasEUPurchases && (
                  <div className="space-y-2 ml-6">
                    <Label>EU Purchases Amount</Label>
                    <Input type="number" value={data.euPurchasesAmount || ""} onChange={e => update("euPurchasesAmount", Number(e.target.value))} />
                  </div>
                )}
                {!data.hasEUSales && !data.hasEUPurchases && (
                  <p className="text-sm text-muted-foreground">
                    If no EU cross-border transactions, you can skip this section.
                  </p>
                )}
              </>
            )}

            {/* Section 6: Declaration */}
            {step === 5 && (
              <>
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <div className="font-semibold mb-2">VAT Return Summary</div>
                  <div className="flex justify-between"><span>Output VAT</span><span>{fmtEur(outputVat)}</span></div>
                  <div className="flex justify-between"><span>Input VAT</span><span>{fmtEur(inputVat)}</span></div>
                  {data.hasAdjustments && (
                    <div className="flex justify-between"><span>Adjustments</span><span>{fmtEur(data.adjustmentAmount)}</span></div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>{(netVat + (data.hasAdjustments ? data.adjustmentAmount : 0)) >= 0 ? "VAT Payable" : "VAT Refundable"}</span>
                    <span>{fmtEur(Math.abs(netVat + (data.hasAdjustments ? data.adjustmentAmount : 0)))}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 mt-4">
                  <Checkbox checked={data.finalDeclaration} onCheckedChange={v => update("finalDeclaration", !!v)} id="fd" />
                  <Label htmlFor="fd" className="text-sm leading-relaxed">
                    I declare that the information in this VAT return is correct and complete to the best
                    of my knowledge. I understand this data will be used to prepare the VAT3 return
                    for filing with Revenue.
                  </Label>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : onOpenChange(false)}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < SECTIONS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={!canProceed()}>
              Export VAT Return
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
