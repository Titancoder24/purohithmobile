import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { MessageSquareText, Phone, ShieldCheck } from "lucide-react-native";
import { colors } from "../lib/theme";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import { EmptyState, SearchField, SegmentedControl } from "../components/ProductUI";
import { startInAppCall } from "../lib/calls";

export default function Inbox({ navigation }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const isCustomer = user?.role === "customer";
  const load = useCallback(async () => {
    try { const { data } = await api.get(isCustomer ? "/bookings/customer" : "/bookings/priest"); setThreads((data || []).filter((item) => item.status === "confirmed")); } catch (_) { setThreads([]); }
  }, [isCustomer]);
  useEffect(() => { load(); }, [load]);
  const visibleThreads = useMemo(() => threads.filter((item) => {
    const contact = isCustomer ? item.priest_name : item.customer_name;
    const matchesQuery = `${contact || ""} ${item.pooja_name || ""} ${item.last || ""}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (filter === "all" || (filter === "bookings" && item.status === "confirmed"));
  }), [filter, isCustomer, query, threads]);
  return <FlatList style={styles.root} contentContainerStyle={styles.content} data={visibleThreads} keyExtractor={(item) => item.id} ItemSeparatorComponent={() => <View style={styles.separator} />}
    ListHeaderComponent={<View style={styles.header}>
      <View style={styles.hero}><View style={styles.heroCopy}><Text style={styles.kicker}>INBOX</Text><View style={styles.titleRow}><Text style={styles.title}>Messages</Text><View style={styles.count}><Text style={styles.countText}>{threads.length}</Text></View></View><Text style={styles.subtitle}>Ceremony details, arrival updates, and support conversations.</Text></View></View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search conversations" style={styles.search} />
      <SegmentedControl options={[{ label: "All", value: "all" }, { label: "Bookings", value: "bookings" }, { label: "Support", value: "support" }]} value={filter} onChange={setFilter} style={styles.filters} />
    </View>}
    ListEmptyComponent={<EmptyState icon={ShieldCheck} title="No active messages" body="Confirmed ceremony conversations will appear here." />}
    renderItem={({ item }) => <Thread item={item} isCustomer={isCustomer} navigation={navigation} />}
  />;
}

function Thread({ item, isCustomer, navigation }) {
  const other = isCustomer ? item.priest_name : item.customer_name;
  return <Pressable onPress={() => navigation.navigate("Conversation", { bookingId: item.id })} style={({ pressed }) => [styles.thread, pressed && styles.threadPressed]}><View style={styles.avatar}><Text style={styles.avatarText}>{(other || "P").slice(0, 1)}</Text></View><View style={styles.threadBody}><View style={styles.row}><Text style={styles.name}>{other || "Booking contact"}</Text><Text style={styles.time}>{item.time || ""}</Text></View><Text style={styles.ceremony}>{item.pooja_name}</Text><Text style={styles.preview} numberOfLines={1}>{item.last || "Start the conversation"}</Text></View><View style={styles.actions}><Pressable accessibilityLabel="Open messages" onPress={() => navigation.navigate("Conversation", { bookingId: item.id })} style={styles.messageAction}><MessageSquareText size={17} color={colors.white} /></Pressable><Pressable accessibilityLabel="Call contact" onPress={() => startInAppCall(navigation, { bookingId: item.id, booking: item })} style={styles.callAction}><Phone size={16} color={colors.ink} /></Pressable></View></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white }, content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 20, paddingBottom: 48 }, header: { marginBottom: 10, paddingTop: 12 }, hero: { paddingBottom: 4 }, heroCopy: { flex: 1, minWidth: 0 }, kicker: { color: colors.saffron, fontSize: 10, fontWeight: "700", letterSpacing: .8 }, titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }, title: { color: colors.ink, fontSize: 32, fontWeight: "700" }, count: { minWidth: 26, height: 26, paddingHorizontal: 7, borderRadius: 13, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }, countText: { color: colors.ink, fontSize: 11, fontWeight: "700" }, subtitle: { color: colors.muted2, fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 420 }, search: { marginTop: 20 }, filters: { marginTop: 12, marginBottom: 14 }, separator: { height: 1, backgroundColor: colors.warmBorder, marginLeft: 66 }, thread: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 10 }, threadPressed: { backgroundColor: colors.muted }, avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.white, fontSize: 20, fontWeight: "700" }, threadBody: { flex: 1, minWidth: 0 }, row: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, name: { color: colors.ink, fontSize: 15, fontWeight: "700" }, time: { color: colors.muted2, fontSize: 10 }, ceremony: { color: colors.saffron, fontSize: 10, fontWeight: "700", marginTop: 3 }, preview: { color: colors.muted2, fontSize: 12, marginTop: 5 }, actions: { flexDirection: "row", gap: 6 }, messageAction: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandBrown }, callAction: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted },
});
