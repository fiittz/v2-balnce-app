import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isDemoMode } from "@/lib/mockData";
import { WidgetId, WidgetPreferences, WidgetDefinition, WIDGET_DEFINITIONS } from "@/types/dashboardWidgets";

interface OnboardingSettings {
  vat_registered: boolean | null;
  rct_registered: boolean | null;
  business_type: string | null;
  eu_trade_enabled: boolean | null;
}

function isWidgetApplicable(widget: WidgetDefinition, settings: OnboardingSettings): boolean {
  if (!widget.conditionalOn) return true;

  const { vatRegistered, rctRegistered, euTradeEnabled, businessTypes } = widget.conditionalOn;

  if (vatRegistered && !settings.vat_registered) return false;
  if (rctRegistered && !settings.rct_registered) return false;
  if (euTradeEnabled && !settings.eu_trade_enabled) return false;
  if (businessTypes && businessTypes.length > 0) {
    const bt = (settings.business_type || "").toLowerCase();
    if (!businessTypes.some((t) => bt.includes(t))) return false;
  }

  return true;
}

function buildDefaults(settings: OnboardingSettings): WidgetPreferences {
  const prefs: WidgetPreferences = {};
  for (const w of WIDGET_DEFINITIONS) {
    prefs[w.id] = isWidgetApplicable(w, settings) && w.defaultVisible;
  }
  return prefs;
}

export function useDashboardWidgets() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<WidgetPreferences | null>(null);
  const [onboardingSettings, setOnboardingSettings] = useState<OnboardingSettings>({
    vat_registered: null,
    rct_registered: null,
    business_type: null,
    eu_trade_enabled: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch onboarding settings and widget preferences
  useEffect(() => {
    if (!user) return;

    // In demo mode, skip Supabase queries and use defaults immediately
    if (isDemoMode()) {
      const settings: OnboardingSettings = {
        vat_registered: true,
        rct_registered: true,
        business_type: "construction",
        eu_trade_enabled: false,
      };
      setOnboardingSettings(settings);
      setPreferences(buildDefaults(settings));
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);

      // Fetch onboarding settings for conditional logic
      const { data: onboarding } = await supabase
        .from("onboarding_settings")
        .select("vat_registered, rct_registered, business_type, eu_trade_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      const settings: OnboardingSettings = {
        vat_registered: onboarding?.vat_registered ?? null,
        rct_registered: onboarding?.rct_registered ?? null,
        business_type: onboarding?.business_type ?? null,
        eu_trade_enabled: onboarding?.eu_trade_enabled ?? null,
      };
      setOnboardingSettings(settings);

      // Fetch widget preferences from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("dashboard_widget_preferences")
        .eq("id", user.id)
        .maybeSingle();

      const stored = profile?.dashboard_widget_preferences as WidgetPreferences | null;
      if (stored && typeof stored === "object") {
        setPreferences(stored);
      } else {
        // Use defaults based on business type
        setPreferences(buildDefaults(settings));
      }

      setIsLoading(false);
    };

    load();
  }, [user]);

  const defaults = useMemo(() => buildDefaults(onboardingSettings), [onboardingSettings]);

  const persist = useCallback(
    async (next: WidgetPreferences) => {
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ dashboard_widget_preferences: next as unknown as Record<string, unknown> })
        .eq("id", user.id);
    },
    [user],
  );

  const toggleWidget = useCallback(
    (id: WidgetId) => {
      setPreferences((prev) => {
        const current = prev ?? defaults;
        const next = { ...current, [id]: !current[id] };
        persist(next);
        return next;
      });
    },
    [defaults, persist],
  );

  const resetToDefaults = useCallback(() => {
    setPreferences(defaults);
    persist(defaults);
  }, [defaults, persist]);

  const isWidgetVisible = useCallback(
    (id: WidgetId): boolean => {
      if (isLoading) return false;
      const prefs = preferences ?? defaults;
      return prefs[id] ?? defaults[id] ?? false;
    },
    [preferences, defaults, isLoading],
  );

  const availableWidgets = useMemo(
    () => WIDGET_DEFINITIONS.filter((w) => isWidgetApplicable(w, onboardingSettings)),
    [onboardingSettings],
  );

  return {
    isLoading,
    preferences: preferences ?? defaults,
    toggleWidget,
    resetToDefaults,
    isWidgetVisible,
    availableWidgets,
  };
}
