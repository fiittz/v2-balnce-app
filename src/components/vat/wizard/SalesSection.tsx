import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { VATWizardData } from "@/hooks/useVATWizard";

interface SalesSectionProps {
  data: VATWizardData;
  onUpdate: (updates: Partial<VATWizardData>) => void;
}

const SPECIAL_SALES_OPTIONS = [
  { id: "zero_rated", label: "Zero-rated sales" },
  { id: "exempt", label: "Exempt sales" },
  { id: "eu_b2b", label: "EU B2B sales" },
  { id: "eu_b2c", label: "EU B2C sales" },
  { id: "exports", label: "Exports (outside EU)" },
  { id: "reverse_charge_supplies", label: "Reverse charge supplies" },
  { id: "none", label: "None of the above" },
];

export function SalesSection({ data, onUpdate }: SalesSectionProps) {
  const addUnpaidInvoice = () => {
    onUpdate({
      unpaid_invoices_list: [...data.unpaid_invoices_list, { description: "", amount: 0 }],
    });
  };

  const removeUnpaidInvoice = (index: number) => {
    onUpdate({
      unpaid_invoices_list: data.unpaid_invoices_list.filter((_, i) => i !== index),
    });
  };

  const updateUnpaidInvoice = (index: number, field: string, value: string | number) => {
    const updated = [...data.unpaid_invoices_list];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate({ unpaid_invoices_list: updated });
  };

  const toggleSpecialSale = (id: string) => {
    const current = data.special_sales || [];
    if (id === "none") {
      onUpdate({ special_sales: current.includes("none") ? [] : ["none"] });
    } else {
      const withoutNone = current.filter((s) => s !== "none");
      if (current.includes(id)) {
        onUpdate({ special_sales: withoutNone.filter((s) => s !== id) });
      } else {
        onUpdate({ special_sales: [...withoutNone, id] });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Sales (Output VAT)</h3>
        <p className="text-sm text-muted-foreground">Confirm all sales for this VAT period have been recorded</p>
      </div>

      {/* Question 1: All sales added */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Have all sales for this period been entered?</Label>
        <RadioGroup
          value={data.all_sales_added || ""}
          onValueChange={(v) => onUpdate({ all_sales_added: v as "yes" | "no" | "not_sure" })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="yes" id="sales-yes" />
            <Label htmlFor="sales-yes" className="cursor-pointer flex-1">
              Yes, all sales are recorded
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="no" id="sales-no" />
            <Label htmlFor="sales-no" className="cursor-pointer flex-1">
              No, some sales are missing
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="not_sure" id="sales-not-sure" />
            <Label htmlFor="sales-not-sure" className="cursor-pointer flex-1">
              I'm not sure
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Question 2: Unpaid invoices */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="unpaid-invoices"
            checked={data.unpaid_invoices}
            onCheckedChange={(checked) => onUpdate({ unpaid_invoices: !!checked })}
          />
          <Label htmlFor="unpaid-invoices" className="text-base font-medium cursor-pointer">
            Were any invoices issued this period that remain unpaid?
          </Label>
        </div>

        {data.unpaid_invoices && (
          <div className="ml-6 space-y-3">
            <p className="text-sm text-muted-foreground">List the unpaid invoices below:</p>
            {data.unpaid_invoices_list.map((invoice, index) => (
              <div key={index} className="flex gap-3">
                <Input
                  placeholder="Invoice description"
                  value={invoice.description}
                  onChange={(e) => updateUnpaidInvoice(index, "description", e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={invoice.amount || ""}
                  onChange={(e) => updateUnpaidInvoice(index, "amount", parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
                <Button variant="ghost" size="icon" onClick={() => removeUnpaidInvoice(index)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addUnpaidInvoice}>
              <Plus className="w-4 h-4 mr-2" />
              Add Invoice
            </Button>
          </div>
        )}
      </div>

      {/* Question 3: Special sales */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Did you make any of the following types of sales?</Label>
        <div className="grid gap-2">
          {SPECIAL_SALES_OPTIONS.map((option) => (
            <div
              key={option.id}
              className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
              onClick={() => toggleSpecialSale(option.id)}
            >
              <Checkbox
                checked={data.special_sales?.includes(option.id) || false}
                onCheckedChange={() => toggleSpecialSale(option.id)}
              />
              <Label className="cursor-pointer flex-1">{option.label}</Label>
            </div>
          ))}
        </div>

        {data.special_sales?.length > 0 && !data.special_sales.includes("none") && (
          <div className="space-y-2">
            <Label htmlFor="special-notes">Additional notes for special sales</Label>
            <Textarea
              id="special-notes"
              placeholder="Provide any relevant details about the special sales..."
              value={data.special_sales_notes}
              onChange={(e) => onUpdate({ special_sales_notes: e.target.value })}
              rows={3}
            />
          </div>
        )}
      </div>
    </div>
  );
}
