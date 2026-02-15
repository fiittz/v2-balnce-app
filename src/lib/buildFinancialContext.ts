/**
 * Builds a plain-text financial summary from the user's data
 * to inject as context into the AI chat assistant.
 */

import type { CT1Data } from "@/hooks/useCT1Data";
import type { TrialBalanceResult } from "@/hooks/useTrialBalance";

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);

interface FinancialContextInput {
  businessName: string;
  businessType: string;
  taxYear: string;
  ct1: CT1Data;
  savedCT1: Record<string, unknown> | null;
  directorData: Record<string, unknown> | null;
  transactionCount: number;
  // New expanded fields
  profile?: Record<string, unknown> | null;
  onboardingSettings?: Record<string, unknown> | null;
  businessExtra?: Record<string, unknown> | null;
  allDirectorData?: Record<string, unknown>[];
  directorRows?: Record<string, unknown>[];
  allForm11Data?: { directorNumber: number; data: Record<string, unknown> }[];
  invoices?: Record<string, unknown>[];
  trialBalance?: TrialBalanceResult;
}

export function buildFinancialContext(input: FinancialContextInput): string {
  const {
    businessName, businessType, taxYear, ct1, savedCT1, directorData, transactionCount,
    profile, onboardingSettings, businessExtra, allDirectorData, directorRows, allForm11Data, invoices,
    trialBalance,
  } = input;

  const totalIncome = ct1.detectedIncome.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = ct1.expenseByCategory.reduce((s, e) => s + e.amount, 0);
  const motorVehicleAllowance = ct1.vehicleAsset
    ? ct1.vehicleAsset.depreciation.annualAllowance
    : (savedCT1?.capitalAllowancesMotorVehicles ?? 0);
  const capitalAllowancesTotal =
    (savedCT1?.capitalAllowancesPlant ?? 0) + motorVehicleAllowance;
  const tradingProfit = Math.max(0, totalIncome - ct1.expenseSummary.allowable - capitalAllowancesTotal - ct1.directorsLoanTravel);
  const lossesForward = savedCT1?.lossesForward ?? 0;
  const taxableProfit = Math.max(0, tradingProfit - lossesForward);
  const ctAt125 = taxableProfit * 0.125;
  const surcharge = savedCT1?.closeCompanySurcharge ?? 0;
  const totalCT = ctAt125 + surcharge;
  const prelimPaid = savedCT1?.preliminaryCTPaid ?? 0;
  const rctCredit = ct1.rctPrepayment;
  const balanceDue = totalCT - prelimPaid - rctCredit;

  const lines: string[] = [];

  // === COMPANY OVERVIEW ===
  const biz = businessExtra?.businesses?.[0];
  lines.push(`=== COMPANY OVERVIEW ===`);
  lines.push(`Company: ${businessName}`);
  lines.push(`Business Type: ${businessType}`);
  lines.push(`Tax Year: ${taxYear}`);
  lines.push(`Total Transactions Imported: ${transactionCount}`);
  if (biz?.structure) lines.push(`Structure: ${biz.structure === "limited_company" ? "Limited Company" : "Sole Trader"}`);
  if (biz?.cro_number) lines.push(`CRO Number: ${biz.cro_number}`);
  if (biz?.tax_reference) lines.push(`Revenue Tax Reference: ${biz.tax_reference}`);
  if (biz?.registered_address) lines.push(`Registered Address: ${biz.registered_address}`);
  if (biz?.accounting_year_end) lines.push(`Accounting Year End: ${biz.accounting_year_end}`);
  if (profile?.incorporation_date) lines.push(`Incorporation Date: ${profile.incorporation_date}`);
  if (profile?.email) lines.push(`Contact Email: ${profile.email}`);
  if (profile?.phone) lines.push(`Contact Phone: ${profile.phone}`);
  if (biz?.primary_activity) lines.push(`Primary Activity: ${biz.primary_activity}`);
  if (biz?.secondary_activities?.length > 0) lines.push(`Secondary Activities: ${biz.secondary_activities.join(", ")}`);
  if (biz?.has_company_secretary) lines.push(`Company Secretary: ${biz.company_secretary_name || "Yes"}`);
  if (onboardingSettings?.business_description) lines.push(`Business Description: ${onboardingSettings.business_description}`);
  // Industry category group — helps AI understand which chart of accounts template was seeded
  if (biz?.primary_activity || onboardingSettings?.business_type) {
    const activity = biz?.primary_activity || onboardingSettings?.business_type;
    const ACTIVITY_GROUPS: Record<string, string> = {
      carpentry_joinery: "construction", general_construction: "construction", electrical_contracting: "construction",
      plumbing_heating: "construction", bricklaying_masonry: "construction", plastering_drylining: "construction",
      painting_decorating: "construction", roofing: "construction", groundworks_civil: "construction",
      landscaping: "construction", tiling_stonework: "construction", steel_fabrication_welding: "construction",
      property_maintenance: "construction",
      software_development: "software_dev",
      it_services: "technology", web_design: "technology", digital_marketing: "technology", content_creation: "technology",
      cafe_restaurant: "hospitality", takeaway: "hospitality", catering: "hospitality", mobile_food: "hospitality",
      physical_retail: "retail", online_retail: "retail", market_stall: "retail", wholesale_distribution: "retail",
      haulage_hgv: "transport", courier_services: "transport", taxi_private_hire: "transport",
      delivery_services: "transport", plant_hire: "transport",
      beauty_wellness: "health", fitness_sports: "health", care_services: "health",
      property_development: "property", letting_property_management: "property", quantity_surveying: "property",
      manufacturing: "manufacturing", bespoke_fabrication: "manufacturing", food_production: "manufacturing",
      event_hosting: "events", event_management: "events",
    };
    const GROUP_LABELS: Record<string, string> = {
      construction: "Construction & Trades", technology: "Technology & IT Services", software_dev: "Software Development",
      hospitality: "Hospitality & Food", retail: "Retail & E-commerce", transport: "Transport & Logistics",
      health: "Health & Wellness", property: "Property & Development", manufacturing: "Manufacturing & Production",
      events: "Events & Hosting", professional: "Professional Services",
    };
    const group = ACTIVITY_GROUPS[activity as string] || "professional";
    lines.push(`Industry Category Group: ${GROUP_LABELS[group] || group} — expense/income categories are tailored for this industry`);
  }
  lines.push(``);

  // === VAT REGISTRATION ===
  const vatReg = onboardingSettings?.vat_registered ?? biz?.vat_registered;
  lines.push(`=== VAT REGISTRATION ===`);
  lines.push(`VAT Registered: ${vatReg ? "Yes" : "No"}`);
  if (vatReg) {
    const vatNum = onboardingSettings?.vat_number ?? biz?.vat_number;
    if (vatNum) lines.push(`VAT Number: ${vatNum}`);
    if (biz?.vat_registration_date) lines.push(`VAT Registration Date: ${biz.vat_registration_date}`);
    if (biz?.vat_basis) lines.push(`VAT Basis: ${biz.vat_basis}`);
  }
  if (biz?.vat_status_change_expected) {
    lines.push(`VAT Status Change Expected: Yes`);
    if (biz?.vat_change_date) lines.push(`VAT Change Date: ${biz.vat_change_date}`);
  }
  lines.push(``);

  // === RCT / SUBCONTRACTING ===
  const rctReg = onboardingSettings?.rct_registered ?? (biz?.rct_status && biz.rct_status !== "not_applicable");
  if (rctReg || ct1.isConstructionTrade) {
    lines.push(`=== RCT / SUBCONTRACTING ===`);
    lines.push(`Construction Trade: ${ct1.isConstructionTrade ? "Yes" : "No"}`);
    if (biz?.rct_status) lines.push(`RCT Status: ${biz.rct_status}`);
    if (biz?.rct_rate) lines.push(`RCT Deduction Rate: ${biz.rct_rate}%`);
    if (biz?.has_subcontractors) lines.push(`Has Subcontractors: Yes`);
    if (ct1.rctPrepayment > 0) lines.push(`RCT Deducted (current year): ${eur(ct1.rctPrepayment)}`);
    lines.push(``);
  }

  // === EMPLOYEES & PAYROLL ===
  if (biz?.has_employees) {
    lines.push(`=== EMPLOYEES & PAYROLL ===`);
    lines.push(`Has Employees: Yes`);
    if (biz.employee_count) lines.push(`Employee Count: ${biz.employee_count}`);
    if (biz.paye_registered) lines.push(`PAYE Registered: Yes`);
    if (biz.paye_number) lines.push(`PAYE Number: ${biz.paye_number}`);
    lines.push(``);
  }

  // === INCOME ===
  lines.push(`=== INCOME (from bank transactions) ===`);
  for (const item of ct1.detectedIncome) {
    lines.push(`  ${item.category}: ${eur(item.amount)}`);
  }
  lines.push(`  TOTAL INCOME: ${eur(totalIncome)}`);
  lines.push(``);

  // === EXPENSES ===
  lines.push(`=== EXPENSES (from bank transactions) ===`);
  for (const item of ct1.expenseByCategory) {
    lines.push(`  ${item.category}: ${eur(item.amount)}`);
  }
  lines.push(`  TOTAL EXPENSES: ${eur(totalExpenses)}`);
  lines.push(`  Allowable for CT1: ${eur(ct1.expenseSummary.allowable)}`);
  lines.push(`  Disallowed (entertainment etc.): ${eur(ct1.expenseSummary.disallowed)}`);
  lines.push(``);

  // === TRAVEL & ACCOMMODATION ===
  if (ct1.directorsLoanTravel > 0) {
    lines.push(`=== TRAVEL & ACCOMMODATION ===`);
    lines.push(`  Travel allowance (Revenue mileage + subsistence rates): ${eur(ct1.travelAllowance)}`);
    lines.push(`  Net owed to director (not yet reimbursed): ${eur(ct1.directorsLoanTravel)}`);
    lines.push(`  This is deductible from trading profit and appears as a Director's Loan on the Balance Sheet.`);
    if (biz?.place_of_work) lines.push(`  Normal place of work county: ${biz.place_of_work}`);
    if (biz?.workshop_address) lines.push(`  Workshop/office address: ${biz.workshop_address}`);
    if (biz?.subsistence_radius_km) lines.push(`  Subsistence radius: ${biz.subsistence_radius_km}km`);
    lines.push(``);
  }

  // === CAPITAL ALLOWANCES ===
  if (capitalAllowancesTotal > 0) {
    lines.push(`=== CAPITAL ALLOWANCES ===`);
    if ((savedCT1?.capitalAllowancesPlant ?? 0) > 0) {
      lines.push(`  Plant & Machinery: ${eur(savedCT1.capitalAllowancesPlant)}`);
    }
    if (motorVehicleAllowance > 0) {
      lines.push(`  Motor Vehicles: ${eur(motorVehicleAllowance)}`);
    }
    if (ct1.vehicleAsset) {
      lines.push(`  Vehicle: ${ct1.vehicleAsset.description} (${ct1.vehicleAsset.reg})`);
      lines.push(`  12.5% of ${eur(ct1.vehicleAsset.depreciation.qualifyingCost)} — Year ${ct1.vehicleAsset.depreciation.yearsOwned} of 8`);
      if (ct1.vehicleAsset.depreciation.businessUsePct < 100) {
        lines.push(`  Business use: ${ct1.vehicleAsset.depreciation.businessUsePct}%`);
      }
      lines.push(`  Net Book Value: ${eur(ct1.vehicleAsset.depreciation.netBookValue)}`);
    }
    lines.push(`  TOTAL CAPITAL ALLOWANCES: ${eur(capitalAllowancesTotal)}`);
    lines.push(``);
  }

  // === EXPENSE BEHAVIOUR ===
  if (biz?.has_home_office || biz?.mixed_use_spending) {
    lines.push(`=== EXPENSE BEHAVIOUR ===`);
    if (biz.has_home_office) {
      lines.push(`  Home Office: Yes (business use ${biz.business_use_percentage || 0}%)`);
    }
    if (biz.mixed_use_spending) lines.push(`  Mixed-use Spending: Yes`);
    if (biz.capitalisation_threshold) lines.push(`  Capitalisation Threshold: ${eur(biz.capitalisation_threshold)}`);
    lines.push(``);
  }

  // === CT1 COMPUTATION ===
  lines.push(`=== CT1 COMPUTATION ===`);
  lines.push(`  Total Income: ${eur(totalIncome)}`);
  lines.push(`  Less: Allowable Expenses: ${eur(ct1.expenseSummary.allowable)}`);
  if (ct1.directorsLoanTravel > 0) {
    lines.push(`  Less: Travel & Accommodation (owed to director): ${eur(ct1.directorsLoanTravel)}`);
  }
  if (capitalAllowancesTotal > 0) {
    lines.push(`  Less: Capital Allowances: ${eur(capitalAllowancesTotal)}`);
  }
  lines.push(`  Trading Profit: ${eur(tradingProfit)}`);
  if (lossesForward > 0) {
    lines.push(`  Less: Losses Brought Forward: ${eur(lossesForward)}`);
  }
  lines.push(`  Taxable Profit: ${eur(taxableProfit)}`);
  lines.push(`  CT @ 12.5%: ${eur(ctAt125)}`);
  if (surcharge > 0) {
    lines.push(`  Close Company Surcharge: ${eur(surcharge)}`);
  }
  lines.push(`  Total CT Liability: ${eur(totalCT)}`);
  if (rctCredit > 0) {
    lines.push(`  Less: RCT Credit: ${eur(rctCredit)}`);
  }
  if (prelimPaid > 0) {
    lines.push(`  Less: Preliminary CT Paid: ${eur(prelimPaid)}`);
  }
  lines.push(`  ${balanceDue <= 0 ? "REFUND DUE" : "BALANCE DUE"}: ${eur(Math.abs(balanceDue))}`);
  lines.push(``);

  // === VAT POSITION ===
  if (ct1.vatPosition) {
    lines.push(`=== VAT POSITION ===`);
    lines.push(`  ${ct1.vatPosition.type === "payable" ? "VAT Payable" : "VAT Refundable"}: ${eur(ct1.vatPosition.amount)}`);
    lines.push(``);
  }

  // === INVOICES ===
  if (invoices && invoices.length > 0) {
    lines.push(`=== INVOICES ===`);
    lines.push(`  Total Invoices: ${invoices.length}`);
    const paidInvoices = invoices.filter((inv: Record<string, unknown>) => inv.status === "paid");
    const unpaidInvoices = invoices.filter((inv: Record<string, unknown>) => inv.status !== "paid");
    const totalInvoiced = invoices.reduce((s: number, inv: Record<string, unknown>) => s + (Number(inv.total) || 0), 0);
    const totalVatOnInvoices = invoices.reduce((s: number, inv: Record<string, unknown>) => s + (Number(inv.vat_amount) || 0), 0);
    lines.push(`  Paid: ${paidInvoices.length}, Unpaid: ${unpaidInvoices.length}`);
    lines.push(`  Total Invoiced: ${eur(totalInvoiced)}`);
    lines.push(`  Total VAT on Invoices: ${eur(totalVatOnInvoices)}`);
    // Show recent invoices (last 10)
    const recent = invoices.slice(0, 10);
    for (const inv of recent) {
      const custName = (inv.customer as Record<string, unknown>)?.name || "Unknown";
      lines.push(`  ${inv.invoice_number || "?"} — ${custName} — ${inv.invoice_date || ""} — ${eur(Number(inv.total) || 0)} (${inv.status || "draft"})`);
    }
    if (invoices.length > 10) lines.push(`  ... and ${invoices.length - 10} more`);
    lines.push(``);
  }

  // === FLAGGED CAPITAL ITEMS ===
  if (ct1.flaggedCapitalItems.length > 0) {
    lines.push(`=== FLAGGED CAPITAL ITEMS (≥€1,000 or capital expenditure) ===`);
    for (const item of ct1.flaggedCapitalItems) {
      lines.push(`  ${item.description} — ${item.date} — ${eur(item.amount)}`);
    }
    lines.push(``);
  }

  // === OPENING BALANCES ===
  if (biz?.has_opening_balances) {
    lines.push(`=== OPENING BALANCES ===`);
    if (biz.opening_bank_balance) lines.push(`  Bank Balance: ${eur(biz.opening_bank_balance)}`);
    if (biz.opening_debtors) lines.push(`  Debtors: ${eur(biz.opening_debtors)}`);
    if (biz.opening_creditors) lines.push(`  Creditors: ${eur(biz.opening_creditors)}`);
    if (biz.opening_vat_liability) lines.push(`  VAT Liability: ${eur(biz.opening_vat_liability)}`);
    lines.push(``);
  }

  // === LOANS & FINANCE ===
  if (biz?.has_loans) {
    lines.push(`=== LOANS & FINANCE ===`);
    if (biz.loan_type) lines.push(`  Loan Type: ${biz.loan_type}`);
    if (biz.loan_start_date) lines.push(`  Loan Start Date: ${biz.loan_start_date}`);
    if (biz.directors_loan_movements) lines.push(`  Director's Loan Movements: Yes`);
    lines.push(``);
  }

  // === DIRECTORS (all) ===
  const directors = allDirectorData?.length ? allDirectorData : (directorData ? [directorData] : []);
  if (directors.length > 0) {
    lines.push(`=== DIRECTORS ===`);
    lines.push(`  Number of Directors: ${directors.length}`);
    for (let i = 0; i < directors.length; i++) {
      const d = directors[i];
      const dbRow = directorRows?.[i] as Record<string, unknown> | undefined;
      lines.push(`  --- Director ${i + 1} ---`);
      if (d.first_name || d.director_name || dbRow?.director_name) {
        lines.push(`  Name: ${d.director_name || dbRow?.director_name || `${d.first_name || ""} ${d.last_name || ""}`.trim()}`);
      }
      if (d.pps_number || dbRow?.pps_number) lines.push(`  PPS: ${d.pps_number || dbRow?.pps_number}`);
      if (d.date_of_birth || dbRow?.date_of_birth) lines.push(`  Date of Birth: ${d.date_of_birth || dbRow?.date_of_birth}`);
      if (d.marital_status || dbRow?.marital_status) lines.push(`  Marital Status: ${d.marital_status || dbRow?.marital_status}`);
      if (d.assessment_basis || dbRow?.assessment_basis) lines.push(`  Assessment Basis: ${d.assessment_basis || dbRow?.assessment_basis}`);
      if (d.salary || d.annual_salary || dbRow?.annual_salary) lines.push(`  Salary: ${eur(Number(d.salary || d.annual_salary || dbRow?.annual_salary) || 0)}`);
      if (d.salary_frequency) lines.push(`  Salary Frequency: ${d.salary_frequency}`);
      if (d.receives_dividends || dbRow?.receives_dividends) {
        lines.push(`  Receives Dividends: Yes`);
        if (d.estimated_dividends || dbRow?.estimated_dividends) lines.push(`  Estimated Dividends: ${eur(Number(d.estimated_dividends || dbRow?.estimated_dividends) || 0)}`);
      }
      if (d.home_address) lines.push(`  Home Address: ${d.home_address}`);
      if (d.home_county) lines.push(`  Home County: ${d.home_county}`);
      if (d.workshop_address) lines.push(`  Normal Place of Work: ${d.workshop_address}`);
      if (d.commute_distance_km) lines.push(`  Commute: ${d.commute_distance_km}km (${d.commute_method || "unknown"})`);
      if (d.employment_start_date) lines.push(`  Employment Start Date: ${d.employment_start_date}`);
      // Vehicle
      if (d.vehicle_owned_by_director) {
        lines.push(`  Vehicle Owned by Director: Yes`);
        if (d.vehicle_description) lines.push(`  Vehicle: ${d.vehicle_description} (${d.vehicle_reg || ""})`);
        if (d.vehicle_purchase_cost) lines.push(`  Vehicle Purchase Cost: ${eur(Number(d.vehicle_purchase_cost) || 0)}`);
        if (d.vehicle_date_acquired) lines.push(`  Vehicle Date Acquired: ${d.vehicle_date_acquired}`);
        if (d.vehicle_business_use_pct) lines.push(`  Vehicle Business Use: ${d.vehicle_business_use_pct}%`);
      }
      // BIK
      if (d.has_bik) {
        lines.push(`  Benefits in Kind: ${(d.bik_types || []).join(", ")}`);
        if (d.company_vehicle_value) lines.push(`  Company Vehicle OMV: ${eur(Number(d.company_vehicle_value) || 0)}`);
        if (d.company_vehicle_business_km) lines.push(`  Company Vehicle Business KM: ${d.company_vehicle_business_km}`);
      }
      // Income sources
      if (d.income_sources?.length > 0) lines.push(`  Income Sources: ${d.income_sources.join(", ")}`);
      // Reliefs
      if (d.reliefs?.length > 0) lines.push(`  Tax Reliefs Claimed: ${d.reliefs.join(", ")}`);
      // Foreign
      if (d.foreign_cgt_options?.length > 0 && !d.foreign_cgt_options.includes("none")) {
        lines.push(`  Foreign/CGT: ${d.foreign_cgt_options.join(", ")}`);
      }
      if (d.foreign_bank_accounts) lines.push(`  Foreign Bank Accounts: Yes`);
      if (d.foreign_property) lines.push(`  Foreign Property: Yes`);
      if (d.crypto_holdings) lines.push(`  Crypto Holdings: Yes`);
      // Dependents & credits
      if (d.has_dependent_children) lines.push(`  Dependent Children: ${d.dependent_children_count || "Yes"}`);
      if (d.home_carer_credit) lines.push(`  Home Carer Credit: Yes`);
      if (d.flat_rate_expenses) lines.push(`  Flat Rate Expenses: Yes`);
      if (d.remote_working_relief) lines.push(`  Remote Working Relief: Yes`);
      if (d.charitable_donations) lines.push(`  Charitable Donations: Yes`);
      if (d.pays_preliminary_tax) lines.push(`  Pays Preliminary Tax: ${d.pays_preliminary_tax}`);
    }
    lines.push(``);
  }

  // === FORM 11 QUESTIONNAIRE DATA ===
  if (allForm11Data && allForm11Data.length > 0) {
    lines.push(`=== FORM 11 QUESTIONNAIRE DATA ===`);
    for (const form of allForm11Data) {
      const f = form.data;
      lines.push(`  --- Director ${form.directorNumber} Form 11 ---`);
      if (f.otherEmploymentIncome) lines.push(`  Other Employment Income: ${eur(Number(f.otherEmploymentIncome) || 0)}`);
      if (f.rentalIncome) lines.push(`  Rental Income: ${eur(Number(f.rentalIncome) || 0)}`);
      if (f.foreignIncome) lines.push(`  Foreign Income: ${eur(Number(f.foreignIncome) || 0)}`);
      if (f.pensionContributions) lines.push(`  Pension Contributions: ${eur(Number(f.pensionContributions) || 0)}`);
      if (f.medicalExpenses) lines.push(`  Medical Expenses: ${eur(Number(f.medicalExpenses) || 0)}`);
      if (f.tuitionFees) lines.push(`  Tuition Fees: ${eur(Number(f.tuitionFees) || 0)}`);
      if (f.healthInsurancePremium) lines.push(`  Health Insurance Premium: ${eur(Number(f.healthInsurancePremium) || 0)}`);
      if (f.mortgageInterest) lines.push(`  Mortgage Interest: ${eur(Number(f.mortgageInterest) || 0)}`);
      if (f.rentPaid) lines.push(`  Rent Paid: ${eur(Number(f.rentPaid) || 0)}`);
      if (f.capitalGains) lines.push(`  Capital Gains: ${eur(Number(f.capitalGains) || 0)}`);
      if (f.preliminaryTaxPaid) lines.push(`  Preliminary Tax Paid: ${eur(Number(f.preliminaryTaxPaid) || 0)}`);
    }
    lines.push(``);
  }

  // === CT1 QUESTIONNAIRE EXTRA FIELDS ===
  if (savedCT1) {
    const extraFields: string[] = [];
    if (savedCT1.fixedAssetsLandBuildings) extraFields.push(`Fixed Assets - Land & Buildings: ${eur(savedCT1.fixedAssetsLandBuildings)}`);
    if (savedCT1.fixedAssetsPlantMachinery) extraFields.push(`Fixed Assets - Plant & Machinery: ${eur(savedCT1.fixedAssetsPlantMachinery)}`);
    if (savedCT1.fixedAssetsMotorVehicles) extraFields.push(`Fixed Assets - Motor Vehicles: ${eur(savedCT1.fixedAssetsMotorVehicles)}`);
    if (savedCT1.fixedAssetsFixturesFittings) extraFields.push(`Fixed Assets - Fixtures & Fittings: ${eur(savedCT1.fixedAssetsFixturesFittings)}`);
    if (savedCT1.currentAssetsStock) extraFields.push(`Stock: ${eur(savedCT1.currentAssetsStock)}`);
    if (savedCT1.wipValue) extraFields.push(`Work in Progress: ${eur(savedCT1.wipValue)}`);
    if (savedCT1.currentAssetsDebtors || savedCT1.tradeDebtorsTotal) extraFields.push(`Debtors: ${eur(savedCT1.currentAssetsDebtors || savedCT1.tradeDebtorsTotal)}`);
    if (savedCT1.currentAssetsBankBalance) extraFields.push(`Bank Balance (questionnaire): ${eur(savedCT1.currentAssetsBankBalance)}`);
    if (savedCT1.liabilitiesCreditors || savedCT1.tradeCreditorsTotal) extraFields.push(`Creditors: ${eur(savedCT1.liabilitiesCreditors || savedCT1.tradeCreditorsTotal)}`);
    if (savedCT1.prepaymentsAmount) extraFields.push(`Prepayments: ${eur(savedCT1.prepaymentsAmount)}`);
    if (savedCT1.directorsCurrentAccountBalance) extraFields.push(`Director's Current Account: ${eur(savedCT1.directorsCurrentAccountBalance)}`);
    if (savedCT1.shareCapitalIssued) extraFields.push(`Share Capital Issued: ${eur(savedCT1.shareCapitalIssued)}`);
    if (savedCT1.retainedProfitsBroughtForward) extraFields.push(`Retained Profits B/F: ${eur(savedCT1.retainedProfitsBroughtForward)}`);
    if (extraFields.length > 0) {
      lines.push(`=== BALANCE SHEET (from CT1 questionnaire) ===`);
      for (const f of extraFields) lines.push(`  ${f}`);
      lines.push(``);
    }
  }

  // === TRIAL BALANCE STATUS ===
  if (trialBalance && !trialBalance.isLoading && trialBalance.accounts.length > 0) {
    lines.push(`=== TRIAL BALANCE STATUS ===`);
    lines.push(`  Total Debits: ${eur(trialBalance.totalDebits)}`);
    lines.push(`  Total Credits: ${eur(trialBalance.totalCredits)}`);
    lines.push(`  Balanced: ${trialBalance.isBalanced ? "Yes" : `NO — off by ${eur(Math.abs(trialBalance.imbalanceAmount))}`}`);
    if (trialBalance.orphanedTransactions > 0) {
      lines.push(`  Uncategorized Transactions: ${trialBalance.orphanedTransactions} (${eur(trialBalance.uncategorizedAmount)})`);
    }
    if (trialBalance.issues.length > 0) {
      lines.push(`  Issues: ${trialBalance.issues.length}`);
      for (const issue of trialBalance.issues) {
        lines.push(`    - [${issue.severity}] ${issue.title}: ${issue.description}`);
      }
    }
    // Top 10 accounts by balance size
    const sorted = [...trialBalance.accounts]
      .map(a => ({ ...a, balance: Math.abs(a.debit - a.credit) }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);
    lines.push(`  Top accounts by balance:`);
    for (const a of sorted) {
      const bal = a.debit - a.credit;
      lines.push(`    ${a.accountName} (${a.accountType}): ${bal >= 0 ? "Dr" : "Cr"} ${eur(Math.abs(bal))}`);
    }
    lines.push(``);
  }

  // === EU & INTERNATIONAL TRADE ===
  if (onboardingSettings?.eu_trade_enabled) {
    lines.push(`=== EU & INTERNATIONAL TRADE ===`);
    lines.push(`  EU/International Trade: Enabled`);
    const tradeTypes: string[] = [];
    if (onboardingSettings.sells_goods_to_eu) tradeTypes.push("Sells goods to EU (ICS — zero-rated, VIES required)");
    if (onboardingSettings.buys_goods_from_eu) tradeTypes.push("Buys goods from EU (ICA — self-accounting T1/T2)");
    if (onboardingSettings.sells_services_to_eu) tradeTypes.push("Sells services to EU B2B (reverse charge ES1)");
    if (onboardingSettings.buys_services_from_eu) tradeTypes.push("Buys services from EU B2B (reverse charge ES2)");
    if (onboardingSettings.sells_digital_services_b2c) tradeTypes.push("Sells digital services B2C to EU (OSS may apply)");
    if (onboardingSettings.sells_to_non_eu) tradeTypes.push("Exports to non-EU (zero-rated E2)");
    if (onboardingSettings.buys_from_non_eu) tradeTypes.push("Imports from non-EU (import VAT / postponed accounting)");
    for (const t of tradeTypes) lines.push(`  ${t}`);
    if (onboardingSettings.uses_postponed_accounting) lines.push(`  Postponed Accounting (PA1): Active`);
    if (onboardingSettings.has_section_56_authorisation) lines.push(`  Section 56 Authorisation: Active`);
    lines.push(``);
  }

  // === TAX PLANNING OPPORTUNITIES ===
  lines.push(`=== TAX PLANNING OPPORTUNITIES ===`);
  lines.push(`Based on the user's data, here are reliefs/deductions they may be entitled to. When asked about reducing tax, cite these SPECIFIC opportunities with amounts:`);

  // Start-up relief (first 3 years)
  const incorpDate = profile?.incorporation_date;
  if (incorpDate) {
    const incorpYear = new Date(incorpDate).getFullYear();
    const currentYear = Number(taxYear);
    const yearsTrading = currentYear - incorpYear;
    if (yearsTrading <= 3) {
      lines.push(`  ✓ START-UP COMPANY RELIEF: Company incorporated ${incorpDate} — year ${yearsTrading} of 3. CT relief up to employer PRSI paid (max €40,000/year). If CT < €40k, could be fully exempt.`);
    } else {
      lines.push(`  ✗ Start-up relief: Not eligible (incorporated ${incorpDate}, more than 3 years ago).`);
    }
  }

  // Capital allowances
  if (capitalAllowancesTotal > 0) {
    lines.push(`  ✓ CAPITAL ALLOWANCES: Already claiming ${eur(capitalAllowancesTotal)} (12.5% wear & tear).`);
  } else {
    lines.push(`  ? CAPITAL ALLOWANCES: No capital allowances claimed. If the company owns tools, equipment, vans, or vehicles, 12.5% annual write-off applies.`);
  }

  // Small Benefit Exemption
  const hasEmployees = biz?.has_employees || directors.length > 0;
  if (hasEmployees) {
    lines.push(`  ✓ SMALL BENEFIT EXEMPTION: Can give up to 5 non-cash vouchers per director/employee per year, combined max €1,500 — tax-free for recipient, deductible for company.`);
  }

  // Pension contributions
  const anyPension = allForm11Data?.some(f => Number(f.data?.pensionContributions) > 0);
  if (anyPension) {
    lines.push(`  ✓ PENSION CONTRIBUTIONS: Director is contributing to a pension — deductible from personal income.`);
  } else {
    lines.push(`  ? PENSION CONTRIBUTIONS: No pension contributions detected. Employer pension contributions are 100% deductible for the company with no age-based limits. This is one of the most effective ways for a director to extract value tax-efficiently.`);
  }

  // Mileage / travel
  if (ct1.directorsLoanTravel > 0) {
    lines.push(`  ✓ MILEAGE & SUBSISTENCE: Claiming ${eur(ct1.travelAllowance)} at Revenue civil service rates.`);
  } else {
    const anyCommute = directors.some(d => d.commute_distance_km > 0);
    if (anyCommute) {
      lines.push(`  ? MILEAGE: Director has a commute but no travel claims detected. Revenue mileage rates apply for business travel in personal vehicle.`);
    }
  }

  // Losses forward
  if (lossesForward > 0) {
    lines.push(`  ✓ LOSS RELIEF: Carrying forward ${eur(lossesForward)} in trading losses against future profits.`);
  }

  // RCT credit
  if (rctCredit > 0) {
    lines.push(`  ✓ RCT CREDIT: ${eur(rctCredit)} deducted at source — offsets CT liability.`);
  }

  // Rent credit
  const anyRentPaid = allForm11Data?.some(f => Number(f.data?.rentPaid) > 0);
  if (anyRentPaid) {
    lines.push(`  ✓ RENT TAX CREDIT: Director pays rent — entitled to €1,000 credit (single) or €2,000 (jointly assessed).`);
  }

  // Medical expenses
  const anyMedical = allForm11Data?.some(f => Number(f.data?.medicalExpenses) > 0);
  if (anyMedical) {
    lines.push(`  ✓ MEDICAL EXPENSES: Director has medical expenses — 20% tax relief on qualifying expenses.`);
  }

  // Home office
  if (biz?.has_home_office) {
    lines.push(`  ✓ HOME OFFICE: Claiming ${biz.business_use_percentage || 0}% of home expenses (heat, light, broadband).`);
  }

  // R&D credit
  lines.push(`  ? R&D TAX CREDIT: If the company does any qualifying research or development, 35% tax credit applies (from 2026). Worth investigating.`);

  // KDB
  lines.push(`  ? KNOWLEDGE DEVELOPMENT BOX: If company earns income from qualifying IP (patents, software), 10% CT rate instead of 12.5%.`);

  lines.push(``);

  // === DATA SOURCES ===
  lines.push(`=== DATA SOURCES ===`);
  lines.push(`All figures above come from the user's imported bank CSV transactions, invoices stored in Supabase, director onboarding data, business onboarding questionnaires, CT1 questionnaire, Form 11 questionnaire, and the Irish tax rules engine. This is private financial data that no general AI model has access to.`);

  return lines.join("\n");
}
