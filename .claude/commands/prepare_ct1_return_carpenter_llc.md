# Prepare CT1 Return - Carpenter LLC

## Overview

This command serves as the single source of truth for the CT1 preparation process for an Irish Limited Liability Company (LLC) specializing in Carpentry and Joinery. It automates the calculation of Taxable Profit by applying Irish corporate tax rules, with a specialized focus on identifying and correctly treating trade-specific expenses and capital assets. CRITICALLY, it implements a Capitalisation Policy to ensure consistency in distinguishing between revenue expenditure (expensed immediately) and capital expenditure (depreciated via Capital Allowances).

## Purpose & Value

### Workflow Being Automated

The manual process of converting accounting profit into taxable profit for the Irish Corporation Tax (CT1) return. This includes correctly applying the company's Capitalisation Policy to ensure small asset purchases are correctly expensed, maximizing immediate tax relief, while larger assets are capitalized and claimed via Capital Allowances.

### Time/Effort Savings

- **Efficiency**: Automates the tax computation, focusing on maximizing deductions specific to the carpentry trade.
- **Error Reduction**: Minimizes errors in applying the correct Capital Allowance rates and ensures the consistent application of the Capitalisation Policy.
- **Consistency**: Ensures a consistent and defensible calculation of taxable profit for Revenue Commissioners, tailored for a niche construction trade.

### Target Users

- **Irish Carpenter/Joiner LLC Owners/Directors**: To understand their estimated tax liability and ensure all trade-specific deductions are claimed.
- **Accountants/Tax Professionals**: To generate the final figures and supporting schedules for the CT1 form.
- **CT1 Agent (AI)**: The core operational procedure for Corporation Tax preparation for this specific trade.

## Command Invocation

### Command Name

```
/prepare_ct1_return_carpenter_llc
```

### Parameters

- `financial_data_file`: Path to the company's Profit & Loss (P&L) and Balance Sheet data (CSV/Excel). **Required.**
- `fixed_asset_register_file`: Path to the company's fixed asset register (CSV/Excel) detailing asset cost, purchase date, and type. **Required.**
- `accounting_period_end_date`: The end date of the accounting period (YYYY-MM-DD). **Required.**
- `capitalisation_threshold`: The monetary threshold (€) above which an asset must be capitalized. **Default: 750.**
- `--is_trading_income`: Flag to confirm the income is trading income (taxed at 12.5%). **Defaults to true.**

### Usage Examples

```bash
# Prepare CT1 using the default €750 capitalisation threshold
/prepare_ct1_return_carpenter_llc /home/client/P&L_2024.csv /home/client/Assets_2024.csv 2024-12-31

# Prepare CT1 using a custom €1000 capitalisation threshold
/prepare_ct1_return_carpenter_llc /home/client/P&L_2023.csv /home/client/Assets_2023.csv 2023-12-31 1000
```

## Procedural Requirements

### Prerequisites

- **Required Tools**: Data processing engine (e.g., Python/Pandas) for file ingestion and calculation.
- **Required Files**: Both `financial_data_file` and `fixed_asset_register_file` must be accessible.
- **Configuration**: Access to current Irish corporate tax rates (12.5% trading, 25% non-trading) and Capital Allowance rules.

### Step-by-Step Workflow

---

#### Step 1: Data Ingestion and Initial Profit Calculation

**Purpose**: Load financial data and establish the starting point for the tax computation.

**Actions**:
1. Read `financial_data_file` and extract the Profit Before Tax (PBT) figure.
2. Read `fixed_asset_register_file` and categorize assets.
3. **LLC Specific**: If `--is_trading_income` is false, the agent MUST prompt the user to separate trading income (12.5%) from non-trading income (25%).

**Validation**:
- Ensure PBT is a valid numeric figure.

---

#### Step 2: Apply Capitalisation Policy and Adjust Expenses

**Purpose**: Ensure consistency by applying the `capitalisation_threshold` to all purchases.

**Actions**:

1. **Review Expensed Items (P&L)**: Scan the `financial_data_file` for any purchases that were treated as an expense but exceed the `capitalisation_threshold`.
   - **Adjustment**: If found, these items MUST be added back to PBT (as they should have been capitalized) and flagged for inclusion in the Capital Allowance calculation (Step 3).

2. **Review Capitalised Items (Asset Register)**: Scan the `fixed_asset_register_file` for any assets that are below the `capitalisation_threshold`.
   - **Adjustment**: These items MUST be removed from the Capital Allowance calculation (Step 3) and flagged as items that should have been expensed (i.e., the accounting depreciation should be removed, and the full cost should be allowed as a revenue expense).

**Validation**:
- Ensure all adjustments are clearly itemized in a new "Capitalisation Policy Adjustments" schedule.

---

#### Step 3: Add-Back of Non-Allowable Expenses

**Purpose**: Adjust accounting profit by adding back expenses that are not deductible for tax purposes.

**Actions**:

1. **Identify and Add Back Depreciation**: Extract the total depreciation charge from the P&L and add it back to PBT.

2. **Identify and Add Back Non-Allowable Expenses**: Scan the P&L for specific non-allowable expenses:
   - Business entertainment expenses
   - Fines and penalties
   - Non-allowable legal fees
   - Non-deductible VAT

3. **Trade-Specific Review (Allowable Expenses)**: Ensure the following common carpentry/joinery expenses are NOT added back:
   - Timber
   - Consumables
   - Workshop rent
   - Small tools/protective clothing below the threshold

**Validation**:
- Ensure the total of add-backs is clearly itemized.

---

#### Step 4: Calculation of Capital Allowances (Tax Deductions)

**Purpose**: Calculate the tax-deductible allowances for fixed assets, only including items above the threshold.

**Actions**:

1. **Determine Qualifying Assets**: Use the adjusted asset list from Step 2 (only assets above the threshold).

2. **Plant and Machinery (Standard)**: Calculate the Wear and Tear Allowance at **12.5% per annum over 8 years** on the cost of qualifying assets. This includes:
   - Workshop Machinery
   - Power Tools
   - Commercial Vehicles

3. **Accelerated Capital Allowances (ACA)**: Identify energy-efficient equipment and calculate the ACA at **100% in the year of purchase**.

4. **Industrial Buildings Allowance (IBA)**: Calculate IBA at **4% per annum over 25 years** for qualifying workshop buildings.

5. **Total Capital Allowances**: Sum all calculated allowances.

**Validation**:
- Verify that the total Capital Allowances do not exceed the cost of the asset.

---

#### Step 5: Final Taxable Profit Calculation and Tax Rate Application

**Purpose**: Determine the final figure to be entered on the CT1 form and apply the correct tax rate(s).

**Actions**:

1. **Adjusted Profit**: Take the PBT (Step 1) + Total Add-Backs (Step 3) + Capitalisation Policy Adjustments (Step 2).

2. **Taxable Profit**: Adjusted Profit - Total Capital Allowances (Step 4).

3. **Tax Calculation (LLC Specific)**:
   - If `--is_trading_income` is true, calculate tax at the standard **12.5% rate**.
   - If non-trading income is present, calculate tax on that portion at the **25% rate**.

**Validation**:
- Ensure the final Taxable Profit is clearly separated from the Accounting Profit.

---

#### Step 6: Generate CT1 Preparation Report

**Purpose**: Present the findings and final figures to the user in a structured report.

**Actions**:

1. Create a summary table of the tax computation.
2. Generate a detailed schedule of Capital Allowances.
3. Write a brief narrative explaining the adjustments and any outstanding compliance issues.

**Output Format**:

```markdown
# Irish Carpenter/Joiner LLC CT1 Preparation Report - [Accounting Period End Date]

## 1. Taxable Profit Computation (CT1 Schedule)

| Description | Amount (€) | CT1 Line Item |
| :--- | :--- | :--- |
| **Profit Before Tax (PBT)** | [PBT Figure] | Starting Point |
| **ADD: Capitalisation Policy Adjustments** | [Total Cap Policy Adjustments] | Adjustment (Step 2) |
| **ADD: Other Non-Allowable Expenses** | [Total Other Add-Backs] | Adjustment (Step 3) |
| **SUBTRACT: Total Capital Allowances** | ([Total Allowances]) | Deduction (Step 4) |
| **TAXABLE PROFIT** | **[Final Taxable Profit]** | **CT1 Filing Figure** |
| **Estimated Corporation Tax (12.5% / 25%)** | [Tax Liability] | **LLC Tax Rate Applied** |

## 2. Capitalisation Policy Review (Threshold: €[capitalisation_threshold])

| Item | Amount (€) | Accounting Treatment | Required Tax Treatment | Adjustment |
| :--- | :--- | :--- | :--- | :--- |
| [Example Expensed Item] | [Amount] | Expensed | Capitalised | Add Back |
| [Example Capitalised Item] | [Amount] | Capitalised | Expensed | Remove from CA |

## 3. Capital Allowances Schedule (Trade-Specific Assets)

[Detailed table listing each asset, cost, purchase date, rate, and allowance claimed for the period. **Focus on Workshop Machinery and Tools**.]

## 4. Actionable Recommendations (Irish LLC Compliance)

1. **Preliminary Tax:** Confirm the Preliminary Tax payment is calculated and submitted by the due date (9 months after period end).
2. **iXBRL:** Ensure the final financial statements are tagged in **iXBRL format** for submission with the CT1 form, a mandatory requirement for Irish companies.
3. **Capitalisation Policy:** Review the adjustments made in Section 2 to ensure they align with the company's internal accounting policy.

**Disclaimer:** This is AI-generated information and should not be considered professional tax advice. Consult a licensed tax professional for final guidance.
```

## File Structure & Paths

### Files Created

```
/home/client/
├── P&L_2024.csv
├── Assets_2024.csv
└── Irish_Carpenter_CT1_Preparation_Report_[YYYYMMDD].md  <-- This report file is created
```

## Validation & Testing

### Success Criteria

- [ ] The command executes without error.
- [ ] The `Irish_Carpenter_CT1_Preparation_Report_[YYYYMMDD].md` file is created.
- [ ] The report contains a clear, itemized reconciliation from PBT to Taxable Profit, including the Capitalisation Policy adjustments.
- [ ] The tax calculation correctly applies the 12.5% trading rate (or 25% if specified).
- [ ] Capital Allowances are calculated using the correct Irish rates (12.5% for P&M, 100% for ACA), with a focus on carpentry assets.

## Integration Notes

### Related Commands

- `/file_ct1_return`: The next step for submitting the calculated figures via ROS (Revenue Online Service).
- `/analyze_rct_vat`: A related command to ensure all construction-related VAT/RCT is correctly handled before the P&L is finalized.

## References

- [2] Datatracks. The Ultimate Handbook on Corporate Tax Submission in Ireland.
- [3] NAD Accounting Services. Form CT1 Explained: Corporation Tax Filing for Irish Companies.
- [6] Commenda. A Guide to Corporate Taxes in Ireland.
- [7] Revenue.ie. Capital allowances and deductions.
- [9] SEAI. Accelerated Capital Allowance | Business Grants.
- [10] Accounts Advice Centre. CORPORATION TAX – ACCELERATED CAPITAL ALLOWANCES.
- [11] Chartered Accountants Ireland. No 39 of 1997, Section 284, Revenue Tax Briefing.
- [12] Revenue.ie. Claiming a deduction for expenses.
- [13] Revenue.ie. Flat Rate Expense (FRE) allowances.
