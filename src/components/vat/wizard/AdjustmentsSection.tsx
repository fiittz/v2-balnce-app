import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { VATWizardData } from "@/hooks/useVATWizard";

interface AdjustmentsSectionProps {
  data: VATWizardData;
  onUpdate: (updates: Partial<VATWizardData>) => void;
}

export function AdjustmentsSection({ data, onUpdate }: AdjustmentsSectionProps) {
  // Credit notes handlers
  const addCreditNote = () => {
    onUpdate({
      credit_notes_details: [...data.credit_notes_details, { description: "", amount: 0 }],
    });
  };

  const removeCreditNote = (index: number) => {
    onUpdate({
      credit_notes_details: data.credit_notes_details.filter((_, i) => i !== index),
    });
  };

  const updateCreditNote = (index: number, field: string, value: string | number) => {
    const updated = [...data.credit_notes_details];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate({ credit_notes_details: updated });
  };

  // Late transactions handlers
  const addLateTransaction = () => {
    onUpdate({
      late_transactions_list: [...data.late_transactions_list, { description: "", date: "", amount: 0 }],
    });
  };

  const removeLateTransaction = (index: number) => {
    onUpdate({
      late_transactions_list: data.late_transactions_list.filter((_, i) => i !== index),
    });
  };

  const updateLateTransaction = (index: number, field: string, value: string | number) => {
    const updated = [...data.late_transactions_list];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate({ late_transactions_list: updated });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Adjustments & Corrections</h3>
        <p className="text-sm text-muted-foreground">
          Record any credit notes, manual adjustments, or late transactions
        </p>
      </div>

      {/* Credit Notes */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="credit-notes"
            checked={data.credit_notes}
            onCheckedChange={(checked) => onUpdate({ credit_notes: !!checked })}
          />
          <Label htmlFor="credit-notes" className="text-base font-medium cursor-pointer">
            Were any credit notes issued or received this period?
          </Label>
        </div>

        {data.credit_notes && (
          <div className="ml-6 space-y-3">
            <p className="text-sm text-muted-foreground">List the credit notes below:</p>
            {data.credit_notes_details.map((note, index) => (
              <div key={index} className="flex gap-3">
                <Input
                  placeholder="Credit note description"
                  value={note.description}
                  onChange={(e) => updateCreditNote(index, "description", e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={note.amount || ""}
                  onChange={(e) => updateCreditNote(index, "amount", parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
                <Button variant="ghost" size="icon" onClick={() => removeCreditNote(index)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addCreditNote}>
              <Plus className="w-4 h-4 mr-2" />
              Add Credit Note
            </Button>
          </div>
        )}
      </div>

      {/* Manual Adjustments */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="manual-adjustments"
            checked={data.manual_adjustments}
            onCheckedChange={(checked) => onUpdate({ manual_adjustments: !!checked })}
          />
          <Label htmlFor="manual-adjustments" className="text-base font-medium cursor-pointer">
            Are there any manual VAT adjustments to make?
          </Label>
        </div>

        {data.manual_adjustments && (
          <div className="ml-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adj-amount">Adjustment amount (€)</Label>
              <Input
                id="adj-amount"
                type="number"
                placeholder="0.00"
                value={data.manual_adjustment_amount || ""}
                onChange={(e) => onUpdate({ manual_adjustment_amount: parseFloat(e.target.value) || 0 })}
                className="w-40"
              />
              <p className="text-xs text-muted-foreground">
                Enter a positive number to increase VAT liability, negative to decrease
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adj-reason">Reason for adjustment</Label>
              <Textarea
                id="adj-reason"
                placeholder="Explain the reason for this adjustment..."
                value={data.manual_adjustment_reason}
                onChange={(e) => onUpdate({ manual_adjustment_reason: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adj-attachment">Supporting document (optional)</Label>
              <Input
                id="adj-attachment"
                type="text"
                placeholder="Document reference or link"
                value={data.manual_adjustment_attachment}
                onChange={(e) => onUpdate({ manual_adjustment_attachment: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Late Transactions */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="late-transactions"
            checked={data.late_transactions}
            onCheckedChange={(checked) => onUpdate({ late_transactions: !!checked })}
          />
          <Label htmlFor="late-transactions" className="text-base font-medium cursor-pointer">
            Are there any late transactions to include from previous periods?
          </Label>
        </div>

        {data.late_transactions && (
          <div className="ml-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              List any transactions that should have been included in a previous VAT period:
            </p>
            {data.late_transactions_list.map((tx, index) => (
              <div key={index} className="flex gap-3">
                <Input
                  placeholder="Description"
                  value={tx.description}
                  onChange={(e) => updateLateTransaction(index, "description", e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={tx.date}
                  onChange={(e) => updateLateTransaction(index, "date", e.target.value)}
                  className="w-40"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={tx.amount || ""}
                  onChange={(e) => updateLateTransaction(index, "amount", parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
                <Button variant="ghost" size="icon" onClick={() => removeLateTransaction(index)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addLateTransaction}>
              <Plus className="w-4 h-4 mr-2" />
              Add Late Transaction
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
