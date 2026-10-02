import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, getSupabaseSecretKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const userId = await getUserId(req, supabase);
    if (!userId) return json({ error: "Authentication required" }, 401);

    if (body.action === "register_token") return registerToken(supabase, userId, body);
    if (body.action === "unregister_token") return unregisterToken(supabase, userId, body);
    if (body.action === "ring" || body.action === "missed") return notifyCall(supabase, userId, body);
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: String((error as Error)?.message || error) }, 500);
  }
});

async function registerToken(supabase: any, userId: string, body: any) {
  const token = clean(body.token);
  const platform = clean(body.platform);
  if (!EXPO_TOKEN.test(token)) return json({ error: "Invalid push token" }, 400);
  if (platform !== "ios" && platform !== "android") return json({ error: "Invalid platform" }, 400);
  const { error } = await supabase.from("push_tokens").upsert(
    { token, user_id: userId, platform, updated_at: new Date().toISOString() },
    { onConflict: "token" },
  );
  if (error) throw error;
  return json({ ok: true });
}

async function unregisterToken(supabase: any, userId: string, body: any) {
  const token = clean(body.token);
  if (!token) return json({ ok: true });
  await supabase.from("push_tokens").delete().eq("token", token).eq("user_id", userId);
  return json({ ok: true });
}

async function notifyCall(supabase: any, userId: string, body: any) {
  const bookingId = clean(body.booking_id);
  if (!UUID.test(bookingId)) return json({ error: "Booking is required" }, 400);

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,customer_id,priest_id,pooja_name,priest_profiles(user_id,display_name)")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return json({ error: "Booking not found" }, 404);
  const priest = Array.isArray(booking.priest_profiles) ? booking.priest_profiles[0] : booking.priest_profiles;
  const priestUserId = priest?.user_id || null;

  let callerName = "";
  let recipientId = "";
  if (booking.customer_id === userId) {
    recipientId = priestUserId;
    const { data: customer } = await supabase.from("app_users").select("full_name").eq("id", userId).maybeSingle();
    callerName = clean(customer?.full_name) || "Customer";
  } else if (priestUserId && priestUserId === userId) {
    recipientId = booking.customer_id;
    callerName = clean(priest?.display_name) || "Purohit";
  } else {
    return json({ error: "Only booking participants can call" }, 403);
  }
  if (!recipientId) return json({ ok: true, sent: 0 });

  const since = new Date(Date.now() - (body.action === "ring" ? 60 : 180) * 1000).toISOString();
  const { data: signals } = await supabase
    .from("booking_call_signals")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("sender_id", userId)
    .eq("signal_type", "ready")
    .gte("created_at", since)
    .limit(1);
  if (!signals?.length) return json({ error: "No active call to notify about" }, 409);

  const { data: tokens } = await supabase.from("push_tokens").select("token").eq("user_id", recipientId);
  if (!tokens?.length) return json({ ok: true, sent: 0 });

  const pooja = clean(booking.pooja_name) || "Booking call";
  const ring = body.action === "ring";
  const messages = tokens.map(({ token }: { token: string }) => ring
    ? {
      to: token,
      title: `${callerName} is calling`,
      body: `Video call · ${pooja}`,
      sound: "default",
      priority: "high",
      channelId: "calls",
      categoryId: "incoming_call",
      ttl: 45,
      data: { type: "call", bookingId, callerName, poojaName: pooja },
    }
    : {
      to: token,
      title: "Missed video call",
      body: `${callerName} · ${pooja}`,
      sound: "default",
      priority: "high",
      channelId: "default",
      data: { type: "missed_call", bookingId, callerName, poojaName: pooja },
    });

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
  const result = await response.json().catch(() => ({}));
  const tickets = Array.isArray(result?.data) ? result.data : [];
  const stale = tickets
    .map((ticket: any, index: number) => ticket?.details?.error === "DeviceNotRegistered" ? messages[index].to : null)
    .filter(Boolean);
  if (stale.length) await supabase.from("push_tokens").delete().in("token", stale);

  return json({ ok: response.ok, sent: tickets.filter((ticket: any) => ticket?.status === "ok").length });
}

async function getUserId(req: Request, supabase: any) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id as string;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function getSupabaseSecretKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    const parsed = JSON.parse(secretKeys);
    if (parsed.default) return parsed.default;
  }
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRole) return serviceRole;
  throw new Error("Supabase secret key is not configured for this function.");
}
