import { Alert } from "react-native";

/**
 * Normalizes phone number into a standard format.
 */
export function sanitizePhoneNumber(phone) {
  if (!phone) return "";
  const digitsOnly = String(phone).replace(/[^0-9+]/g, "");
  if (digitsOnly.startsWith("+")) return digitsOnly;
  if (digitsOnly.length === 10) return `+91${digitsOnly}`;
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) return `+${digitsOnly}`;
  return digitsOnly;
}

/**
 * Securely masks a phone number for user privacy (e.g. +91 ••••• ••102).
 * Phone numbers are NEVER displayed unmasked to other users.
 */
export function maskPhoneNumber(phone) {
  if (!phone) return "";
  const sanitized = sanitizePhoneNumber(phone);
  if (sanitized.length >= 10) {
    const last3 = sanitized.slice(-3);
    return `+91 ••••• ••${last3}`;
  }
  return "••••••••••";
}

/**
 * Formats a user's OWN phone number for their private profile display.
 */
export function formatPhoneDisplay(phone) {
  if (!phone) return "";
  const sanitized = sanitizePhoneNumber(phone);
  if (sanitized.startsWith("+91") && sanitized.length === 13) {
    return `+91 ${sanitized.slice(3, 8)} ${sanitized.slice(8)}`;
  }
  return sanitized;
}

/**
 * Directly launches the 100% private in-app call room.
 * No mobile numbers are ever shared between customers and purohits.
 */
export function startInAppCall(navigation, { bookingId, booking } = {}) {
  if (!navigation) {
    console.warn("Navigation object required to start in-app call");
    return;
  }
  navigation.navigate("CallRoom", {
    bookingId: bookingId || booking?.id,
    booking,
  });
}

/**
 * Initiates in-app call directly.
 * Preserved for backward-compatibility with screens, enforcing in-app call only.
 */
export function promptCallAction({ onInAppCall, navigation, bookingId, booking }) {
  if (typeof onInAppCall === "function") {
    onInAppCall();
  } else if (navigation) {
    startInAppCall(navigation, { bookingId, booking });
  }
}

/**
 * Direct phone dialing between users is disabled for privacy and safety.
 */
export async function makePhoneCall() {
  Alert.alert(
    "In-App Calling Only",
    "To protect your privacy and security, direct phone numbers are never shared. Please use the secure in-app voice/video call.",
    [{ text: "OK" }]
  );
  return false;
}

