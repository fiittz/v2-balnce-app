import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Briefcase,
  Building,
  Receipt,
  Shield,
  TrendingUp,
  AlertTriangle,
  Info,
  ChevronDown,
  Loader2,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForm11Data } from "@/hooks/useForm11Data";
import { useAuth } from "@/hooks/useAuth";
import { useCT1Data } from "@/hooks/useCT1Data";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { assembleForm11ReportData } from "@/lib/reports/form11ReportData";
import { generateForm11Pdf } from "@/lib/reports/pdf/form11Pdf";
import { generateForm11Excel } from "@/lib/reports/excel/form11Excel";
import type { ReportMeta } from "@/lib/reports/types";
import type { TaxBandLine, CreditLine } from "@/lib/form11Calculator";

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);

function Row({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  const cls = bold ? "font-semibold" : "";
  return (
    <div className={`flex items-center justify-between py-1.5 ${cls}`}>
      <span className="text-sm">{label}</span>
      <span className="text-sm font-mono tabular-nums">{eur(amount)}</span>
    </div>
  );
}

function BandRow({ band }: { band: TaxBandLine }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">
        {eur(band.amount)} @ {(band.rate * 100).toFixed(0)}%
      </span>
      <span className="text-sm font-mono tabular-nums">{eur(band.tax)}</span>
    </div>
  );
}

function CreditRow({ credit }: { credit: CreditLine }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{credit.label}</span>
      <span className="text-sm font-mono tabular-nums">{eur(credit.amount)}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t my-2" />;
}

const Form11Return = () => {
  const { directorNumber } = useParams<{ directorNumber: string }>();
  const navigate = useNavigate();
  const dirNum = parseInt(directorNumber ?? "1", 10);

  const { result, input, isLoading, taxYear } = useForm11Data(dirNum);
  const { profile } = useAuth();
  const ct1 = useCT1Data();

  const getReportMeta = (): ReportMeta => ({
    companyName: profile?.business_name || "Company",
    taxYear: String(taxYear),
    generatedDate: new Date(),
  });

  const handlePdf = () => {
    if (!input || !result) return;
    const data = assembleForm11ReportData(input, result, getReportMeta(), {
      expenseByCategory: ct1.expenseByCategory,
      incomeByCategory: ct1.detectedIncome,
    });
    generateForm11Pdf(data);
  };

  const handleExcel = async () => {
    if (!input || !result) return;
    const data = assembleForm11ReportData(input, result, getReportMeta(), {
      expenseByCategory: ct1.expenseByCategory,
      incomeByCategory: ct1.detectedIncome,
    });
    await generateForm11Excel(data);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Calculating tax position...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!result || !input) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            No data available. Please complete director onboarding and the Form 11 questionnaire first.
          </p>
          <Button variant="outline" onClick={() => navigate("/tax")}>
            Back to Tax Centre
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isRefund = result.balanceDue < 0;

  return (
    <AppLayout>
      <div className="flex-1">
        {/* Header */}
        <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/tax")} className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1">
                <h1 className="font-semibold text-xl">Form 11 — {input.directorName}</h1>
                <p className="text-sm text-muted-foreground">
                  Tax Year {taxYear} &bull; PPS {input.ppsNumber || "Not provided"}
                </p>
              </div>
              <ExportButtons onPdf={handlePdf} onExcel={handleExcel} disabled={!result} />
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* ── Split-Year Warning ────────────────────────── */}
          {result.splitYearApplied && (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-yellow-800 dark:text-yellow-200">
                      Split-Year Assessment Applied
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{result.splitYearNote}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── 1. Income Summary ────────────────────────── */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Income Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {result.scheduleE > 0 && <Row label="Schedule E (employment)" amount={result.scheduleE} />}
              {result.scheduleD > 0 && <Row label="Schedule D (business)" amount={result.scheduleD} />}
              {result.rentalProfit > 0 && <Row label="Rental profit" amount={result.rentalProfit} />}
              {result.foreignIncome > 0 && <Row label="Foreign income" amount={result.foreignIncome} />}
              {result.otherIncome > 0 && <Row label="Other income" amount={result.otherIncome} />}
              {result.spouseIncome > 0 && <Row label="Spouse income (joint)" amount={result.spouseIncome} />}
              <Divider />
              <Row label="Total Gross Income" amount={result.totalGrossIncome} bold />
            </CardContent>
          </Card>

          {/* ── 2. Deductions ────────────────────────────── */}
          {result.totalDeductions > 0 && (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  Deductions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">
                    Pension relief ({(result.pensionAgeLimit * 100).toFixed(0)}% age-based limit)
                  </span>
                  <span className="text-sm font-mono tabular-nums">{eur(result.pensionRelief)}</span>
                </div>
                <Divider />
                <Row label="Assessable Income" amount={result.assessableIncome} bold />
              </CardContent>
            </Card>
          )}

          {/* ── 3. Income Tax ────────────────────────────── */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="w-5 h-5 text-primary" />
                Income Tax Calculation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {result.incomeTaxBands.map((band, i) => (
                <BandRow key={i} band={band} />
              ))}
              <Divider />
              <Row label="Gross Income Tax" amount={result.grossIncomeTax} bold />
            </CardContent>
          </Card>

          {/* ── 4. Tax Credits ───────────────────────────── */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Tax Credits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {result.credits.map((c, i) => (
                <CreditRow key={i} credit={c} />
              ))}
              <Divider />
              <Row label="Total Credits" amount={result.totalCredits} bold />
              <Row label="Net Income Tax" amount={result.netIncomeTax} bold />
            </CardContent>
          </Card>

          {/* ── 5. USC ───────────────────────────────────── */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Universal Social Charge
              </CardTitle>
              {result.uscExempt && (
                <Badge variant="secondary" className="w-fit">
                  Exempt
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-1">
              {result.uscExempt ? (
                <p className="text-sm text-muted-foreground py-2">Total income below €13,000 — USC does not apply.</p>
              ) : (
                <>
                  {result.uscBands.map((band, i) => (
                    <BandRow key={i} band={band} />
                  ))}
                  <Divider />
                  <Row label="Total USC" amount={result.totalUSC} bold />
                </>
              )}
            </CardContent>
          </Card>

          {/* ── 6. PRSI ──────────────────────────────────── */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                PRSI (Class S)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Row label="Assessable income" amount={result.prsiAssessable} />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-muted-foreground">
                  {result.prsiAssessable >= 5000 ? "4.1% of assessable income" : "Below €5,000 threshold"}
                </span>
                <span className="text-sm font-mono tabular-nums">{eur(result.prsiCalculated)}</span>
              </div>
              <Divider />
              <Row label="PRSI Payable" amount={result.prsiPayable} bold />
            </CardContent>
          </Card>

          {/* ── 7. CGT (conditional) ─────────────────────── */}
          {result.cgtApplicable && (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Capital Gains Tax
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Row label="Total gains" amount={result.cgtGains} />
                {result.cgtLosses > 0 && <Row label="Less: Losses" amount={-result.cgtLosses} />}
                <Row label="Less: Annual exemption" amount={-result.cgtExemption} />
                <Divider />
                <Row label="CGT Payable (33%)" amount={result.cgtPayable} bold />
              </CardContent>
            </Card>
          )}

          {/* ── 8. Summary ───────────────────────────────── */}
          <Card
            className={`border-0 shadow-lg rounded-3xl overflow-hidden ${
              isRefund ? "ring-2 ring-green-500/30" : "ring-2 ring-primary/20"
            }`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Tax Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Row label="Net Income Tax" amount={result.netIncomeTax} />
              <Row label="USC" amount={result.totalUSC} />
              <Row label="PRSI" amount={result.prsiPayable} />
              {result.cgtApplicable && <Row label="CGT" amount={result.cgtPayable} />}
              <Divider />
              <Row label="Total Liability" amount={result.totalLiability} bold />

              {result.preliminaryTaxPaid > 0 && (
                <Row label="Less: Preliminary tax paid" amount={-result.preliminaryTaxPaid} />
              )}

              <div className="border-t-2 border-foreground/20 mt-3 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-base">{isRefund ? "Refund Due" : "Balance Due"}</span>
                  <span
                    className={`font-semibold text-lg font-mono tabular-nums ${
                      isRefund ? "text-green-600" : "text-destructive"
                    }`}
                  >
                    {eur(Math.abs(result.balanceDue))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── 9. Warnings & Notes ──────────────────────── */}
          {(result.warnings.length > 0 || result.notes.length > 0) && (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  Warnings & Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
                {result.notes.map((n, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <span>{n}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── 10. Disclaimer ───────────────────────────── */}
          <div className="text-center text-xs text-muted-foreground py-6 space-y-1">
            <p>AI-generated calculations require professional review.</p>
            <p>
              Verify current rates at{" "}
              <a href="https://www.revenue.ie" target="_blank" rel="noopener noreferrer" className="underline">
                Revenue.ie
              </a>
            </p>
          </div>
        </main>
      </div>
    </AppLayout>
  );
};

export default Form11Return;
