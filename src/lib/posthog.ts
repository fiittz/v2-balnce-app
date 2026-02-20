import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

export function initPostHog() {
  if (!POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Autocapture clicks, inputs, page views
    autocapture: true,
    // Session replay — records user sessions
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: { password: true },
    },
    // Capture page views on route change (SPA)
    capture_pageview: false, // we handle this manually via useLocation
    capture_pageleave: true,
    // Heatmaps
    enable_heatmaps: true,
    // Feature flags — evaluated on every page load
    advanced_disable_feature_flags: false,
    // Performance monitoring
    capture_performance: true,
    // Respect Do Not Track
    respect_dnt: true,
    persistence: "localStorage+cookie",
  });
}

export { posthog };
