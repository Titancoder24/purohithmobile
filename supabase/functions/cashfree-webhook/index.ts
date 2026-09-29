import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-webhook-timestamp") || "";
  const signature = request.headers.get("x-webhook-signature") || "";
  const version = request.headers.get("x-webhook-version") || "";
  const secret = Deno.env.get("CASHFREE_PG_SECRET_KEY") || "";

  if (!secret || !timestamp || !signature || !version) return json({ error: "Webhook signature headers are missing" }, 401);
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return json({ error: "Webhook timestamp is outside the accepted window" }, 401);
  }
  if (!(await verifySignature(`${timestamp}${rawBody}`, signature, secret))) {
    return json({ error: "Webhook signature is invalid" }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Webhook body is not valid JSON" }, 400);
  }

  const merchantOrderId = clean(payload?.data?.order?.order_id);
  if (!merchantOrderId) return json({ error: "Cashfree order id is missing" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, getSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const rawBodyHash = await sha256(rawBody);
  const eventType = clean(payload?.type) || "UNKNOWN_CASHFREE_EVENT";
  const providerEventId = providerEventIdentifier(payload);
  const occurredAt = eventOccurredAt(payload);
  const { data: order } = await supabase.from("payment_orders").select("*")
    .eq("merchant_order_id", merchantOrderId).maybeSingle();
  if (!order) {
    const { error: unmatchedError } = await supabase.from("payment_events").insert({
      payment_order_id: null,
      provider_event_id: providerEventId || null,
      event_type: eventType,
      signature_valid: true,
      payload,
      raw_body_hash: rawBodyHash,
      occurred_at: occurredAt,
    });
    if (unmatchedError?.code !== "23505" && unmatchedError) throw unmatchedError;
    return json({ ok: true, unmatched: true });
  }

  const amountPaise = Math.round(Number(payload?.data?.order?.order_amount || 0) * 100);
  const currency = clean(payload?.data?.order?.order_currency).toUpperCase();
  if (amountPaise !== Number(order.amount_paise) || currency !== order.currency) {
    return json({ error: "Payment amount or currency does not match the order" }, 422);
  }

  const { error: eventError } = await supabase.from("payment_events").insert({
    payment_order_id: order.id,
    provider_event_id: providerEventId || null,
    event_type: eventType,
    signature_valid: true,
    payload,
    raw_body_hash: rawBodyHash,
    occurred_at: occurredAt,
  });

  if (eventError?.code === "23505") return json({ ok: true, duplicate: true });
  if (eventError) throw eventError;

  const nextStatus = mapEventStatus(payload, order);
  if (nextStatus) await applyPaymentState(supabase, order, payload, nextStatus);
  return json({ ok: true, order_id: merchantOrderId, status: nextStatus || order.status });
});

async function applyPaymentState(supabase: any, order: any, payload: any, status: string) {
  const now = new Date().toISOString();
  const payment = payload?.data?.payment || {};
  const metadata = {
    ...(order.metadata || {}),
    last_webhook_type: clean(payload?.type),
    last_cf_payment_id: clean(payment?.cf_payment_id) || null,
  };

  const { error } = await supabase.from("payment_orders").update({
    status,
    provider_status: clean(payment?.payment_status) || clean(payload?.type),
    paid_at: status === "paid" ? order.paid_at || payment?.payment_time || now : order.paid_at,
    verified_at: now,
    metadata,
    updated_at: now,
  }).eq("id", order.id);
  if (error) throw error;

  if (status === "paid") await markPaid(supabase, order, now);
  if (["failed", "expired", "cancelled"].includes(status)) {
    await supabase.from("bookings").update({ payment_status: status, updated_at: now }).eq("id", order.booking_id);
    if (order.request_id) await supabase.from("ceremony_requests").update({ payment_status: status, updated_at: now }).eq("id", order.request_id);
  }
  if (["refunded", "partially_refunded"].includes(status)) {
    await supabase.from("bookings").update({ payment_status: status, updated_at: now }).eq("id", order.booking_id);
    await supabase.from("provider_earnings").update({
      status: status === "refunded" ? "reversed" : "disputed",
      updated_at: now,
    }).eq("payment_order_id", order.id);
  }
  if (status === "disputed") await recordDispute(supabase, order, payload, now);
}

async function markPaid(supabase: any, order: any, now: string) {
  const { data: booking } = await supabase.from("bookings").select("*").eq("id", order.booking_id).maybeSingle();
  if (!booking) throw new Error("Booking for paid order was not found");

  const invoiceNumber = booking.invoice_no || makeInvoiceNumber();
  const invoiceHtml = booking.invoice_html || renderInvoice(invoiceNumber, booking, order);
  await supabase.from("bookings").update({
    payment_status: "paid",
    payment_id: order.id,
    payment_provider: "cashfree",
    provider_order_id: order.merchant_order_id,
    invoice_no: invoiceNumber,
    invoice_html: invoiceHtml,
    invoice_issued_at: booking.invoice_issued_at || now,
    updated_at: now,
  }).eq("id", booking.id);

  if (order.request_id) {
    await supabase.from("ceremony_requests").update({ payment_status: "paid", status: "awarded", updated_at: now }).eq("id", order.request_id);
  }

  const feePercent = Number(order.metadata?.fee_breakdown?.service_fee_percent) || (await getPlatformServiceFeePercent(supabase));
  const platformFee = typeof order.metadata?.fee_breakdown?.platform_fee_paise === "number"
    ? order.metadata.fee_breakdown.platform_fee_paise
    : Math.round(Number(order.amount_paise) * (feePercent / 100));
  await supabase.from("provider_earnings").upsert({
    booking_id: booking.id,
    payment_order_id: order.id,
    priest_id: order.priest_id,
    gross_paise: order.amount_paise,
    platform_fee_paise: platformFee,
    tax_paise: 0,
    status: "held",
    updated_at: now,
  }, { onConflict: "booking_id" });

  const { data: existingReport } = await supabase.from("payment_reports").select("id").eq("payment_order_id", order.id).maybeSingle();
  const { error: reportError } = await supabase.from("payment_reports").upsert({
    payment_order_id: order.id,
    booking_id: booking.id,
    customer_id: order.customer_id,
    priest_id: order.priest_id,
    invoice_number: invoiceNumber,
    invoice_html: invoiceHtml,
    amount_paise: order.amount_paise,
    currency: order.currency || "INR",
    provider: "cashfree",
    provider_payment_id: order.provider_order_id,
    paid_at: order.paid_at || now,
    report_data: {
      merchant_order_id: order.merchant_order_id,
      ceremony: booking.pooja_name,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      address: booking.address,
      customer_name: booking.customer_name,
      priest_name: booking.priest_name,
      payment_status: "paid",
    },
    updated_at: now,
  }, { onConflict: "payment_order_id" });
  if (reportError) throw reportError;

  if (!existingReport) {
    await supabase.from("provider_notifications").insert({
      priest_id: order.priest_id,
      request_id: order.request_id || null,
      title: "Payment confirmed and invoice ready",
      body: `${booking.pooja_name || order.pooja_slug || "Ceremony"} · ${invoiceNumber} · ₹${(Number(order.amount_paise) / 100).toLocaleString("en-IN")}`,
    }).then(() => undefined, () => undefined);
  }
}

async function recordDispute(supabase: any, order: any, payload: any, now: string) {
  const dispute = payload?.data?.dispute || payload?.data?.chargeback || {};
  const providerDisputeId = clean(dispute?.cf_dispute_id || dispute?.dispute_id || providerEventIdentifier(payload));
  await supabase.from("provider_earnings").update({ status: "disputed", updated_at: now }).eq("payment_order_id", order.id);
  const disputeRecord = {
    payment_order_id: order.id,
    booking_id: order.booking_id,
    customer_id: order.customer_id,
    priest_id: order.priest_id,
    provider: "cashfree",
    provider_dispute_id: providerDisputeId || null,
    event_type: clean(payload?.type) || "CASHFREE_DISPUTE",
    status: disputeStatus(dispute),
    amount_paise: dispute?.dispute_amount ? Math.round(Number(dispute.dispute_amount) * 100) : null,
    reason: clean(dispute?.reason || dispute?.dispute_reason) || null,
    provider_payload: payload,
    updated_at: now,
  };
  if (providerDisputeId) {
    await supabase.from("payment_disputes").upsert(disputeRecord, { onConflict: "provider,provider_dispute_id" });
  } else {
    await supabase.from("payment_disputes").insert(disputeRecord);
  }
}

function mapEventStatus(payload: any, order: any) {
  const event = clean(payload?.type).toUpperCase();
  const paymentStatus = clean(payload?.data?.payment?.payment_status).toUpperCase();
  const refundStatus = clean(payload?.data?.refund?.refund_status).toUpperCase();
  if (event.includes("DISPUTE") || event.includes("CHARGEBACK")) return "disputed";
  if (event.includes("REFUND") && ["SUCCESS", "PROCESSED"].includes(refundStatus)) {
    const refundPaise = Math.round(Number(payload?.data?.refund?.refund_amount || 0) * 100);
    return refundPaise >= Number(order.amount_paise) ? "refunded" : "partially_refunded";
  }
  if (event.includes("USER_DROPPED")) return "active";
  if (event.includes("PAYMENT_SUCCESS") || paymentStatus === "SUCCESS") return "paid";
  if (event.includes("PAYMENT_FAILED") || paymentStatus === "FAILED") return "failed";
  return "";
}

function disputeStatus(dispute: any) {
  const value = clean(dispute?.dispute_status || dispute?.status).toUpperCase();
  if (["WON", "MERCHANT_WON"].includes(value)) return "won";
  if (["LOST", "MERCHANT_LOST"].includes(value)) return "lost";
  if (["CLOSED", "RESOLVED"].includes(value)) return "closed";
  if (["UNDER_REVIEW", "IN_REVIEW"].includes(value)) return "under_review";
  return "open";
}

function providerEventIdentifier(payload: any) {
  const data = payload?.data || {};
  return clean(data?.payment?.cf_payment_id || data?.refund?.cf_refund_id || data?.dispute?.cf_dispute_id || data?.chargeback?.cf_dispute_id);
}

function eventOccurredAt(payload: any) {
  const data = payload?.data || {};
  const value = data?.payment?.payment_time || data?.refund?.processed_at || data?.dispute?.created_at || payload?.event_time;
  return value ? new Date(value).toISOString() : null;
}

async function verifySignature(message: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  const expected = bytesToBase64(signed);
  return constantTimeEqual(expected, signature);
}

async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function constantTimeEqual(left: string, right: string) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}

function renderInvoice(invoiceNumber: string, booking: any, order: any) {
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(order.amount_paise) / 100);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoiceNumber)}</title><style>body{font-family:Arial,sans-serif;color:#2b1b14;margin:40px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #ea580c;padding-bottom:20px}.total{font-size:28px;font-weight:700}.muted{color:#6b625e}</style></head><body><div class="head"><div><h1>Purohith Connect</h1><p class="muted">Book · Perform · Bless</p></div><div><strong>${escapeHtml(invoiceNumber)}</strong><p class="muted">Paid via Cashfree</p></div></div><h2>${escapeHtml(booking.pooja_name || order.pooja_slug || "Ceremony booking")}</h2><p>${escapeHtml(booking.booking_date || "")} ${escapeHtml(booking.booking_time || "")}</p><p>${escapeHtml(booking.address || "")}</p><p class="total">${escapeHtml(amount)}</p><p>Cashfree order: ${escapeHtml(order.merchant_order_id)}</p><p class="muted">Payment confirmed by a signed provider webhook.</p></body></html>`;
}

function makeInvoiceNumber() {
  return `PC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function getPlatformServiceFeePercent(supabase: any): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "payment_service_fee_percent")
      .maybeSingle();
    if (error || !data?.value) return 10;
    const parsed = Number(data.value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
  } catch {
    return 10;
  }
}

function getSupabaseSecretKey() {
  return Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function escapeHtml(value: unknown) {
  return clean(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}
