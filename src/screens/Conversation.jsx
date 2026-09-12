import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ArrowLeft, Phone, Send, ShieldCheck } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, font, spacing } from "../lib/theme";
import { useAuth } from "../lib/auth";
import api from "../lib/api";

const demoMessages = (isCustomer) => [{
  id: "welcome",
  sender_role: isCustomer ? "priest" : "customer",
  sender_name: isCustomer ? "Demo Purohit" : "Demo Customer",
  content: isCustomer ? "Namaste. I have received your booking. Please share any timing or ceremony notes here." : "Namaste. I am ready for the ceremony. Please confirm the arrival time.",
  created_at: new Date().toISOString(),
}];

export default function Conversation({ route }) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const routeBooking = route.params?.booking;
  const bookingId = route.params?.bookingId || routeBooking?.id;
  const [booking, setBooking] = useState(routeBooking || (bookingId === "demo-confirmed" ? { id: "demo-confirmed", demo: true, pooja_name: "Satyanarayan Pooja", priest_name: "Demo Purohit", customer_name: "Demo Customer" } : null));
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const demoChannel = useRef(null);
  const isCustomer = user?.role === "customer";
  const otherName = isCustomer ? booking?.priest_name : booking?.customer_name;

  useEffect(() => {
    if (booking || !bookingId || user?.demo) return;
    api.get(user?.role === "customer" ? "/bookings/customer" : "/bookings/priest").then(({ data }) => setBooking((data || []).find((item) => item.id === bookingId) || null)).catch(() => {});
  }, [booking, bookingId, user?.demo, user?.role]);

  const load = useCallback(async () => {
    if (booking?.demo || user?.demo) return setMessages(demoMessages(isCustomer));
    try {
      const { data } = await api.get(`/bookings/${booking.id}/messages`);
      setMessages(data || []);
    } catch (_) { setMessages([]); }
  }, [booking?.demo, booking?.id, isCustomer, user?.demo]);

  useEffect(() => {
    load();
    if (booking?.demo || user?.demo) return undefined;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [booking?.demo, load, user?.demo]);

  useEffect(() => {
    if (!(booking?.demo || user?.demo) || typeof globalThis.BroadcastChannel === "undefined") return undefined;
    demoChannel.current = new BroadcastChannel(`purohith-chat-${booking?.id || "demo"}`);
    demoChannel.current.onmessage = ({ data }) => {
      if (data?.sender_role && data.sender_role !== user?.role) setMessages((current) => [...current, data]);
    };
    return () => { demoChannel.current?.close(); demoChannel.current = null; };
  }, [booking?.demo, booking?.id, user?.demo, user?.role]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setDraft("");
    const optimistic = { id: `local-${Date.now()}`, sender_role: user.role, sender_name: user.name, content, created_at: new Date().toISOString() };
    setMessages((current) => [...current, optimistic]);
    if (booking?.demo || user?.demo) { demoChannel.current?.postMessage(optimistic); return; }
    setSending(true);
    try { await api.post(`/bookings/${booking.id}/messages`, { content }); }
    catch (error) { Alert.alert("Message not sent", error?.response?.data?.detail || "Please try again."); }
    finally { setSending(false); }
  };

  const title = useMemo(() => otherName || (isCustomer ? "Your purohit" : "Customer"), [isCustomer, otherName]);
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to booking" onPress={() => navigation.goBack()} style={styles.iconBtn}><ArrowLeft size={20} color={colors.ink} /></Pressable>
        <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{title.slice(0, 1)}</Text></View><View><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{booking?.pooja_name || "Booking conversation"}</Text></View></View>
        <Pressable accessibilityLabel="Start audio call" onPress={() => navigation.navigate("CallRoom", { bookingId })} style={styles.callBtn}><Phone size={18} color={colors.ink} /></Pressable>
      </View>
      <View style={styles.safety}><ShieldCheck size={14} color={colors.success} /><Text style={styles.safetyText}>Private conversation for this booking</Text></View>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        ListEmptyComponent={<Text style={styles.empty}>Start the conversation about timing, address, or ceremony details.</Text>}
        renderItem={({ item }) => {
          const mine = item.sender_role === user?.role;
          return <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}><Text style={[styles.sender, mine && { color: "rgba(255,255,255,.75)" }]}>{mine ? "You" : item.sender_name || title}</Text><Text style={[styles.message, mine && { color: colors.white }]}>{item.content}</Text><Text style={[styles.time, mine && { color: "rgba(255,255,255,.72)" }]}>{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text></View>;
        }}
      />
      <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} placeholder="Write a message..." placeholderTextColor={colors.muted2} style={styles.input} multiline /><Pressable accessibilityLabel="Send message" onPress={send} disabled={!draft.trim() || sending} style={[styles.send, (!draft.trim() || sending) && { opacity: .35 }]}><Send size={18} color={colors.white} /></Pressable></View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: { minHeight: 72, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.warmBorder },
  iconBtn: { width: 40, height: 40, borderWidth: 1, borderColor: colors.warmBorder, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontWeight: "700" }, title: { color: colors.ink, fontSize: 15, fontWeight: "700" }, subtitle: { color: colors.muted2, fontSize: 10, marginTop: 2 },
  callBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
  safety: { flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, paddingVertical: 9, backgroundColor: "#EEF8F2" }, safetyText: { color: colors.muted2, fontSize: 10 },
  messages: { padding: spacing.lg, gap: 10, flexGrow: 1, justifyContent: "flex-end" }, empty: { textAlign: "center", color: colors.muted2, fontSize: 12, lineHeight: 18, padding: spacing.xxl },
  bubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18 }, mine: { alignSelf: "flex-end", backgroundColor: colors.brandBrown, borderBottomRightRadius: 5 }, theirs: { alignSelf: "flex-start", backgroundColor: colors.muted, borderBottomLeftRadius: 5 },
  sender: { color: colors.muted2, fontSize: 10, fontWeight: "700", marginBottom: 4 }, message: { color: colors.ink, fontSize: 14, lineHeight: 20 }, time: { color: colors.muted2, fontSize: 9, marginTop: 6, alignSelf: "flex-end" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.warmBorder }, input: { flex: 1, minHeight: 46, maxHeight: 100, backgroundColor: colors.muted, borderRadius: 23, paddingHorizontal: 16, paddingVertical: 12, color: colors.ink, fontSize: font.sizes.base }, send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" },
});
