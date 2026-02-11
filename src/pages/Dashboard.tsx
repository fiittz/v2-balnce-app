import { useNavigate } from "react-router-dom";
import SparklineChart from "@/components/SparklineChart";
import { FileText, Receipt, Camera, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStats, useIncomeHistory, useExpenseHistory } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import { DashboardWidget } from "@/components/dashboard/DashboardWidget";
import { WidgetCustomizeSheet } from "@/components/dashboard/WidgetCustomizeSheet";
import { DeadlinesWidget } from "@/components/dashboard/DeadlinesWidget";

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: incomeHistory } = useIncomeHistory();
  const { data: expenseHistory } = useExpenseHistory();
  const {
    isLoading: widgetsLoading,
    preferences,
    toggleWidget,
    resetToDefaults,
    isWidgetVisible,
    availableWidgets,
  } = useDashboardWidgets();

  // Calculate VAT progress (rough estimate of period progress)
  const now = new Date();
  const dayOfPeriod = now.getDate() + (now.getMonth() % 2) * 30;
  const vatProgress = Math.min((dayOfPeriod / 60) * 100, 100);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <DashboardWidget widgetId="welcome_hero" isVisible={isWidgetVisible("welcome_hero")} isLoading={widgetsLoading}>
        <div className="bg-gradient-to-br from-foreground to-foreground/90 text-background px-6 py-12 md:py-16">
          <div className="max-w-5xl mx-auto">
            <p className="text-background/70 text-sm font-medium mb-2">Welcome back</p>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {profile?.business_name || "Your Business"}
            </h1>
            <p className="text-background/70">Here's what's happening with your finances</p>
          </div>
        </div>
      </DashboardWidget>

      <main className="max-w-5xl mx-auto px-6 -mt-8">
        {/* Customize button */}
        <div className="flex justify-end mb-4">
          <WidgetCustomizeSheet
            availableWidgets={availableWidgets}
            preferences={preferences}
            onToggle={toggleWidget}
            onReset={resetToDefaults}
          />
        </div>

        {/* Quick Actions */}
        <DashboardWidget widgetId="quick_actions" isVisible={isWidgetVisible("quick_actions")} isLoading={widgetsLoading}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Button
              onClick={() => navigate("/invoice")}
              className="h-14 bg-background text-foreground hover:bg-secondary border border-border rounded-2xl flex items-center justify-center gap-2 text-sm font-medium shadow-lg"
            >
              <FileText className="w-4 h-4" />
              Add Invoice
            </Button>
            <Button
              onClick={() => navigate("/expense")}
              className="h-14 bg-background text-foreground hover:bg-secondary border border-border rounded-2xl flex items-center justify-center gap-2 text-sm font-medium shadow-lg"
            >
              <Receipt className="w-4 h-4" />
              Add Expense
            </Button>
            <Button
              onClick={() => navigate("/scanner")}
              className="h-14 bg-background text-foreground hover:bg-secondary border border-border rounded-2xl flex items-center justify-center gap-2 text-sm font-medium shadow-lg"
            >
              <Camera className="w-4 h-4" />
              Scan Receipt
            </Button>
            <Button
              onClick={() => navigate("/bulk")}
              className="h-14 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl flex items-center justify-center gap-2 text-sm font-medium shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              AI Categorize
            </Button>
          </div>
        </DashboardWidget>

        {/* Main Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pb-12">
          {/* VAT Overview Card */}
          <DashboardWidget widgetId="vat_overview" isVisible={isWidgetVisible("vat_overview")} isLoading={widgetsLoading}>
            <Card
              onClick={() => navigate("/vat")}
              className="lg:col-span-2 cursor-pointer hover:shadow-xl transition-all duration-300 border-0 shadow-lg rounded-3xl overflow-hidden"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-lg">VAT Overview</h2>
                  {statsLoading ? (
                    <Skeleton className="h-4 w-24" />
                  ) : (
                    <span className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                      Next: {stats?.vat.dueDate}
                    </span>
                  )}
                </div>
                <Progress value={vatProgress} className="h-2 mb-6 rounded-full" />
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">VAT Collected</p>
                    {statsLoading ? (
                      <Skeleton className="h-9 w-28" />
                    ) : (
                      <p className="text-3xl font-bold">{formatCurrency(stats?.vat.onSales || 0)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">VAT Paid</p>
                    {statsLoading ? (
                      <Skeleton className="h-9 w-28" />
                    ) : (
                      <p className="text-3xl font-bold">{formatCurrency(stats?.vat.onPurchases || 0)}</p>
                    )}
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-1">
                    Net VAT {(stats?.vat.net || 0) >= 0 ? "Owed" : "Refund"}
                  </p>
                  {statsLoading ? (
                    <Skeleton className="h-11 w-36" />
                  ) : (
                    <p className={`text-4xl font-bold ${(stats?.vat.net || 0) >= 0 ? "text-primary" : "text-green-600"}`}>
                      {formatCurrency(Math.abs(stats?.vat.net || 0))}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </DashboardWidget>

          {/* Income Card */}
          <DashboardWidget widgetId="income_summary" isVisible={isWidgetVisible("income_summary")} isLoading={widgetsLoading}>
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-1">Income</h3>
                {statsLoading ? (
                  <Skeleton className="h-9 w-24 mb-4" />
                ) : (
                  <p className="text-3xl font-bold mb-4">{formatCurrency(stats?.income.total || 0)}</p>
                )}
                <SparklineChart
                  data={incomeHistory || [0, 0, 0, 0, 0, 0, 0]}
                  color="hsl(142, 76%, 36%)"
                  className="w-full h-12"
                />
                <p className="text-sm text-muted-foreground mt-3">
                  {stats?.income.count || 0} invoices this period
                </p>
              </CardContent>
            </Card>
          </DashboardWidget>

          {/* Expenses Card */}
          <DashboardWidget widgetId="expenses_summary" isVisible={isWidgetVisible("expenses_summary")} isLoading={widgetsLoading}>
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-1">Expenses</h3>
                {statsLoading ? (
                  <Skeleton className="h-9 w-24 mb-4" />
                ) : (
                  <p className="text-3xl font-bold mb-4">{formatCurrency(stats?.expenses.total || 0)}</p>
                )}
                <SparklineChart
                  data={expenseHistory || [0, 0, 0, 0, 0, 0, 0]}
                  color="hsl(0, 84%, 60%)"
                  className="w-full h-12"
                />
                <p className="text-sm text-muted-foreground mt-3">
                  {stats?.expenses.count || 0} expenses this period
                </p>
              </CardContent>
            </Card>
          </DashboardWidget>
          {/* Deadlines Widget */}
          <DashboardWidget widgetId="tax_deadlines" isVisible={isWidgetVisible("tax_deadlines")} isLoading={widgetsLoading}>
            <DeadlinesWidget />
          </DashboardWidget>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
