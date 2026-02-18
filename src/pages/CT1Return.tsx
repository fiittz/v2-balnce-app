import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Receipt,
  Wrench,
  Calculator,
  TrendingUp,
  AlertTriangle,
  Loader2,
  FileText,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useCT1Data } from "@/hooks/useCT1Data";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { assembleCT1ReportData } from "@/lib/reports/ct1ReportData";
import { generateCT1Pdf } from "@/lib/reports/pdf/ct1Pdf";
import { generateCT1Excel } from "@/lib/reports/excel/ct1Excel";
import type { ReportMeta } from "@/lib/reports/types";

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

function Divider() {
  return <div className="border-t my-2" />;
}

const CT1Return = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const taxYearStr = String(taxYear);

  // Read saved CT1 questionnaire
  const savedCT1 = useMemo(() => {
    const raw = localStorage.getItem(`ct1_questionnaire_${user?.id}_${taxYearStr}`);
    return raw ? JSON.parse(raw) : null;
  }, [user?.id, taxYearStr]);

  // Pass VAT re-evaluation options from questionnaire
  const ct1 = useCT1Data(
    savedCT1?.vatStatusChangeDate
      ? {
          vatChangeDate: savedCT1.vatStatusChangeDate,
          vatStatusBefore: savedCT1.vatStatus === "not_registered" ? "not_registered" : undefined,
          vatStatusAfter: savedCT1.vatStatus,
        }
      : undefined,
  );

  const getReportMeta = (): ReportMeta => ({
    companyName: profile?.business_name || "Company",
    taxYear: taxYearStr,
    generatedDate: new Date(),
  });

  const handlePdf = () => {
    const data = assembleCT1ReportData(ct1, savedCT1, getReportMeta());
    generateCT1Pdf(data);
  };

  const handleExcel = async () => {
    const data = assembleCT1ReportData(ct1, savedCT1, getReportMeta());
    await generateCT1Excel(data);
  };

  // Computed values
  const totalIncome = ct1.detectedIncome.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = ct1.expenseByCategory.reduce((s, e) => s + e.amount, 0);
  // Motor vehicle allowance: prefer auto-calculated from vehicle asset, fallback to questionnaire
  const motorVehicleAllowance = ct1.vehicleAsset
    ? ct1.vehicleAsset.depreciation.annualAllowance
    : (savedCT1?.capitalAllowancesMotorVehicles ?? 0);
  const capitalAllowancesTotal = (savedCT1?.capitalAllowancesPlant ?? 0) + motorVehicleAllowance;
  const tradingProfit = Math.max(
    0,
    totalIncome - ct1.expenseSummary.allowable - capitalAllowancesTotal - ct1.directorsLoanTravel,
  );
  const lossesForward = savedCT1?.lossesForward ?? 0;
  const taxableProfit = Math.max(0, tradingProfit - lossesForward);
  const ctAt125 = taxableProfit * 0.125;
  const surcharge = savedCT1?.closeCompanySurcharge ?? 0;
  const totalCT = ctAt125 + surcharge;
  const prelimPaid = savedCT1?.preliminaryCTPaid ?? 0;
  const rctCredit = ct1.rctPrepayment;
  const balanceDue = totalCT - prelimPaid - rctCredit;

  if (ct1.isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading CT1 data...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (totalIncome === 0 && totalExpenses === 0) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            No transaction data available. Please import bank feeds and complete the CT1 questionnaire first.
          </p>
          <Button variant="outline" onClick={() => navigate("/tax")}>
            Back to Tax Centre
          </Button>
        </div>
      </AppLayout>
    );
  }

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
                <h1 className="font-semibold text-xl">CT1 Return — {profile?.business_name || "Company"}</h1>
                <p className="text-sm text-muted-foreground">Tax Year {taxYearStr} &bull; Corporation Tax</p>
              </div>
              <ExportButtons onPdf={handlePdf} onExcel={handleExcel} />
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* Re-evaluation Warning */}
          {ct1.reEvaluationApplied && (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-yellow-800 dark:text-yellow-200">
                      VAT Re-evaluation Applied
                    </p>
                    {ct1.reEvaluationWarnings.map((w, i) => (
                      <p key={i} className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        {w}
                      </p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trading Income */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Trading Income
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {ct1.detectedIncome.map((item, i) => (
                <Row key={i} label={item.category} amount={item.amount} />
              ))}
              <Divider />
              <Row label="Total Income" amount={totalIncome} bold />
            </CardContent>
          </Card>

          {/* Expense Breakdown */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                Expense Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {ct1.expenseByCategory.map((item, i) => (
                <Row key={i} label={item.category} amount={item.amount} />
              ))}
              <Divider />
              <Row label="Total Expenses" amount={totalExpenses} bold />
              <div className="pt-2 space-y-1">
                <Row label="Allowable" amount={ct1.expenseSummary.allowable} />
                <Row label="Disallowed" amount={ct1.expenseSummary.disallowed} />
              </div>
            </CardContent>
          </Card>

          {/* Capital Allowances */}
          {capitalAllowancesTotal > 0 && (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-primary" />
                  Capital Allowances
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {(savedCT1?.capitalAllowancesPlant ?? 0) > 0 && (
                  <Row label="Plant & Machinery" amount={savedCT1.capitalAllowancesPlant} />
                )}
                {motorVehicleAllowance > 0 && <Row label="Motor Vehicles" amount={motorVehicleAllowance} />}
                {ct1.vehicleAsset && (
                  <div className="text-xs text-muted-foreground pl-1 pb-1 space-y-0.5">
                    <p>
                      {ct1.vehicleAsset.description} ({ct1.vehicleAsset.reg})
                    </p>
                    <p>
                      12.5% of {eur(ct1.vehicleAsset.depreciation.qualifyingCost)}
                      {ct1.vehicleAsset.depreciation.businessUsePct < 100 &&
                        ` × ${ct1.vehicleAsset.depreciation.businessUsePct}% business use`}{" "}
                      — Year {ct1.vehicleAsset.depreciation.yearsOwned} of 8
                      {ct1.vehicleAsset.depreciation.fullyDepreciated && " (fully depreciated)"}
                    </p>
                    <p>Net Book Value: {eur(ct1.vehicleAsset.depreciation.netBookValue)}</p>
                  </div>
                )}
                <Divider />
                <Row label="Total Capital Allowances" amount={capitalAllowancesTotal} bold />
              </CardContent>
            </Card>
          )}

          {/* CT Computation */}
          <Card
            className={`border-0 shadow-lg rounded-3xl overflow-hidden ring-2 ${
              balanceDue <= 0 ? "ring-green-500/30" : "ring-primary/20"
            }`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                CT Computation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Row label="Total Income" amount={totalIncome} />
              <Row label="Less: Allowable Expenses" amount={ct1.expenseSummary.allowable} />
              {ct1.directorsLoanTravel > 0 && (
                <Row label="Less: Travel & Accommodation (owed to director)" amount={ct1.directorsLoanTravel} />
              )}
              {capitalAllowancesTotal > 0 && <Row label="Less: Capital Allowances" amount={capitalAllowancesTotal} />}
              <Divider />
              <Row label="Trading Profit" amount={tradingProfit} bold />
              {lossesForward > 0 && <Row label="Less: Losses B/F" amount={lossesForward} />}
              <Row label="Taxable Profit" amount={taxableProfit} bold />
              <Divider />
              <Row label="CT @ 12.5% (trading)" amount={ctAt125} />
              {surcharge > 0 && <Row label="Close Company Surcharge" amount={surcharge} />}
              <Row label="Total CT Liability" amount={totalCT} bold />
              {rctCredit > 0 && <Row label="Less: RCT Credit" amount={rctCredit} />}
              {prelimPaid > 0 && (
                <>
                  <Row label="Less: Preliminary CT Paid" amount={prelimPaid} />
                  <div className="border-t-2 border-foreground/20 mt-3 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-base">{balanceDue <= 0 ? "Refund Due" : "Balance Due"}</span>
                      <span
                        className={`font-semibold text-lg font-mono tabular-nums ${
                          balanceDue <= 0 ? "text-green-600" : "text-destructive"
                        }`}
                      >
                        {eur(Math.abs(balanceDue))}
                      </span>
                    </div>
                  </div>
                </>
              )}
              {prelimPaid === 0 && (
                <div className="border-t-2 border-foreground/20 mt-3 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-base">{balanceDue <= 0 ? "Refund Due" : "Total CT Due"}</span>
                    <span
                      className={`font-semibold text-lg font-mono tabular-nums ${
                        balanceDue <= 0 ? "text-green-600" : "text-destructive"
                      }`}
                    >
                      {eur(Math.abs(balanceDue))}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* VAT Position */}
          {ct1.vatPosition && (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  VAT Position
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Row
                  label={ct1.vatPosition.type === "payable" ? "VAT Payable" : "VAT Refundable"}
                  amount={ct1.vatPosition.amount}
                  bold
                />
              </CardContent>
            </Card>
          )}

          {/* Flagged Capital Items */}
          {ct1.flaggedCapitalItems.length > 0 && (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Flagged Capital Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">
                  Items &ge; &euro;1,000 or classified as capital expenditure. Review for correct capitalisation.
                </p>
                {ct1.flaggedCapitalItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <div>
                      <span>{item.description}</span>
                      <span className="text-muted-foreground ml-2">{item.date}</span>
                    </div>
                    <span className="font-mono tabular-nums">{eur(item.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
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

export default CT1Return;
