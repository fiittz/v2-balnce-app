import { lazy, Suspense } from "react";
import * as Sentry from "@sentry/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, RequireAuth } from "@/hooks/useAuth";
import { BackgroundTasksProvider } from "@/contexts/BackgroundTasksContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import BackgroundTasksStatus from "@/components/layout/BackgroundTasksStatus";
import ErrorBoundary from "@/components/ErrorBoundary";
import PostHogTracker from "@/components/PostHogTracker";
import { initPostHog } from "@/lib/posthog";

// Eagerly loaded — landing/login page (first thing users see)
import Welcome from "./pages/Welcome";
import NotFound from "./pages/NotFound";

// Lazy-loaded page components — split into separate chunks
const Dashboard = lazy(() => import("./pages/Dashboard"));
const BookkeepingDashboard = lazy(() => import("./pages/BookkeepingDashboard"));
const Invoices = lazy(() => import("./pages/Invoices"));
const AddInvoice = lazy(() => import("./pages/AddInvoice"));
const AddExpense = lazy(() => import("./pages/AddExpense"));
const ReceiptScanner = lazy(() => import("./pages/ReceiptScanner"));
const BankFeed = lazy(() => import("./pages/BankFeed"));
const VATCentre = lazy(() => import("./pages/VATCentre"));
const RCTCentre = lazy(() => import("./pages/RCTCentre"));
const TaxCentre = lazy(() => import("./pages/TaxCentre"));
const Settings = lazy(() => import("./pages/Settings"));
const BulkProcessor = lazy(() => import("./pages/BulkProcessor"));
const Reports = lazy(() => import("./pages/Reports"));
const ChartOfAccounts = lazy(() => import("./pages/ChartOfAccounts"));
const OnboardingWizard = lazy(() => import("./pages/OnboardingWizard"));
const DirectorOnboardingWizard = lazy(() => import("./pages/DirectorOnboardingWizard"));
const Accounts = lazy(() => import("./pages/Accounts"));
const AccountDetail = lazy(() => import("./pages/AccountDetail"));
const BulkReceiptUpload = lazy(() => import("./pages/BulkReceiptUpload"));
const Form11Return = lazy(() => import("./pages/Form11Return"));
const CT1Return = lazy(() => import("./pages/CT1Return"));
const BalanceSheet = lazy(() => import("./pages/BalanceSheet"));
const ReliefScanner = lazy(() => import("./pages/ReliefScanner"));
const TripClaimsManager = lazy(() => import("./pages/TripClaimsManager"));
const ProfitAndLoss = lazy(() => import("./pages/ProfitAndLoss"));
const AgedDebtors = lazy(() => import("./pages/AgedDebtors"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const queryClient = new QueryClient();

// Init PostHog once at module load
initPostHog();

const App = () => (
  <Sentry.ErrorBoundary fallback={<p>An unexpected error occurred. Please refresh the page.</p>}>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
              <AuthProvider>
                <PostHogTracker />
                <BackgroundTasksProvider>
                  <Suspense fallback={<div>Loading...</div>}>
                    <Routes>
                      <Route path="/" element={<Welcome />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route
                        path="/onboarding"
                        element={
                          <RequireAuth>
                            <OnboardingWizard />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/onboarding/director"
                        element={
                          <RequireAuth>
                            <DirectorOnboardingWizard />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/dashboard"
                        element={
                          <RequireAuth>
                            <BookkeepingDashboard />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/invoices"
                        element={
                          <RequireAuth>
                            <Invoices />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/invoice"
                        element={
                          <RequireAuth>
                            <AddInvoice />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/invoice/:id"
                        element={
                          <RequireAuth>
                            <AddInvoice />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/expense"
                        element={
                          <RequireAuth>
                            <AddExpense />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/scanner"
                        element={
                          <RequireAuth>
                            <ReceiptScanner />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/receipts/bulk"
                        element={
                          <RequireAuth>
                            <BulkReceiptUpload />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/bank"
                        element={
                          <RequireAuth>
                            <BankFeed />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/accounts"
                        element={
                          <RequireAuth>
                            <Accounts />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/accounts/:accountId"
                        element={
                          <RequireAuth>
                            <AccountDetail />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/vat"
                        element={
                          <RequireAuth>
                            <VATCentre />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/rct"
                        element={
                          <RequireAuth>
                            <RCTCentre />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/tax"
                        element={
                          <RequireAuth>
                            <TaxCentre />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/tax/form11/:directorNumber"
                        element={
                          <RequireAuth>
                            <Form11Return />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/tax/ct1"
                        element={
                          <RequireAuth>
                            <CT1Return />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/tax/balance-sheet"
                        element={
                          <RequireAuth>
                            <BalanceSheet />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/tax/reliefs"
                        element={
                          <RequireAuth>
                            <ReliefScanner />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/tax/trips"
                        element={
                          <RequireAuth>
                            <TripClaimsManager />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/reports/pnl"
                        element={
                          <RequireAuth>
                            <ProfitAndLoss />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/reports/aged-debtors"
                        element={
                          <RequireAuth>
                            <AgedDebtors />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <RequireAuth>
                            <Settings />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/bulk"
                        element={
                          <RequireAuth>
                            <BulkProcessor />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/reports"
                        element={
                          <RequireAuth>
                            <Reports />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/chart-of-accounts"
                        element={
                          <RequireAuth>
                            <ChartOfAccounts />
                          </RequireAuth>
                        }
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                  <BackgroundTasksStatus />
                </BackgroundTasksProvider>
              </AuthProvider>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </Sentry.ErrorBoundary>
);

export default App;
