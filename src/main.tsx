import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Initialise Sentry error monitoring
// Replace the DSN below with your real Sentry DSN from https://sentry.io
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN || "",
    environment: import.meta.env.MODE,
    // Only send 20% of transactions to keep within free tier
    tracesSampleRate: 0.2,
    // Don't send PII (emails, usernames) to Sentry
    sendDefaultPii: false,
  });
}

createRoot(document.getElementById("root")!).render(<App />);
