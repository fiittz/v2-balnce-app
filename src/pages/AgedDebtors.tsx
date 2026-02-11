import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  Loader2,
  FileText,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useInvoices } from "@/hooks/useInvoices";

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);

interface AgingBucket {
  label: string;
  min: number;
  max: number;
  colorClass: string;
  badgeClass: string;
  total: number;
  invoices: AgedInvoice[];
}

interface AgedInvoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  total: number;
  dueDate: string;
  invoiceDate: string;
  daysOverdue: number;
}

const AgedDebtors = () => {
  const navigate = useNavigate();
  const { data: invoices, isLoading } = useInvoices();

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Process invoices into aged buckets
  const { buckets, totalOutstanding, hasOverdue90 } = useMemo(() => {
    if (!invoices) return { buckets: [] as AgingBucket[], totalOutstanding: 0, hasOverdue90: false };

    // Filter out paid invoices, compute days overdue
    const unpaid: AgedInvoice[] = invoices
      .filter((inv) => inv.status !== "paid")
      .map((inv) => {
        const dueDate = inv.due_date || inv.invoice_date;
        const dueDateObj = new Date(dueDate);
        const diffMs = today.getTime() - dueDateObj.getTime();
        const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        return {
          id: inv.id,
          invoiceNumber: inv.invoice_number || "N/A",
          customer: (inv.customer as any)?.name || "Unknown",
          total: Number(inv.total) || 0,
          dueDate: dueDate,
          invoiceDate: inv.invoice_date || "",
          daysOverdue,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const bucketDefs = [
      { label: "Current", min: 0, max: 30, colorClass: "text-green-600", badgeClass: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
      { label: "30–60 days", min: 30, max: 60, colorClass: "text-yellow-600", badgeClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" },
      { label: "60–90 days", min: 60, max: 90, colorClass: "text-orange-600", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
      { label: "90+ days", min: 90, max: Infinity, colorClass: "text-red-600", badgeClass: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
    ];

    const result: AgingBucket[] = bucketDefs.map((def) => ({
      ...def,
      total: 0,
      invoices: [],
    }));

    for (const inv of unpaid) {
      const bucket = result.find((b) => inv.daysOverdue >= b.min && inv.daysOverdue < b.max);
      if (bucket) {
        bucket.total += inv.total;
        bucket.invoices.push(inv);
      }
    }

    const totalOutstanding = unpaid.reduce((s, inv) => s + inv.total, 0);
    const hasOverdue90 = result[3].total > 0;

    return { buckets: result, totalOutstanding, hasOverdue90 };
  }, [invoices, todayStr]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading invoice data...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <FileText className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">No invoices found.</p>
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
                <h1 className="font-semibold text-xl">Aged Debtors</h1>
                <p className="text-sm text-muted-foreground">
                  Outstanding invoices by age
                </p>
              </div>
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* 90+ Warning */}
          {hasOverdue90 && (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-red-800 dark:text-red-200">
                      Overdue Invoices (90+ days)
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      You have {eur(buckets[3].total)} outstanding for more than 90 days.
                      Consider following up with these customers or reviewing for bad debt provision.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden ring-2 ring-primary/20">
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className="text-3xl font-bold font-mono tabular-nums">{eur(totalOutstanding)}</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {buckets.map((bucket, i) => (
                  <div key={i} className="text-center">
                    <p className="text-xs text-muted-foreground">{bucket.label}</p>
                    <p className={`text-sm font-bold font-mono tabular-nums ${bucket.colorClass}`}>
                      {eur(bucket.total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bucket.invoices.length} inv
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Invoice List */}
          {buckets.map((bucket, bi) =>
            bucket.invoices.length > 0 ? (
              <Card key={bi} className="border-0 shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className={bucket.colorClass}>
                      <Clock className="w-5 h-5" />
                    </span>
                    {bucket.label}
                    <Badge className={`ml-auto ${bucket.badgeClass}`}>
                      {eur(bucket.total)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {bucket.invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-2 text-sm border-b last:border-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{inv.invoiceNumber}</span>
                          <span className="text-muted-foreground">{inv.customer}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Due: {inv.dueDate}
                          {inv.daysOverdue > 0 && (
                            <span className={`ml-2 ${bucket.colorClass}`}>
                              {inv.daysOverdue} days overdue
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="font-mono tabular-nums font-medium">{eur(inv.total)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null
          )}

          {totalOutstanding === 0 && (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
              <CardContent className="pt-6 text-center">
                <FileText className="w-10 h-10 text-green-600 mx-auto mb-3" />
                <p className="font-medium text-green-600">All invoices paid</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No outstanding amounts to report.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
          <div className="text-center text-xs text-muted-foreground py-6">
            <p>Based on invoice due dates. Review for accuracy.</p>
          </div>
        </main>
      </div>
    </AppLayout>
  );
};

export default AgedDebtors;
