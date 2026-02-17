import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings2, RotateCcw } from "lucide-react";
import {
  WidgetId,
  WidgetDefinition,
  WidgetCategory,
  WidgetPreferences,
  CATEGORY_LABELS,
} from "@/types/dashboardWidgets";

interface WidgetCustomizeSheetProps {
  availableWidgets: WidgetDefinition[];
  preferences: WidgetPreferences;
  onToggle: (id: WidgetId) => void;
  onReset: () => void;
}

export function WidgetCustomizeSheet({
  availableWidgets,
  preferences,
  onToggle,
  onReset,
}: WidgetCustomizeSheetProps) {
  // Group widgets by category
  const grouped = availableWidgets.reduce<Record<WidgetCategory, WidgetDefinition[]>>(
    (acc, w) => {
      if (!acc[w.category]) acc[w.category] = [];
      acc[w.category].push(w);
      return acc;
    },
    {} as Record<WidgetCategory, WidgetDefinition[]>
  );

  const categoryOrder: WidgetCategory[] = [
    "overview",
    "financial",
    "bookkeeping",
    "tasks",
    "charts",
    "construction",
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-full"
        >
          <Settings2 className="w-4 h-4" />
          Customize
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Customize Dashboard</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {categoryOrder.map((cat) => {
            const widgets = grouped[cat];
            if (!widgets || widgets.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <div className="space-y-3">
                  {widgets.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">
                          {w.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {w.description}
                        </p>
                      </div>
                      <Switch
                        checked={preferences[w.id] ?? false}
                        onCheckedChange={() => onToggle(w.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 w-full"
            onClick={onReset}
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
