import { Linking, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase, supabaseConfig } from "./supabase";
export { openCashfreeCheckout } from "./cashfreeCheckout";

export const PUROHITH_UPI_ID = "sgmsfreshmindsservicesllp.8050934625.ibz@icici";
export const PUROHITH_PAYEE_NAME = "SGMS Freshminds Services LLP";

async function invokePaymentWorkflow(body) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data: authData, error: authError } = await supabase.auth.getSession();
  if (authError) throw authError;
  const accessToken = authData?.session?.access_token;
  if (!accessToken) throw new Error("Your session has expired. Sign in again to continue.");

  const response = await fetch(`${supabaseConfig.url}/functions/v1/payment-workflow`, {
    method: "POST",
    headers: {
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Workflow request failed (${response.status})`);
  if (data?.error) throw new Error(data.error);
  return data || {};
}

export async function createCeremonyRequest(payload) {
  return invokePaymentWorkflow({ action: "create_request", ...payload });
}

export async function submitPaymentScreenshot(payload) {
  return invokePaymentWorkflow({ action: "submit_payment", ...payload });
}

export async function listCustomerRequests() {
  if (!supabase) return { requests: [] };
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) return { requests: [] };

    const { data: requests, error } = await supabase
      .from("ceremony_requests")
      .select("id,customer_id,pooja_slug,ceremony_date,ceremony_time,address,landmark,notes,budget_min_inr,budget_max_inr,status,payment_status,awarded_proposal_id,latitude,longitude,created_at")
      .eq("customer_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!requests || !requests.length) return { requests: [] };

    const todayStr = new Date().toISOString().slice(0, 10);
    const activeRequests = requests.filter((r) => {
      if (r.ceremony_date && r.ceremony_date < todayStr) return false;
      return true;
    });
    if (!activeRequests.length) return { requests: [] };

    const poojaSlugs = [...new Set(activeRequests.map((r) => r.pooja_slug).filter(Boolean))];
    const { data: poojas } = poojaSlugs.length
      ? await supabase.from("poojas").select("slug,name").in("slug", poojaSlugs)
      : { data: [] };
    const poojaNames = Object.fromEntries((poojas || []).map((p) => [p.slug, p.name]));

    const requestIds = activeRequests.map((r) => r.id);
    let proposalCounts = {};
    if (requestIds.length) {
      const { data: proposals } = await supabase
        .from("ceremony_proposals")
        .select("request_id")
        .in("request_id", requestIds);
      (proposals || []).forEach((p) => {
        proposalCounts[p.request_id] = (proposalCounts[p.request_id] || 0) + 1;
      });
    }

    return {
      requests: activeRequests.map((r) => ({
        ...r,
        pooja_name: poojaNames[r.pooja_slug] || r.pooja_slug || "Ceremony",
        proposal_count: proposalCounts[r.id] || 0,
      })),
    };
  } catch (err) {
    try {
      return await invokePaymentWorkflow({ action: "customer_requests" });
    } catch (_) {
      return { requests: [] };
    }
  }
}

function mapProposal(item) {
  const priest = item.priest_profiles || {};
  return {
    id: item.id,
    proposal_id: item.id,
    request_id: item.request_id,
    priest_id: item.priest_id,
    priest_name: priest.display_name || "Verified Purohit",
    rating: Number(priest.rating || 4.9),
    review_count: Number(priest.review_count || 12),
    photo_url: priest.photo_url || null,
    amount: Number(item.amount_inr || item.amount || 0),
    amount_inr: Number(item.amount_inr || item.amount || 0),
    message: item.message || "I am available and would be happy to conduct this ceremony.",
    includes_samagri: Boolean(item.includes_samagri),
    status: item.status || "active",
  };
}

export async function listRequestProposals(requestId) {
  try {
    const data = await invokePaymentWorkflow({ action: "list_proposals", request_id: requestId });
    if (data?.proposals) return data;
  } catch (_) {}

  if (!supabase) return { proposals: [] };
  const { data, error } = await supabase
    .from("ceremony_proposals")
    .select("id,request_id,priest_id,amount_inr,message,includes_samagri,status,created_at,priest_profiles(display_name,rating,review_count,photo_url)")
    .eq("request_id", requestId)
    .order("amount_inr", { ascending: true });
  if (error) return { proposals: [] };
  return { proposals: (data || []).map(mapProposal) };
}

export async function selectProposal(requestId, proposalId) {
  try {
    return await invokePaymentWorkflow({ action: "award_proposal", request_id: requestId, proposal_id: proposalId });
  } catch (err) {
    if (!supabase) throw err;
    await supabase.from("ceremony_proposals").update({ status: "declined" }).eq("request_id", requestId).neq("id", proposalId);
    await supabase.from("ceremony_proposals").update({ status: "accepted" }).eq("id", proposalId);
    await supabase.from("ceremony_requests").update({ awarded_proposal_id: proposalId, status: "awarded", updated_at: new Date().toISOString() }).eq("id", requestId);
    return { status: "awarded", proposal_id: proposalId };
  }
}

export async function listProviderRequests(userId) {
  try {
    const data = await invokePaymentWorkflow({ action: "provider_requests", user_id: userId });
    if (data?.requests) return data;
  } catch (_) {}

  if (!supabase) return { requests: [] };
  try {
    let priest = null;
    if (userId) {
      const { data: p } = await supabase.from("priest_profiles").select("id,pooja_slugs").eq("user_id", userId).maybeSingle();
      priest = p;
    }

    const { data: requests, error } = await supabase
      .from("ceremony_requests")
      .select("id,customer_id,pooja_slug,ceremony_date,ceremony_time,address,landmark,notes,budget_min_inr,budget_max_inr,status,payment_status,payment_submission_id,invoice_number,latitude,longitude,created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (error) return { requests: [] };
    if (!requests || !requests.length) return { requests: [] };

    const todayStr = new Date().toISOString().slice(0, 10);
    const activeRequests = requests.filter((r) => {
      if (r.ceremony_date && r.ceremony_date < todayStr) return false;
      return true;
    });
    if (!activeRequests.length) return { requests: [] };

    const poojaSlugs = [...new Set(activeRequests.map((r) => r.pooja_slug).filter(Boolean))];
    const { data: poojas } = poojaSlugs.length
      ? await supabase.from("poojas").select("slug,name").in("slug", poojaSlugs)
      : { data: [] };
    const poojaNames = Object.fromEntries((poojas || []).map((p) => [p.slug, p.name]));

    const requestIds = activeRequests.map((r) => r.id);
    let myProposals = {};
    if (priest?.id && requestIds.length) {
      const { data: proposals } = await supabase
        .from("ceremony_proposals")
        .select("request_id,status,amount_inr")
        .eq("priest_id", priest.id)
        .in("request_id", requestIds);
      myProposals = Object.fromEntries((proposals || []).map((p) => [p.request_id, p]));
    }

    return {
      requests: activeRequests.map((r) => ({
        ...r,
        pooja_name: poojaNames[r.pooja_slug] || r.pooja_slug || "Ceremony Request",
        my_bid_status: myProposals[r.id]?.status ? "proposal sent" : null,
      })),
    };
  } catch (_) {
    return { requests: [] };
  }
}

export async function sendProviderProposal(payload) {
  try {
    return await invokePaymentWorkflow({ action: "send_proposal", ...payload });
  } catch (err) {
    if (!supabase) throw err;
    const { data: priest } = await supabase.from("priest_profiles").select("id").eq("user_id", payload.user_id).maybeSingle();
    if (!priest) throw new Error("Priest profile not found for this account.");
    const { data, error } = await supabase.from("ceremony_proposals").upsert({
      request_id: payload.request_id,
      priest_id: priest.id,
      amount_inr: payload.amount_inr,
      message: payload.message || "I am available and would be happy to conduct this ceremony.",
      includes_samagri: Boolean(payload.includes_samagri),
      status: "active",
      updated_at: new Date().toISOString(),
    }, { onConflict: "request_id,priest_id" }).select("*").single();
    if (error) throw error;
    return { proposal: data };
  }
}

export async function createDirectBookingPayment(payload) {
  return createCashfreeOrder(payload);
}

export async function createCashfreeOrder(payload) {
  return invokePaymentWorkflow({ action: "create_cashfree_order", ...payload });
}

export async function verifyCashfreeOrder(payload) {
  return invokePaymentWorkflow({ action: "verify_cashfree_order", ...payload });
}

export async function listPaymentReports() {
  return invokePaymentWorkflow({ action: "list_payment_reports" });
}

export async function listBookings() {
  return invokePaymentWorkflow({ action: "list_bookings" });
}

export async function updateProviderBooking(bookingId, bookingAction) {
  return invokePaymentWorkflow({ action: "provider_booking_action", booking_id: bookingId, booking_action: bookingAction });
}

export async function setTrackingConsent(bookingId, enabled) {
  return invokePaymentWorkflow({ action: "set_tracking_consent", booking_id: bookingId, enabled });
}

export async function pushBookingLocation(bookingId, coordinates) {
  return invokePaymentWorkflow({ action: "push_booking_location", booking_id: bookingId, ...coordinates });
}

export async function getBookingLocation(bookingId) {
  return invokePaymentWorkflow({ action: "get_booking_location", booking_id: bookingId });
}

export async function openUpiPayment({ amountInr, note = "Purohith Connect booking" } = {}) {
  const params = new URLSearchParams({
    pa: PUROHITH_UPI_ID,
    pn: PUROHITH_PAYEE_NAME,
    tn: note,
    cu: "INR",
  });
  if (amountInr) params.set("am", String(Number(amountInr)));
  const url = `upi://pay?${params.toString()}`;
  const supported = await Linking.canOpenURL(url).catch(() => false);
  if (!supported && Platform.OS !== "web") throw new Error("No UPI app was found on this device.");
  await Linking.openURL(url);
  return true;
}

export async function pickPaymentScreenshot() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Photo permission is required to upload the UPI payment screenshot.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    base64: true,
    quality: 0.78,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.base64) throw new Error("Could not read the selected screenshot.");
  const mimeType = asset.mimeType || "image/jpeg";
  return {
    name: asset.fileName || "payment-screenshot.jpg",
    uri: asset.uri,
    dataUrl: `data:${mimeType};base64,${asset.base64}`,
  };
}

export async function downloadInvoice(invoiceHtml, invoiceNumber = "purohith-connect-invoice") {
  if (!invoiceHtml) return false;
  if (Platform.OS === "web") {
    const blob = new Blob([invoiceHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoiceNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }
  const { uri } = await Print.printToFileAsync({ html: invoiceHtml });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Invoice ${invoiceNumber}`, UTI: "com.adobe.pdf" });
  else await Print.printAsync({ html: invoiceHtml });
  return true;
}
