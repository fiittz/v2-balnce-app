import { describe, it, expect } from "vitest";
import { scanForReliefs, type ReliefScanResult } from "../reliefScanner";

function makeTransaction(description: string, amount: number, type = "expense") {
  return {
    description,
    amount,
    transaction_date: "2024-06-15",
    type,
  };
}

// ══════════════════════════════════════════════════════════════
// scanForReliefs
// ══════════════════════════════════════════════════════════════
describe("scanForReliefs", () => {
  it("returns empty result for empty transactions", () => {
    const result = scanForReliefs([]);
    expect(result.medical.total).toBe(0);
    expect(result.healthInsurance.total).toBe(0);
    expect(result.pension.total).toBe(0);
    expect(result.charitable.total).toBe(0);
    expect(result.rent.total).toBe(0);
    expect(result.tuition.total).toBe(0);
  });

  it("ignores income transactions", () => {
    const txns = [
      makeTransaction("VHI Payment", 1_000, "income"),
    ];
    const result = scanForReliefs(txns);
    expect(result.healthInsurance.total).toBe(0);
  });

  it("ignores zero-amount transactions", () => {
    const txns = [makeTransaction("VHI Payment", 0)];
    const result = scanForReliefs(txns);
    expect(result.healthInsurance.total).toBe(0);
  });

  // ── Health Insurance ───────────────────────────────
  it("detects VHI as health insurance", () => {
    const result = scanForReliefs([makeTransaction("VHI Direct Debit", 150)]);
    expect(result.healthInsurance.total).toBe(150);
    expect(result.healthInsurance.transactions).toHaveLength(1);
  });

  it("detects Laya Healthcare", () => {
    const result = scanForReliefs([makeTransaction("LAYA HEALTHCARE PREMIUM", 200)]);
    expect(result.healthInsurance.total).toBe(200);
  });

  // ── Medical (non-routine) ──────────────────────────
  it("detects physiotherapy as medical", () => {
    const result = scanForReliefs([makeTransaction("Physio session", 80)]);
    expect(result.medical.total).toBe(80);
  });

  it("detects hospital as medical", () => {
    const result = scanForReliefs([makeTransaction("Mater Private Hospital", 500)]);
    expect(result.medical.total).toBe(500);
  });

  it("detects consultant as medical", () => {
    const result = scanForReliefs([makeTransaction("Consultant visit Dr Smith", 250)]);
    expect(result.medical.total).toBe(250);
  });

  // ── Medical exclusions (routine/cosmetic) ──────────
  it("excludes teeth whitening from medical", () => {
    const result = scanForReliefs([makeTransaction("Teeth whitening treatment", 300)]);
    expect(result.medical.total).toBe(0);
  });

  it("excludes routine dental checkup from medical", () => {
    const result = scanForReliefs([makeTransaction("Dental checkup Dr Murphy", 60)]);
    expect(result.medical.total).toBe(0);
  });

  it("excludes botox from medical", () => {
    const result = scanForReliefs([makeTransaction("Botox treatment", 400)]);
    expect(result.medical.total).toBe(0);
  });

  it("excludes cosmetic procedures from medical", () => {
    const result = scanForReliefs([makeTransaction("Cosmetic surgery clinic", 2_000)]);
    expect(result.medical.total).toBe(0);
  });

  // ── Pension ─────────────────────────────────────────
  it("detects Irish Life pension contribution", () => {
    const result = scanForReliefs([makeTransaction("Irish Life Pension contribution", 500)]);
    expect(result.pension.total).toBe(500);
  });

  it("detects Zurich pension", () => {
    const result = scanForReliefs([makeTransaction("Zurich Pension DD", 300)]);
    expect(result.pension.total).toBe(300);
  });

  // ── Charitable ─────────────────────────────────────
  it("detects Trocaire donation", () => {
    const result = scanForReliefs([makeTransaction("TROCAIRE DONATION", 250)]);
    expect(result.charitable.total).toBe(250);
  });

  it("detects SVP donation", () => {
    const result = scanForReliefs([makeTransaction("SVP monthly standing order", 50)]);
    expect(result.charitable.total).toBe(50);
  });

  // ── Rent ────────────────────────────────────────────
  it("detects rent payment", () => {
    const result = scanForReliefs([makeTransaction("Rent payment February", 1_200)]);
    expect(result.rent.total).toBe(1_200);
  });

  it("detects RTB registration", () => {
    const result = scanForReliefs([makeTransaction("RTB Registration Fee", 40)]);
    expect(result.rent.total).toBe(40);
  });

  // ── Tuition ─────────────────────────────────────────
  it("detects UCD tuition", () => {
    const result = scanForReliefs([makeTransaction("UCD Student Fees", 3_500)]);
    expect(result.tuition.total).toBe(3_500);
  });

  it("detects Trinity College tuition", () => {
    const result = scanForReliefs([makeTransaction("Trinity College Dublin Fees", 4_000)]);
    expect(result.tuition.total).toBe(4_000);
  });

  // ── Aggregation ─────────────────────────────────────
  it("aggregates multiple transactions per category", () => {
    const txns = [
      makeTransaction("VHI Q1", 150),
      makeTransaction("VHI Q2", 150),
      makeTransaction("VHI Q3", 150),
      makeTransaction("VHI Q4", 150),
    ];
    const result = scanForReliefs(txns);
    expect(result.healthInsurance.total).toBe(600);
    expect(result.healthInsurance.transactions).toHaveLength(4);
  });

  it("categorises into correct buckets in mixed list", () => {
    const txns = [
      makeTransaction("VHI DD", 150),
      makeTransaction("Physio session", 80),
      makeTransaction("Irish Life Pension", 500),
      makeTransaction("TROCAIRE DONATION", 250),
      makeTransaction("Rent payment", 1_200),
      makeTransaction("UCD Student Fees", 3_500),
      makeTransaction("Random purchase", 50),
    ];
    const result = scanForReliefs(txns);
    expect(result.healthInsurance.total).toBe(150);
    expect(result.medical.total).toBe(80);
    expect(result.pension.total).toBe(500);
    expect(result.charitable.total).toBe(250);
    expect(result.rent.total).toBe(1_200);
    expect(result.tuition.total).toBe(3_500);
  });

  it("uses absolute value of negative amounts", () => {
    const result = scanForReliefs([makeTransaction("VHI Payment", -150)]);
    expect(result.healthInsurance.total).toBe(150);
  });
});
