import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Wallet, Trash2, Edit2, Check, X, BarChart3, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from "@/hooks/useAccounts";

type AccountType = "limited_company" | "sole_trader" | "directors_personal_tax";

const Accounts = () => {
  const navigate = useNavigate();
  const { data: accounts = [], isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("limited_company");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === accounts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(accounts.map((a) => a.id)));
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error("Please enter an account name");
      return;
    }

    try {
      await createAccount.mutateAsync({
        name: name.trim(),
        account_type: accountType,
        currency: "EUR",
        balance: 0,
        is_default: false,
        account_number: null,
        iban: null,
        bic: null,
        sort_code: null,
      });
      setName("");
      setDescription("");
      setAccountType("limited_company");
      setIsAddDialogOpen(false);
    } catch {
      toast.error("Failed to add account");
    }
  };

  const startEdit = (account: (typeof accounts)[number]) => {
    setEditingId(account.id);
    setEditName(account.name);
    setEditDescription("");
  };

  const saveEdit = async () => {
    if (!editName.trim() || !editingId) {
      toast.error("Please enter an account name");
      return;
    }

    try {
      await updateAccount.mutateAsync({ id: editingId, name: editName.trim() });
      setEditingId(null);
    } catch {
      toast.error("Failed to update account");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAccount.mutateAsync(deleteId);
      setDeleteId(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteId);
        return next;
      });
    } catch {
      toast.error("Failed to delete account");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    let failed = 0;
    for (const id of selectedIds) {
      try {
        await deleteAccount.mutateAsync(id);
      } catch {
        failed++;
      }
    }
    setIsBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    const deleted = selectedIds.size - failed;
    setSelectedIds(new Set());
    if (failed > 0) {
      toast.error(`Deleted ${deleted} accounts, ${failed} failed`);
    } else {
      toast.success(`Deleted ${deleted} account${deleted !== 1 ? "s" : ""}`);
    }
  };

  const handleViewReports = (accountId: string) => {
    navigate(`/accounts/${accountId}`);
  };

  const handleAnalyze = (accountId: string) => {
    navigate(`/bank?account=${accountId}`);
  };

  const isSelectMode = selectedIds.size > 0;

  return (
    <AppLayout>
      {/* Single Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this account from your list. Any linked transactions will be unlinked but not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} account{selectedIds.size !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected accounts from your list. Any linked transactions will be unlinked but not
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedIds.size}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="w-24">
            {isSelectMode && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Cancel
              </Button>
            )}
          </div>
          <div className="flex-1 text-center">
            <h1 className="font-semibold text-xl">Accounts</h1>
          </div>
          <div className="w-24 flex justify-end">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Account</DialogTitle>
                  <DialogDescription>
                    Add a bank account or financial account to track and analyze separately.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Account Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., AIB Current Account"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Account Type</Label>
                    <Select value={accountType} onValueChange={(value: AccountType) => setAccountType(value)}>
                      <SelectTrigger id="type">
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
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="e.g., Main business current account for day-to-day operations"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAdd} disabled={createAccount.isPending}>
                      {createAccount.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Add Account
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 max-w-2xl mx-auto space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">No accounts yet</CardTitle>
              <CardDescription className="mb-4">
                Add your first bank account to start tracking and analyzing your finances.
              </CardDescription>
              <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Your First Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Select All */}
            {accounts.length > 1 && (
              <div className="flex items-center gap-3 px-1">
                <Checkbox checked={selectedIds.size === accounts.length} onCheckedChange={toggleSelectAll} />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size === accounts.length ? "Deselect all" : "Select all"}
                </span>
              </div>
            )}

            {accounts.map((account) => (
              <Card
                key={account.id}
                className={`animate-fade-in transition-all ${selectedIds.has(account.id) ? "ring-2 ring-primary" : ""}`}
              >
                <CardContent className="p-5">
                  {editingId === account.id ? (
                    <div className="space-y-4">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Account name"
                      />
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                        <Button size="sm" onClick={saveEdit}>
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedIds.has(account.id)}
                            onCheckedChange={() => toggleSelect(account.id)}
                          />
                          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                            <Wallet className="w-5 h-5 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg">{account.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {account.account_type === "limited_company"
                              ? "Limited Company"
                              : account.account_type === "sole_trader"
                                ? "Sole Trader"
                                : account.account_type === "directors_personal_tax"
                                  ? "Director's Personal Tax"
                                  : account.account_type}
                          </p>
                        </div>
                      </div>
                      {!isSelectMode && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewReports(account.id)}
                            className="h-9 w-9 text-primary"
                            title="View Reports"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAnalyze(account.id)}
                            className="h-9 w-9"
                            title="View Transactions"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => startEdit(account)} className="h-9 w-9">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(account.id)}
                            className="h-9 w-9 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Bottom spacer when action bar visible */}
        {isSelectMode && <div className="h-20" />}
      </main>

      {/* Floating Bulk Action Bar */}
      {isSelectMode && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-foreground text-background p-4 z-40 animate-fade-in">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="font-medium">{selectedIds.size} selected</span>
            <Button
              variant="secondary"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Accounts;
