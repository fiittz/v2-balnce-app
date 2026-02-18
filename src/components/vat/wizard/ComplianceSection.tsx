import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ShieldCheck, Lock } from "lucide-react";
import { VATWizardData } from "@/hooks/useVATWizard";

interface ComplianceSectionProps {
  data: VATWizardData;
  onUpdate: (updates: Partial<VATWizardData>) => void;
}

export function ComplianceSection({ data, onUpdate }: ComplianceSectionProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Compliance Checks & Declarations</h3>
        <p className="text-sm text-muted-foreground">
          Complete the final checks and declarations to finalise your VAT return
        </p>
      </div>

      {/* Flagged Transactions Review */}
      <div className="p-4 border rounded-lg space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div className="flex-1">
            <Label className="text-base font-medium">Flagged Transactions Review</Label>
            <p className="text-sm text-muted-foreground mt-1">
              You must confirm that you have reviewed all transactions that were flagged for attention during this VAT
              period.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-8">
          <Checkbox
            id="reviewed-flagged"
            checked={data.reviewed_flagged_transactions}
            onCheckedChange={(checked) => onUpdate({ reviewed_flagged_transactions: !!checked })}
          />
          <Label htmlFor="reviewed-flagged" className="cursor-pointer">
            I have reviewed all flagged transactions
          </Label>
        </div>
      </div>

      {/* Accuracy Confirmation */}
      <div className="p-4 border rounded-lg space-y-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <Label className="text-base font-medium">Accuracy Confirmation</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Confirm that the VAT calculations are accurate to the best of your knowledge.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-8">
          <Checkbox
            id="confirm-accuracy"
            checked={data.confirm_accuracy}
            onCheckedChange={(checked) => onUpdate({ confirm_accuracy: !!checked })}
          />
          <Label htmlFor="confirm-accuracy" className="cursor-pointer">
            I confirm the VAT figures are accurate
          </Label>
        </div>
      </div>

      {/* Period Lock */}
      <div className="p-4 border rounded-lg space-y-3">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <Label className="text-base font-medium">Lock VAT Period</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Locking the period will prevent any further edits to transactions within this VAT period. This is
              recommended once you've filed your return.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-8">
          <Checkbox
            id="lock-period"
            checked={data.lock_period}
            onCheckedChange={(checked) => onUpdate({ lock_period: !!checked })}
          />
          <Label htmlFor="lock-period" className="cursor-pointer">
            Lock this VAT period after finalisation
          </Label>
        </div>
      </div>

      {/* VAT Notes */}
      <div className="space-y-2">
        <Label htmlFor="vat-notes">Additional Notes (optional)</Label>
        <Textarea
          id="vat-notes"
          placeholder="Any additional notes for this VAT return..."
          value={data.vat_notes}
          onChange={(e) => onUpdate({ vat_notes: e.target.value })}
          rows={3}
        />
      </div>

      {/* Final Declarations */}
      <div className="p-4 bg-muted rounded-lg space-y-4">
        <h4 className="font-semibold">Required Declarations</h4>
        <p className="text-sm text-muted-foreground">By finalising this VAT return, you confirm:</p>

        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="declaration-true"
              checked={data.declaration_true_and_complete}
              onCheckedChange={(checked) => onUpdate({ declaration_true_and_complete: !!checked })}
              className="mt-0.5"
            />
            <Label htmlFor="declaration-true" className="cursor-pointer text-sm">
              I declare that the information provided in this VAT return is true and complete to the best of my
              knowledge and belief.
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="declaration-penalties"
              checked={data.declaration_penalties_understood}
              onCheckedChange={(checked) => onUpdate({ declaration_penalties_understood: !!checked })}
              className="mt-0.5"
            />
            <Label htmlFor="declaration-penalties" className="cursor-pointer text-sm">
              I understand that submitting false or misleading information may result in penalties, interest charges,
              and prosecution by Revenue.
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="declaration-lock"
              checked={data.declaration_period_lock_understood}
              onCheckedChange={(checked) => onUpdate({ declaration_period_lock_understood: !!checked })}
              className="mt-0.5"
            />
            <Label htmlFor="declaration-lock" className="cursor-pointer text-sm">
              I understand that once finalised, transactions in this period may be locked from editing and any
              corrections will require a manual adjustment.
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
