import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building, Package, CreditCard, Landmark, AlertTriangle, Loader2, ChevronRight } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useCT1Data } from "@/hooks/useCT1Data";
import { useInvoiceTripMatcher } from "@/hooks/useInvoiceTripMatcher";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { assembleBalanceSheetData, type BalanceSheetInput } from "@/lib/reports/balanceSheetData";
import { generateBalanceSheetPdf } from "@/lib/reports/pdf/balanceSheetPdf";
import { generateBalanceSheetExcel } from "@/lib/reports/excel/balanceSheetExcel";
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

const BalanceSheet = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const ct1 = useCT1Data();
  const { invoiceTrips } = useInvoiceTripMatcher();
  const [travelExpanded, setTravelExpanded] = useState(false);

  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const taxYearStr = String(taxYear);

  // Read saved CT1 questionnaire
  const savedCT1 = useMemo(() => {
    const raw = localStorage.getItem(`ct1_questionnaire_${user?.id}_${taxYearStr}`);
    return raw ? JSON.parse(raw) : null;
  }, [user?.id, taxYearStr]);

  // Build balance sheet input from questionnaire data
  const bsInput = useMemo((): BalanceSheetInput | null => {
    if (!savedCT1) return null;

    const totalIncome = ct1.detectedIncome.reduce((s, i) => s + i.amount, 0);
    // Motor vehicle allowance: prefer auto-calculated from vehicle asset
    const motorVehicleAllowance = ct1.vehicleAsset
      ? ct1.vehicleAsset.depreciation.annualAllowance
      : (savedCT1.capitalAllowancesMotorVehicles ?? 0);
    const capitalAllowancesTotal = (savedCT1.capitalAllowancesPlant ?? 0) + motorVehicleAllowance;
    const tradingProfit = Math.max(
      0,
      totalIncome - ct1.expenseSummary.allowable - capitalAllowancesTotal - ct1.directorsLoanTravel,
    );
    const lossesForward = savedCT1.lossesForward ?? 0;
    const taxableProfit = Math.max(0, tradingProfit - lossesForward);
    const ctLiability = taxableProfit * 0.125 + (savedCT1.closeCompanySurcharge ?? 0);
    const totalExpensesAll = ct1.expenseSummary.allowable + ct1.expenseSummary.disallowed;
    const retainedProfits = totalIncome - totalExpensesAll - ctLiability;

    // Motor vehicles on balance sheet: prefer net book value from vehicle asset
    const motorVehiclesNBV = ct1.vehicleAsset
      ? ct1.vehicleAsset.depreciation.netBookValue
      : (savedCT1.fixedAssetsMotorVehicles ?? 0);

    return {
      landBuildings: savedCT1.fixedAssetsLandBuildings ?? 0,
      plantMachinery: savedCT1.fixedAssetsPlantMachinery ?? 0,
      motorVehicles: motorVehiclesNBV,
      fixturesFittings: savedCT1.fixedAssetsFixturesFittings ?? 0,
      stock: savedCT1.currentAssetsStock ?? 0,
      debtors: savedCT1.currentAssetsDebtors ?? savedCT1.tradeDebtorsTotal ?? 0,
      cash: savedCT1.currentAssetsCash ?? 0,
      bankBalance: savedCT1.currentAssetsBankBalance ?? ct1.closingBalance ?? 0,
      rctPrepayment: ct1.rctPrepayment,
      directorsLoanTravel: ct1.netDirectorsLoan > 0 ? ct1.netDirectorsLoan : 0,
      creditors: savedCT1.liabilitiesCreditors ?? savedCT1.tradeCreditorsTotal ?? 0,
      taxation: ctLiability,
      bankOverdraft: 0,
      bankLoans: savedCT1.liabilitiesBankLoans ?? 0,
      directorsLoans: savedCT1.liabilitiesDirectorsLoans ?? savedCT1.directorsLoanBalance ?? 0,
      shareCapital: savedCT1.shareCapital ?? 100,
      retainedProfits,
    };
  }, [savedCT1, ct1]);

  const getReportMeta = (): ReportMeta => ({
    companyName: profile?.business_name || "Company",
    taxYear: taxYearStr,
    generatedDate: new Date(),
  });

  const handlePdf = () => {
    if (!bsInput) return;
    const data = assembleBalanceSheetData(bsInput, getReportMeta());
    generateBalanceSheetPdf(data);
  };

  const handleExcel = async () => {
    if (!bsInput) return;
    const data = assembleBalanceSheetData(bsInput, getReportMeta());
    await generateBalanceSheetExcel(data);
  };

  // Computed totals
  const fixedAssets = bsInput
    ? bsInput.landBuildings + bsInput.plantMachinery + bsInput.motorVehicles + bsInput.fixturesFittings
    : 0;
  const currentAssets = bsInput ? bsInput.stock + bsInput.debtors + bsInput.cash + bsInput.bankBalance : 0;
  const currentLiabilities = bsInput
    ? bsInput.creditors + bsInput.taxation + bsInput.bankOverdraft + (bsInput.directorsLoanTravel ?? 0)
    : 0;
  const netCurrentAssets = currentAssets - currentLiabilities;
  const longTermLiabilities = bsInput ? bsInput.bankLoans + bsInput.directorsLoans : 0;
  const netAssets = fixedAssets + currentAssets - currentLiabilities - longTermLiabilities;
  const capitalReserves = bsInput ? bsInput.shareCapital + bsInput.retainedProfits : 0;
  const isBalanced = Math.abs(netAssets - capitalReserves) < 0.01;

  if (ct1.isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading balance sheet data...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!bsInput) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            No balance sheet data available. Please complete the CT1 questionnaire first.
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
                <h1 className="font-semibold text-xl">Balance Sheet</h1>
                <p className="text-sm text-muted-foreground">
                  {profile?.business_name || "Company"} &bull; Year ending 31 Dec {taxYearStr}
                </p>
              </div>
              <ExportButtons onPdf={handlePdf} onExcel={handleExcel} />
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* Fixed Assets */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="w-5 h-5 text-primary" />
                Fixed Assets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Row label="Land & Buildings" amount={bsInput.landBuildings} />
              <Row label="Plant & Machinery" amount={bsInput.plantMachinery} />
              <Row label="Motor Vehicles" amount={bsInput.motorVehicles} />
              {ct1.vehicleAsset && (
                <p className="text-xs text-muted-foreground pl-1 pb-1">
                  {ct1.vehicleAsset.description} ({ct1.vehicleAsset.reg}) — Net Book Value after{" "}
                  {ct1.vehicleAsset.depreciation.yearsOwned} yr
                  {ct1.vehicleAsset.depreciation.yearsOwned !== 1 ? "s" : ""} depreciation
                </p>
              )}
              <Row label="Fixtures & Fittings" amount={bsInput.fixturesFittings} />
              <Divider />
              <Row label="Total Fixed Assets" amount={fixedAssets} bold />
            </CardContent>
          </Card>

          {/* Current Assets */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Current Assets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Row label="Stock" amount={bsInput.stock} />
              <Row label="Debtors" amount={bsInput.debtors} />
              <Row label="Cash in Hand" amount={bsInput.cash} />
              <Row label="Bank Balance" amount={bsInput.bankBalance} />
              {bsInput.rctPrepayment > 0 && (
                <>
                  <Row label="RCT Prepayment" amount={bsInput.rctPrepayment} />
                  <p className="text-xs text-muted-foreground pl-1">
                    RCT deducted from subcontractor invoices — offsets CT liability
                  </p>
                </>
              )}
              <Divider />
              <Row label="Total Current Assets" amount={currentAssets} bold />
            </CardContent>
          </Card>

          {/* Current Liabilities */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Current Liabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Row label="Creditors" amount={bsInput.creditors} />
              <Row label="Taxation" amount={bsInput.taxation} />
              {bsInput.bankOverdraft > 0 && <Row label="Bank Overdraft" amount={bsInput.bankOverdraft} />}
              {(bsInput.directorsLoanTravel ?? 0) > 0 && (
                <div>
                  <Row label="Director's Loan" amount={bsInput.directorsLoanTravel} />
                  <button
                    onClick={() => setTravelExpanded(!travelExpanded)}
                    className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors pl-1 py-0.5"
                  >
                    <ChevronRight className={`w-3 h-3 transition-transform ${travelExpanded ? "rotate-90" : ""}`} />
                    <span>Travel — mileage & subsistence owed to director at Revenue rates</span>
                  </button>
                  {travelExpanded && invoiceTrips.length > 0 && (
                    <div className="ml-3 mt-1 mb-2 pl-3 border-l-2 border-primary/20 space-y-1.5">
                      {invoiceTrips
                        .filter((t) => t.directorsLoanBalance > 0)
                        .map((trip) => (
                          <div key={trip.invoiceId} className="text-xs text-muted-foreground">
                            <div className="flex justify-between">
                              <span className="font-medium text-foreground/80">
                                {trip.customerName} — {trip.jobLocation}
                              </span>
                              <span className="font-mono tabular-nums">{eur(trip.directorsLoanBalance)}</span>
                            </div>
                            <div className="flex gap-3 mt-0.5 text-[11px]">
                              {trip.suggestedMileage.allowance > 0 && (
                                <span>Mileage {eur(trip.suggestedMileage.allowance)}</span>
                              )}
                              {trip.suggestedSubsistence.allowance > 0 && (
                                <span>Subsistence {eur(trip.suggestedSubsistence.allowance)}</span>
                              )}
                              {trip.totalExpensesFromCsv > 0 && (
                                <span>Reimbursed ({eur(trip.totalExpensesFromCsv)})</span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
              <Divider />
              <Row label="Total Current Liabilities" amount={currentLiabilities} bold />
            </CardContent>
          </Card>

          {/* Net Current Assets */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardContent className="pt-6 space-y-1">
              <Row label="Total Current Assets" amount={currentAssets} />
              <Row label="Less: Current Liabilities" amount={currentLiabilities} />
              <Divider />
              <Row label="Net Current Assets" amount={netCurrentAssets} bold />
            </CardContent>
          </Card>

          {/* Long-term Liabilities */}
          {longTermLiabilities > 0 && (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-primary" />
                  Long-term Liabilities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {bsInput.bankLoans > 0 && <Row label="Bank Loans" amount={bsInput.bankLoans} />}
                {bsInput.directorsLoans > 0 && <Row label="Directors' Loans" amount={bsInput.directorsLoans} />}
                <Divider />
                <Row label="Total Long-term Liabilities" amount={longTermLiabilities} bold />
              </CardContent>
            </Card>
          )}

          {/* Net Assets + Balance Check */}
          <Card
            className={`border-0 shadow-lg rounded-3xl overflow-hidden ring-2 ${
              isBalanced ? "ring-green-500/30" : "ring-red-500/30"
            }`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Net Assets
                <span
                  className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    isBalanced
                      ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  }`}
                >
                  {isBalanced ? "Balanced" : "Mismatch"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Row label="Fixed Assets" amount={fixedAssets} />
              <Row label="Net Current Assets" amount={netCurrentAssets} />
              {longTermLiabilities > 0 && <Row label="Less: Long-term Liabilities" amount={longTermLiabilities} />}
              <Divider />
              <Row label="Net Assets" amount={netAssets} bold />
            </CardContent>
          </Card>

          {/* Capital & Reserves */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                Capital & Reserves
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Row label="Share Capital" amount={bsInput.shareCapital} />
              <Row label="Retained Profits" amount={bsInput.retainedProfits} />
              <Divider />
              <Row label="Total Capital & Reserves" amount={capitalReserves} bold />
            </CardContent>
          </Card>

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

export default BalanceSheet;
