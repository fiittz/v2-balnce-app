import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, User, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DirectorQuestionnaireData {
  // Section 1: Change Detection
  noChanges: boolean;
  changes: {
    employmentStatus: boolean;
    incomeSources: boolean;
    assessmentStatus: boolean;
    pensionContributions: boolean;
    foreignIncome: boolean;
  };
  changeEffectiveDate: Date | undefined;

  // Section 2: Income Source Reconciliation
  incomeComplete: boolean;
  incomeNotes: string;

  // Section 3: Salary & Dividends Reconciliation
  salaryCorrect: boolean;
  salaryAmount: number;
  dividendsReceived: boolean;
  dividendsAmount: number;
  salaryDividendNotes: string;

  // Section 4: Benefits in Kind Confirmation
  bikApplicable: boolean;
  bikCorrect: boolean;
  bikEstimatedValue: number;
  bikNotes: string;

  // Section 5: Business Link Validation
  businessLinksStatus: "yes" | "no" | "unsure" | undefined;
  businessLinkNotes: string;

  // Section 6: Reliefs & Credits
  reliefsCorrect: boolean;
  reliefsNotes: string;
  medicalExpensesAmount: number;
  pensionContributionsAmount: number;
  rentReliefAmount: number;
  charitableDonationsAmount: number;
  remoteWorkingDays: number;

  // Section 7: Spouse/Partner Income (conditional on joint assessment)
  spouseHasIncome: boolean;
  spouseIncomeType: string[];
  spouseIncomeAmount: number;
  spouseReliefs: string;

  // Section 8: Preliminary Tax
  preliminaryTaxPaid: "yes" | "no" | "unsure" | undefined;
  preliminaryTaxAmount: string;
  preliminaryTaxDate: Date | undefined;

  // Section 9: Revenue Edge Cases
  edgeCases: {
    capitalGains: boolean;
    foreignIncome: boolean;
    chargeableBenefits: boolean;
    none: boolean;
  };
  propertyDisposals: boolean;
  shareDisposals: boolean;
  cryptoDisposals: boolean;
  inheritanceReceived: boolean;
  rentalIncomeDetails: boolean;
  rentalIncomeAmount: number;
  rentalExpensesAmount: number;

  // Section 10: Final Declaration
  finalDeclaration: boolean;

  // Pre/post salary split (when employment status changed mid-year)
  preSalaryAmount: number;
  postSalaryAmount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (data: DirectorQuestionnaireData) => void;
  accountName?: string;
  taxYear?: string;
  // Auto-generated data
  detectedIncomeSources?: { source: string; amount: number }[];
  linkedBusinesses?: { name: string; type: string }[];
  assumedReliefs?: { relief: string; amount: number }[];
  // New props
  detectedSalary?: number;
  detectedDividends?: number;
  detectedBIK?: { type: string; value: number }[];
  assessmentBasis?: "single" | "joint" | "separate";
}

const initialData: DirectorQuestionnaireData = {
  noChanges: false,
  changes: {
    employmentStatus: false,
    incomeSources: false,
    assessmentStatus: false,
    pensionContributions: false,
    foreignIncome: false,
  },
  changeEffectiveDate: undefined,
  incomeComplete: false,
  incomeNotes: "",
  salaryCorrect: false,
  salaryAmount: 0,
  dividendsReceived: false,
  dividendsAmount: 0,
  salaryDividendNotes: "",
  bikApplicable: false,
  bikCorrect: false,
  bikEstimatedValue: 0,
  bikNotes: "",
  businessLinksStatus: undefined,
  businessLinkNotes: "",
  reliefsCorrect: false,
  reliefsNotes: "",
  medicalExpensesAmount: 0,
  pensionContributionsAmount: 0,
  rentReliefAmount: 0,
  charitableDonationsAmount: 0,
  remoteWorkingDays: 0,
  spouseHasIncome: false,
  spouseIncomeType: [],
  spouseIncomeAmount: 0,
  spouseReliefs: "",
  preliminaryTaxPaid: undefined,
  preliminaryTaxAmount: "",
  preliminaryTaxDate: undefined,
  edgeCases: {
    capitalGains: false,
    foreignIncome: false,
    chargeableBenefits: false,
    none: false,
  },
  propertyDisposals: false,
  shareDisposals: false,
  cryptoDisposals: false,
  inheritanceReceived: false,
  rentalIncomeDetails: false,
  rentalIncomeAmount: 0,
  rentalExpensesAmount: 0,
  finalDeclaration: false,
  preSalaryAmount: 0,
  postSalaryAmount: 0,
};

const SPOUSE_INCOME_TYPES = [
  { value: "paye", label: "PAYE employment" },
  { value: "self_employed", label: "Self-employed" },
  { value: "rental", label: "Rental income" },
  { value: "pension", label: "Pension" },
  { value: "other", label: "Other" },
];

export function DirectorExportQuestionnaire({
  open,
  onOpenChange,
  onComplete,
  accountName = "Director Account",
  taxYear,
  detectedIncomeSources = [],
  linkedBusinesses = [],
  assumedReliefs = [],
  detectedSalary,
  detectedDividends,
  detectedBIK = [],
  assessmentBasis,
}: Props) {
  const [data, setData] = useState<DirectorQuestionnaireData>(initialData);
  const [currentSection, setCurrentSection] = useState(1);

  const updateData = <K extends keyof DirectorQuestionnaireData>(
    key: K,
    value: DirectorQuestionnaireData[K]
  ) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const updateChange = (
    key: keyof DirectorQuestionnaireData["changes"],
    value: boolean
  ) => {
    setData((prev) => ({
      ...prev,
      changes: { ...prev.changes, [key]: value },
    }));
  };

  const updateEdgeCase = (
    key: keyof DirectorQuestionnaireData["edgeCases"],
    value: boolean
  ) => {
    if (key === "none" && value) {
      setData((prev) => ({
        ...prev,
        edgeCases: {
          capitalGains: false,
          foreignIncome: false,
          chargeableBenefits: false,
          none: true,
        },
      }));
    } else {
      setData((prev) => ({
        ...prev,
        edgeCases: { ...prev.edgeCases, [key]: value, none: false },
      }));
    }
  };

  // Spouse section is conditional on joint/separate assessment
  const showSpouseSection = assessmentBasis === "joint" || assessmentBasis === "separate";
  const sectionOrder: number[] = [1, 2, 3, 4, 5, 6];
  if (showSpouseSection) sectionOrder.push(7);
  sectionOrder.push(8, 9, 10);
  const totalSections = sectionOrder.length;
  const currentSectionId = sectionOrder[currentSection - 1] ?? 1;

  const canProceed = () => {
    switch (currentSectionId) {
      case 1:
        return data.noChanges || Object.values(data.changes).some(Boolean);
      case 2:
        return data.incomeComplete || data.incomeNotes.trim().length > 0;
      case 3: // Salary & Dividends
        return true; // optional
      case 4: // BIK
        return true; // optional
      case 5:
        return data.businessLinksStatus !== undefined;
      case 6:
        return data.reliefsCorrect || data.reliefsNotes.trim().length > 0;
      case 7: // Spouse
        return true; // optional
      case 8:
        return data.preliminaryTaxPaid !== undefined;
      case 9:
        return Object.values(data.edgeCases).some(Boolean);
      case 10:
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
              Change Detection Since Onboarding
            </h3>
            <p className="text-sm text-muted-foreground">
              Since onboarding, has anything changed that affects your personal
              tax position?
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="noChanges"
                  checked={data.noChanges}
                  onCheckedChange={(checked) => {
                    updateData("noChanges", checked === true);
                    if (checked) {
                      setData((prev) => ({
                        ...prev,
                        changes: {
                          employmentStatus: false,
                          incomeSources: false,
                          assessmentStatus: false,
                          pensionContributions: false,
                          foreignIncome: false,
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
                  checked={Object.values(data.changes).some(Boolean)}
                  onCheckedChange={(checked) => {
                    if (checked) updateData("noChanges", false);
                  }}
                />
                <Label htmlFor="yesChanges">Yes — select what changed:</Label>
              </div>

              {!data.noChanges && (
                <div className="ml-6 space-y-2">
                  {[
                    { key: "employmentStatus", label: "Employment status" },
                    { key: "incomeSources", label: "Income sources" },
                    {
                      key: "assessmentStatus",
                      label: "Joint / separate assessment status",
                    },
                    {
                      key: "pensionContributions",
                      label: "Pension contributions or reliefs",
                    },
                    { key: "foreignIncome", label: "Foreign income" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={
                          data.changes[key as keyof typeof data.changes]
                        }
                        onCheckedChange={(checked) =>
                          updateChange(
                            key as keyof typeof data.changes,
                            checked === true
                          )
                        }
                      />
                      <Label htmlFor={key} className="text-sm">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              )}

              {Object.values(data.changes).some(Boolean) && (
                <div className="mt-4">
                  <Label className="text-sm">Effective from:</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-2",
                          !data.changeEffectiveDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {data.changeEffectiveDate
                          ? format(data.changeEffectiveDate, "PPP")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={data.changeEffectiveDate}
                        onSelect={(date) =>
                          updateData("changeEffectiveDate", date)
                        }
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
              Income Source Reconciliation
            </h3>
            <p className="text-sm text-muted-foreground">
              Based on linked accounts, the platform detected the following
              income sources:
            </p>

            {detectedIncomeSources.length > 0 ? (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                {detectedIncomeSources.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.source}</span>
                    <span className="font-mono">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                No income sources detected.
              </div>
            )}

            <p className="text-sm font-medium">Is this complete?</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="incomeYes"
                  checked={data.incomeComplete}
                  onCheckedChange={(checked) =>
                    updateData("incomeComplete", checked === true)
                  }
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
                <Label htmlFor="incomeNo">No — missing income source</Label>
              </div>
              {!data.incomeComplete && (
                <Textarea
                  placeholder="Please describe what income source is missing..."
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
                {currentSection}
              </span>
              Salary & Dividends Reconciliation
            </h3>
            <p className="text-sm text-muted-foreground">
              Confirm salary and dividend amounts detected from the company accounts.
            </p>

            <div className="space-y-3">
              {detectedSalary !== undefined && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex justify-between text-sm">
                    <span>Detected gross salary</span>
                    <span className="font-mono">{formatCurrency(detectedSalary)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="salaryCorrect"
                  checked={data.salaryCorrect}
                  onCheckedChange={(checked) =>
                    updateData("salaryCorrect", checked === true)
                  }
                />
                <Label htmlFor="salaryCorrect">Salary amount is correct</Label>
              </div>

              {!data.salaryCorrect && !data.changes.employmentStatus && (
                <div>
                  <Label className="text-sm">Correct salary amount</Label>
                  <Input
                    type="number"
                    value={data.salaryAmount || ""}
                    onChange={(e) => updateData("salaryAmount", parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              )}

              {data.changes.employmentStatus && data.changeEffectiveDate && (
                <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 space-y-3">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Employment status changed — provide salary before and after the change date.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Salary before {format(data.changeEffectiveDate, "d MMM yyyy")}</Label>
                      <Input
                        type="number"
                        value={data.preSalaryAmount || ""}
                        onChange={(e) => updateData("preSalaryAmount", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Salary after {format(data.changeEffectiveDate, "d MMM yyyy")}</Label>
                      <Input
                        type="number"
                        value={data.postSalaryAmount || ""}
                        onChange={(e) => updateData("postSalaryAmount", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dividendsReceived"
                  checked={data.dividendsReceived}
                  onCheckedChange={(checked) =>
                    updateData("dividendsReceived", checked === true)
                  }
                />
                <Label htmlFor="dividendsReceived">Dividends received during this period</Label>
              </div>

              {data.dividendsReceived && (
                <div>
                  <Label className="text-sm">Dividends amount</Label>
                  {detectedDividends !== undefined && (
                    <p className="text-xs text-muted-foreground mb-1">Detected: {formatCurrency(detectedDividends)}</p>
                  )}
                  <Input
                    type="number"
                    value={data.dividendsAmount || ""}
                    onChange={(e) => updateData("dividendsAmount", parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              )}

              <Textarea
                placeholder="Notes on salary/dividends (optional)..."
                value={data.salaryDividendNotes}
                onChange={(e) => updateData("salaryDividendNotes", e.target.value)}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Benefits in Kind Confirmation
            </h3>
            <p className="text-sm text-muted-foreground">
              Confirm any non-cash benefits received from the company.
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bikApplicable"
                  checked={data.bikApplicable}
                  onCheckedChange={(checked) =>
                    updateData("bikApplicable", checked === true)
                  }
                />
                <Label htmlFor="bikApplicable">Benefits in kind received</Label>
              </div>

              {data.bikApplicable && (
                <>
                  {detectedBIK.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      {detectedBIK.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{item.type}</span>
                          <span className="font-mono">{formatCurrency(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="bikCorrect"
                      checked={data.bikCorrect}
                      onCheckedChange={(checked) =>
                        updateData("bikCorrect", checked === true)
                      }
                    />
                    <Label htmlFor="bikCorrect">BIK values are correct</Label>
                  </div>

                  <div>
                    <Label className="text-sm">Estimated total BIK value</Label>
                    <Input
                      type="number"
                      value={data.bikEstimatedValue || ""}
                      onChange={(e) => updateData("bikEstimatedValue", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>

                  <Textarea
                    placeholder="Notes on BIK (optional)..."
                    value={data.bikNotes}
                    onChange={(e) => updateData("bikNotes", e.target.value)}
                  />
                </>
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
              Business Link Validation
            </h3>
            <p className="text-sm text-muted-foreground">
              Linked businesses detected:
            </p>

            {linkedBusinesses.length > 0 ? (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                {linkedBusinesses.map((business, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{business.name}</span>
                    <span className="text-muted-foreground">
                      {business.type}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                No linked businesses detected.
              </div>
            )}

            <p className="text-sm font-medium">
              Have all drawings, salary, or other income from these businesses
              been included?
            </p>
            <div className="space-y-2">
              {[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "unsure", label: "Unsure" },
              ].map(({ value, label }) => (
                <div key={value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`business-${value}`}
                    checked={data.businessLinksStatus === value}
                    onCheckedChange={(checked) => {
                      if (checked)
                        updateData(
                          "businessLinksStatus",
                          value as DirectorQuestionnaireData["businessLinksStatus"]
                        );
                    }}
                  />
                  <Label htmlFor={`business-${value}`}>{label}</Label>
                </div>
              ))}
            </div>

            {data.businessLinksStatus === "no" && (
              <Textarea
                placeholder="Please describe what is missing..."
                value={data.businessLinkNotes}
                onChange={(e) =>
                  updateData("businessLinkNotes", e.target.value)
                }
                className="mt-2"
              />
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Reliefs & Credits Confirmation
            </h3>
            <p className="text-sm text-muted-foreground">
              The platform assumed the following reliefs or credits apply:
            </p>

            {assumedReliefs.length > 0 ? (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                {assumedReliefs.map((relief, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{relief.relief}</span>
                    <span className="font-mono text-green-600">
                      {formatCurrency(relief.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                No reliefs or credits assumed.
              </div>
            )}

            <p className="text-sm font-medium">Is this correct?</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reliefsYes"
                  checked={data.reliefsCorrect}
                  onCheckedChange={(checked) =>
                    updateData("reliefsCorrect", checked === true)
                  }
                />
                <Label htmlFor="reliefsYes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reliefsNo"
                  checked={!data.reliefsCorrect && data.reliefsNotes.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) updateData("reliefsCorrect", false);
                  }}
                />
                <Label htmlFor="reliefsNo">No — something changed</Label>
              </div>
              {!data.reliefsCorrect && (
                <Textarea
                  placeholder="Please describe what changed..."
                  value={data.reliefsNotes}
                  onChange={(e) => updateData("reliefsNotes", e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            <Separator />

            <p className="text-sm font-medium">Relief amounts (if claiming)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Medical expenses</Label>
                <Input
                  type="number"
                  value={data.medicalExpensesAmount || ""}
                  onChange={(e) => updateData("medicalExpensesAmount", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Pension contributions</Label>
                <Input
                  type="number"
                  value={data.pensionContributionsAmount || ""}
                  onChange={(e) => updateData("pensionContributionsAmount", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Rent relief</Label>
                <Input
                  type="number"
                  value={data.rentReliefAmount || ""}
                  onChange={(e) => updateData("rentReliefAmount", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Charitable donations</Label>
                <Input
                  type="number"
                  value={data.charitableDonationsAmount || ""}
                  onChange={(e) => updateData("charitableDonationsAmount", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Remote working days</Label>
              <Input
                type="number"
                value={data.remoteWorkingDays || ""}
                onChange={(e) => updateData("remoteWorkingDays", parseInt(e.target.value) || 0)}
                placeholder="0"
                className="mt-1 w-32"
              />
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
              Spouse / Partner Income
            </h3>
            <p className="text-sm text-muted-foreground">
              For joint or separate assessment, provide details of your spouse/partner's income.
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="spouseHasIncome"
                  checked={data.spouseHasIncome}
                  onCheckedChange={(checked) =>
                    updateData("spouseHasIncome", checked === true)
                  }
                />
                <Label htmlFor="spouseHasIncome">Spouse/partner has income</Label>
              </div>

              {data.spouseHasIncome && (
                <>
                  <div>
                    <Label className="text-sm">Income type(s)</Label>
                    <div className="space-y-2 mt-1">
                      {SPOUSE_INCOME_TYPES.map((type) => (
                        <div key={type.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`spouse-${type.value}`}
                            checked={data.spouseIncomeType.includes(type.value)}
                            onCheckedChange={(checked) => {
                              const current = data.spouseIncomeType;
                              const newTypes = checked
                                ? [...current, type.value]
                                : current.filter(v => v !== type.value);
                              updateData("spouseIncomeType", newTypes);
                            }}
                          />
                          <Label htmlFor={`spouse-${type.value}`} className="text-sm">{type.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm">Total spouse/partner income</Label>
                    <Input
                      type="number"
                      value={data.spouseIncomeAmount || ""}
                      onChange={(e) => updateData("spouseIncomeAmount", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Spouse/partner reliefs (optional)</Label>
                    <Textarea
                      placeholder="Describe any reliefs your spouse/partner is claiming..."
                      value={data.spouseReliefs}
                      onChange={(e) => updateData("spouseReliefs", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </>
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
              Preliminary Tax (Personal)
            </h3>
            <p className="text-sm text-muted-foreground">
              Was preliminary tax paid in respect of your personal tax for this
              year?
            </p>

            <div className="space-y-2">
              {[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "unsure", label: "Unsure" },
              ].map(({ value, label }) => (
                <div key={value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`prelim-${value}`}
                    checked={data.preliminaryTaxPaid === value}
                    onCheckedChange={(checked) => {
                      if (checked)
                        updateData(
                          "preliminaryTaxPaid",
                          value as DirectorQuestionnaireData["preliminaryTaxPaid"]
                        );
                    }}
                  />
                  <Label htmlFor={`prelim-${value}`}>{label}</Label>
                </div>
              ))}
            </div>

            {data.preliminaryTaxPaid === "yes" && (
              <div className="space-y-4 mt-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-sm">Amount paid (optional)</Label>
                  <Input
                    type="text"
                    placeholder="€0.00"
                    value={data.preliminaryTaxAmount}
                    onChange={(e) =>
                      updateData("preliminaryTaxAmount", e.target.value)
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-sm">Date paid</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-2",
                          !data.preliminaryTaxDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {data.preliminaryTaxDate
                          ? format(data.preliminaryTaxDate, "PPP")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={data.preliminaryTaxDate}
                        onSelect={(date) =>
                          updateData("preliminaryTaxDate", date)
                        }
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>
        );

      case 9:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-sm">
                {currentSection}
              </span>
              Revenue Edge Cases
            </h3>
            <p className="text-sm text-muted-foreground">
              Select any that apply to your tax position this year:
            </p>

            <div className="space-y-3">
              {[
                { key: "capitalGains", label: "Capital gains (CGT) events" },
                { key: "foreignIncome", label: "Foreign income" },
                { key: "chargeableBenefits", label: "Chargeable benefits" },
                { key: "none", label: "None of the above" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={
                      data.edgeCases[key as keyof typeof data.edgeCases]
                    }
                    onCheckedChange={(checked) =>
                      updateEdgeCase(
                        key as keyof typeof data.edgeCases,
                        checked === true
                      )
                    }
                  />
                  <Label htmlFor={key}>{label}</Label>
                </div>
              ))}
            </div>

            <Separator />

            <p className="text-sm font-medium">Additional disposals & income</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="propertyDisposals"
                  checked={data.propertyDisposals}
                  onCheckedChange={(checked) => updateData("propertyDisposals", checked === true)}
                />
                <Label htmlFor="propertyDisposals" className="text-sm">Property disposals</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="shareDisposals"
                  checked={data.shareDisposals}
                  onCheckedChange={(checked) => updateData("shareDisposals", checked === true)}
                />
                <Label htmlFor="shareDisposals" className="text-sm">Share disposals</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cryptoDisposals"
                  checked={data.cryptoDisposals}
                  onCheckedChange={(checked) => updateData("cryptoDisposals", checked === true)}
                />
                <Label htmlFor="cryptoDisposals" className="text-sm">Cryptocurrency disposals</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="inheritanceReceived"
                  checked={data.inheritanceReceived}
                  onCheckedChange={(checked) => updateData("inheritanceReceived", checked === true)}
                />
                <Label htmlFor="inheritanceReceived" className="text-sm">Inheritance / gift received</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rentalIncomeDetails"
                  checked={data.rentalIncomeDetails}
                  onCheckedChange={(checked) => updateData("rentalIncomeDetails", checked === true)}
                />
                <Label htmlFor="rentalIncomeDetails" className="text-sm">Rental income</Label>
              </div>

              {data.rentalIncomeDetails && (
                <div className="ml-6 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Rental income</Label>
                    <Input
                      type="number"
                      value={data.rentalIncomeAmount || ""}
                      onChange={(e) => updateData("rentalIncomeAmount", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Rental expenses</Label>
                    <Input
                      type="number"
                      value={data.rentalExpensesAmount || ""}
                      onChange={(e) => updateData("rentalExpensesAmount", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                </div>
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
              Final Declaration – Form 11
            </h3>

            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="finalDeclaration"
                  checked={data.finalDeclaration}
                  onCheckedChange={(checked) =>
                    updateData("finalDeclaration", checked === true)
                  }
                  className="mt-1"
                />
                <Label
                  htmlFor="finalDeclaration"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  I confirm that Balnce's automated treatment of my personal
                  income, expenses, and tax position is accurate for Form 11
                  purposes for this tax year, to the best of my knowledge.
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
            <User className="h-5 w-5" />
            Director – Personal Account Finalisation (Form 11)
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {accountName}
            {taxYear && <> • Tax Year {taxYear}</>}
          </p>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex gap-1">
          {sectionOrder.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                idx + 1 <= currentSection ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        <ScrollArea className="max-h-[50vh] pr-4">{renderSection()}</ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentSection === 1}
          >
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
