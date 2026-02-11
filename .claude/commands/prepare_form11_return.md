# Prepare Form 11 Return

Step-by-step workflow for preparing a Form 11 (or Form 12) Income Tax return for directors and sole traders.

---

## Income Tax Rates (2025)

| Band | Rate | Single Person | Married (one income) | Married (two incomes) |
|------|------|---------------|----------------------|-----------------------|
| Standard rate | 20% | First €44,000 | First €53,000 | Up to €88,000 combined |
| Higher rate | 40% | Balance | Balance | Balance |

**Earned Income Tax Credit:** €2,000 (self-assessed individuals / sole traders).

## Universal Social Charge (USC) (2025)

| Income Band | Rate |
|-------------|------|
| €0 – €12,012 | 0.5% |
| €12,013 – €27,382 | 2% |
| €27,383 – €70,044 | 3% |
| €70,045 – €100,000 | 8% |
| €100,001+ (self-assessed) | 11% |

**Exemption:** Total taxable income below €13,000 → exempt from USC.

## Self-Employed PRSI (Class S)

- **Rate:** 4.1% on all income net of capital allowances
- **Minimum contribution:** €500/year
- **Payment:** Due with preliminary tax on or before 31 October (mid-November via ROS)
- **Benefits:** Jobseeker's Benefit, Invalidity Pension, Treatment Benefit, Maternity/Paternity Benefit

## Self-Assessment Deadlines (Pay & File)

| Deadline | Action |
|----------|--------|
| 31 October | File prior-year Form 11 AND pay balance of tax due |
| 31 October | Pay preliminary tax for current year (≥90% current year, or 100% prior year, or 105% pre-prior year by DD) |
| Mid-November (ROS) | Extended deadline for filing and payment via Revenue Online Service |

**Surcharge for late filing:**
- Within 2 months of deadline: 5% of tax due (max €12,695)
- More than 2 months late: 10% of tax due (max €63,485)

**Late payment interest:** 0.0219% per day (~8% per annum).

---

## Form 11/12 Sections

### From Company Data (directors)
- Director salary (PAYE income)
- Dividends received
- Benefits-in-kind (company vehicle, etc.)

### Additional (ask director/sole trader)
- Other employment income
- Rental income
- Investment income (deposit interest, dividends from other companies)
- Foreign income
- Pension contributions
- Medical expenses

---

## Preparation Workflow

### Step 1 — Gather Income Sources

Collect all income for the tax year:
- [ ] Salary / director's remuneration (P60 / payroll summary)
- [ ] Dividends from own company
- [ ] Benefits-in-kind (BIK)
- [ ] Rental income (gross rents less allowable expenses)
- [ ] Investment income (deposit interest, foreign dividends)
- [ ] Any other Schedule D / Schedule E income

### Step 2 — Calculate Total Income

Sum all income sources. Separate into:
- **Schedule E** — employment/director income (PAYE already deducted)
- **Schedule D Case I/II** — trading/professional income
- **Schedule D Case III** — investment income
- **Schedule D Case IV/V** — foreign income, rental income

### Step 3 — Apply Deductions and Reliefs

See `/form11_reliefs` for the full reference. Key items:
- Personal tax credits (Single €1,875, Married €3,750, Earned Income €2,000)
- Pension contributions (age-based limits)
- Medical expenses (20% relief)
- Capital allowances (if sole trader)
- Loss relief (trading losses carried forward)

### Step 4 — Calculate Income Tax

1. Apply standard rate band (20%) to income within the band
2. Apply higher rate (40%) to the balance
3. Deduct tax credits from gross tax liability
4. Result = **Net Income Tax payable**

### Step 5 — Calculate USC

Apply each USC band sequentially to total income (before credits). USC is not reduced by tax credits.

### Step 6 — Calculate PRSI Class S

- 4.1% × (assessable income net of capital allowances)
- Minimum €500

### Step 7 — Determine Preliminary Tax Obligation

For current year preliminary tax, pay the greater of:
- 90% of current-year liability, OR
- 100% of prior-year liability, OR
- 105% of pre-prior-year liability (direct debit only)

### Step 8 — Generate Form 11 Report

Output a preparation summary:

```
=== FORM 11 PREPARATION REPORT ===
Tax Year: [YYYY]
Taxpayer: [Name] — PPS: [Number]

INCOME
  Schedule E (salary/BIK):     €[x]
  Schedule D Case I/II:        €[x]
  Schedule D Case III:         €[x]
  Schedule D Case IV/V:        €[x]
  TOTAL INCOME:                €[x]

DEDUCTIONS & RELIEFS
  Pension contributions:       €[x]
  Other deductions:            €[x]
  TAXABLE INCOME:              €[x]

TAX CALCULATION
  Income Tax (20%):            €[x]
  Income Tax (40%):            €[x]
  Gross Tax:                   €[x]
  Less: Tax Credits:          -€[x]
  NET INCOME TAX:              €[x]

  USC:                         €[x]
  PRSI Class S:                €[x]

  TOTAL LIABILITY:             €[x]
  Less: PAYE/tax deducted:    -€[x]
  BALANCE DUE:                 €[x]

PRELIMINARY TAX (current year): €[x]
TOTAL PAYMENT DUE:             €[x]
DEADLINE: 31 October / mid-November (ROS)
==========================================
```

---

## Related Commands

- `/form11_reliefs` — Full reference of tax credits, reliefs, and allowances
- `/irish_tax_rules` — Quick-reference rates card
- `/prepare_ct1_return_carpenter_llc` — CT1 Corporation Tax return
