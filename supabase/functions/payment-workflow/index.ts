import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UPI_ID = "sgmsfreshmindsservicesllp.8050934625.ibz@icici";
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
    const identity = await getIdentity(req, supabase);
    if (!identity) return json({ error: "Authentication required" }, 401);

    if (body.action === "create_request") return createRequest(supabase, body, identity);
    if (body.action === "submit_payment") return submitPayment(supabase, body, identity);
    if (body.action === "list_proposals") return listProposals(supabase, body, identity);
    if (body.action === "award_proposal") return awardProposal(supabase, body, identity);
    if (body.action === "provider_requests") return providerRequests(supabase, body, identity);
    if (body.action === "send_proposal") return sendProposal(supabase, body, identity);
    if (body.action === "create_cashfree_order") return createCashfreeOrder(supabase, body, identity);
    if (body.action === "verify_cashfree_order") return verifyCashfreeOrder(supabase, body, identity);
    if (body.action === "list_payment_reports") return listPaymentReports(supabase, identity);
    if (body.action === "list_bookings") return listBookings(supabase, identity);
    if (body.action === "provider_booking_action") return providerBookingAction(supabase, body, identity);
    if (body.action === "set_tracking_consent") return setTrackingConsent(supabase, body, identity);
    if (body.action === "push_booking_location") return pushBookingLocation(supabase, body, identity);
    if (body.action === "get_booking_location") return getBookingLocation(supabase, body, identity);
    if (body.action === "approve_provider_release") return approveProviderRelease(supabase, body, identity);
    if (body.action === "direct_booking_payment") return json({ error: "Screenshot checkout is retired. Use Cashfree checkout." }, 410);
    if (body.action === "admin_verify_payment") return adminVerifyPayment(supabase, body, identity);

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
});

async function createRequest(supabase: any, body: any, identity: any) {
  const customerId = identity.id;
  if (!clean(body.address) || !clean(body.pooja_slug)) return json({ error: "Ceremony and address are required" }, 400);

  const { data: pooja } = await supabase.from("poojas").select("slug,name,base_price_inr").eq("slug", clean(body.pooja_slug)).maybeSingle();
  const payload = {
    customer_id: customerId,
    pooja_slug: clean(body.pooja_slug),
    ceremony_date: clean(body.ceremony_date),
    ceremony_time: clean(body.ceremony_time),
    address: clean(body.address),
    landmark: clean(body.landmark),
    notes: clean(body.notes),
    budget_min_inr: numberOrNull(body.budget_min_inr ?? body.budget_min),
    budget_max_inr: numberOrNull(body.budget_max_inr ?? body.budget_max),
    latitude: numberOrNull(body.lat ?? body.latitude),
    longitude: numberOrNull(body.lng ?? body.longitude),
    status: "open",
    payment_status: "unpaid",
  };
  const { data, error } = await supabase.from("ceremony_requests").insert(payload).select("*").single();
  if (error) throw error;
  return json({
    request: mapRequest(data, pooja),
    upi_id: UPI_ID,
    recommended_amount_inr: payload.budget_max_inr || payload.budget_min_inr || pooja?.base_price_inr || 1000,
  });
}

async function submitPayment(supabase: any, body: any, identity: any) {
  const requestId = cleanUuid(body.request_id);
  const bookingId = cleanUuid(body.booking_id);
  if (!requestId && !bookingId) return json({ error: "Request or booking id is required" }, 400);
  const amount = Number(body.amount_inr || 0);
  if (!amount || amount < 1) return json({ error: "Payment amount is required" }, 400);

  const context = requestId ? await loadRequestContext(supabase, requestId) : await loadBookingContext(supabase, bookingId);
  if (!context) return json({ error: "Payment context not found" }, 404);
  if (context.customer_id !== identity.id && !isAdmin(identity)) return json({ error: "Payment context does not belong to this account" }, 403);

  const ai = await verifyScreenshotWithOpenAI(supabase, body.screenshot_data_url, amount);
  const status = ai.verified && ai.confidence >= 0.7 ? "ai_verified" : "submitted";
  const invoiceNumber = makeInvoiceNumber();
  const invoiceHtml = renderInvoice({
    invoiceNumber,
    amount,
    customerName: context.customer_name || "Customer",
    poojaName: context.pooja_name || clean(body.pooja_name) || "Purohith Connect Ceremony",
    ceremonyDate: context.ceremony_date || context.booking_date || "",
    ceremonyTime: context.ceremony_time || context.booking_time || "",
    address: context.address || "",
    upiId: UPI_ID,
    status,
  });

  const { data: payment, error } = await supabase.from("payment_submissions").insert({
    request_id: requestId,
    booking_id: bookingId,
    customer_id: context.customer_id,
    priest_id: context.priest_id || null,
    pooja_slug: context.pooja_slug || clean(body.pooja_slug),
    pooja_name: context.pooja_name || clean(body.pooja_name),
    amount_inr: amount,
    upi_id: UPI_ID,
    status,
    screenshot_data_url: clean(body.screenshot_data_url),
    ai_verified: ai.verified,
    ai_confidence: ai.confidence,
    ai_summary: ai.summary,
    ai_provider: ai.provider,
    invoice_number: invoiceNumber,
    invoice_html: invoiceHtml,
    metadata: { verification: ai.raw || null },
  }).select("*").single();
  if (error) throw error;

  if (requestId) {
    await supabase.from("ceremony_requests").update({
      payment_status: status,
      payment_submission_id: payment.id,
      invoice_number: invoiceNumber,
      status: "open",
      updated_at: new Date().toISOString(),
    }).eq("id", requestId);
  }
  if (bookingId) {
    await supabase.from("bookings").update({
      payment_status: status,
      payment_submission_id: payment.id,
      invoice_no: invoiceNumber,
      invoice_html: invoiceHtml,
      updated_at: new Date().toISOString(),
    }).eq("id", bookingId);
  }

  return json({ payment, invoice_number: invoiceNumber, invoice_html: invoiceHtml, ai, upi_id: UPI_ID });
}

async function listProposals(supabase: any, body: any, identity: any) {
  const requestId = cleanUuid(body.request_id);
  if (!requestId) return json({ proposals: [] });
  const { data: request } = await supabase.from("ceremony_requests").select("customer_id").eq("id", requestId).maybeSingle();
  if (!request || (request.customer_id !== identity.id && !isAdmin(identity))) return json({ error: "Request not found" }, 404);
  const { data, error } = await supabase.from("ceremony_proposals")
    .select("id,request_id,priest_id,amount_inr,message,includes_samagri,status,created_at,priest_profiles(display_name,rating,review_count,photo_url)")
    .eq("request_id", requestId)
    .order("amount_inr", { ascending: true });
  if (error) throw error;
  return json({ proposals: (data || []).map(mapProposal) });
}

async function awardProposal(supabase: any, body: any, identity: any) {
  const requestId = cleanUuid(body.request_id);
  const proposalId = cleanUuid(body.proposal_id);
  if (!requestId || !proposalId) return json({ error: "Request and proposal are required" }, 400);
  const { data: proposal, error } = await supabase.from("ceremony_proposals").select("*").eq("id", proposalId).eq("request_id", requestId).maybeSingle();
  if (error) throw error;
  if (!proposal) return json({ error: "Proposal not found" }, 404);
  const { data: request } = await supabase.from("ceremony_requests").select("id,customer_id,pooja_slug,ceremony_date,ceremony_time,address,landmark,latitude,longitude").eq("id", requestId).maybeSingle();
  if (!request || (request.customer_id !== identity.id && !isAdmin(identity))) return json({ error: "Request not found" }, 404);
  const { data: pooja } = request?.pooja_slug ? await supabase.from("poojas").select("name").eq("slug", request.pooja_slug).maybeSingle() : { data: null };
  const { data: priest } = proposal.priest_id ? await supabase.from("priest_profiles").select("display_name,rating,review_count,photo_url").eq("id", proposal.priest_id).maybeSingle() : { data: null };
  await supabase.from("ceremony_proposals").update({ status: "declined" }).eq("request_id", requestId).neq("id", proposalId);
  await supabase.from("ceremony_proposals").update({ status: "accepted" }).eq("id", proposalId);
  await supabase.from("ceremony_requests").update({ awarded_proposal_id: proposalId, status: "awarded", payment_status: "unpaid", updated_at: new Date().toISOString() }).eq("id", requestId);
  return json({
    proposal_id: proposalId,
    priest_id: proposal.priest_id,
    status: "awarded",
    upi_id: UPI_ID,
    amount_inr: proposal.amount_inr,
    proposal: mapProposal({ ...proposal, status: "accepted", priest_profiles: priest }),
    request: mapRequest(request, pooja),
  });
}

async function providerRequests(supabase: any, _body: any, identity: any) {
  const userId = identity.id;
  if (!userId) return json({ requests: [] });
  const { data: priest } = await supabase.from("priest_profiles").select("id,pooja_slugs").eq("user_id", userId).maybeSingle();
  if (!priest) return json({ requests: [] });

  const { data, error } = await supabase.from("ceremony_requests")
    .select("id,customer_id,pooja_slug,ceremony_date,ceremony_time,address,landmark,notes,budget_min_inr,budget_max_inr,status,payment_status,payment_submission_id,invoice_number,latitude,longitude,created_at")
    .eq("status", "open");
  if (error) throw error;

  const filtered = (data || []).filter((item: any) => (priest.pooja_slugs || []).includes(item.pooja_slug));
  const poojaSlugs = [...new Set(filtered.map((item: any) => item.pooja_slug))];
  const { data: poojas } = poojaSlugs.length ? await supabase.from("poojas").select("slug,name").in("slug", poojaSlugs) : { data: [] };
  const poojaNames = Object.fromEntries((poojas || []).map((pooja: any) => [pooja.slug, pooja.name]));
  const requestIds = filtered.map((item: any) => item.id);
  let myProposals: Record<string, any> = {};
  if (requestIds.length) {
    const { data: proposals } = await supabase.from("ceremony_proposals").select("request_id,status,amount_inr").eq("priest_id", priest.id).in("request_id", requestIds);
    myProposals = Object.fromEntries((proposals || []).map((item: any) => [item.request_id, item]));
  }
  return json({ requests: filtered.map((item: any) => mapProviderRequest({ ...item, pooja_name: poojaNames[item.pooja_slug] }, myProposals[item.id])) });
}

async function sendProposal(supabase: any, body: any, identity: any) {
  const userId = identity.id;
  const requestId = cleanUuid(body.request_id);
  const amount = Number(body.amount_inr || body.amount || 0);
  if (!userId || !requestId || amount < 1) return json({ error: "Priest, request, and amount are required" }, 400);
  const { data: priest } = await supabase.from("priest_profiles").select("id").eq("user_id", userId).maybeSingle();
  if (!priest) return json({ error: "Priest profile not found" }, 404);
  const { data, error } = await supabase.from("ceremony_proposals").upsert({
    request_id: requestId,
    priest_id: priest.id,
    amount_inr: amount,
    message: clean(body.message) || "I am available and would be happy to conduct this ceremony.",
    includes_samagri: Boolean(body.includes_samagri),
    status: "active",
    updated_at: new Date().toISOString(),
  }, { onConflict: "request_id,priest_id" }).select("*").single();
  if (error) throw error;
  return json({ proposal: data });
}

async function createCashfreeOrder(supabase: any, body: any, identity: any) {
  if (identity.role !== "customer" && !isAdmin(identity)) return json({ error: "Customer account required" }, 403);

  const requestId = cleanUuid(body.request_id);
  let bookingId = cleanUuid(body.booking_id);
  let proposalId = cleanUuid(body.proposal_id);
  let booking: any = null;
  let priestId: string | null = null;
  let poojaSlug = clean(body.pooja_slug);
  let amountPaise = 0;

  if (requestId) {
    const { data: request } = await supabase.from("ceremony_requests").select("*").eq("id", requestId).maybeSingle();
    if (!request || request.customer_id !== identity.id) return json({ error: "Ceremony request not found" }, 404);
    proposalId = proposalId || request.awarded_proposal_id;
    if (!proposalId) return json({ error: "Choose a proposal before checkout" }, 409);
    const { data: proposal } = await supabase.from("ceremony_proposals").select("*").eq("id", proposalId).eq("request_id", requestId).eq("status", "accepted").maybeSingle();
    if (!proposal) return json({ error: "The accepted proposal was not found" }, 404);
    priestId = proposal.priest_id;
    poojaSlug = request.pooja_slug;
    amountPaise = Number(proposal.amount_inr) * 100;
    bookingId = request.booking_id;
    if (!bookingId) {
      booking = await insertPendingBooking(supabase, {
        customerId: identity.id,
        priestId,
        poojaSlug,
        amountPaise,
        bookingDate: request.ceremony_date,
        bookingTime: request.ceremony_time,
        address: request.address,
        landmark: request.landmark,
        latitude: request.latitude,
        longitude: request.longitude,
        notes: request.notes,
      });
      bookingId = booking.id;
      await supabase.from("ceremony_requests").update({ booking_id: bookingId, updated_at: new Date().toISOString() }).eq("id", requestId);
    }
  } else if (bookingId) {
    const { data } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (!data || data.customer_id !== identity.id) return json({ error: "Booking not found" }, 404);
    booking = data;
    priestId = data.priest_id;
    poojaSlug = data.pooja_slug;
    amountPaise = Number(data.total_inr) * 100;
  } else {
    priestId = cleanUuid(body.priest_id);
    if (!priestId || !poojaSlug) return json({ error: "Purohit and ceremony are required" }, 400);
    if (!clean(body.booking_date) || !clean(body.booking_time) || !clean(body.address)) return json({ error: "Date, time, and address are required" }, 400);
    const { data: service } = await supabase.from("priest_services")
      .select("price_paise,is_active")
      .eq("priest_id", priestId).eq("pooja_slug", poojaSlug).eq("is_active", true).maybeSingle();
    if (!service) return json({ error: "This purohit has not published a price for the selected ceremony" }, 409);
    amountPaise = Number(service.price_paise);
    booking = await insertPendingBooking(supabase, {
      customerId: identity.id,
      priestId,
      poojaSlug,
      amountPaise,
      bookingDate: clean(body.booking_date),
      bookingTime: clean(body.booking_time),
      address: clean(body.address),
      landmark: clean(body.landmark),
      latitude: numberOrNull(body.latitude),
      longitude: numberOrNull(body.longitude),
      notes: clean(body.notes),
    });
    bookingId = booking.id;
  }

  if (!bookingId || !priestId || amountPaise < 100) return json({ error: "A valid payable booking could not be created" }, 400);

  const { data: existing } = await supabase.from("payment_orders").select("*")
    .eq("booking_id", bookingId).in("status", ["created", "active", "paid"]).maybeSingle();
  if (existing) return json({ order: publicOrder(existing), booking: booking || undefined, reused: true });

  const environment = cashfreeEnvironment();
  if (!cashfreeConfigured()) return json({ error: "Cashfree is not configured on the server", code: "cashfree_not_configured" }, 503);

  const merchantOrderId = `PC_${crypto.randomUUID().replaceAll("-", "").slice(0, 28)}`;
  const returnUrl = clean(Deno.env.get("CASHFREE_RETURN_URL")) || "https://purohit-marketplace-project.vercel.app/home?cashfree_order_id={order_id}";
  const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/cashfree-webhook`;
  const { data: customer } = await supabase.from("app_users").select("full_name,email,phone").eq("id", identity.id).maybeSingle();
  if (!customer?.phone) return json({ error: "Add a verified phone number to your profile before payment" }, 409);

  const payload = {
    order_id: merchantOrderId,
    order_amount: amountPaise / 100,
    order_currency: "INR",
    customer_details: {
      customer_id: identity.id,
      customer_name: customer.full_name || "Purohith Connect customer",
      customer_email: customer.email || identity.email,
      customer_phone: customer.phone,
    },
    order_meta: { return_url: returnUrl, notify_url: notifyUrl },
    order_note: `Purohith Connect booking ${bookingId}`,
    order_tags: { booking_id: bookingId, request_id: requestId || "", priest_id: priestId },
  };
  const providerOrder = await cashfreeRequest("/orders", { method: "POST", body: payload, idempotencyKey: crypto.randomUUID() });
  const { data: order, error } = await supabase.from("payment_orders").insert({
    booking_id: bookingId,
    request_id: requestId,
    proposal_id: proposalId,
    customer_id: identity.id,
    priest_id: priestId,
    pooja_slug: poojaSlug,
    environment,
    merchant_order_id: merchantOrderId,
    provider_order_id: providerOrder.cf_order_id ? String(providerOrder.cf_order_id) : null,
    payment_session_id: providerOrder.payment_session_id,
    amount_paise: amountPaise,
    status: mapCashfreeStatus(providerOrder.order_status),
    provider_status: providerOrder.order_status,
    return_url: returnUrl,
    expires_at: providerOrder.order_expiry_time || null,
    metadata: { cf_order: sanitizeProviderPayload(providerOrder) },
  }).select("*").single();
  if (error) throw error;

  await supabase.from("bookings").update({ payment_status: "payment_pending", payment_provider: "cashfree", provider_order_id: merchantOrderId, updated_at: new Date().toISOString() }).eq("id", bookingId);
  if (requestId) await supabase.from("ceremony_requests").update({ payment_status: "payment_pending", updated_at: new Date().toISOString() }).eq("id", requestId);
  return json({ order: publicOrder(order), booking: booking || undefined });
}

async function verifyCashfreeOrder(supabase: any, body: any, identity: any) {
  const paymentOrderId = cleanUuid(body.payment_order_id);
  const merchantOrderId = clean(body.order_id);
  let query = supabase.from("payment_orders").select("*");
  query = paymentOrderId ? query.eq("id", paymentOrderId) : query.eq("merchant_order_id", merchantOrderId);
  const { data: order } = await query.maybeSingle();
  if (!order || (order.customer_id !== identity.id && !isAdmin(identity))) return json({ error: "Payment order not found" }, 404);
  const providerOrder = await cashfreeRequest(`/orders/${encodeURIComponent(order.merchant_order_id)}`, { method: "GET" });
  const updated = await reconcileCashfreeOrder(supabase, order, providerOrder);
  const { data: booking } = await supabase.from("bookings")
    .select("id,status,payment_status,invoice_no,invoice_html,invoice_issued_at")
    .eq("id", updated.booking_id)
    .maybeSingle();
  return json({ order: publicOrder(updated), booking: booking || undefined });
}

async function approveProviderRelease(supabase: any, body: any, identity: any) {
  if (!isAdmin(identity)) return json({ error: "Administrator access required" }, 403);
  const earningId = cleanUuid(body.earning_id);
  const { data: earning } = await supabase.from("provider_earnings").select("*,bookings(status)").eq("id", earningId).maybeSingle();
  if (!earning) return json({ error: "Provider earning not found" }, 404);
  if (earning.status !== "available") return json({ error: "Only available earnings can be queued for release" }, 409);
  if (earning.bookings?.status !== "completed") return json({ error: "Complete the booking before releasing provider funds" }, 409);
  const { data: payout, error } = await supabase.from("payouts").insert({
    earning_id: earning.id,
    priest_id: earning.priest_id,
    amount_paise: earning.net_paise,
    status: "queued",
    requested_by: identity.id,
    approved_by: identity.id,
    metadata: { note: clean(body.note) || "Approved in super admin" },
  }).select("*").single();
  if (error) throw error;
  await supabase.from("provider_earnings").update({ status: "release_pending", updated_at: new Date().toISOString() }).eq("id", earning.id);
  return json({ payout, message: "Release queued. No bank transfer is initiated until Cashfree Payouts is configured and the queue worker processes it." });
}

async function insertPendingBooking(supabase: any, details: any) {
  const [{ data: customer }, { data: priest }, { data: pooja }] = await Promise.all([
    supabase.from("app_users").select("full_name,phone,email").eq("id", details.customerId).maybeSingle(),
    supabase.from("priest_profiles").select("display_name").eq("id", details.priestId).maybeSingle(),
    supabase.from("poojas").select("name").eq("slug", details.poojaSlug).maybeSingle(),
  ]);
  if (!priest || !pooja) throw new Error("Purohit or ceremony not found");
  const total = Math.round(Number(details.amountPaise) / 100);
  const subtotal = Math.round(total / 1.18);
  const { data, error } = await supabase.from("bookings").insert({
    customer_id: details.customerId,
    priest_id: details.priestId,
    pooja_slug: details.poojaSlug,
    booking_date: details.bookingDate,
    booking_time: details.bookingTime,
    address: details.address,
    landmark: details.landmark,
    latitude: details.latitude,
    longitude: details.longitude,
    notes: details.notes,
    subtotal_inr: subtotal,
    gst_inr: total - subtotal,
    total_inr: total,
    status: "pending",
    payment_status: "payment_pending",
    customer_name: customer?.full_name || "Customer",
    customer_phone: customer?.phone || "",
    customer_email: customer?.email || "",
    priest_name: priest.display_name,
    pooja_name: pooja.name,
    pooja_price_inr: total,
    addons_total_inr: 0,
    payment_provider: "cashfree",
  }).select("*").single();
  if (error) throw error;
  return data;
}

async function reconcileCashfreeOrder(supabase: any, order: any, providerOrder: any) {
  const providerAmountPaise = Math.round(Number(providerOrder.order_amount || 0) * 100);
  if (providerOrder.order_currency !== "INR" || providerAmountPaise !== Number(order.amount_paise)) throw new Error("Cashfree order amount mismatch");
  const status = mapCashfreeStatus(providerOrder.order_status);
  const now = new Date().toISOString();
  const { data: updated, error } = await supabase.from("payment_orders").update({
    status,
    provider_status: providerOrder.order_status,
    provider_order_id: providerOrder.cf_order_id ? String(providerOrder.cf_order_id) : order.provider_order_id,
    paid_at: status === "paid" ? order.paid_at || now : order.paid_at,
    verified_at: now,
    updated_at: now,
    metadata: { ...(order.metadata || {}), cf_order: sanitizeProviderPayload(providerOrder) },
  }).eq("id", order.id).select("*").single();
  if (error) throw error;
  if (status === "paid") await markBookingPaid(supabase, updated);
  return updated;
}

async function markBookingPaid(supabase: any, order: any) {
  const generatedInvoiceNumber = makeInvoiceNumber();
  const { data: booking } = await supabase.from("bookings").select("*").eq("id", order.booking_id).maybeSingle();
  if (!booking) throw new Error("Booking for paid order not found");
  const invoiceNumber = booking.invoice_no || generatedInvoiceNumber;
  const invoiceHtml = renderCashfreeInvoice({ invoiceNumber, booking, order });
  await supabase.from("bookings").update({
    payment_status: "paid",
    payment_id: order.id,
    payment_provider: "cashfree",
    provider_order_id: order.merchant_order_id,
    invoice_no: invoiceNumber,
    invoice_html: invoiceHtml,
    invoice_issued_at: booking.invoice_issued_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", booking.id);
  if (order.request_id) await supabase.from("ceremony_requests").update({ payment_status: "paid", status: "awarded", updated_at: new Date().toISOString() }).eq("id", order.request_id);
  const platformFee = Math.round(Number(order.amount_paise) * 0.1);
  await supabase.from("provider_earnings").upsert({
    booking_id: booking.id,
    payment_order_id: order.id,
    priest_id: order.priest_id,
    gross_paise: order.amount_paise,
    platform_fee_paise: platformFee,
    tax_paise: 0,
    status: "held",
    updated_at: new Date().toISOString(),
  }, { onConflict: "booking_id" });

  const paidAt = order.paid_at || new Date().toISOString();
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
    paid_at: paidAt,
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
    updated_at: new Date().toISOString(),
  }, { onConflict: "payment_order_id" });
  if (reportError) throw reportError;

  if (!existingReport) {
    await supabase.from("provider_notifications").insert({
      priest_id: order.priest_id,
      request_id: order.request_id,
      title: "Payment confirmed and invoice ready",
      body: `${booking.pooja_name || "Ceremony"} · ${invoiceNumber} · ₹${(Number(order.amount_paise) / 100).toLocaleString("en-IN")}`,
    });
  }
}

async function listPaymentReports(supabase: any, identity: any) {
  let query = supabase.from("payment_reports")
    .select("id,payment_order_id,booking_id,customer_id,priest_id,invoice_number,invoice_html,amount_paise,currency,provider,provider_payment_id,paid_at,report_data,generated_at")
    .order("generated_at", { ascending: false })
    .limit(100);
  if (!isAdmin(identity)) {
    if (identity.role === "priest") {
      const { data: priest } = await supabase.from("priest_profiles").select("id").eq("user_id", identity.id).maybeSingle();
      if (!priest) return json({ reports: [] });
      query = query.eq("priest_id", priest.id);
    } else {
      query = query.eq("customer_id", identity.id);
    }
  }
  const { data, error } = await query;
  if (error) throw error;
  return json({ reports: data || [] });
}

async function listBookings(supabase: any, identity: any) {
  let query = supabase.from("bookings").select("*").order("booking_date", { ascending: false }).limit(100);
  if (!isAdmin(identity)) {
    if (identity.role === "priest") {
      const { data: priest } = await supabase.from("priest_profiles").select("id").eq("user_id", identity.id).maybeSingle();
      if (!priest) return json({ bookings: [] });
      query = query.eq("priest_id", priest.id);
    } else {
      query = query.eq("customer_id", identity.id);
    }
  }
  const { data, error } = await query;
  if (error) throw error;
  return json({ bookings: (data || []).map((booking: any) => ({
    ...booking,
    total_amount: Number(booking.total_inr || booking.total_amount || 0),
    price: Number(booking.total_inr || booking.pooja_price_inr || 0),
  })) });
}

async function providerBookingAction(supabase: any, body: any, identity: any) {
  const bookingId = cleanUuid(body.booking_id);
  const action = clean(body.booking_action);
  if (!bookingId || !["accept", "reject", "complete"].includes(action)) return json({ error: "Valid booking action is required" }, 400);
  const context = await trackingContext(supabase, bookingId, identity);
  if (!context || context.role !== "priest") return json({ error: "Only the assigned purohit can update this booking" }, 403);
  if (action === "accept" && context.booking.payment_status !== "paid") return json({ error: "Payment must be confirmed before accepting this booking" }, 409);
  const nextStatus = action === "accept" ? "confirmed" : action === "reject" ? "rejected" : "completed";
  const allowed = action === "accept" ? ["pending"] : action === "reject" ? ["pending"] : ["confirmed"];
  if (!allowed.includes(context.booking.status)) return json({ error: `A ${context.booking.status} booking cannot be ${nextStatus}` }, 409);
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("bookings").update({ status: nextStatus, updated_at: now }).eq("id", bookingId).select("*").single();
  if (error) throw error;
  if (action === "complete") {
    await supabase.from("provider_earnings").update({ status: "available", available_at: now, updated_at: now }).eq("booking_id", bookingId).eq("status", "held");
    await supabase.from("booking_tracking_sessions").update({ status: "stopped", stopped_at: now, updated_at: now }).eq("booking_id", bookingId);
  }
  return json({ booking: data });
}

async function trackingContext(supabase: any, bookingId: string, identity: any) {
  const { data: booking } = await supabase.from("bookings")
    .select("id,customer_id,priest_id,payment_status,status,booking_date,booking_time")
    .eq("id", bookingId).maybeSingle();
  if (!booking) return null;
  const { data: priest } = await supabase.from("priest_profiles").select("id,user_id").eq("id", booking.priest_id).maybeSingle();
  const role = booking.customer_id === identity.id ? "customer" : priest?.user_id === identity.id ? "priest" : isAdmin(identity) ? "admin" : null;
  return role ? { booking, priest, role } : null;
}

async function setTrackingConsent(supabase: any, body: any, identity: any) {
  const bookingId = cleanUuid(body.booking_id);
  if (!bookingId) return json({ error: "Booking is required" }, 400);
  const context = await trackingContext(supabase, bookingId, identity);
  if (!context || context.role === "admin") return json({ error: "Booking not found" }, 404);
  if (context.booking.payment_status !== "paid") return json({ error: "Live tracking is available after payment is confirmed" }, 409);

  const now = new Date().toISOString();
  const { data: current } = await supabase.from("booking_tracking_sessions").select("*").eq("booking_id", bookingId).maybeSingle();
  const enabled = body.enabled === true;
  const customerConsent = context.role === "customer" ? (enabled ? now : null) : current?.customer_consented_at || null;
  const priestConsent = context.role === "priest" ? (enabled ? now : null) : current?.priest_consented_at || null;
  const active = Boolean(customerConsent && priestConsent);
  const status = enabled ? (active ? "active" : "waiting") : "stopped";
  const { data, error } = await supabase.from("booking_tracking_sessions").upsert({
    booking_id: bookingId,
    customer_id: context.booking.customer_id,
    priest_id: context.booking.priest_id,
    status,
    customer_consented_at: customerConsent,
    priest_consented_at: priestConsent,
    started_at: active ? current?.started_at || now : current?.started_at || null,
    stopped_at: enabled ? null : now,
    expires_at: active ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : current?.expires_at || null,
    updated_at: now,
  }, { onConflict: "booking_id" }).select("*").single();
  if (error) throw error;
  return json({ tracking_status: data.status, customer_consented: Boolean(data.customer_consented_at), priest_consented: Boolean(data.priest_consented_at) });
}

async function pushBookingLocation(supabase: any, body: any, identity: any) {
  const bookingId = cleanUuid(body.booking_id);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!bookingId || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return json({ error: "A valid booking location is required" }, 400);
  }
  const context = await trackingContext(supabase, bookingId, identity);
  if (!context || context.role !== "priest") return json({ error: "Only the assigned purohit can share this location" }, 403);
  const { data: session } = await supabase.from("booking_tracking_sessions").select("*").eq("booking_id", bookingId).maybeSingle();
  if (!session?.customer_consented_at || !session?.priest_consented_at || session.status !== "active") return json({ error: "Both participants must enable live tracking first", code: "tracking_waiting" }, 409);
  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    await supabase.from("booking_tracking_sessions").update({ status: "expired", updated_at: new Date().toISOString() }).eq("booking_id", bookingId);
    return json({ error: "This tracking session has expired" }, 410);
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("booking_locations").insert({
    booking_id: bookingId,
    priest_id: context.booking.priest_id,
    latitude,
    longitude,
    accuracy_meters: nullableNumber(body.accuracy_meters),
    heading_degrees: nullableNumber(body.heading_degrees),
    recorded_at: now,
  }).select("latitude,longitude,accuracy_meters,heading_degrees,recorded_at").single();
  if (error) throw error;
  await supabase.from("booking_tracking_sessions").update({ last_location_at: now, updated_at: now }).eq("booking_id", bookingId);
  return json({ tracking_status: "active", location: data });
}

async function getBookingLocation(supabase: any, body: any, identity: any) {
  const bookingId = cleanUuid(body.booking_id);
  if (!bookingId) return json({ error: "Booking is required" }, 400);
  const context = await trackingContext(supabase, bookingId, identity);
  if (!context) return json({ error: "Booking not found" }, 404);
  const { data: session } = await supabase.from("booking_tracking_sessions").select("*").eq("booking_id", bookingId).maybeSingle();
  const { data: location } = session?.customer_consented_at && session?.priest_consented_at
    ? await supabase.from("booking_locations").select("latitude,longitude,accuracy_meters,heading_degrees,recorded_at").eq("booking_id", bookingId).order("recorded_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  return json({
    tracking_status: session?.status || "disabled",
    customer_consented: Boolean(session?.customer_consented_at),
    priest_consented: Boolean(session?.priest_consented_at),
    location: location || null,
  });
}

async function cashfreeRequest(path: string, options: any) {
  const headers: Record<string, string> = {
    "x-client-id": Deno.env.get("CASHFREE_PG_CLIENT_ID") || "",
    "x-client-secret": Deno.env.get("CASHFREE_PG_SECRET_KEY") || "",
    "x-api-version": Deno.env.get("CASHFREE_API_VERSION") || "2025-01-01",
    "x-request-id": crypto.randomUUID(),
    "Content-Type": "application/json",
  };
  if (options.idempotencyKey) headers["x-idempotency-key"] = options.idempotencyKey;
  const response = await fetch(`${cashfreeBaseUrl()}${path}`, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.type || `Cashfree request failed (${response.status})`);
  return payload;
}

function cashfreeConfigured() {
  return Boolean(Deno.env.get("CASHFREE_PG_CLIENT_ID") && Deno.env.get("CASHFREE_PG_SECRET_KEY"));
}

function cashfreeEnvironment() {
  return Deno.env.get("CASHFREE_ENV") === "production" ? "production" : "sandbox";
}

function cashfreeBaseUrl() {
  return cashfreeEnvironment() === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

function mapCashfreeStatus(status: unknown) {
  const value = clean(status).toUpperCase();
  if (value === "PAID") return "paid";
  if (value === "ACTIVE") return "active";
  if (value === "EXPIRED") return "expired";
  if (value === "TERMINATED") return "cancelled";
  return value ? "failed" : "created";
}

function publicOrder(order: any) {
  return {
    id: order.id,
    booking_id: order.booking_id,
    request_id: order.request_id,
    order_id: order.merchant_order_id,
    payment_session_id: order.payment_session_id,
    amount_inr: Number(order.amount_paise) / 100,
    currency: order.currency,
    status: order.status,
    environment: order.environment,
    paid_at: order.paid_at,
    customer_receipt_token: order.status === "paid" ? order.customer_receipt_token : undefined,
  };
}

function sanitizeProviderPayload(payload: any) {
  const { payment_session_id: _session, ...safe } = payload || {};
  return safe;
}

async function adminVerifyPayment(supabase: any, body: any, identity: any) {
  if (!isAdmin(identity)) return json({ error: "Administrator access required" }, 403);
  const paymentId = cleanUuid(body.payment_submission_id);
  if (!paymentId) return json({ error: "Payment submission is required" }, 400);
  const { data: payment, error } = await supabase.from("payment_submissions").select("*").eq("id", paymentId).maybeSingle();
  if (error) throw error;
  if (!payment) return json({ error: "Payment not found" }, 404);

  await supabase.from("payment_submissions").update({
    status: "admin_verified",
    admin_verified_at: new Date().toISOString(),
    verified_by: identity.id,
    updated_at: new Date().toISOString(),
  }).eq("id", paymentId);

  if (payment.request_id) {
    await supabase.from("ceremony_requests").update({ payment_status: "admin_verified", status: "open", updated_at: new Date().toISOString() }).eq("id", payment.request_id);
    const { data: request } = await supabase.from("ceremony_requests").select("pooja_slug,address,ceremony_date,ceremony_time").eq("id", payment.request_id).maybeSingle();
    const { data: pooja } = request?.pooja_slug ? await supabase.from("poojas").select("name").eq("slug", request.pooja_slug).maybeSingle() : { data: null };
    const { data: priests } = await supabase.from("priest_profiles").select("id").contains("pooja_slugs", [request?.pooja_slug]);
    if (priests?.length) {
      await supabase.from("provider_notifications").insert(priests.map((priest: any) => ({
        priest_id: priest.id,
        request_id: payment.request_id,
        payment_submission_id: payment.id,
        title: `${pooja?.name || payment.pooja_name} request verified`,
        body: `${request?.ceremony_date || ""} ${request?.ceremony_time || ""} · ${request?.address || ""}`,
      })));
    }
  }

  return json({ status: "admin_verified" });
}

async function loadRequestContext(supabase: any, requestId: string) {
  const { data } = await supabase.from("ceremony_requests")
    .select("*,app_users(full_name,phone,email)")
    .eq("id", requestId).maybeSingle();
  if (!data) return null;
  const { data: pooja } = data.pooja_slug ? await supabase.from("poojas").select("name,base_price_inr").eq("slug", data.pooja_slug).maybeSingle() : { data: null };
  const { data: proposal } = data.awarded_proposal_id ? await supabase.from("ceremony_proposals").select("priest_id,amount_inr").eq("id", data.awarded_proposal_id).maybeSingle() : { data: null };
  return {
    ...data,
    priest_id: proposal?.priest_id || data.priest_id,
    customer_name: data.app_users?.full_name,
    pooja_name: pooja?.name,
  };
}

async function loadBookingContext(supabase: any, bookingId: string) {
  const { data } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  return data;
}

async function verifyScreenshotWithOpenAI(supabase: any, screenshotDataUrl: string, amount: number) {
  const fallback = { verified: false, confidence: 0.45, summary: "Screenshot received. Admin verification is still required before assigning the ceremony.", provider: "manual_review" };
  if (!screenshotDataUrl || !screenshotDataUrl.startsWith("data:image/")) return { ...fallback, summary: "No valid image was attached, so the payment is waiting for manual verification." };
  const apiKey = await getOpenAIKey(supabase);
  if (!apiKey) return fallback;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: "You verify Indian UPI payment screenshots for an admin review queue. Return only JSON with keys verified boolean, confidence number 0-1, amount_inr number|null, payee_upi string|null, summary string. Never claim bank-settled certainty." },
          { role: "user", content: [
            { type: "text", text: `Expected payee UPI: ${UPI_ID}. Expected amount INR: ${amount}. Check whether the screenshot appears to show a completed/successful UPI payment to this payee. This is an AI estimate; admin will manually verify.` },
            { type: "image_url", image_url: { url: screenshotDataUrl } },
          ] },
        ],
      }),
    });
    if (!response.ok) return fallback;
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content.replace(/^```json/i, "").replace(/```$/i, "").trim());
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence || 0)));
    return {
      verified: Boolean(parsed.verified) && confidence >= 0.7,
      confidence,
      summary: clean(parsed.summary) || "AI reviewed the payment screenshot.",
      provider: "openai:gpt-4o-mini",
      raw: parsed,
    };
  } catch (error) {
    return { ...fallback, summary: `AI verification could not complete. Admin review required. ${String(error?.message || "")}`.trim() };
  }
}

async function getOpenAIKey(supabase: any) {
  const { data, error } = await supabase.rpc("get_openai_api_key_for_edge");
  if (error) return "";
  return typeof data === "string" ? data : data?.api_key || "";
}

function mapRequest(row: any, pooja: any) {
  return {
    id: row.id,
    pooja_slug: row.pooja_slug,
    pooja_name: pooja?.name || row.pooja_slug,
    ceremony_date: row.ceremony_date,
    ceremony_time: row.ceremony_time,
    address: row.address,
    landmark: row.landmark,
    lat: row.latitude,
    lng: row.longitude,
    payment_status: row.payment_status,
  };
}

function mapProposal(row: any) {
  const priest = Array.isArray(row.priest_profiles) ? row.priest_profiles[0] : row.priest_profiles;
  return {
    id: row.id,
    request_id: row.request_id,
    priest_id: row.priest_id,
    priest_name: priest?.display_name || "Verified purohit",
    amount: row.amount_inr,
    amount_inr: row.amount_inr,
    message: row.message,
    includes_samagri: row.includes_samagri,
    status: row.status,
    rating: priest?.rating || 0,
    review_count: priest?.review_count || 0,
    photo_url: priest?.photo_url || "",
  };
}

function mapProviderRequest(row: any, proposal: any) {
  return {
    id: row.id,
    pooja_slug: row.pooja_slug,
    pooja_name: row.pooja_name || row.pooja_slug,
    ceremony_date: row.ceremony_date,
    ceremony_time: row.ceremony_time,
    address: row.address,
    landmark: row.landmark,
    lat: row.latitude,
    lng: row.longitude,
    notes: row.notes,
    budget_min: row.budget_min_inr,
    budget_max: row.budget_max_inr,
    status: row.status,
    payment_status: row.payment_status,
    invoice_number: row.invoice_number,
    my_bid_status: proposal?.status || null,
    my_bid_amount: proposal?.amount_inr || null,
  };
}

function renderInvoice(details: any) {
  const issuedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(details.invoiceNumber)}</title><style>body{font-family:Inter,Arial,sans-serif;margin:0;background:#f7f4ef;color:#1f1f1d}.invoice{max-width:760px;margin:32px auto;background:#fff;border:1px solid #e6ded2;border-radius:22px;padding:34px}.brand{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #eee2d8;padding-bottom:20px}.name{font-size:24px;font-weight:800}.badge{background:#fff1eb;color:#d84616;border-radius:999px;padding:8px 12px;font-weight:800;font-size:12px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #f0ebe5;padding:14px 0}.muted{color:#6d6861}.total{font-size:28px;font-weight:900}.note{margin-top:22px;padding:16px;background:#fff8f4;border-radius:16px;color:#5d5650}</style></head><body><main class="invoice"><section class="brand"><div><div class="name">Purohith Connect</div><div class="muted">AI-assisted UPI payment acknowledgement</div></div><div class="badge">${escapeHtml(details.status)}</div></section><section><div class="row"><span>Invoice number</span><strong>${escapeHtml(details.invoiceNumber)}</strong></div><div class="row"><span>Issued at</span><strong>${escapeHtml(issuedAt)}</strong></div><div class="row"><span>Customer</span><strong>${escapeHtml(details.customerName)}</strong></div><div class="row"><span>Ceremony</span><strong>${escapeHtml(details.poojaName)}</strong></div><div class="row"><span>Date and time</span><strong>${escapeHtml(`${details.ceremonyDate} ${details.ceremonyTime}`)}</strong></div><div class="row"><span>Address</span><strong>${escapeHtml(details.address)}</strong></div><div class="row"><span>UPI paid to</span><strong>${escapeHtml(details.upiId)}</strong></div><div class="row"><span>Total</span><strong class="total">₹${Number(details.amount).toLocaleString("en-IN")}</strong></div></section><p class="note">This invoice is generated from a customer-uploaded UPI screenshot. Admin verification is required before provider assignment or payout release.</p></main></body></html>`;
}

function renderCashfreeInvoice({ invoiceNumber, booking, order }: any) {
  return renderInvoice({
    invoiceNumber,
    amount: Number(order.amount_paise) / 100,
    customerName: booking.customer_name,
    poojaName: booking.pooja_name,
    ceremonyDate: booking.booking_date,
    ceremonyTime: booking.booking_time,
    address: booking.address,
    upiId: "Cashfree Payments",
    status: "PAID",
  }).replace("AI-assisted UPI payment acknowledgement", "Cashfree verified payment receipt")
    .replace("This invoice is generated from a customer-uploaded UPI screenshot. Admin verification is required before provider assignment or payout release.", "Payment status was verified against Cashfree. Provider earnings remain held until the ceremony is completed and an administrator approves release.");
}

function makeInvoiceNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `PCI-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanUuid(value: unknown) {
  const text = clean(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function numberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function nullableNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char] || char));
}

async function getIdentity(req: Request, supabase: any) {
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: authData, error } = await supabase.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: profile } = await supabase.from("app_users").select("id,email,role,is_active").eq("id", authData.user.id).maybeSingle();
  if (!profile?.is_active) return null;
  return { id: authData.user.id, email: profile.email || authData.user.email || "", role: String(profile.role || "customer") };
}

function isAdmin(identity: any) {
  return identity?.role === "admin" || identity?.role === "super_admin";
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
