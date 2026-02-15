import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { VATWizardData } from "@/hooks/useVATWizard";
import { format, parseISO } from "date-fns";

interface Expense {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  vat_amount: number | null;
  supplier?: { name: string } | null;
  category?: { name: string } | null;
}

interface NonEUPurchasesSectionProps {
  data: VATWizardData;
  onUpdate: (updates: Partial<VATWizardData>) => void;
  expenses: Expense[];
  isLoading: boolean;
}

export function NonEUPurchasesSection({ data, onUpdate, expenses, isLoading }: NonEUPurchasesSectionProps) {
  const getDetail = (transactionId: string) => {
    return data.non_eu_purchase_details.find(d => d.transaction_id === transactionId);
  };

  const toggleExpense = (expenseId: string) => {
    const existing = data.non_eu_purchase_details.find(d => d.transaction_id === expenseId);
    if (existing) {
      onUpdate({
        non_eu_purchase_details: data.non_eu_purchase_details.filter(d => d.transaction_id !== expenseId),
      });
    } else {
      onUpdate({
        non_eu_purchase_details: [
          ...data.non_eu_purchase_details,
          {
            transaction_id: expenseId,
            import_vat_paid: false,
            import_vat_amount: 0,
            import_type: "goods" as const,
            deferred_vat: false,
            reverse_charge_applies: false,
          },
        ],
      });
    }
  };

  const updateDetail = (transactionId: string, updates: Partial<VATWizardData["non_eu_purchase_details"][0]>) => {
    onUpdate({
      non_eu_purchase_details: data.non_eu_purchase_details.map(d =>
        d.transaction_id === transactionId ? { ...d, ...updates } : d
      ),
    });
  };

  const selectedIds = data.non_eu_purchase_details.map(d => d.transaction_id);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Non-EU Purchases</h3>
        <p className="text-sm text-muted-foreground">
          Identify purchases from non-EU suppliers — goods imports (postponed accounting) and services (reverse charge)
        </p>
      </div>

      {/* Question: Any non-EU purchases */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          Did you make any purchases from non-EU suppliers this period?
        </Label>
        <RadioGroup
          value={data.non_eu_purchases ? "yes" : "no"}
          onValueChange={(v) => onUpdate({ non_eu_purchases: v === "yes" })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="yes" id="noneu-yes" />
            <Label htmlFor="noneu-yes" className="cursor-pointer flex-1">
              Yes
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="no" id="noneu-no" />
            <Label htmlFor="noneu-no" className="cursor-pointer flex-1">
              No
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Transaction Selection */}
      {data.non_eu_purchases && (
        <div className="space-y-3">
          <Label className="text-base font-medium">
            Select the transactions that are non-EU imports:
          </Label>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
              No expenses found for this period
            </div>
          ) : (
            <div className="border rounded-lg max-h-[300px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-3 text-left w-12"></th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Supplier</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-right">Net</th>
                    <th className="p-3 text-left">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => {
                    const isSelected = selectedIds.includes(expense.id);
                    return (
                      <tr 
                        key={expense.id} 
                        className={`border-t hover:bg-muted/50 cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}
                        onClick={() => toggleExpense(expense.id)}
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleExpense(expense.id)}
                          />
                        </td>
                        <td className="p-3">
                          {format(parseISO(expense.expense_date), "dd/MM/yy")}
                        </td>
                        <td className="p-3">{expense.supplier?.name || "-"}</td>
                        <td className="p-3 max-w-[200px] truncate">
                          {expense.description || "-"}
                        </td>
                        <td className="p-3 text-right">€{expense.amount.toFixed(2)}</td>
                        <td className="p-3">{expense.category?.name || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Selected Purchase Details */}
          {data.non_eu_purchase_details.length > 0 && (
            <div className="space-y-3 mt-4">
              <Label className="text-base font-medium">
                Provide details for selected purchases:
              </Label>
              {data.non_eu_purchase_details.map((detail) => {
                const expense = expenses.find(e => e.id === detail.transaction_id);
                if (!expense) return null;

                return (
                  <div key={detail.transaction_id} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {expense.supplier?.name || expense.description || "Unknown"}
                      </span>
                      <span className="text-muted-foreground">
                        €{expense.amount.toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={detail.import_type}
                        onValueChange={(v) => updateDetail(detail.transaction_id, {
                          import_type: v as "goods" | "services",
                          ...(v === "services" ? { reverse_charge_applies: true, import_vat_paid: false, import_vat_amount: 0, deferred_vat: false } : { reverse_charge_applies: false }),
                        })}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="goods">Goods (import)</SelectItem>
                          <SelectItem value="services">Services (reverse charge)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Services: reverse charge fields */}
                    {detail.import_type === "services" && (
                      <>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`rc-${detail.transaction_id}`}
                            checked={detail.reverse_charge_applies}
                            onCheckedChange={(checked) => updateDetail(detail.transaction_id, { reverse_charge_applies: !!checked })}
                          />
                          <Label htmlFor={`rc-${detail.transaction_id}`} className="cursor-pointer">
                            Reverse charge applies
                          </Label>
                        </div>
                        <div className="space-y-2">
                          <Label>Supplier tax ID (optional)</Label>
                          <Input
                            type="text"
                            placeholder="e.g. US EIN, UK UTR"
                            value={detail.supplier_tax_id || ""}
                            onChange={(e) => updateDetail(detail.transaction_id, { supplier_tax_id: e.target.value })}
                            className="w-64"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
                          Self-account for Irish VAT at the applicable rate. Report on VAT3 boxes T1/T2.
                        </p>
                      </>
                    )}

                    {/* Goods: import VAT fields */}
                    {detail.import_type === "goods" && (
                      <>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`vat-paid-${detail.transaction_id}`}
                            checked={detail.import_vat_paid}
                            onCheckedChange={(checked) => updateDetail(detail.transaction_id, { import_vat_paid: !!checked })}
                          />
                          <Label htmlFor={`vat-paid-${detail.transaction_id}`} className="cursor-pointer">
                            Import VAT paid
                          </Label>
                        </div>

                        {detail.import_vat_paid && (
                          <div className="space-y-2">
                            <Label>Import VAT amount</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={detail.import_vat_amount || ""}
                              onChange={(e) => updateDetail(detail.transaction_id, { import_vat_amount: parseFloat(e.target.value) || 0 })}
                              className="w-32"
                            />
                          </div>
                        )}

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`deferred-${detail.transaction_id}`}
                            checked={detail.deferred_vat}
                            onCheckedChange={(checked) => updateDetail(detail.transaction_id, { deferred_vat: !!checked })}
                          />
                          <Label htmlFor={`deferred-${detail.transaction_id}`} className="cursor-pointer">
                            Deferred VAT scheme applies
                          </Label>
                        </div>
                      </>
                    )}
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
