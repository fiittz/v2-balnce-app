import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Car,
  Utensils,
  ChevronDown,
  Loader2,
  AlertTriangle,
  FileText,
  Info,
  Hotel,
  Building2,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useInvoiceTripMatcher } from "@/hooks/useInvoiceTripMatcher";

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);

const TripClaimsManager = () => {
  const navigate = useNavigate();
  const { invoiceTrips, isLoading } = useInvoiceTripMatcher();
  const [openTrips, setOpenTrips] = useState<Set<string>>(new Set());

  // Read travel settings for display
  let workshopDisplay = "";
  let homeCountyDisplay = "";
  let radiusDisplay = 8;
  try {
    const extra = localStorage.getItem("business_onboarding_extra");
    if (extra) {
      const biz = JSON.parse(extra)?.businesses?.[0];
      workshopDisplay = biz?.workshop_address || "";
      homeCountyDisplay = biz?.place_of_work || "";
      radiusDisplay = biz?.subsistence_radius_km || 8;
    }
  } catch {
    /* ignore */
  }

  const toggleTrip = (id: string) => {
    setOpenTrips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Summary calculations
  const totalMileage = invoiceTrips.reduce((s, t) => s + t.suggestedMileage.allowance, 0);
  const totalSubsistence = invoiceTrips.reduce((s, t) => s + t.suggestedSubsistence.allowance, 0);
  const totalClaimable = totalMileage + totalSubsistence;
  const totalCsvExpenses = invoiceTrips.reduce((s, t) => s + t.totalExpensesFromCsv, 0);
  const totalDlaBalance = invoiceTrips.reduce((s, t) => s + t.directorsLoanBalance, 0);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Matching invoices to trips...</span>
          </div>
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
              <Button variant="ghost" size="icon" onClick={() => navigate("/tax")} className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1">
                <h1 className="font-semibold text-xl">Trip Claims</h1>
                <p className="text-sm text-muted-foreground">Revenue civil service mileage & subsistence rates</p>
              </div>
              <MapPin className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* Summary */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden ring-2 ring-primary/20">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Trips</p>
                  <p className="text-2xl font-bold">{invoiceTrips.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mileage</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-green-600">{eur(totalMileage)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subsistence</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-blue-600">{eur(totalSubsistence)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Directors Loan Account */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Directors Loan Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue allowance (mileage + subsistence)</span>
                  <span className="font-mono tabular-nums font-medium">{eur(totalClaimable)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trip expenses paid (from bank/CSV)</span>
                  <span className="font-mono tabular-nums font-medium text-red-600">-{eur(totalCsvExpenses)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-semibold">{totalDlaBalance >= 0 ? "Owed to director" : "Owed to company"}</span>
                  <span
                    className={`font-mono tabular-nums text-xl font-bold ${totalDlaBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {eur(Math.abs(totalDlaBalance))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info card */}
          <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-1">Revenue Civil Service Rates</p>
                  {workshopDisplay && (
                    <p className="mb-1">
                      <strong>Workshop:</strong> {workshopDisplay}
                      {homeCountyDisplay && (
                        <>
                          {" "}
                          &bull; <strong>Home:</strong> {homeCountyDisplay}
                        </>
                      )}{" "}
                      &bull; <strong>Subsistence radius:</strong> {radiusDisplay}km
                    </p>
                  )}
                  <p className="mb-1">
                    <strong>Overnight</strong> (outside {homeCountyDisplay || "home county"}): &euro;191.00/night flat,
                    or actual hotel + &euro;39.08/night meals if receipts exist.
                  </p>
                  <p className="mb-1">
                    <strong>Subsistence</strong> (beyond {radiusDisplay}km from workshop): &euro;39.08/day (10+ hours)
                    or &euro;16.29 (5-10 hours).
                  </p>
                  <p>
                    <strong>Mileage:</strong> 43.22c/km (first 1,500km), then banded rates. Personal vehicle only.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trip Cards */}
          {invoiceTrips.length === 0 ? (
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
              <CardContent className="pt-6 text-center">
                <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No trips detected.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Trips are matched from invoices with customer addresses outside your base location.
                </p>
              </CardContent>
            </Card>
          ) : (
            invoiceTrips.map((trip) => (
              <Collapsible
                key={trip.invoiceId}
                open={openTrips.has(trip.invoiceId)}
                onOpenChange={() => toggleTrip(trip.invoiceId)}
              >
                <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="rounded-full">
                              <FileText className="w-3 h-3 mr-1" />
                              {trip.invoiceNumber}
                            </Badge>
                            <Badge variant="secondary" className="rounded-full">
                              <MapPin className="w-3 h-3 mr-1" />
                              {trip.jobLocation}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {trip.customerName} &bull; {trip.invoiceDate}
                          </p>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform shrink-0 ${
                            openTrips.has(trip.invoiceId) ? "rotate-180" : ""
                          }`}
                        />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>

                  {/* Always visible summary row */}
                  <CardContent className="pt-0 pb-3">
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      {trip.suggestedMileage.allowance > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Car className="w-4 h-4" />
                          {eur(trip.suggestedMileage.allowance)}
                          <span className="text-muted-foreground">({trip.suggestedMileage.distanceKm}km)</span>
                        </span>
                      )}
                      {trip.vehicleType === "company_vehicle" && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Building2 className="w-4 h-4" />
                          Company vehicle (no mileage)
                        </span>
                      )}
                      {trip.suggestedSubsistence.allowance > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Utensils className="w-4 h-4" />
                          {eur(trip.suggestedSubsistence.allowance)}
                        </span>
                      )}
                      {trip.overnightStayDetected && (
                        <span className="flex items-center gap-1 text-purple-600">
                          <Hotel className="w-4 h-4" />
                          Overnight detected
                        </span>
                      )}
                    </div>
                  </CardContent>

                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-2 border-t">
                      <div className="pt-3 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Vehicle</span>
                          <span className="font-medium capitalize">{trip.vehicleType.replace(/_/g, " ")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Distance (return)</span>
                          <span className="font-mono tabular-nums">{trip.suggestedMileage.distanceKm} km</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Mileage allowance</span>
                          <span className="font-mono tabular-nums text-green-600">
                            {trip.vehicleType === "company_vehicle"
                              ? "N/A — company vehicle"
                              : eur(trip.suggestedMileage.allowance)}
                          </span>
                        </div>
                        {trip.suggestedSubsistence.nights > 0 && trip.suggestedSubsistence.method === "vouched" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Overnight stays</span>
                              <span className="font-mono tabular-nums">{trip.suggestedSubsistence.nights}</span>
                            </div>
                            <div className="flex justify-between ml-4">
                              <span className="text-xs text-muted-foreground">Accommodation (receipts from bank)</span>
                              <span className="font-mono tabular-nums text-blue-600">
                                {eur(trip.suggestedSubsistence.accommodationActual)}
                              </span>
                            </div>
                            <div className="flex justify-between ml-4">
                              <span className="text-xs text-muted-foreground">
                                + Meals @ &euro;39.08/night &times; {trip.suggestedSubsistence.nights}
                              </span>
                              <span className="font-mono tabular-nums text-blue-600">
                                {eur(trip.suggestedSubsistence.mealsAllowance)}
                              </span>
                            </div>
                          </>
                        )}
                        {trip.suggestedSubsistence.nights > 0 && trip.suggestedSubsistence.method === "flat" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Overnight stays</span>
                              <span className="font-mono tabular-nums">{trip.suggestedSubsistence.nights}</span>
                            </div>
                            <div className="flex justify-between ml-4">
                              <span className="text-xs text-muted-foreground">
                                @ &euro;191.00/night (accommodation + meals)
                              </span>
                              <span className="font-mono tabular-nums text-blue-600">
                                {eur(trip.suggestedSubsistence.nights * 191)}
                              </span>
                            </div>
                          </>
                        )}
                        {trip.hotelTransactions.length > 0 && (
                          <div className="ml-4 space-y-0.5">
                            {trip.hotelTransactions.map((desc, i) => (
                              <p key={i} className="text-xs text-purple-600 flex items-center gap-1">
                                <Hotel className="w-3 h-3" />
                                {desc}
                              </p>
                            ))}
                          </div>
                        )}
                        {trip.suggestedSubsistence.days > 0 && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Day trips</span>
                              <span className="font-mono tabular-nums">{trip.suggestedSubsistence.days}</span>
                            </div>
                            <div className="flex justify-between ml-4">
                              <span className="text-xs text-muted-foreground">@ &euro;39.08/day (10+ hours away)</span>
                              <span className="font-mono tabular-nums text-blue-600">
                                {eur(trip.suggestedSubsistence.days * 39.08)}
                              </span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between pt-1 border-t border-dashed">
                          <span className="text-muted-foreground font-medium">Subsistence total</span>
                          <span className="font-mono tabular-nums text-blue-600 font-medium">
                            {eur(trip.suggestedSubsistence.allowance)}
                          </span>
                        </div>

                        {/* Trip expenses from CSV */}
                        {trip.tripExpenses.length > 0 && (
                          <div className="border-t mt-3 pt-3 space-y-1.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Trip expenses from bank
                            </p>
                            {trip.tripExpenses.map((exp, i) => (
                              <div key={i} className="flex justify-between">
                                <span
                                  className="text-muted-foreground text-xs truncate max-w-[200px]"
                                  title={exp.description}
                                >
                                  {exp.description}
                                </span>
                                <span className="font-mono tabular-nums text-red-600">{eur(exp.amount)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between pt-1 border-t border-dashed">
                              <span className="text-muted-foreground font-medium">Total expenses</span>
                              <span className="font-mono tabular-nums text-red-600 font-medium">
                                {eur(trip.totalExpensesFromCsv)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* DLA balance for this trip */}
                        <div className="border-t mt-3 pt-3 space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Revenue allowance</span>
                            <span className="font-mono tabular-nums">{eur(trip.totalRevenueAllowance)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Less: expenses paid</span>
                            <span className="font-mono tabular-nums text-red-600">
                              -{eur(trip.totalExpensesFromCsv)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-1 border-t">
                            <span className="font-semibold">
                              {trip.directorsLoanBalance >= 0 ? "Owed to director" : "Owed to company"}
                            </span>
                            <span
                              className={`font-mono tabular-nums font-bold ${trip.directorsLoanBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {eur(Math.abs(trip.directorsLoanBalance))}
                            </span>
                          </div>
                        </div>

                        {trip.matchedTrip && (
                          <div className="border-t mt-2 pt-2">
                            <p className="text-xs text-muted-foreground">
                              Matched trip: {trip.matchedTrip.location} ({trip.matchedTrip.startDate} to{" "}
                              {trip.matchedTrip.endDate})
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))
          )}

          {/* Disclaimer */}
          <div className="text-center text-xs text-muted-foreground py-6 space-y-1">
            <p>Mileage and subsistence based on estimated inter-county distances.</p>
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

export default TripClaimsManager;
