import { supabase } from "./supabase";

export async function currentCallerId() {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error("Sign in again to place the call.");
  return data.user.id;
}

export async function sendCallSignal({ bookingId, signalType, payload }) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData?.user?.id;
  if (!userId) throw new Error("Sign in again to place the call.");
  const { error } = await supabase.from("booking_call_signals").insert({
    booking_id: bookingId,
    sender_id: userId,
    signal_type: signalType,
    payload: payload || {},
  });
  if (error) throw error;
  return userId;
}

export async function listRecentCallSignals(bookingId) {
  if (!supabase) return [];
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("booking_call_signals")
    .select("id,sender_id,signal_type,payload,created_at")
    .eq("booking_id", bookingId)
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export function subscribeCallSignals(bookingId, onSignal) {
  if (!supabase) return { unsubscribe: () => {}, ready: Promise.resolve() };
  const channel = supabase.channel(`booking-call:${bookingId}`);
  const ready = new Promise((resolve, reject) => {
    let settled = false;
    channel
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "booking_call_signals",
        filter: `booking_id=eq.${bookingId}`,
      }, (payload) => {
        if (payload?.new) onSignal(payload.new);
      })
      .subscribe((status) => {
        if (settled) return;
        if (status === "SUBSCRIBED") {
          settled = true;
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          settled = true;
          reject(new Error("The call could not connect. Check your connection and try again."));
        }
      });
  });
  return {
    ready,
    unsubscribe: () => { supabase.removeChannel(channel); },
  };
}
