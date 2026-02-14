import { useState, useMemo } from "react";
import { Receipt, TrendingUp, TrendingDown, Calculator, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateVATFromGross, isVATDeductible } from "@/lib/vatDeductibility";

interface Transaction {
  id: string;
  type: "income" | "expense" | string;
  amount: number;
  description?: string | null;
  transaction_date?: string | null;
  vat_amount?: number | null;
  vat_rate?: number | null;
  category?: { name: string } | null;
}

interface VATDetail {
  id: string;
  description: string;
  date: string;
  gross: number;
  vatAmount: number;
  vatRate: string;
}

interface VATSummaryCardProps {
  transactions: Transaction[];
  accountName: string;
}

const VATSummaryCard = ({ transactions, accountName }: VATSummaryCardProps) => {
  const [expandedSection, setExpandedSection] = useState<"sales" | "purchases" | null>(null);

  const vatSummary = useMemo(() => {
    const vatOnSales = 0;
    let vatOnPurchases = 0;
    let salesCount = 0;
    let purchasesCount = 0;
    const purchaseDetails: VATDetail[] = [];

    for (const txn of transactions) {
      const vatRateStr = String(txn.vat_rate || "");
      const isReverseCharge = vatRateStr === "reverse_charge" || vatRateStr === "Reverse Charge";
      let vatAmount = isReverseCharge ? 0 : (txn.vat_amount || 0);
      if (!vatAmount && !isReverseCharge && txn.vat_rate && txn.vat_rate > 0) {
        const calculated = calculateVATFromGross(Math.abs(txn.amount), vatRateStr);
        vatAmount = calculated.vatAmount;
      }

      if (txn.type === "income") {
        // Output VAT comes from invoices, not bank payments
        salesCount++;
      } else if (txn.type === "expense" && vatAmount > 0) {
        // Apply Section 59/60 rules — hotels, food, petrol etc. are NOT deductible
        const deductibility = isVATDeductible(
          txn.description || "",
          txn.category?.name || null,
          null
        );
        if (deductibility.isDeductible) {
          vatOnPurchases += vatAmount;
          purchasesCount++;
          purchaseDetails.push({
            id: txn.id,
            description: txn.description || txn.category?.name || "Expense",
            date: txn.transaction_date || "",
            gross: Math.abs(txn.amount),
            vatAmount,
            vatRate: vatRateStr,
          });
        }
      }
    }

    // Sort by VAT amount descending
    purchaseDetails.sort((a, b) => b.vatAmount - a.vatAmount);

    const netVat = vatOnSales - vatOnPurchases;
    const isRefund = netVat < 0;

    return { vatOnSales, vatOnPurchases, netVat, salesCount, purchasesCount, isRefund, purchaseDetails };
  }, [transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString("en-IE", { day: "numeric", month: "short" });
    } catch { return d; }
  };

  const rateLabel = (r: string) => {
    if (r.includes("23") || r === "standard_23") return "23%";
    if (r.includes("13") || r === "reduced_13_5") return "13.5%";
    if (r.includes("9") || r === "second_reduced_9") return "9%";
    if (r.includes("4.8") || r === "livestock_4_8") return "4.8%";
    return r;
  };

  return (
    <div className="space-y-4 w-full">
      <Card className="bg-card w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            VAT Summary - {accountName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-500/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">VAT on Sales</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(vatSummary.vatOnSales)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                From invoices only
              </p>
            </div>

            {/* VAT on Purchases — clickable */}
            <div
              className="bg-rose-500/10 rounded-xl p-4 cursor-pointer hover:ring-2 hover:ring-rose-300 transition-all"
              onClick={() => setExpandedSection(expandedSection === "purchases" ? null : "purchases")}
            >
              <div className="flex items-center gap-2 text-rose-600 mb-1">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm font-medium">VAT on Purchases</span>
                <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${expandedSection === "purchases" ? "rotate-180" : ""}`} />
              </div>
              <p className="text-2xl font-bold text-rose-600">
                {formatCurrency(vatSummary.vatOnPurchases)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {vatSummary.purchasesCount} deductible transactions
              </p>
            </div>
          </div>

          {/* Expandable purchase details */}
          {expandedSection === "purchases" && (
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 flex justify-between text-xs font-medium text-muted-foreground">
                <span>Transaction</span>
                <div className="flex gap-8">
                  <span className="w-16 text-right">Rate</span>
                  <span className="w-20 text-right">Gross</span>
                  <span className="w-20 text-right">VAT</span>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                {vatSummary.purchaseDetails.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No deductible VAT transactions</p>
                ) : (
                  vatSummary.purchaseDetails.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium truncate">{d.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(d.date)}</p>
                      </div>
                      <div className="flex gap-8 shrink-0">
                        <span className="text-xs text-muted-foreground w-16 text-right tabular-nums">{rateLabel(d.vatRate)}</span>
                        <span className="text-sm w-20 text-right tabular-nums">{formatCurrency(d.gross)}</span>
                        <span className="text-sm font-medium text-rose-600 w-20 text-right tabular-nums">{formatCurrency(d.vatAmount)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className={`rounded-xl p-4 ${vatSummary.isRefund ? 'bg-emerald-500/10' : 'bg-primary/10'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-4 h-4" />
              <span className="text-sm font-medium">
                {vatSummary.isRefund ? "VAT Refund Due" : "VAT Payable"}
              </span>
            </div>
            <p className={`text-3xl font-bold ${vatSummary.isRefund ? 'text-emerald-600' : 'text-foreground'}`}>
              {formatCurrency(Math.abs(vatSummary.netVat))}
            </p>
          </div>

          {transactions.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              No transactions to calculate VAT from
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VATSummaryCard;
