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
import Welcome from "./pages/Welcome";
import Dashboard from "./pages/Dashboard";
import BookkeepingDashboard from "./pages/BookkeepingDashboard";
import Invoices from "./pages/Invoices";
import AddInvoice from "./pages/AddInvoice";
import AddExpense from "./pages/AddExpense";
import ReceiptScanner from "./pages/ReceiptScanner";
import BankFeed from "./pages/BankFeed";
import VATCentre from "./pages/VATCentre";
import RCTCentre from "./pages/RCTCentre";
import TaxCentre from "./pages/TaxCentre";
import Settings from "./pages/Settings";
import BulkProcessor from "./pages/BulkProcessor";
import Reports from "./pages/Reports";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import OnboardingWizard from "./pages/OnboardingWizard";
import DirectorOnboardingWizard from "./pages/DirectorOnboardingWizard";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import BulkReceiptUpload from "./pages/BulkReceiptUpload";
import Form11Return from "./pages/Form11Return";
import CT1Return from "./pages/CT1Return";
import BalanceSheet from "./pages/BalanceSheet";
import ReliefScanner from "./pages/ReliefScanner";
import TripClaimsManager from "./pages/TripClaimsManager";
import ProfitAndLoss from "./pages/ProfitAndLoss";
import AgedDebtors from "./pages/AgedDebtors";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
        <AuthProvider>
          <BackgroundTasksProvider>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/onboarding" element={<RequireAuth><OnboardingWizard /></RequireAuth>} />
            <Route path="/onboarding/director" element={<RequireAuth><DirectorOnboardingWizard /></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><BookkeepingDashboard /></RequireAuth>} />
            <Route path="/invoices" element={<RequireAuth><Invoices /></RequireAuth>} />
            <Route path="/invoice" element={<RequireAuth><AddInvoice /></RequireAuth>} />
            <Route path="/invoice/:id" element={<RequireAuth><AddInvoice /></RequireAuth>} />
            <Route path="/expense" element={<RequireAuth><AddExpense /></RequireAuth>} />
            <Route path="/scanner" element={<RequireAuth><ReceiptScanner /></RequireAuth>} />
            <Route path="/receipts/bulk" element={<RequireAuth><BulkReceiptUpload /></RequireAuth>} />
            <Route path="/bank" element={<RequireAuth><BankFeed /></RequireAuth>} />
            <Route path="/accounts" element={<RequireAuth><Accounts /></RequireAuth>} />
            <Route path="/accounts/:accountId" element={<RequireAuth><AccountDetail /></RequireAuth>} />
            <Route path="/vat" element={<RequireAuth><VATCentre /></RequireAuth>} />
            <Route path="/rct" element={<RequireAuth><RCTCentre /></RequireAuth>} />
            <Route path="/tax" element={<RequireAuth><TaxCentre /></RequireAuth>} />
            <Route path="/tax/form11/:directorNumber" element={<RequireAuth><Form11Return /></RequireAuth>} />
            <Route path="/tax/ct1" element={<RequireAuth><CT1Return /></RequireAuth>} />
            <Route path="/tax/balance-sheet" element={<RequireAuth><BalanceSheet /></RequireAuth>} />
            <Route path="/tax/reliefs" element={<RequireAuth><ReliefScanner /></RequireAuth>} />
            <Route path="/tax/trips" element={<RequireAuth><TripClaimsManager /></RequireAuth>} />
            <Route path="/reports/pnl" element={<RequireAuth><ProfitAndLoss /></RequireAuth>} />
            <Route path="/reports/aged-debtors" element={<RequireAuth><AgedDebtors /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="/bulk" element={<RequireAuth><BulkProcessor /></RequireAuth>} />
            <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
            <Route path="/chart-of-accounts" element={<RequireAuth><ChartOfAccounts /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BackgroundTasksStatus />
          </BackgroundTasksProvider>
        </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
