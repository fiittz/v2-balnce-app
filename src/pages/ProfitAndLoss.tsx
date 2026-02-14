import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTransactions } from "@/hooks/useTransactions";

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

const ProfitAndLoss = () => {
  const navigate = useNavigate();

  // Determine tax year
  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  const { data: incomeTransactions, isLoading: incomeLoading } = useTransactions({
    type: "income",
    startDate,
    endDate,
    accountType: "limited_company",
  });

  const { data: expenseTransactions, isLoading: expenseLoading } = useTransactions({
    type: "expense",
    startDate,
    endDate,
    accountType: "limited_company",
  });

  const isLoading = incomeLoading || expenseLoading;

  // Group income by category — exclude Revenue refunds (not taxable income)
  const incomeByCategory = useMemo(() => {
    const NON_TAXABLE_CATEGORIES = ["Tax Refund"];
    const map = new Map<string, number>();
    for (const t of incomeTransactions ?? []) {
      const catName = (t.category as { id: string; name: string } | null)?.name ?? "Uncategorised";
      if (NON_TAXABLE_CATEGORIES.includes(catName)) continue;
      const desc = (t.description ?? "").toLowerCase();
      if (catName === "Uncategorised" && (desc.includes("revenue") || desc.includes("collector general") || desc.includes("tax refund"))) continue;
      map.set(catName, (map.get(catName) ?? 0) + Math.abs(Number(t.amount) || 0));
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [incomeTransactions]);

  // Group expenses by category
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of expenseTransactions ?? []) {
      const catName = (t.category as { id: string; name: string } | null)?.name ?? "Uncategorised";
      map.set(catName, (map.get(catName) ?? 0) + Math.abs(Number(t.amount) || 0));
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenseTransactions]);

  const totalRevenue = incomeByCategory.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenseByCategory.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const isProfit = netProfit >= 0;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading P&L data...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (totalRevenue === 0 && totalExpenses === 0) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            No transaction data available. Please import bank feeds first.
          </p>
          <Button variant="outline" onClick={() => navigate("/reports")}>
            Back to Reports
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/reports")}
                className="shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1">
                <h1 className="font-semibold text-xl">Profit & Loss</h1>
                <p className="text-sm text-muted-foreground">
                  Tax Year {taxYear} &bull; Limited Company
                </p>
              </div>
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* Revenue */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {incomeByCategory.map((item, i) => (
                <Row key={i} label={item.category} amount={item.amount} />
              ))}
              <Divider />
              <Row label="Total Revenue" amount={totalRevenue} bold />
            </CardContent>
          </Card>

          {/* Operating Expenses */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                Operating Expenses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {expenseByCategory.map((item, i) => (
                <Row key={i} label={item.category} amount={item.amount} />
              ))}
              <Divider />
              <Row label="Total Expenses" amount={totalExpenses} bold />
            </CardContent>
          </Card>

          {/* Net Profit */}
          <Card className={`border-0 shadow-lg rounded-3xl overflow-hidden ring-2 ${
            isProfit ? "ring-green-500/30" : "ring-red-500/30"
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isProfit ? "Net Profit" : "Net Loss"}
                  </p>
                  <p className={`text-3xl font-bold font-mono tabular-nums ${
                    isProfit ? "text-green-600" : "text-red-600"
                  }`}>
                    {eur(Math.abs(netProfit))}
                  </p>
                </div>
                {isProfit ? (
                  <TrendingUp className="w-10 h-10 text-green-600/30" />
                ) : (
                  <TrendingDown className="w-10 h-10 text-red-600/30" />
                )}
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                Revenue {eur(totalRevenue)} &minus; Expenses {eur(totalExpenses)}
              </div>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="text-center text-xs text-muted-foreground py-6">
            <p>Based on categorised transaction data. Review for accuracy.</p>
          </div>
        </main>
      </div>
    </AppLayout>
  );
};

export default ProfitAndLoss;
