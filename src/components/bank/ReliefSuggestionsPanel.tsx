import { useState } from "react";
import { Lightbulb, ChevronDown, ChevronRight, Building2, User } from "lucide-react";
import type { FilteredSuggestions } from "@/lib/reliefSuggestions";
import type { IndustryGroup } from "@/lib/industryGroups";

interface ReliefSuggestionsPanelProps {
  suggestions: FilteredSuggestions;
  industryGroup: IndustryGroup;
  isPersonal: boolean;
}

const INDUSTRY_LABELS: Record<IndustryGroup, string> = {
  construction: "Construction",
  technology: "Technology",
  software_dev: "Software Development",
  events: "Events",
  hospitality: "Hospitality",
  retail: "Retail",
  transport: "Transport & Logistics",
  health: "Health & Wellness",
  property: "Property",
  manufacturing: "Manufacturing",
  professional: "Professional Services",
};

export default function ReliefSuggestionsPanel({
  suggestions,
  industryGroup,
  isPersonal,
}: ReliefSuggestionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const companySuggestions = suggestions.company;
  const personalSuggestions = suggestions.personal;
  const totalCount = isPersonal
    ? personalSuggestions.length
    : companySuggestions.length + personalSuggestions.length;

  if (totalCount === 0) return null;

  return (
    <div className="bg-card rounded-2xl p-6 card-shadow mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-100 dark:bg-amber-950/40">
            <Lightbulb className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-base">Suggested Tax Savings</h3>
            <p className="text-xs text-muted-foreground">
              {INDUSTRY_LABELS[industryGroup]} &middot; {totalCount} suggestion{totalCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Company suggestions (CT1) — hidden for personal accounts */}
          {!isPersonal && companySuggestions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                <Building2 className="w-4 h-4" />
                Company Savings (CT1)
              </h4>
              <div className="space-y-2">
                {companySuggestions.map((s) => (
                  <div key={s.id} className="pl-4 border-l-2 border-amber-300 dark:border-amber-700">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personal suggestions (Form 11) */}
          {personalSuggestions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                <User className="w-4 h-4" />
                Personal Savings (Form 11)
              </h4>
              <div className="space-y-2">
                {personalSuggestions.map((s) => (
                  <div key={s.id} className="pl-4 border-l-2 border-blue-300 dark:border-blue-700">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground italic pt-2 border-t border-border">
            These are general suggestions based on your business profile. Verify eligibility at Revenue.ie
          </p>
        </div>
      )}
    </div>
  );
}
