import { supabase } from "./supabase";

const MESSAGE_COLUMNS = "id,booking_id,sender_id,sender_role,sender_name,body,kind,call_meta,created_at";

function mapMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    booking_id: row.booking_id,
    sender_id: row.sender_id,
    sender_role: row.sender_role,
    sender_name: row.sender_name || "",
    content: row.body || "",
    kind: row.kind || "text",
    call_meta: row.call_meta || null,
    created_at: row.created_at,
  };
}

export function explainChatError(error) {
  const text = String(error?.message || error || "Please try again.");
  if (/row-level security|permission denied|not authorized/i.test(text)) {
    return "Only the customer and the booked purohit can use this chat.";
  }
  if (/jwt|session|sign in/i.test(text)) return "Sign in again to send a message.";
  return text;
}

export async function listBookingMessages(bookingId) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("booking_messages")
    .select(MESSAGE_COLUMNS)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapMessage);
}

export async function sendBookingMessage({ bookingId, body, senderRole, senderName }) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData?.user?.id;
  if (!userId) throw new Error("Sign in again to send a message.");
  const text = String(body || "").trim().slice(0, 2000);
  if (!text) throw new Error("Write a message first.");

  const { data, error } = await supabase
    .from("booking_messages")
    .insert({
      booking_id: bookingId,
      sender_id: userId,
      sender_role: senderRole === "priest" ? "priest" : "customer",
      sender_name: senderName || (senderRole === "priest" ? "Purohit" : "Customer"),
      body: text,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return mapMessage(data);
}

export function formatCallDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
}

export function describeCall(meta, mine) {
  const outcome = meta?.outcome;
  if (outcome === "completed") return { title: "Video call", detail: formatCallDuration(meta.duration_seconds), missed: false };
  if (outcome === "declined") return mine
    ? { title: "Video call", detail: "Declined", missed: false }
    : { title: "Missed video call", detail: "You declined", missed: true };
  return mine
    ? { title: "Video call", detail: "No answer", missed: false }
    : { title: "Missed video call", detail: "Tap to call back", missed: true };
}

export async function logBookingCall({ bookingId, senderRole, senderName, outcome, durationSeconds = 0 }) {
  if (!supabase) return null;
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return null;
  const meta = { outcome, duration_seconds: Math.max(0, Math.min(86400, Math.round(durationSeconds))) };
  const body = outcome === "completed"
    ? `Video call (${formatCallDuration(meta.duration_seconds)})`
    : outcome === "declined" ? "Declined video call" : "Missed video call";
  const { error } = await supabase.from("booking_messages").insert({
    booking_id: bookingId,
    sender_id: userId,
    sender_role: senderRole === "priest" ? "priest" : "customer",
    sender_name: senderName || (senderRole === "priest" ? "Purohit" : "Customer"),
    body,
    kind: "call",
    call_meta: meta,
  });
  if (error) throw error;
  return meta;
}

export function subscribeBookingMessages(bookingId, onInsert) {
  if (!supabase || !bookingId) return () => {};
  const channel = supabase
    .channel(`booking-messages:${bookingId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "booking_messages",
      filter: `booking_id=eq.${bookingId}`,
    }, (payload) => {
      const message = mapMessage(payload?.new);
      if (message) onInsert(message);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
