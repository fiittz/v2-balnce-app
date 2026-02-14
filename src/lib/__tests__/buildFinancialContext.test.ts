import { describe, it, expect } from "vitest";
import { buildFinancialContext } from "../buildFinancialContext";

// ══════════════════════════════════════════════════════════════
// Helper: build a minimal FinancialContextInput with defaults
// ══════════════════════════════════════════════════════════════
function makeInput(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    businessName: "Test Co Ltd",
    businessType: "Carpentry",
    taxYear: "2025",
    ct1: {
      detectedIncome: [{ category: "Sales", amount: 100000 }],
      expenseByCategory: [{ category: "Materials", amount: 30000 }],
      expenseSummary: { allowable: 30000, disallowed: 2000, total: 32000 },
      vehicleAsset: null,
      directorsLoanTravel: 0,
      travelAllowance: 0,
      rctPrepayment: 0,
      isConstructionTrade: false,
      vatPosition: null,
      flaggedCapitalItems: [],
    },
    savedCT1: null,
    directorData: null,
    transactionCount: 50,
    ...overrides,
  };
}

// EUR formatter matching the source module (en-IE locale)
const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);

// ══════════════════════════════════════════════════════════════
// 1. Basic output — company name, business type, tax year
// ══════════════════════════════════════════════════════════════
describe("basic company overview", () => {
  it("contains company name", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("Company: Test Co Ltd");
  });

  it("contains business type", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("Business Type: Carpentry");
  });

  it("contains tax year", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("Tax Year: 2025");
  });

  it("contains transaction count", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("Total Transactions Imported: 50");
  });

  it("shows CRO number when businessExtra provides it", () => {
    const result = buildFinancialContext(
      makeInput({ businessExtra: { businesses: [{ cro_number: "654321" }] } })
    );
    expect(result).toContain("CRO Number: 654321");
  });

  it("shows structure as Limited Company when structure is limited_company", () => {
    const result = buildFinancialContext(
      makeInput({ businessExtra: { businesses: [{ structure: "limited_company" }] } })
    );
    expect(result).toContain("Structure: Limited Company");
  });

  it("shows incorporation date when profile provides it", () => {
    const result = buildFinancialContext(
      makeInput({ profile: { incorporation_date: "2023-01-15" } })
    );
    expect(result).toContain("Incorporation Date: 2023-01-15");
  });

  it("shows contact email from profile", () => {
    const result = buildFinancialContext(
      makeInput({ profile: { email: "info@testco.ie" } })
    );
    expect(result).toContain("Contact Email: info@testco.ie");
  });
});

// ══════════════════════════════════════════════════════════════
// 2. Income section — lists all detected income categories
// ══════════════════════════════════════════════════════════════
describe("income section", () => {
  it("lists each income category with EUR amount", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("=== INCOME (from bank transactions) ===");
    expect(result).toContain(`Sales: ${eur(100000)}`);
  });

  it("lists multiple income categories", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: {
          ...makeInput().ct1,
          detectedIncome: [
            { category: "Sales", amount: 80000 },
            { category: "Other Income", amount: 5000 },
          ],
        },
      })
    );
    expect(result).toContain(`Sales: ${eur(80000)}`);
    expect(result).toContain(`Other Income: ${eur(5000)}`);
    expect(result).toContain(`TOTAL INCOME: ${eur(85000)}`);
  });

  it("shows total income summed from all categories", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain(`TOTAL INCOME: ${eur(100000)}`);
  });
});

// ══════════════════════════════════════════════════════════════
// 3. Expense section — categories, allowable vs disallowed
// ══════════════════════════════════════════════════════════════
describe("expense section", () => {
  it("lists expense categories with EUR amounts", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("=== EXPENSES (from bank transactions) ===");
    expect(result).toContain(`Materials: ${eur(30000)}`);
  });

  it("shows total expenses", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain(`TOTAL EXPENSES: ${eur(30000)}`);
  });

  it("shows allowable expenses", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain(`Allowable for CT1: ${eur(30000)}`);
  });

  it("shows disallowed expenses", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain(`Disallowed (entertainment etc.): ${eur(2000)}`);
  });

  it("handles multiple expense categories", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: {
          ...makeInput().ct1,
          expenseByCategory: [
            { category: "Materials", amount: 20000 },
            { category: "Insurance", amount: 5000 },
            { category: "Phone", amount: 1200 },
          ],
        },
      })
    );
    expect(result).toContain(`Materials: ${eur(20000)}`);
    expect(result).toContain(`Insurance: ${eur(5000)}`);
    expect(result).toContain(`Phone: ${eur(1200)}`);
    expect(result).toContain(`TOTAL EXPENSES: ${eur(26200)}`);
  });
});

// ══════════════════════════════════════════════════════════════
// 4. CT1 computation — correct calculation chain
// ══════════════════════════════════════════════════════════════
describe("CT1 computation section", () => {
  it("shows the CT1 computation header", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("=== CT1 COMPUTATION ===");
  });

  it("shows total income in computation", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain(`Total Income: ${eur(100000)}`);
  });

  it("shows allowable expenses deduction", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain(`Less: Allowable Expenses: ${eur(30000)}`);
  });

  it("calculates trading profit correctly (income - allowable expenses)", () => {
    // 100,000 - 30,000 = 70,000
    const result = buildFinancialContext(makeInput());
    expect(result).toContain(`Trading Profit: ${eur(70000)}`);
  });

  it("calculates taxable profit correctly (same as trading when no losses)", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain(`Taxable Profit: ${eur(70000)}`);
  });

  it("calculates CT at 12.5% correctly", () => {
    // 70,000 * 0.125 = 8,750
    const result = buildFinancialContext(makeInput());
    expect(result).toContain(`CT @ 12.5%: ${eur(8750)}`);
  });

  it("shows total CT liability", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain(`Total CT Liability: ${eur(8750)}`);
  });

  it("deducts losses brought forward", () => {
    const result = buildFinancialContext(
      makeInput({ savedCT1: { lossesForward: 20000 } })
    );
    expect(result).toContain(`Less: Losses Brought Forward: ${eur(20000)}`);
    // Trading profit = 70,000; Taxable = 70,000 - 20,000 = 50,000
    expect(result).toContain(`Taxable Profit: ${eur(50000)}`);
    // CT = 50,000 * 0.125 = 6,250
    expect(result).toContain(`CT @ 12.5%: ${eur(6250)}`);
  });

  it("includes close company surcharge when present", () => {
    const result = buildFinancialContext(
      makeInput({ savedCT1: { closeCompanySurcharge: 3000 } })
    );
    expect(result).toContain(`Close Company Surcharge: ${eur(3000)}`);
    // Total CT = 8,750 + 3,000 = 11,750
    expect(result).toContain(`Total CT Liability: ${eur(11750)}`);
  });

  it("deducts preliminary CT paid", () => {
    const result = buildFinancialContext(
      makeInput({ savedCT1: { preliminaryCTPaid: 5000 } })
    );
    expect(result).toContain(`Less: Preliminary CT Paid: ${eur(5000)}`);
  });

  it("deducts RCT credit from CT liability in computation", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: { ...makeInput().ct1, rctPrepayment: 2000 },
      })
    );
    expect(result).toContain(`Less: RCT Credit: ${eur(2000)}`);
  });

  it("deducts capital allowances from trading profit", () => {
    const result = buildFinancialContext(
      makeInput({ savedCT1: { capitalAllowancesPlant: 5000 } })
    );
    expect(result).toContain(`Less: Capital Allowances: ${eur(5000)}`);
    // Trading profit = 100,000 - 30,000 - 5,000 = 65,000
    expect(result).toContain(`Trading Profit: ${eur(65000)}`);
  });

  it("deducts travel from trading profit when directorsLoanTravel > 0", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: { ...makeInput().ct1, directorsLoanTravel: 4000, travelAllowance: 4000 },
      })
    );
    expect(result).toContain(`Less: Travel & Accommodation (owed to director): ${eur(4000)}`);
    // Trading profit = 100,000 - 30,000 - 4,000 = 66,000
    expect(result).toContain(`Trading Profit: ${eur(66000)}`);
  });

  it("trading profit floors at zero when expenses exceed income", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: {
          ...makeInput().ct1,
          detectedIncome: [{ category: "Sales", amount: 10000 }],
          expenseSummary: { allowable: 50000, disallowed: 0, total: 50000 },
        },
      })
    );
    expect(result).toContain(`Trading Profit: ${eur(0)}`);
  });

  it("taxable profit floors at zero when losses exceed trading profit", () => {
    const result = buildFinancialContext(
      makeInput({ savedCT1: { lossesForward: 999999 } })
    );
    expect(result).toContain(`Taxable Profit: ${eur(0)}`);
    expect(result).toContain(`CT @ 12.5%: ${eur(0)}`);
  });
});

// ══════════════════════════════════════════════════════════════
// 5. VAT registration section
// ══════════════════════════════════════════════════════════════
describe("VAT registration section", () => {
  it("always shows VAT registration section", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("=== VAT REGISTRATION ===");
  });

  it("shows VAT Registered: No when not registered", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("VAT Registered: No");
  });

  it("shows VAT Registered: Yes when onboardingSettings has vat_registered true", () => {
    const result = buildFinancialContext(
      makeInput({ onboardingSettings: { vat_registered: true, vat_number: "IE123456" } })
    );
    expect(result).toContain("VAT Registered: Yes");
    expect(result).toContain("VAT Number: IE123456");
  });

  it("shows VAT Registered: Yes when biz has vat_registered true", () => {
    const result = buildFinancialContext(
      makeInput({
        businessExtra: {
          businesses: [{
            vat_registered: true,
            vat_number: "IE999888",
            vat_registration_date: "2023-01-01",
            vat_basis: "Invoice",
          }],
        },
      })
    );
    expect(result).toContain("VAT Registered: Yes");
    expect(result).toContain("VAT Number: IE999888");
    expect(result).toContain("VAT Registration Date: 2023-01-01");
    expect(result).toContain("VAT Basis: Invoice");
  });

  it("shows VAT status change when expected", () => {
    const result = buildFinancialContext(
      makeInput({
        businessExtra: {
          businesses: [{
            vat_status_change_expected: true,
            vat_change_date: "2025-06-01",
          }],
        },
      })
    );
    expect(result).toContain("VAT Status Change Expected: Yes");
    expect(result).toContain("VAT Change Date: 2025-06-01");
  });
});

// ══════════════════════════════════════════════════════════════
// 6. RCT section — appears when isConstructionTrade is true
// ══════════════════════════════════════════════════════════════
describe("RCT / subcontracting section", () => {
  it("does not appear when not a construction trade and not RCT registered", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== RCT / SUBCONTRACTING ===");
  });

  it("appears when isConstructionTrade is true", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: { ...makeInput().ct1, isConstructionTrade: true },
      })
    );
    expect(result).toContain("=== RCT / SUBCONTRACTING ===");
    expect(result).toContain("Construction Trade: Yes");
  });

  it("appears when onboardingSettings has rct_registered true", () => {
    const result = buildFinancialContext(
      makeInput({
        onboardingSettings: { rct_registered: true },
      })
    );
    expect(result).toContain("=== RCT / SUBCONTRACTING ===");
  });

  it("appears when biz has rct_status that is not not_applicable", () => {
    const result = buildFinancialContext(
      makeInput({
        businessExtra: {
          businesses: [{ rct_status: "active", rct_rate: 20 }],
        },
      })
    );
    expect(result).toContain("=== RCT / SUBCONTRACTING ===");
    expect(result).toContain("RCT Status: active");
    expect(result).toContain("RCT Deduction Rate: 20%");
  });

  it("shows RCT prepayment amount when > 0", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: { ...makeInput().ct1, isConstructionTrade: true, rctPrepayment: 8500 },
      })
    );
    expect(result).toContain(`RCT Deducted (current year): ${eur(8500)}`);
  });

  it("shows subcontractors flag when present", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: { ...makeInput().ct1, isConstructionTrade: true },
        businessExtra: { businesses: [{ has_subcontractors: true }] },
      })
    );
    expect(result).toContain("Has Subcontractors: Yes");
  });
});

// ══════════════════════════════════════════════════════════════
// 7. Capital allowances section
// ══════════════════════════════════════════════════════════════
describe("capital allowances section", () => {
  it("does not appear when capitalAllowancesTotal is 0", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== CAPITAL ALLOWANCES ===");
  });

  it("appears when plant allowances exist", () => {
    const result = buildFinancialContext(
      makeInput({ savedCT1: { capitalAllowancesPlant: 4000 } })
    );
    expect(result).toContain("=== CAPITAL ALLOWANCES ===");
    expect(result).toContain(`Plant & Machinery: ${eur(4000)}`);
    expect(result).toContain(`TOTAL CAPITAL ALLOWANCES: ${eur(4000)}`);
  });

  it("appears when motor vehicle allowances exist from savedCT1", () => {
    const result = buildFinancialContext(
      makeInput({ savedCT1: { capitalAllowancesMotorVehicles: 3000 } })
    );
    expect(result).toContain("=== CAPITAL ALLOWANCES ===");
    expect(result).toContain(`Motor Vehicles: ${eur(3000)}`);
    expect(result).toContain(`TOTAL CAPITAL ALLOWANCES: ${eur(3000)}`);
  });

  it("sums plant and motor vehicle allowances", () => {
    const result = buildFinancialContext(
      makeInput({
        savedCT1: {
          capitalAllowancesPlant: 4000,
          capitalAllowancesMotorVehicles: 2500,
        },
      })
    );
    expect(result).toContain(`Plant & Machinery: ${eur(4000)}`);
    expect(result).toContain(`Motor Vehicles: ${eur(2500)}`);
    expect(result).toContain(`TOTAL CAPITAL ALLOWANCES: ${eur(6500)}`);
  });
});

// ══════════════════════════════════════════════════════════════
// 8. Vehicle asset details
// ══════════════════════════════════════════════════════════════
describe("vehicle asset details", () => {
  const vehicleAsset = {
    description: "Ford Transit",
    reg: "241-D-54321",
    depreciation: {
      annualAllowance: 2500,
      qualifyingCost: 20000,
      yearsOwned: 2,
      businessUsePct: 80,
      netBookValue: 15000,
    },
  };

  it("shows vehicle description and registration", () => {
    const result = buildFinancialContext(
      makeInput({ ct1: { ...makeInput().ct1, vehicleAsset } })
    );
    expect(result).toContain("Vehicle: Ford Transit (241-D-54321)");
  });

  it("shows qualifying cost and year of ownership", () => {
    const result = buildFinancialContext(
      makeInput({ ct1: { ...makeInput().ct1, vehicleAsset } })
    );
    expect(result).toContain(`12.5% of ${eur(20000)} — Year 2 of 8`);
  });

  it("shows business use percentage when less than 100%", () => {
    const result = buildFinancialContext(
      makeInput({ ct1: { ...makeInput().ct1, vehicleAsset } })
    );
    expect(result).toContain("Business use: 80%");
  });

  it("does not show business use when it is 100%", () => {
    const veh100 = {
      ...vehicleAsset,
      depreciation: { ...vehicleAsset.depreciation, businessUsePct: 100 },
    };
    const result = buildFinancialContext(
      makeInput({ ct1: { ...makeInput().ct1, vehicleAsset: veh100 } })
    );
    expect(result).not.toContain("Business use:");
  });

  it("shows net book value", () => {
    const result = buildFinancialContext(
      makeInput({ ct1: { ...makeInput().ct1, vehicleAsset } })
    );
    expect(result).toContain(`Net Book Value: ${eur(15000)}`);
  });

  it("uses vehicleAsset annual allowance for motor vehicle capital allowance total", () => {
    const result = buildFinancialContext(
      makeInput({ ct1: { ...makeInput().ct1, vehicleAsset } })
    );
    expect(result).toContain(`Motor Vehicles: ${eur(2500)}`);
    expect(result).toContain(`TOTAL CAPITAL ALLOWANCES: ${eur(2500)}`);
  });
});

// ══════════════════════════════════════════════════════════════
// 9. Directors section
// ══════════════════════════════════════════════════════════════
describe("directors section", () => {
  it("does not appear when no directors", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== DIRECTORS ===");
  });

  it("shows single director from directorData", () => {
    const result = buildFinancialContext(
      makeInput({
        directorData: {
          director_name: "John Murphy",
          pps_number: "1234567T",
          salary: 50000,
        },
      })
    );
    expect(result).toContain("=== DIRECTORS ===");
    expect(result).toContain("Number of Directors: 1");
    expect(result).toContain("Name: John Murphy");
    expect(result).toContain("PPS: 1234567T");
    expect(result).toContain(`Salary: ${eur(50000)}`);
  });

  it("shows multiple directors from allDirectorData", () => {
    const result = buildFinancialContext(
      makeInput({
        allDirectorData: [
          { director_name: "John Murphy", salary: 50000 },
          { director_name: "Mary Murphy", salary: 40000 },
        ],
      })
    );
    expect(result).toContain("Number of Directors: 2");
    expect(result).toContain("--- Director 1 ---");
    expect(result).toContain("Name: John Murphy");
    expect(result).toContain("--- Director 2 ---");
    expect(result).toContain("Name: Mary Murphy");
  });

  it("prefers allDirectorData over directorData", () => {
    const result = buildFinancialContext(
      makeInput({
        directorData: { director_name: "Should Not Appear" },
        allDirectorData: [{ director_name: "Preferred Director" }],
      })
    );
    expect(result).toContain("Name: Preferred Director");
    expect(result).not.toContain("Should Not Appear");
  });

  it("shows director marital status", () => {
    const result = buildFinancialContext(
      makeInput({
        directorData: { director_name: "John", marital_status: "Married" },
      })
    );
    expect(result).toContain("Marital Status: Married");
  });

  it("shows director dividends info", () => {
    const result = buildFinancialContext(
      makeInput({
        directorData: {
          director_name: "John",
          receives_dividends: true,
          estimated_dividends: 10000,
        },
      })
    );
    expect(result).toContain("Receives Dividends: Yes");
    expect(result).toContain(`Estimated Dividends: ${eur(10000)}`);
  });

  it("shows director vehicle details when owned by director", () => {
    const result = buildFinancialContext(
      makeInput({
        directorData: {
          director_name: "John",
          vehicle_owned_by_director: true,
          vehicle_description: "BMW 320d",
          vehicle_reg: "231-D-99999",
          vehicle_purchase_cost: 35000,
          vehicle_business_use_pct: 70,
        },
      })
    );
    expect(result).toContain("Vehicle Owned by Director: Yes");
    expect(result).toContain("Vehicle: BMW 320d (231-D-99999)");
    expect(result).toContain(`Vehicle Purchase Cost: ${eur(35000)}`);
    expect(result).toContain("Vehicle Business Use: 70%");
  });

  it("shows BIK details when has_bik is true", () => {
    const result = buildFinancialContext(
      makeInput({
        directorData: {
          director_name: "John",
          has_bik: true,
          bik_types: ["company_car", "health_insurance"],
          company_vehicle_value: 45000,
          company_vehicle_business_km: 25000,
        },
      })
    );
    expect(result).toContain("Benefits in Kind: company_car, health_insurance");
    expect(result).toContain(`Company Vehicle OMV: ${eur(45000)}`);
    expect(result).toContain("Company Vehicle Business KM: 25000");
  });

  it("shows income sources and reliefs", () => {
    const result = buildFinancialContext(
      makeInput({
        directorData: {
          director_name: "John",
          income_sources: ["employment", "rental"],
          reliefs: ["medical_expenses", "pension"],
        },
      })
    );
    expect(result).toContain("Income Sources: employment, rental");
    expect(result).toContain("Tax Reliefs Claimed: medical_expenses, pension");
  });

  it("shows foreign/CGT options excluding 'none'", () => {
    const result = buildFinancialContext(
      makeInput({
        directorData: {
          director_name: "John",
          foreign_cgt_options: ["share_disposals", "foreign_income"],
        },
      })
    );
    expect(result).toContain("Foreign/CGT: share_disposals, foreign_income");
  });

  it("does not show foreign/CGT when only 'none' selected", () => {
    const result = buildFinancialContext(
      makeInput({
        directorData: {
          director_name: "John",
          foreign_cgt_options: ["none"],
        },
      })
    );
    expect(result).not.toContain("Foreign/CGT:");
  });

  it("shows commute details", () => {
    const result = buildFinancialContext(
      makeInput({
        directorData: {
          director_name: "John",
          commute_distance_km: 35,
          commute_method: "car",
        },
      })
    );
    expect(result).toContain("Commute: 35km (car)");
  });

  it("falls back to first_name + last_name when director_name absent", () => {
    const result = buildFinancialContext(
      makeInput({
        directorData: {
          first_name: "Jane",
          last_name: "Doe",
        },
      })
    );
    expect(result).toContain("Name: Jane Doe");
  });

  it("shows director name from directorRows as fallback", () => {
    const result = buildFinancialContext(
      makeInput({
        allDirectorData: [{ salary: 30000 }],
        directorRows: [{ director_name: "From DB Row" }],
      })
    );
    expect(result).toContain("Name: From DB Row");
  });
});

// ══════════════════════════════════════════════════════════════
// 10. Tax planning opportunities — always present
// ══════════════════════════════════════════════════════════════
describe("tax planning opportunities section", () => {
  it("always present in output", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("=== TAX PLANNING OPPORTUNITIES ===");
  });

  it("always includes R&D tax credit opportunity", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("R&D TAX CREDIT");
  });

  it("always includes Knowledge Development Box opportunity", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("KNOWLEDGE DEVELOPMENT BOX");
  });

  it("suggests capital allowances when none claimed", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("No capital allowances claimed");
  });

  it("confirms capital allowances when already claimed", () => {
    const result = buildFinancialContext(
      makeInput({ savedCT1: { capitalAllowancesPlant: 5000 } })
    );
    expect(result).toContain(`Already claiming ${eur(5000)}`);
  });

  it("shows small benefit exemption when directors exist", () => {
    const result = buildFinancialContext(
      makeInput({ directorData: { director_name: "John" } })
    );
    expect(result).toContain("SMALL BENEFIT EXEMPTION");
  });

  it("shows small benefit exemption when biz has employees", () => {
    const result = buildFinancialContext(
      makeInput({
        businessExtra: { businesses: [{ has_employees: true }] },
      })
    );
    expect(result).toContain("SMALL BENEFIT EXEMPTION");
  });
});

// ══════════════════════════════════════════════════════════════
// 11. Start-up relief — companies < 3 years old
// ══════════════════════════════════════════════════════════════
describe("start-up relief", () => {
  it("shows start-up relief for company in year 1", () => {
    const result = buildFinancialContext(
      makeInput({ profile: { incorporation_date: "2025-03-01" } })
    );
    expect(result).toContain("START-UP COMPANY RELIEF");
    expect(result).toContain("year 0 of 3");
  });

  it("shows start-up relief for company in year 2", () => {
    const result = buildFinancialContext(
      makeInput({ profile: { incorporation_date: "2023-06-01" } })
    );
    expect(result).toContain("START-UP COMPANY RELIEF");
    expect(result).toContain("year 2 of 3");
  });

  it("shows start-up relief for company in year 3", () => {
    const result = buildFinancialContext(
      makeInput({ profile: { incorporation_date: "2022-01-15" } })
    );
    expect(result).toContain("START-UP COMPANY RELIEF");
    expect(result).toContain("year 3 of 3");
  });

  it("shows ineligible for companies older than 3 years", () => {
    const result = buildFinancialContext(
      makeInput({ profile: { incorporation_date: "2020-01-01" } })
    );
    expect(result).toContain("Not eligible");
    expect(result).toContain("more than 3 years ago");
  });

  it("does not mention start-up relief when no incorporation date", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("START-UP COMPANY RELIEF");
    expect(result).not.toContain("Start-up relief: Not eligible");
  });
});

// ══════════════════════════════════════════════════════════════
// 12. Pension suggestion — no pension contributions detected
// ══════════════════════════════════════════════════════════════
describe("pension suggestion", () => {
  it("suggests pension when no pension contributions detected", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("No pension contributions detected");
    expect(result).toContain("Employer pension contributions are 100% deductible");
  });

  it("confirms pension when Form 11 data shows contributions", () => {
    const result = buildFinancialContext(
      makeInput({
        allForm11Data: [
          { directorNumber: 1, data: { pensionContributions: 5000 } },
        ],
      })
    );
    expect(result).toContain("Director is contributing to a pension");
    expect(result).not.toContain("No pension contributions detected");
  });

  it("still suggests pension when Form 11 shows zero contributions", () => {
    const result = buildFinancialContext(
      makeInput({
        allForm11Data: [
          { directorNumber: 1, data: { pensionContributions: 0 } },
        ],
      })
    );
    expect(result).toContain("No pension contributions detected");
  });
});

// ══════════════════════════════════════════════════════════════
// 13. Invoices section
// ══════════════════════════════════════════════════════════════
describe("invoices section", () => {
  it("does not appear when no invoices", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== INVOICES ===");
  });

  it("does not appear when invoices array is empty", () => {
    const result = buildFinancialContext(makeInput({ invoices: [] }));
    expect(result).not.toContain("=== INVOICES ===");
  });

  it("shows invoice count and totals", () => {
    const result = buildFinancialContext(
      makeInput({
        invoices: [
          { invoice_number: "INV-001", total: 5000, vat_amount: 1150, status: "paid", customer: { name: "ABC Ltd" }, invoice_date: "2025-03-15" },
          { invoice_number: "INV-002", total: 3000, vat_amount: 690, status: "unpaid", customer: { name: "XYZ Ltd" }, invoice_date: "2025-04-01" },
        ],
      })
    );
    expect(result).toContain("=== INVOICES ===");
    expect(result).toContain("Total Invoices: 2");
    expect(result).toContain("Paid: 1, Unpaid: 1");
    expect(result).toContain(`Total Invoiced: ${eur(8000)}`);
    expect(result).toContain(`Total VAT on Invoices: ${eur(1840)}`);
  });

  it("shows individual invoice details", () => {
    const result = buildFinancialContext(
      makeInput({
        invoices: [
          { invoice_number: "INV-001", total: 5000, vat_amount: 1150, status: "paid", customer: { name: "ABC Ltd" }, invoice_date: "2025-03-15" },
        ],
      })
    );
    expect(result).toContain("INV-001");
    expect(result).toContain("ABC Ltd");
    expect(result).toContain("2025-03-15");
    expect(result).toContain("paid");
  });

  it("shows 'Unknown' when customer name missing", () => {
    const result = buildFinancialContext(
      makeInput({
        invoices: [
          { invoice_number: "INV-001", total: 1000, vat_amount: 0, status: "draft" },
        ],
      })
    );
    expect(result).toContain("Unknown");
  });

  it("truncates list at 10 invoices and shows count of remaining", () => {
    const invoices = Array.from({ length: 15 }, (_, i) => ({
      invoice_number: `INV-${String(i + 1).padStart(3, "0")}`,
      total: 1000,
      vat_amount: 230,
      status: "paid",
      customer: { name: `Customer ${i + 1}` },
      invoice_date: "2025-01-01",
    }));
    const result = buildFinancialContext(makeInput({ invoices }));
    expect(result).toContain("Total Invoices: 15");
    expect(result).toContain("... and 5 more");
    // Should show first 10
    expect(result).toContain("INV-010");
    // The 11th should not appear individually
    expect(result).not.toContain("INV-011");
  });
});

// ══════════════════════════════════════════════════════════════
// 14. Opening balances section
// ══════════════════════════════════════════════════════════════
describe("opening balances section", () => {
  it("does not appear when businessExtra has no opening balances", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== OPENING BALANCES ===");
  });

  it("appears when businessExtra has opening balances", () => {
    const result = buildFinancialContext(
      makeInput({
        businessExtra: {
          businesses: [{
            has_opening_balances: true,
            opening_bank_balance: 25000,
            opening_debtors: 10000,
            opening_creditors: 8000,
            opening_vat_liability: 3000,
          }],
        },
      })
    );
    expect(result).toContain("=== OPENING BALANCES ===");
    expect(result).toContain(`Bank Balance: ${eur(25000)}`);
    expect(result).toContain(`Debtors: ${eur(10000)}`);
    expect(result).toContain(`Creditors: ${eur(8000)}`);
    expect(result).toContain(`VAT Liability: ${eur(3000)}`);
  });

  it("only shows fields that are present", () => {
    const result = buildFinancialContext(
      makeInput({
        businessExtra: {
          businesses: [{
            has_opening_balances: true,
            opening_bank_balance: 15000,
          }],
        },
      })
    );
    expect(result).toContain(`Bank Balance: ${eur(15000)}`);
    expect(result).not.toContain("Debtors:");
    expect(result).not.toContain("Creditors:");
  });
});

// ══════════════════════════════════════════════════════════════
// 15. Balance due vs refund due
// ══════════════════════════════════════════════════════════════
describe("balance due vs refund due", () => {
  it("shows BALANCE DUE when CT exceeds payments", () => {
    // With defaults: CT = 8,750 and no payments, balance = 8,750
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("BALANCE DUE");
    expect(result).toContain(eur(8750));
  });

  it("shows REFUND DUE when payments exceed CT", () => {
    // CT = 8,750 but prelim paid = 15,000 => refund of 6,250
    const result = buildFinancialContext(
      makeInput({ savedCT1: { preliminaryCTPaid: 15000 } })
    );
    expect(result).toContain("REFUND DUE");
    expect(result).toContain(eur(6250));
  });

  it("shows REFUND DUE of zero when CT exactly equals payments", () => {
    // CT = 8,750, prelim = 8,750 => balance = 0, which is <= 0
    const result = buildFinancialContext(
      makeInput({ savedCT1: { preliminaryCTPaid: 8750 } })
    );
    expect(result).toContain("REFUND DUE");
    expect(result).toContain(eur(0));
  });

  it("accounts for RCT credit in balance calculation", () => {
    // CT = 8,750, RCT credit = 3,000 => balance = 5,750
    const result = buildFinancialContext(
      makeInput({
        ct1: { ...makeInput().ct1, rctPrepayment: 3000 },
      })
    );
    expect(result).toContain("BALANCE DUE");
    expect(result).toContain(eur(5750));
  });

  it("shows refund when RCT credit alone exceeds CT", () => {
    // CT = 8,750, RCT = 10,000 => refund of 1,250
    const result = buildFinancialContext(
      makeInput({
        ct1: { ...makeInput().ct1, rctPrepayment: 10000 },
      })
    );
    expect(result).toContain("REFUND DUE");
    expect(result).toContain(eur(1250));
  });
});

// ══════════════════════════════════════════════════════════════
// 16. Travel allowance section
// ══════════════════════════════════════════════════════════════
describe("travel & accommodation section", () => {
  it("does not appear when directorsLoanTravel is 0", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== TRAVEL & ACCOMMODATION ===");
  });

  it("appears when directorsLoanTravel > 0", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: {
          ...makeInput().ct1,
          directorsLoanTravel: 6000,
          travelAllowance: 7500,
        },
      })
    );
    expect(result).toContain("=== TRAVEL & ACCOMMODATION ===");
    expect(result).toContain(`Travel allowance (Revenue mileage + subsistence rates): ${eur(7500)}`);
    expect(result).toContain(`Net owed to director (not yet reimbursed): ${eur(6000)}`);
    expect(result).toContain("deductible from trading profit");
  });

  it("shows place of work when available", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: { ...makeInput().ct1, directorsLoanTravel: 1000, travelAllowance: 1000 },
        businessExtra: { businesses: [{ place_of_work: "Dublin" }] },
      })
    );
    expect(result).toContain("Normal place of work county: Dublin");
  });

  it("shows mileage claiming in tax planning when travel present", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: { ...makeInput().ct1, directorsLoanTravel: 3000, travelAllowance: 3500 },
      })
    );
    expect(result).toContain(`MILEAGE & SUBSISTENCE: Claiming ${eur(3500)}`);
  });

  it("suggests mileage when director has commute but no travel", () => {
    const result = buildFinancialContext(
      makeInput({
        directorData: { director_name: "John", commute_distance_km: 40 },
      })
    );
    expect(result).toContain("MILEAGE: Director has a commute but no travel claims detected");
  });
});

// ══════════════════════════════════════════════════════════════
// 17. Empty/minimal input — doesn't crash
// ══════════════════════════════════════════════════════════════
describe("empty and minimal input", () => {
  it("does not crash with minimal required fields", () => {
    const result = buildFinancialContext(makeInput());
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("does not crash with all optional fields undefined", () => {
    const result = buildFinancialContext(
      makeInput({
        profile: undefined,
        onboardingSettings: undefined,
        businessExtra: undefined,
        allDirectorData: undefined,
        directorRows: undefined,
        allForm11Data: undefined,
        invoices: undefined,
      })
    );
    expect(typeof result).toBe("string");
    expect(result).toContain("Test Co Ltd");
  });

  it("does not crash with all optional fields set to null", () => {
    const result = buildFinancialContext(
      makeInput({
        profile: null,
        onboardingSettings: null,
        businessExtra: null,
        allDirectorData: undefined,
        directorRows: undefined,
        allForm11Data: undefined,
        invoices: undefined,
      })
    );
    expect(typeof result).toBe("string");
  });

  it("handles zero income and zero expenses", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: {
          detectedIncome: [],
          expenseByCategory: [],
          expenseSummary: { allowable: 0, disallowed: 0, total: 0 },
          vehicleAsset: null,
          directorsLoanTravel: 0,
          travelAllowance: 0,
          rctPrepayment: 0,
          isConstructionTrade: false,
          vatPosition: null,
          flaggedCapitalItems: [],
        },
      })
    );
    expect(result).toContain(`TOTAL INCOME: ${eur(0)}`);
    expect(result).toContain(`TOTAL EXPENSES: ${eur(0)}`);
    expect(result).toContain(`Trading Profit: ${eur(0)}`);
    expect(result).toContain(`CT @ 12.5%: ${eur(0)}`);
  });

  it("handles zero transaction count", () => {
    const result = buildFinancialContext(makeInput({ transactionCount: 0 }));
    expect(result).toContain("Total Transactions Imported: 0");
  });

  it("returns a string", () => {
    const result = buildFinancialContext(makeInput());
    expect(typeof result).toBe("string");
  });
});

// ══════════════════════════════════════════════════════════════
// Additional sections: VAT position, flagged capital items,
// employees & payroll, Form 11, balance sheet, data sources
// ══════════════════════════════════════════════════════════════
describe("VAT position section", () => {
  it("does not appear when vatPosition is null", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== VAT POSITION ===");
  });

  it("shows VAT payable", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: {
          ...makeInput().ct1,
          vatPosition: { type: "payable", amount: 12000 },
        },
      })
    );
    expect(result).toContain("=== VAT POSITION ===");
    expect(result).toContain(`VAT Payable: ${eur(12000)}`);
  });

  it("shows VAT refundable", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: {
          ...makeInput().ct1,
          vatPosition: { type: "refundable", amount: 3000 },
        },
      })
    );
    expect(result).toContain(`VAT Refundable: ${eur(3000)}`);
  });
});

describe("flagged capital items section", () => {
  it("does not appear when flaggedCapitalItems is empty", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== FLAGGED CAPITAL ITEMS");
  });

  it("lists flagged capital items", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: {
          ...makeInput().ct1,
          flaggedCapitalItems: [
            { description: "Compressor", date: "2025-04-10", amount: 2500 },
            { description: "Scaffold Tower", date: "2025-06-22", amount: 1800 },
          ],
        },
      })
    );
    expect(result).toContain("=== FLAGGED CAPITAL ITEMS");
    expect(result).toContain(`Compressor — 2025-04-10 — ${eur(2500)}`);
    expect(result).toContain(`Scaffold Tower — 2025-06-22 — ${eur(1800)}`);
  });
});

describe("employees & payroll section", () => {
  it("does not appear when biz has no employees", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== EMPLOYEES & PAYROLL ===");
  });

  it("shows employee details when present", () => {
    const result = buildFinancialContext(
      makeInput({
        businessExtra: {
          businesses: [{
            has_employees: true,
            employee_count: 5,
            paye_registered: true,
            paye_number: "1234567TH",
          }],
        },
      })
    );
    expect(result).toContain("=== EMPLOYEES & PAYROLL ===");
    expect(result).toContain("Has Employees: Yes");
    expect(result).toContain("Employee Count: 5");
    expect(result).toContain("PAYE Registered: Yes");
    expect(result).toContain("PAYE Number: 1234567TH");
  });
});

describe("Form 11 questionnaire data section", () => {
  it("does not appear when allForm11Data is undefined", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== FORM 11 QUESTIONNAIRE DATA ===");
  });

  it("shows Form 11 data for each director", () => {
    const result = buildFinancialContext(
      makeInput({
        allForm11Data: [
          {
            directorNumber: 1,
            data: {
              otherEmploymentIncome: 15000,
              rentalIncome: 12000,
              pensionContributions: 5000,
              medicalExpenses: 2000,
              capitalGains: 8000,
            },
          },
        ],
      })
    );
    expect(result).toContain("=== FORM 11 QUESTIONNAIRE DATA ===");
    expect(result).toContain("--- Director 1 Form 11 ---");
    expect(result).toContain(`Other Employment Income: ${eur(15000)}`);
    expect(result).toContain(`Rental Income: ${eur(12000)}`);
    expect(result).toContain(`Pension Contributions: ${eur(5000)}`);
    expect(result).toContain(`Medical Expenses: ${eur(2000)}`);
    expect(result).toContain(`Capital Gains: ${eur(8000)}`);
  });
});

describe("balance sheet from CT1 questionnaire", () => {
  it("does not appear when savedCT1 is null", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== BALANCE SHEET (from CT1 questionnaire) ===");
  });

  it("does not appear when savedCT1 has no balance sheet fields", () => {
    const result = buildFinancialContext(
      makeInput({ savedCT1: { lossesForward: 0 } })
    );
    expect(result).not.toContain("=== BALANCE SHEET (from CT1 questionnaire) ===");
  });

  it("shows balance sheet entries when present", () => {
    const result = buildFinancialContext(
      makeInput({
        savedCT1: {
          fixedAssetsPlantMachinery: 50000,
          currentAssetsStock: 10000,
          currentAssetsBankBalance: 25000,
          liabilitiesCreditors: 8000,
          shareCapitalIssued: 100,
          retainedProfitsBroughtForward: 42000,
        },
      })
    );
    expect(result).toContain("=== BALANCE SHEET (from CT1 questionnaire) ===");
    expect(result).toContain(`Fixed Assets - Plant & Machinery: ${eur(50000)}`);
    expect(result).toContain(`Stock: ${eur(10000)}`);
    expect(result).toContain(`Bank Balance (questionnaire): ${eur(25000)}`);
    expect(result).toContain(`Creditors: ${eur(8000)}`);
    expect(result).toContain(`Share Capital Issued: ${eur(100)}`);
    expect(result).toContain(`Retained Profits B/F: ${eur(42000)}`);
  });
});

describe("expense behaviour section", () => {
  it("does not appear when no home office or mixed-use spending", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== EXPENSE BEHAVIOUR ===");
  });

  it("shows home office details", () => {
    const result = buildFinancialContext(
      makeInput({
        businessExtra: {
          businesses: [{
            has_home_office: true,
            business_use_percentage: 25,
          }],
        },
      })
    );
    expect(result).toContain("=== EXPENSE BEHAVIOUR ===");
    expect(result).toContain("Home Office: Yes (business use 25%)");
  });

  it("shows mixed-use spending", () => {
    const result = buildFinancialContext(
      makeInput({
        businessExtra: { businesses: [{ mixed_use_spending: true }] },
      })
    );
    expect(result).toContain("Mixed-use Spending: Yes");
  });
});

describe("loans & finance section", () => {
  it("does not appear when biz has no loans", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("=== LOANS & FINANCE ===");
  });

  it("shows loan details when present", () => {
    const result = buildFinancialContext(
      makeInput({
        businessExtra: {
          businesses: [{
            has_loans: true,
            loan_type: "term_loan",
            loan_start_date: "2024-01-01",
            directors_loan_movements: true,
          }],
        },
      })
    );
    expect(result).toContain("=== LOANS & FINANCE ===");
    expect(result).toContain("Loan Type: term_loan");
    expect(result).toContain("Loan Start Date: 2024-01-01");
    expect(result).toContain("Director's Loan Movements: Yes");
  });
});

describe("data sources section", () => {
  it("always present at the end", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).toContain("=== DATA SOURCES ===");
    expect(result).toContain("private financial data");
  });
});

// ══════════════════════════════════════════════════════════════
// Tax planning relief sub-items
// ══════════════════════════════════════════════════════════════
describe("tax planning — loss relief", () => {
  it("shows loss relief when lossesForward > 0", () => {
    const result = buildFinancialContext(
      makeInput({ savedCT1: { lossesForward: 15000 } })
    );
    expect(result).toContain(`LOSS RELIEF: Carrying forward ${eur(15000)}`);
  });

  it("does not mention loss relief when no losses", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("LOSS RELIEF");
  });
});

describe("tax planning — RCT credit", () => {
  it("shows RCT credit in planning when rctPrepayment > 0", () => {
    const result = buildFinancialContext(
      makeInput({
        ct1: { ...makeInput().ct1, rctPrepayment: 6000 },
      })
    );
    expect(result).toContain(`RCT CREDIT: ${eur(6000)} deducted at source`);
  });
});

describe("tax planning — rent credit", () => {
  it("shows rent credit when director pays rent", () => {
    const result = buildFinancialContext(
      makeInput({
        allForm11Data: [
          { directorNumber: 1, data: { rentPaid: 12000 } },
        ],
      })
    );
    expect(result).toContain("RENT TAX CREDIT");
  });

  it("does not show rent credit when no rent paid", () => {
    const result = buildFinancialContext(makeInput());
    expect(result).not.toContain("RENT TAX CREDIT");
  });
});

describe("tax planning — medical expenses", () => {
  it("shows medical relief when director has medical expenses", () => {
    const result = buildFinancialContext(
      makeInput({
        allForm11Data: [
          { directorNumber: 1, data: { medicalExpenses: 3000 } },
        ],
      })
    );
    expect(result).toContain("MEDICAL EXPENSES");
    expect(result).toContain("20% tax relief");
  });
});

describe("tax planning — home office", () => {
  it("shows home office deduction in planning section", () => {
    const result = buildFinancialContext(
      makeInput({
        businessExtra: {
          businesses: [{
            has_home_office: true,
            business_use_percentage: 30,
          }],
        },
      })
    );
    expect(result).toContain("HOME OFFICE: Claiming 30%");
  });
});
