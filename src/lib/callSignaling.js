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

export function selectCallSignals(rows, startedAtMs) {
  const parsed = (rows || [])
    .filter((row) => row?.id && row.created_at)
    .map((row) => ({ ...row, at: Date.parse(row.created_at) }))
    .filter((row) => Number.isFinite(row.at))
    .sort((a, b) => a.at - b.at);
  const cutoff = parsed.reduce((latest, row) => (
    row.signal_type === "hangup" && row.at < startedAtMs ? Math.max(latest, row.at) : latest
  ), startedAtMs - 2 * 60 * 1000);
  return parsed.filter((row) => row.at > cutoff && (row.signal_type !== "hangup" || row.at >= startedAtMs));
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

export function subscribeIncomingCalls(userId, onSignal) {
  if (!supabase || !userId) return { unsubscribe: () => {} };
  const channel = supabase
    .channel(`incoming-calls:${userId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "booking_call_signals",
    }, (payload) => {
      const row = payload?.new;
      if (row && row.sender_id !== userId && (row.signal_type === "ready" || row.signal_type === "hangup")) onSignal(row);
    })
    .subscribe();
  return { unsubscribe: () => { supabase.removeChannel(channel); } };
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
