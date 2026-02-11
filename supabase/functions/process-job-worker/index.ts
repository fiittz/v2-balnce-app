import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const CHUNK_SIZE = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { job_id } = await req.json();

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the job
    const { data: job, error: jobError } = await supabase
      .from("processing_jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if already completed/cancelled
    if (["completed", "failed", "cancelled"].includes(job.status)) {
      return new Response(
        JSON.stringify({ message: "Job already finished", status: job.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as processing
    if (job.status === "pending") {
      await supabase
        .from("processing_jobs")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", job_id);
    }

    let result;
    switch (job.job_type) {
      case "receipt_ocr":
        result = await processReceiptOCR(supabase, job);
        break;
      case "categorization":
        result = await processCategorization(supabase, job);
        break;
      case "matching":
        result = await processMatching(supabase, job);
        break;
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-job-worker error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ---------------------------------------------------------------------------
// Receipt OCR Processing
// ---------------------------------------------------------------------------
async function processReceiptOCR(supabase: any, job: any) {
  const inputData = job.input_data as {
    file_paths: string[];
    categories?: any[];
  };

  const filePaths = inputData.file_paths || [];
  const startIdx = job.processed_items || 0;
  const chunk = filePaths.slice(startIdx, startIdx + CHUNK_SIZE);
  let processed = job.processed_items || 0;
  let failed = job.failed_items || 0;
  const results: any[] = (job.result_data as any)?.results || [];

  for (const filePath of chunk) {
    try {
      // Check if job was cancelled
      const { data: currentJob } = await supabase
        .from("processing_jobs")
        .select("status")
        .eq("id", job.id)
        .single();

      if (currentJob?.status === "cancelled") {
        return { message: "Job cancelled", processed, failed };
      }

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("receipts")
        .download(filePath);

      if (downloadError) throw downloadError;

      // Convert to base64
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // Call AI for OCR
      const ocrResult = await callReceiptOCR(base64, inputData.categories);

      if (ocrResult.success && ocrResult.data) {
        // Save receipt record
        const { data: receipt } = await supabase
          .from("receipts")
          .insert([{
            user_id: job.user_id,
            image_url: getPublicUrl(filePath),
            vendor_name: ocrResult.data.supplier_name,
            amount: ocrResult.data.total_amount,
            vat_amount: ocrResult.data.vat_amount,
            vat_rate: ocrResult.data.vat_rate
              ? parseFloat(String(ocrResult.data.vat_rate).replace(/[^0-9.]/g, "")) || null
              : null,
            receipt_date: ocrResult.data.date,
            ocr_data: ocrResult.data,
          }])
          .select("id")
          .single();

        results.push({ filePath, receiptId: receipt?.id, status: "done" });
      } else {
        results.push({ filePath, status: "error", error: "OCR returned no data" });
        failed++;
      }

      processed++;
    } catch (err) {
      console.error("Receipt OCR error for", filePath, err);
      results.push({
        filePath,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
      processed++;
      failed++;
    }

    // Update progress after each item (triggers Realtime)
    await supabase
      .from("processing_jobs")
      .update({
        processed_items: processed,
        failed_items: failed,
        result_data: { results },
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }

  // Check if more items remain
  if (processed < filePaths.length) {
    // Self-invoke for next chunk
    await selfInvoke(job.id);
    return { message: "Chunk complete, continuing", processed, total: filePaths.length };
  }

  // Job complete
  await supabase
    .from("processing_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      result_data: { results },
    })
    .eq("id", job.id);

  return { message: "Job completed", processed, failed, total: filePaths.length };
}

// ---------------------------------------------------------------------------
// Categorization Processing
// ---------------------------------------------------------------------------
async function processCategorization(supabase: any, job: any) {
  const inputData = job.input_data as {
    transaction_ids: string[];
    business_type?: string;
  };

  const txIds = inputData.transaction_ids || [];
  const startIdx = job.processed_items || 0;
  const chunk = txIds.slice(startIdx, startIdx + CHUNK_SIZE);
  let processed = job.processed_items || 0;
  let failed = job.failed_items || 0;

  // Fetch categories for the user
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", job.user_id)
    .order("name");

  // Fetch accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("account_type")
    .order("name");

  for (const txId of chunk) {
    try {
      // Check cancellation
      const { data: currentJob } = await supabase
        .from("processing_jobs")
        .select("status")
        .eq("id", job.id)
        .single();

      if (currentJob?.status === "cancelled") {
        return { message: "Job cancelled", processed, failed };
      }

      // Fetch transaction
      const { data: tx } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", txId)
        .single();

      if (!tx) {
        failed++;
        processed++;
        continue;
      }

      // Call categorize-transaction edge function logic inline
      const catResult = await callCategorization(tx, categories, inputData.business_type);

      if (catResult && catResult.category_name) {
        const matchedCat = categories?.find(
          (c: any) => c.name.toLowerCase() === catResult.category_name.toLowerCase()
        );

        if (matchedCat) {
          await supabase
            .from("transactions")
            .update({
              category_id: matchedCat.id,
              notes: catResult.business_purpose || null,
            })
            .eq("id", txId);
        }
      }

      processed++;
    } catch (err) {
      console.error("Categorization error for", txId, err);
      processed++;
      failed++;
    }

    // Update progress
    await supabase
      .from("processing_jobs")
      .update({
        processed_items: processed,
        failed_items: failed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }

  if (processed < txIds.length) {
    await selfInvoke(job.id);
    return { message: "Chunk complete, continuing", processed, total: txIds.length };
  }

  await supabase
    .from("processing_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  return { message: "Job completed", processed, failed, total: txIds.length };
}

// ---------------------------------------------------------------------------
// Matching Processing
// ---------------------------------------------------------------------------
async function processMatching(supabase: any, job: any) {
  const inputData = job.input_data as { receipt_ids?: string[] };
  const receiptIds = inputData.receipt_ids || [];
  const startIdx = job.processed_items || 0;
  const chunk = receiptIds.slice(startIdx, startIdx + CHUNK_SIZE);
  let processed = job.processed_items || 0;
  let failed = job.failed_items || 0;

  for (const receiptId of chunk) {
    try {
      const { data: currentJob } = await supabase
        .from("processing_jobs")
        .select("status")
        .eq("id", job.id)
        .single();

      if (currentJob?.status === "cancelled") {
        return { message: "Job cancelled", processed, failed };
      }

      // Fetch receipt
      const { data: receipt } = await supabase
        .from("receipts")
        .select("*")
        .eq("id", receiptId)
        .single();

      if (!receipt) {
        failed++;
        processed++;
        continue;
      }

      // Simple matching: find transaction with similar amount and date
      const { data: candidates } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", job.user_id)
        .eq("is_reconciled", false)
        .gte("transaction_date", getDateOffset(receipt.receipt_date, -30))
        .lte("transaction_date", getDateOffset(receipt.receipt_date, 30))
        .order("transaction_date", { ascending: false });

      if (candidates && candidates.length > 0 && receipt.amount) {
        // Find best match by amount
        const best = candidates.reduce((prev: any, curr: any) => {
          const prevDiff = Math.abs(Math.abs(prev.amount) - receipt.amount);
          const currDiff = Math.abs(Math.abs(curr.amount) - receipt.amount);
          return currDiff < prevDiff ? curr : prev;
        });

        const amountDiff = Math.abs(Math.abs(best.amount) - receipt.amount);
        if (amountDiff < 1.0) {
          // Auto-match
          await supabase
            .from("transactions")
            .update({ is_reconciled: true, receipt_url: receipt.image_url })
            .eq("id", best.id);

          await supabase
            .from("receipts")
            .update({ transaction_id: best.id })
            .eq("id", receiptId);
        }
      }

      processed++;
    } catch (err) {
      console.error("Matching error for receipt", receiptId, err);
      processed++;
      failed++;
    }

    await supabase
      .from("processing_jobs")
      .update({
        processed_items: processed,
        failed_items: failed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }

  if (processed < receiptIds.length) {
    await selfInvoke(job.id);
    return { message: "Chunk complete, continuing", processed, total: receiptIds.length };
  }

  await supabase
    .from("processing_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  return { message: "Job completed", processed, failed, total: receiptIds.length };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getPublicUrl(filePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/receipts/${filePath}`;
}

function getDateOffset(dateStr: string | null, days: number): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

async function selfInvoke(jobId: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/process-job-worker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ job_id: jobId }),
    });
  } catch (err) {
    console.error("Self-invoke failed:", err);
  }
}

async function callReceiptOCR(base64: string, categories?: any[]) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an expert Irish receipt OCR AI. Extract structured data from receipt images.
Available categories: ${categories?.map((c: any) => c.name).join(", ") || "Not provided"}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract receipt data as JSON: { "success": true, "data": { "supplier_name": "...", "date": "YYYY-MM-DD", "total_amount": 0, "vat_amount": null, "vat_rate": "standard_23|reduced_13_5|...", "suggested_category": "..." } }`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64}` },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) throw new Error(`AI error: ${response.status}`);
  const aiResp = await response.json();
  return JSON.parse(aiResp.choices?.[0]?.message?.content || "{}");
}

async function callCategorization(tx: any, categories: any[], businessType?: string) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an Irish bookkeeping categorisation AI. Categorise this transaction.
Categories: ${categories?.map((c: any) => `${c.name} (${c.type})`).join(", ")}
Business type: ${businessType || "general"}
Return JSON: { "category_name": "...", "vat_rate": "...", "confidence": 0-100, "business_purpose": "..." }`,
        },
        {
          role: "user",
          content: `Description: ${tx.description}\nAmount: €${Math.abs(tx.amount).toFixed(2)}\nType: ${tx.type}\nDate: ${tx.transaction_date}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) throw new Error(`AI error: ${response.status}`);
  const aiResp = await response.json();
  const content = aiResp.choices?.[0]?.message?.content;
  try {
    return JSON.parse(content || "{}");
  } catch {
    return null;
  }
}
