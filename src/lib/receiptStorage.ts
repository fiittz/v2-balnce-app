import { supabase } from "@/integrations/supabase/client";

const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Extract the storage path from a receipt URL or path.
 * Handles both legacy full public URLs and plain paths.
 */
export function extractReceiptPath(urlOrPath: string): string {
  if (urlOrPath.startsWith("http")) {
    // Legacy full URL — extract path after /receipts/
    const match = urlOrPath.match(/\/receipts\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : urlOrPath;
  }
  return urlOrPath;
}

/**
 * Generate a signed URL for a receipt (private bucket).
 * Works with both legacy public URLs and plain storage paths.
 */
export async function getSignedReceiptUrl(receiptPath: string): Promise<string | null> {
  const path = extractReceiptPath(receiptPath);

  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, SIGNED_URL_EXPIRY);

  if (error) {
    console.error("Signed URL error:", error);
    return null;
  }
  return data.signedUrl;
}
