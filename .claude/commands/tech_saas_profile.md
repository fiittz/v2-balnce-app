# Trade Profile: Technology / GTM SaaS Company

Load this context when working on technology/SaaS-specific categorization, VAT treatment, R&D tax credits, capitalisation, or bookkeeping scenarios.

---

## VAT Treatment of Supplies

A GTM SaaS company supplies **electronically supplied services (ESS)**. VAT treatment depends on who the customer is and where they are located:

| Customer Type | Location | VAT Treatment | Rate |
|--------------|----------|---------------|------|
| B2B (VAT-registered) | Ireland | Charge 23% VAT | 23% |
| B2C (consumer) | Ireland | Charge 23% VAT | 23% |
| B2B (VAT-registered) | EU | Reverse charge — 0% on invoice | 0% |
| B2C (consumer) | EU | OSS — charge destination country VAT | Varies (17-27%) |
| B2B or B2C | Non-EU (UK, US, etc.) | Outside scope — no Irish VAT | 0% |

---

## Electronically Supplied Services (ESS) Rules

SaaS subscriptions, cloud-hosted software, and digital platform access are classified as **electronically supplied services** under Irish/EU VAT law.

**Key rules:**
- ESS are taxed where the **customer belongs** (not where the supplier is)
- For B2B EU sales: customer self-accounts via reverse charge; Irish company reports in VIES return
- For B2C EU sales: company must register for **OSS (One-Stop Shop)** if cross-border B2C sales exceed €10,000/year
- For non-EU sales: completely outside the scope of Irish VAT — do NOT charge VAT
- **No two-thirds rule** — software is a pure service, not a mixed supply

**OSS (One-Stop Shop) — EU B2C digital sales:**
- Single VAT registration in Ireland covers all EU B2C sales
- File quarterly OSS return via ROS
- Charge the VAT rate of the customer's country (e.g., Germany 19%, France 20%, Spain 21%)
- Remit via Irish Revenue — no need to register in each EU country
- Threshold: €10,000 combined EU B2C digital sales; below this, can charge Irish 23%

---

## VAT Registration Considerations

A SaaS company supplies services only:
- **Services threshold: €42,500** (since turnover is 100% services)
- Most SaaS companies exceed this quickly and must register

**Should a SaaS company below threshold voluntarily register?**
- **Yes, almost always** — allows reclaiming VAT on cloud hosting, software tools, equipment, and office costs
- Input VAT recovery on AWS/Azure/GCP bills alone often justifies registration
- B2B customers expect VAT invoices

---

## R&D Tax Credit (Section 766 TCA 1997) — Critical for SaaS

The R&D tax credit is the **single most valuable relief** for an Irish SaaS company.

**Rate:** 30% of qualifying R&D expenditure (increased from 25% from 1 Jan 2024)

**What qualifies as R&D:**
- Development of new software features, algorithms, or architectures
- Systematic investigation to resolve scientific/technological uncertainty
- Building new integrations, APIs, or data processing pipelines
- NOT: routine coding, bug fixes, UI tweaks, or configuration changes

**Qualifying expenditure:**
| Item | Qualifies? | Notes |
|------|-----------|-------|
| Developer salaries (R&D portion) | Yes | Must track time on qualifying vs non-qualifying activities |
| Contractor developers (R&D work) | Yes | Must be working on qualifying projects |
| Cloud compute for R&D (dev/staging) | Yes | Separate from production hosting |
| R&D-related software licenses | Yes | Tools used specifically for R&D work |
| Production hosting (AWS/Azure) | No | Operational, not R&D |
| Sales & marketing costs | No | Not R&D |
| General admin | No | Not R&D |

**How to claim:**
1. File with CT1 return (Part 29, Panel G)
2. Credit applied against CT liability first
3. Excess credit: cash refund over 3 years (33% per year) or carried forward
4. Must maintain contemporaneous R&D documentation (project logs, time records)

**Key tip:** A company with €200,000 in qualifying R&D spend gets a €60,000 tax credit — this can exceed the entire CT1 liability and generate a cash refund.

---

## Knowledge Development Box (Section 769R TCA 1997)

**Rate:** Effective 6.25% corporation tax on qualifying IP profits (vs standard 12.5%)

**What qualifies:**
- Profits arising from qualifying patents, copyrighted software, or supplementary protection certificates
- The IP must result from R&D activities that qualified for the R&D tax credit
- Only applicable to Irish-developed IP

**Calculation (modified nexus approach):**
```
Qualifying profits = Overall IP income × (Qualifying R&D expenditure / Total IP expenditure)
```

**Practical note:** Most early-stage SaaS companies benefit more from the R&D tax credit than the KDB. The KDB becomes valuable when the company is profitable and generating significant IP-derived revenue.

---

## Allowable VAT Input Credits (SaaS Company)

| Expense | VAT Reclaimable? | Rate | Notes |
|---------|-----------------|------|-------|
| Cloud hosting (AWS, Azure, GCP) | Yes* | 23% | *Self-account via reverse charge (EU B2B service received) |
| SaaS subscriptions (HubSpot, Slack, etc.) | Yes* | 23% | *Reverse charge on non-Irish EU/non-EU suppliers |
| Developer laptops/monitors | Yes | 23% | Business use — full input credit |
| Office rent | Yes | 23% | If landlord is VAT-registered |
| Co-working space | Yes | 23% | Business use |
| Electricity/heating (office) | Yes | 13.5% | Reduced rate |
| Phone & broadband | Yes | 23% | Business portion only |
| Office furniture (desks, chairs) | Yes | 23% | Business use |
| Conference/event tickets | Yes | 23% | Business networking |
| Accountancy/legal fees | Yes | 23% | Professional services |
| Advertising (Google Ads, LinkedIn) | Yes* | 23% | *Reverse charge on non-Irish suppliers |
| Insurance | **No** | — | Exempt supply |
| Client entertainment | **No** | — | Never reclaimable |
| Food/drink for self | **No** | — | Never reclaimable |
| Passenger car | **No** | — | Never reclaimable |
| Petrol | **No** | — | Never reclaimable |
| Diesel for company car | Yes | 23% | If commercial vehicle |

**Reverse charge on imported services:**
When an Irish SaaS company buys from non-Irish suppliers (AWS US, GitHub US, Atlassian AU), the company must:
1. Self-account for VAT at 23% (add to both T1 outputs and T2 inputs on VAT return)
2. Net effect is zero, but it must be reported
3. The input credit is still claimable if the expense is for taxable business activities

---

## Capitalisation Policy (SaaS-Specific)

**Default threshold: €750** (adjustable at onboarding)

### Software Development Costs (IAS 38 / FRS 102 Section 18)

| Phase | Treatment | Reason |
|-------|-----------|--------|
| Research phase | **Revenue expense** | Always expensed — no certainty of future benefit |
| Development phase (meets criteria) | **Capitalise as intangible asset** | Technical feasibility demonstrated, intention to complete, ability to use/sell |
| Post-launch maintenance | **Revenue expense** | Sustaining existing functionality |
| New feature development | **Capitalise** (if meets criteria) | Enhances the asset |

**Criteria for capitalising development costs:**
1. Technically feasible to complete
2. Intention to complete and use/sell
3. Ability to use or sell
4. Probable future economic benefits
5. Adequate resources to complete
6. Costs can be reliably measured

**Amortisation:** Over useful life (typically 3-5 years for software)

### Hardware & Equipment

| Item | Typical Cost | Treatment | Reason |
|------|-------------|-----------|--------|
| Developer laptop | €1,500-€3,500 | **Cap Ex** | Above threshold, 3-5 year life |
| Monitor/display | €300-€800 | **Cap Ex** (if above threshold) | Check against threshold |
| Keyboard/mouse/peripherals | €50-€300 | **Revenue expense** | Below threshold |
| Server hardware (if on-prem) | €2,000-€20,000 | **Cap Ex** | Above threshold |
| Office furniture | €200-€1,500 | **Cap Ex** (if above threshold) | Check against threshold |
| Cloud hosting (AWS/Azure) | Monthly | **Revenue expense** | Operational cost, no asset acquired |
| SaaS subscriptions | Monthly/annual | **Revenue expense** | No asset acquired |
| Domain names | €10-€50/yr | **Revenue expense** | Immaterial |

---

## Capital Allowances (SaaS Company Assets)

| Asset Category | Rate | Period | Examples |
|---------------|------|--------|---------|
| Plant & Machinery | 12.5% p.a. | 8 years | Laptops, monitors, servers, office equipment |
| Motor Vehicles | 12.5% p.a. | 8 years | Capped at €24,000; restricted by emissions category |
| Intangible Assets (Section 291A) | Variable | Variable | Purchased software IP, patents, customer lists, goodwill |
| Energy-efficient equipment (ACA) | 100% | Year of purchase | Qualifying equipment per SEAI list |

**Section 291A — Specified Intangible Assets:**
If the company acquires IP (e.g., purchases a software product or customer base), it can claim capital allowances on:
- Patents, copyrights, trademarks
- Know-how, customer lists, goodwill
- Computer software (purchased, not internally developed)
- Rate: aligned with accounting amortisation or 7% p.a. over 15 years

---

## Typical Chart of Accounts (GTM SaaS LLC)

**Income:**
- SaaS Subscription Revenue (23% / reverse charge / OSS)
- Implementation & Onboarding Fees (23%)
- Consulting & Professional Services (23%)
- Support & Maintenance Revenue (23%)

**Cost of Revenue (COGS):**
- Cloud Hosting & Infrastructure (AWS / Azure / GCP)
- Third-Party API & Data Costs
- Payment Processing Fees (Stripe / PayPal)
- Customer Support Tooling

**Operating Expenses — Sales & Marketing:**
- Digital Advertising (Google Ads, LinkedIn, Meta)
- Marketing Software (HubSpot, Mailchimp, Intercom)
- Conference & Events
- Content & Design (Figma, Canva, freelancers)

**Operating Expenses — Product & Engineering:**
- Developer Salaries (portion may qualify for R&D credit)
- SaaS Development Tools (GitHub, Atlassian, Vercel)
- QA & Testing Tools
- Domain & SSL Certificates

**Operating Expenses — General & Admin:**
- Office Rent / Co-working Space
- Office Utilities (light, heat)
- Phone & Broadband
- Accountancy & Legal Fees
- Bank Charges
- Insurance (PI, employer's liability, cyber)
- Subscriptions & Software (general: Slack, Notion, Zoom)
- Travel & Accommodation
- Subsistence
- Training & Conferences
- Director's Remuneration
- Employer PRSI & Pension

**Non-Current Assets (Cap Ex):**
- Computer Equipment (laptops, monitors, servers)
- Office Furniture & Fixtures
- Capitalised Development Costs (intangible asset)
- Purchased IP / Software Licences (Section 291A)

---

## Common Bookkeeping Scenarios

**Scenario 1 — SaaS subscription sale to Irish B2B customer:**
```
Sales Day Book:
  DR Trade Receivables     €1,230.00
  CR SaaS Revenue          €1,000.00
  CR VAT (output — 23%)    €230.00
```

**Scenario 2 — SaaS subscription sale to German B2B customer (reverse charge):**
```
Sales Day Book:
  DR Trade Receivables     €1,000.00
  CR SaaS Revenue          €1,000.00
  VAT: €0 (reverse charge — customer self-accounts in Germany)

  Report in VIES return: supply of services to DE customer
```

**Scenario 3 — SaaS sale to French consumer via OSS (B2C):**
```
Sales Day Book:
  DR Trade Receivables     €1,200.00
  CR SaaS Revenue          €1,000.00
  CR VAT (output — FR 20%) €200.00     ← French VAT rate, remitted via OSS return
```

**Scenario 4 — AWS hosting invoice (reverse charge on imported service):**
```
Purchases Day Book:
  DR Cloud Hosting         €2,000.00
  DR VAT (input — 23%)     €460.00     ← Self-accounted, reclaimable
  CR Trade Payables         €2,000.00
  CR VAT (output — 23%)    €460.00     ← Self-accounted, T1 liability

  Net VAT effect: €0 (input and output cancel)
  Must be reported on VAT return: T1 +€460, T2 -€460
```

**Scenario 5 — Developer laptop purchase (Cap Ex):**
```
Asset Register:
  DR Computer Equipment    €2,200.00
  DR VAT (input — 23%)     €506.00
  CR Bank                  €2,706.00

Annual Capital Allowance:
  €2,200 × 12.5% = €275.00 per year for 8 years
```

**Scenario 6 — Monthly Slack subscription:**
```
Cash Book:
  DR Subscriptions & Software  €11.38
  DR VAT (input — 23%)         €2.62     ← Reverse charge self-accounted
  CR Bank                      €11.38
  CR VAT (output — 23%)        €2.62     ← Reverse charge self-accounted
```

**Scenario 7 — R&D tax credit claim (year-end adjustment):**
```
Year-end CT1 computation:
  Qualifying R&D expenditure:     €150,000
  R&D tax credit (30%):           €45,000

  CT1 liability before credit:    €20,000
  Credit applied:                -€20,000
  Excess credit:                  €25,000 → cash refund over 3 years

  Year 1 refund: €8,333
  Year 2 refund: €8,333
  Year 3 refund: €8,334
```

**Scenario 8 — Director buys lunch during client meeting:**
```
Cash Book:
  DR Meals & Entertainment      €35.00
  CR Bank / Petty Cash          €35.00
  VAT: €0 reclaimable (entertainment is never VAT-deductible)

  Note: Allowable as CT deduction if wholly for business purposes,
  but VAT is never reclaimable on entertainment.
```
