# Claude Code Commands

This directory contains custom Claude Code commands for automating workflows.

## Available Commands

### Domain Knowledge (activate when needed)
- [irish_tax_rules.md](./irish_tax_rules.md) - Quick-reference tax rates and deadlines
- [ct1_reliefs.md](./ct1_reliefs.md) - Company-level reliefs, allowances, and surcharges for CT1
- [form11_reliefs.md](./form11_reliefs.md) - Individual-level credits, reliefs, and allowances for Form 11/12
- [bookkeeping_rules.md](./bookkeeping_rules.md) - DEAD CLIC, double entry, books of prime entry, discounts, ledger structure, petty cash, trial balance
- [vat_compliance.md](./vat_compliance.md) - VAT rates, registration, returns, disallowed credits, cash receipts, special rules, RCT, invoices, penalties
- [carpenter_trade_profile.md](./carpenter_trade_profile.md) - Carpenter-specific VAT, two-thirds rule, RCT, input credits, capitalisation, capital allowances, chart of accounts
- [categorization_rules.md](./categorization_rules.md) - Vendor matching, receipt validation, OCR processing, capitalisation policy
- [receipt_matching.md](./receipt_matching.md) - OCR processing, receipt-to-transaction matching, CSV import, bulk upload

### Workflows
- [prepare_form11_return.md](./prepare_form11_return.md) - Prepare Form 11 Income Tax return for directors and sole traders
- [prepare_ct1_return_carpenter_llc.md](./prepare_ct1_return_carpenter_llc.md) - Prepare Irish CT1 Corporation Tax return for Carpentry/Joinery LLC
- [check_bookkeeping_accuracy.md](./check_bookkeeping_accuracy.md) - Analyze latest CSV import batch for categorization accuracy and VAT compliance
- [create_agent_command.md](./create_agent_command.md) - Collaboratively discover, define, and create new Claude Code commands

## Usage

Invoke any command by typing `/command-name` in Claude Code. For example:
- `/irish_tax_rules` - Load Irish tax rates and deadlines context
- `/vat_compliance` - Load VAT rules context
- `/check_bookkeeping_accuracy` - Run accuracy report on latest import
- `/prepare_ct1_return_carpenter_llc` - Prepare CT1 return

## Adding New Commands

When creating new commands, use `/create_agent_command` to ensure they follow the established patterns and are properly documented.
