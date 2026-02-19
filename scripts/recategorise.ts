/**
 * CLI script to run full recategorisation on a user's transactions.
 *
 * Usage:  npx tsx scripts/recategorise.ts <email>
 *
 * Requires: service_role key (fetched automatically via supabase CLI).
 */

import { createClient } from "@supabase/supabase-js";
import { autoCategorise, findMatchingCategory } from "../src/lib/autocat";
import { calculateVATFromGross } from "../src/lib/vatDeductibility";

const SUPABASE_URL = "https://ystgzxtxplhxuwsthmbj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzdGd6eHR4cGxoeHV3c3RobWJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAxOTA1NCwiZXhwIjoyMDg0NTk1MDU0fQ.olAGlHIzdHjgIKnX8XR1IcDLqC25EeULsEnbUWQld-M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/recategorise.ts <email>");
  process.exit(1);
}

const mapVatTypeToRate = (vatType: string | undefined | null): number => {
  const vt = (vatType || "").toLowerCase();
  if (vt.includes("23")) return 23;
  if (vt.includes("13.5") || vt.includes("13,5")) return 13.5;
  if (vt.includes("9") && !vt.includes("23")) return 9;
  if (vt.includes("4.8") || vt.includes("livestock")) return 4.8;
  if (vt.includes("zero")) return 0;
  if (vt.includes("exempt") || vt.includes("n/a")) return 0;
  return 23;
};

async function main() {
  // 1. Find user by email
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) throw authErr;
  const user = authData.users.find((u) => u.email === email);
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }
  console.log(`Found user: ${user.email} (${user.id})`);

  // 2. Get profile for business_type
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_type, address")
    .eq("id", user.id)
    .single();

  // 3. Get onboarding settings
  const { data: onboarding } = await supabase
    .from("onboarding_settings")
    .select("business_type")
    .eq("user_id", user.id)
    .single();

  const businessType = onboarding?.business_type || profile?.business_type || "";
  console.log(`Business type: ${businessType}`);

  // 4. Get director names
  const { data: directorRows } = await supabase
    .from("director_onboarding")
    .select("director_name")
    .eq("user_id", user.id);

  const directorNames = (directorRows || [])
    .map((d: { director_name: string | null }) => d.director_name)
    .filter((n): n is string => !!n);
  console.log(`Director names: ${directorNames.length > 0 ? directorNames.join(", ") : "(none)"}`);

  // 5. Ensure new categories exist (inline — can't use browser-only ensureNewCategories)
  const neededCategories = [
    { name: "Director's Salary", account_code: "6710", vat_rate: 0, type: "expense", account_type: "business" },
    { name: "Director's Loan Account", account_code: "6700", vat_rate: 0, type: "expense", account_type: "business" },
    { name: "Dividends", account_code: "6720", vat_rate: 0, type: "expense", account_type: "business" },
    { name: "Medical Expenses", account_code: "6800", vat_rate: 0, type: "expense", account_type: "both" },
    { name: "Subsistence", account_code: "6250", vat_rate: 0, type: "expense", account_type: "business" },
  ];
  for (const cat of neededCategories) {
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", cat.name)
      .limit(1);
    if (!existing || existing.length === 0) {
      await supabase.from("categories").insert({ ...cat, user_id: user.id });
      console.log(`  Created category: ${cat.name}`);
    }
  }
  console.log("Ensured new categories exist");

  // 6. Fetch categories
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (!categories || categories.length === 0) {
    console.error("No categories found for user");
    process.exit(1);
  }
  console.log(`Categories: ${categories.length}`);

  // 7. Fetch ALL transactions
  const { data: transactions, error: txErr } = await supabase
    .from("transactions")
    .select("id, description, amount, type, transaction_date, category_id, account_id")
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false });

  if (txErr) throw txErr;
  if (!transactions || transactions.length === 0) {
    console.log("No transactions to process");
    return;
  }
  console.log(`\nProcessing ${transactions.length} transactions...\n`);

  // 8. Get account types for transactions
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, account_type")
    .eq("user_id", user.id);

  const accountTypeMap = new Map<string, string>();
  for (const a of accounts || []) {
    accountTypeMap.set(a.id, a.account_type);
  }

  // 9. Process each transaction
  let categorised = 0;
  let skipped = 0;
  let changed = 0;
  let failed = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (txn) => {
        try {
          const txnDirection = txn.type === "income" ? "income" : "expense";
          const accountType = txn.account_id ? accountTypeMap.get(txn.account_id) : undefined;

          const result = autoCategorise(
            {
              amount: txn.amount,
              date: txn.transaction_date,
              currency: "EUR",
              description: txn.description,
              merchant_name: txn.description,
              transaction_type: undefined,
              direction: txnDirection as "income" | "expense",
              user_industry: businessType,
              user_business_type: businessType,
              receipt_text: undefined,
              account_type: accountType,
              director_names: directorNames,
            },
            undefined,
            undefined,
          );

          const matchedCategory = findMatchingCategory(
            result.category,
            categories,
            txnDirection as "income" | "expense",
            accountType,
          );

          if (!matchedCategory || result.confidence_score < 40) {
            skipped++;
            return;
          }

          const vatRate = mapVatTypeToRate(result.vat_type);
          const vatCalc = vatRate > 0 ? calculateVATFromGross(Math.abs(txn.amount), vatRate) : { vatAmount: 0 };

          const isChange = txn.category_id !== matchedCategory.id;

          const { error: updateError } = await supabase
            .from("transactions")
            .update({
              category_id: matchedCategory.id,
              vat_rate: vatRate,
              vat_amount: vatCalc.vatAmount,
              notes: result.notes || null,
            })
            .eq("id", txn.id);

          if (updateError) {
            failed++;
            return;
          }

          categorised++;
          if (isChange) {
            changed++;
            const oldCat = categories.find((c) => c.id === txn.category_id)?.name || "(uncategorised)";
            console.log(
              `  ${txn.description?.substring(0, 40).padEnd(40)} | ${oldCat.padEnd(25)} → ${matchedCategory.name}`,
            );
          }
        } catch (err) {
          failed++;
        }
      }),
    );

    const pct = Math.round(((i + batch.length) / transactions.length) * 100);
    process.stdout.write(`\r  Progress: ${pct}% (${i + batch.length}/${transactions.length})`);
  }

  console.log(`\n\n--- Results ---`);
  console.log(`Total:       ${transactions.length}`);
  console.log(`Categorised: ${categorised}`);
  console.log(`Changed:     ${changed}`);
  console.log(`Skipped:     ${skipped} (low confidence or no match)`);
  console.log(`Failed:      ${failed}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
