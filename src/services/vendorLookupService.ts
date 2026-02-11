import { supabase } from "@/integrations/supabase/client";

export interface VendorLookupResult {
  vendor_name: string;
  is_business_expense: boolean | null;
  confidence: number;
  vendor_type: string;
  category_suggestion: string;
  vat_rate_suggestion: string;
  is_vat_recoverable: boolean;
  explanation: string;
}

/**
 * Lookup a vendor using AI to determine if it's a business expense
 */
export async function lookupVendor(
  vendorName: string,
  amount?: number,
  userIndustry?: string,
  userBusinessType?: string
): Promise<VendorLookupResult> {
  try {
    const { data, error } = await supabase.functions.invoke("lookup-vendor", {
      body: {
        vendor_name: vendorName,
        amount,
        user_industry: userIndustry,
        user_business_type: userBusinessType,
      },
    });

    if (error) {
      console.error("[VendorLookup] Error:", error);
      throw error;
    }

    return data as VendorLookupResult;
  } catch (error) {
    console.error("[VendorLookup] Failed:", error);
    // Return a default uncertain result
    return {
      vendor_name: vendorName,
      is_business_expense: null,
      confidence: 0,
      vendor_type: "Unknown",
      category_suggestion: "General Expenses",
      vat_rate_suggestion: "standard_23",
      is_vat_recoverable: true,
      explanation: "Vendor lookup failed - please review manually",
    };
  }
}

/**
 * Batch lookup multiple vendors (with rate limiting)
 */
export async function lookupVendorsBatch(
  vendors: Array<{ name: string; amount?: number }>,
  userIndustry?: string,
  userBusinessType?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, VendorLookupResult>> {
  const results = new Map<string, VendorLookupResult>();
  const uniqueVendors = [...new Set(vendors.map(v => v.name))];
  
  // Process in batches of 5 with delays to avoid rate limiting
  const BATCH_SIZE = 5;
  const DELAY_MS = 500;
  
  for (let i = 0; i < uniqueVendors.length; i += BATCH_SIZE) {
    const batch = uniqueVendors.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.all(
      batch.map(async (vendorName) => {
        const vendor = vendors.find(v => v.name === vendorName);
        const result = await lookupVendor(
          vendorName,
          vendor?.amount,
          userIndustry,
          userBusinessType
        );
        return { name: vendorName, result };
      })
    );
    
    batchResults.forEach(({ name, result }) => {
      results.set(name, result);
    });
    
    onProgress?.(Math.min(i + BATCH_SIZE, uniqueVendors.length), uniqueVendors.length);
    
    // Add delay between batches
    if (i + BATCH_SIZE < uniqueVendors.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  return results;
}
