import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEMPLATE_SUBJECTS: Record<string, string> = {
  welcome_customer: "Welcome to Purohith Connect",
  welcome_priest: "Welcome to Purohith Connect for Purohits",
  booking_requested: "Your puja request has been created",
  proposal_received: "A purohit sent a proposal",
  password_help: "Purohith Connect account help",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM_EMAIL") || "Purohith Connect <no-reply@purohithconnect.com>";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = getSupabaseSecretKey();
    if (!resendApiKey || !supabaseUrl || !serviceKey) return json({ error: "Email service is not configured" }, 503);

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !authData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const template = sanitizeTemplate(body.template);
    const to = sanitizeEmail(body.to || authData.user.email);
    if (!to) return json({ error: "Valid recipient email is required" }, 400);

    const profile = await loadProfile(supabase, authData.user.id);
    if (to !== authData.user.email && !["admin", "super_admin"].includes(profile?.role || "")) {
      return json({ error: "Only admins can email another recipient" }, 403);
    }

    const subject = TEMPLATE_SUBJECTS[template];
    const html = renderHtml(template, {
      name: body.name || profile?.full_name || authData.user.email?.split("@")[0] || "there",
      actionUrl: body.action_url || "",
      detail: body.detail || "",
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    const payload = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      return json({ error: "Resend delivery failed", detail: payload?.message || payload?.error || "Unknown error" }, 502);
    }

    await supabase.from("email_delivery_events").insert({
      user_id: authData.user.id,
      template,
      recipient: to,
      provider: "resend",
      provider_message_id: payload?.id || null,
      status: "sent",
    }).throwOnError();

    return json({ ok: true, id: payload?.id || null });
  } catch (error) {
    return json({ error: error?.message || "Unexpected email error" }, 500);
  }
});

function sanitizeTemplate(value: string) {
  const template = String(value || "").trim();
  if (!TEMPLATE_SUBJECTS[template]) throw new Error("Unsupported email template");
  return template;
}

function sanitizeEmail(value: string) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function renderHtml(template: string, data: { name: string; actionUrl: string; detail: string }) {
  const escapedName = escapeHtml(data.name);
  const escapedDetail = escapeHtml(data.detail);
  const action = data.actionUrl
    ? `<p style="margin:28px 0"><a href="${escapeAttribute(data.actionUrl)}" style="background:#e65319;color:#fff;padding:13px 18px;border-radius:10px;text-decoration:none;font-weight:700">Open Purohith Connect</a></p>`
    : "";
  const templateLines: Record<string, string> = {
    welcome_customer: "Your Purohith Connect customer account is ready. You can request proposals, compare verified purohits, and track active bookings.",
    welcome_priest: "Your Purohith Connect priest workspace is ready. You can receive matching ceremony requests, send proposals, and manage bookings.",
    booking_requested: "Your puja request has been created. We will notify you as soon as verified purohits send proposals.",
    proposal_received: "A verified purohit has sent a proposal for your ceremony. Review the profile, pricing, and availability before accepting.",
    password_help: "Use the secure link from Supabase Auth to complete password recovery. If you did not request this, you can ignore the email.",
  };

  return `
  <div style="font-family:Inter,Arial,sans-serif;background:#fff7ed;padding:28px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #fed7aa;border-radius:18px;padding:28px">
      <p style="margin:0 0 8px;color:#e65319;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:12px">Purohith Connect</p>
      <h1 style="margin:0;color:#191919;font-size:24px;line-height:1.25">Namaskara, ${escapedName}</h1>
      <p style="color:#55514c;font-size:15px;line-height:1.7">${templateLines[template]}</p>
      ${escapedDetail ? `<p style="color:#191919;font-size:14px;line-height:1.6">${escapedDetail}</p>` : ""}
      ${action}
      <p style="border-top:1px solid #f0e5d9;margin-top:28px;padding-top:18px;color:#78716c;font-size:12px">This email was sent securely by Purohith Connect.</p>
    </div>
  </div>`;
}

async function loadProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase.from("app_users").select("role,full_name").eq("id", userId).maybeSingle();
  return data;
}

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]!));
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function getSupabaseSecretKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      return parsed.default || parsed.service_role || parsed.serviceRole;
    } catch (_) {
      return secretKeys;
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
