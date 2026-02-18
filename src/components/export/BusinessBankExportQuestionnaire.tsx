import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, Building2, CheckCircle2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DisposalEntry {
  description: string;
  dateAcquired: string;
  dateSold: string;
  costPrice: number;
  salePrice: number;
}

export interface QuestionnaireData {
  // Section 1: Automation Assumption Check
  automationNoChanges: boolean;
  automationChanges: {
    vatRegistration: boolean;
    incomeType: boolean;
    paymentMethods: boolean;
    businessActivities: boolean;
    personalSpending: boolean;
  };
  automationChangeDate: Date | undefined;

  // Section 2: Income Capture Validation
  incomeComplete: boolean;
  incomeNotes: string;

  // Section 3: Expense Classification
  expensesCorrect: boolean;
  expenseNotes: string;

  // Section 4: VAT Treatment
  vatStatus: "not_registered" | "cash_basis" | "invoice_basis";
  vatStatusCorrect: boolean;
  vatStatusChangeDate: Date | undefined;

  // Section 5: RCT Reconciliation
  rctApplicable: boolean;
  rctDeductionsCorrect: boolean;
  rctTotalDeducted: number;
  rctNotes: string;

  // Section 6: Capital & One-Off Transactions
  capitalTransactionsCorrect: boolean;
  capitalNotes: string;

  // Section 7: Stock & Work in Progress
  hasClosingStock: boolean;
  closingStockValue: number;
  stockValuationMethod: "cost" | "net_realisable" | "";
  hasWip: boolean;
  wipValue: number;

  // Section 8: Debtors & Creditors
  hasTradeDebtors: boolean;
  tradeDebtorsTotal: number;
  hasBadDebts: boolean;
  badDebtsWrittenOff: number;
  hasTradeCreditorsOutstanding: boolean;
  tradeCreditorsTotal: number;

  // Section 9: Payments Validation
  paymentsCorrect: boolean;
  paymentNotes: string;

  // Section 10: Balance Sheet
  bankBalanceConfirmed: boolean;
  vatPositionConfirmed: boolean;
  fixedAssetsConfirmed: boolean;
  loansConfirmed: boolean;
  directorsLoanConfirmed: boolean;
  directorsLoanDirection: "owed_to" | "owed_by" | undefined;
  prepaymentsAmount: number;
  accrualsAmount: number;
  depreciationConfirmed: boolean;

  // Section 11: Close Company & Related Parties
  isCloseCompany: boolean;
  distributedProfitsSufficiently: boolean;
  hasRelatedPartyTransactions: boolean;
  relatedPartyNotes: string;
  hasLossesCarriedForward: boolean;
  lossesAmount: number;

  // Section 12: Final Declaration
  finalDeclaration: boolean;

  // Section 13: Preliminary Corporation Tax
  preliminaryCTPaid: boolean;
  preliminaryCTAmount: number;
  preliminaryCTDate: Date | undefined;

  // Section 14: Trading Profit Adjustment
  addBackDepreciation: number;
  addBackEntertainment: number;
  addBackOther: number;
  addBackNotes: string;
  lessCapitalAllowances: number;

  // Section 15: Losses Brought Forward
  hasLossesBroughtForward: boolean;
  lossesBroughtForwardAmount: number;
  lossesBroughtForwardYear: string;

  // Section 16: Start-up Exemption (Section 486C)
  claimStartupExemption: boolean;
  startupExemptionAmount: number;

  // Section 17: Dividend Withholding Tax
  hasDividendsPaid: boolean;
  dividendsPaidAmount: number;
  dwtDeducted: number;

  // Section 18: Capital Gains / Asset Disposals
  hasAssetDisposals: boolean;
  disposals: DisposalEntry[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (data: QuestionnaireData) => void;
  accountName?: string;
  periodStart?: Date;
  periodEnd?: Date;
  // Auto-generated data from platform
  detectedIncome?: { category: string; amount: number }[];
  expenseSummary?: { allowable: number; disallowed: number };
  detectedPayments?: { type: string; amount: number }[];
  closingBalance?: number;
  vatPosition?: { type: "payable" | "refundable"; amount: number };
  fixedAssets?: { name: string; cost: number; date: string }[];
  loans?: { name: string; amount: number }[];
  directorsLoanBalance?: number;
  flaggedCapitalItems?: { description: string; date: string; amount: number }[];
  // New props
  rctDeductions?: { contractor: string; amount: number; rate: string }[];
  isConstructionTrade?: boolean;
  isCloseCompany?: boolean;
  // Re-entry support
  initialValues?: Partial<QuestionnaireData>;
  // Re-evaluation data
  reEvaluationApplied?: boolean;
  reEvaluationWarnings?: string[];
  originalExpenseSummary?: { allowable: number; disallowed: number };
  // Company age for startup exemption check
  incorporationDate?: string;
  // Trip & subsistence summary
  tripSummary?: {
    totalTrips: number;
    totalSubsistence: number;
    totalMileage: number;
    trips: Array<{
      location: string;
      dates: string;
      invoiceRef?: string;
      subsistence: number;
      mileage: number;
    }>;
  };
}

const initialData: QuestionnaireData = {
  automationNoChanges: false,
  automationChanges: {
    vatRegistration: false,
    incomeType: false,
    paymentMethods: false,
    businessActivities: false,
    personalSpending: false,
  },
  automationChangeDate: undefined,
  incomeComplete: false,
  incomeNotes: "",
  expensesCorrect: false,
  expenseNotes: "",
  vatStatus: "not_registered",
  vatStatusCorrect: false,
  vatStatusChangeDate: undefined,
  rctApplicable: false,
  rctDeductionsCorrect: false,
  rctTotalDeducted: 0,
  rctNotes: "",
  capitalTransactionsCorrect: false,
  capitalNotes: "",
  hasClosingStock: false,
  closingStockValue: 0,
  stockValuationMethod: "",
  hasWip: false,
  wipValue: 0,
  hasTradeDebtors: false,
  tradeDebtorsTotal: 0,
  hasBadDebts: false,
  badDebtsWrittenOff: 0,
  hasTradeCreditorsOutstanding: false,
  tradeCreditorsTotal: 0,
  paymentsCorrect: false,
  paymentNotes: "",
  bankBalanceConfirmed: false,
  vatPositionConfirmed: false,
  fixedAssetsConfirmed: false,
  loansConfirmed: false,
  directorsLoanConfirmed: false,
  directorsLoanDirection: undefined,
  prepaymentsAmount: 0,
  accrualsAmount: 0,
  depreciationConfirmed: false,
  isCloseCompany: false,
  distributedProfitsSufficiently: false,
  hasRelatedPartyTransactions: false,
  relatedPartyNotes: "",
  hasLossesCarriedForward: false,
  lossesAmount: 0,
  finalDeclaration: false,
  // Section 13
  preliminaryCTPaid: false,
  preliminaryCTAmount: 0,
  preliminaryCTDate: undefined,
  // Section 14
  addBackDepreciation: 0,
  addBackEntertainment: 0,
  addBackOther: 0,
  addBackNotes: "",
  lessCapitalAllowances: 0,
  // Section 15
  hasLossesBroughtForward: false,
  lossesBroughtForwardAmount: 0,
  lossesBroughtForwardYear: "",
  // Section 16
  claimStartupExemption: false,
  startupExemptionAmount: 0,
  // Section 17
  hasDividendsPaid: false,
  dividendsPaidAmount: 0,
  dwtDeducted: 0,
  // Section 18
  hasAssetDisposals: false,
  disposals: [],
};

function deserializeDates(vals: Record<string, unknown>): Record<string, unknown> {
  const dateKeys = ["automationChangeDate", "vatStatusChangeDate", "preliminaryCTDate"];
  const out = { ...vals };
  for (const key of dateKeys) {
    if (typeof out[key] === "string") out[key] = new Date(out[key] as string);
  }
  return out;
}

export function BusinessBankExportQuestionnaire({
  open,
  onOpenChange,
  onComplete,
  accountName = "Business Account",
  periodStart,
  periodEnd,
  detectedIncome = [],
  expenseSummary = { allowable: 0, disallowed: 0 },
  detectedPayments = [],
  closingBalance = 0,
  vatPosition,
  fixedAssets = [],
  loans = [],
  directorsLoanBalance,
  flaggedCapitalItems = [],
  rctDeductions = [],
  isConstructionTrade = false,
  isCloseCompany: isCloseCompanyProp = false,
  initialValues,
  reEvaluationApplied = false,
  reEvaluationWarnings = [],
  originalExpenseSummary,
  incorporationDate,
  tripSummary,
}: Props) {
  const [data, setData] = useState<QuestionnaireData>(() => {
    if (initialValues) {
      const deserialized = deserializeDates(initialValues as Record<string, unknown>);
      return { ...initialData, ...deserialized } as QuestionnaireData;
    }
    return initialData;
  });
  const [currentSection, setCurrentSection] = useState(1);

  // Check if company qualifies for startup exemption (within first 3 years)
  const isWithinStartupPeriod = (() => {
    if (!incorporationDate) return false;
    const incDate = new Date(incorporationDate);
    const now = new Date();
    const yearsSinceIncorp = (now.getTime() - incDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return yearsSinceIncorp <= 3;
  })();

  const updateData = <K extends keyof QuestionnaireData>(key: K, value: QuestionnaireData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const updateAutomationChange = (key: keyof QuestionnaireData["automationChanges"], value: boolean) => {
    setData((prev) => ({
      ...prev,
      automationChanges: { ...prev.automationChanges, [key]: value },
    }));
  };

  // Build ordered list of section IDs; RCT is conditional on construction trade
  const sectionOrder: number[] = [1, 2, 3, 4];
  if (isConstructionTrade) sectionOrder.push(5); // RCT
  sectionOrder.push(6, 7, 8, 9);
  if (tripSummary && tripSummary.totalTrips > 0) sectionOrder.push(12); // Trip & Subsistence
  sectionOrder.push(10, 11, 13, 14, 15);
  if (isWithinStartupPeriod) sectionOrder.push(16); // Start-up exemption
  sectionOrder.push(17, 18, 19); // DWT, CGT, Final Declaration
  const totalSections = sectionOrder.length;
  const currentSectionId = sectionOrder[currentSection - 1] ?? 1;

  const canProceed = () => {
    switch (currentSectionId) {
      case 1:
        return data.automationNoChanges || Object.values(data.automationChanges).some(Boolean);
      case 2:
        return data.incomeComplete || data.incomeNotes.trim().length > 0;
      case 3:
        return data.expensesCorrect || data.expenseNotes.trim().length > 0;
      case 4:
        return data.vatStatusCorrect || data.vatStatusChangeDate !== undefined;
      case 5: // RCT
        return true; // optional section
      case 6:
        return data.capitalTransactionsCorrect || data.capitalNotes.trim().length > 0;
      case 7: // Stock & WIP
        return true; // optional section
      case 8: // Debtors & Creditors
        return true; // optional section
      case 9:
        return data.paymentsCorrect || data.paymentNotes.trim().length > 0;
      case 12: // Trip & Subsistence — read-only summary
        return true;
      case 10:
        return data.bankBalanceConfirmed;
      case 11: // Close Company
        return true; // optional section
      case 13: // Preliminary CT
        return true; // optional section
      case 14: // Trading Profit Adjustment
        return true; // optional section
      case 15: // Losses Brought Forward
        return true; // optional section
      case 16: // Start-up Exemption
        return true; // optional section
      case 17: // DWT
        return true; // optional section
      case 18: // Capital Gains
        return true; // optional section
      case 19: // Final Declaration (was 12)
        return data.finalDeclaration;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentSection < totalSections) {
      setCurrentSection((prev) => prev + 1);
    } else {
      onComplete(data);
    }
  };

  const handleBack = () => {
    if (currentSection > 1) {
      setCurrentSection((prev) => prev - 1);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
    }).format(amount);

  const renderSection = () => {
    switch (currentSectionId) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                1
              </span>
              Automation Assumption Check
            </h3>
            <p className="text-sm text-muted-foreground">
              Since onboarding, has anything changed in how this business operates?
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="noChanges"
                  checked={data.automationNoChanges}
                  onCheckedChange={(checked) => {
                    updateData("automationNoChanges", checked === true);
                    if (checked) {
                      setData((prev) => ({
                        ...prev,
                        automationChanges: {
                          vatRegistration: false,
                          incomeType: false,
                          paymentMethods: false,
                          businessActivities: false,
                          personalSpending: false,
                        },
                      }));
                    }
                  }}
                />
                <Label htmlFor="noChanges">No changes</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="yesChanges"
                  checked={Object.values(data.automationChanges).some(Boolean)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateData("automationNoChanges", false);
                    }
                  }}
                />
                <Label htmlFor="yesChanges">Yes — the following changed:</Label>
              </div>

              {!data.automationNoChanges && (
                <div className="ml-6 space-y-2">
                  {[
                    { key: "vatRegistration", label: "VAT registration status" },
                    { key: "incomeType", label: "Type of income received" },
                    {
                      key: "paymentMethods",
                      label: "How customers pay (cash / card / online / platforms)",
                    },
                    {
                      key: "businessActivities",
                      label: "Business activities (new services or products)",
                    },
                    {
                      key: "personalSpending",
                      label: "Use of personal spending from this account",
                    },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={data.automationChanges[key as keyof typeof data.automationChanges]}
                        onCheckedChange={(checked) =>
                          updateAutomationChange(key as keyof typeof data.automationChanges, checked === true)
                        }
                      />
                      <Label htmlFor={key} className="text-sm">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              )}

              {Object.values(data.automationChanges).some(Boolean) && (
                <div className="mt-4">
                  <Label className="text-sm">From what date did this change apply?</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-2",
                          !data.automationChangeDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {data.automationChangeDate ? format(data.automationChangeDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={data.automationChangeDate}
                        onSelect={(date) => updateData("automationChangeDate", date)}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                2
              </span>
              Income Capture Validation
            </h3>
            <p className="text-sm text-muted-foreground">
              Based on transaction data, the platform detected income from:
            </p>

            {detectedIncome.length > 0 ? (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                {detectedIncome.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.category}</span>
                    <span className="font-mono">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                No income detected for this period.
              </div>
            )}

            <p className="text-sm font-medium">Is this complete and accurate?</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="incomeYes"
                  checked={data.incomeComplete}
                  onCheckedChange={(checked) => updateData("incomeComplete", checked === true)}
                />
                <Label htmlFor="incomeYes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="incomeNo"
                  checked={!data.incomeComplete && data.incomeNotes.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) updateData("incomeComplete", false);
                  }}
                />
                <Label htmlFor="incomeNo">No — something is missing or incorrect</Label>
              </div>
              {!data.incomeComplete && (
                <Textarea
                  placeholder="Please describe what is missing or incorrect..."
                  value={data.incomeNotes}
                  onChange={(e) => updateData("incomeNotes", e.target.value)}
                  className="mt-2"
                />
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                3
              </span>
              Expense Classification Confirmation
            </h3>
            <p className="text-sm text-muted-foreground">
              The platform automatically classified expenses for this period.
            </p>

            {reEvaluationApplied && originalExpenseSummary && (
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Expenses re-evaluated based on VAT registration change
                </p>
                <div className="flex justify-between text-sm text-yellow-700 dark:text-yellow-300">
                  <span>Original allowable</span>
                  <span className="font-mono line-through">{formatCurrency(originalExpenseSummary.allowable)}</span>
                </div>
                <div className="flex justify-between text-sm text-yellow-700 dark:text-yellow-300">
                  <span>Original disallowed</span>
                  <span className="font-mono line-through">{formatCurrency(originalExpenseSummary.disallowed)}</span>
                </div>
                {reEvaluationWarnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-600 dark:text-yellow-400">
                    {w}
                  </p>
                ))}
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Allowable business expenses{reEvaluationApplied ? " (re-evaluated)" : ""}</span>
                <span className="font-mono text-green-600">{formatCurrency(expenseSummary.allowable)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Disallowed / personal items{reEvaluationApplied ? " (re-evaluated)" : ""}</span>
                <span className="font-mono text-red-600">{formatCurrency(expenseSummary.disallowed)}</span>
              </div>
            </div>

            <p className="text-sm font-medium">Does this reflect reality?</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="expenseYes"
                  checked={data.expensesCorrect}
                  onCheckedChange={(checked) => updateData("expensesCorrect", checked === true)}
                />
                <Label htmlFor="expenseYes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="expenseNo"
                  checked={!data.expensesCorrect && data.expenseNotes.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) updateData("expensesCorrect", false);
                  }}
                />
                <Label htmlFor="expenseNo">No — review required</Label>
              </div>
              {!data.expensesCorrect && (
                <Textarea
                  placeholder="Please describe what needs review..."
                  value={data.expenseNotes}
                  onChange={(e) => updateData("expenseNotes", e.target.value)}
                  className="mt-2"
                />
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                4
              </span>
              VAT Treatment Confirmation
            </h3>
            <p className="text-sm text-muted-foreground">For this period, the platform treated this business as:</p>

            {reEvaluationApplied && vatPosition && (
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  VAT position recalculated for the registered period only
                </p>
                <div className="flex justify-between text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  <span>VAT {vatPosition.type === "payable" ? "payable" : "refundable"} (post-registration)</span>
                  <span className="font-mono">{formatCurrency(vatPosition.amount)}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {[
                { value: "not_registered", label: "Not VAT registered" },
                { value: "cash_basis", label: "VAT registered — Cash basis" },
                {
                  value: "invoice_basis",
                  label: "VAT registered — Invoice basis",
                },
              ].map(({ value, label }) => (
                <div key={value} className="flex items-center space-x-2">
                  <Checkbox
                    id={value}
                    checked={data.vatStatus === value}
                    onCheckedChange={(checked) => {
                      if (checked) updateData("vatStatus", value as QuestionnaireData["vatStatus"]);
                    }}
                  />
                  <Label htmlFor={value}>{label}</Label>
                </div>
              ))}
            </div>

            <Separator />

            <p className="text-sm font-medium">Is this correct for the entire period?</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vatYes"
                  checked={data.vatStatusCorrect}
                  onCheckedChange={(checked) => updateData("vatStatusCorrect", checked === true)}
                />
                <Label htmlFor="vatYes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vatNo"
                  checked={!data.vatStatusCorrect && data.vatStatusChangeDate !== undefined}
                  onCheckedChange={(checked) => {
                    if (checked) updateData("vatStatusCorrect", false);
                  }}
                />
                <Label htmlFor="vatNo">No — VAT status changed</Label>
              </div>

              {!data.vatStatusCorrect && (
                <div className="mt-2">
                  <Label className="text-sm">Effective from:</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-2",
                          !data.vatStatusChangeDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {data.vatStatusChangeDate ? format(data.vatStatusChangeDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={data.vatStatusChangeDate}
                        onSelect={(date) => updateData("vatStatusChangeDate", date)}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              RCT Reconciliation
            </h3>
            <p className="text-sm text-muted-foreground">Confirm RCT deductions for this period.</p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rctApplicable"
                  checked={data.rctApplicable}
                  onCheckedChange={(checked) => updateData("rctApplicable", checked === true)}
                />
                <Label htmlFor="rctApplicable">RCT applied during this period</Label>
              </div>

              {data.rctApplicable && (
                <>
                  {rctDeductions.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      {rctDeductions.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>
                            {item.contractor} ({item.rate})
                          </span>
                          <span className="font-mono">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rctDeductionsCorrect"
                      checked={data.rctDeductionsCorrect}
                      onCheckedChange={(checked) => updateData("rctDeductionsCorrect", checked === true)}
                    />
                    <Label htmlFor="rctDeductionsCorrect">RCT deductions are correct</Label>
                  </div>

                  <div>
                    <Label className="text-sm">Total RCT deducted</Label>
                    <Input
                      type="number"
                      value={data.rctTotalDeducted || ""}
                      onChange={(e) => updateData("rctTotalDeducted", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>

                  <Textarea
                    placeholder="Notes on RCT (optional)..."
                    value={data.rctNotes}
                    onChange={(e) => updateData("rctNotes", e.target.value)}
                  />
                </>
              )}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Capital & One-Off Transactions
            </h3>
            <p className="text-sm text-muted-foreground">
              The platform reviewed this account for transactions that may require special treatment.
            </p>

            <div className="bg-muted/50 rounded-lg p-3">
              {flaggedCapitalItems.length === 0 ? (
                <p className="text-sm">✓ No transactions requiring special treatment</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Flagged items:</p>
                  {flaggedCapitalItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm border-b border-border/50 pb-1">
                      <span>{item.description}</span>
                      <span className="font-mono">
                        {item.date} • {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-sm font-medium">Are these findings correct?</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="capitalYes"
                  checked={data.capitalTransactionsCorrect}
                  onCheckedChange={(checked) => updateData("capitalTransactionsCorrect", checked === true)}
                />
                <Label htmlFor="capitalYes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="capitalNo"
                  checked={!data.capitalTransactionsCorrect && data.capitalNotes.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) updateData("capitalTransactionsCorrect", false);
                  }}
                />
                <Label htmlFor="capitalNo">No — something is missing or incorrectly flagged</Label>
              </div>
              {!data.capitalTransactionsCorrect && (
                <Textarea
                  placeholder="Please describe what is missing or incorrectly flagged..."
                  value={data.capitalNotes}
                  onChange={(e) => updateData("capitalNotes", e.target.value)}
                  className="mt-2"
                />
              )}
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Stock & Work in Progress
            </h3>
            <p className="text-sm text-muted-foreground">
              Confirm closing stock and work in progress values at period end.
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasClosingStock"
                  checked={data.hasClosingStock}
                  onCheckedChange={(checked) => updateData("hasClosingStock", checked === true)}
                />
                <Label htmlFor="hasClosingStock">Business holds closing stock</Label>
              </div>

              {data.hasClosingStock && (
                <div className="ml-6 space-y-3">
                  <div>
                    <Label className="text-sm">Closing stock value</Label>
                    <Input
                      type="number"
                      value={data.closingStockValue || ""}
                      onChange={(e) => updateData("closingStockValue", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Valuation method</Label>
                    <Select
                      value={data.stockValuationMethod}
                      onValueChange={(v) =>
                        updateData("stockValuationMethod", v as QuestionnaireData["stockValuationMethod"])
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cost">Cost</SelectItem>
                        <SelectItem value="net_realisable">Net realisable value</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasWip"
                  checked={data.hasWip}
                  onCheckedChange={(checked) => updateData("hasWip", checked === true)}
                />
                <Label htmlFor="hasWip">Work in progress at period end</Label>
              </div>

              {data.hasWip && (
                <div className="ml-6">
                  <Label className="text-sm">WIP value</Label>
                  <Input
                    type="number"
                    value={data.wipValue || ""}
                    onChange={(e) => updateData("wipValue", parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Debtors & Creditors
            </h3>
            <p className="text-sm text-muted-foreground">
              Outstanding amounts owed to or by the business at period end.
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasTradeDebtors"
                  checked={data.hasTradeDebtors}
                  onCheckedChange={(checked) => updateData("hasTradeDebtors", checked === true)}
                />
                <Label htmlFor="hasTradeDebtors">Outstanding trade debtors</Label>
              </div>

              {data.hasTradeDebtors && (
                <div className="ml-6 space-y-3">
                  <div>
                    <Label className="text-sm">Total trade debtors</Label>
                    <Input
                      type="number"
                      value={data.tradeDebtorsTotal || ""}
                      onChange={(e) => updateData("tradeDebtorsTotal", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasBadDebts"
                      checked={data.hasBadDebts}
                      onCheckedChange={(checked) => updateData("hasBadDebts", checked === true)}
                    />
                    <Label htmlFor="hasBadDebts">Bad debts written off</Label>
                  </div>

                  {data.hasBadDebts && (
                    <div>
                      <Label className="text-sm">Bad debts amount</Label>
                      <Input
                        type="number"
                        value={data.badDebtsWrittenOff || ""}
                        onChange={(e) => updateData("badDebtsWrittenOff", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasTradeCreditorsOutstanding"
                  checked={data.hasTradeCreditorsOutstanding}
                  onCheckedChange={(checked) => updateData("hasTradeCreditorsOutstanding", checked === true)}
                />
                <Label htmlFor="hasTradeCreditorsOutstanding">Outstanding trade creditors</Label>
              </div>

              {data.hasTradeCreditorsOutstanding && (
                <div className="ml-6">
                  <Label className="text-sm">Total trade creditors</Label>
                  <Input
                    type="number"
                    value={data.tradeCreditorsTotal || ""}
                    onChange={(e) => updateData("tradeCreditorsTotal", parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 9:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Payments Validation
            </h3>
            <p className="text-sm text-muted-foreground">
              The platform detected the following payments from this account:
            </p>

            <div className="bg-muted/50 rounded-lg p-3">
              {detectedPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments detected</p>
              ) : (
                <div className="space-y-1">
                  {detectedPayments.map((payment, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{payment.type}</span>
                      <span className="font-mono">{formatCurrency(payment.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-sm font-medium">Is this correct?</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="paymentsYes"
                  checked={data.paymentsCorrect}
                  onCheckedChange={(checked) => updateData("paymentsCorrect", checked === true)}
                />
                <Label htmlFor="paymentsYes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="paymentsNo"
                  checked={!data.paymentsCorrect && data.paymentNotes.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) updateData("paymentsCorrect", false);
                  }}
                />
                <Label htmlFor="paymentsNo">No — correction required</Label>
              </div>
              {!data.paymentsCorrect && (
                <Textarea
                  placeholder="Please describe what needs correction..."
                  value={data.paymentNotes}
                  onChange={(e) => updateData("paymentNotes", e.target.value)}
                  className="mt-2"
                />
              )}
            </div>
          </div>
        );

      case 10:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Balance Sheet Confirmation
            </h3>

            {/* Bank & Cash */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Bank & Cash</h4>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span>Closing bank balance at period end:</span>
                  <span className="font-mono font-medium">{formatCurrency(closingBalance)}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bankConfirmed"
                  checked={data.bankBalanceConfirmed}
                  onCheckedChange={(checked) => updateData("bankBalanceConfirmed", checked === true)}
                />
                <Label htmlFor="bankConfirmed">Confirmed</Label>
              </div>
            </div>

            <Separator />

            {/* VAT Position */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">VAT Position</h4>
              <div className="bg-muted/50 rounded-lg p-3">
                {vatPosition ? (
                  <div className="flex justify-between text-sm">
                    <span>VAT {vatPosition.type === "payable" ? "payable" : "refundable"}:</span>
                    <span
                      className={cn(
                        "font-mono font-medium",
                        vatPosition.type === "payable" ? "text-red-600" : "text-green-600",
                      )}
                    >
                      {formatCurrency(vatPosition.amount)}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No VAT position calculated</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vatConfirmed"
                  checked={data.vatPositionConfirmed}
                  onCheckedChange={(checked) => updateData("vatPositionConfirmed", checked === true)}
                />
                <Label htmlFor="vatConfirmed">Confirmed</Label>
              </div>
            </div>

            <Separator />

            {/* Fixed Assets */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Fixed Assets</h4>
              <div className="bg-muted/50 rounded-lg p-3">
                {fixedAssets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No fixed assets recorded</p>
                ) : (
                  <div className="space-y-1">
                    {fixedAssets.map((asset, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{asset.name}</span>
                        <span className="font-mono">
                          {formatCurrency(asset.cost)} • {asset.date}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="assetsConfirmed"
                  checked={data.fixedAssetsConfirmed}
                  onCheckedChange={(checked) => updateData("fixedAssetsConfirmed", checked === true)}
                />
                <Label htmlFor="assetsConfirmed">Complete and accurate</Label>
              </div>
            </div>

            <Separator />

            {/* Loans & Finance */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Loans & Finance</h4>
              <div className="bg-muted/50 rounded-lg p-3">
                {loans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No loans detected</p>
                ) : (
                  <div className="space-y-1">
                    {loans.map((loan, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{loan.name}</span>
                        <span className="font-mono">{formatCurrency(loan.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="loansConfirmed"
                  checked={data.loansConfirmed}
                  onCheckedChange={(checked) => updateData("loansConfirmed", checked === true)}
                />
                <Label htmlFor="loansConfirmed">Confirmed</Label>
              </div>
            </div>

            {/* Director's Loan Account */}
            {directorsLoanBalance !== undefined && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Director's Loan Account</h4>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex justify-between text-sm">
                      <span>Calculated balance at period end:</span>
                      <span className="font-mono font-medium">{formatCurrency(directorsLoanBalance)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="owedTo"
                        checked={data.directorsLoanDirection === "owed_to"}
                        onCheckedChange={(checked) => {
                          if (checked) updateData("directorsLoanDirection", "owed_to");
                        }}
                      />
                      <Label htmlFor="owedTo">Money owed to the director</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="owedBy"
                        checked={data.directorsLoanDirection === "owed_by"}
                        onCheckedChange={(checked) => {
                          if (checked) updateData("directorsLoanDirection", "owed_by");
                        }}
                      />
                      <Label htmlFor="owedBy">Money owed by the director</Label>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="directorsConfirmed"
                      checked={data.directorsLoanConfirmed}
                      onCheckedChange={(checked) => updateData("directorsLoanConfirmed", checked === true)}
                    />
                    <Label htmlFor="directorsConfirmed">Confirmed</Label>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Prepayments & Accruals */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Prepayments & Accruals</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Prepaid expenses at period end</Label>
                  <Input
                    type="number"
                    value={data.prepaymentsAmount || ""}
                    onChange={(e) => updateData("prepaymentsAmount", parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Accrued expenses at period end</Label>
                  <Input
                    type="number"
                    value={data.accrualsAmount || ""}
                    onChange={(e) => updateData("accrualsAmount", parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Depreciation */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="depreciationConfirmed"
                  checked={data.depreciationConfirmed}
                  onCheckedChange={(checked) => updateData("depreciationConfirmed", checked === true)}
                />
                <Label htmlFor="depreciationConfirmed">Capital allowances / depreciation is correct</Label>
              </div>
            </div>
          </div>
        );

      case 11:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Close Company & Related Parties
            </h3>
            <p className="text-sm text-muted-foreground">
              Close company surcharge and related party disclosures for CT1.
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isCloseCompany"
                  checked={data.isCloseCompany}
                  onCheckedChange={(checked) => updateData("isCloseCompany", checked === true)}
                />
                <Label htmlFor="isCloseCompany">This is a close company</Label>
              </div>

              {data.isCloseCompany && (
                <div className="ml-6 flex items-center space-x-2">
                  <Checkbox
                    id="distributedProfitsSufficiently"
                    checked={data.distributedProfitsSufficiently}
                    onCheckedChange={(checked) => updateData("distributedProfitsSufficiently", checked === true)}
                  />
                  <Label htmlFor="distributedProfitsSufficiently">
                    Sufficient profits distributed to avoid surcharge
                  </Label>
                </div>
              )}

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasRelatedPartyTransactions"
                  checked={data.hasRelatedPartyTransactions}
                  onCheckedChange={(checked) => updateData("hasRelatedPartyTransactions", checked === true)}
                />
                <Label htmlFor="hasRelatedPartyTransactions">Related party transactions occurred</Label>
              </div>

              {data.hasRelatedPartyTransactions && (
                <Textarea
                  placeholder="Describe related party transactions..."
                  value={data.relatedPartyNotes}
                  onChange={(e) => updateData("relatedPartyNotes", e.target.value)}
                  className="ml-6"
                />
              )}

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasLossesCarriedForward"
                  checked={data.hasLossesCarriedForward}
                  onCheckedChange={(checked) => updateData("hasLossesCarriedForward", checked === true)}
                />
                <Label htmlFor="hasLossesCarriedForward">Losses to carry forward</Label>
              </div>

              {data.hasLossesCarriedForward && (
                <div className="ml-6">
                  <Label className="text-sm">Losses amount</Label>
                  <Input
                    type="number"
                    value={data.lossesAmount || ""}
                    onChange={(e) => updateData("lossesAmount", parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 12:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Travel, Subsistence & Mileage
            </h3>
            <p className="text-sm text-muted-foreground">
              Summary of business trips detected from bank transactions and invoice matches. Rates applied are Revenue
              civil service rates (2024).
            </p>

            {tripSummary && (
              <>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total business trips</span>
                    <span className="font-mono font-medium">{tripSummary.totalTrips}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total subsistence claimed</span>
                    <span className="font-mono text-green-600">{formatCurrency(tripSummary.totalSubsistence)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total mileage claimed</span>
                    <span className="font-mono text-green-600">{formatCurrency(tripSummary.totalMileage)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total travel & subsistence</span>
                    <span className="font-mono">
                      {formatCurrency(tripSummary.totalSubsistence + tripSummary.totalMileage)}
                    </span>
                  </div>
                </div>

                {tripSummary.trips.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Trip breakdown</Label>
                    {tripSummary.trips.map((trip, idx) => (
                      <div key={idx} className="border rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            <MapPin className="w-3 h-3" />
                            {trip.location}
                          </span>
                          <span className="text-xs text-muted-foreground">{trip.dates}</span>
                          {trip.invoiceRef && (
                            <span className="text-xs text-green-700 font-medium">{trip.invoiceRef}</span>
                          )}
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {trip.subsistence > 0 && <span>Subsistence: {formatCurrency(trip.subsistence)}</span>}
                          {trip.mileage > 0 && <span>Mileage: {formatCurrency(trip.mileage)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 13:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Preliminary Corporation Tax
            </h3>
            <p className="text-sm text-muted-foreground">
              Was preliminary corporation tax paid for this accounting period?
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="preliminaryCTPaid"
                  checked={data.preliminaryCTPaid}
                  onCheckedChange={(checked) => updateData("preliminaryCTPaid", checked === true)}
                />
                <Label htmlFor="preliminaryCTPaid">Preliminary CT paid</Label>
              </div>

              {data.preliminaryCTPaid && (
                <div className="ml-6 space-y-3">
                  <div>
                    <Label className="text-sm">Amount paid</Label>
                    <Input
                      type="number"
                      value={data.preliminaryCTAmount || ""}
                      onChange={(e) => updateData("preliminaryCTAmount", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Date paid</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal mt-1",
                            !data.preliminaryCTDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {data.preliminaryCTDate ? format(data.preliminaryCTDate, "PPP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={data.preliminaryCTDate}
                          onSelect={(date) => updateData("preliminaryCTDate", date)}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 14: {
        const totalIncome = detectedIncome.reduce((s, i) => s + i.amount, 0);
        const addBacks = data.addBackDepreciation + data.addBackEntertainment + data.addBackOther;
        const adjustedProfit = totalIncome - expenseSummary.allowable + addBacks - data.lessCapitalAllowances;
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Trading Profit Adjustment
            </h3>
            <p className="text-sm text-muted-foreground">
              Adjust book profit to taxable profit by adding back non-deductible items and deducting capital allowances.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-sm">Add back: Book depreciation (non-deductible)</Label>
                <Input
                  type="number"
                  value={data.addBackDepreciation || ""}
                  onChange={(e) => updateData("addBackDepreciation", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Add back: Entertainment costs (non-deductible)</Label>
                <Input
                  type="number"
                  value={data.addBackEntertainment || ""}
                  onChange={(e) => updateData("addBackEntertainment", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Add back: Other non-deductible items</Label>
                <Input
                  type="number"
                  value={data.addBackOther || ""}
                  onChange={(e) => updateData("addBackOther", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <Textarea
                placeholder="Notes on add-backs (optional)..."
                value={data.addBackNotes}
                onChange={(e) => updateData("addBackNotes", e.target.value)}
              />

              <Separator />

              <div>
                <Label className="text-sm">Less: Capital allowances (wear & tear)</Label>
                <Input
                  type="number"
                  value={data.lessCapitalAllowances || ""}
                  onChange={(e) => updateData("lessCapitalAllowances", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>

              <Separator />

              <div className="bg-primary/5 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span>Gross income</span>
                  <span className="font-mono">{formatCurrency(totalIncome)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Less: Allowable expenses</span>
                  <span className="font-mono text-red-600">-{formatCurrency(expenseSummary.allowable)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Add: Non-deductible add-backs</span>
                  <span className="font-mono text-red-600">+{formatCurrency(addBacks)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Less: Capital allowances</span>
                  <span className="font-mono text-green-600">-{formatCurrency(data.lessCapitalAllowances)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-semibold mt-2">
                  <span>Adjusted Taxable Profit</span>
                  <span className="font-mono">{formatCurrency(Math.max(0, adjustedProfit))}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 15:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Losses Brought Forward
            </h3>
            <p className="text-sm text-muted-foreground">
              Trading losses from prior years that can be offset against current year profits (Section 396 TCA 1997).
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasLossesBroughtForward"
                  checked={data.hasLossesBroughtForward}
                  onCheckedChange={(checked) => updateData("hasLossesBroughtForward", checked === true)}
                />
                <Label htmlFor="hasLossesBroughtForward">Trading losses brought forward from prior years</Label>
              </div>

              {data.hasLossesBroughtForward && (
                <div className="ml-6 space-y-3">
                  <div>
                    <Label className="text-sm">Losses amount</Label>
                    <Input
                      type="number"
                      value={data.lossesBroughtForwardAmount || ""}
                      onChange={(e) => updateData("lossesBroughtForwardAmount", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Year losses arose</Label>
                    <Input
                      type="text"
                      value={data.lossesBroughtForwardYear}
                      onChange={(e) => updateData("lossesBroughtForwardYear", e.target.value)}
                      placeholder="e.g. 2023"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 16:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Start-up Exemption (Section 486C)
            </h3>
            <p className="text-sm text-muted-foreground">
              Companies in their first 3 years of trading may be exempt from corporation tax if total tax liability does
              not exceed employer PRSI contributions.
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="claimStartupExemption"
                  checked={data.claimStartupExemption}
                  onCheckedChange={(checked) => updateData("claimStartupExemption", checked === true)}
                />
                <Label htmlFor="claimStartupExemption">Claim start-up company exemption</Label>
              </div>

              {data.claimStartupExemption && (
                <div className="ml-6">
                  <Label className="text-sm">Total employer PRSI paid in the period</Label>
                  <Input
                    type="number"
                    value={data.startupExemptionAmount || ""}
                    onChange={(e) => updateData("startupExemptionAmount", parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    CT relief is limited to the amount of employer PRSI paid.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 17:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Dividend Withholding Tax
            </h3>
            <p className="text-sm text-muted-foreground">Were dividends paid to shareholders during this period?</p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasDividendsPaid"
                  checked={data.hasDividendsPaid}
                  onCheckedChange={(checked) => updateData("hasDividendsPaid", checked === true)}
                />
                <Label htmlFor="hasDividendsPaid">Dividends paid during this period</Label>
              </div>

              {data.hasDividendsPaid && (
                <div className="ml-6 space-y-3">
                  <div>
                    <Label className="text-sm">Total dividends paid</Label>
                    <Input
                      type="number"
                      value={data.dividendsPaidAmount || ""}
                      onChange={(e) => {
                        const amt = parseFloat(e.target.value) || 0;
                        updateData("dividendsPaidAmount", amt);
                        updateData("dwtDeducted", Math.round(amt * 0.25 * 100) / 100);
                      }}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex justify-between text-sm">
                      <span>DWT deducted (25%)</span>
                      <span className="font-mono">{formatCurrency(data.dwtDeducted)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 18: {
        const totalCGT = data.disposals.reduce((sum, d) => {
          const gain = d.salePrice - d.costPrice;
          return sum + Math.max(0, gain);
        }, 0);
        const cgtPayable = Math.max(0, totalCGT - 1270) * 0.33;
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Capital Gains / Asset Disposals
            </h3>
            <p className="text-sm text-muted-foreground">
              Did the company dispose of any chargeable assets during this period?
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasAssetDisposals"
                  checked={data.hasAssetDisposals}
                  onCheckedChange={(checked) => updateData("hasAssetDisposals", checked === true)}
                />
                <Label htmlFor="hasAssetDisposals">Asset disposals occurred</Label>
              </div>

              {data.hasAssetDisposals && (
                <>
                  {data.disposals.map((disposal, idx) => (
                    <div key={idx} className="border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Disposal {idx + 1}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const updated = data.disposals.filter((_, i) => i !== idx);
                            updateData("disposals", updated);
                          }}
                          className="text-destructive h-6 text-xs"
                        >
                          Remove
                        </Button>
                      </div>
                      <Input
                        placeholder="Description"
                        value={disposal.description}
                        onChange={(e) => {
                          const updated = [...data.disposals];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          updateData("disposals", updated);
                        }}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Date acquired</Label>
                          <Input
                            type="date"
                            value={disposal.dateAcquired}
                            onChange={(e) => {
                              const updated = [...data.disposals];
                              updated[idx] = { ...updated[idx], dateAcquired: e.target.value };
                              updateData("disposals", updated);
                            }}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Date sold</Label>
                          <Input
                            type="date"
                            value={disposal.dateSold}
                            onChange={(e) => {
                              const updated = [...data.disposals];
                              updated[idx] = { ...updated[idx], dateSold: e.target.value };
                              updateData("disposals", updated);
                            }}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Cost price</Label>
                          <Input
                            type="number"
                            value={disposal.costPrice || ""}
                            onChange={(e) => {
                              const updated = [...data.disposals];
                              updated[idx] = { ...updated[idx], costPrice: parseFloat(e.target.value) || 0 };
                              updateData("disposals", updated);
                            }}
                            placeholder="0.00"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Sale price</Label>
                          <Input
                            type="number"
                            value={disposal.salePrice || ""}
                            onChange={(e) => {
                              const updated = [...data.disposals];
                              updated[idx] = { ...updated[idx], salePrice: parseFloat(e.target.value) || 0 };
                              updateData("disposals", updated);
                            }}
                            placeholder="0.00"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updateData("disposals", [
                        ...data.disposals,
                        { description: "", dateAcquired: "", dateSold: "", costPrice: 0, salePrice: 0 },
                      ]);
                    }}
                  >
                    + Add disposal
                  </Button>

                  {data.disposals.length > 0 && (
                    <div className="bg-primary/5 rounded-lg p-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Total chargeable gain</span>
                        <span className="font-mono">{formatCurrency(totalCGT)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Less: Annual exemption</span>
                        <span className="font-mono">-{formatCurrency(1270)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm font-semibold">
                        <span>CGT payable (33%)</span>
                        <span className="font-mono">{formatCurrency(Math.max(0, cgtPayable))}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      }

      case 19:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Final Declaration – Business Account
            </h3>

            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="finalDeclaration"
                  checked={data.finalDeclaration}
                  onCheckedChange={(checked) => updateData("finalDeclaration", checked === true)}
                  className="mt-1"
                />
                <Label htmlFor="finalDeclaration" className="text-sm leading-relaxed cursor-pointer">
                  I confirm that Balnce has correctly automated the bookkeeping, VAT, and balance sheet for this
                  business account for the selected period, based on the confirmations above.
                </Label>
              </div>
            </div>

            {data.finalDeclaration && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Ready to export</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Bank Account Finalisation
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {accountName}
            {periodStart && periodEnd && (
              <>
                {" "}
                • {format(periodStart, "d MMM yyyy")} – {format(periodEnd, "d MMM yyyy")}
              </>
            )}
          </p>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex gap-1">
          {sectionOrder.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                idx + 1 <= currentSection ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <ScrollArea className="max-h-[50vh] pr-4">{renderSection()}</ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleBack} disabled={currentSection === 1}>
            Back
          </Button>
          <Button onClick={handleNext} disabled={!canProceed()}>
            {currentSection === totalSections ? "Export" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
