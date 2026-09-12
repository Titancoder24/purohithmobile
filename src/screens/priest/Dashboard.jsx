import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { CalendarCheck2, CalendarClock, Check, ChevronRight, Clock3, MapPin, MessageSquareText, Phone, ReceiptText, ShieldCheck, WalletCards } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../lib/theme";
import { Button } from "../../components/UI";
import { downloadInvoice, listBookings, listPaymentReports, updateProviderBooking } from "../../lib/payments";
import { useAuth } from "../../lib/auth";

const DEMO_BOOKINGS = [
  { id: "demo-request", status: "pending", pooja_name: "Griha Pravesh", customer_name: "Ananya Rao", customer_phone: "9000000101", booking_date: "2026-08-12", booking_time: "09:00", address: "Indiranagar, Bengaluru", total_amount: 5100 },
  { id: "demo-confirmed", status: "confirmed", pooja_name: "Satyanarayan Pooja", customer_name: "Raghav Iyer", customer_phone: "9000000102", booking_date: "2026-08-10", booking_time: "07:30", address: "Jayanagar, Bengaluru", total_amount: 3100 },
];

const toDate = (value) => new Date(`${value}T00:00:00`);
const amount = (booking) => booking.total_amount || booking.price || 0;

export default function PriestDashboard() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (user?.demo) return setItems(DEMO_BOOKINGS);
    try {
      const [{ bookings }, { reports }] = await Promise.all([listBookings(), listPaymentReports()]);
      const reportsByBooking = Object.fromEntries((reports || []).map((report) => [report.booking_id, report]));
      setItems((bookings || []).map((booking) => ({ ...booking, payment_report: reportsByBooking[booking.id] })));
    } catch (_) { setItems([]); }
  }, [user?.demo]);
  useEffect(() => { load(); }, [load]);

  const act = async (booking, action) => {
    if (user?.demo) { setItems((current) => current.map((item) => item.id === booking.id ? { ...item, status: action === "accept" ? "confirmed" : action === "complete" ? "completed" : "rejected" } : item)); return; }
    try { await updateProviderBooking(booking.id, action); load(); }
    catch (error) { Alert.alert("Booking update failed", error?.message || "Try again."); }
  };

  const analytics = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, index) => { const day = new Date(now); day.setDate(now.getDate() + index); return day; });
    const values = days.map((day) => items.filter((booking) => ["confirmed", "completed"].includes(booking.status) && toDate(booking.booking_date).toDateString() === day.toDateString()).reduce((sum, booking) => sum + amount(booking), 0));
    const scheduled = items.filter((booking) => ["confirmed", "completed"].includes(booking.status));
    const completed = items.filter((booking) => booking.status === "completed");
    const pending = items.filter((booking) => booking.status === "pending");
    return { days, values, pending, scheduled, completed, scheduledValue: scheduled.reduce((sum, booking) => sum + amount(booking), 0), settledValue: completed.reduce((sum, booking) => sum + amount(booking), 0) };
  }, [items]);

  const work = [...items].filter((booking) => !["completed", "rejected", "cancelled"].includes(booking.status)).sort((a, b) => `${a.booking_date}${a.booking_time}`.localeCompare(`${b.booking_date}${b.booking_time}`));
  const firstName = (user?.name || "Purohit").split(" ")[0];

  return <ScrollView style={styles.root} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.saffron} />}>
    <View style={styles.topline}><View><Text style={styles.kicker}>PRIEST OPERATIONS</Text><Text style={styles.greeting}>Good day, {firstName}</Text><Text style={styles.helper}>Your schedule, earnings, and customer requests.</Text></View><Pressable accessibilityLabel="Manage availability" onPress={() => navigation.navigate("Availability")} style={styles.availabilityButton}><Clock3 size={18} color={colors.white} /></Pressable></View>

    <View style={styles.revenueSurface}>
      <View style={styles.revenueTop}><View><Text style={styles.revenueLabel}>Scheduled value</Text><Text style={styles.revenueValue}>₹{analytics.scheduledValue.toLocaleString("en-IN")}</Text><Text style={styles.revenueMeta}>{analytics.scheduled.length} confirmed ceremonies in your pipeline</Text></View><View style={styles.revenueIcon}><WalletCards size={21} color={colors.saffron} /></View></View>
      <BookingChart values={analytics.values} days={analytics.days} />
    </View>

    <View style={styles.stats}><Stat label="New requests" value={analytics.pending.length} icon={CalendarClock} /><Stat label="Scheduled" value={analytics.scheduled.length} icon={CalendarCheck2} /><Stat label="Settled" value={`₹${analytics.settledValue.toLocaleString("en-IN")}`} icon={Check} /></View>

    <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Work queue</Text><Text style={styles.sectionSub}>Requests and ceremonies that need your attention</Text></View><Text style={styles.count}>{work.length}</Text></View>
    {work.length === 0 ? <View style={styles.empty}><ShieldCheck size={21} color={colors.success} /><Text style={styles.emptyTitle}>Your queue is clear</Text><Text style={styles.emptyText}>New customer requests will appear here.</Text></View> : work.map((booking) => <BookingRow key={booking.id} booking={booking} onAction={act} navigation={navigation} />)}
  </ScrollView>;
}

function BookingChart({ values, days }) {
  const width = 320; const height = 104; const side = 8; const max = Math.max(...values, 1);
  const points = values.map((value, index) => ({ x: side + (index * (width - side * 2)) / Math.max(values.length - 1, 1), y: 72 - (value / max) * 48 }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},76 L${points[0].x.toFixed(1)},76 Z`;
  return <View style={styles.chartWrap}><View style={styles.chartCaption}><Text style={styles.chartTitle}>Next 7 days</Text><Text style={styles.chartValue}>Ceremony value</Text></View><Svg width="100%" height={104} viewBox={`0 0 ${width} ${height}`}><Defs><LinearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors.saffron} stopOpacity=".16" /><Stop offset="1" stopColor={colors.saffron} stopOpacity="0" /></LinearGradient></Defs><Path d="M8,76 L312,76" stroke={colors.warmBorder} strokeWidth="1" /><Path d={area} fill="url(#revenueFill)" /><Path d={line} fill="none" stroke={colors.saffron} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{points.map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r={values[index] ? 3.5 : 2} fill={values[index] ? colors.saffron : colors.warmBorder} />)}</Svg><View style={styles.chartLabels}>{days.map((day) => <Text key={day.toISOString()} style={styles.chartDay}>{day.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 1)}</Text>)}</View></View>;
}

function Stat({ label, value, icon: Icon }) { return <View style={styles.stat}><View style={styles.statIcon}><Icon size={15} color={colors.ink} strokeWidth={2.3} /></View><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }

function BookingRow({ booking, navigation, onAction }) {
  const pending = booking.status === "pending"; const confirmed = booking.status === "confirmed";
  const date = toDate(booking.booking_date);
  return <View style={[styles.job, pending && styles.jobPending]}>
    <View style={styles.dateTile}><Text style={styles.month}>{date.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}</Text><Text style={styles.day}>{date.getDate()}</Text><Text style={styles.time}>{booking.booking_time}</Text></View>
    <View style={styles.jobBody}><View style={styles.jobTop}><Text style={styles.jobTitle}>{booking.pooja_name}</Text><Text style={styles.status}>{pending ? "NEW REQUEST" : "SCHEDULED"}</Text></View><Text style={styles.customer}>{booking.customer_name}</Text><View style={styles.location}><MapPin size={12} color={colors.muted2} /><Text style={styles.locationText} numberOfLines={1}>{booking.address}</Text></View><Text style={styles.price}>₹{amount(booking).toLocaleString("en-IN")}</Text>{pending ? <View style={styles.pendingActions}><Button title="Accept" onPress={() => onAction(booking, "accept")} style={styles.accept} /><Button title="Decline" variant="danger" onPress={() => onAction(booking, "reject")} style={styles.decline} /></View> : null}{confirmed ? <View style={styles.confirmedActions}><Pressable accessibilityLabel="Message customer" onPress={() => navigation.navigate("Conversation", { bookingId: booking.id })} style={styles.iconAction}><MessageSquareText size={18} color={colors.ink} /></Pressable><Pressable accessibilityLabel="Call customer" onPress={() => navigation.navigate("CallRoom", { bookingId: booking.id })} style={styles.iconAction}><Phone size={17} color={colors.ink} /></Pressable>{booking.payment_report?.invoice_html ? <Pressable accessibilityLabel="Download invoice" onPress={() => downloadInvoice(booking.payment_report.invoice_html, booking.payment_report.invoice_number).catch((error) => Alert.alert("Invoice unavailable", error?.message || "Please try again."))} style={styles.iconAction}><ReceiptText size={17} color={colors.ink} /></Pressable> : null}<Pressable accessibilityLabel="Share trip location" onPress={() => navigation.navigate("ShareLocation", { booking })} style={styles.tripAction}><Text style={styles.tripText}>Trip tools</Text><ChevronRight size={16} color={colors.white} /></Pressable></View> : null}</View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white }, content: { padding: 20, paddingBottom: 40 }, topline: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 6 }, kicker: { color: colors.saffron, fontSize: 10, fontWeight: "700", letterSpacing: .8 }, greeting: { color: colors.ink, fontSize: 31, lineHeight: 37, fontWeight: "700", marginTop: 6 }, helper: { color: colors.muted2, fontSize: 13, marginTop: 5, maxWidth: 290, lineHeight: 18 }, availabilityButton: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandBrown },
  revenueSurface: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.warmBorder, marginTop: 22, padding: 20, overflow: "hidden" }, revenueTop: { flexDirection: "row", justifyContent: "space-between" }, revenueLabel: { color: colors.muted2, fontSize: 10, fontWeight: "700", letterSpacing: .7 }, revenueValue: { color: colors.ink, fontSize: 38, fontWeight: "700", marginTop: 7 }, revenueMeta: { color: colors.muted2, fontSize: 11, marginTop: 4 }, revenueIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFF0EA", alignItems: "center", justifyContent: "center" }, chartWrap: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderColor: colors.warmBorder }, chartCaption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, chartTitle: { color: colors.ink, fontSize: 11, fontWeight: "700" }, chartValue: { color: colors.muted2, fontSize: 10 }, chartLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginTop: -6 }, chartDay: { color: colors.muted2, fontSize: 9, fontWeight: "700" },
  stats: { flexDirection: "row", gap: 0, marginTop: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.warmBorder }, stat: { flex: 1, minHeight: 94, paddingVertical: 14, paddingHorizontal: 9, borderRightWidth: 1, borderColor: colors.warmBorder }, statIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F3" }, statLabel: { color: colors.muted2, fontSize: 10, lineHeight: 13, marginTop: 9 }, statValue: { color: colors.ink, fontSize: 18, fontWeight: "700", marginTop: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 30, marginBottom: 12 }, sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: "700" }, sectionSub: { color: colors.muted2, fontSize: 11, marginTop: 3 }, count: { width: 28, height: 28, borderRadius: 14, textAlign: "center", textAlignVertical: "center", paddingTop: 6, backgroundColor: colors.brandBrown, color: colors.white, fontSize: 11, fontWeight: "700" },
  job: { flexDirection: "row", gap: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder, borderRadius: 14, padding: 14, marginBottom: 11 }, jobPending: { borderColor: "#F1B29C", borderLeftWidth: 4 }, dateTile: { width: 58, minHeight: 82, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted }, month: { color: colors.saffron, fontSize: 9, fontWeight: "700" }, day: { color: colors.ink, fontSize: 23, fontWeight: "700", lineHeight: 28 }, time: { color: colors.muted2, fontSize: 9, fontWeight: "700" }, jobBody: { flex: 1, minWidth: 0 }, jobTop: { flexDirection: "row", gap: 7, justifyContent: "space-between", alignItems: "flex-start" }, jobTitle: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 19, fontWeight: "700" }, status: { color: colors.muted2, backgroundColor: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: .3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 }, customer: { color: colors.muted2, fontSize: 12, marginTop: 5 }, location: { flexDirection: "row", gap: 4, alignItems: "center", marginTop: 6 }, locationText: { flex: 1, color: colors.muted2, fontSize: 10 }, price: { color: colors.ink, fontSize: 14, fontWeight: "700", marginTop: 7 }, pendingActions: { flexDirection: "row", gap: 8, marginTop: 12 }, accept: { flex: 1, minHeight: 42, backgroundColor: "#16784B" }, decline: { flex: 1, minHeight: 42, backgroundColor: "#B52D37" }, confirmedActions: { flexDirection: "row", gap: 7, marginTop: 12, alignItems: "center" }, iconAction: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted }, tripAction: { flex: 1, minHeight: 40, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: colors.brandBrown }, tripText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", backgroundColor: colors.muted, borderRadius: 14, padding: 28 }, emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "700", marginTop: 8 }, emptyText: { color: colors.muted2, fontSize: 11, marginTop: 4 },
});
