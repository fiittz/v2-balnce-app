# Check Bookkeeping Accuracy

## Overview
Analyze the most recently imported CSV bank feed batch against the Chart of Accounts and Irish tax rules to produce a bookkeeping accuracy report. This command validates categorizations, VAT treatment, account mappings, confidence scores, and flags items needing review.

## Purpose & Value

### Workflow Being Automated
After importing a CSV bank feed, the auto-categorization engine assigns categories, VAT rates, and nominal accounts. This command audits that output to measure accuracy, catch errors before filing, and identify transactions requiring manual review.

### Target Users
- Business owners reviewing their automated bookkeeping
- Accountants performing quality checks before year-end or VAT return

## Command Invocation

```
/check_bookkeeping_accuracy
```

No parameters required. The command automatically targets the latest import batch.

## Procedural Requirements

### Prerequisites
- At least one CSV import batch must exist in the database
- The user must be authenticated (Supabase session active)
- Chart of Accounts must be initialized for the user

### Step-by-Step Workflow

#### Step 1: Identify the Latest Import Batch

**Purpose**: Find the most recent CSV import to analyze.

**Actions**:
1. Query `import_batches` table ordered by `imported_at DESC`, limit 1, filtered by current `user_id`
2. Retrieve: `id`, `filename`, `transaction_count`, `imported_at`
3. Display to user:
   ```
   Analyzing batch: [filename]
   Imported: [date]
   Transactions: [count]
   ```

**Validation**:
- If no import batches exist, stop and inform the user: "No import batches found. Import a CSV bank feed first."

**Error Handling**:
- If query fails, report the Supabase error and suggest checking authentication

---

#### Step 2: Fetch All Transactions in the Batch

**Purpose**: Load every transaction from the target batch for analysis.

**Actions**:
1. Query `transactions` where `import_batch_id` = batch ID and `user_id` = current user
2. Join with `categories` (on `category_id`) and `accounts` (on `account_id`) to get names and types
3. Collect all fields: `id`, `description`, `amount`, `type`, `category_id`, `account_id`, `vat_rate`, `vat_amount`, `net_amount`, `ai_categorized`, `ai_confidence`, `ai_explanation`, `needs_review`, `is_duplicate`, `is_reconciled`, `transaction_date`

**Validation**:
- If transaction count from query doesn't match `import_batches.transaction_count`, note the discrepancy in the report

---

#### Step 3: Run Accuracy Checks

**Purpose**: Evaluate each transaction against six validation dimensions.

**Actions**:

Run ALL of the following checks on every transaction:

##### Check 1: Categorization Completeness
- Count transactions where `category_id IS NULL`
- Flag each as **Uncategorized** with description and amount
- Calculate: `categorized_pct = (categorized / total) * 100`

##### Check 2: Account Mapping Completeness
- Count transactions where `account_id IS NULL`
- Flag each as **Unmapped to Chart of Accounts**
- Cross-check: if `category_id` is set but `account_id` is NULL, flag as **Category-Account Mismatch** (category assigned but no nominal account linked)
- Calculate: `mapped_pct = (mapped / total) * 100`

##### Check 3: VAT Rate Validation
- For each categorized transaction, check VAT rate against Irish VAT rules:
  - **Income transactions**: VAT rate should match the account type (e.g., "Sales Ireland 23%" = standard_23)
  - **Expense transactions**: Apply Section 60(2) disallowed credit rules:
    - Food/drink/entertainment categories should have `vat_deductible = false`
    - Petrol should NOT have deductible VAT (diesel IS allowed)
    - Passenger motor vehicles should NOT have deductible VAT
  - **Zero-rated/Exempt**: Verify categories like exports, EU B2B, children's clothing, food staples have correct zero/exempt rate
- Flag mismatches as **VAT Rate Error** with expected vs. actual rate
- Calculate: `vat_correct_pct = (correct_vat / categorized_total) * 100`

##### Check 4: Confidence Score Analysis
- Bucket transactions by AI confidence:
  - **High confidence** (>= 85): Likely correct
  - **Medium confidence** (50-84): May need review
  - **Low confidence** (< 50): Likely needs manual review
  - **No score**: Not AI-categorized (manual or missing)
- Flag all transactions with `needs_review = true`
- Calculate: `avg_confidence` and `high_confidence_pct`

##### Check 5: Duplicate Detection
- Count transactions where `is_duplicate = true` or `duplicate_of_id IS NOT NULL`
- List duplicates with their matched pair descriptions and amounts
- Flag any duplicates that were NOT skipped during import

##### Check 6: Category-Type Consistency
- Verify `type` field (income/expense) matches the category type:
  - Income categories should only be on `type = 'income'` transactions
  - Expense/COGS categories should only be on `type = 'expense'` transactions
- Flag mismatches as **Type Mismatch** (e.g., expense category on an income transaction)

---

#### Step 4: Generate Accuracy Report

**Purpose**: Produce a structured console summary with all findings.

**Output Format**:

```
=======================================================
  BOOKKEEPING ACCURACY REPORT
  Batch: [filename]
  Date: [import date]  |  Transactions: [count]
=======================================================

OVERALL ACCURACY SCORE: [weighted_score]%

-------------------------------------------------------
1. CATEGORIZATION COMPLETENESS
-------------------------------------------------------
   Categorized:    [n] / [total]  ([pct]%)
   Uncategorized:  [n]

   [If uncategorized items exist, list first 10:]
   - [date] | [description] | [amount]
   - ...

-------------------------------------------------------
2. CHART OF ACCOUNTS MAPPING
-------------------------------------------------------
   Mapped:         [n] / [total]  ([pct]%)
   Unmapped:       [n]
   Mismatches:     [n]  (category set, no account)

   [If unmapped items exist, list first 10:]
   - [date] | [description] | [amount] | Category: [name]
   - ...

-------------------------------------------------------
3. VAT COMPLIANCE
-------------------------------------------------------
   Correct VAT:    [n] / [categorized]  ([pct]%)
   VAT Errors:     [n]

   [If VAT errors exist, list first 10:]
   - [description] | Applied: [rate] | Expected: [rate] | Issue: [reason]
   - ...

-------------------------------------------------------
4. AI CONFIDENCE BREAKDOWN
-------------------------------------------------------
   High (>=85):    [n]  ([pct]%)
   Medium (50-84): [n]  ([pct]%)
   Low (<50):      [n]  ([pct]%)
   No score:       [n]  ([pct]%)

   Average confidence: [avg]%
   Items flagged for review: [n]

-------------------------------------------------------
5. DUPLICATES
-------------------------------------------------------
   Duplicates found:  [n]

   [If duplicates exist, list:]
   - [description] | [amount] | Duplicate of: [other_description]
   - ...

-------------------------------------------------------
6. TYPE CONSISTENCY
-------------------------------------------------------
   Correct type:   [n] / [categorized]  ([pct]%)
   Mismatches:     [n]

   [If mismatches exist, list first 10:]
   - [description] | Type: [type] | Category: [name] (expects [expected_type])
   - ...

=======================================================
  OVERALL ACCURACY SCORE CALCULATION
=======================================================
  Categorization completeness:  [pct]%  (weight: 25%)
  Account mapping:              [pct]%  (weight: 20%)
  VAT compliance:               [pct]%  (weight: 25%)
  AI confidence (high+medium):  [pct]%  (weight: 15%)
  No duplicates:                [pct]%  (weight: 5%)
  Type consistency:             [pct]%  (weight: 10%)
  ─────────────────────────────────────────────────
  WEIGHTED TOTAL:               [score]%

=======================================================
  RECOMMENDATIONS
=======================================================
  [Dynamic recommendations based on findings:]
  - "Review [n] uncategorized transactions in the bank feed"
  - "Fix [n] VAT rate errors before next VAT return"
  - "[n] low-confidence items need manual verification"
  - "No issues found - bookkeeping looks accurate!"
=======================================================
```

---

#### Step 5: Provide Actionable Next Steps

**Purpose**: Guide the user on what to do with the findings.

**Actions**:
1. If score >= 95%: "Bookkeeping is in excellent shape. Minor items flagged above."
2. If score 80-94%: "Good accuracy. Address the flagged items to improve reliability."
3. If score 60-79%: "Several issues need attention. Review uncategorized and VAT errors first."
4. If score < 60%: "Significant accuracy issues. Consider re-importing with updated vendor list or reviewing category rules."

**Additional suggestions**:
- If many uncategorized: "Consider updating your vendor CSV with missing vendors"
- If VAT errors: "Review Irish VAT rules in Settings > Business Profile"
- If low confidence: "Adding receipts via OCR will improve categorization accuracy"

---

## Technical Implementation Notes

### Data Sources
- **Primary**: `transactions` table joined with `categories` and `accounts`
- **Batch identification**: `import_batches` table
- **VAT rules reference**: `/src/lib/irishVatRules.ts`
- **Category mapping reference**: `/src/lib/accountMapping.ts`
- **Auto-categorization logic**: `/src/lib/autocat.ts`

### Weighted Score Formula
```
score = (categorized_pct * 0.25) +
        (mapped_pct * 0.20) +
        (vat_correct_pct * 0.25) +
        (high_medium_confidence_pct * 0.15) +
        (non_duplicate_pct * 0.05) +
        (type_consistent_pct * 0.10)
```

### Query Pattern
All queries MUST include `user_id` filter (RLS enforcement):
```sql
SELECT t.*, c.name as category_name, c.type as category_type,
       a.name as account_name, a.type as account_type, a.code as account_code
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN accounts a ON t.account_id = a.id
WHERE t.import_batch_id = [batch_id]
  AND t.user_id = [current_user_id]
ORDER BY t.transaction_date, t.description
```

### Irish VAT Validation Rules (Quick Reference)
| Category Pattern | Expected VAT | Deductible? |
|---|---|---|
| Materials, Tools, Equipment | standard_23 | Yes |
| Diesel / Motor fuel | standard_23 | Yes |
| Petrol | standard_23 | **No** (Section 60) |
| Food & drink | reduced_9 or standard_23 | **No** (Section 60) |
| Entertainment | standard_23 | **No** (Section 60) |
| Passenger vehicle purchase | standard_23 | **No** (Section 60) |
| Construction labour | reduced_13_5 | Yes |
| Software & SaaS | standard_23 | Yes |
| Insurance | exempt | N/A |
| Bank charges | exempt | N/A |
| EU B2B purchases | reverse_charge | Self-account |
| Exports | zero_rated | N/A |

## Validation & Testing

### Success Criteria
- [ ] Latest import batch correctly identified
- [ ] All six accuracy checks run without errors
- [ ] Weighted score calculated correctly
- [ ] Flagged items display with useful context (date, description, amount)
- [ ] Recommendations are dynamic based on actual findings
- [ ] Report is readable and well-formatted in terminal

## Integration Notes

### Related Commands
- `/prepare_ct1_return_carpenter_llc`: Run accuracy check BEFORE preparing CT1 to catch errors
- `/create_agent_command`: Use to create additional validation commands
