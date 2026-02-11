import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Wallet, BarChart3, FileText, Scale, Download, Printer, ChevronDown, ChevronRight, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import AppLayout from "@/components/layout/AppLayout";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useInvoiceTripMatcher } from "@/hooks/useInvoiceTripMatcher";
import { useCT1Data } from "@/hooks/useCT1Data";
import { useInvoices } from "@/hooks/useInvoices";
import { useAuth } from "@/hooks/useAuth";

type DateRangeOption = "this_month" | "last_month" | "ytd" | "all";

const dateRangeLabels: Record<DateRangeOption, string> = {
  this_month: "This Month",
  last_month: "Last Month",
  ytd: "Year to Date",
  all: "All Time",
};

// Direct cost category keywords
const DIRECT_COST_KEYWORDS = ["cost of goods", "cogs", "direct cost", "materials", "stock", "inventory"];

const formatCurrency = (value: number) => {
  return value.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function TravelBreakdown({ mileage, subsistence, reimbursed, netOwed }: {
  mileage: number; subsistence: number; reimbursed: number; netOwed: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ml-8">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors mt-1.5 py-0.5"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} />
        <span>Revenue rate breakdown</span>
      </button>
      {open && (
        <div className="mt-1 pl-4 text-xs text-muted-foreground space-y-0.5 border-l-2 border-primary/20">
          <div className="flex justify-between">
            <span>Mileage allowance</span>
            <span className="tabular-nums w-28 text-right">{formatCurrency(mileage)}</span>
          </div>
          <div className="flex justify-between">
            <span>Subsistence allowance</span>
            <span className="tabular-nums w-28 text-right">{formatCurrency(subsistence)}</span>
          </div>
          {reimbursed > 0 && (
            <div className="flex justify-between">
              <span>Less: Already reimbursed (bank)</span>
              <span className="tabular-nums w-28 text-right">({formatCurrency(reimbursed)})</span>
            </div>
          )}
        </div>
      )}
      {netOwed > 0 && (
        <p className="text-[11px] text-muted-foreground mt-1 pl-4 italic">
          * {formatCurrency(netOwed)} still owed to director — see Balance Sheet
        </p>
      )}
    </div>
  );
}

const AccountDetail = () => {
  const navigate = useNavigate();
  const { accountId } = useParams();
  const [activeTab, setActiveTab] = useState("pnl");
  const [dateRange, setDateRange] = useState<DateRangeOption>("this_month");
  
  const { data: supabaseAccounts } = useAccounts();
  const account = supabaseAccounts?.find(a => a.id === accountId);
  
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { invoiceTrips } = useInvoiceTripMatcher();
  const { data: invoices = [] } = useInvoices();
  const ct1 = useCT1Data();
  const { user } = useAuth();
  
  // Get date range bounds
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "this_month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "ytd":
        return { start: startOfYear(now), end: now };
      case "all":
      default:
        return { start: null, end: null };
    }
  }, [dateRange]);

  const periodLabel = useMemo(() => {
    if (dateRange === "all") return "All Time";
    const { start, end } = dateRangeBounds;
    if (start && end) {
      return `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`;
    }
    return dateRangeLabels[dateRange];
  }, [dateRange, dateRangeBounds]);
  
  // Filter transactions for this account
  const accountTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesAccount = t.account_id === accountId;
      if (!matchesAccount) return false;
      
      if (dateRangeBounds.start && dateRangeBounds.end) {
        const txDate = new Date(t.transaction_date);
        return txDate >= dateRangeBounds.start && txDate <= dateRangeBounds.end;
      }
      return true;
    });
  }, [transactions, accountId, dateRangeBounds]);

  // Create category lookup map
  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; type: string }>();
    categories.forEach(cat => {
      map.set(cat.id, { name: cat.name, type: cat.type });
    });
    return map;
  }, [categories]);

  // Check if a category is a direct cost
  const isDirectCost = (categoryName: string) => {
    const lowerName = categoryName.toLowerCase();
    return DIRECT_COST_KEYWORDS.some(keyword => lowerName.includes(keyword));
  };
  
  // Check if a transaction is a Revenue refund (by category or description)
  const isRevenueRefund = (categoryName: string, description: string) => {
    if (categoryName === "Tax Refund") return true;
    const desc = (description || "").toLowerCase();
    return categoryName === "Uncategorised" && (
      desc.includes("revenue") || desc.includes("collector general") ||
      desc.includes("tax refund") || desc.includes("vat refund") ||
      desc.includes("paye refund") || desc.includes("ct refund") ||
      desc.includes("rct refund") || desc.includes("ros refund")
    );
  };

  // Calculate detailed P&L data with category breakdowns
  const pnlData = useMemo(() => {
    // Income by category
    const incomeByCategory: Record<string, number> = {};
    let totalIncome = 0;

    // Revenue refunds — own heading (not taxable)
    const revenueRefundsByCategory: Record<string, number> = {};
    let totalRevenueRefunds = 0;

    // Direct costs and expenses by category
    const directCostsByCategory: Record<string, number> = {};
    const expensesByCategory: Record<string, number> = {};
    let totalDirectCosts = 0;
    let totalExpenses = 0;

    accountTransactions.forEach(t => {
      const isIncome = t.type === 'income' || t.amount > 0;
      const amount = Math.abs(t.amount);
      const categoryInfo = t.category_id ? categoryMap.get(t.category_id) : null;
      const categoryName = categoryInfo?.name || 'Uncategorised';

      // Revenue refunds get their own heading regardless of income/expense
      if (isRevenueRefund(categoryName, t.description || "")) {
        const label = categoryName === "Tax Refund" ? categoryName : "Tax Refund";
        revenueRefundsByCategory[label] = (revenueRefundsByCategory[label] || 0) + amount;
        totalRevenueRefunds += amount;
        return;
      }

      if (isIncome) {
        incomeByCategory[categoryName] = (incomeByCategory[categoryName] || 0) + amount;
        totalIncome += amount;
      } else {
        // Check if this is a direct cost
        if (isDirectCost(categoryName)) {
          directCostsByCategory[categoryName] = (directCostsByCategory[categoryName] || 0) + amount;
          totalDirectCosts += amount;
        } else {
          expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + amount;
          totalExpenses += amount;
        }
      }
    });

    // Travel & Accommodation from trip matcher (Revenue rates)
    const travelMileage = invoiceTrips.reduce((s, t) => s + t.suggestedMileage.allowance, 0);
    const travelSubsistence = invoiceTrips.reduce((s, t) => s + t.suggestedSubsistence.allowance, 0);
    const travelTotalAllowance = Math.round((travelMileage + travelSubsistence) * 100) / 100;
    const travelAlreadyReimbursed = Math.round(invoiceTrips.reduce((s, t) => s + t.totalExpensesFromCsv, 0) * 100) / 100;
    const travelNetOwed = Math.round(Math.max(0, travelTotalAllowance - travelAlreadyReimbursed) * 100) / 100;

    if (travelTotalAllowance > 0) {
      expensesByCategory["Travel & Accommodation"] = (expensesByCategory["Travel & Accommodation"] || 0) + travelTotalAllowance;
      totalExpenses += travelTotalAllowance;
    }

    const grossProfit = totalIncome - totalDirectCosts;
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : null;

    return {
      incomeByCategory,
      totalIncome,
      revenueRefundsByCategory,
      totalRevenueRefunds,
      directCostsByCategory,
      totalDirectCosts,
      grossProfit,
      expensesByCategory,
      totalExpenses,
      netProfit,
      profitMargin,
      travelMileage,
      travelSubsistence,
      travelTotalAllowance,
      travelAlreadyReimbursed,
      travelNetOwed,
    };
  }, [accountTransactions, categoryMap, invoiceTrips]);
  
  // Calculate balance sheet data
  const balanceData = useMemo(() => {
    const totalCredits = accountTransactions
      .filter(t => t.type === 'income' || t.amount > 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const totalDebits = accountTransactions
      .filter(t => t.type === 'expense' || t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const balance = totalCredits - totalDebits;
    
    return { totalCredits, totalDebits, balance };
  }, [accountTransactions]);
  
  // Balance sheet sections — assets, liabilities, capital from CT1 questionnaire
  const bsSections = useMemo(() => {
    const now = new Date();
    const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
    const raw = localStorage.getItem(`ct1_questionnaire_${user?.id}_${taxYear}`);
    const q = raw ? JSON.parse(raw) : null;

    // Assets
    const assets: { label: string; amount: number }[] = [];
    if (q?.fixedAssetsLandBuildings) assets.push({ label: "Land & Buildings", amount: q.fixedAssetsLandBuildings });
    if (q?.fixedAssetsPlantMachinery) assets.push({ label: "Plant & Machinery", amount: q.fixedAssetsPlantMachinery });
    const motorNBV = ct1.vehicleAsset ? ct1.vehicleAsset.depreciation.netBookValue : (q?.fixedAssetsMotorVehicles ?? 0);
    if (motorNBV > 0) assets.push({ label: "Motor Vehicles", amount: motorNBV });
    if (q?.fixedAssetsFixturesFittings) assets.push({ label: "Fixtures & Fittings", amount: q.fixedAssetsFixturesFittings });
    if (q?.currentAssetsStock) assets.push({ label: "Stock", amount: q.currentAssetsStock });
    const debtors = q?.currentAssetsDebtors ?? q?.tradeDebtorsTotal ?? 0;
    if (debtors > 0) assets.push({ label: "Debtors", amount: debtors });
    if (q?.currentAssetsCash) assets.push({ label: "Cash in Hand", amount: q.currentAssetsCash });
    const bankBal = q?.currentAssetsBankBalance ?? ct1.closingBalance ?? 0;
    if (bankBal > 0) assets.push({ label: "Bank Balance", amount: bankBal });
    if (ct1.rctPrepayment > 0) assets.push({ label: "RCT Prepayment", amount: ct1.rctPrepayment });
    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);

    // Liabilities
    const liabilities: { label: string; amount: number }[] = [];
    const creditors = q?.liabilitiesCreditors ?? q?.tradeCreditorsTotal ?? 0;
    if (creditors > 0) liabilities.push({ label: "Creditors", amount: creditors });
    if (ct1.vatPosition && ct1.vatPosition.type === "payable" && ct1.vatPosition.amount > 0) {
      liabilities.push({ label: "VAT Payable", amount: ct1.vatPosition.amount });
    }
    if (ct1.netDirectorsLoan > 0) liabilities.push({ label: "Director's Loan Account", amount: ct1.netDirectorsLoan });
    const bankLoans = q?.liabilitiesBankLoans ?? 0;
    if (bankLoans > 0) liabilities.push({ label: "Bank Loans", amount: bankLoans });
    const directorsLoans = q?.liabilitiesDirectorsLoans ?? q?.directorsLoanBalance ?? 0;
    if (directorsLoans > 0) liabilities.push({ label: "Directors' Loans", amount: directorsLoans });
    const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);

    // Capital
    const capital: { label: string; amount: number }[] = [];
    const shareCapital = q?.shareCapital ?? 100;
    capital.push({ label: "Share Capital", amount: shareCapital });
    const totalIncome = ct1.detectedIncome.reduce((s, i) => s + i.amount, 0);
    const retainedProfits = totalIncome - ct1.expenseSummary.allowable;
    if (retainedProfits !== 0) capital.push({ label: "Retained Profits", amount: retainedProfits });
    const totalCapital = capital.reduce((s, c) => s + c.amount, 0);

    return { assets, totalAssets, liabilities, totalLiabilities, capital, totalCapital };
  }, [user?.id, ct1]);

  // Calculate VAT data — output VAT skipped (stored invoice vat_amount is
  // unreliable due to previous 23% default). Input VAT from expenses only.
  const vatData = useMemo(() => {
    const vatOnSales = 0;
    let vatOnPurchases = 0;

    accountTransactions.forEach(t => {
      if (t.type === 'expense' || t.amount < 0) {
        vatOnPurchases += (t.vat_amount || 0);
      }
    });

    const netVat = vatOnSales - vatOnPurchases;

    return { vatOnSales, vatOnPurchases, netVat };
  }, [accountTransactions]);
  
  // Calculate ratios
  const ratios = useMemo(() => {
    const { totalIncome, totalExpenses, netProfit, grossProfit, totalDirectCosts } = pnlData;
    
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const grossMargin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
    const expenseRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;
    const incomeToExpense = (totalExpenses + totalDirectCosts) > 0 ? totalIncome / (totalExpenses + totalDirectCosts) : 0;
    
    return { profitMargin, grossMargin, expenseRatio, incomeToExpense };
  }, [pnlData]);

  if (!account) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Account not found</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/accounts")} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-xl">{account.name}</h1>
              <p className="text-sm text-muted-foreground">
                {account.account_type === "limited_company" ? "Limited Company" :
                 account.account_type === "sole_trader" ? "Sole Trader" :
                 account.account_type === "directors_personal_tax" ? "Director's Personal Tax" :
                 account.account_type}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 max-w-4xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="pnl" className="gap-2">
              <FileText className="w-4 h-4" />
              P&L
            </TabsTrigger>
            <TabsTrigger value="balance" className="gap-2">
              <Scale className="w-4 h-4" />
              Balance
            </TabsTrigger>
            <TabsTrigger value="vat" className="gap-2">
              <Receipt className="w-4 h-4" />
              VAT
            </TabsTrigger>
            <TabsTrigger value="ratios" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Ratios
            </TabsTrigger>
          </TabsList>

          {/* P&L Tab */}
          <TabsContent value="pnl" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold tracking-tight">
                      Profit & Loss Statement
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{periodLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          {dateRangeLabels[dateRange]}
                          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        {(Object.keys(dateRangeLabels) as DateRangeOption[]).map((key) => (
                          <DropdownMenuItem 
                            key={key} 
                            onClick={() => setDateRange(key)}
                            className={dateRange === key ? "bg-accent" : ""}
                          >
                            {dateRangeLabels[key]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem className="gap-2">
                          <Download className="h-3.5 w-3.5" />
                          Export PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2">
                          <Printer className="h-3.5 w-3.5" />
                          Print
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 font-mono text-sm">
                {/* Income Section */}
                <div className="mb-4">
                  <div className="flex items-baseline">
                    <span className="font-semibold text-foreground w-28">Income</span>
                    <div className="flex-1">
                      {Object.entries(pnlData.incomeByCategory).map(([category, amount]) => (
                        <div key={category} className="flex justify-between py-0.5">
                          <span className="text-muted-foreground pl-4">{category}</span>
                          <span className="tabular-nums w-28 text-right">{formatCurrency(amount)}</span>
                        </div>
                      ))}
                      {Object.keys(pnlData.incomeByCategory).length === 0 && (
                        <div className="flex justify-between py-0.5">
                          <span className="text-muted-foreground pl-4">—</span>
                          <span className="tabular-nums w-28 text-right">0.00</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-border/50 mt-2 pt-1">
                    <span className="tabular-nums font-medium w-28 text-right">{formatCurrency(pnlData.totalIncome)}</span>
                  </div>
                </div>

                {/* Revenue Refund Section */}
                {pnlData.totalRevenueRefunds > 0 && (
                  <div className="mb-4 bg-amber-50/50 dark:bg-amber-950/20 -mx-6 px-6 py-3 border-y border-amber-200/40 dark:border-amber-800/30">
                    <div className="flex items-baseline">
                      <span className="font-semibold text-foreground w-28 italic">
                        Revenue Refund
                        <span className="ml-2 text-[10px] font-normal not-italic px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                          Non-taxable
                        </span>
                      </span>
                      <div className="flex-1">
                        {Object.entries(pnlData.revenueRefundsByCategory).map(([category, amount]) => (
                          <div key={category} className="flex justify-between py-0.5">
                            <span className="text-muted-foreground pl-4">{category}</span>
                            <span className="tabular-nums w-28 text-right">{formatCurrency(amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end border-t border-amber-200/40 dark:border-amber-800/30 mt-2 pt-1">
                      <span className="tabular-nums font-medium w-28 text-right">{formatCurrency(pnlData.totalRevenueRefunds)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 italic">
                      Return of previously overpaid tax — excluded from taxable income
                    </p>
                  </div>
                )}

                {/* Direct Costs Section */}
                <div className="mb-4">
                  <div className="flex items-baseline">
                    <span className="font-semibold text-foreground w-28">Direct costs</span>
                    <div className="flex-1">
                      {Object.entries(pnlData.directCostsByCategory).map(([category, amount]) => (
                        <div key={category} className="flex justify-between py-0.5">
                          <span className="text-muted-foreground pl-4">{category}</span>
                          <span className="tabular-nums w-28 text-right">{formatCurrency(amount)}</span>
                        </div>
                      ))}
                      {Object.keys(pnlData.directCostsByCategory).length === 0 && pnlData.totalDirectCosts === 0 && (
                        <div className="flex justify-end">
                          <span className="tabular-nums w-28 text-right">{formatCurrency(pnlData.totalDirectCosts)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {Object.keys(pnlData.directCostsByCategory).length > 0 && (
                    <div className="flex justify-end border-t border-border/50 mt-2 pt-1">
                      <span className="tabular-nums font-medium w-28 text-right">{formatCurrency(pnlData.totalDirectCosts)}</span>
                    </div>
                  )}
                </div>

                {/* Gross Profit */}
                <div className="mb-6 bg-muted/30 -mx-6 px-6 py-3">
                  <div className="flex items-baseline">
                    <span className="font-semibold w-28">Gross profit</span>
                    <div className="flex-1 flex justify-end">
                      <span className="tabular-nums font-semibold w-28 text-right">{formatCurrency(pnlData.grossProfit)}</span>
                    </div>
                  </div>
                </div>

                {/* Expenses Section */}
                <div className="mb-4">
                  <div className="flex items-baseline">
                    <span className="font-semibold text-foreground w-28">Expenses</span>
                    <div className="flex-1" />
                  </div>
                  <div className="mt-2 space-y-0.5">
                    {Object.entries(pnlData.expensesByCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([category, amount]) => (
                        <div key={category} className="flex justify-between py-0.5">
                          <span className="text-muted-foreground pl-8">{category}</span>
                          <span className="tabular-nums w-28 text-right">{formatCurrency(amount)}</span>
                        </div>
                      ))}
                    {Object.keys(pnlData.expensesByCategory).length === 0 && (
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground pl-8">—</span>
                        <span className="tabular-nums w-28 text-right">0.00</span>
                      </div>
                    )}
                  </div>
                  {/* Travel & Accommodation collapsible breakdown (Revenue rates) */}
                  {pnlData.travelTotalAllowance > 0 && (
                    <TravelBreakdown
                      mileage={pnlData.travelMileage}
                      subsistence={pnlData.travelSubsistence}
                      reimbursed={pnlData.travelAlreadyReimbursed}
                      netOwed={pnlData.travelNetOwed}
                    />
                  )}
                  <div className="flex justify-end border-t border-border/50 mt-3 pt-2">
                    <span className="text-muted-foreground mr-4">Total Expenses</span>
                    <span className="tabular-nums font-medium w-28 text-right">{formatCurrency(pnlData.totalExpenses)}</span>
                  </div>
                </div>

                {/* Net Profit */}
                <div className="border-t-2 border-foreground/30 pt-4 mt-6">
                  <div className="flex items-baseline">
                    <span className="font-bold w-28">Net profit</span>
                    <div className="flex-1 flex justify-end">
                      <span className={`tabular-nums font-bold w-28 text-right ${
                        pnlData.netProfit >= 0 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {pnlData.netProfit < 0 && '('}
                        {formatCurrency(Math.abs(pnlData.netProfit))}
                        {pnlData.netProfit < 0 && ')'}
                      </span>
                    </div>
                  </div>
                  {pnlData.profitMargin !== null && pnlData.totalIncome > 0 && (
                    <div className="flex justify-end mt-1">
                      <span className="text-xs text-muted-foreground">
                        Profit margin: {pnlData.profitMargin.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Assets / Liabilities / Capital sections */}
                {(bsSections.assets.length > 0 || bsSections.liabilities.length > 0 || bsSections.capital.length > 0) && (
                  <>
                    <div className="border-t border-border/30 mt-8 pt-4 mb-4">
                      <div className="flex items-baseline">
                        <span className="font-semibold text-foreground w-28">Assets</span>
                        <div className="flex-1" />
                      </div>
                      <div className="mt-2 space-y-0.5">
                        {bsSections.assets.map(a => (
                          <div key={a.label} className="flex justify-between py-0.5">
                            <span className="text-muted-foreground pl-8">{a.label}</span>
                            <span className="tabular-nums w-28 text-right">{formatCurrency(a.amount)}</span>
                          </div>
                        ))}
                        {bsSections.assets.length === 0 && (
                          <div className="flex justify-between py-0.5">
                            <span className="text-muted-foreground pl-8">—</span>
                            <span className="tabular-nums w-28 text-right">0.00</span>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end border-t border-border/50 mt-3 pt-2">
                        <span className="text-muted-foreground mr-4">Total Assets</span>
                        <span className="tabular-nums font-medium w-28 text-right">{formatCurrency(bsSections.totalAssets)}</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-baseline">
                        <span className="font-semibold text-foreground w-28">Liabilities</span>
                        <div className="flex-1" />
                      </div>
                      <div className="mt-2 space-y-0.5">
                        {bsSections.liabilities.map(l => (
                          <div key={l.label} className="flex justify-between py-0.5">
                            <span className="text-muted-foreground pl-8">{l.label}</span>
                            <span className="tabular-nums w-28 text-right">{formatCurrency(l.amount)}</span>
                          </div>
                        ))}
                        {bsSections.liabilities.length === 0 && (
                          <div className="flex justify-between py-0.5">
                            <span className="text-muted-foreground pl-8">—</span>
                            <span className="tabular-nums w-28 text-right">0.00</span>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end border-t border-border/50 mt-3 pt-2">
                        <span className="text-muted-foreground mr-4">Total Liabilities</span>
                        <span className="tabular-nums font-medium w-28 text-right">{formatCurrency(bsSections.totalLiabilities)}</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-baseline">
                        <span className="font-semibold text-foreground w-28">Capital</span>
                        <div className="flex-1" />
                      </div>
                      <div className="mt-2 space-y-0.5">
                        {bsSections.capital.map(c => (
                          <div key={c.label} className="flex justify-between py-0.5">
                            <span className="text-muted-foreground pl-8">{c.label}</span>
                            <span className="tabular-nums w-28 text-right">{formatCurrency(c.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end border-t border-border/50 mt-3 pt-2">
                        <span className="text-muted-foreground mr-4">Total Capital</span>
                        <span className="tabular-nums font-medium w-28 text-right">{formatCurrency(bsSections.totalCapital)}</span>
                      </div>
                    </div>
                  </>
                )}

                {accountTransactions.length === 0 && bsSections.assets.length === 0 && bsSections.capital.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-t mt-6">
                    <p className="text-sm font-sans">No transactions in this period.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balance Sheet Tab */}
          <TabsContent value="balance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  Balance Sheet
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Assets, liabilities, and account balance
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">Total Credits (Inflows)</p>
                      <p className="text-sm text-muted-foreground">Money received</p>
                    </div>
                    <span className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                      €{balanceData.totalCredits.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">Total Debits (Outflows)</p>
                      <p className="text-sm text-muted-foreground">Money spent</p>
                    </div>
                    <span className="text-xl font-semibold text-red-600 dark:text-red-400">
                      €{balanceData.totalDebits.toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-primary/5 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium">Current Balance</span>
                    <span className={`text-3xl font-bold ${balanceData.balance >= 0 ? 'text-primary' : 'text-red-600 dark:text-red-400'}`}>
                      €{balanceData.balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VAT Tab */}
          <TabsContent value="vat" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="w-5 h-5" />
                      VAT Summary
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{periodLabel}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        {dateRangeLabels[dateRange]}
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      {(Object.keys(dateRangeLabels) as DateRangeOption[]).map((key) => (
                        <DropdownMenuItem 
                          key={key} 
                          onClick={() => setDateRange(key)}
                          className={dateRange === key ? "bg-accent" : ""}
                        >
                          {dateRangeLabels[key]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">VAT on Sales</p>
                      <p className="text-sm text-muted-foreground">VAT collected from customers</p>
                    </div>
                    <span className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                      €{vatData.vatOnSales.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">VAT on Purchases</p>
                      <p className="text-sm text-muted-foreground">VAT paid on expenses (reclaimable)</p>
                    </div>
                    <span className="text-xl font-semibold text-red-600 dark:text-red-400">
                      €{vatData.vatOnPurchases.toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <div className={`rounded-xl p-4 ${vatData.netVat >= 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-emerald-50 dark:bg-emerald-950/30'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-lg font-medium">Net VAT</span>
                      <p className="text-sm text-muted-foreground">
                        {vatData.netVat >= 0 ? 'Amount owed to Revenue' : 'Refund due from Revenue'}
                      </p>
                    </div>
                    <span className={`text-3xl font-bold ${vatData.netVat >= 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      €{Math.abs(vatData.netVat).toFixed(2)}
                    </span>
                  </div>
                </div>

                {accountTransactions.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No transactions found for this account.</p>
                    <p className="text-sm">Import transactions to see VAT summary.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ratios Tab */}
          <TabsContent value="ratios" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Financial Ratios
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Key performance indicators for this account
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-sm text-muted-foreground mb-1">Profit Margin</p>
                    <p className={`text-2xl font-bold ${ratios.profitMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {ratios.profitMargin.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Net profit as % of income
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-sm text-muted-foreground mb-1">Expense Ratio</p>
                    <p className="text-2xl font-bold">
                      {ratios.expenseRatio.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Expenses as % of income
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-sm text-muted-foreground mb-1">Income/Expense</p>
                    <p className={`text-2xl font-bold ${ratios.incomeToExpense >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {ratios.incomeToExpense.toFixed(2)}x
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Income to expense ratio
                    </p>
                  </div>
                </div>
                
                {accountTransactions.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No transactions found for this account.</p>
                    <p className="text-sm">Import transactions to see financial ratios.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </AppLayout>
  );
};

export default AccountDetail;
