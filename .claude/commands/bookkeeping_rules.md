# Bookkeeping Rules (Double Entry)

Load this context when working on transaction categorization, journal entries, bank reconciliation, or any bookkeeping task.

---

## DEAD CLIC Rule

Every transaction has two entries. Use DEAD CLIC to determine debit vs credit:

| Type | Debit when... | Credit when... |
|------|--------------|----------------|
| **D**ebit expenses | Increase | Decrease |
| **E**xpenses | Increase | Decrease |
| **A**ssets | Increase | Decrease |
| **D**rawings | Increase | Decrease |
| **C**redits | Decrease | Increase |
| **L**iabilities | Decrease | Increase |
| **I**ncome | Decrease | Increase |
| **C**apital | Decrease | Increase |

---

## Books of Prime Entry

| Book | Records | Debit | Credit |
|------|---------|-------|--------|
| Sales Day Book | Credit sales invoices | Trade Receivables | Sales + VAT |
| Purchases Day Book | Credit purchase invoices | Purchases + VAT | Trade Payables |
| Sales Returns Day Book | Credit notes to customers | Sales Returns + VAT | Trade Receivables |
| Purchases Returns Day Book | Credit notes from suppliers | Trade Payables | Purchases Returns + VAT |
| Cash Book (receipts) | Money in | Bank | Various (Sales/Receivables/Capital) |
| Cash Book (payments) | Money out | Various (Purchases/Payables/Expenses) | Bank |
| Petty Cash Book | Small cash expenses | Expenses + VAT | Petty Cash |

---

## Cash Book VAT Rule

When recording payments received from trade receivables (debtors) or payments made to trade payables (creditors), **do not analyse VAT again** in the cash book. VAT was already captured when the original invoice was recorded in the day book. The cash book entry is simply:
- DR Bank / CR Trade Receivables (payment received)
- DR Trade Payables / CR Bank (payment made)

VAT analysis in the cash book applies **only** to direct cash transactions (not settlements of existing invoices).

---

## Discount Types

| Discount | When | Bookkeeping Treatment |
|----------|------|----------------------|
| **Trade discount** | Given to trade customers (e.g., 20% off list price) | Deduct BEFORE recording — never appears in accounts |
| **Bulk/quantity discount** | Volume-based price reduction | Deduct BEFORE recording — never appears in accounts |
| **Prompt payment discount** | Early payment incentive (e.g., 2% if paid within 14 days) | Record at FULL price initially; book discount only when taken |

**Prompt payment discount entries (when taken):**
- Discount allowed (to customer): DR Discounts Allowed / CR Trade Receivables
- Discount received (from supplier): DR Trade Payables / CR Discounts Received

---

## Capital vs Revenue Expenditure

| Test | Capital | Revenue |
|------|---------|---------|
| **Purpose** | Acquire/enhance asset | Day-to-day running costs |
| **Useful life** | >1 year | Consumed within period |
| **Threshold** | Above user's capitalisation limit | Below threshold |
| **Examples** | Vehicles, machinery, building improvements | Repairs, fuel, materials, wages |
| **Accounting** | Statement of Financial Position (Balance Sheet) | Statement of Profit or Loss (P&L) |

**Capital income** = disposal of non-current assets (sale of van, equipment, etc.)
**Revenue income** = trading income (sales, fees, rental income)

---

## Ledger Structure

```
General Ledger (nominal accounts)
├── Assets (Bank, Trade Receivables control, Equipment, etc.)
├── Liabilities (Trade Payables control, VAT, Loans)
├── Capital (Owner's equity, Drawings)
├── Income (Sales, Discounts Received)
└── Expenses (Purchases, Wages, Rent, Motor, Discounts Allowed)

Subsidiary Ledgers (individual accounts)
├── Sales Ledger → individual customer accounts (supports Trade Receivables control)
└── Purchases Ledger → individual supplier accounts (supports Trade Payables control)
```

**Control account rule:** The total of all individual balances in a subsidiary ledger must equal the control account balance in the general ledger.

---

## Petty Cash (Imprest System)

- Fixed float (e.g., €200) set at start of period
- Expenses paid from float, each with a voucher
- At period end, reimburse exact amount spent to restore float
- Imprest amount = opening balance = closing balance after reimbursement
- All petty cash expenses require receipts/vouchers

---

## Trial Balance

- List all general ledger account balances
- Total debits MUST equal total credits
- If they don't balance → locate error (transposition, omission, single entry, etc.)
- Trial balance does NOT prove all entries are correct (compensating errors, errors of commission, errors of principle, errors of original entry can still exist)
