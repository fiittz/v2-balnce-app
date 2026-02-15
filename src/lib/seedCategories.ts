import { supabase } from "@/integrations/supabase/client";

// account_type: "business" = CT1 company categories
// account_type: "personal" = Director/Form 11 personal categories
// account_type: "both" = Shared categories (appear in both)

// Default Irish bookkeeping categories for construction/carpentry businesses
const DEFAULT_EXPENSE_CATEGORIES = [
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
  { name: "Director's Drawings", account_code: "6700", vat_rate: 0, account_type: "business" },
  { name: "Medical Expenses", account_code: "6800", vat_rate: 0, account_type: "both" },
  { name: "Miscellaneous Expenses", account_code: "6900", vat_rate: 23, account_type: "business" },
  // Personal-only categories (Form 11 reliefs)
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

const DEFAULT_INCOME_CATEGORIES = [
  { name: "Contract Work", account_code: "4100", vat_rate: 23, account_type: "business" },
  { name: "Labour Income", account_code: "4200", vat_rate: 23, account_type: "business" },
  { name: "Materials Charged", account_code: "4300", vat_rate: 23, account_type: "business" },
  { name: "Consultation Fees", account_code: "4400", vat_rate: 23, account_type: "business" },
  { name: "Other Income", account_code: "4900", vat_rate: 23, account_type: "business" },
];

export async function seedDefaultCategories(userId: string): Promise<boolean> {
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

    // Create expense categories
    const expenseInserts = DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
      ...cat,
      user_id: userId,
      type: "expense",
    }));

    // Create income categories
    const incomeInserts = DEFAULT_INCOME_CATEGORIES.map((cat) => ({
      ...cat,
      user_id: userId,
      type: "income",
    }));

    const { error: insertError } = await supabase
      .from("categories")
      .insert([...expenseInserts, ...incomeInserts]);

    if (insertError) {
      console.error("Error seeding categories:", insertError);
      return false;
    }

    console.log("Successfully seeded default categories for user:", userId);
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
    { name: "Director's Drawings", account_code: "6700", vat_rate: 0, type: "expense", account_type: "business" },
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
  ];

  for (const cat of needed) {
    const { data } = await supabase
      .from("categories")
      .select("id")
      .eq("user_id", userId)
      .eq("name", cat.name)
      .limit(1);

    if (!data || data.length === 0) {
      await supabase.from("categories").insert({ ...cat, user_id: userId });
    }
  }
}
