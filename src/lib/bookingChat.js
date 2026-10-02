import { supabase } from "./supabase";

function mapMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    booking_id: row.booking_id,
    sender_id: row.sender_id,
    sender_role: row.sender_role,
    sender_name: row.sender_name || "",
    content: row.body || "",
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
    .select("id,booking_id,sender_id,sender_role,sender_name,body,created_at")
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
    .select("id,booking_id,sender_id,sender_role,sender_name,body,created_at")
    .single();
  if (error) throw error;
  return mapMessage(data);
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
