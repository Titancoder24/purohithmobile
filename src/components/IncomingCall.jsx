import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, Vibration, View } from "react-native";
import * as Notifications from "expo-notifications";
import { Phone, PhoneOff } from "lucide-react-native";
import { bindBrandStyles } from "../lib/brandStyles";
import { colors } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { listBookings } from "../lib/payments";
import { sendCallSignal, subscribeIncomingCalls } from "../lib/callSignaling";
import { CALL_DECLINE } from "../lib/notifications";

const RING_TIMEOUT_MS = 45000;
const browserNotifications = () => Platform.OS === "web" && typeof globalThis.Notification !== "undefined";

let audioContext = null;

function unlockAudio() {
  const AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioContext) audioContext = new AudioCtor();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function startRingtone() {
  if (Platform.OS !== "web") {
    Vibration.vibrate([0, 900, 700], true);
    return () => Vibration.cancel();
  }
  const context = unlockAudio();
  if (!context) return () => {};
  const beep = (offset) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    const start = context.currentTime + offset;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
    gain.gain.linearRampToValueAtTime(0, start + 0.38);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.4);
  };
  const ring = () => { beep(0); beep(0.5); };
  ring();
  const timer = setInterval(ring, 2500);
  return () => clearInterval(timer);
}

function notify(title, body, tag) {
  if (!browserNotifications() || globalThis.Notification.permission !== "granted") return null;
  try {
    const note = new globalThis.Notification(title, { body, tag, requireInteraction: true });
    note.onclick = () => {
      globalThis.focus?.();
      note.close();
    };
    return note;
  } catch (_) {
    return null;
  }
}

export default function IncomingCall({ navigationRef }) {
  const { user } = useAuth();
  const [call, setCall] = useState(null);
  const callRef = useRef(null);
  const stopRing = useRef(() => {});
  const timer = useRef(null);
  const note = useRef(null);
  const savedTitle = useRef(null);
  const bookings = useRef(new Map());

  const clear = useCallback(() => {
    stopRing.current();
    stopRing.current = () => {};
    clearTimeout(timer.current);
    note.current?.close?.();
    note.current = null;
    if (savedTitle.current !== null && typeof document !== "undefined") document.title = savedTitle.current;
    savedTitle.current = null;
    callRef.current = null;
    setCall(null);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return undefined;
    const prime = () => {
      unlockAudio();
      if (browserNotifications() && globalThis.Notification.permission === "default") {
        globalThis.Notification.requestPermission().catch?.(() => {});
      }
      document.removeEventListener("pointerdown", prime);
    };
    document.addEventListener("pointerdown", prime);
    return () => document.removeEventListener("pointerdown", prime);
  }, []);

  const lookupBooking = useCallback(async (bookingId) => {
    if (bookings.current.has(bookingId)) return bookings.current.get(bookingId);
    try {
      const { bookings: rows } = await listBookings();
      (rows || []).forEach((item) => bookings.current.set(item.id, item));
    } catch (_) {}
    return bookings.current.get(bookingId) || null;
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || !user?.id || user.demo) return undefined;
    const openCall = (bookingId, data) => navigationRef?.navigate?.("CallRoom", {
      bookingId,
      priestName: user.role === "customer" ? data?.callerName : undefined,
      customerName: user.role === "priest" ? data?.callerName : undefined,
      poojaName: data?.poojaName,
      autoStart: true,
    });
    const handled = new Set();
    const onResponse = (response) => {
      const request = response?.notification?.request;
      const data = request?.content?.data || {};
      if (!data.bookingId || handled.has(request.identifier)) return;
      handled.add(request.identifier);
      Notifications.dismissNotificationAsync(request.identifier).catch(() => {});
      const go = (attempt = 0) => {
        if (!navigationRef?.isReady?.()) {
          if (attempt < 20) setTimeout(() => go(attempt + 1), 250);
          return;
        }
        if (data.type === "call") {
          if (response.actionIdentifier === CALL_DECLINE) {
            sendCallSignal({ bookingId: data.bookingId, signalType: "hangup", payload: { reason: "declined" } }).catch(() => {});
            return;
          }
          if (callRef.current?.bookingId === data.bookingId) clear();
          openCall(data.bookingId, data);
        } else if (data.type === "missed_call") {
          navigationRef.navigate("Conversation", { bookingId: data.bookingId });
        }
      };
      go();
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(onResponse);
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const sent = response?.notification?.date ? Number(response.notification.date) : 0;
      const sentMs = sent && sent < 1e12 ? sent * 1000 : sent;
      if (response && (!sentMs || Date.now() - sentMs < 60000)) onResponse(response);
    }).catch(() => {});
    return () => subscription.remove();
  }, [clear, navigationRef, user?.demo, user?.id, user?.role]);

  useEffect(() => {
    if (!user?.id || user.demo) return undefined;
    const otherLabel = user.role === "priest" ? "Customer" : "Purohit";

    const onSignal = async (row) => {
      if (row.signal_type === "hangup") {
        if (callRef.current?.bookingId !== row.booking_id) return;
        const missed = callRef.current;
        clear();
        if (typeof document !== "undefined" && document.hidden) {
          notify(`Missed call from ${missed.name}`, missed.pooja, `missed-${row.booking_id}`);
        }
        return;
      }
      const route = navigationRef?.getCurrentRoute?.();
      if (route?.name === "CallRoom" && route.params?.bookingId === row.booking_id) return;
      if (callRef.current) return;

      const booking = await lookupBooking(row.booking_id);
      const name = (user.role === "priest" ? booking?.customer_name : booking?.priest_name) || otherLabel;
      const pooja = booking?.pooja_name || "Booking call";
      const next = { bookingId: row.booking_id, name, pooja, booking };
      callRef.current = next;
      setCall(next);

      stopRing.current = startRingtone();
      timer.current = setTimeout(clear, RING_TIMEOUT_MS);
      if (typeof document !== "undefined") {
        savedTitle.current = document.title;
        document.title = `Incoming call - ${name}`;
        if (document.hidden) note.current = notify(`${name} is calling`, pooja, `call-${row.booking_id}`);
      }
    };

    const subscription = subscribeIncomingCalls(user.id, (row) => { onSignal(row).catch(() => {}); });
    return () => {
      subscription.unsubscribe();
      clear();
    };
  }, [clear, lookupBooking, navigationRef, user?.demo, user?.id, user?.role]);

  if (!call) return null;

  const accept = () => {
    const { bookingId, booking } = call;
    clear();
    navigationRef?.navigate?.("CallRoom", {
      bookingId,
      priestName: booking?.priest_name,
      customerName: booking?.customer_name,
      poojaName: booking?.pooja_name,
      autoStart: true,
    });
  };

  const decline = () => {
    const { bookingId } = call;
    clear();
    sendCallSignal({ bookingId, signalType: "hangup", payload: { reason: "declined" } }).catch(() => {});
  };

  return <View style={styles.overlay}>
    <View style={styles.card}>
      <Text style={styles.eyebrow}>INCOMING VIDEO CALL</Text>
      <View style={styles.avatar}><Text style={styles.avatarText}>{call.name.slice(0, 1).toUpperCase()}</Text></View>
      <Text style={styles.name}>{call.name}</Text>
      <Text style={styles.pooja}>{call.pooja}</Text>
      <View style={styles.actions}>
        <View style={styles.actionWrap}>
          <Pressable accessibilityLabel="Decline call" onPress={decline} style={[styles.action, styles.decline]}><PhoneOff size={22} color={colors.white} /></Pressable>
          <Text style={styles.actionLabel}>Decline</Text>
        </View>
        <View style={styles.actionWrap}>
          <Pressable accessibilityLabel="Accept call" onPress={accept} style={[styles.action, styles.accept]}><Phone size={22} color={colors.white} /></Pressable>
          <Text style={styles.actionLabel}>Accept</Text>
        </View>
      </View>
    </View>
  </View>;
}

const styles = bindBrandStyles({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2000, elevation: 2000, backgroundColor: "rgba(10,10,10,.72)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 340, borderRadius: 24, backgroundColor: "#141414", paddingVertical: 30, paddingHorizontal: 22, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  eyebrow: { color: colors.saffron, fontSize: 10, fontWeight: "800", letterSpacing: .8 },
  avatar: { width: 84, height: 84, borderRadius: 42, marginTop: 22, backgroundColor: "#2A231C", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.saffron },
  avatarText: { color: colors.white, fontSize: 32, fontWeight: "700" },
  name: { color: colors.white, fontSize: 22, fontWeight: "700", marginTop: 16, textAlign: "center" },
  pooja: { color: "#AFAFAF", fontSize: 12, marginTop: 4, textAlign: "center" },
  actions: { flexDirection: "row", justifyContent: "center", gap: 56, marginTop: 30 },
  actionWrap: { alignItems: "center", gap: 8 },
  action: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center" },
  decline: { backgroundColor: colors.danger },
  accept: { backgroundColor: colors.success },
  actionLabel: { color: "#C9C9C5", fontSize: 11 },
});
