import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Lock,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react-native";
import { colors, radii, font, shadow } from "../../lib/theme";
import { Button } from "../../components/UI";
import MapplsMap from "../../components/MapplsMap";
import MapplsDrawer from "../../components/MapplsDrawer";
import { useAuth } from "../../lib/auth";
import {
  createCashfreeOrder,
  downloadInvoice,
  listRequestProposals,
  openCashfreeCheckout,
  selectProposal,
  verifyCashfreeOrder,
} from "../../lib/payments";
import { startInAppCall } from "../../lib/calls";

const DEMO_BIDS = [
  { id: "demo-bid-rama", priest_name: "Sri Ramachandra Sharma", amount: 2900, message: "I can conduct this ceremony with traditional samagri guidance.", includes_samagri: true },
  { id: "demo-bid-ramesh", priest_name: "Pandit Ramesh Shukla", amount: 3200, message: "Available at your requested time. Happy to discuss family traditions first.", includes_samagri: false },
];

export default function RequestProposals({ route, navigation }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
  const [requestData, setRequestData] = useState(params.request || null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState("");
  const [selectedBid, setSelectedBid] = useState(null);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payment, setPayment] = useState(null);
  const [paying, setPaying] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const desktop = width >= 850;

  // Paid state detection
  const isPaid = Boolean(
    payment?.order?.status === "paid" ||
    payment?.booking?.payment_status === "paid" ||
    requestData?.payment_status === "paid" ||
    params.request?.payment_status === "paid"
  );

  // Dynamic Navigation Title based on Paid vs Unpaid state
  useEffect(() => {
    navigation.setOptions({
      title: isPaid ? "Booking Confirmed" : "Compare proposals",
    });
  }, [isPaid, navigation]);

  const bestPrice = useMemo(() => bids.length ? Math.min(...bids.map((bid) => Number(bid.amount))) : 0, [bids]);

  useEffect(() => {
    if (!request.id) {
      setBids(DEMO_BIDS);
      setLoading(false);
      return;
    }
    listRequestProposals(request.id)
      .then((data) => {
        const proposalList = data?.proposals?.length ? data.proposals : (user?.demo ? DEMO_BIDS : []);
        setBids(proposalList);
        if (data?.request) {
          setRequestData(data.request);
        }
        if (data?.booking) {
          setPayment((prev) => prev || {
            order: {
              status: data.request?.payment_status === "paid" || data.booking?.payment_status === "paid" ? "paid" : "pending",
              amount_inr: data.booking.total_inr,
            },
            booking: data.booking,
          });
        }
        const awardedId = data?.request?.awarded_proposal_id || params.request?.awarded_proposal_id;
        const acceptedBid = proposalList.find((b) => b.id === awardedId || b.status === "accepted");
        if (acceptedBid) {
          setSelectedBid(acceptedBid);
          setPaymentAmount(String(acceptedBid.amount || acceptedBid.amount_inr || ""));
        }
      })
      .catch(() => setBids(user?.demo ? DEMO_BIDS : []))
      .finally(() => setLoading(false));
  }, [request.id, user?.demo]);

  const awardedId = requestData?.awarded_proposal_id || params.request?.awarded_proposal_id;
  const activeConfirmedBid = selectedBid || bids.find((b) => b.id === awardedId || b.status === "accepted") || bids[0];

  useEffect(() => {
    if (isPaid && !selectedBid && activeConfirmedBid) {
      setSelectedBid(activeConfirmedBid);
      setPaymentAmount(String(activeConfirmedBid.amount || activeConfirmedBid.amount_inr || ""));
    }
  }, [isPaid, selectedBid, activeConfirmedBid]);

  const currentInvoiceNo = payment?.booking?.invoice_no || requestData?.invoice_number || params.request?.invoice_number || null;
  const currentInvoiceHtml = payment?.booking?.invoice_html || null;
  const currentBookingId = payment?.booking?.id || requestData?.booking_id || params.request?.booking_id || request.id;

  const currentBookingObject = useMemo(() => {
    return payment?.booking || {
      id: currentBookingId,
      priest_name: activeConfirmedBid?.priest_name || "Verified Purohit",
      pooja_name: request.pooja_name || "Ceremony",
      booking_date: request.ceremony_date,
      booking_time: request.ceremony_time,
      address: request.address,
    };
  }, [payment, currentBookingId, activeConfirmedBid, request]);

  const award = async (bid) => {
    setSelecting(bid.id);
    try {
      const data = await selectProposal(request.id, bid.id);
      const accepted = data?.proposal || bid;
      setSelectedBid(accepted);
      setPaymentAmount(String(data?.amount_inr || bid.amount || bid.amount_inr || ""));
      setPayment(null);
      setCheckoutVisible(true);
      return data;
    } catch (error) {
      if (user?.demo) {
        setSelectedBid(bid);
        setPaymentAmount(String(bid.amount || bid.amount_inr || ""));
        setCheckoutVisible(true);
        return;
      }
      Alert.alert("Could not select proposal", error?.response?.data?.detail || "Try again.");
    } finally { setSelecting(""); }
  };

  const submitPayment = async () => {
    const amount = Number(paymentAmount);
    if (!selectedBid) return Alert.alert("Choose a proposal first", "Select the purohit you want before making payment.");
    if (!amount || amount < 1) return Alert.alert("Invalid proposal", "The selected proposal does not have a payable amount.");
    if (!user?.phone) {
      return Alert.alert(
        "Phone number required",
        "Add a verified mobile number to your profile before completing Cashfree payment.",
        [
          { text: "Go to Profile", onPress: () => { setCheckoutVisible(false); navigation.navigate("Tabs", { screen: "Profile" }); } },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
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
      if (result.order?.status === "paid" || result.booking?.payment_status === "paid") {
        setRequestData((prev) => ({ ...(prev || {}), payment_status: "paid", status: "awarded", awarded_proposal_id: selectedBid.id }));
        setCheckoutVisible(false);
        Alert.alert("Payment confirmed 🎉", "Cashfree verified the payment! The amount is held securely in escrow until ceremony completion.");
      } else {
        Alert.alert("Payment pending", "Cashfree has not confirmed this payment yet. Try verification again from your bookings.");
      }
    } catch (error) {
      if (user?.demo) {
        return Alert.alert("Demo checkout", "Sign in with a verified customer account to run a live Cashfree sandbox payment.");
      }
      Alert.alert("Could not complete payment", error.message || "Please try again.");
    } finally { setPaying(false); }
  };

  /* =======================================================================
     PAID & CONFIRMED VIEW (Clean, elegant, non-cluttered booking summary)
     ======================================================================= */
  if (isPaid) {
    const paidPriest = activeConfirmedBid;
    const paidTotal = Number(paymentAmount || paidPriest?.amount || paidPriest?.amount_inr || 0);

    return (
      <>
        <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: 40 }]}>
          {/* Header Banner */}
          <View style={styles.confirmedHero}>
            <View style={styles.heroCheckCircle}>
              <CheckCircle2 size={32} color={colors.success} strokeWidth={2.5} />
            </View>
            <Text style={styles.heroTitle}>Ceremony Booked & Secured</Text>
            <Text style={styles.heroCeremony}>{request.pooja_name || "Vedic Ceremony"}</Text>
            <Text style={styles.heroMeta}>
              {request.ceremony_date || "Date scheduled"} · {request.ceremony_time || "Time scheduled"}
            </Text>

            {/* Escrow Guarantee Pill */}
            <View style={styles.heroEscrowPill}>
              <ShieldCheck size={16} color={colors.success} />
              <Text style={styles.heroEscrowText}>
                100% Escrow Protection: ₹{paidTotal.toLocaleString("en-IN")} held safely with Cashfree
              </Text>
            </View>
          </View>

          {/* Assigned Purohit Card */}
          <View style={[styles.sectionCard, { marginTop: 18 }]}>
            <Text style={styles.cardHeaderKicker}>ASSIGNED PUROHIT</Text>
            <View style={styles.priestProfileRow}>
              <View style={styles.priestLargeAvatar}>
                <Text style={styles.priestLargeAvatarText}>
                  {paidPriest?.priest_name?.slice(0, 1) || "P"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.priestProfileName}>{paidPriest?.priest_name || "Verified Purohit"}</Text>
                  <BadgeCheck size={18} color={colors.saffron} />
                </View>
                <Text style={styles.priestProfileRating}>Identity & Practice Verified · 4.9 ★</Text>
              </View>
            </View>

            {paidPriest?.message ? (
              <View style={styles.quoteBox}>
                <MessageSquareText size={15} color={colors.muted2} style={{ marginTop: 2 }} />
                <Text style={styles.quoteText}>{paidPriest.message}</Text>
              </View>
            ) : null}

            {/* Communication Action Row */}
            <View style={styles.contactActionsRow}>
              <Pressable
                onPress={() => navigation.navigate("Conversation", { bookingId: currentBookingId, booking: currentBookingObject })}
                style={styles.messageContactBtn}
              >
                <MessageSquareText size={16} color={colors.white} />
                <Text style={styles.messageContactText}>Message Purohit</Text>
              </Pressable>

              <Pressable
                onPress={() => startInAppCall(navigation, { bookingId: currentBookingId, booking: currentBookingObject })}
                style={styles.callContactBtn}
              >
                <Phone size={16} color={colors.ink} />
                <Text style={styles.callContactText}>Call</Text>
              </Pressable>
            </View>
          </View>

          {/* Location & Map Card */}
          <View style={[styles.sectionCard, { marginTop: 14 }]}>
            <Text style={styles.cardHeaderKicker}>SERVICE LOCATION</Text>
            <View style={styles.mapWrap}>
              <MapplsMap latitude={latitude} longitude={longitude} title={request.pooja_name} address={request.address} style={styles.map} />
            </View>
            <View style={styles.addressRow}>
              <MapPin size={17} color={colors.saffron} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addressTitle}>{request.address || "Ceremony address"}</Text>
                {request.landmark ? <Text style={styles.addressMeta}>{request.landmark}</Text> : null}
              </View>
              <Pressable accessibilityLabel="Open Mappls drawer" onPress={() => setMapOpen(true)} style={styles.mapButton}>
                <Navigation size={15} color={colors.white} />
              </Pressable>
            </View>
          </View>

          {/* Payment & Invoice Breakdown */}
          <View style={[styles.sectionCard, { marginTop: 14 }]}>
            <Text style={styles.cardHeaderKicker}>PAYMENT SUMMARY</Text>
            <View style={styles.breakdownList}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Purohit Dakshina & Pooja</Text>
                <Text style={styles.breakdownValue}>₹{paidTotal.toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Samagri Provision</Text>
                <Text style={[styles.breakdownValue, { color: paidPriest?.includes_samagri ? colors.success : colors.muted2 }]}>
                  {paidPriest?.includes_samagri ? "Included" : "Direct Coordination"}
                </Text>
              </View>
              <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
                <Text style={styles.breakdownTotalLabel}>Total Paid (Held in Escrow)</Text>
                <Text style={styles.breakdownTotalValue}>₹{paidTotal.toLocaleString("en-IN")}</Text>
              </View>
            </View>

            {currentInvoiceNo ? (
              <View style={styles.invoiceRowContainer}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceLabel}>TAX INVOICE</Text>
                  <Text style={styles.invoiceValue}>{currentInvoiceNo}</Text>
                </View>
                {currentInvoiceHtml ? (
                  <Pressable
                    onPress={() => {
                      const downloaded = downloadInvoice(currentInvoiceHtml, currentInvoiceNo);
                      if (!downloaded && Platform.OS !== "web") Alert.alert("Invoice ready", `Invoice ${currentInvoiceNo} saved.`);
                    }}
                    style={styles.invoiceDownloadBtn}
                  >
                    <Download size={14} color={colors.white} />
                    <Text style={styles.invoiceDownloadText}>Download</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Primary View Bookings Action */}
          <View style={{ marginTop: 24, gap: 10 }}>
            <Button
              title="View in My Bookings"
              onPress={() => navigation.navigate("Tabs", { screen: "Bookings" })}
              variant="primary"
            />
          </View>
        </ScrollView>

        <MapplsDrawer visible={mapOpen} onClose={() => setMapOpen(false)} location={{ ...request, latitude, longitude, title: request.pooja_name }} />
      </>
    );
  }

  /* =======================================================================
     UNPAID / PROPOSAL COMPARISON VIEW
     ======================================================================= */
  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, selectedBid && { paddingBottom: 110 }]}>
        <View style={styles.header}>
          <Text style={styles.kicker}>PROPOSALS</Text>
          <Text style={styles.title}>{request.pooja_name || "Your ceremony request"}</Text>
          <Text style={styles.sub}>{request.ceremony_date || "Date pending"} · {request.ceremony_time || "Time pending"}</Text>
        </View>

        <View style={[styles.summary, desktop && styles.summaryDesktop]}>
          <View style={[styles.locationCard, desktop && styles.locationDesktop]}>
            <View style={styles.mapWrap}>
              <MapplsMap latitude={latitude} longitude={longitude} title={request.pooja_name} address={request.address} style={styles.map} />
            </View>
            <View style={styles.addressRow}>
              <MapPin size={16} color={colors.saffron} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addressTitle}>{request.address || "Service address"}</Text>
                {request.landmark ? <Text style={styles.addressMeta}>{request.landmark}</Text> : null}
              </View>
              <Pressable accessibilityLabel="Open Mappls drawer" onPress={() => setMapOpen(true)} style={styles.mapButton}>
                <Navigation size={15} color={colors.white} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.statusCard, desktop && styles.statusDesktop]}>
            <View style={styles.statusIcon}><Clock3 size={19} color={colors.saffron} /></View>
            <Text style={styles.statusLabel}>REQUEST STATUS</Text>
            <Text style={styles.statusTitle}>
              {loading ? "Finding available purohits" : `${bids.length} proposal${bids.length === 1 ? "" : "s"} received`}
            </Text>
            <View style={styles.timeline}>
              <TimelineStep label="Request sent" done />
              <TimelineStep label="Purohits reviewing" done={bids.length > 0} />
              <TimelineStep label={selectedBid ? "Purohit selected" : "Choose an offer"} done={Boolean(selectedBid)} last />
            </View>
          </View>
        </View>

        <View style={styles.proposalHeader}>
          <View>
            <Text style={styles.sectionTitle}>Compare proposals</Text>
            <Text style={styles.sectionSub}>Select the best purohit for your ceremony.</Text>
          </View>
          {bestPrice ? (
            <View style={styles.bestBadge}>
              <Text style={styles.bestBadgeText}>From ₹{bestPrice.toLocaleString("en-IN")}</Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Looking for verified offers...</Text>
            <Text style={styles.empty}>We will update this page as purohits respond.</Text>
          </View>
        ) : bids.length ? (
          <View style={[styles.bidGrid, desktop && styles.bidGridDesktop]}>
            {bids.map((bid) => {
              const isSelected = selectedBid?.id === bid.id;
              const isBest = Number(bid.amount) === bestPrice;
              return (
                <View
                  key={bid.id}
                  style={[
                    styles.bid,
                    desktop && styles.bidDesktop,
                    isSelected ? styles.bidSelected : (isBest && styles.bidBest),
                  ]}
                >
                  <View style={styles.bidTop}>
                    <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                      <Text style={styles.avatarText}>{bid.priest_name?.slice(0, 1) || "P"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name}>{bid.priest_name}</Text>
                        <BadgeCheck size={16} color={colors.saffron} />
                      </View>
                      <Text style={styles.verified}>Identity and practice verified</Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.selectedBadge}>
                        <CheckCircle2 size={14} color={colors.brandBrown} />
                        <Text style={styles.selectedBadgeText}>Selected</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.priceRow}>
                    <View>
                      <Text style={styles.price}>₹{Number(bid.amount).toLocaleString("en-IN")}</Text>
                      <Text style={styles.priceLabel}>total proposal</Text>
                    </View>
                    {isBest ? (
                      <View style={styles.valueTag}>
                        <Sparkles size={11} color={colors.success} />
                        <Text style={styles.valueTagText}>BEST VALUE</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.note}>
                    <MessageSquareText size={15} color={colors.muted2} />
                    <Text style={styles.noteText}>{bid.message || "I am available and would be happy to conduct this ceremony."}</Text>
                  </View>

                  <View style={styles.featureRow}>
                    {bid.includes_samagri ? (
                      <>
                        <Check size={14} color={colors.success} />
                        <Text style={styles.featureText}>Samagri included</Text>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={14} color={colors.muted2} />
                        <Text style={styles.featureText}>Discuss samagri directly</Text>
                      </>
                    )}
                  </View>

                  <Button
                    title={selecting === bid.id ? "Selecting..." : (isSelected ? "Selected ✓" : "Choose this purohit")}
                    onPress={() => award(bid)}
                    disabled={Boolean(selecting)}
                    variant={isSelected ? "secondary" : "primary"}
                    style={styles.choose}
                  />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Waiting for offers</Text>
            <Text style={styles.empty}>Verified purohits will receive your request and can send a proposal shortly.</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Quick Action Bar when a Purohit is Selected */}
      {selectedBid && !checkoutVisible ? (
        <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.stickyLeft}>
            <Text style={styles.stickyPurohit}>{selectedBid.priest_name}</Text>
            <Text style={styles.stickyPrice}>₹{Number(paymentAmount || selectedBid.amount).toLocaleString("en-IN")}</Text>
          </View>
          <Pressable onPress={() => setCheckoutVisible(true)} style={styles.stickyButton}>
            <WalletCards size={16} color={colors.white} />
            <Text style={styles.stickyButtonText}>Review & Pay</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Modern Bottom Sheet Checkout Modal */}
      <Modal visible={checkoutVisible} transparent animationType="slide" onRequestClose={() => setCheckoutVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => !paying && setCheckoutVisible(false)} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalKicker}>CONFIRM PUROHIT</Text>
                <Text style={styles.modalTitle}>{request.pooja_name || "Ceremony Confirmation"}</Text>
              </View>
              <Pressable onPress={() => !paying && setCheckoutVisible(false)} style={styles.closeButton}>
                <X size={20} color={colors.ink} />
              </Pressable>
            </View>

            <View style={styles.priestSummaryCard}>
              <View style={styles.priestAvatar}>
                <Text style={styles.priestAvatarText}>{selectedBid?.priest_name?.slice(0, 1) || "P"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text style={styles.priestName}>{selectedBid?.priest_name}</Text>
                  <BadgeCheck size={16} color={colors.saffron} />
                </View>
                <Text style={styles.priestSub}>
                  {request.ceremony_date} · {request.ceremony_time}
                </Text>
              </View>
            </View>

            <View style={styles.costBreakdown}>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Purohit Dakshina & Pooja</Text>
                <Text style={styles.costValue}>₹{Number(paymentAmount || selectedBid?.amount || 0).toLocaleString("en-IN")}</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Samagri Provision</Text>
                <Text style={[styles.costValue, { color: selectedBid?.includes_samagri ? colors.success : colors.muted2 }]}>
                  {selectedBid?.includes_samagri ? "Included" : "Direct Coordination"}
                </Text>
              </View>
              <View style={[styles.costRow, styles.costTotalRow]}>
                <Text style={styles.costTotalLabel}>Total Payable</Text>
                <Text style={styles.costTotalValue}>₹{Number(paymentAmount || selectedBid?.amount || 0).toLocaleString("en-IN")}</Text>
              </View>
            </View>

            <View style={styles.escrowNotice}>
              <Lock size={15} color={colors.saffron} />
              <Text style={styles.escrowText}>
                <Text style={{ fontWeight: "700" }}>100% Escrow Protection: </Text>
                Your payment is held securely by Cashfree until the ceremony is satisfactorily completed.
              </Text>
            </View>

            <Button
              title={paying ? "Connecting to Cashfree..." : `Pay ₹${Number(paymentAmount || selectedBid?.amount || 0).toLocaleString("en-IN")} via Cashfree`}
              icon={WalletCards}
              onPress={submitPayment}
              disabled={paying}
              style={styles.modalPayBtn}
            />

            {payment?.booking?.invoice_no ? (
              <View style={styles.invoiceBox}>
                <Text style={styles.invoiceTitle}>Invoice: {payment.booking.invoice_no}</Text>
                {payment.booking.invoice_html ? (
                  <Pressable
                    onPress={() => {
                      const downloaded = downloadInvoice(payment.booking.invoice_html, payment.booking.invoice_no);
                      if (!downloaded && Platform.OS !== "web") Alert.alert("Invoice ready", `Invoice ${payment.booking.invoice_no} saved.`);
                    }}
                    style={styles.downloadButton}
                  >
                    <Download size={15} color={colors.white} />
                    <Text style={styles.downloadText}>Download Invoice</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <MapplsDrawer visible={mapOpen} onClose={() => setMapOpen(false)} location={{ ...request, latitude, longitude, title: request.pooja_name }} />
    </>
  );
}

function TimelineStep({ label, done, last }) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineMarkWrap}>
        <View style={[styles.timelineMark, done && styles.timelineMarkDone]}>
          {done ? <Check size={10} color={colors.white} /> : null}
        </View>
        {!last ? <View style={[styles.timelineLine, done && styles.timelineLineDone]} /> : null}
      </View>
      <Text style={[styles.timelineText, done && styles.timelineTextDone]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  content: { width: "100%", maxWidth: 1040, alignSelf: "center", padding: 20, paddingBottom: 48 },
  header: { paddingTop: 6, paddingBottom: 18, borderBottomWidth: 1, borderColor: colors.warmBorder },
  kicker: { fontSize: 10, fontWeight: "700", color: colors.saffron, letterSpacing: 0.8 },
  title: { fontSize: 26, lineHeight: 32, color: colors.ink, fontFamily: font.semibold, marginTop: 6 },
  sub: { color: colors.muted2, fontSize: 12, lineHeight: 18, marginTop: 4 },

  /* Confirmed Booking Hero */
  confirmedHero: {
    backgroundColor: "#FAFDFC",
    borderWidth: 1.5,
    borderColor: "#D4E5D9",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    textAlign: "center",
  },
  heroCheckCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EBF7EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    fontFamily: font.semibold,
  },
  heroCeremony: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.brandBrown,
    marginTop: 4,
  },
  heroMeta: {
    fontSize: 12,
    color: colors.muted2,
    marginTop: 4,
  },
  heroEscrowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#E6F4EA",
  },
  heroEscrowText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "700",
  },

  /* Card Containers */
  sectionCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.warmBorder,
    backgroundColor: colors.white,
    ...shadow.card,
  },
  cardHeaderKicker: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted2,
    letterSpacing: 0.8,
    marginBottom: 14,
  },

  /* Priest Profile in Confirmed Card */
  priestProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  priestLargeAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.brandBrown,
    alignItems: "center",
    justifyContent: "center",
  },
  priestLargeAvatarText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 19,
  },
  priestProfileName: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.ink,
  },
  priestProfileRating: {
    fontSize: 11,
    color: colors.muted2,
    marginTop: 3,
  },
  quoteBox: {
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.muted,
  },
  quoteText: {
    flex: 1,
    fontSize: 12,
    color: colors.ink,
    lineHeight: 18,
  },
  contactActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  messageContactBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.brandBrown,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  messageContactText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  callContactBtn: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.warmBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  callContactText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },

  /* Breakdown List */
  breakdownList: {
    gap: 10,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownLabel: {
    fontSize: 12,
    color: colors.muted2,
    fontWeight: "500",
  },
  breakdownValue: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: "700",
  },
  breakdownTotalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.warmBorder,
    marginTop: 4,
  },
  breakdownTotalLabel: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: "800",
  },
  breakdownTotalValue: {
    fontSize: 17,
    color: colors.success,
    fontWeight: "800",
  },
  invoiceRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.warmBorder,
  },
  invoiceLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.muted2,
    letterSpacing: 0.6,
  },
  invoiceValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 2,
  },
  invoiceDownloadBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.brandBrown,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  invoiceDownloadText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },

  /* Comparison Summary */
  summary: { gap: 14, marginTop: 16 },
  summaryDesktop: { flexDirection: "row" },
  locationCard: { borderWidth: 1, borderColor: colors.warmBorder, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.white },
  locationDesktop: { flex: 1.45 },
  mapWrap: { height: 176, overflow: "hidden" },
  map: { minHeight: 176 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 },
  addressTitle: { color: colors.ink, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  addressMeta: { color: colors.muted2, fontSize: 10, lineHeight: 14, marginTop: 2 },
  mapButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" },
  statusCard: { padding: 18, borderRadius: 12, backgroundColor: colors.muted },
  statusDesktop: { flex: 1 },
  statusIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  statusLabel: { color: colors.muted2, fontSize: 9, fontWeight: "700", letterSpacing: 0.7, marginTop: 14 },
  statusTitle: { color: colors.ink, fontSize: 17, fontWeight: "700", marginTop: 4 },
  timeline: { marginTop: 16 },
  timelineRow: { minHeight: 34, flexDirection: "row", gap: 9 },
  timelineMarkWrap: { alignItems: "center" },
  timelineMark: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  timelineMarkDone: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  timelineLine: { width: 1, flex: 1, backgroundColor: colors.warmBorder },
  timelineLineDone: { backgroundColor: colors.brandBrown },
  timelineText: { color: colors.muted2, fontSize: 11, marginTop: 2 },
  timelineTextDone: { color: colors.ink, fontWeight: "600" },
  proposalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginTop: 28, marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "600" },
  sectionSub: { color: colors.muted2, fontSize: 11, marginTop: 3 },
  bestBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: "#F1F8F4" },
  bestBadgeText: { color: colors.success, fontSize: 10, fontWeight: "700" },
  bidGrid: { gap: 14 },
  bidGridDesktop: { flexDirection: "row", flexWrap: "wrap" },
  bid: { padding: 18, borderRadius: 16, borderWidth: 1.5, borderColor: colors.warmBorder, backgroundColor: colors.white },
  bidDesktop: { width: "49%" },
  bidBest: { borderColor: "#D4E5D9" },
  bidSelected: { borderColor: colors.brandBrown, backgroundColor: "#FCFAF8" },
  bidTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" },
  avatarSelected: { backgroundColor: colors.brandBrown },
  avatarText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "700" },
  verified: { color: colors.muted2, fontSize: 10, marginTop: 2 },
  selectedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#F5EFEB" },
  selectedBadgeText: { color: colors.brandBrown, fontSize: 10, fontWeight: "700" },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 15, paddingTop: 13, borderTopWidth: 1, borderColor: colors.warmBorder },
  price: { color: colors.ink, fontSize: 22, fontWeight: "700" },
  priceLabel: { color: colors.muted2, fontSize: 9, marginTop: 2 },
  valueTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#EBF7EE" },
  valueTagText: { color: colors.success, fontSize: 9, fontWeight: "700" },
  note: { flexDirection: "row", gap: 8, marginTop: 13, padding: 12, borderRadius: 10, backgroundColor: colors.muted },
  noteText: { flex: 1, fontSize: 11, color: colors.muted2, lineHeight: 16 },
  featureRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 12 },
  featureText: { color: colors.muted2, fontSize: 11, fontWeight: "600" },
  choose: { marginTop: 15 },
  emptyCard: { marginTop: 14, padding: 28, alignItems: "center", backgroundColor: colors.muted, borderRadius: 12 },
  emptyTitle: { color: colors.ink, fontWeight: "700", fontSize: 15 },
  empty: { color: colors.muted2, fontSize: 12, textAlign: "center", marginTop: 7, lineHeight: 18 },

  /* Sticky Bottom Floating Bar */
  stickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderColor: colors.warmBorder,
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  stickyLeft: { flex: 1 },
  stickyPurohit: { fontSize: 12, color: colors.muted2, fontWeight: "600" },
  stickyPrice: { fontSize: 20, fontWeight: "800", color: colors.ink, marginTop: 2 },
  stickyButton: {
    backgroundColor: colors.brandBrown,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stickyButtonText: { color: colors.white, fontWeight: "700", fontSize: 14 },

  /* Checkout Bottom Sheet Modal */
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "90%",
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#DDD", alignSelf: "center", marginBottom: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, borderBottomWidth: 1, borderColor: colors.warmBorder },
  modalKicker: { fontSize: 9, fontWeight: "800", color: colors.saffron, letterSpacing: 0.8 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: 3 },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
  priestSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FBF9F7",
    borderWidth: 1,
    borderColor: colors.warmBorder,
    marginTop: 16,
  },
  priestAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" },
  priestAvatarText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  priestName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  priestSub: { fontSize: 11, color: colors.muted2, marginTop: 3 },
  costBreakdown: { marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: colors.muted, gap: 10 },
  costRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  costLabel: { fontSize: 12, color: colors.muted2, fontWeight: "500" },
  costValue: { fontSize: 12, color: colors.ink, fontWeight: "700" },
  costTotalRow: { paddingTop: 10, borderTopWidth: 1, borderColor: colors.warmBorder, marginTop: 4 },
  costTotalLabel: { fontSize: 14, color: colors.ink, fontWeight: "800" },
  costTotalValue: { fontSize: 18, color: colors.brandBrown, fontWeight: "800" },
  escrowNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF9F4",
    borderWidth: 1,
    borderColor: "#FBE6D3",
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  escrowText: { flex: 1, fontSize: 11, color: "#8A4D12", lineHeight: 16 },
  modalPayBtn: { marginTop: 18 },
  invoiceBox: { marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: "#F1F8F4" },
  invoiceTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  downloadButton: { marginTop: 10, minHeight: 40, borderRadius: 10, backgroundColor: colors.brandBrown, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  downloadText: { color: colors.white, fontSize: 12, fontWeight: "800" },
});
