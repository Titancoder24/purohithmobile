import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bindBrandStyles } from "../lib/brandStyles";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { ArrowLeft, Phone, Send, ShieldCheck } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, font, spacing } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { startInAppCall } from "../lib/calls";
import { listBookings } from "../lib/payments";
import { explainChatError, listBookingMessages, sendBookingMessage, subscribeBookingMessages } from "../lib/bookingChat";

const BOOKING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const demoMessages = (isCustomer, purohitName, customerName) => [{
  id: "welcome-1",
  sender_role: isCustomer ? "priest" : "customer",
  sender_name: isCustomer ? (purohitName || "Purohit") : (customerName || "Customer"),
  content: isCustomer
    ? "Namaste. I have received your ceremony details. Please feel free to share any timing or samagri preferences here."
    : "Namaste. Looking forward to conducting the ceremony. Please confirm your arrival schedule.",
  created_at: new Date(Date.now() - 60000).toISOString(),
}];

function routeBooking(params) {
  const booking = params?.booking;
  return booking && typeof booking === "object" ? booking : null;
}

function mergeMessages(current, incoming) {
  const map = new Map();
  for (const item of [...current, ...incoming]) {
    if (item?.id) map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export default function Conversation({ route }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const listRef = useRef(null);
  const params = route.params || {};
  const passedBooking = routeBooking(params);
  const bookingId = params.bookingId || passedBooking?.id || "";
  const isDemo = Boolean(user?.demo || bookingId === "demo-confirmed");
  const isCustomer = user?.role === "customer";

  const [booking, setBooking] = useState(passedBooking || {
    id: bookingId,
    priest_name: params.priestName || "Verified Purohit",
    customer_name: params.customerName || user?.name || "Customer",
    pooja_name: params.poojaName || "Ceremony",
  });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const storageKey = `@booking_messages_${bookingId || "demo"}`;

  const otherName = isCustomer ? (booking?.priest_name || params.priestName || "Your purohit") : (booking?.customer_name || params.customerName || "Customer");
  const title = useMemo(() => otherName || (isCustomer ? "Your purohit" : "Customer"), [isCustomer, otherName]);

  useEffect(() => {
    if (passedBooking?.priest_name && passedBooking?.pooja_name) return undefined;
    if (!BOOKING_ID.test(bookingId) || isDemo) return undefined;
    let cancelled = false;
    listBookings()
      .then(({ bookings }) => {
        const found = (bookings || []).find((item) => item.id === bookingId);
        if (!cancelled && found) setBooking(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [bookingId, isDemo, passedBooking]);

  const load = useCallback(async () => {
    if (!bookingId || isDemo) {
      const cached = await AsyncStorage.getItem(storageKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length) {
            setMessages(parsed);
            return;
          }
        } catch (_) {}
      }
      setMessages(demoMessages(isCustomer, booking?.priest_name, booking?.customer_name));
      return;
    }
    if (!BOOKING_ID.test(bookingId)) {
      setLoadError("Open this chat from the booking so it stays tied to that purohit.");
      setMessages([]);
      return;
    }
    try {
      const data = await listBookingMessages(bookingId);
      setMessages((current) => mergeMessages(current.filter((item) => item.pending), data));
      setLoadError("");
    } catch (error) {
      setLoadError(explainChatError(error));
    }
  }, [booking?.customer_name, booking?.priest_name, bookingId, isCustomer, isDemo, storageKey]);

  useEffect(() => {
    load();
    if (!BOOKING_ID.test(bookingId) || isDemo) return undefined;
    const unsubscribe = subscribeBookingMessages(bookingId, (message) => {
      setMessages((current) => mergeMessages(current, [message]));
    });
    const interval = setInterval(load, 8000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [bookingId, isDemo, load]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (!isDemo && !BOOKING_ID.test(bookingId)) {
      Alert.alert("Chat unavailable", "This conversation is not linked to a booking yet.");
      return;
    }
    setSending(true);
    const optimistic = {
      id: `local-${Date.now()}`,
      sender_id: user?.id,
      sender_role: user?.role || "customer",
      sender_name: user?.name || (isCustomer ? "You" : "Purohit"),
      content: text,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((current) => mergeMessages(current, [optimistic]));
    setDraft("");

    try {
      if (isDemo) {
        const nextList = mergeMessages(messages, [optimistic]);
        await AsyncStorage.setItem(storageKey, JSON.stringify(nextList));
        return;
      }
      const saved = await sendBookingMessage({
        bookingId,
        body: text,
        senderRole: user?.role,
        senderName: user?.name,
      });
      setMessages((current) => mergeMessages(current.filter((item) => item.id !== optimistic.id), [saved]));
      setLoadError("");
    } catch (error) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(text);
      Alert.alert("Failed to send", explainChatError(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <Pressable accessibilityLabel="Back to booking" onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <ArrowLeft size={20} color={colors.ink} />
        </Pressable>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{title.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{booking?.pooja_name || params.poojaName || "Booking conversation"}</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Start in-app call"
          onPress={() => startInAppCall(navigation, { bookingId, booking })}
          style={styles.callBtn}
        >
          <Phone size={18} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.safety}>
        <ShieldCheck size={14} color={colors.success} />
        <Text style={styles.safetyText}>Private conversation for this booking</Text>
      </View>

      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>Start the conversation about timing, address, or ceremony details.</Text>}
        renderItem={({ item }) => {
          const mine = item.sender_id ? item.sender_id === user?.id : item.sender_role === user?.role;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={[styles.sender, mine && { color: "rgba(255,255,255,.75)" }]}>
                {mine ? "You" : item.sender_name || title}
              </Text>
              <Text style={[styles.message, mine && { color: colors.white }]}>{item.content}</Text>
              <Text style={[styles.time, mine && { color: "rgba(255,255,255,.72)" }]}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          );
        }}
      />

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message..."
          placeholderTextColor={colors.muted2}
          style={styles.input}
          multiline
        />
        <Pressable
          accessibilityLabel="Send message"
          onPress={send}
          disabled={!draft.trim() || sending}
          style={[styles.send, (!draft.trim() || sending) && { opacity: 0.35 }]}
        >
          <Send size={18} color={colors.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = bindBrandStyles({
  root: { flex: 1, backgroundColor: colors.white },
  header: { minHeight: 72, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.warmBorder },
  iconBtn: { width: 40, height: 40, borderWidth: 1, borderColor: colors.warmBorder, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontWeight: "700" },
  title: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  subtitle: { color: colors.muted2, fontSize: 10, marginTop: 2 },
  callBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
  safety: { flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, paddingVertical: 9, backgroundColor: "#EEF8F2" },
  safetyText: { color: colors.muted2, fontSize: 10 },
  error: { color: "#9B2C2C", fontSize: 12, lineHeight: 17, paddingHorizontal: spacing.lg, paddingTop: 10 },
  messages: { padding: spacing.lg, gap: 10, flexGrow: 1, justifyContent: "flex-end" },
  empty: { textAlign: "center", color: colors.muted2, fontSize: 12, lineHeight: 18, padding: spacing.xxl },
  bubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.brandBrown, borderBottomRightRadius: 5 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.muted, borderBottomLeftRadius: 5 },
  sender: { color: colors.muted2, fontSize: 10, fontWeight: "700", marginBottom: 4 },
  message: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  time: { color: colors.muted2, fontSize: 9, marginTop: 6, alignSelf: "flex-end" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderColor: colors.warmBorder,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 100,
    backgroundColor: colors.muted,
    borderRadius: 23,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: font.sizes.base,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brandBrown,
    alignItems: "center",
    justifyContent: "center",
  },
});
