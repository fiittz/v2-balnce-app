import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { VATWizardData } from "@/hooks/useVATWizard";

interface HighRiskVATSectionProps {
  data: VATWizardData;
  onUpdate: (updates: Partial<VATWizardData>) => void;
}

export function HighRiskVATSection({ data, onUpdate }: HighRiskVATSectionProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">High-Risk VAT Categories</h3>
        <p className="text-sm text-muted-foreground">Review expenses in categories with special VAT rules</p>
      </div>

      {/* Food VAT Claim */}
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <Label className="text-base font-medium">Food & Entertainment VAT</Label>
            <p className="text-sm text-muted-foreground mt-1">
              VAT on food is only reclaimable when food is supplied to employees in a staff canteen (free or
              subsidised). Entertainment expenses are never reclaimable.
            </p>
          </div>
        </div>

        <RadioGroup
          value={data.food_vat_claim || ""}
          onValueChange={(v) =>
            onUpdate({ food_vat_claim: v as "no" | "allowed_staff_canteen" | "not_allowed_exclude" })
          }
          className="space-y-2 ml-7"
        >
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="no" id="food-no" />
            <Label htmlFor="food-no" className="cursor-pointer flex-1">
              No food VAT to claim
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="allowed_staff_canteen" id="food-canteen" />
            <Label htmlFor="food-canteen" className="cursor-pointer flex-1">
              Staff canteen food (VAT reclaimable)
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="not_allowed_exclude" id="food-exclude" />
            <Label htmlFor="food-exclude" className="cursor-pointer flex-1">
              Exclude non-allowed food/entertainment VAT from claim
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Motor VAT Claim */}
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <Label className="text-base font-medium">Motor Vehicle VAT</Label>
            <p className="text-sm text-muted-foreground mt-1">
              VAT on repairs, insurance, motor tax, tolls, and most motor costs is <strong>not reclaimable</strong> on
              passenger vehicles. Only fuel VAT may be partially reclaimable based on business use.
            </p>
          </div>
        </div>

        <RadioGroup
          value={data.motor_vat_claim || ""}
          onValueChange={(v) => onUpdate({ motor_vat_claim: v as "fuel_only" | "fuel_and_other" | "none" })}
          className="space-y-2 ml-7"
        >
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="none" id="motor-none" />
            <Label htmlFor="motor-none" className="cursor-pointer flex-1">
              No motor VAT to claim
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="fuel_only" id="motor-fuel" />
            <Label htmlFor="motor-fuel" className="cursor-pointer flex-1">
              Fuel VAT only (correctly calculated)
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="fuel_and_other" id="motor-other" />
            <Label htmlFor="motor-other" className="cursor-pointer flex-1">
              Fuel and other motor costs claimed
            </Label>
          </div>
        </RadioGroup>

        {data.motor_vat_claim === "fuel_and_other" && (
          <div className="ml-7 space-y-3">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
              <strong>Warning:</strong> VAT on repairs, insurance, motor tax, tolls, and most motor costs is not
              reclaimable on passenger vehicles. Would you like to remove non-allowed VAT from your claim?
            </div>

            <RadioGroup
              value={data.remove_non_allowed_vat === true ? "yes" : data.remove_non_allowed_vat === false ? "no" : ""}
              onValueChange={(v) => onUpdate({ remove_non_allowed_vat: v === "yes" })}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="yes" id="remove-yes" />
                <Label htmlFor="remove-yes" className="cursor-pointer flex-1">
                  Yes, remove non-allowed VAT
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="no" id="remove-no" />
                <Label htmlFor="remove-no" className="cursor-pointer flex-1">
                  No, I have valid business reasons
                </Label>
              </div>
            </RadioGroup>

            {data.remove_non_allowed_vat === false && (
              <div className="space-y-2">
                <Label htmlFor="motor-reason">Please explain why this VAT is reclaimable</Label>
                <Textarea
                  id="motor-reason"
                  placeholder="e.g., Commercial vehicle used 100% for business..."
                  value={data.remove_non_allowed_reason}
                  onChange={(e) => onUpdate({ remove_non_allowed_reason: e.target.value })}
                  rows={3}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
