import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCategory, useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";

interface AddCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountType?: string;
}

const VAT_RATES = [
  { label: "0%", value: "0" },
  { label: "9%", value: "9" },
  { label: "13.5%", value: "13.5" },
  { label: "23%", value: "23" },
];

export function AddCategoryDialog({ open, onOpenChange, defaultAccountType }: AddCategoryDialogProps) {
  const defaultAccType = defaultAccountType === "directors_personal_tax" ? "personal" : "business";
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [accountType, setAccountType] = useState(defaultAccType);
  const [vatRate, setVatRate] = useState("23");
  const [accountCode, setAccountCode] = useState("");

  const createCategory = useCreateCategory();
  const { data: existingCategories = [] } = useCategories();

  const resetForm = () => {
    setName("");
    setType("expense");
    setAccountType(defaultAccType);
    setVatRate("23");
    setAccountCode("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Category name is required");
      return;
    }

    // Duplicate check: case-insensitive name + type
    const duplicate = existingCategories.some(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase() && c.type === type,
    );
    if (duplicate) {
      toast.error(`A ${type} category named "${trimmedName}" already exists`);
      return;
    }

    try {
      await createCategory.mutateAsync({
        name: trimmedName,
        type,
        account_type: accountType,
        vat_rate: parseFloat(vatRate),
        account_code: accountCode.trim() || null,
      });
      toast.success(`Category "${trimmedName}" created`);
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Failed to create category");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              placeholder="e.g. Office Supplies"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "income" | "expense")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Account Type</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>VAT Rate</Label>
            <Select value={vatRate} onValueChange={setVatRate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAT_RATES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-code">Account Code (optional)</Label>
            <Input
              id="cat-code"
              placeholder="e.g. 5010"
              value={accountCode}
              onChange={(e) => setAccountCode(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createCategory.isPending}>
              {createCategory.isPending ? "Creating..." : "Create Category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
