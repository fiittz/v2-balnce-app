import posthog from "posthog-js";

export const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
  defaults: "2026-01-30",
  session_recording: {
    maskAllInputs: false,
    maskInputOptions: { password: true },
  },
  capture_pageleave: true,
  enable_heatmaps: true,
  capture_performance: true,
} as const;

export const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY || "";

export { posthog };
