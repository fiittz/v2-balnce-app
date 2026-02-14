import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Calendar, 
  FileText, 
  User, 
  Building2, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Calculator
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useAccounts } from "@/hooks/useAccounts";
import { useReliefScan } from "@/hooks/useReliefScan";
import { useCT1Data } from "@/hooks/useCT1Data";
import { useDirectorOnboarding } from "@/hooks/useDirectorOnboarding";
import { BusinessBankExportQuestionnaire } from "@/components/export/BusinessBankExportQuestionnaire";
import { DirectorExportQuestionnaire } from "@/components/export/DirectorExportQuestionnaire";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { assembleCT1ReportData } from "@/lib/reports/ct1ReportData";
import { generateCT1Pdf } from "@/lib/reports/pdf/ct1Pdf";
import { generateCT1Excel } from "@/lib/reports/excel/ct1Excel";
import { assembleAbridgedAccountsData } from "@/lib/reports/abridgedAccountsData";
import type { AbridgedAccountsInput } from "@/lib/reports/abridgedAccountsData";
import { generateAbridgedAccountsPdf } from "@/lib/reports/pdf/abridgedAccountsPdf";
import { generateAbridgedAccountsExcel } from "@/lib/reports/excel/abridgedAccountsExcel";
import type { ReportMeta } from "@/lib/reports/types";

interface TaxDeadline {
  name: string;
  date: Date;
  type: "ct1" | "form11" | "vat" | "paye";
  status: "upcoming" | "due_soon" | "overdue";
}

const TaxCentre = () => {
  const navigate = useNavigate();
  const { user, profile, directorCount, directorsCompleted, onboardingComplete, directorOnboardingComplete } = useAuth();
  const { data: personalAccounts } = useAccounts("directors_personal_tax");
  const hasPersonalAccounts = (personalAccounts?.length ?? 0) > 0;
  const { reliefs } = useReliefScan(
    hasPersonalAccounts ? { accountType: "directors_personal_tax" } : undefined
  );
  const { getDirector, isLoading: directorsLoading } = useDirectorOnboarding();
  const [showCT1Questionnaire, setShowCT1Questionnaire] = useState(false);
  const [showForm11Questionnaire, setShowForm11Questionnaire] = useState(false);
  const [selectedDirectorIndex, setSelectedDirectorIndex] = useState(1);
  // Force re-read of saved CT1 data after save
  const [ct1SaveCounter, setCt1SaveCounter] = useState(0);

  // Get current tax year
  const now = new Date();
  const currentYear = now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear();
  const taxYear = `${currentYear - 1}`;

  // Read saved CT1 questionnaire from localStorage
  const savedCT1 = useMemo(() => {
    // ct1SaveCounter is a dependency to force re-read after save
    void ct1SaveCounter;
    const raw = localStorage.getItem(`ct1_questionnaire_${user?.id}_${taxYear}`);
    return raw ? JSON.parse(raw) : null;
  }, [user?.id, taxYear, ct1SaveCounter]);

  // Determine CT1 status badge
  const ct1Status = useMemo(() => {
    if (!savedCT1) return "not_started" as const;
    if (savedCT1.finalDeclaration) return "complete" as const;
    return "in_progress" as const;
  }, [savedCT1]);

  // Pass VAT change dates from saved questionnaire to useCT1Data for re-evaluation
  const ct1 = useCT1Data(
    savedCT1?.vatStatusChangeDate
      ? {
          vatChangeDate: savedCT1.vatStatusChangeDate,
          vatStatusBefore: savedCT1.vatStatus === "not_registered" ? "not_registered" : undefined,
          vatStatusAfter: savedCT1.vatStatus,
        }
      : undefined
  );

  const getCT1ReportMeta = (): ReportMeta => ({
    companyName: profile?.business_name || "Company",
    taxYear,
    generatedDate: new Date(),
  });

  const handleCT1Pdf = () => {
    const data = assembleCT1ReportData(ct1, savedCT1, getCT1ReportMeta());
    generateCT1Pdf(data);
  };

  const handleCT1Excel = async () => {
    const data = assembleCT1ReportData(ct1, savedCT1, getCT1ReportMeta());
    await generateCT1Excel(data);
  };

  const getAbridgedAccountsInput = (): AbridgedAccountsInput => {
    // Company data from business_onboarding_extra
    const extraRaw = localStorage.getItem("business_onboarding_extra");
    const extra = extraRaw ? JSON.parse(extraRaw) : {};
    const biz = extra?.businesses?.[0] ?? {};

    // Director names
    const directorNames: string[] = [];
    for (let i = 1; i <= directorCount; i++) {
      const d = getDirector(i);
      if (d?.director_name) directorNames.push(d.director_name);
    }
    if (directorNames.length === 0) directorNames.push(profile?.business_name ?? "Director");

    // CT liability (12.5% of trading profit)
    const totalIncome = ct1.detectedIncome.reduce((s, i) => s + i.amount, 0);
    const capitalAllowancesTotal =
      (savedCT1?.capitalAllowancesPlant ?? 0) + (savedCT1?.capitalAllowancesMotorVehicles ?? 0);
    const tradingProfit = Math.max(0, totalIncome - ct1.expenseSummary.allowable - capitalAllowancesTotal);
    const lossesForward = savedCT1?.lossesForward ?? 0;
    const taxableProfit = Math.max(0, tradingProfit - lossesForward);
    const ctLiability = taxableProfit * 0.125 + (savedCT1?.closeCompanySurcharge ?? 0);

    // Retained profits = income - allowable expenses - CT
    const retainedProfits = totalIncome - ct1.expenseSummary.allowable - ctLiability;

    return {
      companyName: biz.company_name || profile?.business_name || "Company",
      croNumber: biz.cro_number || "",
      registeredAddress: biz.registered_address || "",
      accountingYearEnd: `31 December ${taxYear}`,
      directorNames,
      companySecretaryName: biz.company_secretary_name || undefined,
      fixedAssetsTangible:
        (savedCT1?.fixedAssetsLandBuildings ?? 0) +
        (savedCT1?.fixedAssetsPlantMachinery ?? 0) +
        (savedCT1?.fixedAssetsMotorVehicles ?? 0) +
        (savedCT1?.fixedAssetsFixturesFittings ?? 0),
      stock: savedCT1?.currentAssetsStock ?? 0,
      wip: savedCT1?.wipValue ?? 0,
      debtors: savedCT1?.currentAssetsDebtors ?? savedCT1?.tradeDebtorsTotal ?? 0,
      prepayments: savedCT1?.prepaymentsAmount ?? 0,
      cashAtBank: savedCT1?.currentAssetsBankBalance ?? ct1.closingBalance ?? 0,
      creditors: savedCT1?.liabilitiesCreditors ?? savedCT1?.tradeCreditorsTotal ?? 0,
      accruals: savedCT1?.accrualsAmount ?? 0,
      taxation: ctLiability,
      bankLoans: savedCT1?.liabilitiesBankLoans ?? 0,
      directorsLoans: savedCT1?.liabilitiesDirectorsLoans ?? savedCT1?.directorsLoanBalance ?? 0,
      directorsLoanDirection: savedCT1?.directorsLoanDirection,
      shareCapital: savedCT1?.shareCapital ?? 100,
      retainedProfits,
    };
  };

  const handleAbridgedPdf = () => {
    const input = getAbridgedAccountsInput();
    const data = assembleAbridgedAccountsData(input, getCT1ReportMeta());
    generateAbridgedAccountsPdf(data);
  };

  const handleAbridgedExcel = async () => {
    const input = getAbridgedAccountsInput();
    const data = assembleAbridgedAccountsData(input, getCT1ReportMeta());
    await generateAbridgedAccountsExcel(data);
  };

  // Calculate deadlines based on Irish tax calendar
  const getDeadlines = (): TaxDeadline[] => {
    const deadlines: TaxDeadline[] = [];
    
    // CT1 deadline: 9 months after accounting year end (typically 21st of the 9th month)
    const ct1Deadline = new Date(currentYear, 8, 21); // September 21st
    deadlines.push({
      name: "CT1 Corporation Tax Return",
      date: ct1Deadline,
      type: "ct1",
      status: getDeadlineStatus(ct1Deadline),
    });

    // Form 11 deadline: October 31st (or mid-November for ROS)
    const form11Deadline = new Date(currentYear, 9, 31); // October 31st
    deadlines.push({
      name: "Form 11 Income Tax Return",
      date: form11Deadline,
      type: "form11",
      status: getDeadlineStatus(form11Deadline),
    });

    // Preliminary Tax deadline: October 31st
    const prelimTaxDeadline = new Date(currentYear, 9, 31);
    deadlines.push({
      name: "Preliminary Tax Payment",
      date: prelimTaxDeadline,
      type: "form11",
      status: getDeadlineStatus(prelimTaxDeadline),
    });

    return deadlines.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const getDeadlineStatus = (date: Date): "upcoming" | "due_soon" | "overdue" => {
    const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return "overdue";
    if (daysUntil <= 30) return "due_soon";
    return "upcoming";
  };

  const deadlines = getDeadlines();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getDaysUntil = (date: Date) => {
    const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `${days} days`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "overdue": return "bg-destructive text-destructive-foreground";
      case "due_soon": return "bg-yellow-500 text-white";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  // Calculate readiness score
  const calculateReadiness = () => {
    let score = 0;
    const total = 4;
    
    if (onboardingComplete) score++;
    if (directorOnboardingComplete) score++;
    // Add more criteria based on data completeness
    score += 1; // Placeholder for transactions imported
    score += 0.5; // Placeholder for receipts matched
    
    return Math.round((score / total) * 100);
  };

  const readinessScore = calculateReadiness();

  const handleOpenForm11 = (directorNum: number) => {
    setSelectedDirectorIndex(directorNum);
    setShowForm11Questionnaire(true);
  };

  return (
    <AppLayout>
      <div className="flex-1">
        {/* Header */}
        <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-semibold text-xl">Tax Centre</h1>
                <p className="text-sm text-muted-foreground">
                  CT1 and Form 11 returns for {profile?.business_name || "your business"}
                </p>
              </div>
              <Calculator className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
          {/* Readiness Score */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Tax Return Readiness
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <Progress value={readinessScore} className="flex-1 h-3" />
                <span className="text-2xl font-bold">{readinessScore}%</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  {onboardingComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={onboardingComplete ? "" : "text-muted-foreground"}>
                    Business setup
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {directorOnboardingComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={directorOnboardingComplete ? "" : "text-muted-foreground"}>
                    Director details ({directorsCompleted}/{directorCount})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Transactions imported</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <span className="text-muted-foreground">Receipts matching</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Deadlines */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {deadlines.map((deadline, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{deadline.name}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(deadline.date)}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(deadline.status)}>
                    {getDaysUntil(deadline.date)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tax Returns Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* CT1 Card */}
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden hover:shadow-xl transition-shadow">
              <CardHeader className="bg-primary/5">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg">CT1 Return</p>
                    <p className="text-sm font-normal text-muted-foreground">Corporation Tax</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Complete the year-end questionnaire to finalise your company's CT1 return for tax year {taxYear}.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tax Year</span>
                    <span className="font-medium">{taxYear}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={ct1Status === "complete" ? "default" : "outline"} className={
                      ct1Status === "complete" ? "bg-green-600" :
                      ct1Status === "in_progress" ? "border-yellow-500 text-yellow-600" : ""
                    }>
                      {ct1Status === "complete" ? "Complete" : ct1Status === "in_progress" ? "In Progress" : "Not Started"}
                    </Badge>
                  </div>
                </div>
                <Button
                  className="w-full mt-6 rounded-xl"
                  onClick={() => setShowCT1Questionnaire(true)}
                >
                  {ct1Status === "not_started" ? "Start" : ct1Status === "in_progress" ? "Continue" : "Review"} CT1 Questionnaire
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
                {ct1Status === "complete" && (
                  <div className="mt-3 space-y-2">
                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => navigate("/tax/ct1")}
                    >
                      View CT1 Results
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                    <div className="flex justify-center">
                      <ExportButtons
                        onPdf={handleCT1Pdf}
                        onExcel={handleCT1Excel}
                      />
                    </div>
                    <div className="flex justify-center">
                      <ExportButtons
                        onPdf={handleAbridgedPdf}
                        onExcel={handleAbridgedExcel}
                        pdfLabel="Abridged PDF"
                        excelLabel="Abridged Excel"
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      CRO Abridged Accounts (s.352)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Form 11 Card */}
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden hover:shadow-xl transition-shadow">
              <CardHeader className="bg-secondary">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-foreground/10 rounded-xl">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-lg">Form 11 Returns</p>
                    <p className="text-sm font-normal text-muted-foreground">Personal Income Tax</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Complete Form 11 questionnaires for each director's personal tax return.
                </p>
                
                {/* Director list */}
                <div className="space-y-2 mb-6">
                  {directorsLoading ? (
                    Array.from({ length: directorCount }, (_, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Skeleton className="w-4 h-4 rounded-full" />
                          <Skeleton className="h-4 w-28" />
                        </div>
                        <Skeleton className="h-8 w-24 rounded-full" />
                      </div>
                    ))
                  ) : (
                    Array.from({ length: directorCount }, (_, i) => i + 1).map((num) => {
                      const parsed = getDirector(num);
                      const name = parsed?.director_name || `Director ${num}`;
                      const completed = parsed?.onboarding_completed;

                      return (
                        <div
                          key={num}
                          className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl"
                        >
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenForm11(num)}
                            disabled={!completed}
                            className="rounded-full"
                          >
                            {completed ? "Start" : "Complete onboarding first"}
                            {completed && <ChevronRight className="w-4 h-4 ml-1" />}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>

                {!directorOnboardingComplete && (
                  <Button 
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => navigate("/onboarding/director")}
                  >
                    Complete Director Onboarding
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>



        </main>
      </div>

      {/* CT1 Questionnaire Dialog */}
      <BusinessBankExportQuestionnaire
        open={showCT1Questionnaire}
        onOpenChange={setShowCT1Questionnaire}
        onComplete={(data) => {
          if (user?.id) {
            // Serialize Date fields to ISO strings for localStorage
            const serialized = {
              ...data,
              automationChangeDate: data.automationChangeDate?.toISOString() ?? null,
              vatStatusChangeDate: data.vatStatusChangeDate?.toISOString() ?? null,
              preliminaryCTDate: data.preliminaryCTDate?.toISOString() ?? null,
            };
            localStorage.setItem(
              `ct1_questionnaire_${user.id}_${taxYear}`,
              JSON.stringify(serialized)
            );
            setCt1SaveCounter((c) => c + 1);
          }
          setShowCT1Questionnaire(false);
        }}
        accountName={profile?.business_name || "Business Account"}
        periodStart={new Date(`${parseInt(taxYear)}-01-01`)}
        periodEnd={new Date(`${parseInt(taxYear)}-12-31`)}
        detectedIncome={ct1.detectedIncome}
        expenseSummary={ct1.expenseSummary}
        detectedPayments={ct1.detectedPayments}
        closingBalance={ct1.closingBalance}
        vatPosition={ct1.vatPosition}
        fixedAssets={[]}
        loans={[]}
        directorsLoanBalance={undefined}
        flaggedCapitalItems={ct1.flaggedCapitalItems}
        rctDeductions={[]}
        isConstructionTrade={ct1.isConstructionTrade}
        isCloseCompany={ct1.isCloseCompany}
        initialValues={savedCT1 ?? undefined}
        reEvaluationApplied={ct1.reEvaluationApplied ?? false}
        reEvaluationWarnings={ct1.reEvaluationWarnings ?? []}
        originalExpenseSummary={ct1.originalExpenseSummary}
        incorporationDate={profile?.incorporation_date}
      />

      {/* Form 11 Questionnaire Dialog */}
      <DirectorExportQuestionnaire
        open={showForm11Questionnaire}
        onOpenChange={setShowForm11Questionnaire}
        onComplete={(data) => {
          // Save questionnaire data for the calculator
          if (user?.id) {
            localStorage.setItem(
              `form11_questionnaire_${user.id}_${selectedDirectorIndex}`,
              JSON.stringify(data)
            );
          }
          setShowForm11Questionnaire(false);
          // Navigate to the Form 11 results page
          navigate(`/tax/form11/${selectedDirectorIndex}`);
        }}
        accountName={getDirector(selectedDirectorIndex)?.director_name || `Director ${selectedDirectorIndex}`}
        taxYear={taxYear}
        detectedIncomeSources={[]}
        linkedBusinesses={[]}
        assumedReliefs={(() => {
          if (!reliefs) return [];
          const items: { relief: string; amount: number }[] = [];
          if (reliefs.medical.total > 0)
            items.push({ relief: "Medical expenses (Section 469)", amount: reliefs.medical.total });
          if (reliefs.healthInsurance.total > 0)
            items.push({ relief: "Health insurance (Section 470)", amount: reliefs.healthInsurance.total });
          if (reliefs.pension.total > 0)
            items.push({ relief: "Pension contributions (Section 774)", amount: reliefs.pension.total });
          if (reliefs.charitable.total > 0)
            items.push({ relief: "Charitable donations (Section 848A)", amount: reliefs.charitable.total });
          if (reliefs.rent.total > 0)
            items.push({ relief: "Rent tax credit (Section 473B)", amount: reliefs.rent.total });
          if (reliefs.tuition.total > 0)
            items.push({ relief: "Tuition fees (Section 473A)", amount: reliefs.tuition.total });
          return items;
        })()}
        detectedSalary={getDirector(selectedDirectorIndex)?.annual_salary ?? undefined}
        detectedDividends={(() => {
          const d = getDirector(selectedDirectorIndex);
          return d?.receives_dividends ? (d?.estimated_dividends ?? undefined) : undefined;
        })()}
        detectedBIK={[]}
        assessmentBasis={(() => {
          const basis = getDirector(selectedDirectorIndex)?.assessment_basis;
          if (basis === "single" || basis === "joint" || basis === "separate") return basis;
          return "single";
        })()}
      />
    </AppLayout>
  );
};

export default TaxCentre;
