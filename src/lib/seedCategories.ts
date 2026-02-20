import { supabase } from "@/integrations/supabase/client";
import { getIndustryGroup, ACTIVITY_TO_GROUP } from "@/lib/industryGroups";

// account_type: "business" = CT1 company categories
// account_type: "personal" = Director/Form 11 personal categories
// account_type: "both" = Shared categories (appear in both)

interface CategoryDef {
  name: string;
  account_code: string;
  vat_rate: number;
  account_type: string;
}

// ─── Personal categories (Form 11 — same for ALL industries) ───
const PERSONAL_INCOME_CATEGORIES: CategoryDef[] = [
  { name: "Salary from Company", account_code: "3100", vat_rate: 0, account_type: "personal" },
  { name: "Dividend Income", account_code: "3200", vat_rate: 0, account_type: "personal" },
  { name: "Other Personal Income", account_code: "3900", vat_rate: 0, account_type: "personal" },
];

const PERSONAL_CATEGORIES: CategoryDef[] = [
  { name: "Groceries & Household", account_code: "7100", vat_rate: 0, account_type: "personal" },
  { name: "Rent / Mortgage", account_code: "7200", vat_rate: 0, account_type: "personal" },
  { name: "Pension Contributions", account_code: "7300", vat_rate: 0, account_type: "personal" },
  { name: "Health Insurance", account_code: "7400", vat_rate: 0, account_type: "personal" },
  { name: "Charitable Donations", account_code: "7500", vat_rate: 0, account_type: "personal" },
  { name: "Tuition Fees", account_code: "7600", vat_rate: 0, account_type: "personal" },
  { name: "Childcare", account_code: "7700", vat_rate: 0, account_type: "personal" },
  { name: "Personal Transport", account_code: "7800", vat_rate: 0, account_type: "personal" },
  { name: "Clothing & Personal", account_code: "7900", vat_rate: 0, account_type: "personal" },
];

// ═══════════════════════════════════════════════════════════════
// INDUSTRY CATEGORY SETS
// ═══════════════════════════════════════════════════════════════

const CONSTRUCTION_INCOME: CategoryDef[] = [
  { name: "Contract Work", account_code: "4100", vat_rate: 23, account_type: "business" },
  { name: "Labour Income", account_code: "4200", vat_rate: 23, account_type: "business" },
  { name: "Materials Charged", account_code: "4300", vat_rate: 23, account_type: "business" },
  { name: "Consultation Fees", account_code: "4400", vat_rate: 23, account_type: "business" },
  { name: "Other Income", account_code: "4900", vat_rate: 23, account_type: "business" },
];

const CONSTRUCTION_EXPENSES: CategoryDef[] = [
  { name: "Materials & Supplies", account_code: "5100", vat_rate: 23, account_type: "business" },
  { name: "Subcontractor Payments", account_code: "5200", vat_rate: 23, account_type: "business" },
  { name: "Tools & Equipment", account_code: "5300", vat_rate: 23, account_type: "business" },
  { name: "Vehicle Expenses", account_code: "5400", vat_rate: 23, account_type: "business" },
  { name: "Fuel", account_code: "5410", vat_rate: 23, account_type: "business" },
  { name: "Insurance", account_code: "5500", vat_rate: 0, account_type: "both" },
  { name: "Professional Fees", account_code: "5600", vat_rate: 23, account_type: "both" },
  { name: "Office Expenses", account_code: "5700", vat_rate: 23, account_type: "business" },
  { name: "Telephone & Internet", account_code: "5710", vat_rate: 23, account_type: "business" },
  { name: "Bank Charges", account_code: "5800", vat_rate: 0, account_type: "both" },
  { name: "Rent & Rates", account_code: "5900", vat_rate: 0, account_type: "business" },
  { name: "Utilities", account_code: "5910", vat_rate: 13.5, account_type: "business" },
  { name: "Training & Certifications", account_code: "6000", vat_rate: 0, account_type: "business" },
  { name: "Advertising & Marketing", account_code: "6100", vat_rate: 23, account_type: "business" },
  { name: "Travel & Accommodation", account_code: "6200", vat_rate: 0, account_type: "business" },
  { name: "Subsistence", account_code: "6250", vat_rate: 0, account_type: "business" },
  { name: "Meals & Entertainment", account_code: "6300", vat_rate: 0, account_type: "business" },
  { name: "Repairs & Maintenance", account_code: "6400", vat_rate: 23, account_type: "business" },
  { name: "Protective Clothing & PPE", account_code: "6500", vat_rate: 23, account_type: "business" },
  { name: "Subscriptions & Software", account_code: "6600", vat_rate: 23, account_type: "business" },
  { name: "Director's Salary", account_code: "6710", vat_rate: 0, account_type: "business" },
  { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, account_type: "business" },
  { name: "Dividends", account_code: "6720", vat_rate: 0, account_type: "business" },
  { name: "Medical Expenses", account_code: "6800", vat_rate: 0, account_type: "both" },
  { name: "Miscellaneous Expenses", account_code: "6900", vat_rate: 23, account_type: "business" },
];

const TECHNOLOGY_INCOME: CategoryDef[] = [
  { name: "SaaS Subscription Revenue", account_code: "4100", vat_rate: 23, account_type: "business" },
  { name: "Implementation & Onboarding Fees", account_code: "4200", vat_rate: 23, account_type: "business" },
  { name: "Consulting & Services", account_code: "4300", vat_rate: 23, account_type: "business" },
  { name: "Other Income", account_code: "4900", vat_rate: 23, account_type: "business" },
];

const TECHNOLOGY_EXPENSES: CategoryDef[] = [
  { name: "Cloud Hosting & Infrastructure", account_code: "5100", vat_rate: 23, account_type: "business" },
  { name: "Software & Licenses", account_code: "5200", vat_rate: 23, account_type: "business" },
  { name: "Contractor Payments", account_code: "5300", vat_rate: 23, account_type: "business" },
  { name: "Hardware & Equipment", account_code: "5400", vat_rate: 23, account_type: "business" },
  { name: "Payment Processing Fees", account_code: "5410", vat_rate: 0, account_type: "business" },
  { name: "Insurance", account_code: "5500", vat_rate: 0, account_type: "both" },
  { name: "Professional Fees", account_code: "5600", vat_rate: 23, account_type: "both" },
  { name: "Office Expenses", account_code: "5700", vat_rate: 23, account_type: "business" },
  { name: "Telephone & Internet", account_code: "5710", vat_rate: 23, account_type: "business" },
  { name: "Bank Charges", account_code: "5800", vat_rate: 0, account_type: "both" },
  { name: "Rent & Co-working", account_code: "5900", vat_rate: 0, account_type: "business" },
  { name: "Utilities", account_code: "5910", vat_rate: 13.5, account_type: "business" },
  { name: "Training & Conferences", account_code: "6000", vat_rate: 0, account_type: "business" },
  { name: "Advertising & Marketing", account_code: "6100", vat_rate: 23, account_type: "business" },
  { name: "Travel & Accommodation", account_code: "6200", vat_rate: 0, account_type: "business" },
  { name: "Subsistence", account_code: "6250", vat_rate: 0, account_type: "business" },
  { name: "Meals & Entertainment", account_code: "6300", vat_rate: 0, account_type: "business" },
  { name: "Subscriptions & Software", account_code: "6600", vat_rate: 23, account_type: "business" },
  { name: "Director's Salary", account_code: "6710", vat_rate: 0, account_type: "business" },
  { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, account_type: "business" },
  { name: "Dividends", account_code: "6720", vat_rate: 0, account_type: "business" },
  { name: "Medical Expenses", account_code: "6800", vat_rate: 0, account_type: "both" },
  { name: "Miscellaneous Expenses", account_code: "6900", vat_rate: 23, account_type: "business" },
];

const HOSPITALITY_INCOME: CategoryDef[] = [
  { name: "Food Sales", account_code: "4100", vat_rate: 13.5, account_type: "business" },
  { name: "Beverage Sales", account_code: "4200", vat_rate: 23, account_type: "business" },
  { name: "Catering Income", account_code: "4300", vat_rate: 13.5, account_type: "business" },
  { name: "Other Income", account_code: "4900", vat_rate: 23, account_type: "business" },
];

const HOSPITALITY_EXPENSES: CategoryDef[] = [
  { name: "Food & Ingredients", account_code: "5100", vat_rate: 0, account_type: "business" },
  { name: "Beverages (Cost of Sales)", account_code: "5150", vat_rate: 23, account_type: "business" },
  { name: "Staff Wages", account_code: "5200", vat_rate: 0, account_type: "business" },
  { name: "Kitchen Equipment", account_code: "5300", vat_rate: 23, account_type: "business" },
  { name: "Packaging & Disposables", account_code: "5400", vat_rate: 23, account_type: "business" },
  { name: "Insurance", account_code: "5500", vat_rate: 0, account_type: "both" },
  { name: "Professional Fees", account_code: "5600", vat_rate: 23, account_type: "both" },
  { name: "Office Expenses", account_code: "5700", vat_rate: 23, account_type: "business" },
  { name: "Telephone & Internet", account_code: "5710", vat_rate: 23, account_type: "business" },
  { name: "Bank Charges", account_code: "5800", vat_rate: 0, account_type: "both" },
  { name: "Rent & Rates", account_code: "5900", vat_rate: 0, account_type: "business" },
  { name: "Utilities", account_code: "5910", vat_rate: 13.5, account_type: "business" },
  { name: "Cleaning & Hygiene", account_code: "6000", vat_rate: 23, account_type: "business" },
  { name: "Advertising & Marketing", account_code: "6100", vat_rate: 23, account_type: "business" },
  { name: "Delivery Platform Fees", account_code: "6150", vat_rate: 23, account_type: "business" },
  { name: "Repairs & Maintenance", account_code: "6400", vat_rate: 23, account_type: "business" },
  { name: "Subscriptions & Software", account_code: "6600", vat_rate: 23, account_type: "business" },
  { name: "Director's Salary", account_code: "6710", vat_rate: 0, account_type: "business" },
  { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, account_type: "business" },
  { name: "Dividends", account_code: "6720", vat_rate: 0, account_type: "business" },
  { name: "Medical Expenses", account_code: "6800", vat_rate: 0, account_type: "both" },
  { name: "Miscellaneous Expenses", account_code: "6900", vat_rate: 23, account_type: "business" },
];

const RETAIL_INCOME: CategoryDef[] = [
  { name: "Product Sales", account_code: "4100", vat_rate: 23, account_type: "business" },
  { name: "Online Sales", account_code: "4200", vat_rate: 23, account_type: "business" },
  { name: "Wholesale Revenue", account_code: "4300", vat_rate: 23, account_type: "business" },
  { name: "Other Income", account_code: "4900", vat_rate: 23, account_type: "business" },
];

const RETAIL_EXPENSES: CategoryDef[] = [
  { name: "Cost of Goods Sold", account_code: "5100", vat_rate: 23, account_type: "business" },
  { name: "Packaging & Shipping", account_code: "5200", vat_rate: 23, account_type: "business" },
  { name: "Staff Wages", account_code: "5250", vat_rate: 0, account_type: "business" },
  { name: "Shop Fittings & Equipment", account_code: "5300", vat_rate: 23, account_type: "business" },
  { name: "Payment Processing Fees", account_code: "5410", vat_rate: 0, account_type: "business" },
  { name: "Insurance", account_code: "5500", vat_rate: 0, account_type: "both" },
  { name: "Professional Fees", account_code: "5600", vat_rate: 23, account_type: "both" },
  { name: "Office Expenses", account_code: "5700", vat_rate: 23, account_type: "business" },
  { name: "Telephone & Internet", account_code: "5710", vat_rate: 23, account_type: "business" },
  { name: "Bank Charges", account_code: "5800", vat_rate: 0, account_type: "both" },
  { name: "Rent & Rates", account_code: "5900", vat_rate: 0, account_type: "business" },
  { name: "Utilities", account_code: "5910", vat_rate: 13.5, account_type: "business" },
  { name: "Advertising & Marketing", account_code: "6100", vat_rate: 23, account_type: "business" },
  { name: "Travel & Accommodation", account_code: "6200", vat_rate: 0, account_type: "business" },
  { name: "Repairs & Maintenance", account_code: "6400", vat_rate: 23, account_type: "business" },
  { name: "Subscriptions & Software", account_code: "6600", vat_rate: 23, account_type: "business" },
  { name: "Director's Salary", account_code: "6710", vat_rate: 0, account_type: "business" },
  { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, account_type: "business" },
  { name: "Dividends", account_code: "6720", vat_rate: 0, account_type: "business" },
  { name: "Medical Expenses", account_code: "6800", vat_rate: 0, account_type: "both" },
  { name: "Miscellaneous Expenses", account_code: "6900", vat_rate: 23, account_type: "business" },
];

const TRANSPORT_INCOME: CategoryDef[] = [
  { name: "Delivery Services", account_code: "4100", vat_rate: 23, account_type: "business" },
  { name: "Haulage Income", account_code: "4200", vat_rate: 23, account_type: "business" },
  { name: "Plant Hire Income", account_code: "4300", vat_rate: 23, account_type: "business" },
  { name: "Other Income", account_code: "4900", vat_rate: 23, account_type: "business" },
];

const TRANSPORT_EXPENSES: CategoryDef[] = [
  { name: "Fuel", account_code: "5100", vat_rate: 23, account_type: "business" },
  { name: "Vehicle Maintenance & Repairs", account_code: "5200", vat_rate: 23, account_type: "business" },
  { name: "Vehicle Leasing", account_code: "5250", vat_rate: 23, account_type: "business" },
  { name: "Vehicle Insurance", account_code: "5300", vat_rate: 0, account_type: "business" },
  { name: "Tolls & Parking", account_code: "5400", vat_rate: 0, account_type: "business" },
  { name: "Driver Wages", account_code: "5450", vat_rate: 0, account_type: "business" },
  { name: "Insurance", account_code: "5500", vat_rate: 0, account_type: "both" },
  { name: "Professional Fees", account_code: "5600", vat_rate: 23, account_type: "both" },
  { name: "Office Expenses", account_code: "5700", vat_rate: 23, account_type: "business" },
  { name: "Telephone & Internet", account_code: "5710", vat_rate: 23, account_type: "business" },
  { name: "Bank Charges", account_code: "5800", vat_rate: 0, account_type: "both" },
  { name: "Rent & Rates", account_code: "5900", vat_rate: 0, account_type: "business" },
  { name: "Utilities", account_code: "5910", vat_rate: 13.5, account_type: "business" },
  { name: "Advertising & Marketing", account_code: "6100", vat_rate: 23, account_type: "business" },
  { name: "Subscriptions & Software", account_code: "6600", vat_rate: 23, account_type: "business" },
  { name: "Director's Salary", account_code: "6710", vat_rate: 0, account_type: "business" },
  { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, account_type: "business" },
  { name: "Dividends", account_code: "6720", vat_rate: 0, account_type: "business" },
  { name: "Medical Expenses", account_code: "6800", vat_rate: 0, account_type: "both" },
  { name: "Miscellaneous Expenses", account_code: "6900", vat_rate: 23, account_type: "business" },
];

const HEALTH_INCOME: CategoryDef[] = [
  { name: "Services", account_code: "4100", vat_rate: 0, account_type: "business" },
  { name: "Product Sales", account_code: "4200", vat_rate: 23, account_type: "business" },
  { name: "Membership & Subscriptions", account_code: "4300", vat_rate: 23, account_type: "business" },
  { name: "Other Income", account_code: "4900", vat_rate: 23, account_type: "business" },
];

const HEALTH_EXPENSES: CategoryDef[] = [
  { name: "Supplies & Products", account_code: "5100", vat_rate: 23, account_type: "business" },
  { name: "Staff Wages", account_code: "5200", vat_rate: 0, account_type: "business" },
  { name: "Equipment & Furniture", account_code: "5300", vat_rate: 23, account_type: "business" },
  { name: "Insurance", account_code: "5500", vat_rate: 0, account_type: "both" },
  { name: "Professional Fees", account_code: "5600", vat_rate: 23, account_type: "both" },
  { name: "Office Expenses", account_code: "5700", vat_rate: 23, account_type: "business" },
  { name: "Telephone & Internet", account_code: "5710", vat_rate: 23, account_type: "business" },
  { name: "Bank Charges", account_code: "5800", vat_rate: 0, account_type: "both" },
  { name: "Rent & Rates", account_code: "5900", vat_rate: 0, account_type: "business" },
  { name: "Utilities", account_code: "5910", vat_rate: 13.5, account_type: "business" },
  { name: "Cleaning & Hygiene", account_code: "6000", vat_rate: 23, account_type: "business" },
  { name: "Advertising & Marketing", account_code: "6100", vat_rate: 23, account_type: "business" },
  { name: "Training & CPD", account_code: "6200", vat_rate: 0, account_type: "business" },
  { name: "Subscriptions & Software", account_code: "6600", vat_rate: 23, account_type: "business" },
  { name: "Director's Salary", account_code: "6710", vat_rate: 0, account_type: "business" },
  { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, account_type: "business" },
  { name: "Dividends", account_code: "6720", vat_rate: 0, account_type: "business" },
  { name: "Medical Expenses", account_code: "6800", vat_rate: 0, account_type: "both" },
  { name: "Miscellaneous Expenses", account_code: "6900", vat_rate: 23, account_type: "business" },
];

const PROPERTY_INCOME: CategoryDef[] = [
  { name: "Rental Income", account_code: "4100", vat_rate: 0, account_type: "business" },
  { name: "Management Fees", account_code: "4200", vat_rate: 23, account_type: "business" },
  { name: "Consulting & Services", account_code: "4300", vat_rate: 23, account_type: "business" },
  { name: "Other Income", account_code: "4900", vat_rate: 23, account_type: "business" },
];

const PROPERTY_EXPENSES: CategoryDef[] = [
  { name: "Repairs & Maintenance", account_code: "5100", vat_rate: 23, account_type: "business" },
  { name: "Property Management Fees", account_code: "5200", vat_rate: 23, account_type: "business" },
  { name: "Materials & Supplies", account_code: "5300", vat_rate: 23, account_type: "business" },
  { name: "Insurance", account_code: "5500", vat_rate: 0, account_type: "both" },
  { name: "Professional Fees", account_code: "5600", vat_rate: 23, account_type: "both" },
  { name: "Office Expenses", account_code: "5700", vat_rate: 23, account_type: "business" },
  { name: "Telephone & Internet", account_code: "5710", vat_rate: 23, account_type: "business" },
  { name: "Bank Charges", account_code: "5800", vat_rate: 0, account_type: "both" },
  { name: "Mortgage Interest", account_code: "5850", vat_rate: 0, account_type: "business" },
  { name: "Rent & Rates", account_code: "5900", vat_rate: 0, account_type: "business" },
  { name: "Utilities", account_code: "5910", vat_rate: 13.5, account_type: "business" },
  { name: "Advertising & Marketing", account_code: "6100", vat_rate: 23, account_type: "business" },
  { name: "Travel & Accommodation", account_code: "6200", vat_rate: 0, account_type: "business" },
  { name: "Subscriptions & Software", account_code: "6600", vat_rate: 23, account_type: "business" },
  { name: "Director's Salary", account_code: "6710", vat_rate: 0, account_type: "business" },
  { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, account_type: "business" },
  { name: "Dividends", account_code: "6720", vat_rate: 0, account_type: "business" },
  { name: "Medical Expenses", account_code: "6800", vat_rate: 0, account_type: "both" },
  { name: "Miscellaneous Expenses", account_code: "6900", vat_rate: 23, account_type: "business" },
];

const MANUFACTURING_INCOME: CategoryDef[] = [
  { name: "Product Sales", account_code: "4100", vat_rate: 23, account_type: "business" },
  { name: "Contract Manufacturing", account_code: "4200", vat_rate: 23, account_type: "business" },
  { name: "Wholesale Revenue", account_code: "4300", vat_rate: 23, account_type: "business" },
  { name: "Other Income", account_code: "4900", vat_rate: 23, account_type: "business" },
];

const MANUFACTURING_EXPENSES: CategoryDef[] = [
  { name: "Raw Materials", account_code: "5100", vat_rate: 23, account_type: "business" },
  { name: "Staff Wages", account_code: "5200", vat_rate: 0, account_type: "business" },
  { name: "Machinery & Equipment", account_code: "5300", vat_rate: 23, account_type: "business" },
  { name: "Packaging & Shipping", account_code: "5400", vat_rate: 23, account_type: "business" },
  { name: "Insurance", account_code: "5500", vat_rate: 0, account_type: "both" },
  { name: "Professional Fees", account_code: "5600", vat_rate: 23, account_type: "both" },
  { name: "Office Expenses", account_code: "5700", vat_rate: 23, account_type: "business" },
  { name: "Telephone & Internet", account_code: "5710", vat_rate: 23, account_type: "business" },
  { name: "Bank Charges", account_code: "5800", vat_rate: 0, account_type: "both" },
  { name: "Rent & Rates", account_code: "5900", vat_rate: 0, account_type: "business" },
  { name: "Utilities", account_code: "5910", vat_rate: 13.5, account_type: "business" },
  { name: "Repairs & Maintenance", account_code: "6400", vat_rate: 23, account_type: "business" },
  { name: "Advertising & Marketing", account_code: "6100", vat_rate: 23, account_type: "business" },
  { name: "Protective Clothing & PPE", account_code: "6500", vat_rate: 23, account_type: "business" },
  { name: "Subscriptions & Software", account_code: "6600", vat_rate: 23, account_type: "business" },
  { name: "Director's Salary", account_code: "6710", vat_rate: 0, account_type: "business" },
  { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, account_type: "business" },
  { name: "Dividends", account_code: "6720", vat_rate: 0, account_type: "business" },
  { name: "Medical Expenses", account_code: "6800", vat_rate: 0, account_type: "both" },
  { name: "Miscellaneous Expenses", account_code: "6900", vat_rate: 23, account_type: "business" },
];

const SOFTWARE_DEV_INCOME: CategoryDef[] = [
  { name: "Software Sales & Licensing", account_code: "4100", vat_rate: 23, account_type: "business" },
  { name: "Development Services", account_code: "4200", vat_rate: 23, account_type: "business" },
  { name: "Maintenance & Support", account_code: "4300", vat_rate: 23, account_type: "business" },
  { name: "Other Income", account_code: "4900", vat_rate: 23, account_type: "business" },
];

const SOFTWARE_DEV_EXPENSES: CategoryDef[] = [
  { name: "Cloud Hosting & Infrastructure", account_code: "5100", vat_rate: 23, account_type: "business" },
  { name: "Software & Licenses", account_code: "5200", vat_rate: 23, account_type: "business" },
  { name: "API & Third-Party Services", account_code: "5250", vat_rate: 23, account_type: "business" },
  { name: "Contractor Payments", account_code: "5300", vat_rate: 23, account_type: "business" },
  { name: "Hardware & Equipment", account_code: "5400", vat_rate: 23, account_type: "business" },
  { name: "Payment Processing Fees", account_code: "5410", vat_rate: 0, account_type: "business" },
  { name: "Domain & SSL Certificates", account_code: "5420", vat_rate: 23, account_type: "business" },
  { name: "Insurance", account_code: "5500", vat_rate: 0, account_type: "both" },
  { name: "Professional Fees", account_code: "5600", vat_rate: 23, account_type: "both" },
  { name: "Office Expenses", account_code: "5700", vat_rate: 23, account_type: "business" },
  { name: "Telephone & Internet", account_code: "5710", vat_rate: 23, account_type: "business" },
  { name: "Bank Charges", account_code: "5800", vat_rate: 0, account_type: "both" },
  { name: "Rent & Co-working", account_code: "5900", vat_rate: 0, account_type: "business" },
  { name: "Utilities", account_code: "5910", vat_rate: 13.5, account_type: "business" },
  { name: "Training & Conferences", account_code: "6000", vat_rate: 0, account_type: "business" },
  { name: "Advertising & Marketing", account_code: "6100", vat_rate: 23, account_type: "business" },
  { name: "Travel & Accommodation", account_code: "6200", vat_rate: 0, account_type: "business" },
  { name: "Subsistence", account_code: "6250", vat_rate: 0, account_type: "business" },
  { name: "Meals & Entertainment", account_code: "6300", vat_rate: 0, account_type: "business" },
  { name: "Subscriptions & Software", account_code: "6600", vat_rate: 23, account_type: "business" },
  { name: "Director's Salary", account_code: "6710", vat_rate: 0, account_type: "business" },
  { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, account_type: "business" },
  { name: "Dividends", account_code: "6720", vat_rate: 0, account_type: "business" },
  { name: "Medical Expenses", account_code: "6800", vat_rate: 0, account_type: "both" },
  { name: "Miscellaneous Expenses", account_code: "6900", vat_rate: 23, account_type: "business" },
];

const EVENTS_INCOME: CategoryDef[] = [
  { name: "Event Tickets & Admissions", account_code: "4100", vat_rate: 23, account_type: "business" },
  { name: "Sponsorship Income", account_code: "4200", vat_rate: 23, account_type: "business" },
  { name: "Venue Hire Income", account_code: "4300", vat_rate: 23, account_type: "business" },
  { name: "Catering & Bar Revenue", account_code: "4400", vat_rate: 13.5, account_type: "business" },
  { name: "Other Income", account_code: "4900", vat_rate: 23, account_type: "business" },
];

const EVENTS_EXPENSES: CategoryDef[] = [
  { name: "Venue Hire & Rental", account_code: "5100", vat_rate: 23, account_type: "business" },
  { name: "Catering & Food", account_code: "5150", vat_rate: 13.5, account_type: "business" },
  { name: "Audio/Visual Equipment", account_code: "5200", vat_rate: 23, account_type: "business" },
  { name: "Staging & Decor", account_code: "5250", vat_rate: 23, account_type: "business" },
  { name: "Entertainment & Artists", account_code: "5300", vat_rate: 23, account_type: "business" },
  { name: "Staff Wages", account_code: "5400", vat_rate: 0, account_type: "business" },
  { name: "Security", account_code: "5450", vat_rate: 23, account_type: "business" },
  { name: "Insurance", account_code: "5500", vat_rate: 0, account_type: "both" },
  { name: "Professional Fees", account_code: "5600", vat_rate: 23, account_type: "both" },
  { name: "Licensing & Permits", account_code: "5650", vat_rate: 0, account_type: "business" },
  { name: "Office Expenses", account_code: "5700", vat_rate: 23, account_type: "business" },
  { name: "Telephone & Internet", account_code: "5710", vat_rate: 23, account_type: "business" },
  { name: "Printing & Signage", account_code: "5750", vat_rate: 23, account_type: "business" },
  { name: "Bank Charges", account_code: "5800", vat_rate: 0, account_type: "both" },
  { name: "Rent & Rates", account_code: "5900", vat_rate: 0, account_type: "business" },
  { name: "Utilities", account_code: "5910", vat_rate: 13.5, account_type: "business" },
  { name: "Advertising & Marketing", account_code: "6100", vat_rate: 23, account_type: "business" },
  { name: "Travel & Accommodation", account_code: "6200", vat_rate: 0, account_type: "business" },
  { name: "Transport & Logistics", account_code: "6250", vat_rate: 23, account_type: "business" },
  { name: "Subscriptions & Software", account_code: "6600", vat_rate: 23, account_type: "business" },
  { name: "Director's Salary", account_code: "6710", vat_rate: 0, account_type: "business" },
  { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, account_type: "business" },
  { name: "Dividends", account_code: "6720", vat_rate: 0, account_type: "business" },
  { name: "Medical Expenses", account_code: "6800", vat_rate: 0, account_type: "both" },
  { name: "Miscellaneous Expenses", account_code: "6900", vat_rate: 23, account_type: "business" },
];

const PROFESSIONAL_INCOME: CategoryDef[] = [
  { name: "Consulting & Services", account_code: "4100", vat_rate: 23, account_type: "business" },
  { name: "Project Fees", account_code: "4200", vat_rate: 23, account_type: "business" },
  { name: "Retainer Income", account_code: "4300", vat_rate: 23, account_type: "business" },
  { name: "Other Income", account_code: "4900", vat_rate: 23, account_type: "business" },
];

const PROFESSIONAL_EXPENSES: CategoryDef[] = [
  { name: "Contractor Payments", account_code: "5100", vat_rate: 23, account_type: "business" },
  { name: "Insurance", account_code: "5500", vat_rate: 0, account_type: "both" },
  { name: "Professional Fees", account_code: "5600", vat_rate: 23, account_type: "both" },
  { name: "Office Expenses", account_code: "5700", vat_rate: 23, account_type: "business" },
  { name: "Telephone & Internet", account_code: "5710", vat_rate: 23, account_type: "business" },
  { name: "Bank Charges", account_code: "5800", vat_rate: 0, account_type: "both" },
  { name: "Rent & Rates", account_code: "5900", vat_rate: 0, account_type: "business" },
  { name: "Utilities", account_code: "5910", vat_rate: 13.5, account_type: "business" },
  { name: "Training & CPD", account_code: "6000", vat_rate: 0, account_type: "business" },
  { name: "Advertising & Marketing", account_code: "6100", vat_rate: 23, account_type: "business" },
  { name: "Travel & Accommodation", account_code: "6200", vat_rate: 0, account_type: "business" },
  { name: "Subsistence", account_code: "6250", vat_rate: 0, account_type: "business" },
  { name: "Meals & Entertainment", account_code: "6300", vat_rate: 0, account_type: "business" },
  { name: "Subscriptions & Software", account_code: "6600", vat_rate: 23, account_type: "business" },
  { name: "Director's Salary", account_code: "6710", vat_rate: 0, account_type: "business" },
  { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, account_type: "business" },
  { name: "Dividends", account_code: "6720", vat_rate: 0, account_type: "business" },
  { name: "Medical Expenses", account_code: "6800", vat_rate: 0, account_type: "both" },
  { name: "Miscellaneous Expenses", account_code: "6900", vat_rate: 23, account_type: "business" },
];

// ═══════════════════════════════════════════════════════════════
// INDUSTRY GROUP MAPPING
// ═══════════════════════════════════════════════════════════════

interface IndustryCategories {
  income: CategoryDef[];
  expenses: CategoryDef[];
}

const INDUSTRY_CATEGORIES: Record<string, IndustryCategories> = {
  construction: { income: CONSTRUCTION_INCOME, expenses: CONSTRUCTION_EXPENSES },
  technology: { income: TECHNOLOGY_INCOME, expenses: TECHNOLOGY_EXPENSES },
  software_dev: { income: SOFTWARE_DEV_INCOME, expenses: SOFTWARE_DEV_EXPENSES },
  events: { income: EVENTS_INCOME, expenses: EVENTS_EXPENSES },
  hospitality: { income: HOSPITALITY_INCOME, expenses: HOSPITALITY_EXPENSES },
  retail: { income: RETAIL_INCOME, expenses: RETAIL_EXPENSES },
  transport: { income: TRANSPORT_INCOME, expenses: TRANSPORT_EXPENSES },
  health: { income: HEALTH_INCOME, expenses: HEALTH_EXPENSES },
  property: { income: PROPERTY_INCOME, expenses: PROPERTY_EXPENSES },
  manufacturing: { income: MANUFACTURING_INCOME, expenses: MANUFACTURING_EXPENSES },
  professional: { income: PROFESSIONAL_INCOME, expenses: PROFESSIONAL_EXPENSES },
};

// ACTIVITY_TO_GROUP and getIndustryGroup imported from @/lib/industryGroups

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

export async function seedDefaultCategories(userId: string, businessType?: string): Promise<boolean> {
  try {
    // Check if user already has categories
    const { data: existing, error: checkError } = await supabase
      .from("categories")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (checkError) {
      console.error("Error checking existing categories:", checkError);
      return false;
    }

    // If categories already exist, don't seed
    if (existing && existing.length > 0) {
      return true;
    }

    // Resolve business type if not provided
    let resolvedType = businessType;
    if (!resolvedType) {
      const { data: settings } = await supabase
        .from("onboarding_settings")
        .select("business_type")
        .eq("user_id", userId)
        .single();
      resolvedType = settings?.business_type || undefined;
    }

    const group = getIndustryGroup(resolvedType);
    const industryCats = INDUSTRY_CATEGORIES[group];

    console.log(`Seeding ${group} categories for user ${userId} (business_type: ${resolvedType || "unknown"})`);

    // Create expense categories (industry-specific + personal)
    const expenseInserts = [...industryCats.expenses, ...PERSONAL_CATEGORIES].map((cat) => ({
      ...cat,
      user_id: userId,
      type: "expense",
    }));

    // Create income categories (industry-specific + personal income)
    const incomeInserts = [...industryCats.income, ...PERSONAL_INCOME_CATEGORIES].map((cat) => ({
      ...cat,
      user_id: userId,
      type: "income",
    }));

    const { error: insertError } = await supabase.from("categories").insert([...expenseInserts, ...incomeInserts]);

    if (insertError) {
      console.error("Error seeding categories:", insertError);
      return false;
    }

    console.log(`Successfully seeded ${group} categories for user:`, userId);
    return true;
  } catch (error) {
    console.error("Error in seedDefaultCategories:", error);
    return false;
  }
}

/**
 * Ensure newer categories exist for existing users who were seeded before
 * these categories were added.
 */
export async function ensureNewCategories(userId: string): Promise<void> {
  const needed = [
    { name: "Director's Salary", account_code: "6710", vat_rate: 0, type: "expense", account_type: "business" },
    { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, type: "expense", account_type: "business" },
    { name: "Dividends", account_code: "6720", vat_rate: 0, type: "expense", account_type: "business" },
    { name: "Medical Expenses", account_code: "6800", vat_rate: 0, type: "expense", account_type: "both" },
    { name: "Subsistence", account_code: "6250", vat_rate: 0, type: "expense", account_type: "business" },
    // Personal categories for existing users
    { name: "Groceries & Household", account_code: "7100", vat_rate: 0, type: "expense", account_type: "personal" },
    { name: "Rent / Mortgage", account_code: "7200", vat_rate: 0, type: "expense", account_type: "personal" },
    { name: "Pension Contributions", account_code: "7300", vat_rate: 0, type: "expense", account_type: "personal" },
    { name: "Health Insurance", account_code: "7400", vat_rate: 0, type: "expense", account_type: "personal" },
    { name: "Charitable Donations", account_code: "7500", vat_rate: 0, type: "expense", account_type: "personal" },
    { name: "Tuition Fees", account_code: "7600", vat_rate: 0, type: "expense", account_type: "personal" },
    { name: "Childcare", account_code: "7700", vat_rate: 0, type: "expense", account_type: "personal" },
    { name: "Personal Transport", account_code: "7800", vat_rate: 0, type: "expense", account_type: "personal" },
    { name: "Clothing & Personal", account_code: "7900", vat_rate: 0, type: "expense", account_type: "personal" },
    // Personal income categories for existing users
    { name: "Salary from Company", account_code: "3100", vat_rate: 0, type: "income", account_type: "personal" },
    { name: "Dividend Income", account_code: "3200", vat_rate: 0, type: "income", account_type: "personal" },
    { name: "Other Personal Income", account_code: "3900", vat_rate: 0, type: "income", account_type: "personal" },
  ];

  for (const cat of needed) {
    const { data } = await supabase.from("categories").select("id").eq("user_id", userId).eq("name", cat.name).limit(1);

    if (!data || data.length === 0) {
      await supabase.from("categories").insert({ ...cat, user_id: userId });
    }
  }
}
