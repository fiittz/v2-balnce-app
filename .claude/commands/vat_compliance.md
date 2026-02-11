# Irish VAT Compliance

Load this context when working on VAT calculations, VAT returns, invoice validation, or any VAT-related task.

---

## VAT Rates (Irish)

| Rate | Type | Apply to |
|------|------|----------|
| 23% | Standard | Default for all taxable goods/services not listed elsewhere |
| 13.5% | Reduced | Construction work, renovation/repair of dwellings, cleaning, waste collection, heating oil, gas, electricity, firewood, restaurant/catering (excl beverages), hotel accommodation, hairdressing, veterinary services, photography, short-term car hire, concrete/blocks, some books, agricultural supplies, medical/dental care |
| 9% | Second reduced | Newspapers/periodicals, e-books/digital publications, admission to cultural events, use of sports facilities |
| 4.8% | Livestock rate | Livestock for food preparation, some agricultural supplies |
| 0% | Zero-rated | Most food, children's clothing/footwear, children's nappies, certain medicines (human, non-pet veterinary), some medical equipment, books (some), intra-community/international transport, feminine hygiene products, seeds/plants for food production |
| N/A | Exempt | Financial services, insurance, education, medical/dental/optical services, childcare, undertaking services |

**Key distinction — Exempt vs Zero-rated:**
- **Exempt**: No VAT on sales AND no input credit on related purchases
- **Zero-rated**: VAT at 0% on sales BUT full input credit on purchases (often leads to VAT refund)

## VAT Calculations

**VAT-exclusive to VAT-inclusive:** `Net × (1 + rate)`
- Example: €200 × 1.23 = €246.00

**VAT-inclusive to VAT amount:** `Gross × (rate ÷ (1 + rate))`
- Example: €246 × (23/123) = €46.00

**VAT-inclusive to net:** `Gross ÷ (1 + rate)`
- Example: €246 ÷ 1.23 = €200.00

---

## VAT Registration Thresholds

| Threshold | Applies to |
|-----------|-----------|
| €85,000 | Supply of goods (or goods + services where goods ≥90% of turnover) |
| €42,500 | Supply of services only |
| €41,000 | Intra-Community acquisitions from other EU Member States |
| €10,000 | Intra-Community distance sales / cross-border TBE services |

**Threshold adjustment for goods:** The €85,000 threshold is calculated AFTER deducting VAT on stock purchased for resale.
- Example: Turnover €87,000 minus VAT on purchases (€41,000 × 23/123 = €7,667) = €79,333 → below threshold, no obligation to register.

**Associated persons rule:** Thresholds apply to the aggregate turnover of all associated entities (group companies, sole trade + company owned by same individual).

**Voluntary registration:** Businesses below the threshold may elect to register if their customers are mainly VAT-registered (customers can reclaim VAT, and the business can claim input credits).

**Deregistration:** If a business elected to register but wants to deregister (being under threshold), it must repay any excess of VAT inputs over VAT charged. If 3+ years since election, only the last 3 years are compared.

---

## VAT Return Mechanics

**Taxable periods:** 6 bi-monthly periods per calendar year (Jan/Feb, Mar/Apr, May/Jun, Jul/Aug, Sep/Oct, Nov/Dec).

**Payment deadline:** 19th of the month following the end of the bi-monthly period (23rd if filing through ROS).

**Invoice deadline:** VAT invoice must be issued within 15 days after the end of the month in which the supply takes place.

**VAT return calculation:**
```
T1: Total VAT on sales (outputs)
T2: Total VAT on allowable purchases (inputs)
T3: VAT payable to Revenue (T1 - T2, if positive)
T4: VAT refundable from Revenue (T2 - T1, if positive)
```

**Annual/half-yearly returns:** Revenue may allow low-turnover businesses to file less frequently.

---

## Disallowed VAT Input Credits

No VAT input credit is allowed for:
- Goods/services used for **non-business purposes** (e.g., computer bought for son's school)
- **Food, drink, or accommodation** for the business owner, agents, or employees (exception: accommodation for qualifying conferences)
- **Entertainment expenses** for the business owner, agents, or employees
- **Passenger cars** — purchase, hire, or lease (exception: car hire/taxi trade)
- **Petrol** (exception: stock-in-trade for fuel retailers). **Diesel IS allowed.**
- **Motor tax** — not a VAT-bearing expense (no VAT to reclaim)

---

## VAT Credit Clawback (6-Month Rule)

If VAT input credit is claimed on a purchase invoice but the supplier is **not paid within 6 months**, the VAT credit must be adjusted (clawed back) in the next VAT return. The credit can be re-claimed once payment is eventually made.

---

## Cash Receipts Basis

A business may elect to account for VAT on the cash receipts basis (VAT due when payment received, not when invoice issued) if:
- At least 90% of supplies (by value) are to unregistered persons, OR
- Total taxable supplies are less than €2 million in a 12-month period

**Key rules:**
- Output VAT is due in the period cash is received (not when invoice issued)
- Input credits are ALWAYS based on the date of the purchase invoice (even on cash basis)
- Not available for transactions between associated persons or property transactions
- Can be cancelled voluntarily or if conditions no longer met

---

## Special VAT Rules

**Cocktail/Package rule (multiple supplies):**
- Multiple supply (e.g., food hamper with items at different rates): apportion pre-VAT price across items, apply each rate separately
- Composite supply (e.g., TV with instruction book): apply the rate of the principal item to the whole supply

**Two-thirds rule (repairs involving parts):**
- If parts cost < 2/3 of total charge (excl VAT) → 13.5% applies to entire supply (deemed a service)
- If parts cost ≥ 2/3 of total charge (excl VAT) → 23% applies to entire supply (deemed goods)
- Parts cost = VAT-exclusive cost to the supplier (not the marked-up price)
- If deemed goods, supplier can itemise labour separately to apply 13.5% to the service portion

**Bad debts:** In the VAT period a debt is written off as irrecoverable, an input credit is allowed for the VAT element. The debt must be actually written off in the books.

**Self-supply:** If a taxable person takes goods from the business for personal use, or diverts goods from a taxable to an exempt business, VAT is due (treated as output).

**Gifts:** Business gifts of taxable goods are liable to VAT unless cost (excl VAT) is €20 or less. Advertising/promotional items given to trade customers for business use are exempt even if >€20 (e.g., branded display stands, glasses, beer mats).

**Intra-EU trade:** Goods and services imported/exported within the EU are exempt from VAT for registered VAT businesses.

**Unjust enrichment:** If a higher VAT rate is charged than the correct rate, the full VAT charged must be paid to Revenue — the trader cannot keep the difference.

---

## RCT and VAT (Construction)

**RCT Rates (based on tax compliance record):**

| Rate | Criteria |
|------|----------|
| 0% | Fully tax compliant with zero-rate authorization from Revenue |
| 20% (Standard) | Tax registered and compliant, without zero-rate authorization |
| 35% | Not tax registered or history of poor tax compliance |

**RCT as payment on account:** All RCT withheld by a principal contractor is treated as a payment on account against the subcontractor's final tax liabilities at year-end. Ensure all RCT deductions are accurately recorded and claimed on the annual tax return (Form 11 or CT1).

Subcontractors subject to RCT must still register for VAT but are **not obliged to charge VAT** on construction services (except haulage for hire) supplied to principal contractors. The principal contractor accounts for VAT via a **reverse charge** mechanism — treating it as if they supplied the service themselves. This is reflected in the VAT return by including the subcontractor's invoice amounts in both outputs and inputs.

---

## Valid VAT Invoice Requirements

A valid VAT invoice must contain:
1. Name and address of the taxable person issuing the invoice
2. VAT registration number
3. Date of issue
4. Full description of goods or services
5. Date of supply
6. Amount charged excluding VAT
7. Rate of VAT and amount of VAT at each rate
8. Name and address of customer
9. Unique invoice number

Input credits can only be claimed on foot of a valid VAT invoice.

---

## Mixed Supplies (Taxable + Exempt)

When a business makes both taxable and exempt supplies:
- **Full input credit** on purchases used exclusively for taxable supplies
- **No input credit** on purchases used exclusively for exempt supplies
- **Apportionment** required for shared costs — agree method with Revenue (commonly based on turnover ratio of taxable vs exempt supplies)

---

## Revenue Audit and Penalties

**Record retention:** 6 years, including all linking documents.

**Penalty scale for underpayment:**

| Category | No cooperation | Mitigation only | Prompted disclosure | Unprompted disclosure |
|----------|---------------|-----------------|--------------------|--------------------|
| Deliberate default | 100% | 75% | 50% | 10% |
| Gross carelessness | 40% | 30% | 20% | 5% |
| Insufficient care | 20% | 15% | 10% | 3% |

**Late payment interest:** 0.0219% per day (approx. 8% per annum) from due date to payment date.

**Prompted qualifying disclosure advantages:**
1. Reduced penalties
2. Name not published as tax defaulter
3. Revenue will not initiate prosecution
