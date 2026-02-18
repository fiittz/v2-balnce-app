import { useState } from "react";
import { Download, FileSpreadsheet, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useSalesTaxAudit } from "@/hooks/useSalesTaxAudit";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, subMonths } from "date-fns";

type PeriodOption =
  | "current_year"
  | "last_year"
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "jan_feb"
  | "mar_apr"
  | "may_jun"
  | "jul_aug"
  | "sep_oct"
  | "nov_dec"
  | "custom";

const periodOptions: { value: PeriodOption; label: string }[] = [
  { value: "current_year", label: "Current Year (2024)" },
  { value: "last_year", label: "Last Year (2023)" },
  { value: "jan_feb", label: "Jan-Feb VAT Period" },
  { value: "mar_apr", label: "Mar-Apr VAT Period" },
  { value: "may_jun", label: "May-Jun VAT Period" },
  { value: "jul_aug", label: "Jul-Aug VAT Period" },
  { value: "sep_oct", label: "Sep-Oct VAT Period" },
  { value: "nov_dec", label: "Nov-Dec VAT Period" },
  { value: "q1", label: "Q1 (Jan-Mar)" },
  { value: "q2", label: "Q2 (Apr-Jun)" },
  { value: "q3", label: "Q3 (Jul-Sep)" },
  { value: "q4", label: "Q4 (Oct-Dec)" },
];

function getPeriodDates(period: PeriodOption, year: number): { start: Date; end: Date } {
  switch (period) {
    case "current_year":
      return { start: startOfYear(new Date(year, 0)), end: endOfYear(new Date(year, 0)) };
    case "last_year":
      return { start: startOfYear(new Date(year - 1, 0)), end: endOfYear(new Date(year - 1, 0)) };
    case "jan_feb":
      return { start: new Date(year, 0, 1), end: new Date(year, 1, 28) };
    case "mar_apr":
      return { start: new Date(year, 2, 1), end: new Date(year, 3, 30) };
    case "may_jun":
      return { start: new Date(year, 4, 1), end: new Date(year, 5, 30) };
    case "jul_aug":
      return { start: new Date(year, 6, 1), end: new Date(year, 7, 31) };
    case "sep_oct":
      return { start: new Date(year, 8, 1), end: new Date(year, 9, 31) };
    case "nov_dec":
      return { start: new Date(year, 10, 1), end: new Date(year, 11, 31) };
    case "q1":
      return { start: new Date(year, 0, 1), end: new Date(year, 2, 31) };
    case "q2":
      return { start: new Date(year, 3, 1), end: new Date(year, 5, 30) };
    case "q3":
      return { start: new Date(year, 6, 1), end: new Date(year, 8, 30) };
    case "q4":
      return { start: new Date(year, 9, 1), end: new Date(year, 11, 31) };
    default:
      return { start: startOfYear(new Date(year, 0)), end: endOfYear(new Date(year, 0)) };
  }
}

interface SalesTaxAuditExportProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function SalesTaxAuditExport({ variant = "outline", size = "default", className }: SalesTaxAuditExportProps) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodOption>("current_year");
  const [year, setYear] = useState(new Date().getFullYear());
  const { exportReport, isExporting } = useSalesTaxAudit();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleExport = async () => {
    const { start, end } = getPeriodDates(period, year);
    await exportReport(start, end);
    setOpen(false);
  };

  const { start, end } = getPeriodDates(period, year);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export Sales Tax Audit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Sales Tax Audit Report
          </DialogTitle>
          <DialogDescription>
            Export your transactions grouped by VAT rate for accounting purposes. This report follows the standard Irish
            VAT audit format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Year</Label>
            <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Period</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              Selected Period
            </div>
            <div className="font-medium">
              {format(start, "d MMMM yyyy")} — {format(end, "d MMMM yyyy")}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Report includes:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>All expenses grouped by VAT rate (23%, 13.5%, 0%, Exempt)</li>
              <li>All sales/invoices grouped by VAT rate</li>
              <li>Totals per section and grand totals</li>
              <li>Net VAT payable calculation</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>Exporting...</>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
