# Staff Entertainment Expenses

Load this context when categorising staff night out, Christmas party, team event, or employee social expenses for a limited company.

---

## Tax Treatment Summary

| Aspect | Treatment | Reference |
|--------|-----------|-----------|
| **Corporation Tax** | Deductible | TCA 1997 s.840 (bona fide staff entertainment exception) |
| **VAT** | NOT recoverable | VATCA 2010 s.60(2)(a)(i) & (iii) — food, drink, entertainment |
| **BIK for employees** | No BIK (if conditions met) | Revenue concession — TDM Part 05-01-01l |

---

## Conditions for CT Deductibility & No BIK

| Condition | Detail |
|-----------|--------|
| **Open to ALL staff** | Must not be restricted to directors only, one department, or a select group |
| **Reasonable cost** | No fixed per-head limit in Ireland (unlike UK £150). Revenue applies a general reasonableness test |
| **Frequency** | Revenue may challenge more than 3–4 events per year |
| **Staff only** | Must NOT be incidental to client/third-party entertainment. If clients attend, the entire expense risks becoming non-deductible under s.840 |
| **No cash alternative** | The event itself is provided; cannot give cash equivalent tax-free |
| **Alcohol included** | The concession covers alcohol as part of the event |
| **Partners/spouses** | Their share is NOT covered by the concession — could create BIK |

---

## Staff Entertainment vs Client Entertainment

| | Staff Entertainment | Client Entertainment |
|---|---|---|
| **CT deductible** | YES (s.840 exception) | NO (s.840 block) |
| **VAT recoverable** | NO | NO |
| **BIK** | No (if conditions met) | N/A |
| **Category** | Meals & Entertainment | Meals & Entertainment |

**Critical distinction:** s.840 TCA blocks ALL business entertainment from CT deduction, but makes a specific exception for *bona fide staff entertainment that is not incidental to entertaining third parties*. Mixed events (staff + clients) risk the entire cost becoming non-deductible.

---

## Working Lunch Threshold

Working lunches provided on-premises have a separate, lower threshold:
- **EUR 19.25 per person** (aligned with Civil Service 5-hour subsistence rate)
- Exceeding this makes the **full amount** taxable as BIK (not just the excess)

---

## Autocat Handling

When the autocat detects a staff entertainment keyword on a limited company account:
- **Category:** `Meals & Entertainment`
- **VAT deductible:** `false` (s.60 block on food/drink/entertainment)
- **Business expense:** `true` (CT deductible under s.840 exception)
- **Needs review:** `true` (verify it meets all conditions)
- **Needs receipt:** `true`

---

## Revenue Audit Risk (2024–2025)

Revenue has been actively auditing staff entertainment claims since late 2024:
- Targeting events not genuinely "open to all" staff
- Departmental lunches and single-person retirement events flagged
- Enhanced Reporting Requirements (ERR) from Jan 2025 — events failing conditions must go through payroll as BIK

---

## Related Commands

- `/ct1_reliefs` — Corporation Tax reliefs and deductions
- `/vat_compliance` — VAT rules including disallowed input credits
- `/categorization_rules` — Transaction categorization logic
- `/irish_tax_rules` — Quick-reference rates card
