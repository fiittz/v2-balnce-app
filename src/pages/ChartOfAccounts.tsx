import { useState, useMemo } from "react";
import { Search, Plus, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAccounts, useCreateAccount, useUpdateAccount } from "@/hooks/useAccounts";
import type { Account } from "@/hooks/useAccounts";
import { toast } from "sonner";

const ACCOUNT_TYPES = [
  "bank",
  "expense",
  "income",
  "asset",
  "liability",
  "equity",
];

const TYPE_COLORS: Record<string, string> = {
  "bank": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "income": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "expense": "bg-red-500/10 text-red-600 border-red-500/20",
  "asset": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "liability": "bg-pink-500/10 text-pink-600 border-pink-500/20",
  "equity": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
};

interface AccountFormData {
  name: string;
  account_number: string;
  account_type: string;
  is_default: boolean;
}

const ChartOfAccounts = () => {
  const { data: accounts, isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(ACCOUNT_TYPES));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState<AccountFormData>({
    name: "",
    account_number: "",
    account_type: "expense",
    is_default: false,
  });

  // Filter and group accounts
  const filteredAndGrouped = useMemo(() => {
    if (!accounts) return {};

    const filtered = accounts.filter((account) => {
      const matchesSearch =
        account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (account.account_number?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesType = typeFilter === "all" || account.account_type === typeFilter;
      return matchesSearch && matchesType;
    });

    return filtered.reduce((groups, account) => {
      const type = account.account_type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(account);
      return groups;
    }, {} as Record<string, Account[]>);
  }, [accounts, searchQuery, typeFilter]);

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const openAddModal = () => {
    setEditingAccount(null);
    setFormData({ name: "", account_number: "", account_type: "expense", is_default: false });
    setIsModalOpen(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      account_number: account.account_number || "",
      account_type: account.account_type,
      is_default: account.is_default ?? false,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await updateAccount.mutateAsync({
          id: editingAccount.id,
          name: formData.name,
          account_number: formData.account_number || null,
          account_type: formData.account_type,
          is_default: formData.is_default,
        });
        toast.success("Account updated");
      } else {
        await createAccount.mutateAsync({
          name: formData.name,
          account_number: formData.account_number || null,
          account_type: formData.account_type,
          is_default: formData.is_default,
          balance: 0,
          bic: null,
          currency: "EUR",
          iban: null,
          sort_code: null,
        });
        toast.success("Account created");
      }
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Failed to save account");
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1>
            <p className="text-muted-foreground">
              Manage your income, expense, and balance sheet accounts
            </p>
          </div>
          <Button onClick={openAddModal} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {ACCOUNT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Accounts Table */}
        <div className="rounded-lg border bg-card">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading accounts...</div>
          ) : Object.keys(filteredAndGrouped).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No accounts found. Click "Add Account" to create one.
            </div>
          ) : (
            <div className="divide-y">
              {ACCOUNT_TYPES.filter((type) => filteredAndGrouped[type]?.length > 0).map((type) => (
                <div key={type}>
                  {/* Group Header */}
                  <button
                    onClick={() => toggleType(type)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    {expandedTypes.has(type) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Badge variant="outline" className={TYPE_COLORS[type] || "bg-muted"}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      ({filteredAndGrouped[type].length} accounts)
                    </span>
                  </button>

                  {/* Group Content */}
                  {expandedTypes.has(type) && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="w-24">Status</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndGrouped[type].map((account) => (
                          <TableRow
                            key={account.id}
                            className="cursor-pointer hover:bg-muted/30"
                            onClick={() => openEditModal(account)}
                          >
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {account.account_number || "—"}
                            </TableCell>
                            <TableCell className="font-medium">{account.name}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  account.is_default
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : "bg-muted text-muted-foreground"
                                }
                              >
                                {account.is_default ? "Default" : "Active"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit Account" : "Add Account"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Office Supplies"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_number">Account Number (Optional)</Label>
              <Input
                id="account_number"
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                placeholder="e.g., EXP018"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_type">Account Type</Label>
              <Select
                value={formData.account_type}
                onValueChange={(value) => setFormData({ ...formData, account_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_default">Set as Default</Label>
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAccount.isPending || updateAccount.isPending}>
                {editingAccount ? "Save Changes" : "Create Account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ChartOfAccounts;
