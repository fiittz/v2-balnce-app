import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";
import App from "./App.tsx";
import "./index.css";

// Initialise Sentry error monitoring (only if DSN is configured)
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
  });
}

// Initialise PostHog
const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: { password: true },
    },
    enable_heatmaps: true,
    capture_performance: true,
    persistence: "localStorage+cookie",
  });
}

createRoot(document.getElementById("root")!).render(
  <PostHogProvider client={posthog}>
    <App />
  </PostHogProvider>,
);
