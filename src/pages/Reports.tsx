import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { BarChart3, Calendar, Building2, User, FileText, ChevronRight } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { SalesTaxAuditExport } from "@/components/reports/SalesTaxAuditExport";
import { VATReturnReport } from "@/components/reports/VATReturnReport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useDirectorOnboarding } from "@/hooks/useDirectorOnboarding";
import { BusinessBankExportQuestionnaire } from "@/components/export/BusinessBankExportQuestionnaire";
import { DirectorExportQuestionnaire } from "@/components/export/DirectorExportQuestionnaire";

const Reports = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reportType = searchParams.get("type");
  const { user, profile, directorCount, directorOnboardingComplete } = useAuth();
  const { getDirector, isLoading: directorsLoading } = useDirectorOnboarding();

  const [showCT1Questionnaire, setShowCT1Questionnaire] = useState(false);
  const [showForm11Questionnaire, setShowForm11Questionnaire] = useState(false);
  const [selectedDirectorIndex, setSelectedDirectorIndex] = useState(1);

  // Get current tax year
  const now = new Date();
  const currentYear = now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear();
  const taxYear = `${currentYear - 1}`;

  const handleOpenForm11 = (directorNum: number) => {
    setSelectedDirectorIndex(directorNum);
    setShowForm11Questionnaire(true);
  };

  return (
    <AppLayout>
      <div className="flex-1">
        {/* Header */}
        <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold text-xl">Reports</h1>
            <Button variant="outline" size="sm" onClick={() => navigate("/tax")} className="rounded-full">
              Tax Centre
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </header>

        <main className="px-6 py-6 max-w-4xl mx-auto space-y-6">
          {/* VAT Return Report - Show when navigated from VAT Centre */}
          {reportType === "vat" && <VATReturnReport />}

          {/* Tax Return Exports */}
          {!reportType && (
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Year-End Tax Returns
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Complete finalisation questionnaires to prepare your CT1 and Form 11 tax returns for {taxYear}.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* CT1 Export */}
                  <div className="p-4 bg-primary/5 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">CT1 Return</p>
                        <p className="text-xs text-muted-foreground">Corporation Tax</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Complete the business questionnaire to finalise your CT1 return.
                    </p>
                    <Button className="w-full rounded-xl" onClick={() => setShowCT1Questionnaire(true)}>
                      Start CT1 Questionnaire
                    </Button>
                  </div>

                  {/* Form 11 Export */}
                  <div className="p-4 bg-secondary rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-foreground/10 rounded-lg">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">Form 11 Returns</p>
                        <p className="text-xs text-muted-foreground">Personal Income Tax</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Complete questionnaires for each director ({directorCount} director
                      {directorCount !== 1 ? "s" : ""}).
                    </p>
                    {directorOnboardingComplete ? (
                      <div className="space-y-2">
                        {directorsLoading
                          ? Array.from({ length: directorCount }, (_, i) => (
                              <Skeleton key={i} className="h-10 w-full rounded-xl" />
                            ))
                          : Array.from({ length: directorCount }, (_, i) => i + 1).map((num) => {
                              const parsed = getDirector(num);
                              const name = parsed?.director_name || `Director ${num}`;

                              return (
                                <Button
                                  key={num}
                                  variant="outline"
                                  className="w-full justify-between rounded-xl"
                                  onClick={() => handleOpenForm11(num)}
                                >
                                  <span className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    {name}
                                  </span>
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              );
                            })}
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full rounded-xl"
                        onClick={() => navigate("/onboarding/director")}
                      >
                        Complete Director Onboarding First
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sales Tax Audit Report */}
          {!reportType && <SalesTaxAuditExport />}

          {/* Financial Reports */}
          {!reportType && (
            <div className="bg-card rounded-2xl p-6 card-shadow">
              <h2 className="font-semibold text-lg mb-4">Financial Reports</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  className="p-4 bg-muted rounded-xl text-left hover:bg-muted/80 transition-colors cursor-pointer"
                  onClick={() => navigate("/reports/pnl")}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <span className="font-medium">Profit & Loss</span>
                    <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Income vs expenses breakdown by category</p>
                </button>
                <button
                  className="p-4 bg-muted rounded-xl text-left hover:bg-muted/80 transition-colors cursor-pointer"
                  onClick={() => navigate("/reports/aged-debtors")}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span className="font-medium">Aged Debtors</span>
                    <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Outstanding invoices by age</p>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* CT1 Questionnaire Dialog */}
      <BusinessBankExportQuestionnaire
        open={showCT1Questionnaire}
        onOpenChange={setShowCT1Questionnaire}
        onComplete={(data) => {
          console.log("CT1 data:", data);
          setShowCT1Questionnaire(false);
        }}
        accountName={profile?.business_name || "Business Account"}
        periodStart={new Date(`${parseInt(taxYear)}-01-01`)}
        periodEnd={new Date(`${parseInt(taxYear)}-12-31`)}
        detectedIncome={[]}
        expenseSummary={{ allowable: 0, disallowed: 0 }}
        detectedPayments={[]}
        closingBalance={0}
        vatPosition={undefined}
        fixedAssets={[]}
        loans={[]}
        directorsLoanBalance={undefined}
        flaggedCapitalItems={[]}
        rctDeductions={[]}
        isConstructionTrade={false}
        isCloseCompany={true}
      />

      {/* Form 11 Questionnaire Dialog */}
      <DirectorExportQuestionnaire
        open={showForm11Questionnaire}
        onOpenChange={setShowForm11Questionnaire}
        onComplete={(data) => {
          console.log("Form 11 data:", data);
          setShowForm11Questionnaire(false);
        }}
        accountName={getDirector(selectedDirectorIndex)?.director_name || `Director ${selectedDirectorIndex}`}
        taxYear={taxYear}
        detectedIncomeSources={[]}
        linkedBusinesses={[]}
        assumedReliefs={[]}
        detectedSalary={undefined}
        detectedDividends={undefined}
        detectedBIK={[]}
        assessmentBasis="single"
      />
    </AppLayout>
  );
};

export default Reports;
