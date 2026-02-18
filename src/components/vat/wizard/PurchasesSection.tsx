import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { VATWizardData } from "@/hooks/useVATWizard";

interface PurchasesSectionProps {
  data: VATWizardData;
  onUpdate: (updates: Partial<VATWizardData>) => void;
}

export function PurchasesSection({ data, onUpdate }: PurchasesSectionProps) {
  const addMissingReceipt = () => {
    onUpdate({
      missing_receipts_list: [...data.missing_receipts_list, { description: "", amount: 0 }],
    });
  };

  const removeMissingReceipt = (index: number) => {
    onUpdate({
      missing_receipts_list: data.missing_receipts_list.filter((_, i) => i !== index),
    });
  };

  const updateMissingReceipt = (index: number, field: string, value: string | number) => {
    const updated = [...data.missing_receipts_list];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate({ missing_receipts_list: updated });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Purchases (Input VAT)</h3>
        <p className="text-sm text-muted-foreground">
          Verify all expenses and purchases for this VAT period are complete
        </p>
      </div>

      {/* Question 1: All expenses added */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Have all expenses for this period been entered?</Label>
        <RadioGroup
          value={data.all_expenses_added || ""}
          onValueChange={(v) => onUpdate({ all_expenses_added: v as "yes" | "no" | "not_sure" })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="yes" id="expenses-yes" />
            <Label htmlFor="expenses-yes" className="cursor-pointer flex-1">
              Yes, all expenses are recorded
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="no" id="expenses-no" />
            <Label htmlFor="expenses-no" className="cursor-pointer flex-1">
              No, some expenses are missing
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="not_sure" id="expenses-not-sure" />
            <Label htmlFor="expenses-not-sure" className="cursor-pointer flex-1">
              I'm not sure
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Question 2: Missing receipts */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="missing-receipts"
            checked={data.missing_receipts}
            onCheckedChange={(checked) => onUpdate({ missing_receipts: !!checked })}
          />
          <Label htmlFor="missing-receipts" className="text-base font-medium cursor-pointer">
            Are there any VAT-claimable expenses without receipts?
          </Label>
        </div>

        {data.missing_receipts && (
          <div className="ml-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              List the expenses with missing receipts. VAT cannot be reclaimed without valid receipts.
            </p>
            {data.missing_receipts_list.map((receipt, index) => (
              <div key={index} className="flex gap-3">
                <Input
                  placeholder="Expense description"
                  value={receipt.description}
                  onChange={(e) => updateMissingReceipt(index, "description", e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={receipt.amount || ""}
                  onChange={(e) => updateMissingReceipt(index, "amount", parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
                <Button variant="ghost" size="icon" onClick={() => removeMissingReceipt(index)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addMissingReceipt}>
              <Plus className="w-4 h-4 mr-2" />
              Add Missing Receipt
            </Button>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>Note:</strong> VAT on expenses without valid receipts cannot be reclaimed. These amounts will be
              excluded from your input VAT claim.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
