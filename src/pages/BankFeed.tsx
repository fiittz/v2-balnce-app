import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, Building2, Loader2, Zap, Trash2, X, Check,
  FileSpreadsheet, BookOpen, ChevronDown, Wallet, Plus,
  Briefcase, User, AlertTriangle, Receipt, Download, Upload,
  FileText, Scale, BarChart3, Landmark, ChevronRight,
  MapPin, Car, Utensils, Hotel, Map as MapIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVATSummary } from "@/hooks/useVATData";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTransactions, useUnmatchedTransactions, useDeleteTransaction, useBulkDeleteTransactions, useDeleteAllTransactions, useBulkUpdateTransactions } from "@/hooks/useTransactions";
import { useAccounts, useCreateAccount, useDeleteAccount } from "@/hooks/useAccounts";
import { useBulkRecategorize } from "@/hooks/useBulkRecategorize";
import { matchAllUnmatched, matchSingleTransaction } from "@/services/matchingServices";
import { toast } from "sonner";
import CSVImportDialog from "@/components/bank/CSVImportDialog";
import ImportBatchesPanel from "@/components/bank/ImportBatchesPanel";
import AccountLedgerSection from "@/components/bank/AccountLedgerSection";
import CategoryLedgerSection from "@/components/bank/CategoryLedgerSection";
import FloatingActionBar from "@/components/bank/FloatingActionBar";
import VATSummaryCard from "@/components/bank/VATSummaryCard";
import { exportToExcel, exportToPDF, exportDirectorToExcel, exportDirectorToPDF, type PnlCt1Summary, type CompanyInfo, type ExportOptions } from "@/lib/exportTransactions";
import AppLayout from "@/components/layout/AppLayout";
import {
  BusinessBankExportQuestionnaire,
  DirectorExportQuestionnaire,
  VATExportQuestionnaire,
  QuestionnaireData,
  DirectorQuestionnaireData,
  VATQuestionnaireData,
} from "@/components/export";
import {
  assembleVATReportData,
  assembleBalanceSheetData,
  assembleAbridgedAccountsData,
  generateVATPdf,
  generateVATExcel,
  generateBalanceSheetPdf,
  generateBalanceSheetExcel,
  generateAbridgedAccountsPdf,
  generateAbridgedAccountsExcel,
  type VATInput,
  type BalanceSheetInput,
  type AbridgedAccountsInput,
  type ReportMeta,
} from "@/lib/reports";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import { useInvoiceTripMatcher, type InvoiceTrip } from "@/hooks/useInvoiceTripMatcher";
import { useInvoices } from "@/hooks/useInvoices";
import { useCT1Data } from "@/hooks/useCT1Data";
import { useAuth } from "@/hooks/useAuth";
import { ChartOfAccountsButton } from "@/components/dashboard/ChartOfAccountsWidget";

type FilterType = "all" | "income" | "expense" | "uncategorized";
type AccountType = "limited_company" | "sole_trader" | "directors_personal_tax";

const expenseTypeIcon = (type: string) => {
  switch (type) {
    case "accommodation": return <Hotel className="w-4 h-4 text-blue-500" />;
    case "transport": return <Car className="w-4 h-4 text-indigo-500" />;
    case "subsistence": return <Utensils className="w-4 h-4 text-orange-500" />;
    default: return <Receipt className="w-4 h-4 text-muted-foreground" />;
  }
};

function TripLedgerCard({ trip }: { trip: InvoiceTrip }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-card rounded-xl card-shadow overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 dark:bg-red-950/40">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-red-600" />
          ) : (
            <ChevronRight className="w-5 h-5 text-red-600" />
          )}
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold">
            Trip to {trip.jobLocation}
          </h3>
          <p className="text-sm text-muted-foreground">
            Inv #{trip.invoiceNumber} — {trip.customerName}
            {trip.suggestedSubsistence.nights > 0 && ` · ${trip.suggestedSubsistence.nights} night${trip.suggestedSubsistence.nights !== 1 ? "s" : ""}`}
            {trip.suggestedSubsistence.days > 0 && trip.suggestedSubsistence.nights === 0 && " · Day trip"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-red-600">
            -€{trip.totalRevenueAllowance.toFixed(2)}
          </p>
          {trip.tripExpenses.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {trip.tripExpenses.length} expense{trip.tripExpenses.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          {/* Matched bank expenses */}
          {trip.tripExpenses.length > 0 && (
            <div>
              {trip.tripExpenses.map((expense, i) => (
                <div
                  key={`${expense.description}-${i}`}
                  className={`p-4 pl-14 flex items-center gap-4 ${
                    i !== trip.tripExpenses.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                    {expenseTypeIcon(expense.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{expense.description}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      {expense.type}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">-€{expense.amount.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Revenue rate breakdown */}
          <div className="px-4 py-3 bg-muted/30 space-y-1.5 text-sm">
            {trip.suggestedMileage.allowance > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Car className="w-3.5 h-3.5" />
                  Mileage ({trip.suggestedMileage.distanceKm} km)
                </span>
                <span className="font-mono tabular-nums">€{trip.suggestedMileage.allowance.toFixed(2)}</span>
              </div>
            )}
            {trip.suggestedSubsistence.allowance > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Utensils className="w-3.5 h-3.5" />
                  Subsistence ({trip.suggestedSubsistence.method === "vouched" ? "vouched" : "flat rate"})
                </span>
                <span className="font-mono tabular-nums">€{trip.suggestedSubsistence.allowance.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border/50 pt-1.5">
              <span className="font-medium">Revenue allowance</span>
              <span className="font-mono tabular-nums font-medium">€{trip.totalRevenueAllowance.toFixed(2)}</span>
            </div>
            {trip.totalExpensesFromCsv > 0 && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Less: Reimbursed from bank</span>
                <span className="font-mono tabular-nums">(€{trip.totalExpensesFromCsv.toFixed(2)})</span>
              </div>
            )}
            {trip.directorsLoanBalance > 0 && (
              <div className="flex items-center justify-between text-primary font-medium">
                <span>Net owed to director</span>
                <span className="font-mono tabular-nums">€{trip.directorsLoanBalance.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const BankFeed = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<FilterType>("all");
  const [isMatching, setIsMatching] = useState(false);
  const [matchingTxId, setMatchingTxId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"ledger" | "uploads" | "reports">("ledger");
  const [reportsSubTab, setReportsSubTab] = useState<"pnl" | "balance" | "vat" | "abridged" | "audit" | "vatcentre">("pnl");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountDescription, setNewAccountDescription] = useState("");
  const [newAccountType, setNewAccountType] = useState<AccountType>("limited_company");

  // Export questionnaire state
  const [showBusinessQuestionnaire, setShowBusinessQuestionnaire] = useState(false);
  const [showDirectorQuestionnaire, setShowDirectorQuestionnaire] = useState(false);
  const [showVATQuestionnaire, setShowVATQuestionnaire] = useState(false);
  const [pendingExportType, setPendingExportType] = useState<"excel" | "pdf" | null>(null);
  const [pendingVATExportType, setPendingVATExportType] = useState<"excel" | "pdf" | null>(null);

  const { data: accounts } = useAccounts();
  const createAccountMutation = useCreateAccount();
  const deleteAccountMutation = useDeleteAccount();
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const deleteAccountTarget = accounts?.find(a => a.id === deleteAccountId);

  // Check URL for account param
  useEffect(() => {
    const accountParam = searchParams.get("account");
    if (accountParam) {
      setSelectedAccountId(accountParam);
    }
  }, [searchParams]);

  const selectedAccount = accounts?.find(a => a.id === selectedAccountId);

  // Reset reports sub-tab if switching to account type with hidden tabs
  useEffect(() => {
    if (selectedAccount?.account_type === "directors_personal_tax" && ["vat", "abridged"].includes(reportsSubTab)) {
      setReportsSubTab("pnl");
    }
    if (selectedAccount?.account_type === "sole_trader" && reportsSubTab === "abridged") {
      setReportsSubTab("pnl");
    }
  }, [selectedAccount?.account_type, reportsSubTab]);

  const handleAccountChange = (accountId: string | null) => {
    setSelectedAccountId(accountId);
    if (accountId) {
      setSearchParams({ account: accountId });
    } else {
      setSearchParams({});
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountId) return;
    try {
      // If deleting the currently selected account, switch to All
      if (selectedAccountId === deleteAccountId) {
        handleAccountChange(null);
      }
      await deleteAccountMutation.mutateAsync(deleteAccountId);
      setDeleteAccountId(null);
    } catch {
      toast.error("Failed to delete account");
    }
  };

  const handleAddAccount = async () => {
    if (!newAccountName.trim()) {
      toast.error("Account name is required");
      return;
    }
    try {
      const newAccount = await createAccountMutation.mutateAsync({
        name: newAccountName.trim(),
        account_type: newAccountType,
        currency: "EUR",
        balance: 0,
        is_default: false,
        account_number: null,
        iban: null,
        bic: null,
        sort_code: null,
      });
      setNewAccountName("");
      setNewAccountDescription("");
      setNewAccountType("limited_company");
      setShowAddAccountDialog(false);
      setSelectedAccountId(newAccount.id);
      setSearchParams({ account: newAccount.id });
    } catch {
      toast.error("Failed to create account");
    }
  };

  const { data: onboarding } = useOnboardingSettings();
  const { invoiceTrips } = useInvoiceTripMatcher();
  const ct1 = useCT1Data();
  const { data: invoicesData } = useInvoices();
  const { user } = useAuth();

  // VAT summary from hook — single source of truth for VAT figures
  const vatTaxYear = useMemo(() => {
    const now = new Date();
    return now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  }, []);
  const { data: vatSummary } = useVATSummary(`${vatTaxYear}-01-01`, `${vatTaxYear}-12-31`);

  const isRctIndustry = ["construction", "forestry", "meat_processing", "carpentry_joinery", "electrical", "plumbing_heating"].includes(
    onboarding?.business_type || "",
  );
  const showRct = isRctIndustry && onboarding?.rct_registered;

  // Director names from onboarding for PDF signatures
  const directorNames = useMemo(() => {
    const names: string[] = [];
    const dirCount = parseInt(localStorage.getItem("director_count") || "1", 10);
    for (let i = 1; i <= dirCount; i++) {
      const dRaw = localStorage.getItem(`director_onboarding_${user?.id}_${i}`);
      if (dRaw) {
        const d = JSON.parse(dRaw);
        if (d.first_name || d.last_name) {
          names.push(`${d.first_name || ""} ${d.last_name || ""}`.trim());
        }
      }
    }
    return names.length > 0 ? names : ["Director"];
  }, [user?.id]);

  // Company info for PDF headers
  const companyInfo: CompanyInfo = useMemo(() => {
    const raw = localStorage.getItem("business_onboarding_extra");
    const biz = raw ? JSON.parse(raw)?.businesses?.[0] : null;
    return {
      companyName: biz?.name || onboarding?.business_name || undefined,
      registeredAddress: biz?.registered_address || undefined,
      croNumber: biz?.cro_number || undefined,
      incorporationDate: biz?.incorporation_date || undefined,
      taxReference: biz?.tax_reference || undefined,
      directorNames,
    };
  }, [onboarding, directorNames]);

  const { data: transactions, isLoading, refetch } = useTransactions();
  const { data: unmatchedTransactions, refetch: refetchUnmatched } = useUnmatchedTransactions();
  const deleteSingle = useDeleteTransaction();
  const bulkDelete = useBulkDeleteTransactions();
  const deleteAll = useDeleteAllTransactions();
  const {
    runRecategorizeAll,
    isRunning: isRecategorizing,
    progress: recatProgress,
    currentPhase
  } = useBulkRecategorize();

  // Filter transactions by selected financial account first
  const accountFilteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (!selectedAccountId) return transactions;

    // Only apply filtering when the selected id is a real account id in the database.
    // (Prevents localStorage-only IDs from breaking the ledger view + imports.)
    const canFilter = !!accounts?.some(a => a.id === selectedAccountId);
    if (!canFilter) return transactions;

    return transactions.filter(t => t.account_id === selectedAccountId);
  }, [transactions, selectedAccountId, accounts]);

  // Calculate counts based on filtered transactions
  const uncategorizedCount = accountFilteredTransactions?.filter(t => !t.category_id).length || 0;
  const incomeCount = accountFilteredTransactions?.filter(t => t.type === "income").length || 0;
  const expenseCount = accountFilteredTransactions?.filter(t => t.type === "expense").length || 0;
  const unassignedCount = accountFilteredTransactions?.filter(t => !t.account_id).length || 0;

  // Group transactions by account
  const groupedByAccount = useMemo(() => {
    if (!accountFilteredTransactions) return [];
    
    const groups = new Map<string, { accountName: string; accountCode: string | null; accountType: string; transactions: typeof accountFilteredTransactions }>();
    
    accountFilteredTransactions.forEach(t => {
      if (filter === "income" && t.type !== "income") return;
      if (filter === "expense" && t.type !== "expense") return;
      if (filter === "uncategorized" && t.category_id) return;
      
      const accountId = t.account_id || "unassigned";
      const account = accounts?.find(a => a.id === t.account_id);
      
      if (!groups.has(accountId)) {
        groups.set(accountId, {
          accountName: account?.name || "Unassigned",
          accountCode: account?.account_number || null,
          accountType: account?.account_type || "unknown",
          transactions: []
        });
      }
      groups.get(accountId)!.transactions.push(t);
    });
    
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "unassigned") return -1;
      if (b[0] === "unassigned") return 1;
      return a[1].accountName.localeCompare(b[1].accountName);
    });
  }, [accountFilteredTransactions, accounts, filter]);

  // Group transactions by category for ledger display
  const groupedByCategory = useMemo(() => {
    if (!accountFilteredTransactions || !accounts) return { income: [], expense: [], incomeTotal: 0, expenseTotal: 0 };

    // Skip internal transfers — same filter as the balance calculation
    const internalTransferIds = new Set(
      accounts
        .filter(a => a.name.toLowerCase().includes('transfer') || a.name.toLowerCase().includes('internal'))
        .map(a => a.id)
    );

    type CategoryGroup = {
      categoryName: string;
      transactions: typeof accountFilteredTransactions;
      total: number;
    };

    const incomeGroups = new Map<string, CategoryGroup>();
    const expenseGroups = new Map<string, CategoryGroup>();

    accountFilteredTransactions.forEach(t => {
      // Skip internal transfers so totals match the running balance
      if (t.account_id && internalTransferIds.has(t.account_id)) return;

      // Apply filters
      if (filter === "income" && t.type !== "income") return;
      if (filter === "expense" && t.type !== "expense") return;
      if (filter === "uncategorized" && t.category_id) return;

      const catName = t.category?.name || "Uncategorized";
      const groups = t.type === "income" ? incomeGroups : expenseGroups;

      if (!groups.has(catName)) {
        groups.set(catName, { categoryName: catName, transactions: [], total: 0 });
      }
      const group = groups.get(catName)!;
      group.transactions.push(t);
      group.total += Math.abs(t.amount);
    });

    const sortGroups = (map: Map<string, CategoryGroup>): CategoryGroup[] => {
      return Array.from(map.values()).sort((a, b) => {
        if (a.categoryName === "Uncategorized") return -1;
        if (b.categoryName === "Uncategorized") return 1;
        return a.categoryName.localeCompare(b.categoryName);
      });
    };

    const incomeTotal = Array.from(incomeGroups.values()).reduce((s, g) => s + g.total, 0);
    const expenseTotal = Array.from(expenseGroups.values()).reduce((s, g) => s + g.total, 0);

    return {
      income: sortGroups(incomeGroups),
      expense: sortGroups(expenseGroups),
      incomeTotal,
      expenseTotal,
    };
  }, [accountFilteredTransactions, accounts, filter]);

  // Travel expense from trip matcher
  const travelTotal = useMemo(() => {
    return Math.round(invoiceTrips.reduce((s, t) => s + t.totalRevenueAllowance, 0) * 100) / 100;
  }, [invoiceTrips]);

  // Balance sheet sections for the ledger — always available from transaction data
  const bsSections = useMemo(() => {
    const now = new Date();
    const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
    const raw = localStorage.getItem(`ct1_questionnaire_${user?.id}_${taxYear}`);
    const q = raw ? JSON.parse(raw) : null;

    // Assets — from questionnaire + computed data
    const assets: { label: string; amount: number }[] = [];
    if (q?.fixedAssetsLandBuildings) assets.push({ label: "Land & Buildings", amount: q.fixedAssetsLandBuildings });
    if (q?.fixedAssetsPlantMachinery) assets.push({ label: "Plant & Machinery", amount: q.fixedAssetsPlantMachinery });
    const motorNBV = ct1.vehicleAsset ? ct1.vehicleAsset.depreciation.netBookValue : (q?.fixedAssetsMotorVehicles ?? 0);
    if (motorNBV > 0) assets.push({ label: "Motor Vehicles", amount: motorNBV });
    if (q?.fixedAssetsFixturesFittings) assets.push({ label: "Fixtures & Fittings", amount: q.fixedAssetsFixturesFittings });
    if (q?.currentAssetsStock) assets.push({ label: "Stock", amount: q.currentAssetsStock });
    const debtors = q?.currentAssetsDebtors ?? q?.tradeDebtorsTotal ?? 0;
    if (debtors > 0) assets.push({ label: "Debtors", amount: debtors });
    if (q?.currentAssetsCash) assets.push({ label: "Cash in Hand", amount: q.currentAssetsCash });
    // Bank balance always available from transaction data
    const bankBal = q?.currentAssetsBankBalance ?? ct1.closingBalance ?? 0;
    if (bankBal > 0) assets.push({ label: "Bank Balance", amount: bankBal });
    if (ct1.rctPrepayment > 0) assets.push({ label: "RCT Prepayment", amount: ct1.rctPrepayment });
    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);

    // Liabilities — from questionnaire + computed data
    const liabilities: { label: string; amount: number }[] = [];
    const creditors = q?.liabilitiesCreditors ?? q?.tradeCreditorsTotal ?? 0;
    if (creditors > 0) liabilities.push({ label: "Creditors", amount: creditors });
    if (ct1.vatPosition && ct1.vatPosition.type === "payable" && ct1.vatPosition.amount > 0) {
      liabilities.push({ label: "VAT Payable", amount: ct1.vatPosition.amount });
    }
    // Director's Loan: net of travel owed minus drawings taken
    if (ct1.netDirectorsLoan > 0) liabilities.push({ label: "Director's Loan Account", amount: ct1.netDirectorsLoan });
    // If director owes company (drawings > travel), show as asset (handled above via debtors)
    if (ct1.netDirectorsLoan < 0) assets.push({ label: "Director's Current A/C (debtor)", amount: Math.abs(ct1.netDirectorsLoan) });
    const bankLoans = q?.liabilitiesBankLoans ?? 0;
    if (bankLoans > 0) liabilities.push({ label: "Bank Loans", amount: bankLoans });
    const directorsLoans = q?.liabilitiesDirectorsLoans ?? q?.directorsLoanBalance ?? 0;
    if (directorsLoans > 0) liabilities.push({ label: "Directors' Loans (other)", amount: directorsLoans });
    const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);

    // Capital — share capital + retained profits (all expenses, not just allowable)
    const capital: { label: string; amount: number }[] = [];
    const shareCapital = q?.shareCapital ?? 100;
    capital.push({ label: "Share Capital", amount: shareCapital });
    const totalIncome = ct1.detectedIncome.reduce((s, i) => s + i.amount, 0);
    const totalExpensesAll = ct1.expenseSummary.allowable + ct1.expenseSummary.disallowed;
    const retainedProfits = totalIncome - totalExpensesAll;
    if (retainedProfits !== 0) capital.push({ label: "Retained Profits", amount: retainedProfits });
    const totalCapital = capital.reduce((s, c) => s + c.amount, 0);

    return { assets, totalAssets, liabilities, totalLiabilities, capital, totalCapital };
  }, [user?.id, ct1]);

  const filteredTransactions = accountFilteredTransactions?.filter(t => {
    if (filter === "all") return true;
    if (filter === "income") return t.type === "income";
    if (filter === "expense") return t.type === "expense";
    return true;
  }) || [];

  const unmatchedCount = unmatchedTransactions?.length || 0;

  const handleAutoMatchAll = async () => {
    setIsMatching(true);
    try {
      const result = await matchAllUnmatched();
      toast.success(`Matched ${result.matched} of ${result.total} transactions`);
      refetch();
      refetchUnmatched();
    } catch (error) {
      toast.error("Failed to auto-match transactions");
    } finally {
      setIsMatching(false);
    }
  };

  const handleMatchSingle = async (transactionId: string) => {
    setMatchingTxId(transactionId);
    try {
      const result = await matchSingleTransaction(transactionId);
      if (result.match_id) {
        toast.success(`Matched to ${result.match_type} with ${Math.round(result.confidence * 100)}% confidence`);
      } else {
        toast.info("No match found for this transaction");
      }
      refetch();
      refetchUnmatched();
    } catch (error) {
      toast.error("Failed to match transaction");
    } finally {
      setMatchingTxId(null);
    }
  };

  const handleBulkRecategorize = async () => {
    await runRecategorizeAll();
    refetch();
    refetchUnmatched();
  };

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchUnmatched()]);
    toast.success("Transactions refreshed");
  };

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      await bulkDelete.mutateAsync(Array.from(selectedIds));
      clearSelection();
      setShowDeleteDialog(false);
    } catch (error) {
      // Error toast is handled in the hook
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAll.mutateAsync();
      setShowDeleteAllDialog(false);
    } catch (error) {
      // Error toast is handled in the hook
    }
  };

  const handleDeleteSingleTransaction = (id: string) => {
    deleteSingle.mutate(id);
  };

  const handleImportComplete = () => {
    setTimeout(() => {
      refetch();
      refetchUnmatched();
    }, 500);
  };

  // Export handlers - show questionnaire first
  const handleExportClick = (exportType: "excel" | "pdf") => {
    setPendingExportType(exportType);
    const accountType = selectedAccount?.account_type;
    
    if (accountType === "directors_personal_tax") {
      setShowDirectorQuestionnaire(true);
    } else {
      // Default to business bank questionnaire
      setShowBusinessQuestionnaire(true);
    }
  };

  const buildPnlCt1Summary = (): PnlCt1Summary => {
    const txs = accountFilteredTransactions || [];
    const DIRECT_COST_KEYWORDS = ["cost of goods", "cogs", "direct cost", "materials", "stock", "inventory", "sub con", "subcontractor"];
    const isDirect = (name: string) => DIRECT_COST_KEYWORDS.some(k => name.toLowerCase().includes(k));

    const incomeByCategory: Record<string, number> = {};
    let totalIncome = 0;
    const directCostsByCategory: Record<string, number> = {};
    let totalDirectCosts = 0;
    const expensesByCategory: Record<string, number> = {};
    let totalExpenses = 0;
    let revenueRefunds = 0;

    const isRevRefund = (catName: string, desc: string) => {
      const d = (desc || "").toLowerCase();
      return catName === "Tax Refund (Revenue Commissioners)" ||
        d.includes("revenue") || d.includes("collector general") ||
        d.includes("tax refund") || d.includes("vat refund") ||
        d.includes("rct refund") || d.includes("paye refund");
    };

    const isDrawingsCat = (name: string) => name.toLowerCase().includes("drawing");

    txs.forEach(t => {
      const catName = (t as unknown as { category?: { name: string }; description?: string }).category?.name || "Uncategorised";
      const desc = (t as unknown as { description?: string }).description || "";
      const amount = Math.abs(t.amount);
      if (t.type === "income") {
        if (isRevRefund(catName, desc)) { revenueRefunds += amount; }
        else { incomeByCategory[catName] = (incomeByCategory[catName] || 0) + amount; totalIncome += amount; }
      } else {
        // Director's Drawings are capital withdrawals — excluded from P&L
        if (isDrawingsCat(catName)) return;
        if (isDirect(catName)) { directCostsByCategory[catName] = (directCostsByCategory[catName] || 0) + amount; totalDirectCosts += amount; }
        else { expensesByCategory[catName] = (expensesByCategory[catName] || 0) + amount; totalExpenses += amount; }
      }
    });

    const travelNetOwed = Math.round(Math.max(0, invoiceTrips.reduce((s, t) => s + t.directorsLoanBalance, 0)) * 100) / 100;
    if (travelNetOwed > 0) {
      expensesByCategory["Travel & Accommodation (owed to director)"] = (expensesByCategory["Travel & Accommodation (owed to director)"] || 0) + travelNetOwed;
      totalExpenses += travelNetOwed;
    }

    const netExpenses = totalExpenses - revenueRefunds;
    const grossProfit = totalIncome - totalDirectCosts;
    const netProfit = grossProfit - netExpenses;

    const summary: PnlCt1Summary = {
      incomeByCategory, totalIncome, directCostsByCategory, totalDirectCosts,
      expensesByCategory, totalExpenses, revenueRefunds, netExpenses, grossProfit, netProfit,
    };

    // CT1 fields for company accounts
    const isPersonal = selectedAccount?.account_type === "directors_personal_tax";
    if (!isPersonal) {
      const now = new Date();
      const ty = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
      const raw = localStorage.getItem(`ct1_questionnaire_${user?.id}_${ty}`);
      const q = raw ? JSON.parse(raw) : null;
      const motorAllowance = ct1.vehicleAsset ? ct1.vehicleAsset.depreciation.annualAllowance : (q?.capitalAllowancesMotorVehicles ?? 0);
      const capitalAllowances = (q?.capitalAllowancesPlant ?? 0) + motorAllowance;
      const ct1Income = ct1.detectedIncome.reduce((s, i) => s + i.amount, 0);
      const travelDeduction = ct1.directorsLoanTravel;
      const tradingProfit = Math.max(0, ct1Income - ct1.expenseSummary.allowable - capitalAllowances - travelDeduction);
      const lossesForward = q?.lossesForward ?? 0;
      const taxableProfit = Math.max(0, tradingProfit - lossesForward);
      const ctAt125 = taxableProfit * 0.125;
      const surcharge = q?.closeCompanySurcharge ?? 0;
      const totalCT = ctAt125 + surcharge;
      const prelimPaid = q?.preliminaryCTPaid ?? 0;
      const rctCredit = ct1.rctPrepayment;
      summary.disallowedByCategory = ct1.disallowedByCategory;
      summary.capitalAllowances = capitalAllowances;
      summary.travelDeduction = travelDeduction;
      summary.tradingProfit = tradingProfit;
      summary.lossesForward = lossesForward;
      summary.taxableProfit = taxableProfit;
      summary.ctAt125 = ctAt125;
      summary.surcharge = surcharge;
      summary.totalCT = totalCT;
      summary.prelimPaid = prelimPaid;
      summary.rctCredit = rctCredit;
      summary.balanceDue = totalCT - prelimPaid - rctCredit;
      summary.directorsDrawings = ct1.directorsDrawings;
      summary.netDirectorsLoan = ct1.netDirectorsLoan;
      // Break down travel allowance into subsistence vs mileage
      summary.totalSubsistenceAllowance = Math.round(
        invoiceTrips.reduce((s, t) => s + t.suggestedSubsistence.allowance, 0) * 100
      ) / 100;
      summary.totalMileageAllowance = Math.round(
        invoiceTrips.reduce((s, t) => s + t.suggestedMileage.allowance, 0) * 100
      ) / 100;
    }

    return summary;
  };

  const handleBusinessQuestionnaireComplete = (data: QuestionnaireData) => {
    setShowBusinessQuestionnaire(false);
    const pnlCt1 = buildPnlCt1Summary();
    if (pendingExportType === "excel") {
      exportToExcel(accountFilteredTransactions as unknown[], undefined, data, pnlCt1);
    } else if (pendingExportType === "pdf") {
      exportToPDF(accountFilteredTransactions as unknown[], undefined, data, pnlCt1, companyInfo, { isRCT: showRct, invoices: invoicesData as unknown[] });
    }
    setPendingExportType(null);
    toast.success("Export completed with questionnaire attached");
  };

  const handleDirectorQuestionnaireComplete = (data: DirectorQuestionnaireData) => {
    setShowDirectorQuestionnaire(false);
    if (pendingExportType === "excel") {
      exportDirectorToExcel(accountFilteredTransactions as unknown[], undefined, data);
    } else if (pendingExportType === "pdf") {
      exportDirectorToPDF(accountFilteredTransactions as unknown[], undefined, data, companyInfo);
    }
    setPendingExportType(null);
    toast.success("Export completed with questionnaire attached");
  };

  // ── Report Meta builder ─────────────────────────────────────
  const buildReportMeta = (): ReportMeta => {
    const now = new Date();
    const ty = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
    return {
      companyName: companyInfo.companyName || "Company",
      taxYear: String(ty),
      generatedDate: now,
      registeredAddress: companyInfo.registeredAddress,
      directorNames,
    };
  };

  // ── VAT Export ──────────────────────────────────────────────
  const handleVATExportClick = (exportType: "excel" | "pdf") => {
    setPendingVATExportType(exportType);
    setShowVATQuestionnaire(true);
  };

  const handleVATQuestionnaireComplete = (data: VATQuestionnaireData) => {
    setShowVATQuestionnaire(false);
    const txs = accountFilteredTransactions || [];
    const meta = buildReportMeta();

    // Build sales/purchases by rate from transaction data
    const salesByRate = new Map<string, { net: number; vat: number }>();
    const purchasesByRate = new Map<string, { net: number; vat: number }>();

    for (const txn of txs) {
      const txnRecord = txn as unknown as Record<string, unknown>;
      const vatRate = txnRecord.vat_rate;
      const vatAmount = Number(txnRecord.vat_amount) || 0;
      const gross = Math.abs(txn.amount);
      const net = gross - vatAmount;
      const rateKey = vatRate ? String(vatRate) : "0%";

      if (txn.type === "income") {
        // RCT: output VAT = 0 for subcontractor income
        const entry = salesByRate.get("0%") || { net: 0, vat: 0 };
        entry.net += gross;
        salesByRate.set("0%", entry);
      } else {
        const entry = purchasesByRate.get(rateKey) || { net: 0, vat: 0 };
        entry.net += net;
        entry.vat += vatAmount;
        purchasesByRate.set(rateKey, entry);
      }
    }

    const now = new Date();
    const ty = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;

    const vatInput: VATInput = {
      vatNumber: data.vatNumber,
      vatBasis: data.vatBasis,
      periodStart: data.vatFrequency === "annual" ? `1 Jan ${ty}` : (meta.taxYear),
      periodEnd: data.vatFrequency === "annual" ? `31 Dec ${ty}` : (meta.taxYear),
      salesByRate: Array.from(salesByRate.entries()).map(([rate, vals]) => ({ rate, ...vals })),
      purchasesByRate: Array.from(purchasesByRate.entries()).map(([rate, vals]) => ({ rate, ...vals })),
    };

    const reportData = assembleVATReportData(vatInput, meta);

    if (pendingVATExportType === "pdf") {
      generateVATPdf(reportData);
    } else if (pendingVATExportType === "excel") {
      generateVATExcel(reportData);
    }
    setPendingVATExportType(null);
    toast.success("VAT return exported");
  };

  // ── Balance Sheet Export ────────────────────────────────────
  const handleBalanceSheetExport = (exportType: "excel" | "pdf") => {
    const txs = accountFilteredTransactions || [];
    const meta = buildReportMeta();
    const now = new Date();
    const ty = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
    const raw = localStorage.getItem(`ct1_questionnaire_${user?.id}_${ty}`);
    const q = raw ? JSON.parse(raw) : null;

    let totalIncome = 0;
    let totalExpensesBS = 0;
    txs.forEach(t => {
      if (t.type === "income") totalIncome += Math.abs(t.amount);
      else totalExpensesBS += Math.abs(t.amount);
    });
    const bankBalance = totalIncome - totalExpensesBS;

    const vehicleNBV = ct1.vehicleAsset ? ct1.vehicleAsset.depreciation.netBookValue : 0;
    const directorsLoanNet = ct1.netDirectorsLoan;

    const bsInput: BalanceSheetInput = {
      landBuildings: q?.fixedAssetsLandBuildings ?? 0,
      plantMachinery: q?.fixedAssetsPlantMachinery ?? 0,
      motorVehicles: vehicleNBV,
      fixturesFittings: q?.fixedAssetsFixturesFittings ?? 0,
      stock: q?.currentAssetsStock ?? 0,
      debtors: (directorsLoanNet < 0 ? Math.abs(directorsLoanNet) : 0) + (q?.currentAssetsDebtors ?? 0),
      cash: q?.currentAssetsCash ?? 0,
      bankBalance: bankBalance,
      rctPrepayment: ct1.rctPrepayment,
      creditors: q?.liabilitiesCreditors ?? 0,
      taxation: 0,
      bankOverdraft: 0,
      directorsLoanTravel: directorsLoanNet > 0 ? directorsLoanNet : 0,
      bankLoans: q?.liabilitiesBankLoans ?? 0,
      directorsLoans: q?.liabilitiesDirectorsLoans ?? 0,
      shareCapital: q?.shareCapital ?? 100,
      retainedProfits: totalIncome - (ct1.expenseSummary.allowable + ct1.expenseSummary.disallowed),
    };

    const reportData = assembleBalanceSheetData(bsInput, meta);

    if (exportType === "pdf") {
      generateBalanceSheetPdf(reportData);
    } else {
      generateBalanceSheetExcel(reportData);
    }
    toast.success("Balance sheet exported");
  };

  // ── Abridged Accounts Export ────────────────────────────────
  const handleAbridgedExport = (exportType: "excel" | "pdf") => {
    const txs = accountFilteredTransactions || [];
    const meta = buildReportMeta();
    const now = new Date();
    const ty = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
    const raw = localStorage.getItem(`ct1_questionnaire_${user?.id}_${ty}`);
    const q = raw ? JSON.parse(raw) : null;

    let totalIncome = 0;
    let totalExpensesAb = 0;
    txs.forEach(t => {
      if (t.type === "income") totalIncome += Math.abs(t.amount);
      else totalExpensesAb += Math.abs(t.amount);
    });
    const cashAtBank = totalIncome - totalExpensesAb;

    const vehicleNBV = ct1.vehicleAsset ? ct1.vehicleAsset.depreciation.netBookValue : 0;
    const directorsLoanNet = ct1.netDirectorsLoan;

    // Director names from onboarding
    const directorNames: string[] = [];
    const dirCount = parseInt(localStorage.getItem("director_count") || "1", 10);
    for (let i = 1; i <= dirCount; i++) {
      const dRaw = localStorage.getItem(`director_onboarding_${user?.id}_${i}`);
      if (dRaw) {
        const d = JSON.parse(dRaw);
        if (d.first_name || d.last_name) {
          directorNames.push(`${d.first_name || ""} ${d.last_name || ""}`.trim());
        }
      }
    }
    if (directorNames.length === 0) directorNames.push("Director");

    const abInput: AbridgedAccountsInput = {
      companyName: companyInfo.companyName || "Company",
      croNumber: companyInfo.croNumber || "",
      registeredAddress: companyInfo.registeredAddress || "",
      accountingYearEnd: `31 December ${ty}`,
      directorNames,
      fixedAssetsTangible: vehicleNBV,
      stock: q?.currentAssetsStock ?? 0,
      wip: 0,
      debtors: (ct1.rctPrepayment > 0 ? ct1.rctPrepayment : 0) + (directorsLoanNet < 0 ? Math.abs(directorsLoanNet) : 0),
      prepayments: 0,
      cashAtBank,
      creditors: q?.liabilitiesCreditors ?? 0,
      accruals: 0,
      taxation: 0,
      bankLoans: q?.liabilitiesBankLoans ?? 0,
      directorsLoans: directorsLoanNet > 0 ? directorsLoanNet : 0,
      directorsLoanDirection: directorsLoanNet > 0 ? "from_company" : undefined,
      shareCapital: q?.shareCapital ?? 100,
      retainedProfits: totalIncome - (ct1.expenseSummary.allowable + ct1.expenseSummary.disallowed) - (q?.shareCapital ?? 100),
    };

    const reportData = assembleAbridgedAccountsData(abInput, meta);

    if (exportType === "pdf") {
      generateAbridgedAccountsPdf(reportData);
    } else {
      generateAbridgedAccountsExcel(reportData);
    }
    toast.success("Abridged accounts exported");
  };

  // Calculate totals (excluding internal transfers)
  const balance = useMemo(() => {
    if (!accountFilteredTransactions || !accounts) return 0;
    
    // Find internal transfer account IDs
    const internalTransferIds = new Set(
      accounts
        .filter(a => a.name.toLowerCase().includes('transfer') || a.name.toLowerCase().includes('internal'))
        .map(a => a.id)
    );
    
    return accountFilteredTransactions.reduce((sum, t) => {
      // Skip internal transfers
      if (t.account_id && internalTransferIds.has(t.account_id)) return sum;
      return sum + (t.type === "income" ? t.amount : -Math.abs(t.amount));
    }, 0);
  }, [accountFilteredTransactions, accounts]);

  return (
    <AppLayout>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected transactions will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDelete.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all transactions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>all {transactions?.length || 0} transactions</strong> and import batches. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAll.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Account Dialog */}
      <Dialog open={showAddAccountDialog} onOpenChange={setShowAddAccountDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="account-name">Account Name</Label>
              <Input
                id="account-name"
                placeholder="e.g., AIB Current Account"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-type">Account Type</Label>
              <Select value={newAccountType} onValueChange={(value: AccountType) => setNewAccountType(value)}>
                <SelectTrigger id="account-type">
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="limited_company">Limited Company</SelectItem>
                  <SelectItem value="sole_trader">Sole Trader</SelectItem>
                  <SelectItem value="directors_personal_tax">Director's Personal Tax</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-description">Description (optional)</Label>
              <Input
                id="account-description"
                placeholder="e.g., Main business current account"
                value={newAccountDescription}
                onChange={(e) => setNewAccountDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAccountDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAccount}>
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation */}
      <AlertDialog open={!!deleteAccountId} onOpenChange={() => setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteAccountTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                By deleting this account you will permanently lose:
              </span>
              <span className="block font-medium text-foreground">
                - All transactions imported to this account{"\n"}
                - All categorization and matching data{"\n"}
                - All reports generated for this account
              </span>
              <span className="block font-semibold text-destructive">
                This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAccountMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Forever"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
        <div className="flex items-center justify-between">
          {/* Left spacer */}
          <div className="w-24" />
          
          {/* Center - title */}
          <div className="flex-1 text-center">
            <h1 className="font-semibold text-xl">Transactions</h1>
          </div>
          
          {/* Right - actions */}
          <div className="w-24 flex justify-end">
            {!selectionMode ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectionMode(true)}
                className="text-muted-foreground"
              >
                Select
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="text-xs"
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteAllDialog(true)}
                  className="text-destructive hover:text-destructive text-xs"
                >
                  Delete All
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={selectedIds.size === 0}
                  className="text-destructive hover:text-destructive h-8 w-8"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={clearSelection} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="px-6 py-6 max-w-5xl mx-auto space-y-5">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ledger" | "uploads" | "reports")} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-5">
            <TabsTrigger value="ledger" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Ledger
            </TabsTrigger>
            <TabsTrigger value="uploads" className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Uploads
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="space-y-5">
            {/* Bank Account Card with Selector */}
            <div className="bg-card rounded-2xl p-6 card-shadow animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-primary" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-foreground rounded-xl flex items-center justify-center">
                    {selectedAccount ? (
                      <Wallet className="w-6 h-6 text-background" />
                    ) : (
                      <Building2 className="w-6 h-6 text-background" />
                    )}
                  </div>
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-2 font-semibold hover:text-primary transition-colors">
                          {selectedAccount?.name || "All Accounts"}
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 bg-popover z-50">
                        <DropdownMenuItem 
                          onClick={() => handleAccountChange(null)}
                          className={!selectedAccountId ? "bg-accent" : ""}
                        >
                          <Building2 className="w-4 h-4 mr-2" />
                          All Accounts
                        </DropdownMenuItem>
                        {(accounts?.length ?? 0) > 0 && <DropdownMenuSeparator />}
                        {accounts?.map((account) => {
                          const isDirector = account.account_type === "directors_personal_tax";
                          const AccountIcon = isDirector ? User : Building2;
                          return (
                            <DropdownMenuItem
                              key={account.id}
                              onClick={() => handleAccountChange(account.id)}
                              className={`${selectedAccountId === account.id ? "bg-accent" : ""} group`}
                            >
                              <AccountIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="truncate">{account.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {account.account_type === "limited_company" ? "Limited Company" :
                                   account.account_type === "sole_trader" ? "Sole Trader" :
                                   "Director's Personal Tax"}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteAccountId(account.id);
                                }}
                                className="ml-2 p-1 rounded-md opacity-60 md:opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                                title="Delete account"
                              >
                                <X className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            </DropdownMenuItem>
                          );
                        })}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowAddAccountDialog(true)}>
                          <Plus className="w-4 h-4 mr-2 text-primary" />
                          <span className="text-primary">Add account</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {selectedAccount ? (
                          selectedAccount.account_type === "limited_company" ? "Limited Company" :
                          selectedAccount.account_type === "sole_trader" ? "Sole Trader" :
                          "Director's Personal Tax"
                        ) : "All Accounts"}
                        <span className="mx-1">•</span>
                        {accountFilteredTransactions?.length || 0} transactions
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedAccountId ? (
                    <CSVImportDialog
                      onImportComplete={handleImportComplete}
                      selectedFinancialAccountId={selectedAccountId}
                    />
                  ) : (
                    <Button variant="outline" size="sm" disabled title="Select an account first to import CSV">
                      <Upload className="w-4 h-4 mr-2" />
                      Import CSV
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExportClick("excel")}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportClick("pdf")}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ChartOfAccountsButton accountType={selectedAccount?.account_type} />
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Running Balance</p>
                <p className={`text-3xl font-bold ${balance >= 0 ? "" : "text-destructive"}`}>
                  €{balance.toFixed(2)}
                </p>
              </div>
            </div>


            {/* Single Process All Button */}
            <div className="flex justify-center">
              <Button
                onClick={handleBulkRecategorize}
                disabled={isRecategorizing || isMatching}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8 py-3 h-auto"
              >
                {isRecategorizing || isMatching ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-5 h-5 mr-2" />
                )}
                Process All
              </Button>
            </div>

            {/* Progress indicator */}
            {isRecategorizing && (
              <div className="bg-muted/50 rounded-xl p-4">
                <Progress value={recatProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2 text-center">{recatProgress}%</p>
              </div>
            )}

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 animate-fade-in" style={{ animationDelay: "0.05s" }}>
              {(["all", "income", "expense", "uncategorized"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all flex items-center gap-2 text-sm ${
                    filter === f
                      ? "bg-foreground text-background"
                      : "bg-card border border-border text-foreground hover:border-foreground/40"
                  }`}
                >
                  {f === "uncategorized" && <AlertTriangle className="w-4 h-4" />}
                  {f === "all" ? "All" : 
                   f === "uncategorized" ? `Uncategorized (${uncategorizedCount})` :
                   f === "income" ? `Income (${incomeCount})` :
                   f === "expense" ? `Expense (${expenseCount})` :
                   f}
                </button>
              ))}
            </div>

            {/* Category Ledger Sections */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : groupedByCategory.income.length === 0 && groupedByCategory.expense.length === 0 ? (
              <div className="bg-card rounded-2xl p-8 card-shadow text-center">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">No transactions found</p>
                <p className="text-sm text-muted-foreground">
                  {selectedAccountId ? "Import a CSV to get started" : "Select or create an account to import transactions"}
                </p>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
                {/* Income Section */}
                {(filter === "all" || filter === "income" || filter === "uncategorized") && groupedByCategory.income.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-lg font-bold text-green-600 dark:text-green-400">Income</h2>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        +€{groupedByCategory.incomeTotal.toFixed(2)}
                      </span>
                    </div>
                    {groupedByCategory.income.map((group) => (
                      <CategoryLedgerSection
                        key={`income-${group.categoryName}`}
                        categoryName={group.categoryName}
                        transactions={group.transactions}
                        total={group.total}
                        type="income"
                        selectionMode={selectionMode}
                        selectedIds={selectedIds}
                        onToggleSelection={toggleSelection}
                        onMatchSingle={handleMatchSingle}
                        matchingTxId={matchingTxId}
                        defaultExpanded={group.categoryName === "Uncategorized"}
                        onDeleteTransaction={handleDeleteSingleTransaction}
                      />
                    ))}
                  </div>
                )}

                {/* Expenses Section (includes Travel & Accommodation from trips) */}
                {(filter === "all" || filter === "expense" || filter === "uncategorized") && (groupedByCategory.expense.length > 0 || invoiceTrips.length > 0) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-lg font-bold text-red-600 dark:text-red-400">Expenses</h2>
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">
                        -€{groupedByCategory.expenseTotal.toFixed(2)}
                      </span>
                    </div>
                    {groupedByCategory.expense.map((group) => (
                      <CategoryLedgerSection
                        key={`expense-${group.categoryName}`}
                        categoryName={group.categoryName}
                        transactions={group.transactions}
                        total={group.total}
                        type="expense"
                        selectionMode={selectionMode}
                        selectedIds={selectedIds}
                        onToggleSelection={toggleSelection}
                        onMatchSingle={handleMatchSingle}
                        matchingTxId={matchingTxId}
                        defaultExpanded={group.categoryName === "Uncategorized"}
                        onDeleteTransaction={handleDeleteSingleTransaction}
                      />
                    ))}
                    {/* Travel & Accommodation from trip detection */}
                    {invoiceTrips.length > 0 && (
                      <>
                        {invoiceTrips.map(trip => (
                          <TripLedgerCard key={trip.invoiceId} trip={trip} />
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Assets Section */}
                {(filter === "all") && bsSections.assets.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-lg font-bold text-purple-600 dark:text-purple-400">Assets</h2>
                      <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        €{bsSections.totalAssets.toFixed(2)}
                      </span>
                    </div>
                    {bsSections.assets.map(a => (
                      <div key={a.label} className="bg-card rounded-xl card-shadow overflow-hidden">
                        <div className="w-full p-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-950/40">
                            <Building2 className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="flex-1 text-left">
                            <h3 className="font-semibold">{a.label}</h3>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-purple-600 dark:text-purple-400">€{a.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Liabilities Section */}
                {(filter === "all") && bsSections.liabilities.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-lg font-bold text-amber-600 dark:text-amber-400">Liabilities</h2>
                      <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                        €{bsSections.totalLiabilities.toFixed(2)}
                      </span>
                    </div>
                    {bsSections.liabilities.map(l => (
                      <div key={l.label} className="bg-card rounded-xl card-shadow overflow-hidden">
                        <div className="w-full p-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-100 dark:bg-amber-950/40">
                            <Receipt className="w-5 h-5 text-amber-600" />
                          </div>
                          <div className="flex-1 text-left">
                            <h3 className="font-semibold">{l.label}</h3>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-amber-600 dark:text-amber-400">€{l.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Capital Section */}
                {(filter === "all") && bsSections.capital.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-lg font-bold text-blue-600 dark:text-blue-400">Capital</h2>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        €{bsSections.totalCapital.toFixed(2)}
                      </span>
                    </div>
                    {bsSections.capital.map(c => (
                      <div key={c.label} className="bg-card rounded-xl card-shadow overflow-hidden">
                        <div className="w-full p-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-950/40">
                            <Landmark className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 text-left">
                            <h3 className="font-semibold">{c.label}</h3>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-blue-600 dark:text-blue-400">€{c.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="uploads" className="space-y-5">
            <ImportBatchesPanel />
          </TabsContent>

          <TabsContent value="reports" className="space-y-5">
            {/* Reports Header with Account Selector and Export */}
            <div className="flex items-center justify-between">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 font-semibold text-lg hover:text-primary transition-colors">
                    {selectedAccount ? (
                      <Wallet className="w-5 h-5" />
                    ) : (
                      <Building2 className="w-5 h-5" />
                    )}
                    {selectedAccount?.name || "All Accounts"}
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-popover z-50">
                  <DropdownMenuItem 
                    onClick={() => handleAccountChange(null)}
                    className={!selectedAccountId ? "bg-accent" : ""}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    All Accounts
                  </DropdownMenuItem>
                  {(accounts?.length ?? 0) > 0 && <DropdownMenuSeparator />}
                  {accounts?.map((account) => (
                    <DropdownMenuItem
                      key={account.id}
                      onClick={() => handleAccountChange(account.id)}
                      className={`${selectedAccountId === account.id ? "bg-accent" : ""} group`}
                    >
                      <Wallet className="w-4 h-4 mr-2" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="truncate">{account.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {account.account_type === "limited_company" ? "Limited Company" :
                           account.account_type === "sole_trader" ? "Sole Trader" :
                           "Director's Personal Tax"}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteAccountId(account.id);
                        }}
                        className="ml-2 p-1 rounded-md opacity-60 md:opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                        title="Delete account"
                      >
                        <X className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowAddAccountDialog(true)}>
                    <Plus className="w-4 h-4 mr-2 text-primary" />
                    <span className="text-primary">Add account</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export All
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover">
                  <DropdownMenuItem onClick={() => {
                    handleExportClick("pdf");
                    handleBalanceSheetExport("pdf");
                    if (selectedAccount?.account_type === "limited_company") handleAbridgedExport("pdf");
                  }}>
                    <FileText className="w-4 h-4 mr-2" />
                    Export All PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    handleExportClick("excel");
                    handleBalanceSheetExport("excel");
                    if (selectedAccount?.account_type === "limited_company") handleAbridgedExport("excel");
                  }}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export All Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Reports Sub-tabs */}
            <Tabs value={reportsSubTab} onValueChange={(v) => setReportsSubTab(v as typeof reportsSubTab)} className="w-full">
              <div className="overflow-x-auto -mx-1 px-1 mb-4">
                <TabsList className="inline-flex w-auto min-w-full gap-1">
                  <TabsTrigger value="pnl" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    P&L
                  </TabsTrigger>
                  <TabsTrigger value="balance" className="flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    Balance
                  </TabsTrigger>
                  {selectedAccount?.account_type !== "directors_personal_tax" && (
                    <>
                      <TabsTrigger value="vat" className="flex items-center gap-2">
                        <Receipt className="w-4 h-4" />
                        VAT
                      </TabsTrigger>
                    </>
                  )}
                  {selectedAccount?.account_type === "limited_company" && (
                    <TabsTrigger value="abridged" className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Abridged
                    </TabsTrigger>
                  )}


                </TabsList>
              </div>

              {/* P&L + CT1 Computation Sub-tab */}
              <TabsContent value="pnl" className="space-y-4 w-full">
                <div className="flex justify-end mb-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export P&L
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => handleExportClick("excel")}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportClick("pdf")}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="bg-card rounded-2xl p-6 card-shadow w-full">
                  {(() => {
                    const isPersonal = selectedAccount?.account_type === "directors_personal_tax";
                    const txs = accountFilteredTransactions || [];
                    const DIRECT_COST_KEYWORDS = ["cost of goods", "cogs", "direct cost", "materials", "stock", "inventory", "sub con", "subcontractor"];
                    const isDirect = (name: string) => DIRECT_COST_KEYWORDS.some(k => name.toLowerCase().includes(k));
                    const fmt = (v: number) => v.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                    // Income by category
                    const incomeByCategory: Record<string, number> = {};
                    let totalIncome = 0;
                    // Direct costs by category
                    const directCostsByCategory: Record<string, number> = {};
                    let totalDirectCosts = 0;
                    // Expenses by category
                    const expensesByCategory: Record<string, number> = {};
                    let totalExpenses = 0;

                    // Revenue refunds offset expenses, not income
                    const isRevenueRefund = (catName: string, desc: string) => {
                      const d = (desc || "").toLowerCase();
                      return catName === "Tax Refund (Revenue Commissioners)" ||
                        d.includes("revenue") || d.includes("collector general") ||
                        d.includes("tax refund") || d.includes("vat refund") ||
                        d.includes("rct refund") || d.includes("paye refund");
                    };

                    let revenueRefunds = 0;

                    const isDrawingsCat = (name: string) => name.toLowerCase().includes("drawing");

                    txs.forEach(t => {
                      const tRec = t as unknown as { category?: { name: string }; description?: string; amount: number; type: string };
                      const catName = tRec.category?.name || "Uncategorised";
                      const desc = tRec.description || "";
                      const amount = Math.abs(t.amount);

                      if (t.type === "income") {
                        if (isRevenueRefund(catName, desc)) {
                          revenueRefunds += amount;
                        } else {
                          incomeByCategory[catName] = (incomeByCategory[catName] || 0) + amount;
                          totalIncome += amount;
                        }
                      } else {
                        // Director's Drawings — capital withdrawal, not P&L
                        if (isDrawingsCat(catName)) return;
                        if (isDirect(catName)) {
                          directCostsByCategory[catName] = (directCostsByCategory[catName] || 0) + amount;
                          totalDirectCosts += amount;
                        } else {
                          expensesByCategory[catName] = (expensesByCategory[catName] || 0) + amount;
                          totalExpenses += amount;
                        }
                      }
                    });

                    // Travel & Accommodation: only the net amount still owed to director
                    const travelNetOwed = Math.round(
                      Math.max(0, invoiceTrips.reduce((s, t) => s + t.directorsLoanBalance, 0)) * 100
                    ) / 100;
                    if (travelNetOwed > 0) {
                      expensesByCategory["Travel & Accommodation (owed to director)"] = (expensesByCategory["Travel & Accommodation (owed to director)"] || 0) + travelNetOwed;
                      totalExpenses += travelNetOwed;
                    }

                    const netExpenses = totalExpenses - revenueRefunds;
                    const grossProfit = totalIncome - totalDirectCosts;
                    const netProfit = grossProfit - netExpenses;
                    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

                    const sortedEntries = (obj: Record<string, number>) =>
                      Object.entries(obj).sort((a, b) => b[1] - a[1]);

                    // CT1 computation (for company accounts)
                    const now = new Date();
                    const ty = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
                    const raw = localStorage.getItem(`ct1_questionnaire_${user?.id}_${ty}`);
                    const q = raw ? JSON.parse(raw) : null;

                    const disallowedTotal = ct1.disallowedByCategory.reduce((s, d) => s + d.amount, 0);
                    const motorAllowance = ct1.vehicleAsset
                      ? ct1.vehicleAsset.depreciation.annualAllowance
                      : (q?.capitalAllowancesMotorVehicles ?? 0);
                    const capitalAllowances = (q?.capitalAllowancesPlant ?? 0) + motorAllowance;
                    const travelDeduction = ct1.directorsLoanTravel;
                    // CT1: Net Profit + add-backs (disallowed) - capital allowances - travel
                    const tradingProfit = Math.max(0, netProfit + disallowedTotal - capitalAllowances - travelDeduction);
                    const lossesForward = q?.lossesForward ?? 0;
                    const taxableProfit = Math.max(0, tradingProfit - lossesForward);
                    const ctAt125 = taxableProfit * 0.125;
                    const surcharge = q?.closeCompanySurcharge ?? 0;
                    const totalCT = ctAt125 + surcharge;
                    const prelimPaid = q?.preliminaryCTPaid ?? 0;
                    const rctCredit = ct1.rctPrepayment;
                    const balanceDue = totalCT - prelimPaid - rctCredit;

                    return (
                      <>
                        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          {isPersonal ? "Income & Expenditure" : "Profit & Loss / CT1"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {selectedAccount?.name || "All Accounts"}
                        </p>

                        <div className="space-y-1 text-sm">
                          {/* Income */}
                          <div className="py-2 border-b-2 border-foreground/20">
                            <p className="font-semibold text-base mb-1">Income</p>
                            {sortedEntries(incomeByCategory).map(([cat, amt]) => (
                              <div key={cat} className="flex justify-between py-0.5 pl-4">
                                <span className="text-muted-foreground">{cat}</span>
                                <span className="tabular-nums">{fmt(amt)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between pt-1 font-semibold">
                              <span></span>
                              <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(totalIncome)}</span>
                            </div>
                          </div>

                          {/* Direct Costs */}
                          {totalDirectCosts > 0 && (
                            <div className="py-2 border-b border-border">
                              <p className="font-semibold text-base mb-1">Direct Costs</p>
                              {sortedEntries(directCostsByCategory).map(([cat, amt]) => (
                                <div key={cat} className="flex justify-between py-0.5 pl-4">
                                  <span className="text-muted-foreground">{cat}</span>
                                  <span className="tabular-nums">{fmt(amt)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between pt-1 font-semibold">
                                <span></span>
                                <span className="tabular-nums">{fmt(totalDirectCosts)}</span>
                              </div>
                            </div>
                          )}

                          {/* Gross Profit */}
                          <div className="flex justify-between py-2 border-b-2 border-foreground/20 font-semibold text-base">
                            <span>Gross Profit</span>
                            <span className={`tabular-nums ${grossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {fmt(grossProfit)}
                            </span>
                          </div>

                          {/* Expenses */}
                          <div className="py-2 border-b border-border">
                            <p className="font-semibold text-base mb-1">Expenses</p>
                            {sortedEntries(expensesByCategory).map(([cat, amt]) => (
                              <div key={cat} className="flex justify-between py-0.5 pl-4">
                                <span className="text-muted-foreground">{cat}</span>
                                <span className="tabular-nums">{fmt(amt)}</span>
                              </div>
                            ))}
                            {revenueRefunds > 0 && (
                              <div className="flex justify-between py-0.5 pl-4">
                                <span className="text-emerald-600 dark:text-emerald-400">Less: Revenue Refund</span>
                                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">({fmt(revenueRefunds)})</span>
                              </div>
                            )}
                            <div className="flex justify-between pt-1 font-semibold">
                              <span>Net Expenses</span>
                              <span className="tabular-nums">{fmt(netExpenses)}</span>
                            </div>
                          </div>

                          {/* Net Profit */}
                          <div className={`rounded-xl p-4 mt-2 ${netProfit >= 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-lg font-semibold">Net Profit</span>
                                {totalIncome > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Margin: {profitMargin.toFixed(1)}%
                                  </p>
                                )}
                              </div>
                              <span className={`text-3xl font-bold tabular-nums ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                €{fmt(netProfit)}
                              </span>
                            </div>
                          </div>

                          {/* CT1 Corporation Tax Computation (company accounts only) */}
                          {!isPersonal && (
                            <>
                              <div className="border-t-2 border-foreground/20 mt-6 pt-4">
                                <p className="font-semibold text-base mb-2 flex items-center gap-2">
                                  <Building2 className="w-4 h-4" />
                                  Corporation Tax (CT1)
                                </p>
                              </div>

                              <div className="flex justify-between py-1.5">
                                <span>Net Profit (per accounts)</span>
                                <span className="tabular-nums">{fmt(netProfit)}</span>
                              </div>
                              {ct1.disallowedByCategory.length > 0 && (
                                <>
                                  <p className="text-xs text-muted-foreground mt-1 mb-0.5">Add back: non-deductible expenses</p>
                                  {ct1.disallowedByCategory.map(({ category, amount }) => (
                                    <div key={category} className="flex justify-between py-0.5 pl-4 text-amber-600 dark:text-amber-400">
                                      <span className="text-xs">{category}</span>
                                      <span className="tabular-nums text-xs">{fmt(amount)}</span>
                                    </div>
                                  ))}
                                </>
                              )}
                              {capitalAllowances > 0 && (
                                <div className="flex justify-between py-1.5">
                                  <span>Less: Capital Allowances</span>
                                  <span className="tabular-nums">({fmt(capitalAllowances)})</span>
                                </div>
                              )}
                              {travelDeduction > 0 && (
                                <div className="flex justify-between py-1.5">
                                  <span>Less: Travel Deduction</span>
                                  <span className="tabular-nums">({fmt(travelDeduction)})</span>
                                </div>
                              )}
                              <div className="border-t border-border my-1" />
                              <div className="flex justify-between py-1.5 font-semibold">
                                <span>Trading Profit</span>
                                <span className="tabular-nums">{fmt(tradingProfit)}</span>
                              </div>
                              {lossesForward > 0 && (
                                <div className="flex justify-between py-1.5">
                                  <span>Less: Losses B/F</span>
                                  <span className="tabular-nums">{fmt(lossesForward)}</span>
                                </div>
                              )}
                              <div className="flex justify-between py-1.5 font-semibold">
                                <span>Taxable Profit</span>
                                <span className="tabular-nums">{fmt(taxableProfit)}</span>
                              </div>
                              <div className="border-t border-border my-1" />
                              <div className="flex justify-between py-1.5">
                                <span>CT @ 12.5%</span>
                                <span className="tabular-nums">{fmt(ctAt125)}</span>
                              </div>
                              {surcharge > 0 && (
                                <div className="flex justify-between py-1.5">
                                  <span>Close Company Surcharge</span>
                                  <span className="tabular-nums">{fmt(surcharge)}</span>
                                </div>
                              )}
                              <div className="flex justify-between py-1.5 font-semibold">
                                <span>Total CT Liability</span>
                                <span className="tabular-nums">{fmt(totalCT)}</span>
                              </div>
                              {rctCredit > 0 && (
                                <div className="flex justify-between py-1.5">
                                  <span>Less: RCT Credit</span>
                                  <span className="tabular-nums">{fmt(rctCredit)}</span>
                                </div>
                              )}
                              {prelimPaid > 0 && (
                                <div className="flex justify-between py-1.5">
                                  <span>Less: Preliminary CT Paid</span>
                                  <span className="tabular-nums">{fmt(prelimPaid)}</span>
                                </div>
                              )}

                              <div className={`rounded-xl p-4 mt-2 ${balanceDue <= 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-lg font-semibold">
                                    {balanceDue <= 0 ? "CT Refund Due" : "CT Balance Due"}
                                  </span>
                                  <span className={`text-3xl font-bold tabular-nums ${balanceDue <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                    €{fmt(Math.abs(balanceDue))}
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </TabsContent>

              {/* Balance Sub-tab */}
              <TabsContent value="balance" className="space-y-4 w-full">
                <div className="flex justify-end mb-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export Balance Sheet
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => handleBalanceSheetExport("excel")}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBalanceSheetExport("pdf")}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="bg-card rounded-2xl p-6 card-shadow w-full">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Scale className="w-5 h-5" />
                    Balance Sheet
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {selectedAccount?.name || "All Accounts"}
                  </p>
                  
                  {(() => {
                    const txs = accountFilteredTransactions || [];
                    const invs = invoicesData || [];
                    const fmt = (v: number) => v.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString("en-IE", { day: "numeric", month: "short" }); } catch { return d; } };

                    // Bank balance = sum of all transactions (income positive, expense negative)
                    let totalIncome = 0;
                    let totalExpensesBS = 0;

                    // Group income by category, expenses by category, drawings separately
                    const incomeByCategory: Record<string, { amount: number; txns: typeof txs }> = {};
                    const expenseByCategory: Record<string, { amount: number; txns: typeof txs }> = {};
                    const drawingTxns: typeof txs = [];
                    let totalDrawings = 0;

                    txs.forEach(t => {
                      const catName = (t as unknown as { category?: { name: string } }).category?.name || "Uncategorised";
                      if (t.type === "income") {
                        totalIncome += Math.abs(t.amount);
                        if (!incomeByCategory[catName]) incomeByCategory[catName] = { amount: 0, txns: [] };
                        incomeByCategory[catName].amount += Math.abs(t.amount);
                        incomeByCategory[catName].txns.push(t);
                      } else {
                        totalExpensesBS += Math.abs(t.amount);
                        if (catName.toLowerCase().includes("drawing")) {
                          drawingTxns.push(t);
                          totalDrawings += Math.abs(t.amount);
                        }
                        if (!expenseByCategory[catName]) expenseByCategory[catName] = { amount: 0, txns: [] };
                        expenseByCategory[catName].amount += Math.abs(t.amount);
                        expenseByCategory[catName].txns.push(t);
                      }
                    });
                    const bankBalance = totalIncome - totalExpensesBS;

                    // RCT prepayment detail from invoices
                    const now2 = new Date();
                    const ty2 = now2.getMonth() >= 10 ? now2.getFullYear() : now2.getFullYear() - 1;
                    const rctDetails: { invoiceNumber: string; customerName: string; date: string; grossAmount: number; rctAmount: number }[] = [];
                    for (const inv of invs) {
                      const invRec = inv as unknown as Record<string, unknown>;
                      const invDate = (invRec.invoice_date as string) ?? "";
                      if (invDate < `${ty2}-01-01` || invDate > `${ty2}-12-31`) continue;
                      try {
                        const notes = invRec.notes ? JSON.parse(invRec.notes as string) : null;
                        if (notes?.rct_enabled && notes?.rct_amount > 0) {
                          rctDetails.push({
                            invoiceNumber: (invRec.invoice_number as string) || "",
                            customerName: (invRec.customer as Record<string, unknown>)?.name as string || "Unknown",
                            date: invDate,
                            grossAmount: Number(invRec.total_amount) || 0,
                            rctAmount: Number(notes.rct_amount) || 0,
                          });
                        }
                      } catch { /* not JSON */ }
                    }

                    // Director's Loan Account: travel owed to director, minus drawings already taken
                    const directorsLoanNet = ct1.netDirectorsLoan;
                    const directorDebtor = directorsLoanNet < 0 ? Math.abs(directorsLoanNet) : 0;
                    const directorLiability = directorsLoanNet > 0 ? directorsLoanNet : 0;

                    // Fixed assets
                    const vehicleNBV = ct1.vehicleAsset ? ct1.vehicleAsset.depreciation.netBookValue : 0;
                    const fixedAssets = vehicleNBV;

                    // Current assets
                    const rctPrepayment = ct1.rctPrepayment;
                    const currentAssets = bankBalance + rctPrepayment + directorDebtor;

                    const totalAssets = fixedAssets + currentAssets;

                    // Liabilities
                    const totalLiabilities = directorLiability;

                    // Capital
                    const netAssets = totalAssets - totalLiabilities;

                    // Compute breakdowns for expandable rows
                    const totalExpensesAll = ct1.expenseSummary.allowable + ct1.expenseSummary.disallowed;
                    const shareCapital = 100;
                    const retainedProfits = totalIncome - totalExpensesAll;

                    const BsRow = ({ label, amount, bold, sub }: { label: string; amount: number; bold?: boolean; sub?: string }) => (
                      <div className={`flex items-center justify-between py-1.5 ${bold ? "font-semibold border-t border-foreground/20 pt-2" : ""}`}>
                        <div>
                          <span className={sub ? "pl-4 text-muted-foreground" : ""}>{label}</span>
                        </div>
                        <span className="tabular-nums">{fmt(amount)}</span>
                      </div>
                    );

                    const DetailRow = ({ label, amount, indent, muted }: { label: string; amount: number; indent?: boolean; muted?: boolean }) => (
                      <div className={`flex justify-between py-0.5 text-xs ${muted ? "text-muted-foreground" : ""}`}>
                        <span className={indent ? "pl-3" : ""}>{label}</span>
                        <span className="tabular-nums">{amount < 0 ? `(€${fmt(Math.abs(amount))})` : `€${fmt(amount)}`}</span>
                      </div>
                    );

                    const TxnRow = ({ desc, date, amount }: { desc: string; date: string; amount: number }) => (
                      <div className="flex justify-between py-0.5 text-[11px] text-muted-foreground">
                        <span className="pl-3 truncate mr-2">{desc} <span className="opacity-60">{fmtDate(date)}</span></span>
                        <span className="tabular-nums shrink-0">€{fmt(amount)}</span>
                      </div>
                    );

                    const ExpandableRow = ({ label, amount, children }: { label: string; amount: number; children: React.ReactNode }) => (
                      <details className="group pl-4">
                        <summary className="flex items-center justify-between py-1.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors list-none [&::-webkit-details-marker]:hidden">
                          <span className="flex items-center gap-1.5">
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                            {label}
                          </span>
                          <span className="tabular-nums">{fmt(amount)}</span>
                        </summary>
                        <div className="ml-5 pb-2 border-l border-border/50 pl-3 mt-1 space-y-0.5">
                          {children}
                        </div>
                      </details>
                    );

                    return (
                      <div className="space-y-1 text-sm">
                        {/* Fixed Assets */}
                        {fixedAssets > 0 && (
                          <div className="py-2 border-b border-border">
                            <p className="font-semibold text-base mb-1">Fixed Assets</p>
                            {vehicleNBV > 0 && ct1.vehicleAsset && (
                              <ExpandableRow label={`Motor Vehicle (${ct1.vehicleAsset.reg})`} amount={vehicleNBV}>
                                <DetailRow label="Purchase cost" amount={ct1.vehicleAsset.depreciation.purchaseCost} indent />
                                <DetailRow label={`Less: Accumulated depreciation (${ct1.vehicleAsset.depreciation.yearsUsed} yr${ct1.vehicleAsset.depreciation.yearsUsed !== 1 ? "s" : ""})`} amount={-(ct1.vehicleAsset.depreciation.purchaseCost - vehicleNBV)} indent />
                                <DetailRow label={`Annual capital allowance (12.5%)`} amount={ct1.vehicleAsset.depreciation.annualAllowance} indent muted />
                              </ExpandableRow>
                            )}
                            <BsRow label="Total Fixed Assets" amount={fixedAssets} bold />
                          </div>
                        )}

                        {/* Current Assets */}
                        <div className="py-2 border-b border-border">
                          <p className="font-semibold text-base mb-1">Current Assets</p>

                          <ExpandableRow label="Bank Balance" amount={bankBalance}>
                            {Object.entries(incomeByCategory).sort((a, b) => b[1].amount - a[1].amount).map(([cat, { amount: catAmt, txns: catTxns }]) => (
                              <details key={cat} className="group/sub">
                                <summary className="flex justify-between py-0.5 text-xs cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-foreground text-muted-foreground">
                                  <span className="flex items-center gap-1 pl-3">
                                    <ChevronRight className="w-3 h-3 transition-transform group-open/sub:rotate-90" />
                                    {cat}
                                  </span>
                                  <span className="tabular-nums">€{fmt(catAmt)}</span>
                                </summary>
                                <div className="ml-6 border-l border-border/30 pl-2">
                                  {catTxns.map(t => (
                                    <TxnRow key={t.id} desc={(t as unknown as Record<string, unknown>).description as string || cat} date={(t as unknown as Record<string, unknown>).transaction_date as string || ""} amount={Math.abs(t.amount)} />
                                  ))}
                                </div>
                              </details>
                            ))}
                            <div className="border-t border-border/30 mt-1 pt-1">
                              <DetailRow label="Total income received" amount={totalIncome} indent />
                            </div>
                            {Object.entries(expenseByCategory).sort((a, b) => b[1].amount - a[1].amount).slice(0, 10).map(([cat, { amount: catAmt }]) => (
                              <DetailRow key={cat} label={cat} amount={-catAmt} indent muted />
                            ))}
                            <div className="border-t border-border/30 mt-1 pt-1">
                              <DetailRow label="Less: Total payments out" amount={-totalExpensesBS} indent />
                            </div>
                          </ExpandableRow>

                          {rctPrepayment > 0 && (
                            <ExpandableRow label="RCT Prepayment (CT credit)" amount={rctPrepayment}>
                              {rctDetails.map((d, i) => (
                                <div key={i} className="flex justify-between py-0.5 text-[11px] text-muted-foreground">
                                  <span className="pl-3 truncate mr-2">
                                    {d.invoiceNumber} — {d.customerName} <span className="opacity-60">{fmtDate(d.date)}</span>
                                  </span>
                                  <span className="tabular-nums shrink-0">€{fmt(d.rctAmount)}</span>
                                </div>
                              ))}
                              {rctDetails.length === 0 && (
                                <div className="text-[10px] text-muted-foreground pl-3">
                                  Total RCT deducted from invoices by principal contractors.
                                </div>
                              )}
                              <div className="text-[10px] text-muted-foreground pl-3 mt-1">
                                Offset against Corporation Tax liability.
                              </div>
                            </ExpandableRow>
                          )}

                          {directorDebtor > 0 && (
                            <ExpandableRow label="Director's Current A/C (debtor)" amount={directorDebtor}>
                              <DetailRow label="Drawings taken by director" amount={ct1.directorsDrawings} indent />
                              {drawingTxns.length > 0 && (
                                <details className="group/sub ml-3">
                                  <summary className="flex items-center gap-1 py-0.5 text-[11px] text-muted-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                    <ChevronRight className="w-3 h-3 transition-transform group-open/sub:rotate-90" />
                                    {drawingTxns.length} transaction{drawingTxns.length !== 1 ? "s" : ""}
                                  </summary>
                                  <div className="ml-4 border-l border-border/30 pl-2">
                                    {drawingTxns.map(t => (
                                      <TxnRow key={t.id} desc={(t as unknown as Record<string, unknown>).description as string || "Drawing"} date={(t as unknown as Record<string, unknown>).transaction_date as string || ""} amount={Math.abs(t.amount)} />
                                    ))}
                                  </div>
                                </details>
                              )}
                              <DetailRow label="Less: Travel allowance owed to director" amount={-ct1.directorsLoanTravel} indent />
                              {invoiceTrips.length > 0 && (
                                <details className="group/sub ml-3">
                                  <summary className="flex items-center gap-1 py-0.5 text-[11px] text-muted-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                    <ChevronRight className="w-3 h-3 transition-transform group-open/sub:rotate-90" />
                                    {invoiceTrips.length} trip{invoiceTrips.length !== 1 ? "s" : ""}
                                  </summary>
                                  <div className="ml-4 border-l border-border/30 pl-2">
                                    {invoiceTrips.map((trip, i) => (
                                      <div key={i} className="flex justify-between py-0.5 text-[11px] text-muted-foreground">
                                        <span className="pl-3 truncate mr-2">
                                          {trip.jobLocation} <span className="opacity-60">{fmtDate(trip.invoiceDate)}</span>
                                        </span>
                                        <span className="tabular-nums shrink-0">€{fmt(trip.totalRevenueAllowance)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              )}
                              <div className="text-[10px] text-muted-foreground mt-1 pl-3">
                                Director has drawn more than the company owes — net debtor.
                              </div>
                            </ExpandableRow>
                          )}

                          <BsRow label="Total Current Assets" amount={currentAssets} bold />
                        </div>

                        {/* Total Assets */}
                        <div className="flex justify-between py-2 border-b-2 border-foreground/20 font-semibold text-base">
                          <span>Total Assets</span>
                          <span className={`tabular-nums ${totalAssets >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {fmt(totalAssets)}
                          </span>
                        </div>

                        {/* Current Liabilities */}
                        <div className="py-2 border-b border-border">
                          <p className="font-semibold text-base mb-1">Current Liabilities</p>
                          {directorLiability > 0 && (
                            <ExpandableRow label="Director's Loan Account" amount={directorLiability}>
                              <DetailRow label="Revenue travel allowance (tax-free)" amount={ct1.directorsLoanTravel} indent />
                              {invoiceTrips.length > 0 && (
                                <details className="group/sub ml-3">
                                  <summary className="flex items-center gap-1 py-0.5 text-[11px] text-muted-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                    <ChevronRight className="w-3 h-3 transition-transform group-open/sub:rotate-90" />
                                    {invoiceTrips.length} trip{invoiceTrips.length !== 1 ? "s" : ""}
                                  </summary>
                                  <div className="ml-4 border-l border-border/30 pl-2">
                                    {invoiceTrips.map((trip, i) => (
                                      <div key={i} className="flex justify-between py-0.5 text-[11px] text-muted-foreground">
                                        <span className="pl-3 truncate mr-2">
                                          {trip.jobLocation} <span className="opacity-60">{fmtDate(trip.invoiceDate)}</span>
                                        </span>
                                        <span className="tabular-nums shrink-0">€{fmt(trip.totalRevenueAllowance)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              )}
                              <DetailRow label="Less: Drawings taken by director" amount={-ct1.directorsDrawings} indent />
                              {drawingTxns.length > 0 && (
                                <details className="group/sub ml-3">
                                  <summary className="flex items-center gap-1 py-0.5 text-[11px] text-muted-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                    <ChevronRight className="w-3 h-3 transition-transform group-open/sub:rotate-90" />
                                    {drawingTxns.length} transaction{drawingTxns.length !== 1 ? "s" : ""}
                                  </summary>
                                  <div className="ml-4 border-l border-border/30 pl-2">
                                    {drawingTxns.map(t => (
                                      <TxnRow key={t.id} desc={(t as unknown as Record<string, unknown>).description as string || "Drawing"} date={(t as unknown as Record<string, unknown>).transaction_date as string || ""} amount={Math.abs(t.amount)} />
                                    ))}
                                  </div>
                                </details>
                              )}
                              <div className="text-[10px] text-muted-foreground mt-1 pl-3">
                                Company owes director this amount — net of travel owed minus drawings already taken.
                              </div>
                            </ExpandableRow>
                          )}
                          {totalLiabilities === 0 && (
                            <div className="py-1.5 pl-4 text-muted-foreground">None</div>
                          )}
                          <BsRow label="Total Liabilities" amount={totalLiabilities} bold />
                        </div>

                        {/* Capital */}
                        <div className="py-2 border-b border-border">
                          <p className="font-semibold text-base mb-1">Capital</p>
                          <BsRow label="Share Capital" amount={shareCapital} sub="y" />
                          <ExpandableRow label="Retained Profits" amount={retainedProfits}>
                            {ct1.detectedIncome.map(({ category, amount: catAmt }) => (
                              <DetailRow key={category} label={category} amount={catAmt} indent />
                            ))}
                            {ct1.detectedIncome.length > 0 && (
                              <div className="border-t border-border/30 mt-1 pt-1">
                                <DetailRow label="Total income" amount={totalIncome} indent />
                              </div>
                            )}
                            {ct1.expenseByCategory.sort((a, b) => b.amount - a.amount).map(({ category, amount: catAmt }) => (
                              <DetailRow key={category} label={category} amount={-catAmt} indent muted />
                            ))}
                            <div className="border-t border-border/30 mt-1 pt-1">
                              <DetailRow label="Less: Total expenses" amount={-totalExpensesAll} indent />
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 pl-3">
                              Profit retained in the company after all expenses. Drawings are excluded (capital, not P&L).
                            </div>
                          </ExpandableRow>
                        </div>

                        {/* Net Assets / Capital */}
                        <div className={`rounded-xl p-4 mt-2 ${netAssets >= 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-lg font-semibold">Net Assets (Capital)</span>
                              <p className="text-xs text-muted-foreground">Assets − Liabilities</p>
                            </div>
                            <span className={`text-3xl font-bold tabular-nums ${netAssets >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              €{fmt(netAssets)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </TabsContent>

              {/* VAT Sub-tab */}
              <TabsContent value="vat" className="space-y-4 w-full">
                <div className="flex justify-end mb-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export VAT
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => handleVATExportClick("excel")}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleVATExportClick("pdf")}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <VATSummaryCard
                  transactions={accountFilteredTransactions || []}
                  accountName={selectedAccount?.name || "All Accounts"}
                />
              </TabsContent>

              {/* Abridged Accounts Sub-tab (CRO Filing) */}
              <TabsContent value="abridged" className="space-y-4 w-full">
                <div className="flex justify-end mb-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export Abridged
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => handleAbridgedExport("excel")}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAbridgedExport("pdf")}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="bg-card rounded-2xl p-6 card-shadow w-full">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Briefcase className="w-5 h-5" />
                        Abridged Financial Statements
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        CRO Filing • Companies Act 2014 • FRS 102
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const txs = accountFilteredTransactions || [];
                    const fmt = (v: number) => v.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                    // Bank balance
                    let abIncome = 0;
                    let abExpenses = 0;
                    txs.forEach(t => {
                      if (t.type === "income") abIncome += Math.abs(t.amount);
                      else abExpenses += Math.abs(t.amount);
                    });
                    const cash = abIncome - abExpenses;

                    // Fixed assets from CT1 data
                    const vehicleNBV = ct1.vehicleAsset ? ct1.vehicleAsset.depreciation.netBookValue : 0;
                    const fixedAssets = vehicleNBV;

                    // Director's Loan: net of travel minus drawings
                    const directorsLoanNet = ct1.netDirectorsLoan;
                    const directorDebtorAb = directorsLoanNet < 0 ? Math.abs(directorsLoanNet) : 0;
                    const directorsLoan = directorsLoanNet > 0 ? directorsLoanNet : 0;
                    const creditorsWithin1yr = directorsLoan;

                    // Current assets
                    const rctDebtors = ct1.rctPrepayment; // RCT prepayment = debtor (asset against CT1)
                    const totalCurrentAssets = cash + rctDebtors + directorDebtorAb;

                    const netCurrentAssets = totalCurrentAssets - creditorsWithin1yr;
                    const totalAssetsLessCurrentLiabilities = fixedAssets + netCurrentAssets;
                    const creditorsAfter1yr = 0;
                    const netAssets = totalAssetsLessCurrentLiabilities - creditorsAfter1yr;

                    const shareCapital = 100; // Nominal
                    const retainedEarnings = netAssets - shareCapital;
                    const shareholdersFunds = shareCapital + retainedEarnings;

                    const isBalanced = Math.abs(netAssets - shareholdersFunds) < 0.01;

                    const AbRow = ({ label, amount, bold, indent, negative }: { label: string; amount: number; bold?: boolean; indent?: boolean; negative?: boolean }) => (
                      <div className={`flex justify-between py-1.5 text-sm ${bold ? "font-semibold" : ""} ${indent ? "pl-4" : ""}`}>
                        <span>{label}</span>
                        <span className="font-mono tabular-nums">
                          {negative ? `(€${fmt(Math.abs(amount))})` : `€${fmt(amount)}`}
                        </span>
                      </div>
                    );

                    return (
                      <div className="space-y-6">
                        {/* Eligibility Notice */}
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div>
                              <p className="font-medium text-amber-800 dark:text-amber-200">Abridged Accounts Requirements</p>
                              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                Shareholder consent required. P&L excluded per Companies Act 2014. Suitable for small companies only.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Abridged Balance Sheet */}
                        <div className="border rounded-xl overflow-hidden">
                          <div className="bg-muted/50 px-4 py-3 border-b">
                            <h4 className="font-semibold">Abridged Balance Sheet</h4>
                            <p className="text-xs text-muted-foreground">As at period end</p>
                          </div>

                          <div className="p-4 space-y-4">
                            {/* Fixed Assets */}
                            <div>
                              <div className="flex justify-between py-2 border-b font-medium text-sm text-muted-foreground uppercase tracking-wide">
                                <span>Fixed Assets</span>
                                <span></span>
                              </div>
                              {vehicleNBV > 0 && (
                                <AbRow label={`Motor Vehicle (${ct1.vehicleAsset!.reg})`} amount={vehicleNBV} indent />
                              )}
                              <AbRow label="Total Fixed Assets" amount={fixedAssets} bold />
                            </div>

                            {/* Current Assets */}
                            <div>
                              <div className="flex justify-between py-2 border-b font-medium text-sm text-muted-foreground uppercase tracking-wide">
                                <span>Current Assets</span>
                                <span></span>
                              </div>
                              {rctDebtors > 0 && (
                                <AbRow label="Debtors (RCT prepayment)" amount={rctDebtors} indent />
                              )}
                              {directorDebtorAb > 0 && (
                                <AbRow label="Director's Current A/C (debtor)" amount={directorDebtorAb} indent />
                              )}
                              <AbRow label="Cash at bank" amount={cash} indent />
                              <div className="border-t mt-1 pt-1">
                                <AbRow label="Total Current Assets" amount={totalCurrentAssets} bold />
                              </div>
                            </div>

                            {/* Creditors within 1 year */}
                            <div>
                              <div className="flex justify-between py-2 border-b font-medium text-sm text-muted-foreground uppercase tracking-wide">
                                <span>Creditors: amounts falling due within one year</span>
                                <span></span>
                              </div>
                              {directorsLoan > 0 && (
                                <AbRow label="Director's Loan Account" amount={directorsLoan} indent negative />
                              )}
                              <AbRow label="Total" amount={creditorsWithin1yr} negative />
                            </div>

                            {/* Net Current Assets */}
                            <div className="flex justify-between py-3 border-t border-b font-semibold bg-muted/30 px-2 rounded">
                              <span>Net Current Assets</span>
                              <span className="font-mono tabular-nums">€{fmt(netCurrentAssets)}</span>
                            </div>

                            {/* Total Assets Less Current Liabilities */}
                            <AbRow label="Total Assets Less Current Liabilities" amount={totalAssetsLessCurrentLiabilities} bold />

                            {/* Creditors > 1 year */}
                            {creditorsAfter1yr > 0 && (
                              <AbRow label="Creditors: amounts falling due after more than one year" amount={creditorsAfter1yr} negative />
                            )}

                            {/* Net Assets */}
                            <div className="flex justify-between py-3 border-t-2 border-primary font-bold text-lg">
                              <span>Net Assets</span>
                              <span className={`font-mono tabular-nums ${netAssets >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                €{fmt(netAssets)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Capital and Reserves */}
                        <div className="border rounded-xl overflow-hidden">
                          <div className="bg-muted/50 px-4 py-3 border-b">
                            <h4 className="font-semibold">Capital and Reserves</h4>
                          </div>
                          <div className="p-4 space-y-2">
                            <AbRow label="Called-up share capital" amount={shareCapital} />
                            <div className="flex justify-between py-1.5 text-sm">
                              <span>Profit and loss account</span>
                              <span className={`font-mono tabular-nums ${retainedEarnings < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                                €{fmt(retainedEarnings)}
                              </span>
                            </div>
                            <div className="flex justify-between py-3 border-t-2 border-primary font-bold text-lg">
                              <span>Shareholders' Funds</span>
                              <span className={`font-mono tabular-nums ${shareholdersFunds >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                €{fmt(shareholdersFunds)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Balance Validation */}
                        <div className={`rounded-xl p-4 ${isBalanced ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'}`}>
                          <div className="flex items-center gap-2">
                            {isBalanced ? (
                              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                            )}
                            <span className={`font-medium ${isBalanced ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                              {isBalanced ? 'Balance sheet is in balance' : 'Balance sheet does not balance - review mapping'}
                            </span>
                          </div>
                        </div>

                        {/* Directors' Statement */}
                        <div className="border rounded-xl p-4 bg-muted/20">
                          <h4 className="font-semibold mb-3">Directors' Declaration</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            The directors acknowledge their responsibilities for complying with the requirements of the Companies Act 2014
                            with respect to accounting records and the preparation of financial statements. The directors have elected to
                            prepare abridged financial statements in accordance with Section 352 of the Companies Act 2014.
                          </p>
                        </div>

                        {/* Audit Exemption Statement */}
                        <div className="border rounded-xl p-4 bg-muted/20">
                          <h4 className="font-semibold mb-3">Audit Exemption Statement</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            The company qualifies as a small company under Section 280A of the Companies Act 2014 and has availed
                            of the audit exemption under Section 360 of the Companies Act 2014.
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </TabsContent>




            </Tabs>
          </TabsContent>
        </Tabs>
      </main>

      {/* Export Questionnaire Dialogs */}
      <BusinessBankExportQuestionnaire
        open={showBusinessQuestionnaire}
        onOpenChange={setShowBusinessQuestionnaire}
        onComplete={handleBusinessQuestionnaireComplete}
        accountName={selectedAccount?.name || "All Accounts"}
        periodStart={(() => { const now = new Date(); const ty = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1; return new Date(ty, 0, 1); })()}
        periodEnd={(() => { const now = new Date(); const ty = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1; return new Date(ty, 11, 31); })()}
        detectedIncome={ct1.detectedIncome}
        expenseSummary={ct1.expenseSummary}
        detectedPayments={ct1.detectedPayments}
        closingBalance={ct1.closingBalance}
        vatPosition={ct1.vatPosition}
        flaggedCapitalItems={ct1.flaggedCapitalItems}
        directorsLoanBalance={ct1.netDirectorsLoan}
        isConstructionTrade={ct1.isConstructionTrade}
        isCloseCompany={ct1.isCloseCompany}
        rctDeductions={ct1.rctPrepayment > 0 ? [{ contractor: "Various", amount: ct1.rctPrepayment, rate: "20%" }] : []}
        reEvaluationApplied={ct1.reEvaluationApplied}
        reEvaluationWarnings={ct1.reEvaluationWarnings}
        originalExpenseSummary={ct1.originalExpenseSummary}
        incorporationDate={companyInfo?.incorporationDate}
        initialValues={(() => { const now = new Date(); const ty = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1; const raw = localStorage.getItem(`ct1_questionnaire_${user?.id}_${ty}`); return raw ? JSON.parse(raw) : undefined; })()}
        tripSummary={invoiceTrips.length > 0 ? {
          totalTrips: invoiceTrips.length,
          totalSubsistence: Math.round(invoiceTrips.reduce((s, t) => s + t.suggestedSubsistence.allowance, 0) * 100) / 100,
          totalMileage: Math.round(invoiceTrips.reduce((s, t) => s + t.suggestedMileage.allowance, 0) * 100) / 100,
          trips: invoiceTrips.map(t => ({
            location: t.jobLocation,
            dates: t.invoiceDate,
            invoiceRef: t.invoiceNumber,
            subsistence: t.suggestedSubsistence.allowance,
            mileage: t.suggestedMileage.allowance,
          })),
        } : undefined}
      />

      <DirectorExportQuestionnaire
        open={showDirectorQuestionnaire}
        onOpenChange={setShowDirectorQuestionnaire}
        onComplete={handleDirectorQuestionnaireComplete}
        accountName={selectedAccount?.name || "Director Account"}
      />

      <VATExportQuestionnaire
        open={showVATQuestionnaire}
        onOpenChange={setShowVATQuestionnaire}
        onComplete={handleVATQuestionnaireComplete}
        vatNumber={onboarding?.vat_number || ""}
        vatBasis={onboarding?.vat_basis || "cash_basis"}
        outputVat={vatSummary?.vatOnSales ?? 0}
        inputVat={vatSummary?.vatOnPurchases ?? 0}
        netVat={vatSummary?.netVat ?? 0}
        periodStart={`1 Jan ${vatTaxYear}`}
        periodEnd={`31 Dec ${vatTaxYear}`}
      />

      <FloatingActionBar
        selectedIds={selectedIds}
        onClearSelection={clearSelection}
      />
    </AppLayout>
  );
};

export default BankFeed;
