import { useState } from "react";
import { MapPin, ChevronDown, ChevronUp, Calendar, Info, FileText, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { DetectedTrip } from "@/lib/tripDetection";
import type { InvoiceTrip } from "@/hooks/useInvoiceTripMatcher";

interface TripReviewPanelProps {
  trips: DetectedTrip[];
  onConfirm: (confirmedTrips: DetectedTrip[]) => void;
  onSkip: () => void;
  isProcessing?: boolean;
  /** Invoice-trip matches to display alongside detected trips */
  invoiceMatches?: InvoiceTrip[];
}

const TripReviewPanel = ({
  trips,
  onConfirm,
  onSkip,
  isProcessing = false,
  invoiceMatches = [],
}: TripReviewPanelProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(trips.map((t) => t.id))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const confirmed = trips.filter((t) => selectedIds.has(t.id));
    if (confirmed.length > 0) onConfirm(confirmed);
  };

  // Find invoice match for a given trip by matching trip ID
  const getInvoiceMatch = (trip: DetectedTrip): InvoiceTrip | undefined => {
    return invoiceMatches.find((m) => m.matchedTrip?.id === trip.id);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);

  const formatDate = (start: string, end: string) => {
    const fmt = (d: string) => {
      const dt = new Date(d + "T00:00:00");
      return dt.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
    };
    if (start === end) return fmt(start);
    return `${fmt(start)} – ${fmt(end)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">
            {trips.length} potential business trip{trips.length > 1 ? "s" : ""} detected
          </p>
          <p className="text-xs text-blue-700 mt-0.5">
            We found transaction clusters that look like travel away from your base.
            Confirm to re-categorize them as travel &amp; subsistence.
          </p>
        </div>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {trips.map((trip) => {
          const isSelected = selectedIds.has(trip.id);
          const isExpanded = expandedId === trip.id;

          return (
            <div
              key={trip.id}
              className={`border rounded-xl overflow-hidden transition-colors ${
                isSelected ? "border-blue-300 bg-blue-50/50" : "border-border"
              }`}
            >
              {/* Trip header */}
              <div className="flex items-center gap-3 p-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggle(trip.id)}
                  disabled={isProcessing}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      <MapPin className="w-3 h-3" />
                      {trip.location}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {formatDate(trip.startDate, trip.endDate)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {trip.transactions.length} transaction{trip.transactions.length > 1 ? "s" : ""} &middot;{" "}
                    <span className="font-medium text-foreground">
                      &euro;{trip.totalSpend.toFixed(2)}
                    </span>
                  </p>
                  {(() => {
                    const match = getInvoiceMatch(trip);
                    if (!match) return null;
                    return (
                      <div className="mt-1.5 space-y-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          <FileText className="w-3 h-3" />
                          Linked to {match.invoiceNumber} — {match.jobLocation} job
                        </span>
                        {match.suggestedSubsistence.allowance > 0 && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            Subsistence: {match.suggestedSubsistence.nights > 0
                              ? `${match.suggestedSubsistence.nights} night${match.suggestedSubsistence.nights > 1 ? "s" : ""} @ €191 = ${formatCurrency(match.suggestedSubsistence.allowance)}`
                              : `${match.suggestedSubsistence.days} day${match.suggestedSubsistence.days > 1 ? "s" : ""} @ €39.08 = ${formatCurrency(match.suggestedSubsistence.allowance)}`
                            }
                          </p>
                        )}
                        {match.suggestedMileage.distanceKm > 0 && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Route className="w-3 h-3" />
                            Mileage: {match.suggestedMileage.distanceKm} km @ {formatCurrency(match.suggestedMileage.allowance)}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  className="p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setExpandedId(isExpanded ? null : trip.id)}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Expanded transaction list */}
              {isExpanded && (
                <div className="border-t divide-y text-xs">
                  {trip.transactions.map((txn) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between px-3 py-2 pl-10"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{txn.description}</p>
                        <span className="text-muted-foreground capitalize">
                          {txn.expenseType}
                        </span>
                      </div>
                      <span className="font-medium text-red-600 shrink-0 ml-2">
                        -&euro;{Math.abs(txn.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* VAT note */}
      <p className="text-[11px] text-muted-foreground leading-tight">
        Note: Hotel/accommodation VAT is <strong>not</strong> deductible under
        Section 60(2)(a)(i) of the VAT Consolidation Act 2010, but the expense
        itself is allowable for Corporation Tax.
      </p>

      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          onClick={onSkip}
          className="flex-1"
          disabled={isProcessing}
        >
          Skip
        </Button>
        <Button
          onClick={handleConfirm}
          className="flex-1"
          disabled={isProcessing || selectedIds.size === 0}
        >
          {isProcessing
            ? "Updating..."
            : `Confirm ${selectedIds.size} Trip${selectedIds.size > 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
};

export default TripReviewPanel;
