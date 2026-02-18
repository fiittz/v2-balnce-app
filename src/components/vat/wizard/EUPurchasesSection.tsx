import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { VATWizardData } from "@/hooks/useVATWizard";
import { format, parseISO } from "date-fns";
import { EU_COUNTRIES } from "@/lib/euVatRules";

interface Expense {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  vat_amount: number | null;
  supplier?: { name: string } | null;
  category?: { name: string } | null;
}

interface EUPurchasesSectionProps {
  data: VATWizardData;
  onUpdate: (updates: Partial<VATWizardData>) => void;
  expenses: Expense[];
  isLoading: boolean;
}

export function EUPurchasesSection({ data, onUpdate, expenses, isLoading }: EUPurchasesSectionProps) {
  const toggleExpense = (expenseId: string) => {
    const currentIds = data.eu_purchase_ids || [];
    if (currentIds.includes(expenseId)) {
      onUpdate({
        eu_purchase_ids: currentIds.filter((id) => id !== expenseId),
        eu_reverse_charge_flags: Object.fromEntries(
          Object.entries(data.eu_reverse_charge_flags || {}).filter(([id]) => id !== expenseId),
        ),
      });
    } else {
      onUpdate({
        eu_purchase_ids: [...currentIds, expenseId],
        eu_reverse_charge_flags: {
          ...data.eu_reverse_charge_flags,
          [expenseId]: { applies: true },
        },
      });
    }
  };

  const updateReverseChargeFlag = (expenseId: string, applies: boolean) => {
    onUpdate({
      eu_reverse_charge_flags: {
        ...data.eu_reverse_charge_flags,
        [expenseId]: { ...data.eu_reverse_charge_flags[expenseId], applies },
      },
    });
  };

  const updateCountry = (expenseId: string, country: string) => {
    onUpdate({
      eu_reverse_charge_flags: {
        ...data.eu_reverse_charge_flags,
        [expenseId]: { ...data.eu_reverse_charge_flags[expenseId], country },
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">EU Purchases (Reverse Charge)</h3>
        <p className="text-sm text-muted-foreground">
          Identify purchases from EU suppliers that require reverse charge VAT treatment
        </p>
      </div>

      {/* Question: Any EU purchases */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Did you make any purchases from EU suppliers this period?</Label>
        <RadioGroup
          value={data.eu_purchases ? "yes" : "no"}
          onValueChange={(v) => onUpdate({ eu_purchases: v === "yes" })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="yes" id="eu-yes" />
            <Label htmlFor="eu-yes" className="cursor-pointer flex-1">
              Yes
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="no" id="eu-no" />
            <Label htmlFor="eu-no" className="cursor-pointer flex-1">
              No
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Transaction Selection */}
      {data.eu_purchases && (
        <div className="space-y-3">
          <Label className="text-base font-medium">Select the transactions that are EU purchases:</Label>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
              No expenses found for this period
            </div>
          ) : (
            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-3 text-left w-12"></th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Supplier</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-right">Net</th>
                    <th className="p-3 text-right">VAT</th>
                    <th className="p-3 text-left">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => {
                    const isSelected = data.eu_purchase_ids?.includes(expense.id);
                    return (
                      <tr
                        key={expense.id}
                        className={`border-t hover:bg-muted/50 cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}
                        onClick={() => toggleExpense(expense.id)}
                      >
                        <td className="p-3">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleExpense(expense.id)} />
                        </td>
                        <td className="p-3">{format(parseISO(expense.expense_date), "dd/MM/yy")}</td>
                        <td className="p-3">{expense.supplier?.name || "-"}</td>
                        <td className="p-3 max-w-[200px] truncate">{expense.description || "-"}</td>
                        <td className="p-3 text-right">€{expense.amount.toFixed(2)}</td>
                        <td className="p-3 text-right">€{(expense.vat_amount || 0).toFixed(2)}</td>
                        <td className="p-3">{expense.category?.name || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Selected EU Purchases Details */}
          {data.eu_purchase_ids && data.eu_purchase_ids.length > 0 && (
            <div className="space-y-3 mt-4">
              <Label className="text-base font-medium">Configure reverse charge for selected purchases:</Label>
              {data.eu_purchase_ids.map((id) => {
                const expense = expenses.find((e) => e.id === id);
                if (!expense) return null;
                const flags = data.eu_reverse_charge_flags[id] || { applies: true };

                return (
                  <div key={id} className="p-3 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{expense.supplier?.name || expense.description || "Unknown"}</span>
                      <span className="text-muted-foreground">€{expense.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`rc-${id}`}
                          checked={flags.applies}
                          onCheckedChange={(checked) => updateReverseChargeFlag(id, !!checked)}
                        />
                        <Label htmlFor={`rc-${id}`} className="cursor-pointer">
                          Reverse charge applies
                        </Label>
                      </div>
                      <Select value={flags.country || ""} onValueChange={(v) => updateCountry(id, v)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Supplier country" />
                        </SelectTrigger>
                        <SelectContent>
                          {EU_COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
