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

/**
 * Calls that are still ringing for this user: the other participant's latest "ready" within
 * the ring window, with no hangup and no "ready" from this user after it.
 */
export async function findRingingCalls(userId, ringWindowMs = 45000) {
  if (!supabase || !userId) return [];
  const since = new Date(Date.now() - ringWindowMs).toISOString();
  const { data, error } = await supabase
    .from("booking_call_signals")
    .select("id,booking_id,sender_id,signal_type,created_at")
    .in("signal_type", ["ready", "hangup"])
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const latest = new Map();
  (data || []).forEach((row) => {
    if (row.signal_type === "ready" && row.sender_id !== userId) latest.set(row.booking_id, row);
    else latest.delete(row.booking_id);
  });
  return [...latest.values()];
}

export function subscribeIncomingCalls(userId, onSignal, { onSubscribed } = {}) {
  if (!supabase || !userId) return { unsubscribe: () => {} };
  let channel = null;
  let stopped = false;
  let retry = null;
  let attempt = 0;

  const connect = () => {
    if (stopped) return;
    const current = supabase
      .channel(`incoming-calls:${userId}:${Date.now()}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "booking_call_signals",
      }, (payload) => {
        const row = payload?.new;
        if (row && row.sender_id !== userId && (row.signal_type === "ready" || row.signal_type === "hangup")) onSignal(row);
      });
    channel = current;
    current.subscribe((status) => {
      if (stopped || channel !== current) return;
      if (status === "SUBSCRIBED") {
        attempt = 0;
        onSubscribed?.();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        channel = null;
        supabase.removeChannel(current);
        clearTimeout(retry);
        retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempt++));
      }
    });
  };

  connect();
  return {
    resync: () => {
      if (stopped) return;
      if (!channel) {
        clearTimeout(retry);
        connect();
      } else {
        onSubscribed?.();
      }
    },
    unsubscribe: () => {
      stopped = true;
      clearTimeout(retry);
      if (channel) supabase.removeChannel(channel);
      channel = null;
    },
  };
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
