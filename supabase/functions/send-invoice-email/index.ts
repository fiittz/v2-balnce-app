import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { invoiceId, pdfBase64, recipientEmail } = body || {};

    if (!invoiceId || !pdfBase64 || !recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: invoiceId, pdfBase64, recipientEmail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch invoice, profile, and onboarding in parallel
    const [invoiceResult, profileResult, onboardingResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("*, customer:customers(*)")
        .eq("id", invoiceId)
        .eq("user_id", user.id)
        .single(),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("onboarding_settings").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    if (invoiceResult.error || !invoiceResult.data) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invoice = invoiceResult.data;
    const profile = profileResult.data;
    const onboarding = onboardingResult.data;

    const businessName = onboarding?.business_name || profile?.business_name || "Balnce";
    const replyToEmail = user.email || "";
    const invoiceNumber = invoice.invoice_number || "Invoice";
    const customerName = invoice.customer?.name || "Customer";
    const total = Number(invoice.total || 0).toFixed(2);
    const dueDate = invoice.due_date
      ? new Date(invoice.due_date).toLocaleDateString("en-IE", { year: "numeric", month: "long", day: "numeric" })
      : "on receipt";

    // Build branded HTML email
    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Black Header -->
          <tr>
            <td style="background:#000000;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${escapeHtml(businessName)}</h1>
            </td>
          </tr>
          <!-- Gold Accent Bar -->
          <tr>
            <td style="background:#F2C300;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#111;font-size:16px;line-height:1.6;">
                Hi ${escapeHtml(customerName)},
              </p>
              <p style="margin:0 0 28px;color:#333;font-size:15px;line-height:1.6;">
                Please find attached invoice <strong>${escapeHtml(invoiceNumber)}</strong> from ${escapeHtml(businessName)}.
              </p>
              <!-- Invoice Summary Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;color:#666;font-size:13px;border-bottom:1px solid #e5e7eb;">Invoice Number</td>
                        <td style="padding:8px 0;color:#111;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">${escapeHtml(invoiceNumber)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#666;font-size:13px;border-bottom:1px solid #e5e7eb;">Amount Due</td>
                        <td style="padding:8px 0;color:#111;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">&euro;${escapeHtml(total)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#666;font-size:13px;">Due Date</td>
                        <td style="padding:8px 0;color:#111;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(dueDate)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#333;font-size:15px;line-height:1.6;">
                The full invoice is attached as a PDF for your records.
              </p>
              <p style="margin:28px 0 0;color:#333;font-size:15px;line-height:1.6;">
                Thank you for your business.
              </p>
              <p style="margin:8px 0 0;color:#333;font-size:15px;">
                Kind regards,<br>
                <strong>${escapeHtml(businessName)}</strong>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#999;font-size:12px;text-align:center;">
                Sent via <a href="https://balnce.ie" style="color:#F2C300;text-decoration:none;font-weight:600;">Balnce</a> &mdash; Accounting made simple
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send via Resend API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${businessName} <noreply@balnce.ie>`,
        reply_to: replyToEmail,
        to: [recipientEmail],
        subject: `Invoice ${invoiceNumber} — €${total}`,
        html: emailHtml,
        attachments: [
          {
            filename: `${invoiceNumber}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, resendError);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: resendError }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update invoice status to "sent" only after successful delivery
    await supabase
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", invoiceId)
      .eq("user_id", user.id);

    const resendData = await resendResponse.json();

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-invoice-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
