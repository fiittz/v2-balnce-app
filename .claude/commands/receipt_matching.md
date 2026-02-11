# Receipt & Transaction Matching

Load this context when working on OCR receipt processing, receipt-to-transaction matching, CSV bank feed import, or bulk receipt upload.

---

## Key Files

| Purpose | File |
|---------|------|
| Receipt-to-Transaction Match | `src/lib/receiptMatcher.ts` |
| OCR Processing | `src/services/aiServices.ts` |
| Receipt Scanner Hook | `src/hooks/useReceiptScanner.ts` |
| CSV Import Dialog | `src/components/bank/CSVImportDialog.tsx` |
| Bulk Receipt Upload Page | `src/pages/BulkReceiptUpload.tsx` |
| Bulk Upload Context | `src/contexts/BackgroundTasksContext.tsx` |
| Bulk Upload Hook | `src/hooks/useBulkReceiptUpload.ts` |
| Auto-Categorization | `src/lib/autocat.ts` |
| Invoice/Expense Matching | `src/services/matchingServices.ts` |
| Trip Detection | `src/lib/tripDetection.ts` |

---

## OCR Receipt Extraction

**Service:** Supabase Edge Function (`process-receipt`)

**Extracted fields:**
- `supplier_name`, `date`, `invoice_number`, `total_amount`, `vat_amount`, `vat_rate`, `net_amount`, `payment_method`, `line_items[]`, `suggested_category`, `currency`, `confidence`, `raw_text`

**Confidence threshold:** Below 0.75 (75%) → warning toast, manual verification needed.

**Key functions:**
- `processReceipt(imageBase64, categories?)` — main OCR via Supabase function
- `processReceiptFromUrl(imageUrl, categories?)` — process from uploaded URL

---

## Receipt-to-Transaction Matching Algorithm

**Auto-match threshold:** `AUTO_MATCH_THRESHOLD = 0.95` (95%)

**Scoring (max 1.0):**

| Criterion | Points | Logic |
|-----------|--------|-------|
| Amount | 0.50 | Exact match within €0.005 |
| Vendor name | 0.30 | Full vendor in description, OR first word (≥3 chars) found |
| Date (same day) | 0.20 | Exact date match |
| Date (±1 day) | 0.15 | Within 1 day |

**Query strategy:**
1. Filter unlinked transactions (`receipt_url IS NULL`)
2. Date window: ±2 days from receipt date
3. Score each candidate, return highest

**Match result:**
```typescript
{ receiptId, transactionId, score, explanation, autoMatched }
```

**Linking updates:** Sets `receipts.transaction_id` and `transactions.receipt_url`, optionally upgrades `vat_amount`/`vat_rate` from receipt data.

---

## CSV Bank Feed Import

**6-step workflow:**

### 1. Upload & Parse
- Any CSV delimiter, handles Windows/Mac/Unix line endings
- Validates: headers + ≥1 data row

### 2. Bank Format Auto-Detection
- **AIB:** "Posted Transactions Date", "Description1", "Credit", "Debit"
- **Revolut:** "Completed Date"/"Started Date", "Description", "Amount"
- **BOI:** "Posting Date", "Narrative"
- **Generic:** Any CSV with Date, Description, Amount/Credit/Debit

### 3. Parse & Deduplicate
- Strips currency symbols (€$£), commas, spaces
- Parentheses as negative: `(100)` → -100
- Date formats tried: `dd/MM/yyyy`, `MM/dd/yyyy`, `yyyy-MM-dd`, `dd-MM-yyyy`, `d/M/yyyy`, `dd MMM yyyy`
- **Duplicate fingerprint:** `"${date}|${description.toLowerCase().trim()}|${amount.toFixed(2)}"`

### 4. Batch Import
- 10 transactions per batch (prevents UI freeze)
- `Promise.allSettled()` per batch
- Creates `import_batch` record

### 5. Auto-Categorization
- 5 transactions per batch via `autoCategorise()`
- Only applies if `confidence_score ≥ 50%`
- Sets: `category_id`, `account_id`, `vat_rate`, `notes`

### 6. Trip Detection
- Calls `detectTrips()` — if found, user reviews and confirms

---

## Bulk Receipt Upload

**Accepted:** JPG, PNG, WebP, HEIC — max 5MB per file

**Processing flow (sequential):**
```
queued → processing → done → matching → (matched | not_matched | error)
```

1. Upload to Supabase Storage (`/receipts/{userId}/{timestamp}-{filename}`)
2. Convert to base64, send to `processReceipt()`
3. Save receipt metadata to `receipts` table
4. After all OCR complete, iterate and auto-match each receipt
5. Score ≥ 0.95 → auto-link; below → "not_matched" for manual review

---

## Auto-Categorization Engine

**Input:** amount, date, currency, description, merchant_name, direction (income/expense), user_industry, user_business_type, optional receipt_text

**Output:** category, vat_type, vat_deductible, business_purpose, confidence_score (0-100), notes, needs_review, needs_receipt, is_business_expense

**Category mapping:** Uses `CATEGORY_NAME_MAP` to translate autocat names to DB category IDs via fuzzy matching on category type.

---

## Thresholds Summary

| Feature | Threshold | Behavior |
|---------|-----------|----------|
| OCR confidence | < 0.75 | Warning, manual verify |
| Auto-match score | ≥ 0.95 | Auto-link receipt to transaction |
| Auto-categorize | ≥ 50% | Only applies if confident enough |
| Receipt file size | > 5MB | Rejected |
| CSV import batch | 10 txns | Parallel processing per batch |
| Categorize batch | 5 txns | Sequential batches |
| Date match window | ±2 days | Query filter for candidates |
| Duplicate check | Fingerprint | date + description + amount |

---

## Data Flow

```
RECEIPT UPLOAD → Base64 → Supabase OCR → Extract fields → Save to DB
    → Match: query unlinked txns ±2 days → score (amount + vendor + date)
    → ≥0.95? auto-link : flag for manual review

CSV IMPORT → Parse → Detect bank format → Map columns → Deduplicate
    → Batch create (10/batch) → Auto-categorize (5/batch) → Trip detection
```
