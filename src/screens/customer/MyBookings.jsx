import React, { useEffect, useState, useCallback } from "react";
import { bindBrandStyles } from "../../lib/brandStyles";
import { View, Text, FlatList, RefreshControl, Modal, Pressable, TextInput, ScrollView, Alert, Image } from "react-native";
import { CalendarDays, ChevronRight, LocateFixed, MapPin, MessageSquareText, Phone, Sparkles, ArrowRight, Plus } from "lucide-react-native";
import { colors, radii, spacing, font } from "../../lib/theme";
import { Button, Field } from "../../components/UI";
import { EmptyState, StatusBadge } from "../../components/ProductUI";
import api from "../../lib/api";
import { downloadInvoice, listBookings, listCustomerRequests, listPaymentReports } from "../../lib/payments";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { startInAppCall } from "../../lib/calls";

const TIME_SLOTS = ["06:00", "07:30", "09:00", "10:30", "16:00", "17:30", "19:00"];
const DISPUTE_CATEGORIES = [
  { id: "no_show", en: "Priest did not arrive", kn: "ಪುರೋಹಿತರು ಬರಲಿಲ್ಲ" },
  { id: "late_arrival", en: "Late arrival", kn: "ತಡವಾಗಿ ಬಂದರು" },
  { id: "incomplete_pooja", en: "Incomplete pooja", kn: "ಅಪೂರ್ಣ ಪೂಜೆ" },
  { id: "payment_issue", en: "Payment issue", kn: "ಪಾವತಿ ಸಮಸ್ಯೆ" },
  { id: "other", en: "Other", kn: "ಇನ್ನಿತರ" },
];

const futureDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const getDemoCustomerBooking = () => ({ id: "demo-confirmed", demo: true, status: "confirmed", payment_status: "paid", pooja_name: "Satyanarayan Pooja", priest_name: "Demo Purohit", priest_phone: "9876543210", booking_date: futureDate(2), booking_time: "07:30", address: "Jayanagar, Bengaluru", total_amount: 3100, customer_name: "Demo Customer", customer_phone: "9000000001" });
const getDemoCustomerRequests = () => [
  { id: "demo-req-1", pooja_name: "Griha Pravesh Puja", ceremony_date: futureDate(3), ceremony_time: "09:00", address: "Indiranagar, Bengaluru", proposal_count: 2, status: "open", budget_min_inr: 3500, budget_max_inr: 6500 },
];

function upcomingDates(days = 14) {
  const out = [];
  for (let i = 1; i <= days; i++) { const d = new Date(); d.setDate(d.getDate() + i); out.push(d); }
  return out;
}

export default function MyBookings({ navigation }) {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("bookings"); // "bookings" | "proposals"
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelPolicy, setCancelPolicy] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [reschedulePolicy, setReschedulePolicy] = useState(null);
  const [newDate, setNewDate] = useState(null);
  const [newTime, setNewTime] = useState("");
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [disputeCat, setDisputeCat] = useState("no_show");
  const [disputeDesc, setDisputeDesc] = useState("");
  const [reviewTarget, setReviewTarget] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    if (user?.demo) {
      setItems([getDemoCustomerBooking()]);
      setRequests(getDemoCustomerRequests());
      return;
    }
    try {
      const [{ bookings }, { reports }, reqData] = await Promise.all([
        listBookings().catch(() => ({ bookings: [] })),
        listPaymentReports().catch(() => ({ reports: [] })),
        listCustomerRequests().catch(() => ({ requests: [] })),
      ]);
      const reportsByBooking = Object.fromEntries((reports || []).map((report) => [report.booking_id, report]));
      setItems((bookings || []).map((booking) => ({ ...booking, payment_report: reportsByBooking[booking.id] })));
      setRequests(reqData?.requests || []);
    } catch (_) {
      setItems([]);
      setRequests([]);
    }
  }, [user?.demo]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openCancel = async (b) => {
    setCancelTarget(b); setCancelReason("");
    try { const { data } = await api.get(`/bookings/${b.id}/policy-preview`); setCancelPolicy(data); } catch (_) { setCancelPolicy(null); }
  };
  const confirmCancel = async () => {
    try {
      await api.post(`/bookings/${cancelTarget.id}/action`, { action: "cancel", reason: cancelReason });
      setCancelTarget(null); setCancelPolicy(null); load();
    } catch (e) { Alert.alert("Failed", e?.response?.data?.detail || "Cancel failed"); }
  };
  const openReschedule = async (b) => {
    setRescheduleTarget(b); setNewDate(null); setNewTime("");
    try { const { data } = await api.get(`/bookings/${b.id}/policy-preview`); setReschedulePolicy(data); } catch (_) { setReschedulePolicy(null); }
  };
  const confirmReschedule = async () => {
    if (!newDate || !newTime) return Alert.alert("Missing", "Pick a new date and time");
    try {
      await api.post(`/bookings/${rescheduleTarget.id}/reschedule`, { booking_date: newDate, booking_time: newTime });
      setRescheduleTarget(null); setReschedulePolicy(null); load();
    } catch (e) { Alert.alert("Failed", e?.response?.data?.detail || "Reschedule failed"); }
  };
  const submitDispute = async () => {
    if (!disputeDesc.trim()) return Alert.alert("Please describe the issue");
    try {
      await api.post("/disputes", { booking_id: disputeTarget.id, category: disputeCat, description: disputeDesc });
      Alert.alert("Dispute raised", "Our team will review shortly.");
      setDisputeTarget(null); setDisputeCat("no_show"); setDisputeDesc("");
    } catch (e) { Alert.alert("Failed", e?.response?.data?.detail || "Failed"); }
  };
  const submitReview = async () => {
    try {
      await api.post("/reviews", { booking_id: reviewTarget.id, rating, comment });
      setReviewTarget(null); setComment(""); setRating(5); load();
    } catch (e) { Alert.alert("Failed", e?.response?.data?.detail || "Failed"); }
  };
  const openInvoice = async (b) => {
    const report = b.payment_report;
    if (!report?.invoice_html) return Alert.alert("Invoice pending", "The invoice will appear after Cashfree confirms the payment.");
    try { await downloadInvoice(report.invoice_html, report.invoice_number); }
    catch (error) { Alert.alert("Invoice unavailable", error?.message || "Please try again."); }
  };

  const openProposalComparison = (req) => {
    navigation.navigate("RequestProposals", {
      requestId: req.id,
      poojaName: req.pooja_name,
      ceremonyDate: req.ceremony_date,
      ceremonyTime: req.ceremony_time,
      address: req.address,
      landmark: req.landmark,
      lat: req.latitude,
      lng: req.longitude,
      request: req,
    });
  };

  return (
    <>
      <FlatList
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.saffron} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerKicker}>CEREMONIES & PROPOSALS</Text>
              <Text style={styles.h1}>{t.tabBookings}</Text>
              <Text style={styles.sub}>Track confirmed priest bookings or review incoming purohit proposals.</Text>
            </View>

            {/* Segmented Switcher */}
            <View style={styles.segmentWrap}>
              <Pressable
                onPress={() => setActiveTab("bookings")}
                style={[styles.segmentBtn, activeTab === "bookings" && styles.segmentBtnActive]}
              >
                <CalendarDays size={15} color={activeTab === "bookings" ? colors.white : colors.ink} />
                <Text style={[styles.segmentText, activeTab === "bookings" && styles.segmentTextActive]}>
                  Bookings ({items.length})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab("proposals")}
                style={[styles.segmentBtn, activeTab === "proposals" && styles.segmentBtnActive]}
              >
                <Sparkles size={15} color={activeTab === "proposals" ? colors.white : colors.saffron} />
                <Text style={[styles.segmentText, activeTab === "proposals" && styles.segmentTextActive]}>
                  Proposals ({requests.length})
                </Text>
              </Pressable>
            </View>

            {activeTab === "proposals" && (
              <Pressable
                onPress={() => navigation.navigate("RequestPooja")}
                style={styles.newRequestBtn}
              >
                <Plus size={16} color={colors.saffron} />
                <Text style={styles.newRequestText}>Request proposals for a new ceremony</Text>
              </Pressable>
            )}
          </View>
        }
        data={activeTab === "bookings" ? items : requests}
        keyExtractor={(b) => b.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          activeTab === "bookings" ? (
            <EmptyState
              icon={CalendarDays}
              title="No direct bookings yet"
              body="Your scheduled ceremonies with confirmed purohits will appear here."
            />
          ) : (
            <View style={styles.emptyProposals}>
              <Sparkles size={32} color={colors.saffron} />
              <Text style={styles.emptyProposalsTitle}>No ceremony requests yet</Text>
              <Text style={styles.emptyProposalsBody}>
                Invite verified purohits to quote on your pooja. You can compare their prices, samagri inclusions, and reviews.
              </Text>
              <Pressable
                onPress={() => navigation.navigate("RequestPooja")}
                style={styles.emptyActionBtn}
              >
                <Text style={styles.emptyActionText}>Start a Ceremony Request</Text>
                <ArrowRight size={16} color={colors.white} />
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => {
          if (activeTab === "proposals") {
            const req = item;
            const hasProposals = (req.proposal_count || 0) > 0;
            return (
              <Pressable
                onPress={() => openProposalComparison(req)}
                style={styles.proposalCard}
              >
                <View style={styles.proposalTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{req.pooja_name}</Text>
                    <Text style={styles.meta}>
                      {req.ceremony_date} {req.ceremony_time ? `· ${req.ceremony_time}` : ""}
                    </Text>
                  </View>
                  <StatusBadge
                    label={req.status === "open" ? (hasProposals ? `${req.proposal_count} PROPOSALS` : "OPEN") : req.status.toUpperCase()}
                    tone={hasProposals ? "accent" : req.status === "awarded" ? "success" : "neutral"}
                  />
                </View>

                <View style={styles.detailRow}>
                  <MapPin size={15} color={colors.ink} />
                  <Text style={styles.detailText} numberOfLines={1}>{req.address}</Text>
                </View>

                {req.budget_min_inr || req.budget_max_inr ? (
                  <Text style={styles.budgetMeta}>
                    Budget guidance: ₹{(req.budget_min_inr || 0).toLocaleString("en-IN")} - ₹{(req.budget_max_inr || 0).toLocaleString("en-IN")}
                  </Text>
                ) : null}

                <View style={styles.proposalActionRow}>
                  <View style={styles.proposalPill}>
                    <Sparkles size={14} color={hasProposals ? colors.saffron : colors.muted2} />
                    <Text style={[styles.proposalCountText, hasProposals && { color: colors.brandBrownDark, fontWeight: "700" }]}>
                      {hasProposals
                        ? `${req.proposal_count} purohit proposal${req.proposal_count > 1 ? "s" : ""} received`
                        : "Waiting for purohit responses"}
                    </Text>
                  </View>
                  <View style={styles.compareBtn}>
                    <Text style={styles.compareBtnText}>Compare</Text>
                    <ChevronRight size={15} color={colors.white} />
                  </View>
                </View>
              </Pressable>
            );
          }

          const b = item;
          const total = b.total_amount || b.price;
          const canReschedule = ["pending", "confirmed"].includes(b.status);
          const canCancel = ["pending", "confirmed"].includes(b.status);
          const pillStatus = b.payment_status === "refunded" ? "refunded" : b.status;
          return (
            <View testID={`booking-${b.id}`} style={styles.bookingCard}>
              <Image source={require("../../../assets/images/ritual-home-hero.png")} style={styles.bookingImage} />
              <View style={styles.bookingBody}>
              <View style={styles.bookingTop}>
                <View style={{ flex: 1 }}><Text style={styles.title}>{b.pooja_name}</Text><Text style={styles.meta}>with {b.priest_name}</Text></View>
                <StatusBadge label={pillStatus} tone={pillStatus === "confirmed" ? "neutral" : pillStatus === "completed" ? "success" : pillStatus === "cancelled" ? "danger" : "accent"} />
              </View>
              <View style={styles.detailRow}><CalendarDays size={15} color={colors.ink} /><Text style={styles.detailText}>{b.booking_date} · {b.booking_time}</Text></View>
              <View style={styles.detailRow}><MapPin size={15} color={colors.ink} /><Text style={styles.detailText} numberOfLines={1}>{b.address}</Text></View>
              {(b.add_ons || []).length > 0 && (
                <Text style={styles.metaSmall}>+ {(b.add_ons || []).map(a => `${a.name.split("·")[1]?.trim() || a.name} × ${a.qty}`).join(", ")}</Text>
              )}
              {b.reschedule_count > 0 && <Text style={[styles.metaSmall, { color: colors.info }]}>Rescheduled {b.reschedule_count}×</Text>}
              <View style={styles.priceRow}>
                <Text style={styles.price}>₹{total.toLocaleString("en-IN")}</Text>
                {b.payment_status === "refunded" && (
                  <Text style={{ color: colors.info, fontSize: font.sizes.xs }}>Refunded ₹{(b.refund_amount || 0).toLocaleString("en-IN")}</Text>
                )}
              </View>
              {b.status === "confirmed" || b.payment_status === "paid" ? <View style={styles.primaryActions}>
                {b.status === "confirmed" ? <Pressable testID={`track-btn-${b.id}`} onPress={() => navigation.navigate("TrackPriest", { booking: b })} style={styles.trackAction}><LocateFixed size={17} color={colors.white} /><Text style={styles.trackActionText}>Track purohit</Text><ChevronRight size={16} color={colors.white} /></Pressable> : null}
                <Pressable testID={`message-btn-${b.id}`} accessibilityLabel="Message purohit" onPress={() => navigation.navigate("Conversation", { bookingId: b.id, priestName: b.priest_name, customerName: b.customer_name, poojaName: b.pooja_name })} style={styles.roundAction}><MessageSquareText size={17} color={colors.ink} /></Pressable>
                {b.status === "confirmed" ? <Pressable
                  testID={`call-btn-${b.id}`}
                  accessibilityLabel="In-app call purohit"
                  onPress={() => startInAppCall(navigation, { bookingId: b.id, booking: b })}
                  style={styles.roundAction}
                >
                  <Phone size={17} color={colors.ink} />
                </Pressable> : null}
              </View> : null}
              <View style={styles.actions}>
                {b.status === "completed" && <ActionBtn label={t.reviewCta} testID={`review-btn-${b.id}`} onPress={() => setReviewTarget(b)} />}
                {b.payment_status === "paid" && <ActionBtn label={t.invoice} testID={`invoice-btn-${b.id}`} onPress={() => openInvoice(b)} />}
                {canReschedule && <ActionBtn label={t.reschedule} testID={`reschedule-btn-${b.id}`} onPress={() => openReschedule(b)} />}
                {canCancel && <ActionBtn label={t.cancelBooking} testID={`cancel-btn-${b.id}`} tone="danger" onPress={() => openCancel(b)} />}
                {["completed", "cancelled"].includes(b.status) &&
                  <ActionBtn label={t.raiseDispute} testID={`dispute-btn-${b.id}`} onPress={() => setDisputeTarget(b)} />}
              </View></View>
            </View>
          );
        }}
      />

      {/* Cancel modal */}
      <Sheet visible={!!cancelTarget} onClose={() => { setCancelTarget(null); setCancelPolicy(null); }} title={t.cancelBooking}>
        {cancelPolicy && (
          <View style={[styles.policyBox, { backgroundColor: cancelPolicy.refund_percent === 100 ? "#DCFCE7" : cancelPolicy.refund_percent === 50 ? "#FED7AA" : "#FEE2E2" }]}>
            <Text testID="cancel-refund-percent" style={styles.policyTitle}>
              Refund: {cancelPolicy.refund_percent}%
              {cancelTarget?.payment_status === "paid" && ` (₹${cancelPolicy.refund_amount.toLocaleString("en-IN")})`}
            </Text>
            <Text style={styles.policySub}>Slot is {Math.round(cancelPolicy.hours_until_slot)}h away. {t.refundPolicy}</Text>
          </View>
        )}
        <Field label="Reason (optional)">
          <TextInput testID="cancel-reason" multiline value={cancelReason} onChangeText={setCancelReason} style={styles.input} />
        </Field>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title={t.keep} variant="outline" onPress={() => { setCancelTarget(null); setCancelPolicy(null); }} style={{ flex: 1 }} />
          <Button testID="confirm-cancel-btn" title={t.confirmCancel} variant="danger" onPress={confirmCancel} style={{ flex: 1 }} />
        </View>
      </Sheet>

      {/* Reschedule modal */}
      <Sheet visible={!!rescheduleTarget} onClose={() => { setRescheduleTarget(null); setReschedulePolicy(null); }} title={t.reschedule}>
        {reschedulePolicy && (
          <View style={[styles.policyBox, { backgroundColor: reschedulePolicy.reschedule_allowed ? "#FED7AA" : "#FEE2E2" }]}>
            <Text testID="reschedule-status" style={styles.policySub}>
              {reschedulePolicy.reschedule_allowed
                ? `Used ${reschedulePolicy.reschedule_used}/${reschedulePolicy.reschedule_max} free reschedules.`
                : reschedulePolicy.reschedule_reason}
            </Text>
          </View>
        )}
        <Field label="New date">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {upcomingDates().map((d) => {
              const iso = d.toISOString().slice(0, 10);
              const isSel = newDate === iso;
              return (
                <Pressable key={iso} onPress={() => setNewDate(iso)}
                  style={[styles.dayChip, isSel && { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown }]}>
                  <Text style={{ fontSize: font.sizes.xs, color: isSel ? colors.white : colors.muted2 }}>{d.toLocaleDateString("en-IN", { weekday: "short" })}</Text>
                  <Text style={{ fontSize: font.sizes.lg, fontWeight: "700", color: isSel ? colors.white : colors.ink }}>{d.getDate()}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Field>
        <Field label="New time">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TIME_SLOTS.map(s => (
              <Pressable key={s} onPress={() => setNewTime(s)}
                style={[styles.timeChip, newTime === s && { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown }]}>
                <Text style={{ color: newTime === s ? colors.white : colors.ink, fontWeight: "600" }}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </Field>
        <Button testID="confirm-reschedule-btn" title={t.reschedule} onPress={confirmReschedule} disabled={!reschedulePolicy?.reschedule_allowed} />
      </Sheet>

      {/* Dispute modal */}
      <Sheet visible={!!disputeTarget} onClose={() => setDisputeTarget(null)} title={t.raiseDispute}>
        <Field label="Category">
          <View style={{ gap: 6 }}>
            {DISPUTE_CATEGORIES.map(c => (
              <Pressable key={c.id} testID={`dispute-cat-${c.id}`} onPress={() => setDisputeCat(c.id)}
                style={[styles.radio, disputeCat === c.id && { borderColor: colors.saffron, backgroundColor: "#FEF3C7" }]}>
                <Text style={{ color: colors.ink }}>{c[language] || c.en}</Text>
              </Pressable>
            ))}
          </View>
        </Field>
        <Field label="Describe what happened">
          <TextInput testID="dispute-description" multiline value={disputeDesc} onChangeText={setDisputeDesc}
            placeholder="Details help us resolve quickly…" style={[styles.input, { minHeight: 100 }]} />
        </Field>
        <Button testID="submit-dispute-btn" title={t.submit} onPress={submitDispute} />
      </Sheet>

      {/* Review modal */}
      <Sheet visible={!!reviewTarget} onClose={() => setReviewTarget(null)} title="Review your experience">
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginVertical: spacing.md }}>
          {[1, 2, 3, 4, 5].map(n => (
            <Pressable key={n} testID={`star-${n}`} onPress={() => setRating(n)}>
              <Text style={{ fontSize: 34, color: n <= rating ? colors.marigold : colors.warmBorder }}>★</Text>
            </Pressable>
          ))}
        </View>
        <TextInput testID="review-comment" multiline value={comment} onChangeText={setComment}
          placeholder="Share how it went…" style={[styles.input, { minHeight: 100, marginBottom: spacing.md }]} />
        <Button testID="submit-review-btn" title={t.submit} onPress={submitReview} />
      </Sheet>
    </>
  );
}

function ActionBtn({ label, onPress, tone = "neutral", testID }) {
  const isDanger = tone === "danger";
  return (
    <Pressable testID={testID} onPress={onPress} style={[
      styles.pillBtn,
      isDanger && { borderColor: "#FCA5A5", backgroundColor: "#FEE2E2" },
    ]}>
      <Text style={[
        { color: colors.ink, fontSize: font.sizes.xs, fontWeight: "700" },
        isDanger && { color: colors.danger },
      ]}>{label}</Text>
    </Pressable>
  );
}

function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheet}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
            <Text style={{ fontSize: font.sizes.lg, fontWeight: "700", color: colors.ink }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={{ color: colors.saffron, fontWeight: "700" }}>Close</Text></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = bindBrandStyles({
  header: { marginBottom: spacing.xl, paddingTop: 12 },
  headerCopy: { marginBottom: 4 },
  headerKicker: { color: colors.saffron, fontSize: 10, fontWeight: "700", letterSpacing: .8 },
  h1: { fontSize: 32, lineHeight: 39, fontWeight: "700", color: colors.ink },
  sub: { color: colors.muted2, fontSize: 13, marginTop: 4 },
  bookingCard: { overflow: "hidden", borderRadius: radii.xl, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white },
  bookingImage: { width: "100%", height: 112, resizeMode: "cover", backgroundColor: colors.muted },
  bookingBody: { padding: 17 },
  bookingTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { fontSize: 19, lineHeight: 24, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 12, color: colors.muted2, marginTop: 3 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  detailText: { flex: 1, fontSize: 12, color: colors.muted2 },
  metaSmall: { fontSize: 11, color: colors.muted2, marginTop: 4 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 15 },
  price: { color: colors.ink, fontWeight: "700", fontSize: 17 },
  primaryActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  trackAction: { flex: 1, minHeight: 46, borderRadius: 23, backgroundColor: colors.brandBrown, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  trackActionText: { color: colors.white, fontWeight: "700", fontSize: 12 },
  roundAction: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 13, borderTopWidth: 1, borderColor: colors.warmBorder, paddingTop: 13 },
  pillBtn: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder },
  input: {
    minHeight: 48, borderRadius: radii.md, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.warmBorder, paddingHorizontal: spacing.lg, paddingVertical: 10,
    fontSize: font.sizes.base, color: colors.ink,
  },
  policyBox: { borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md },
  policyTitle: { fontWeight: "700", color: colors.ink },
  policySub: { fontSize: font.sizes.xs, color: colors.ink, marginTop: 4 },
  radio: { padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white },
  dayChip: { width: 54, height: 60, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder, alignItems: "center", justifyContent: "center", marginRight: 8 },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.cotton, padding: spacing.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%" },
  segmentWrap: { flexDirection: "row", backgroundColor: colors.muted, borderRadius: radii.pill, padding: 4, marginTop: 16 },
  segmentBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 10, borderRadius: radii.pill },
  segmentBtnActive: { backgroundColor: colors.brandBrown, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  segmentText: { color: colors.muted2, fontSize: 13, fontWeight: "700" },
  segmentTextActive: { color: colors.white, fontWeight: "800" },
  newRequestBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, paddingVertical: 11, borderRadius: radii.md, backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FED7AA" },
  newRequestText: { color: colors.saffron, fontSize: 13, fontWeight: "700" },
  proposalCard: { padding: 18, backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.warmBorder, marginBottom: 12 },
  proposalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  budgetMeta: { color: colors.muted2, fontSize: 12, marginTop: 8 },
  proposalActionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: colors.warmBorder },
  proposalPill: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  proposalCountText: { color: colors.muted2, fontSize: 12, fontWeight: "600" },
  compareBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandBrown, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  compareBtnText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  emptyProposals: { alignItems: "center", padding: 32, backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.warmBorder, marginTop: 10 },
  emptyProposalsTitle: { color: colors.ink, fontSize: 18, fontWeight: "700", marginTop: 12 },
  emptyProposalsBody: { color: colors.muted2, fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 6, maxWidth: 280 },
  emptyActionBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.brandBrown, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radii.pill, marginTop: 18 },
  emptyActionText: { color: colors.white, fontSize: 13, fontWeight: "700" },
});
