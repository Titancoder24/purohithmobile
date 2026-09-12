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

export async function listRequestProposals(requestId) {
  return invokePaymentWorkflow({ action: "list_proposals", request_id: requestId });
}

export async function selectProposal(requestId, proposalId) {
  return invokePaymentWorkflow({ action: "award_proposal", request_id: requestId, proposal_id: proposalId });
}

export async function listProviderRequests(userId) {
  return invokePaymentWorkflow({ action: "provider_requests", user_id: userId });
}

export async function sendProviderProposal(payload) {
  return invokePaymentWorkflow({ action: "send_proposal", ...payload });
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
