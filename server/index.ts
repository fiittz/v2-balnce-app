import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "balnce-backend" });
});

// Placeholder for Stripe + Supabase integration
// e.g. app.post("/api/create-checkout-session", ...)

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
