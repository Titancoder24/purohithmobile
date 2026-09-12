import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BadgeCheck, Check, Clock3, Download, MapPin, MessageSquareText, Navigation, ShieldCheck, WalletCards } from "lucide-react-native";
import { colors, radii, font } from "../../lib/theme";
import { Button } from "../../components/UI";
import OpenStreetMap from "../../components/OpenStreetMap";
import MapplsDrawer from "../../components/MapplsDrawer";
import { useAuth } from "../../lib/auth";
import { createCashfreeOrder, downloadInvoice, listRequestProposals, openCashfreeCheckout, selectProposal, verifyCashfreeOrder } from "../../lib/payments";

const DEMO_BIDS = [
  { id: "demo-bid-rama", priest_name: "Sri Ramachandra Sharma", amount: 2900, message: "I can conduct this ceremony with traditional samagri guidance.", includes_samagri: true },
  { id: "demo-bid-ramesh", priest_name: "Pandit Ramesh Shukla", amount: 3200, message: "Available at your requested time. Happy to discuss family traditions first.", includes_samagri: false },
];

export default function RequestProposals({ route }) {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const params = route.params || {};
  const request = {
    id: params.requestId || params.request?.id,
    pooja_name: params.poojaName || params.request?.pooja_name,
    ceremony_date: params.ceremonyDate || params.request?.ceremony_date,
    ceremony_time: params.ceremonyTime || params.request?.ceremony_time,
    address: params.address || params.request?.address,
    landmark: params.landmark || params.request?.landmark,
    lat: params.lat || params.request?.lat,
    lng: params.lng || params.request?.lng,
  };
  const latitude = Number(request.lat || 12.9784);
  const longitude = Number(request.lng || 77.6408);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState("");
  const [selectedBid, setSelectedBid] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payment, setPayment] = useState(null);
  const [paying, setPaying] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const desktop = width >= 850;
  const bestPrice = useMemo(() => bids.length ? Math.min(...bids.map((bid) => Number(bid.amount))) : 0, [bids]);

  useEffect(() => {
    if (!request.id) { setBids(DEMO_BIDS); setLoading(false); return; }
    listRequestProposals(request.id).then((data) => setBids(data?.proposals?.length ? data.proposals : (user?.demo ? DEMO_BIDS : []))).catch(() => setBids(user?.demo ? DEMO_BIDS : [])).finally(() => setLoading(false));
  }, [request.id, user?.demo]);

  const award = async (bid) => {
    setSelecting(bid.id);
    try {
      const data = await selectProposal(request.id, bid.id);
      const accepted = data?.proposal || bid;
      setSelectedBid(accepted);
      setPaymentAmount(String(data?.amount_inr || bid.amount || bid.amount_inr || ""));
      setPayment(null);
      Alert.alert("Purohit selected", "Continue to secure Cashfree checkout to confirm this proposal.");
      return data;
    } catch (error) {
      if (user?.demo) {
        setSelectedBid(bid);
        setPaymentAmount(String(bid.amount || bid.amount_inr || ""));
        return Alert.alert("Demo selection saved", "Cashfree checkout is disabled for demo accounts.");
      }
      Alert.alert("Could not select proposal", error?.response?.data?.detail || "Try again.");
    } finally { setSelecting(""); }
  };

  const submitPayment = async () => {
    const amount = Number(paymentAmount);
    if (!selectedBid) return Alert.alert("Choose a proposal first", "Select the purohit you want before making payment.");
    if (!amount || amount < 1) return Alert.alert("Invalid proposal", "The selected proposal does not have a payable amount.");
    setPaying(true);
    try {
      if (user?.demo) throw new Error("demo");
      const created = await createCashfreeOrder({
        request_id: request.id,
        proposal_id: selectedBid.id,
      });
      await openCashfreeCheckout(created.order);
      const result = await verifyCashfreeOrder({ payment_order_id: created.order.id });
      setPayment(result);
      if (result.order?.status === "paid") {
        Alert.alert("Payment confirmed", "Cashfree verified the payment. The amount is held until the ceremony is completed and released by an administrator.");
      } else {
        Alert.alert("Payment pending", "Cashfree has not confirmed this payment yet. Try verification again from your bookings.");
      }
    } catch (error) {
      if (user?.demo) {
        return Alert.alert("Demo checkout", "Sign in with a verified customer account to run a Cashfree sandbox payment.");
      }
      Alert.alert("Could not complete payment", error.message || "Please try again.");
    } finally { setPaying(false); }
  };

  return <>
  <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <View style={styles.header}><Text style={styles.kicker}>PROPOSALS</Text><Text style={styles.title}>{request.pooja_name || "Your ceremony request"}</Text><Text style={styles.sub}>{request.ceremony_date || "Date pending"} · {request.ceremony_time || "Time pending"}</Text></View>
    <View style={[styles.summary, desktop && styles.summaryDesktop]}>
      <View style={[styles.locationCard, desktop && styles.locationDesktop]}><View style={styles.mapWrap}><OpenStreetMap latitude={latitude} longitude={longitude} title={request.pooja_name} address={request.address} style={styles.map} /></View><View style={styles.addressRow}><MapPin size={16} color={colors.saffron} /><View style={{ flex: 1 }}><Text style={styles.addressTitle}>{request.address || "Service address"}</Text>{request.landmark ? <Text style={styles.addressMeta}>{request.landmark}</Text> : null}</View><Pressable accessibilityLabel="Open Mappls drawer" onPress={() => setMapOpen(true)} style={styles.mapButton}><Navigation size={15} color={colors.white} /></Pressable></View></View>
      <View style={[styles.statusCard, desktop && styles.statusDesktop]}><View style={styles.statusIcon}><Clock3 size={19} color={colors.saffron} /></View><Text style={styles.statusLabel}>REQUEST STATUS</Text><Text style={styles.statusTitle}>{loading ? "Finding available purohits" : `${bids.length} proposals received`}</Text><View style={styles.timeline}><TimelineStep label="Request sent" done /><TimelineStep label="Purohits reviewing" done={bids.length > 0} /><TimelineStep label="Choose an offer" done={false} last /></View></View>
    </View>

    <View style={styles.proposalHeader}><View><Text style={styles.sectionTitle}>Compare proposals</Text><Text style={styles.sectionSub}>Review price, message, and included services.</Text></View>{bestPrice ? <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>From ₹{bestPrice.toLocaleString("en-IN")}</Text></View> : null}</View>
    {loading ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Looking for verified offers...</Text><Text style={styles.empty}>We will update this page as purohits respond.</Text></View> : bids.length ? <View style={[styles.bidGrid, desktop && styles.bidGridDesktop]}>{bids.map((bid) => <View key={bid.id} style={[styles.bid, desktop && styles.bidDesktop, Number(bid.amount) === bestPrice && styles.bidBest]}><View style={styles.bidTop}><View style={styles.avatar}><Text style={styles.avatarText}>{bid.priest_name?.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><View style={styles.nameRow}><Text style={styles.name}>{bid.priest_name}</Text><BadgeCheck size={16} color={colors.saffron} /></View><Text style={styles.verified}>Identity and practice verified</Text></View></View><View style={styles.priceRow}><View><Text style={styles.price}>₹{Number(bid.amount).toLocaleString("en-IN")}</Text><Text style={styles.priceLabel}>total proposal</Text></View>{Number(bid.amount) === bestPrice ? <View style={styles.valueTag}><Text style={styles.valueTagText}>BEST VALUE</Text></View> : null}</View><View style={styles.note}><MessageSquareText size={16} color={colors.muted2} /><Text style={styles.noteText}>{bid.message || "No note added."}</Text></View><View style={styles.featureRow}>{bid.includes_samagri ? <><Check size={14} color={colors.success} /><Text style={styles.featureText}>Samagri included</Text></> : <><ShieldCheck size={14} color={colors.muted2} /><Text style={styles.featureText}>Discuss samagri directly</Text></>}</View><Button title={selecting === bid.id ? "Selecting..." : "Choose this purohit"} onPress={() => award(bid)} disabled={Boolean(selecting)} style={styles.choose} /></View>)}</View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Waiting for offers</Text><Text style={styles.empty}>Verified purohits will receive your request and can send a proposal shortly.</Text></View>}
    {selectedBid ? <View style={styles.paymentPanel}>
      <View style={styles.paymentTop}><View style={styles.paymentIcon}><ShieldCheck size={22} color={colors.saffron} /></View><View style={{ flex: 1 }}><Text style={styles.paymentTitle}>Secure Cashfree checkout</Text><Text style={styles.paymentSub}>{selectedBid.priest_name} is selected. Cashfree will verify the payment and the platform will hold provider earnings until fulfilment.</Text></View></View>
      <View style={styles.payeeBox}><Text style={styles.payeeLabel}>TOTAL DUE</Text><Text style={styles.payeeText}>₹{Number(paymentAmount).toLocaleString("en-IN")}</Text></View>
      <Button title={paying ? "Opening secure checkout..." : "Pay securely with Cashfree"} icon={WalletCards} onPress={submitPayment} disabled={paying} style={styles.submitPayment} />
      {payment?.booking?.invoice_no ? <View style={styles.invoiceBox}><Text style={styles.invoiceTitle}>Invoice generated: {payment.booking.invoice_no}</Text>{payment.booking.invoice_html ? <Pressable onPress={() => {
        const downloaded = downloadInvoice(payment.booking.invoice_html, payment.booking.invoice_no);
        if (!downloaded && Platform.OS !== "web") Alert.alert("Invoice ready", `Invoice ${payment.booking.invoice_no} is stored in the payment record.`);
      }} style={styles.downloadButton}><Download size={16} color={colors.white} /><Text style={styles.downloadText}>Download invoice</Text></Pressable> : null}<Text style={styles.aiNote}>Verified by Cashfree. Receipt token: {payment.order?.customer_receipt_token?.slice(0, 8)?.toUpperCase() || "available in your payment record"}.</Text></View> : null}
    </View> : null}
  </ScrollView>
  <MapplsDrawer visible={mapOpen} onClose={() => setMapOpen(false)} location={{ ...request, latitude, longitude, title: request.pooja_name }} />
  </>;
}

function TimelineStep({ label, done, last }) {
  return <View style={styles.timelineRow}><View style={styles.timelineMarkWrap}><View style={[styles.timelineMark, done && styles.timelineMarkDone]}>{done ? <Check size={10} color={colors.white} /> : null}</View>{!last ? <View style={[styles.timelineLine, done && styles.timelineLineDone]} /> : null}</View><Text style={[styles.timelineText, done && styles.timelineTextDone]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white }, content: { width: "100%", maxWidth: 1040, alignSelf: "center", padding: 20, paddingBottom: 48 },
  header: { paddingTop: 6, paddingBottom: 18, borderBottomWidth: 1, borderColor: colors.warmBorder }, kicker: { fontSize: 10, fontWeight: "700", color: colors.saffron, letterSpacing: .8 }, title: { fontSize: 29, lineHeight: 35, color: colors.ink, fontFamily: font.semibold, marginTop: 6 }, sub: { color: colors.muted2, fontSize: 12, lineHeight: 18, marginTop: 6 },
  summary: { gap: 14, marginTop: 16 }, summaryDesktop: { flexDirection: "row" }, locationCard: { borderWidth: 1, borderColor: colors.warmBorder, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.white }, locationDesktop: { flex: 1.45 }, mapWrap: { height: 176, overflow: "hidden" }, map: { minHeight: 176 }, addressRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 }, addressTitle: { color: colors.ink, fontSize: 13, fontWeight: "700", lineHeight: 18 }, addressMeta: { color: colors.muted2, fontSize: 10, lineHeight: 14, marginTop: 2 }, mapButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" },
  statusCard: { padding: 18, borderRadius: 12, backgroundColor: colors.muted }, statusDesktop: { flex: 1 }, statusIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }, statusLabel: { color: colors.muted2, fontSize: 9, fontWeight: "700", letterSpacing: .7, marginTop: 14 }, statusTitle: { color: colors.ink, fontSize: 17, fontWeight: "700", marginTop: 4 }, timeline: { marginTop: 16 }, timelineRow: { minHeight: 34, flexDirection: "row", gap: 9 }, timelineMarkWrap: { alignItems: "center" }, timelineMark: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }, timelineMarkDone: { backgroundColor: colors.success, borderColor: colors.success }, timelineLine: { width: 1, flex: 1, backgroundColor: colors.warmBorder }, timelineLineDone: { backgroundColor: colors.success }, timelineText: { color: colors.muted2, fontSize: 11, marginTop: 2 }, timelineTextDone: { color: colors.ink, fontWeight: "600" },
  proposalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginTop: 28, marginBottom: 12 }, sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "600" }, sectionSub: { color: colors.muted2, fontSize: 11, marginTop: 3 }, bestBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: "#F1F8F4" }, bestBadgeText: { color: colors.success, fontSize: 10, fontWeight: "700" },
  bidGrid: { gap: 12 }, bidGridDesktop: { flexDirection: "row", flexWrap: "wrap" }, bid: { padding: 17, borderRadius: 12, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white }, bidDesktop: { width: "49%" }, bidBest: { borderColor: "#C8D9CD" }, bidTop: { flexDirection: "row", alignItems: "center", gap: 11 }, avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.white, fontWeight: "700", fontSize: 17 }, nameRow: { flexDirection: "row", alignItems: "center", gap: 5 }, name: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "700" }, verified: { color: colors.muted2, fontSize: 10, marginTop: 3 }, priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 17, paddingTop: 15, borderTopWidth: 1, borderColor: colors.warmBorder }, price: { color: colors.ink, fontSize: 24, fontWeight: "700" }, priceLabel: { color: colors.muted2, fontSize: 9, marginTop: 2 }, valueTag: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: "#F1F8F4" }, valueTagText: { color: colors.success, fontSize: 8, fontWeight: "700", letterSpacing: .4 }, note: { flexDirection: "row", gap: 8, marginTop: 15, padding: 12, borderRadius: 10, backgroundColor: colors.muted }, noteText: { flex: 1, fontSize: 11, color: colors.muted2, lineHeight: 17 }, featureRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 12 }, featureText: { color: colors.muted2, fontSize: 10, fontWeight: "600" }, choose: { marginTop: 16 },
  emptyCard: { marginTop: 14, padding: 28, alignItems: "center", backgroundColor: colors.muted, borderRadius: 12 }, emptyTitle: { color: colors.ink, fontWeight: "700", fontSize: 15 }, empty: { color: colors.muted2, fontSize: 12, textAlign: "center", marginTop: 7, lineHeight: 18 },
  paymentPanel: { marginTop: 22, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white, shadowColor: "#000", shadowOpacity: .07, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  paymentTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  paymentIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#FFF1EB", alignItems: "center", justifyContent: "center" },
  paymentTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  paymentSub: { color: colors.muted2, fontSize: 11, lineHeight: 17, marginTop: 4 },
  payeeBox: { marginTop: 16, padding: 13, borderRadius: 13, backgroundColor: colors.muted },
  payeeLabel: { color: colors.muted2, fontSize: 9, fontWeight: "800", letterSpacing: .5 },
  payeeText: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 5 },
  inputLabel: { color: colors.ink, fontSize: 12, fontWeight: "800", marginTop: 15, marginBottom: 7 },
  amountInput: { minHeight: 50, borderRadius: 12, backgroundColor: colors.muted, color: colors.ink, fontSize: 15, paddingHorizontal: 14 },
  paymentActions: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  paymentAction: { flex: 1, minWidth: 180 },
  upload: { flex: 1, minWidth: 180, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.warmBorder, borderBottomWidth: 3, borderBottomColor: "#D8D5CF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  uploadPressed: { transform: [{ translateY: 2 }, { scale: .99 }], borderBottomWidth: 1 },
  uploadText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  submitPayment: { marginTop: 12 },
  invoiceBox: { marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: "#F1F8F4" },
  invoiceTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  downloadButton: { marginTop: 10, minHeight: 42, borderRadius: 12, backgroundColor: colors.brandBrown, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  downloadText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  aiNote: { color: colors.muted2, fontSize: 11, lineHeight: 16, marginTop: 10 },
});
