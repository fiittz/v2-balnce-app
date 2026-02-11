import { supabase } from "@/integrations/supabase/client";

export async function seedDefaultAccount(userId: string): Promise<string | null> {
  try {
    // Check if user already has accounts
    const { data: existing, error: checkError } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (checkError) {
      console.error("Error checking existing accounts:", checkError);
      return null;
    }

    // If accounts already exist, return the first one
    if (existing && existing.length > 0) {
      return existing[0].id;
    }

    // Create a default bank account
    const { data: newAccount, error: insertError } = await supabase
      .from("accounts")
      .insert({
        user_id: userId,
        name: "Business Current Account",
        account_type: "limited_company",
        currency: "EUR",
        balance: 0,
        is_default: true,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error creating default account:", insertError);
      return null;
    }

    console.log("Successfully created default account for user:", userId);
    return newAccount.id;
  } catch (error) {
    console.error("Error in seedDefaultAccount:", error);
    return null;
  }
}
