import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  Shield,
  Landmark,
  HandHeart,
  Home,
  GraduationCap,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Search,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useReliefScan } from "@/hooks/useReliefScan";
import { useAccounts } from "@/hooks/useAccounts";
import type { ReliefMatch } from "@/lib/reliefScanner";

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);

interface ReliefCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  rate: number;
  rateLabel: string;
  total: number;
  transactions: ReliefMatch[];
}

const ReliefScanner = () => {
  const navigate = useNavigate();
  const { data: personalAccounts } = useAccounts("directors_personal_tax");
  const hasPersonalAccounts = (personalAccounts?.length ?? 0) > 0;
  const { reliefs, isLoading, taxYear } = useReliefScan(
    hasPersonalAccounts ? { accountType: "directors_personal_tax" } : undefined,
  );

  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (key: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Scanning transactions for reliefs...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!reliefs) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">No transaction data available. Please import bank feeds first.</p>
          <Button variant="outline" onClick={() => navigate("/tax")}>
            Back to Tax Centre
          </Button>
        </div>
      </AppLayout>
    );
  }

  const categories: ReliefCategory[] = [
    {
      key: "medical",
      label: "Medical Expenses",
      icon: <Heart className="w-5 h-5" />,
      colorClass: "text-red-600",
      bgClass: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
      rate: 0.2,
      rateLabel: "20% (Section 469 TCA 1997)",
      total: reliefs.medical.total,
      transactions: reliefs.medical.transactions,
    },
    {
      key: "healthInsurance",
      label: "Health Insurance",
      icon: <Shield className="w-5 h-5" />,
      colorClass: "text-blue-600",
      bgClass: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
      rate: 0.2,
      rateLabel: "20% tax credit (Section 470)",
      total: reliefs.healthInsurance.total,
      transactions: reliefs.healthInsurance.transactions,
    },
    {
      key: "pension",
      label: "Pension Contributions",
      icon: <Landmark className="w-5 h-5" />,
      colorClass: "text-purple-600",
      bgClass: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
      rate: 0.4,
      rateLabel: "Up to 40% marginal relief (Section 774)",
      total: reliefs.pension.total,
      transactions: reliefs.pension.transactions,
    },
    {
      key: "charitable",
      label: "Charitable Donations",
      icon: <HandHeart className="w-5 h-5" />,
      colorClass: "text-green-600",
      bgClass: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
      rate: 0.4,
      rateLabel: "Relief at marginal rate (Section 848A)",
      total: reliefs.charitable.total,
      transactions: reliefs.charitable.transactions,
    },
    {
      key: "rent",
      label: "Rent Tax Credit",
      icon: <Home className="w-5 h-5" />,
      colorClass: "text-yellow-600",
      bgClass: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800",
      rate: 0,
      rateLabel: "Flat credit up to €750/€1,500 (Section 473B)",
      total: reliefs.rent.total,
      transactions: reliefs.rent.transactions,
    },
    {
      key: "tuition",
      label: "Tuition Fees",
      icon: <GraduationCap className="w-5 h-5" />,
      colorClass: "text-indigo-600",
      bgClass: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800",
      rate: 0.2,
      rateLabel: "20% (Section 473A, after €3,000 disregard)",
      total: reliefs.tuition.total,
      transactions: reliefs.tuition.transactions,
    },
  ];

  const activeCategories = categories.filter((c) => c.total > 0);
  const totalReliefs = activeCategories.reduce((s, c) => s + c.total, 0);
  const estimatedSavings = activeCategories.reduce((s, c) => s + c.total * (c.rate > 0 ? c.rate : 0), 0);

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
                <h1 className="font-semibold text-xl">Relief Scanner</h1>
                <p className="text-sm text-muted-foreground">Tax Year {taxYear} &bull; Auto-detected Form 11 reliefs</p>
              </div>
              <Search className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* Summary */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden ring-2 ring-primary/20">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Total Reliefs Detected</p>
                  <p className="text-2xl font-bold font-mono tabular-nums">{eur(totalReliefs)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Est. Tax Savings</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-green-600">{eur(estimatedSavings)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3">
                {activeCategories.length} of 6 relief categories detected from your transactions
              </p>
            </CardContent>
          </Card>

          {/* Relief Categories */}
          {activeCategories.length === 0 ? (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
              <CardContent className="pt-6 text-center">
                <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No qualifying reliefs detected in your transactions.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Import personal account transactions to enable relief scanning.
                </p>
              </CardContent>
            </Card>
          ) : (
            activeCategories.map((cat) => (
              <Collapsible
                key={cat.key}
                open={openCategories.has(cat.key)}
                onOpenChange={() => toggleCategory(cat.key)}
              >
                <Card className={`border-0 shadow-lg rounded-3xl overflow-hidden border ${cat.bgClass}`}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className={cat.colorClass}>{cat.icon}</span>
                        <span className="flex-1 text-left">{cat.label}</span>
                        <span className="font-mono tabular-nums text-base">{eur(cat.total)}</span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${openCategories.has(cat.key) ? "rotate-180" : ""}`}
                        />
                      </CardTitle>
                      <p className="text-xs text-muted-foreground text-left">{cat.rateLabel}</p>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-2 pt-0">
                      {cat.transactions.map((tx, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                          <div>
                            <span>{tx.description}</span>
                            <span className="text-muted-foreground ml-2">{tx.date}</span>
                          </div>
                          <span className="font-mono tabular-nums">{eur(tx.amount)}</span>
                        </div>
                      ))}
                      {cat.rate > 0 && (
                        <div className="border-t mt-2 pt-2">
                          <div className="flex items-center justify-between text-sm font-semibold">
                            <span>Estimated relief ({(cat.rate * 100).toFixed(0)}%)</span>
                            <span className="font-mono tabular-nums text-green-600">{eur(cat.total * cat.rate)}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))
          )}

          {/* Disclaimer */}
          <div className="text-center text-xs text-muted-foreground py-6 space-y-1">
            <p>Auto-detected reliefs based on transaction descriptions. Review for accuracy.</p>
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

export default ReliefScanner;
