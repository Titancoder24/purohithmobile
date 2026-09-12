import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BadgeIndianRupee, Check, Clock3, MapPin, Navigation, Send, Sparkles } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import MapplsDrawer from "../../components/MapplsDrawer";
import { listProviderRequests, sendProviderProposal } from "../../lib/payments";

const DEMO_REQUESTS = [
  { id: "market-griha", pooja_name: "Griha Pravesh Puja", ceremony_date: "2026-08-18", ceremony_time: "09:00", address: "12 Temple Street, Indiranagar, Bengaluru", landmark: "Near Eshwara Temple", lat: 12.9784, lng: 77.6408, notes: "New home; need samagri guidance.", budget_min: 3500, budget_max: 6500, my_bid_status: null },
  { id: "market-satya", pooja_name: "Satyanarayana Puja", ceremony_date: "2026-08-20", ceremony_time: "07:30", address: "44 South End Road, Jayanagar, Bengaluru", landmark: "Apartment gate B", lat: 12.9299, lng: 77.5826, notes: "Family ceremony for 12 people.", budget_min: 2500, budget_max: 4500, my_bid_status: null },
];

export default function Marketplace() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [messages, setMessages] = useState({});
  const [samagri, setSamagri] = useState({});
  const [sending, setSending] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [mapTarget, setMapTarget] = useState(null);

  const load = useCallback(async () => {
    if (user?.demo) return setItems(DEMO_REQUESTS);
    try {
      const data = await listProviderRequests(user?.id);
      setItems(data.requests || []);
    } catch (_) { setItems([]); }
  }, [user?.demo, user?.id]);

  useEffect(() => { load(); }, [load]);

  const bid = async (item) => {
    const amount = Number(quotes[item.id]);
    if (!amount || amount < 1) return Alert.alert("Enter your proposal", "Add the amount you would charge for this ceremony.");
    setSending(item.id);
    try {
      await sendProviderProposal({
        user_id: user?.id,
        request_id: item.id,
        amount_inr: amount,
        message: messages[item.id] || "I am available and would be happy to conduct this ceremony.",
        includes_samagri: Boolean(samagri[item.id]),
      });
      Alert.alert("Proposal sent", "The customer can now compare your offer.");
      load();
    } catch (e) {
      if (user?.demo) return Alert.alert("Demo proposal sent", "Your proposal is now visible to the customer.");
      Alert.alert("Could not send proposal", e?.response?.data?.detail || "Try again.");
    } finally { setSending(""); }
  };

  return <>
  <ScrollView style={styles.root} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.saffron} />}>
    <View style={styles.hero}>
      <View style={styles.heroIcon}><Sparkles size={19} color={colors.saffron} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>CEREMONY MARKETPLACE</Text>
        <Text style={styles.title}>Requests that match your practice.</Text>
        <Text style={styles.sub}>Review the exact address, open the map, then send your price proposal.</Text>
      </View>
    </View>
    <View style={styles.marketStats}><View><Text style={styles.marketValue}>{items.length}</Text><Text style={styles.marketLabel}>Matching requests</Text></View><View style={styles.marketDivider} /><View><Text style={styles.marketValue}>Bengaluru</Text><Text style={styles.marketLabel}>Current service area</Text></View></View>

    {items.length ? items.map((item) => {
      const budget = item.budget_min || item.budget_max ? `Customer budget ₹${Number(item.budget_min || 0).toLocaleString("en-IN")} - ₹${Number(item.budget_max || 0).toLocaleString("en-IN")}` : "Open to proposals";
      return <View key={item.id} style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.pooja_name}</Text>
            <Text style={styles.date}><Clock3 size={13} color={colors.saffron} /> {item.ceremony_date} · {item.ceremony_time}</Text>
          </View>
          <Text style={styles.open}>{item.my_bid_status ? item.my_bid_status.toUpperCase() : (item.payment_status === "admin_verified" ? "VERIFIED" : "AI REVIEWED")}</Text>
        </View>

        <View style={styles.addressRow}>
          <MapPin size={16} color={colors.saffron} />
          <View style={{ flex: 1 }}>
            <Text style={styles.address}>{item.address}</Text>
            {item.landmark ? <Text style={styles.landmark}>{item.landmark}</Text> : null}
          </View>
          <Pressable onPress={() => setMapTarget({ ...item, title: item.pooja_name })} style={styles.mapButton}><Navigation size={15} color={colors.ink} /><Text style={styles.mapButtonText}>Map</Text></Pressable>
        </View>

        <View style={styles.metaRow}><Text style={styles.budget}>{budget}</Text></View>
        {item.notes ? <Text style={styles.note}>{item.notes}</Text> : null}

        {item.my_bid_status ? null : <>
          <View style={styles.quote}><BadgeIndianRupee size={17} color={colors.saffron} /><TextInput value={quotes[item.id] || ""} onChangeText={(value) => setQuotes((current) => ({ ...current, [item.id]: value.replace(/[^0-9]/g, "") }))} keyboardType="numeric" placeholder="Your proposal amount" placeholderTextColor="#8D8A85" style={styles.quoteInput} /></View>
          <TextInput value={messages[item.id] || ""} onChangeText={(value) => setMessages((current) => ({ ...current, [item.id]: value }))} multiline placeholder="Message to customer: timing, samagri, tradition..." placeholderTextColor="#8D8A85" style={styles.messageInput} />
          <Pressable onPress={() => setSamagri((current) => ({ ...current, [item.id]: !current[item.id] }))} style={styles.checkRow}>
            <View style={[styles.checkBox, samagri[item.id] && styles.checkBoxActive]}>{samagri[item.id] ? <Check size={13} color={colors.white} /> : null}</View>
            <Text style={styles.checkText}>My proposal includes samagri</Text>
          </Pressable>
          <Pressable onPress={() => bid(item)} disabled={sending === item.id} style={({ pressed }) => [styles.send, pressed && styles.sendPressed]}>
            <Text style={styles.sendText}>{sending === item.id ? "Sending..." : "Send proposal"}</Text><Send size={16} color={colors.white} />
          </Pressable>
        </>}
      </View>;
    }) : <View style={styles.empty}><Text style={styles.emptyTitle}>No matching requests yet</Text><Text style={styles.emptyText}>Keep your availability, pooja categories, and service areas current to receive relevant requests.</Text></View>}
  </ScrollView>
  <MapplsDrawer visible={Boolean(mapTarget)} location={mapTarget} onClose={() => setMapTarget(null)} />
  </>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white }, content: { padding: 20, paddingBottom: 40 },
  hero: { flexDirection: "row", gap: 14, paddingVertical: 12, paddingBottom: 24, borderBottomWidth: 1, borderColor: colors.warmBorder },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFF1EB", alignItems: "center", justifyContent: "center" },
  kicker: { color: colors.saffron, fontSize: 9, fontWeight: "700", letterSpacing: .8 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "700", lineHeight: 29, marginTop: 4 },
  sub: { color: colors.muted2, fontSize: 12, lineHeight: 18, marginTop: 5 },
  marketStats: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 24, borderBottomWidth: 1, borderColor: colors.warmBorder }, marketValue: { color: colors.ink, fontSize: 16, fontWeight: "700" }, marketLabel: { color: colors.muted2, fontSize: 10, marginTop: 3 }, marketDivider: { width: 1, height: 38, backgroundColor: colors.warmBorder },
  card: { marginTop: 0, paddingVertical: 22, borderBottomWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  name: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  date: { color: colors.muted2, fontSize: 11, marginTop: 7 },
  open: { color: colors.saffron, fontWeight: "700", fontSize: 9, paddingTop: 3 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingTop: 6 },
  address: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  landmark: { color: colors.muted2, fontSize: 10, lineHeight: 14, marginTop: 2 },
  mapButton: { minWidth: 66, height: 34, borderRadius: 17, backgroundColor: colors.muted, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, mapButtonText: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  metaRow: { marginTop: 12, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.warmBorder },
  budget: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  note: { color: colors.muted2, fontSize: 12, lineHeight: 17, marginTop: 10 },
  quote: { height: 50, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.warmBorder, borderRadius: 12, paddingHorizontal: 13, marginTop: 16, backgroundColor: colors.muted },
  quoteInput: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "600" },
  messageInput: { minHeight: 82, borderWidth: 1, borderColor: colors.warmBorder, borderRadius: 12, padding: 13, marginTop: 10, color: colors.ink, fontSize: 13, lineHeight: 18, backgroundColor: colors.muted },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  checkBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.warmBorder, alignItems: "center", justifyContent: "center" },
  checkBoxActive: { backgroundColor: colors.saffron, borderColor: colors.saffron },
  checkText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  send: { height: 50, marginTop: 13, backgroundColor: colors.brandBrown, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderBottomWidth: 3, borderBottomColor: colors.brandBrownDark, shadowColor: "#000", shadowOpacity: .14, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  sendPressed: { transform: [{ translateY: 2 }, { scale: .99 }], borderBottomWidth: 1, shadowOpacity: .05 },
  sendText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  empty: { marginTop: 24, padding: 26, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center" },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  emptyText: { color: colors.muted2, fontSize: 11, textAlign: "center", lineHeight: 16, marginTop: 6 },
});
