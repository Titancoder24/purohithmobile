import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, Text, Vibration, View } from "react-native";
import { Audio } from "expo-av";
import { Phone, PhoneOff } from "lucide-react-native";
import { bindBrandStyles } from "../lib/brandStyles";
import { colors } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { listBookings } from "../lib/payments";
import { findRingingCalls, sendCallSignal, subscribeIncomingCalls } from "../lib/callSignaling";

const RING_TIMEOUT_MS = 45000;

let audioContext = null;

function unlockAudio() {
  const AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioContext) audioContext = new AudioCtor();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function startNativeRingtone() {
  Vibration.vibrate([0, 900, 700], true);
  let stopped = false;
  let sound = null;
  (async () => {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: false });
    const created = await Audio.Sound.createAsync(require("../../assets/sounds/ringtone.wav"), { isLooping: true, volume: 1, shouldPlay: !stopped });
    if (stopped) await created.sound.unloadAsync();
    else sound = created.sound;
  })().catch(() => {});
  return () => {
    stopped = true;
    Vibration.cancel();
    if (sound) sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {});
  };
}

function startRingtone() {
  if (Platform.OS !== "web") return startNativeRingtone();
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

export default function IncomingCall({ navigationRef }) {
  const { user } = useAuth();
  const [call, setCall] = useState(null);
  const callRef = useRef(null);
  const stopRing = useRef(() => {});
  const timer = useRef(null);
  const savedTitle = useRef(null);
  const bookings = useRef(new Map());
  const ringRef = useRef(async () => {});

  const clear = useCallback(() => {
    stopRing.current();
    stopRing.current = () => {};
    clearTimeout(timer.current);
    if (savedTitle.current !== null && typeof document !== "undefined") document.title = savedTitle.current;
    savedTitle.current = null;
    callRef.current = null;
    setCall(null);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return undefined;
    const prime = () => {
      unlockAudio();
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

  ringRef.current = async (bookingId, startedAt) => {
    if (!bookingId || callRef.current) return;
    const route = navigationRef?.getCurrentRoute?.();
    if (route?.name === "CallRoom" && route.params?.bookingId === bookingId) return;
    const otherLabel = user?.role === "priest" ? "Customer" : "Purohit";
    const placeholder = { bookingId, name: otherLabel, pooja: "Booking call", booking: null };
    callRef.current = placeholder;
    const booking = await lookupBooking(bookingId);
    if (callRef.current !== placeholder) return;
    const name = (user?.role === "priest" ? booking?.customer_name : booking?.priest_name) || otherLabel;
    const pooja = booking?.pooja_name || "Booking call";
    const next = { bookingId, name, pooja, booking };
    callRef.current = next;
    setCall(next);

    stopRing.current = startRingtone();
    const elapsed = startedAt ? Math.max(0, Date.now() - Date.parse(startedAt)) : 0;
    timer.current = setTimeout(clear, Math.max(5000, RING_TIMEOUT_MS - elapsed));
    if (typeof document !== "undefined") {
      savedTitle.current = document.title;
      document.title = `Incoming call - ${name}`;
    }
  };

  useEffect(() => {
    if (!user?.id || user.demo) return undefined;
    const catchUp = () => {
      if (callRef.current) return;
      findRingingCalls(user.id)
        .then((rows) => {
          const latest = rows[rows.length - 1];
          if (latest) ringRef.current(latest.booking_id, latest.created_at).catch(() => {});
        })
        .catch(() => {});
    };
    const onSignal = (row) => {
      if (row.signal_type === "hangup") {
        if (callRef.current?.bookingId === row.booking_id) clear();
        return;
      }
      ringRef.current(row.booking_id, row.created_at).catch(() => {});
    };
    const subscription = subscribeIncomingCalls(user.id, onSignal, { onSubscribed: catchUp });

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") subscription.resync();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") subscription.resync();
    };
    if (Platform.OS === "web" && typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
    return () => {
      appState.remove();
      if (Platform.OS === "web" && typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
      subscription.unsubscribe();
      clear();
    };
  }, [clear, user?.demo, user?.id]);

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
