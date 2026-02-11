import { TrendingUp, TrendingDown, AlertCircle, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BankStatsProps {
  balance: number;
  incomeCount: number;
  expenseCount: number;
  uncategorizedCount: number;
  totalTransactions: number;
}

export function BankStats({
  balance,
  incomeCount,
  expenseCount,
  uncategorizedCount,
  totalTransactions,
}: BankStatsProps) {
  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      {/* Balance Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground font-medium">Current Balance</p>
          <p className={cn(
            "text-3xl font-bold tracking-tight",
            balance >= 0 ? "text-foreground" : "text-red-500"
          )}>
            {balance >= 0 ? "" : "-"}€{Math.abs(balance).toLocaleString("en-IE", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-xs font-medium text-muted-foreground">
          <ArrowLeftRight className="w-3 h-3" />
          {totalTransactions} transactions
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-950/30">
          <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400 mb-1">
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="text-lg font-semibold text-green-700 dark:text-green-300">{incomeCount}</p>
          <p className="text-xs text-green-600/70 dark:text-green-400/70">Income</p>
        </div>

        <div className="text-center p-3 rounded-xl bg-red-50 dark:bg-red-950/30">
          <div className="flex items-center justify-center gap-1 text-red-500 dark:text-red-400 mb-1">
            <TrendingDown className="w-4 h-4" />
          </div>
          <p className="text-lg font-semibold text-red-600 dark:text-red-300">{expenseCount}</p>
          <p className="text-xs text-red-500/70 dark:text-red-400/70">Expenses</p>
        </div>

        <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">
          <div className="flex items-center justify-center gap-1 text-amber-500 dark:text-amber-400 mb-1">
            <AlertCircle className="w-4 h-4" />
          </div>
          <p className="text-lg font-semibold text-amber-600 dark:text-amber-300">{uncategorizedCount}</p>
          <p className="text-xs text-amber-500/70 dark:text-amber-400/70">To Review</p>
        </div>
      </div>
    </div>
  );
}
