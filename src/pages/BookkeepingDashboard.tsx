import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Upload,
  FileText,
  Receipt,
  Euro,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransactions, useUnmatchedTransactions } from "@/hooks/useTransactions";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import { SalesTaxAuditExport } from "@/components/reports/SalesTaxAuditExport";
import AppLayout from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { OnboardingProgressCard } from "@/components/dashboard/OnboardingProgressCard";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import { DashboardWidget } from "@/components/dashboard/DashboardWidget";
import { WidgetCustomizeSheet } from "@/components/dashboard/WidgetCustomizeSheet";
import { DeadlinesWidget } from "@/components/dashboard/DeadlinesWidget";

const BookkeepingDashboard = () => {
  const navigate = useNavigate();
  const { data: transactions = [] } = useTransactions({ limit: 500 });
  const { data: unmatchedTransactions = [] } = useUnmatchedTransactions();
  const { data: onboarding } = useOnboardingSettings();
  const {
    isLoading: widgetsLoading,
    preferences,
    toggleWidget,
    resetToDefaults,
    isWidgetVisible,
    availableWidgets,
  } = useDashboardWidgets();

  const [accounts, setAccounts] = useState<{
    id: string;
    name: string;
    description?: string;
  }[]>([
    { id: "business-account", name: "Business Account", description: "Upload your main business bank CSV here." },
  ]);

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleStartEditAccount = (id: string, currentName: string) => {
    setEditingAccountId(id);
    setEditingName(currentName);
  };

  const handleSaveAccountName = () => {
    if (!editingAccountId) return;
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingAccountId(null);
      setEditingName("");
      return;
    }
    setAccounts((prev) => prev.map((acc) => (acc.id === editingAccountId ? { ...acc, name: trimmed } : acc)));
    setEditingAccountId(null);
    setEditingName("");
  };

  const handleAddAccount = () => {
    const newId = `account-${Date.now()}`;
    const newAccount = { id: newId, name: "New Account", description: "" };
    setAccounts((prev) => [...prev, newAccount]);
    setEditingAccountId(newId);
    setEditingName("New Account");
  };

  const handleUploadForAccount = (accountName: string) => {
    const params = new URLSearchParams({ account: accountName });
    navigate(`/bank?${params.toString()}`);
  };

  const isVatRegistered = onboarding?.vat_registered ?? true;
  const isRctIndustry = ["construction", "forestry", "meat_processing", "carpentry_joinery", "electrical", "plumbing_heating"].includes(
    onboarding?.business_type || "",
  );
  const showRctCards = isRctIndustry && onboarding?.rct_registered;

  const uncategorisedCount = useMemo(
    () =>
      transactions.filter((t: any) => {
        // Count transactions without a category as needing review
        return !t.category_id;
      }).length,
    [transactions],
  );

  const incomeVsExpenses = useMemo(() => {
    const byMonth = new Map<string, { income: number; expenses: number }>();
    (transactions as any[]).forEach((t) => {
      if (!t.transaction_date) return;
      const month = String(t.transaction_date).slice(0, 7);
      const entry = byMonth.get(month) || { income: 0, expenses: 0 };
      if (t.type === "income") {
        entry.income += Number(t.amount) || 0;
      } else {
        entry.expenses += Number(t.amount) || 0;
      }
      byMonth.set(month, entry);
    });
    return Array.from(byMonth.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-6);
  }, [transactions]);

  const autoCatStats = useMemo(() => {
    const total = transactions.length;
    if (!total) return { autoPercent: 0, flagged: 0 };
    const categorized = transactions.filter((t: any) => t.category_id).length;
    const uncategorized = transactions.filter((t: any) => !t.category_id).length;
    return {
      autoPercent: Math.round((categorized / total) * 100),
      flagged: uncategorized,
    };
  }, [transactions]);

  const constructionStats = useMemo(() => {
    if (!isRctIndustry) {
      return null;
    }

    let materials = 0;
    let labour = 0;
    let subcontractors = 0;
    let fuel = 0;

    (transactions as any[]).forEach((t) => {
      if (t.type !== "expense") return;
      const amount = Number(t.amount) || 0;
      const catName = (t.category?.name || "").toLowerCase();

      if (catName.includes("material")) {
        materials += amount;
      } else if (catName.includes("labour") || catName.includes("wage") || catName.includes("salary")) {
        labour += amount;
      } else if (catName.includes("subcontractor") || catName.includes("sub-contractor")) {
        subcontractors += amount;
      } else if (catName.includes("fuel") || catName.includes("transport") || catName.includes("motor")) {
        fuel += amount;
      }
    });

    const totalJobCost = materials + labour + subcontractors;

    return {
      materials,
      labour,
      subcontractors,
      fuel,
      totalJobCost,
    };
  }, [isRctIndustry, transactions]);

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-secondary">
        {/* Top bar */}
        <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="w-24" />
            <div className="flex-1 text-center">
              <h1 className="font-semibold text-xl">Dashboard</h1>
            </div>
            <div className="w-24 flex justify-end gap-2">
              <WidgetCustomizeSheet
                availableWidgets={availableWidgets}
                preferences={preferences}
                onToggle={toggleWidget}
                onReset={resetToDefaults}
              />
              <button className="p-2 rounded-full hover:bg-muted">
                <Bell className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 px-6 py-6 space-y-6 overflow-y-auto">
          {/* Onboarding Progress Card - shows if setup incomplete */}
          <OnboardingProgressCard />

          {/* Top cards grid */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {/* Bank Feed Status */}
            <DashboardWidget widgetId="bank_feed_status" isVisible={isWidgetVisible("bank_feed_status")} isLoading={widgetsLoading}>
            <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Bank feed</p>
                  <h2 className="text-base font-semibold">Business Accounts</h2>
                </div>
                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Live</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center">
                  <Euro className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium">Connected banks</p>
                  <p className="text-xs text-muted-foreground">
                    {transactions.length ? "Latest balances synced" : "Connect and import a CSV to get started"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-1 w-fit rounded-xl text-xs"
                onClick={() => navigate("/bank")}
              >
                View Transactions
              </Button>
            </div>
            </DashboardWidget>

          {/* Uncategorised Transactions */}
          <DashboardWidget widgetId="uncategorised_transactions" isVisible={isWidgetVisible("uncategorised_transactions")} isLoading={widgetsLoading}>
          <div className="bg-card rounded-2xl p-5 card-shadow flex flex-col gap-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Review</p>
            <h2 className="text-base font-semibold">Transactions to Review</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{uncategorisedCount}</span>
              <span className="text-xs text-muted-foreground">need attention</span>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {(transactions as any[])
                .filter((t) => !t.category_id)
                .slice(0, 3)
                .map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between border rounded-xl px-2 py-1"
                  >
                    <span className="truncate max-w-[60%]">{t.description}</span>
                    <span className="font-medium">
                      €{Number(t.amount || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              {!transactions.length && <p>No transactions yet. Import a CSV to get started.</p>}
            </div>
            <Button
              size="sm"
              className="mt-1 w-fit rounded-xl bg-foreground text-background hover:bg-foreground/90 text-xs"
              onClick={() => navigate("/bank")}
            >
              Review Now
            </Button>
          </div>
          </DashboardWidget>

          {/* VAT Position */}
          <DashboardWidget widgetId="vat_overview" isVisible={isWidgetVisible("vat_overview")} isLoading={widgetsLoading}>
          <div className="bg-card rounded-2xl p-5 card-shadow flex flex-col gap-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">VAT</p>
            <h2 className="text-base font-semibold">VAT Position</h2>
            {isVatRegistered ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT on Sales</span>
                  <span className="font-medium">€0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT on Purchases</span>
                  <span className="font-medium">€0.00</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-1">
                  <span className="font-medium">Net VAT</span>
                  <span className="font-bold">€0.00</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-fit rounded-xl text-xs"
                  onClick={() => navigate("/vat")}
                >
                  Open VAT Report
                </Button>
              </div>
            ) : (
              <div className="bg-primary/20 rounded-xl px-3 py-2 text-xs text-foreground">
                You're not VAT-registered — no VAT tracking needed.
              </div>
            )}
          </div>
          </DashboardWidget>

          {/* RCT Position - only for RCT industries */}
          {showRctCards && (
            <DashboardWidget widgetId="rct_overview" isVisible={isWidgetVisible("rct_overview")} isLoading={widgetsLoading}>
            <div className="bg-card rounded-2xl p-5 card-shadow flex flex-col gap-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">RCT</p>
              <h2 className="text-base font-semibold">RCT Overview</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RCT withheld</span>
                  <span className="font-medium">€0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RCT to pay</span>
                  <span className="font-medium">€0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reverse charge applied</span>
                  <span className="font-medium">0 invoices</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-fit rounded-xl text-xs"
                  onClick={() => navigate("/rct")}
                >
                  Open RCT Centre
                </Button>
              </div>
            </div>
            </DashboardWidget>
          )}

          {/* Pending Tasks */}
          <DashboardWidget widgetId="pending_tasks" isVisible={isWidgetVisible("pending_tasks")} isLoading={widgetsLoading}>
          <div className="bg-card rounded-2xl p-5 card-shadow flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tasks</p>
                <h2 className="text-base font-semibold">Pending Tasks</h2>
              </div>
              <span className="px-2 py-1 rounded-full bg-primary text-xs text-primary-foreground">
                {uncategorisedCount + (unmatchedTransactions?.length || 0)} items
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                <span>{uncategorisedCount} transactions need review</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-3 h-3 text-muted-foreground" />
                <span>{unmatchedTransactions?.length || 0} receipts/unmatched items</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-3 h-3 text-muted-foreground" />
                <span>VAT/RCT returns and reports coming soon</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-1 w-fit rounded-xl text-xs"
              onClick={() => navigate("/tasks")}
            >
              Open Tasks
            </Button>
          </div>
          </DashboardWidget>

          {/* Deadlines */}
          <DashboardWidget widgetId="tax_deadlines" isVisible={isWidgetVisible("tax_deadlines")} isLoading={widgetsLoading}>
            <DeadlinesWidget />
          </DashboardWidget>
        </div>

        {/* Construction-specific widgets */}
        {isRctIndustry && constructionStats && (
          <DashboardWidget widgetId="construction_materials_labour" isVisible={isWidgetVisible("construction_materials_labour")} isLoading={widgetsLoading}>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Materials vs Labour split */}
            <div className="bg-card rounded-2xl p-5 card-shadow flex flex-col gap-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Materials vs Labour</h2>
                <span className="text-xs text-muted-foreground">Construction snapshot</span>
              </div>
              {constructionStats.totalJobCost > 0 ? (
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Materials</span>
                    <span className="font-medium">
                      €{constructionStats.materials.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Labour</span>
                    <span className="font-medium">
                      €{constructionStats.labour.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subcontractors</span>
                    <span className="font-medium">
                      €{constructionStats.subcontractors.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 mt-1">
                    <span className="font-medium">Total job costs</span>
                    <span className="font-bold">
                      €{constructionStats.totalJobCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
                  Once you categorise expenses as Materials, Labour, Subcontractors and Fuel, we'll show
                  your job cost mix here.
                </div>
              )}
            </div>

            {/* Fuel usage indicator */}
            <div className="bg-card rounded-2xl p-5 card-shadow flex flex-col gap-3">
              <h2 className="text-base font-semibold">Fuel usage</h2>
              {constructionStats.fuel > 0 ? (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Fuel spend (YTD)</span>
                    <span className="font-medium">
                      €{constructionStats.fuel.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fuel is automatically detected from your bank feed using DCI and garage rules.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  We'll highlight fuel spend here once fuel transactions are imported and categorised.
                </p>
              )}
            </div>
          </div>
          </DashboardWidget>
        )}

        {/* Charts and automation row */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Income vs Expenses chart placeholder */}
          <DashboardWidget widgetId="income_vs_expenses_chart" isVisible={isWidgetVisible("income_vs_expenses_chart")} isLoading={widgetsLoading}>
          <div className="bg-card rounded-2xl p-5 card-shadow md:col-span-2 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Income vs Expenses</h2>
              <span className="text-xs text-muted-foreground">Last {incomeVsExpenses.length} months</span>
            </div>
            {incomeVsExpenses.length ? (
              <div className="flex gap-4 items-end h-40">
                {incomeVsExpenses.map(([month, values]) => {
                  const maxVal = Math.max(values.income, values.expenses, 1);
                  const incomeHeight = (values.income / maxVal) * 100;
                  const expenseHeight = (values.expenses / maxVal) * 100;
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex items-end gap-1 w-full">
                        <div
                          className="flex-1 bg-foreground rounded-t-md"
                          style={{ height: `${incomeHeight}%` }}
                        />
                        <div
                          className="flex-1 bg-primary rounded-t-md"
                          style={{ height: `${expenseHeight}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{month}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
                No data yet. Import a CSV to see monthly trends.
              </div>
            )}
          </div>
          </DashboardWidget>

          {/* Automation Insights */}
          <DashboardWidget widgetId="automation_insights" isVisible={isWidgetVisible("automation_insights")} isLoading={widgetsLoading}>
          <div className="bg-card rounded-2xl p-5 card-shadow flex flex-col gap-3">
            <h2 className="text-base font-semibold">Automation Insights</h2>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span>{autoCatStats.autoPercent}% of your transactions auto-categorised</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span>VAT rules ready based on your onboarding</span>
              </div>
              {showRctCards && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span>RCT logic enabled for your sector</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                <span>{autoCatStats.flagged} unusual / flagged transactions</span>
              </div>
            </div>
          </div>
          </DashboardWidget>
        </div>

          {/* Quick Uploads */}
          <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Quick uploads</h2>
              <p className="text-xs text-muted-foreground">
                Upload CSV files or scan receipts. Drag & drop files here too.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                className="rounded-xl bg-black text-white hover:bg-black/90 flex items-center gap-2"
                onClick={() => navigate("/upload/csv")}
              >
                <Upload className="w-4 h-4" />
                Upload CSV
              </Button>
              <Button className="rounded-xl bg-[#F2C300] text-black hover:bg-[#e3b600] flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Scan Receipt
              </Button>
            </div>
          </div>
        </main>
      </div>
    </AppLayout>
  );
};

export default BookkeepingDashboard;
