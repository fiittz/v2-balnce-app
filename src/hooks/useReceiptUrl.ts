import { useState, useEffect } from "react";
import { getSignedReceiptUrl } from "@/lib/receiptStorage";

/**
 * Hook that resolves a receipt path/URL to a signed URL for display.
 * Returns null while loading, then the signed URL.
 */
export function useReceiptUrl(receiptPath: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!receiptPath) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    getSignedReceiptUrl(receiptPath).then((signed) => {
      if (!cancelled) setUrl(signed);
    });

    return () => { cancelled = true; };
  }, [receiptPath]);

  return url;
}
