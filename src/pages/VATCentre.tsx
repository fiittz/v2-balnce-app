import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck,
  AlertCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";
import {
  useVATSummary,
  useVATReturns,
  useCreateVATReturn,
  useUpdateVATReturn,
  getVATPeriod,
  getVATPeriodsForYear,
} from "@/hooks/useVATData";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import AppLayout from "@/components/layout/AppLayout";
import { VATFinalisationWizard } from "@/components/vat/VATFinalisationWizard";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import { Globe, MessageSquare } from "lucide-react";

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);

const VATCentre = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [expandedCard, setExpandedCard] = useState<"sales" | "purchases" | null>(null);

  // Get all periods for the year
  const periods = useMemo(() => getVATPeriodsForYear(selectedYear), [selectedYear]);
  const currentPeriod = getVATPeriod();

  // Find the current period index
  const currentPeriodIndex = periods.findIndex((p) => p.periodStart === currentPeriod.periodStart);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(currentPeriodIndex >= 0 ? currentPeriodIndex : 0);

  const standardPeriod = periods[selectedPeriodIndex];

  // Determine which period to use
  const selectedPeriod = useMemo(() => {
    if (useCustomPeriod && customStartDate && customEndDate) {
      const startStr = format(customStartDate, "yyyy-MM-dd");
      const endStr = format(customEndDate, "yyyy-MM-dd");
      // Due date is 23 days after period end for Irish VAT
      const dueDate = format(addDays(customEndDate, 23), "yyyy-MM-dd");
      return {
        periodStart: startStr,
        periodEnd: endStr,
        dueDate: dueDate,
        periodLabel: `${format(customStartDate, "d MMM")} - ${format(customEndDate, "d MMM yyyy")}`,
      };
    }
    return standardPeriod;
  }, [useCustomPeriod, customStartDate, customEndDate, standardPeriod]);

  // Fetch VAT data
  const { data: vatSummary, isLoading: summaryLoading } = useVATSummary(
    selectedPeriod?.periodStart || "",
    selectedPeriod?.periodEnd || "",
  );
  const { data: vatReturns, isLoading: returnsLoading } = useVATReturns();
  const createVATReturn = useCreateVATReturn();
  const updateVATReturn = useUpdateVATReturn();
  const { data: onboardingSettings } = useOnboardingSettings();
  const euTradeEnabled = onboardingSettings?.eu_trade_enabled;
  const [euCardExpanded, setEuCardExpanded] = useState(false);

  // Find existing return for this period
  const existingReturn = vatReturns?.find(
    (r) => r.period_start === selectedPeriod?.periodStart && r.period_end === selectedPeriod?.periodEnd,
  );

  const getStatus = () => {
    if (existingReturn) return existingReturn.status;
    return "open";
  };

  const status = getStatus();
  const daysUntilDue = selectedPeriod ? differenceInDays(parseISO(selectedPeriod.dueDate), new Date()) : 0;

  const statusConfig = {
    open: { color: "bg-primary text-primary-foreground", label: "Open", icon: Clock },
    draft: { color: "bg-amber-100 text-amber-800", label: "Draft", icon: FileText },
    ready: { color: "bg-blue-100 text-blue-800", label: "Ready", icon: FileCheck },
    submitted: { color: "bg-green-100 text-green-800", label: "Submitted", icon: CheckCircle2 },
    paid: { color: "bg-green-100 text-green-800", label: "Paid", icon: CheckCircle2 },
  };

  const currentStatus = statusConfig[status as keyof typeof statusConfig] || statusConfig.open;
  const StatusIcon = currentStatus.icon;

  const handlePrepareReturn = async () => {
    if (!selectedPeriod || !vatSummary) return;

    await createVATReturn.mutateAsync({
      periodStart: selectedPeriod.periodStart,
      periodEnd: selectedPeriod.periodEnd,
      dueDate: selectedPeriod.dueDate,
      vatOnSales: vatSummary.vatOnSales,
      vatOnPurchases: vatSummary.vatOnPurchases,
    });
  };

  const handleMarkReady = async () => {
    if (!existingReturn) return;
    await updateVATReturn.mutateAsync({ id: existingReturn.id, status: "ready" });
  };

  const handleMarkSubmitted = async () => {
    if (!existingReturn) return;
    await updateVATReturn.mutateAsync({ id: existingReturn.id, status: "submitted" });
  };

  const handleMarkPaid = async () => {
    if (!existingReturn) return;
    await updateVATReturn.mutateAsync({ id: existingReturn.id, status: "paid" });
  };

  const isLoading = summaryLoading || returnsLoading;

  return (
    <AppLayout>
      {/* Header */}
      <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="w-24" />
          <div className="flex-1 text-center">
            <h1 className="font-semibold text-xl">VAT Centre</h1>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="px-4 md:px-6 py-6 max-w-4xl mx-auto md:mx-0 space-y-5">
        {/* Period Selector */}
        <div className="bg-card rounded-2xl p-4 card-shadow animate-fade-in">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="custom-period" className="text-sm text-muted-foreground">
                Custom Period
              </Label>
            </div>
            <Switch id="custom-period" checked={useCustomPeriod} onCheckedChange={setUseCustomPeriod} />
          </div>

          {useCustomPeriod ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Select custom date range:</p>
              <div className="flex flex-wrap gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal min-w-[140px]">
                      <Calendar className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "d MMM yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal min-w-[140px]">
                      <Calendar className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "d MMM yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      disabled={(date) => (customStartDate ? date < customStartDate : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {customStartDate && customEndDate && (
                <p className="text-lg font-semibold">
                  {format(customStartDate, "d MMM")} - {format(customEndDate, "d MMM yyyy")}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">VAT Period</p>
                <Select
                  value={selectedPeriodIndex.toString()}
                  onValueChange={(v) => setSelectedPeriodIndex(parseInt(v))}
                >
                  <SelectTrigger className="h-12 text-lg font-semibold border-0 p-0 shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p, idx) => (
                      <SelectItem key={p.periodStart} value={idx.toString()}>
                        {p.periodLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 ${currentStatus.color}`}
                >
                  <StatusIcon className="w-4 h-4" />
                  {currentStatus.label}
                </span>
              </div>
            </div>
          )}

          {/* Status badge for custom period */}
          {useCustomPeriod && selectedPeriod && (
            <div className="mt-3 flex items-center gap-3">
              <span
                className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 ${currentStatus.color}`}
              >
                <StatusIcon className="w-4 h-4" />
                {currentStatus.label}
              </span>
            </div>
          )}

          {/* Due date warning */}
          {daysUntilDue > 0 && daysUntilDue <= 14 && status !== "submitted" && status !== "paid" && (
            <div className="mt-3 flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Due in {daysUntilDue} days ({selectedPeriod ? format(parseISO(selectedPeriod.dueDate), "d MMM") : ""})
              </span>
            </div>
          )}
        </div>

        {/* VAT Summary Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {/* VAT on Sales */}
            <div
              className="bg-card rounded-2xl card-shadow animate-fade-in cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
              style={{ animationDelay: "0.05s" }}
              onClick={() => setExpandedCard(expandedCard === "sales" ? null : "sales")}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-muted-foreground font-medium">VAT on Sales</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{vatSummary?.salesCount || 0} invoices</span>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform ${expandedCard === "sales" ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>
                <p className="text-3xl font-bold">€{(vatSummary?.vatOnSales || 0).toFixed(2)}</p>
                <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{
                      width:
                        vatSummary?.vatOnSales && vatSummary?.vatOnPurchases
                          ? `${Math.min(100, (vatSummary.vatOnSales / (vatSummary.vatOnSales + vatSummary.vatOnPurchases)) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
              {expandedCard === "sales" && vatSummary?.salesDetails && (
                <div className="border-t border-border px-6 pb-4 max-h-80 overflow-y-auto">
                  {vatSummary.salesDetails.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3">No VAT-bearing sales in this period</p>
                  ) : (
                    vatSummary.salesDetails.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="text-sm font-medium truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(item.date), "d MMM yyyy")}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono">{eur(item.vatAmount)}</p>
                          <p className="text-xs text-muted-foreground">of {eur(item.amount)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* VAT on Purchases */}
            <div
              className="bg-card rounded-2xl card-shadow animate-fade-in cursor-pointer hover:ring-2 hover:ring-green-500/20 transition-all"
              style={{ animationDelay: "0.1s" }}
              onClick={() => setExpandedCard(expandedCard === "purchases" ? null : "purchases")}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-green-600" />
                    <h3 className="text-muted-foreground font-medium">VAT on Purchases</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{vatSummary?.purchasesCount || 0} expenses</span>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform ${expandedCard === "purchases" ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>
                <p className="text-3xl font-bold text-green-600">€{(vatSummary?.vatOnPurchases || 0).toFixed(2)}</p>
                <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{
                      width:
                        vatSummary?.vatOnSales && vatSummary?.vatOnPurchases
                          ? `${Math.min(100, (vatSummary.vatOnPurchases / (vatSummary.vatOnSales + vatSummary.vatOnPurchases)) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
              {expandedCard === "purchases" && vatSummary?.purchaseDetails && (
                <div className="border-t border-border px-6 pb-4 max-h-80 overflow-y-auto">
                  {vatSummary.purchaseDetails.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3">No recoverable VAT on purchases in this period</p>
                  ) : (
                    vatSummary.purchaseDetails.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="text-sm font-medium truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(item.date), "d MMM yyyy")}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono text-green-600">{eur(item.vatAmount)}</p>
                          <p className="text-xs text-muted-foreground">of {eur(item.amount)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Net VAT */}
            <div
              className="bg-foreground rounded-2xl p-6 card-shadow animate-fade-in"
              style={{ animationDelay: "0.15s" }}
            >
              <h3 className="text-background/70 mb-2">Net VAT</h3>
              <p className={`text-4xl font-bold ${vatSummary?.isRefund ? "text-green-400" : "text-primary"}`}>
                {vatSummary?.isRefund ? "-" : ""}€{Math.abs(vatSummary?.netVat || 0).toFixed(2)}
              </p>
              <p className="text-background/60 mt-2">
                {vatSummary?.isRefund ? "Refund from Revenue" : "Amount owed to Revenue"}
              </p>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            VAT Timeline
          </h2>
          <div className="space-y-4">
            {[
              {
                date: selectedPeriod ? format(parseISO(selectedPeriod.periodStart), "d MMM") : "",
                event: "Period Started",
                active: status === "open",
              },
              {
                date: selectedPeriod ? format(parseISO(selectedPeriod.periodEnd), "d MMM") : "",
                event: "Period End",
                active: status === "draft",
              },
              {
                date: selectedPeriod ? format(parseISO(selectedPeriod.dueDate), "d MMM") : "",
                event: "Filing Deadline",
                active: status === "ready",
                highlight: daysUntilDue <= 7 && daysUntilDue > 0,
              },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <div
                  className={`w-3 h-3 rounded-full ${item.active ? "bg-primary" : status === "submitted" || status === "paid" ? "bg-green-500" : "bg-muted"}`}
                />
                <div className="flex-1">
                  <p className="font-medium">{item.event}</p>
                  <p className="text-sm text-muted-foreground">{item.date}</p>
                </div>
                {item.active && (
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">Current</span>
                )}
                {item.highlight && !item.active && (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">Soon</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {status === "open" && (
            <Button
              onClick={handlePrepareReturn}
              disabled={createVATReturn.isPending || !vatSummary}
              className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 rounded-xl font-semibold text-base"
            >
              {createVATReturn.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <FileText className="w-5 h-5 mr-2" />
              )}
              Prepare VAT Return
            </Button>
          )}

          {status === "draft" && (
            <Button
              onClick={() => setWizardOpen(true)}
              className="w-full h-14 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-semibold text-base"
            >
              <FileCheck className="w-5 h-5 mr-2" />
              Generate VAT Report
            </Button>
          )}

          {status === "ready" && (
            <Button
              onClick={handleMarkSubmitted}
              disabled={updateVATReturn.isPending}
              className="w-full h-14 bg-green-600 text-white hover:bg-green-700 rounded-xl font-semibold text-base"
            >
              {updateVATReturn.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5 mr-2" />
              )}
              Mark as Submitted to Revenue
            </Button>
          )}

          {status === "submitted" && (
            <Button
              onClick={handleMarkPaid}
              disabled={updateVATReturn.isPending}
              className="w-full h-14 bg-green-600 text-white hover:bg-green-700 rounded-xl font-semibold text-base"
            >
              {updateVATReturn.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5 mr-2" />
              )}
              Mark as Paid
            </Button>
          )}

          <Button
            onClick={() => navigate("/bank")}
            variant="outline"
            className="w-full h-14 rounded-xl border-2 border-foreground text-foreground hover:bg-foreground hover:text-background font-semibold text-base"
          >
            View Transactions
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        {/* EU & International Trade Card */}
        {euTradeEnabled && (
          <div className="bg-card rounded-2xl card-shadow animate-fade-in" style={{ animationDelay: "0.25s" }}>
            <button
              onClick={() => setEuCardExpanded(!euCardExpanded)}
              className="w-full p-6 text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-blue-600" />
                <div>
                  <h2 className="font-semibold text-lg">EU & International Trade</h2>
                  <p className="text-sm text-muted-foreground">Cross-border VAT treatment</p>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${euCardExpanded ? "rotate-180" : ""}`}
              />
            </button>
            {euCardExpanded && (
              <div className="border-t border-border px-6 pb-6 space-y-4">
                {/* Active trade types */}
                <div className="space-y-2 pt-4">
                  <p className="text-sm font-medium text-muted-foreground">Active trade types:</p>
                  <div className="flex flex-wrap gap-2">
                    {onboardingSettings?.sells_goods_to_eu && (
                      <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                        Sells goods to EU
                      </span>
                    )}
                    {onboardingSettings?.buys_goods_from_eu && (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                        Buys goods from EU
                      </span>
                    )}
                    {onboardingSettings?.sells_services_to_eu && (
                      <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                        Sells services to EU
                      </span>
                    )}
                    {onboardingSettings?.buys_services_from_eu && (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                        Buys services from EU
                      </span>
                    )}
                    {onboardingSettings?.sells_digital_services_b2c && (
                      <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">
                        Digital B2C (OSS)
                      </span>
                    )}
                    {onboardingSettings?.sells_to_non_eu && (
                      <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                        Exports (non-EU)
                      </span>
                    )}
                    {onboardingSettings?.buys_from_non_eu && (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                        Imports (non-EU)
                      </span>
                    )}
                  </div>
                </div>

                {/* Key reminders */}
                <div className="space-y-2 bg-muted/50 rounded-xl p-4">
                  <p className="text-sm font-medium">Key reminders:</p>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    {(onboardingSettings?.sells_goods_to_eu || onboardingSettings?.sells_services_to_eu) && (
                      <li>VIES return due quarterly — 23rd of month after quarter-end</li>
                    )}
                    {(onboardingSettings?.sells_goods_to_eu || onboardingSettings?.buys_goods_from_eu) && (
                      <li>Intrastat required if arrivals or dispatches exceed €750,000/year</li>
                    )}
                    {onboardingSettings?.sells_digital_services_b2c && (
                      <li>OSS applies if EU B2C sales exceed €10,000 — charge destination country VAT</li>
                    )}
                    {onboardingSettings?.uses_postponed_accounting && (
                      <li>Postponed accounting (PA1) active — import VAT self-accounted on VAT3</li>
                    )}
                    <li>Share your IE VAT number with EU suppliers for zero-rated invoicing</li>
                  </ul>
                </div>

                {/* Ask Balance Assistant */}
                <button
                  onClick={() => {
                    // Trigger chat widget by dispatching a custom event
                    window.dispatchEvent(
                      new CustomEvent("open-chat", { detail: { message: "Explain my EU VAT obligations" } }),
                    );
                  }}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <MessageSquare className="w-4 h-4" />
                  Ask Balance Assistant about EU VAT
                </button>
              </div>
            )}
          </div>
        )}

        {/* Previous Returns */}
        {vatReturns && vatReturns.length > 0 && (
          <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in">
            <h2 className="font-semibold text-lg mb-4">Previous Returns</h2>
            <div className="space-y-3">
              {vatReturns.slice(0, 5).map((ret) => {
                const retStatus = statusConfig[ret.status as keyof typeof statusConfig];
                const RetIcon = retStatus?.icon || Clock;
                return (
                  <div
                    key={ret.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        {format(parseISO(ret.period_start), "MMM")} - {format(parseISO(ret.period_end), "MMM yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground">Net: €{(ret.vat_due ?? 0).toFixed(2)}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${retStatus?.color || ""}`}
                    >
                      <RetIcon className="w-3 h-3" />
                      {retStatus?.label || ret.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VAT Finalisation Wizard */}
        {existingReturn && selectedPeriod && (
          <VATFinalisationWizard
            open={wizardOpen}
            onClose={() => setWizardOpen(false)}
            onReportGenerated={() => {
              // Navigate to reports page with VAT report context
              navigate(`/reports?type=vat&period=${selectedPeriod.periodStart}`);
            }}
            vatReturnId={existingReturn.id}
            periodStart={selectedPeriod.periodStart}
            periodEnd={selectedPeriod.periodEnd}
            periodLabel={selectedPeriod.periodLabel}
          />
        )}
      </main>
    </AppLayout>
  );
};

export default VATCentre;
