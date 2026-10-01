import React, { useCallback, useEffect, useMemo, useState } from "react";
import { bindBrandStyles } from "../lib/brandStyles";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Bot, CalendarDays, ChevronRight, MessageSquareText, Phone, Plus, ShieldCheck, Sparkles } from "lucide-react-native";
import { colors, font, radii, shadow, spacing } from "../lib/theme";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import { listBookings } from "../lib/payments";
import { SearchField, SegmentedControl } from "../components/ProductUI";
import { startInAppCall } from "../lib/calls";

export default function Inbox({ navigation }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const isCustomer = user?.role === "customer";

  const load = useCallback(async () => {
    try {
      // Fetch from Supabase workflow first, with fallback to REST API
      const { bookings } = await listBookings().catch(() => ({ bookings: [] }));
      let items = bookings || [];

      if (!items.length) {
        try {
          const { data } = await api.get(isCustomer ? "/bookings/customer" : "/bookings/priest");
          items = data || [];
        } catch (_) {}
      }

      // Filter active or confirmed/paid bookings that have communication channels
      const activeBookings = (items || []).filter((item) =>
        ["confirmed", "paid", "pending", "payment_pending", "completed"].includes(item.status) ||
        item.payment_status === "paid"
      );

      setThreads(activeBookings);
    } catch (_) {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [isCustomer]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const supportThread = {
    id: "support-puro-mitra",
    isSupport: true,
    title: "PuroMitra AI Assistant",
    subtitle: "24/7 Vedic rituals, muhurat timing & booking support",
    pooja_name: "AI Ceremony Guidance",
    time: "Always active",
    last: "Ask about pooja vidhi, samagri checklist, or muhurat dates...",
  };

  const visibleThreads = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = threads.map((item) => ({
      ...item,
      isBooking: true,
      contactName: isCustomer ? (item.priest_name || "Verified Purohit") : (item.customer_name || "Customer"),
    }));

    if (filter === "bookings") {
      // Only purohit booking threads
    } else if (filter === "support") {
      list = [supportThread];
    } else {
      // "all" includes support thread at top + all booking threads
      list = [supportThread, ...list];
    }

    if (!q) return list;

    return list.filter((item) => {
      const contact = item.contactName || item.title || "";
      const ceremony = item.pooja_name || "";
      const lastMsg = item.last || item.subtitle || "";
      return `${contact} ${ceremony} ${lastMsg}`.toLowerCase().includes(q);
    });
  }, [filter, isCustomer, query, threads]);

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={visibleThreads}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.saffron} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>INBOX</Text>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Messages</Text>
                <View style={styles.count}>
                  <Text style={styles.countText}>{threads.length}</Text>
                </View>
              </View>
              <Text style={styles.subtitle}>
                Coordinate timings, samagri, and ceremony details directly with your purohit.
              </Text>
            </View>
          </View>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search conversations" style={styles.search} />
          <SegmentedControl
            options={[
              { label: "All", value: "all" },
              { label: `Bookings (${threads.length})`, value: "bookings" },
              { label: "Support & AI", value: "support" },
            ]}
            value={filter}
            onChange={setFilter}
            style={styles.filters}
          />
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <MessageSquareText size={36} color={colors.saffron} />
          </View>
          <Text style={styles.emptyTitle}>No ceremony messages yet</Text>
          <Text style={styles.emptyBody}>
            When you confirm a booking or receive proposals from verified purohits, your direct chat channel will appear here.
          </Text>

          <View style={styles.emptyActions}>
            <Pressable
              onPress={() => navigation.navigate("Tabs", { screen: "Home" })}
              style={styles.emptyPrimaryBtn}
            >
              <Plus size={16} color={colors.white} />
              <Text style={styles.emptyPrimaryText}>Book a Ceremony</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("Tabs", { screen: "PuroMitra" })}
              style={styles.emptySecondaryBtn}
            >
              <Sparkles size={16} color={colors.brandBrown} />
              <Text style={styles.emptySecondaryText}>Ask PuroMitra AI</Text>
            </Pressable>
          </View>
        </View>
      }
      renderItem={({ item }) => {
        if (item.isSupport) {
          return (
            <Pressable
              onPress={() => navigation.navigate("Tabs", { screen: "PuroMitra" })}
              style={({ pressed }) => [styles.thread, styles.supportThread, pressed && styles.threadPressed]}
            >
              <View style={[styles.avatar, styles.supportAvatar]}>
                <Bot size={22} color={colors.white} />
              </View>
              <View style={styles.threadBody}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.title}</Text>
                  <View style={styles.onlineBadge}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>24/7 AI</Text>
                  </View>
                </View>
                <Text style={styles.ceremony}>{item.pooja_name}</Text>
                <Text style={styles.preview} numberOfLines={1}>{item.last}</Text>
              </View>
              <ChevronRight size={18} color={colors.muted2} style={{ marginLeft: 6 }} />
            </Pressable>
          );
        }

        return <BookingThread item={item} isCustomer={isCustomer} navigation={navigation} />;
      }}
    />
  );
}

function BookingThread({ item, isCustomer, navigation }) {
  const other = isCustomer ? (item.priest_name || "Verified Purohit") : (item.customer_name || "Customer");
  const dateStr = item.booking_date || item.ceremony_date || "";
  const timeStr = item.booking_time || item.ceremony_time || "";
  const isPaid = item.payment_status === "paid" || item.status === "confirmed";

  // Clean time format (e.g. 09:00:00 -> 09:00 AM)
  const formattedTime = useMemo(() => {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parts[1];
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${h12}:${m} ${ampm}`;
    }
    return timeStr;
  }, [timeStr]);

  return (
    <Pressable
      onPress={() => navigation.navigate("Conversation", { bookingId: item.id, booking: item })}
      style={({ pressed }) => [styles.thread, pressed && styles.threadPressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(other || "P").slice(0, 1)}</Text>
      </View>
      <View style={styles.threadBody}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{other}</Text>
          <Text style={styles.time}>{dateStr}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.ceremony} numberOfLines={1}>{item.pooja_name || "Ceremony"}</Text>
          {isPaid ? (
            <View style={styles.paidPill}>
              <Text style={styles.paidPillText}>Confirmed</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {item.last || (formattedTime ? `Scheduled at ${formattedTime}` : "Tap to coordinate details")}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Open messages"
          onPress={() => navigation.navigate("Conversation", { bookingId: item.id, booking: item })}
          style={styles.messageAction}
        >
          <MessageSquareText size={16} color={colors.white} />
        </Pressable>
        <Pressable
          accessibilityLabel="Call contact"
          onPress={() => startInAppCall(navigation, { bookingId: item.id, booking: item })}
          style={styles.callAction}
        >
          <Phone size={16} color={colors.ink} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = bindBrandStyles({
  root: { flex: 1, backgroundColor: colors.white },
  content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 16, paddingBottom: 100 },
  header: { marginBottom: 10, paddingTop: 8 },
  hero: { paddingBottom: 4 },
  heroCopy: { flex: 1, minWidth: 0 },
  kicker: { color: colors.saffron, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  title: { color: colors.ink, fontSize: 28, fontWeight: "700" },
  count: { minWidth: 26, height: 26, paddingHorizontal: 7, borderRadius: 13, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
  countText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  subtitle: { color: colors.muted2, fontSize: 13, lineHeight: 18, marginTop: 4, maxWidth: 460 },
  search: { marginTop: 16 },
  filters: { marginTop: 12, marginBottom: 12 },
  separator: { height: 1, backgroundColor: "#F2EFEB", marginLeft: 64 },
  thread: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  supportThread: { backgroundColor: "#FAF7F5", borderWidth: 1, borderColor: colors.warmBorder, marginVertical: 4 },
  threadPressed: { backgroundColor: colors.muted },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" },
  supportAvatar: { backgroundColor: colors.saffron },
  avatarText: { color: colors.white, fontSize: 17, fontWeight: "700" },
  threadBody: { flex: 1, minWidth: 0, justifyContent: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 },
  name: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "700" },
  time: { color: colors.muted2, fontSize: 11, fontWeight: "500" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  ceremony: { color: colors.saffron, fontSize: 12, fontWeight: "700", flexShrink: 1 },
  paidPill: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 5, backgroundColor: "#E6F4EA" },
  paidPillText: { color: colors.success, fontSize: 9.5, fontWeight: "700" },
  preview: { color: colors.muted2, fontSize: 12, marginTop: 3 },
  actions: { flexDirection: "row", gap: 8, alignItems: "center", marginLeft: 4 },
  messageAction: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandBrown },
  callAction: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.warmBorder },
  onlineBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: "#E6F4EA" },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  onlineText: { color: colors.success, fontSize: 9, fontWeight: "800" },

  /* Empty State */
  emptyContainer: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFF5ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 13,
    color: colors.muted2,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 320,
    marginBottom: 24,
  },
  emptyActions: {
    flexDirection: "row",
    gap: 12,
  },
  emptyPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandBrown,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyPrimaryText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  emptySecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.muted,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warmBorder,
  },
  emptySecondaryText: {
    color: colors.brandBrown,
    fontSize: 13,
    fontWeight: "700",
  },
});
