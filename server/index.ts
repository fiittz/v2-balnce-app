import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = [
  "https://app.balnce.ie",
  "https://balnce.ie",
  "https://www.balnce.ie",
  "https://v2-balnce-app.vercel.app",
];

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl, health checks)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/v2-balnce-app[a-z0-9-]*\.vercel\.app$/.test(origin) ||
      (process.env.NODE_ENV !== "production" && /^https?:\/\/localhost(:\d+)?$/.test(origin))
    ) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "balnce-backend" });
});

// Placeholder for Stripe + Supabase integration
// e.g. app.post("/api/create-checkout-session", ...)

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
