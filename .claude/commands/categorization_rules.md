# Categorization Rules

Load this context when working on transaction categorization, vendor matching, receipt processing, or capitalisation decisions.

---

## Vendor Identification

1. **CSV lookup first** — Check user's uploaded vendor list
2. **Web search fallback** — If not in CSV, search to identify vendor type
3. Determine category (supplier, utility, insurer, etc.)
4. Map to appropriate expense account

**Vendor CSV Structure:**
```
vendor_name, vendor_type, default_account, default_category
Chadwicks, Supplier, Materials, COGS
Circle K, Fuel, Motor Expenses, Operating Expenses
Electric Ireland, Utility, Light & Heat, Operating Expenses
```

---

## Receipt Validation Rules

| Vendor in CSV? | Receipt attached? | Action |
|---------------|-------------------|--------|
| Yes | Yes | Auto-categorize |
| Yes | No | Uncategorised for review |
| No | Yes | Web search, then categorize |
| No | No | Uncategorised for review |

---

## OCR Receipt Processing

Extract from receipt photos:
- **Amount** — Total including/excluding VAT
- **Date** — Transaction date
- **Vendor** — Supplier name
- **Description** — Line items/products

---

## Capitalisation Policy

User-configured at onboarding: `capitalisation_threshold`, `trade_type`, `expense_overrides`.

**Cap Ex vs Revenue Expense Tests:**
1. **Useful life test** — Asset used >1 year → Capital Expenditure
2. **Threshold test** — Cost > user's threshold → Capital Expenditure
3. **Trade overrides** — User exceptions apply (e.g., carpenter: handheld tools always OpEx)

**Example Logic:**

| Item | Useful Life | Above Threshold | Trade Override | Treatment |
|------|-------------|-----------------|----------------|-----------|
| Table saw | >1 year | Yes | None | Cap Ex |
| Cordless drill | >1 year | Maybe | Carpenter: handheld = OpEx | Operating Expense |
| Timber | <1 year | N/A | None | COGS |
| Work van | >1 year | Yes | None | Cap Ex |
