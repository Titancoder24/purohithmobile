import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, Pressable, Platform, ActivityIndicator, useWindowDimensions } from "react-native";
import { Check, Download, Info, Send, ShieldCheck, UserRound, WalletCards } from "lucide-react-native";
import { colors, radii, spacing, font, shadow } from "../../lib/theme";
import { Button, Card, Field } from "../../components/UI";
import { useI18n } from "../../lib/i18n";
import api from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { fetchMarketplacePoojas, fetchMarketplaceProfile } from "../../lib/marketplace";
import { createCashfreeOrder, downloadInvoice, openCashfreeCheckout, verifyCashfreeOrder } from "../../lib/payments";
import { getLocalPriest } from "../../data/localPriests";

const TIME_SLOTS = ["06:00", "07:30", "09:00", "10:30", "16:00", "17:30", "19:00"];
const DEFAULT_POOJAS = [
  { slug: "gauri-ganesha-vratha", name: "Gauri and Ganesha Vratha", base_price_inr: 1800 },
  { slug: "rudrabhishek", name: "Rudra Abhishek", base_price_inr: 2500 },
  { slug: "satyanarayan", name: "Satyanarayan Pooja", base_price_inr: 2100 },
  { slug: "griha-pravesh", name: "Griha Pravesh Puja", base_price_inr: 3500 },
  { slug: "ayudha-puja", name: "Ayudha Puja", base_price_inr: 1500 },
  { slug: "navagraha-shanti", name: "Navagraha Shanti", base_price_inr: 4100 },
  { slug: "varamahalakshmi-vratha", name: "Varamahalakshmi Vratha", base_price_inr: 2200 },
  { slug: "namakarna", name: "Namakarna", base_price_inr: 3000 },
  { slug: "vivaha", name: "Vivaha", base_price_inr: 15000 },
];

function fmtDate(d) { return d.toISOString().slice(0, 10); }
function upcomingDates(days = 14) {
  const out = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

export default function Booking({ route, navigation }) {
  const { t, language } = useI18n();
  const { user, updateProfile } = useAuth();
  const { priestId, poojaSlug: routePoojaSlug } = route.params || {};
  const [pooja, setPooja] = useState(() => findDefaultPooja(routePoojaSlug));
  const [poojaCatalog, setPoojaCatalog] = useState(DEFAULT_POOJAS);
  const [selectedPoojaSlug, setSelectedPoojaSlug] = useState(routePoojaSlug || "satyanarayan");
  const [priest, setPriest] = useState(null);
  const [priestError, setPriestError] = useState("");
  const [priestLoadAttempt, setPriestLoadAttempt] = useState(0);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const { width } = useWindowDimensions();
  const desktop = width >= 860;

  useEffect(() => {
    let active = true;
    const localPriest = getLocalPriest(priestId);
    setPriestError("");
    if (localPriest) {
      setPriest(localPriest);
    } else if (!priestId) {
      setPriest(null);
      setPriestError("No purohit was selected for this booking.");
    } else {
      setPriest(null);
      withTimeout(fetchMarketplaceProfile(priestId), 8000)
        .then(({ profile }) => {
          if (!profile) throw new Error("Purohit profile was not found");
          if (active) setPriest(profile);
        })
        .catch(() => withTimeout(api.get(`/priests/${priestId}`), 8000)
          .then(({ data }) => {
            if (!data) throw new Error("Purohit profile was not found");
            if (active) setPriest(data);
          })
          .catch(() => {
            if (active) setPriestError("We could not load this purohit. Check your connection and try again.");
          }));
    }
    return () => { active = false; };
  }, [priestId, priestLoadAttempt]);

  useEffect(() => {
    fetchMarketplacePoojas()
      .then(({ poojas }) => {
        const next = poojas?.length ? poojas : DEFAULT_POOJAS;
        setPoojaCatalog(next);
        const found = next.find((item) => item.slug === selectedPoojaSlug) || next[0] || DEFAULT_POOJAS[2];
        setSelectedPoojaSlug((current) => current || found.slug);
        setPooja(normalizePooja(found));
      })
      .catch(() => {
        const found = DEFAULT_POOJAS.find((item) => item.slug === selectedPoojaSlug) || DEFAULT_POOJAS[2];
        setPoojaCatalog(DEFAULT_POOJAS);
        setPooja(normalizePooja(found));
      });
  }, [selectedPoojaSlug]);

  const offeredSlugs = useMemo(() => {
    if (!priest) return null;
    const fromServices = (priest.services || []).map((s) => s.pooja_slug);
    const fromSlugs = priest.pooja_slugs || [];
    const fromSpecialties = (priest.pooja_specialties || priest.poojas_offered || []).map(normalizePoojaSlug);
    const list = [...fromServices, ...fromSlugs, ...fromSpecialties].filter(Boolean);
    return list.length > 0 ? new Set(list) : null;
  }, [priest]);

  const availablePoojas = useMemo(() => {
    if (!offeredSlugs) return poojaCatalog;
    const filtered = poojaCatalog.filter((item) => offeredSlugs.has(item.slug));
    return filtered.length > 0 ? filtered : poojaCatalog;
  }, [offeredSlugs, poojaCatalog]);

  // When priest profile or offered poojas are ready, ensure selected pooja is an offered ceremony
  useEffect(() => {
    if (!availablePoojas?.length) return;
    const isCurrentOffered = availablePoojas.some((item) => item.slug === selectedPoojaSlug);
    if (!isCurrentOffered) {
      const withService = availablePoojas.find((item) => priest?.services?.some((s) => s.pooja_slug === item.slug));
      const nextChoice = withService || availablePoojas[0];
      if (nextChoice) {
        setSelectedPoojaSlug(nextChoice.slug);
        setPooja(normalizePooja(nextChoice));
      }
    }
  }, [availablePoojas, selectedPoojaSlug, priest?.services]);

  const publishedService = useMemo(() => {
    return priest?.services?.find((service) => service.pooja_slug === selectedPoojaSlug);
  }, [priest?.services, selectedPoojaSlug]);

  const isOfferedCeremony = useMemo(() => {
    if (!availablePoojas?.length) return true;
    return availablePoojas.some((item) => item.slug === selectedPoojaSlug);
  }, [availablePoojas, selectedPoojaSlug]);

  const totals = useMemo(() => {
    if (!pooja) return { pooja_price: 0, addons: 0, subtotal: 0, gst: 0 };
    const price = publishedService?.price_inr
      ?? (priest?.starting_price_inr ? Number(priest.starting_price_inr) : null)
      ?? pooja.base_price
      ?? 0;
    const pooja_price = Number(price || 0);
    const subtotal = pooja_price;
    const base = +(subtotal / 1.18).toFixed(2);
    const gst = +(subtotal - base).toFixed(2);
    return { pooja_price, addons: 0, subtotal, gst };
  }, [pooja, publishedService, priest]);

  useEffect(() => {
    if (user?.phone && !phone) {
      setPhone(user.phone);
    }
  }, [user?.phone, phone]);

  const submit = async () => {
    if (!date || !time || !address) return Alert.alert("Missing", "Choose date, time and address");
    const cleanPhone = (phone || user?.phone || "").replace(/\D/g, "").slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return Alert.alert(
        "Mobile Number Required",
        "Please enter a valid 10-digit mobile number for order confirmation, priest coordination, and secure payment processing."
      );
    }
    if (!isOfferedCeremony) {
      return Alert.alert(
        "Ceremony Unavailable",
        `${priest?.name || "This purohit"} does not typically perform ${pooja?.name || "this ceremony"}. Please choose an available ceremony from their specialties above.`,
        [{ text: "OK" }]
      );
    }
    setBusy(true);
    try {
      if (!user?.id || user?.demo) throw new Error("demo");
      if (updateProfile) {
        await updateProfile({ phone: cleanPhone });
      }
      const data = await createCashfreeOrder({
        priest_id: priestId,
        pooja_slug: selectedPoojaSlug,
        booking_date: date,
        booking_time: time,
        address, landmark, notes, customer_email: email,
        customer_phone: cleanPhone,
      });
      await openCashfreeCheckout(data.order);
      const verified = await verifyCashfreeOrder({ payment_order_id: data.order.id });
      if (verified.order?.status !== "paid") {
        return Alert.alert("Payment pending", "Cashfree has not confirmed this payment yet. You can retry verification from My Bookings.");
      }
      setConfirmed({
        ...(data.booking || {}),
        ...(verified.booking || {}),
        payment_receipt_token: verified.order.customer_receipt_token,
        priest_name: priest.name,
        pooja_name: pooja.name,
        booking_date: date,
        booking_time: time,
        total_amount: verified.order.amount_inr,
      });
    } catch (e) {
      if (user?.demo) {
        return setConfirmed({ id: `demo-${Date.now()}`, priest_name: priest.name, pooja_name: pooja.name, booking_date: date, booking_time: time, total_amount: totals.subtotal, invoice_no: "DEMO/0001" });
      }
      const errMsg = e?.message || e?.response?.data?.detail || "Booking failed";
      if (errMsg.includes("not published a price")) {
        Alert.alert(
          "Pricing In Progress",
          `${priest?.name || "This purohit"} is still confirming published rates for ${pooja?.name || "this ceremony"}. Would you like to request custom proposals from nearby verified purohits?`,
          [
            { text: "Change ceremony", style: "cancel" },
            {
              text: "Request proposals",
              onPress: () => navigation.navigate("RequestPooja", { poojaSlug: selectedPoojaSlug, poojaName: pooja?.name }),
            },
          ]
        );
      } else {
        Alert.alert("Failed", errMsg);
      }
    } finally { setBusy(false); }
  };

  if (priestError) return <View style={styles.loadState}><UserRound size={30} color={colors.brandOrangeDark} /><Text style={styles.loadTitle}>Unable to open booking</Text><Text style={styles.loadBody}>{priestError}</Text><Button title="Try again" onPress={() => setPriestLoadAttempt((attempt) => attempt + 1)} style={styles.loadAction} /><Button title="Back to purohits" variant="outline" onPress={() => navigation.goBack()} style={styles.loadAction} /></View>;
  if (!priest || !pooja) return <View style={styles.loadState}><ActivityIndicator color={colors.saffron} /><Text style={styles.loadingText}>Preparing your booking…</Text></View>;

  if (confirmed) {
    return (
      <ScrollView contentContainerStyle={[styles.confirmedPage, desktop && styles.contentDesktop]}>
        <View style={{ alignItems: "center" }}>
          <View style={styles.successIcon}><Check size={34} color={colors.white} strokeWidth={3} /></View>
          <Text style={styles.h1}>{language === "kn" ? "ಬುಕಿಂಗ್ ದೃಢಪಟ್ಟಿದೆ" : "Booking confirmed"}</Text>
          <Text style={styles.sub}>{confirmed.priest_name} · {confirmed.pooja_name}</Text>
          <Text style={styles.sub}>{confirmed.booking_date} · {confirmed.booking_time}</Text>
        </View>
        <Card style={{ marginTop: spacing.xl, ...shadow.card }}>
          <Row label="Booking ID" value={confirmed.id.slice(0, 8)} />
          {confirmed.invoice_no || confirmed.invoice_number ? <Row label="Invoice #" value={confirmed.invoice_no || confirmed.invoice_number} /> : null}
          {confirmed.payment_receipt_token ? <Row label="Payment receipt" value={confirmed.payment_receipt_token.slice(0, 8).toUpperCase()} /> : null}
          <Row label="Total paid" value={`₹${(confirmed.total_amount || confirmed.price).toLocaleString("en-IN")}`} tone="saffron" />
        </Card>
        {confirmed.invoice_html ? <Button title="Download invoice" icon={Download} onPress={() => downloadInvoice(confirmed.invoice_html, confirmed.invoice_number || confirmed.invoice_no)} style={{ marginTop: spacing.md }} /> : null}
        <Button testID="view-bookings-btn" title="View my bookings" onPress={() => navigation.navigate("Tabs", { screen: "Bookings" })} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
        <Text style={styles.eyebrow}>REVIEW AND CONTINUE</Text>
        <Text style={styles.h1}>{pooja.name}</Text>
        <View style={styles.providerSummary}>
          <View style={styles.providerAvatar}><UserRound size={20} color={colors.ink} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.providerName}>{priest.name}</Text>
            <Text style={styles.sub}>
              Verified purohit · Ceremony fee ₹{totals.subtotal.toLocaleString("en-IN")}
            </Text>
          </View>
        </View>
        <View style={styles.steps}><Step active number="1" label="Schedule" /><View style={styles.stepLine} /><Step number="2" label="Details" /><View style={styles.stepLine} /><Step number="3" label="Review" /></View>

        <View style={desktop ? styles.checkoutGrid : undefined}>
        <View style={desktop ? styles.formPane : undefined}>
        <Field label="Choose ceremony" required>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ceremonyList}>
            {availablePoojas.map((item) => {
              const active = item.slug === selectedPoojaSlug;
              const service = priest?.services?.find((s) => s.pooja_slug === item.slug);
              const price = service ? Number(service.price_inr) : (priest?.starting_price_inr ? Number(priest.starting_price_inr) : Number(item.base_price_inr || item.base_price || 0));
              return (
                <Pressable
                  key={item.slug}
                  onPress={() => {
                    setSelectedPoojaSlug(item.slug);
                    setPooja(normalizePooja(item));
                  }}
                  style={[styles.ceremonyChip, active && styles.ceremonyChipActive]}
                >
                  <Text style={[styles.ceremonyName, active && styles.ceremonyNameActive]}>{item.name}</Text>
                  <Text style={[styles.ceremonyPrice, active && styles.ceremonyNameActive]}>
                    ₹{price.toLocaleString("en-IN")}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Field>

        {!isOfferedCeremony ? (
          <View style={styles.ceremonyNotice}>
            <View style={styles.noticeIconWrap}>
              <Info size={15} color={colors.brandBrown} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Custom ceremony request</Text>
              <Text style={styles.noticeBody}>
                {priest.name} does not list this ceremony in their standard offerings. You can select an offered specialty above or request custom proposals.
              </Text>
              <Pressable
                onPress={() => navigation.navigate("RequestPooja", { poojaSlug: selectedPoojaSlug, poojaName: pooja.name })}
                style={styles.noticeBtn}
              >
                <Send size={12} color={colors.brandBrown} />
                <Text style={styles.noticeBtnText}>Request custom proposals</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Date scroller */}
        <Field label="Select date" required>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {upcomingDates().map((d) => {
              const iso = fmtDate(d);
              const blocked = (priest.blocked_dates || []).includes(iso);
              const isSel = date === iso;
              return (
                <Pressable
                  key={iso}
                  testID={`date-${iso}`}
                  disabled={blocked}
                  onPress={() => setDate(iso)}
                  style={[styles.dayChip, isSel && styles.dayChipActive, blocked && { opacity: 0.35 }]}
                >
                  <Text style={[styles.dayChipDow, isSel && { color: colors.white }]}>
                    {d.toLocaleDateString("en-IN", { weekday: "short" })}
                  </Text>
                  <Text style={[styles.dayChipNum, isSel && { color: colors.white }]}>{d.getDate()}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Field>

        {/* Time slots */}
        <Field label="Time slot" required>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TIME_SLOTS.map(s => (
              <Pressable
                key={s}
                testID={`time-${s}`}
                onPress={() => setTime(s)}
                style={[styles.timeChip, time === s && styles.timeChipActive]}
              >
                <Text style={[styles.timeChipTxt, time === s && { color: colors.white }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {/* Address */}
        <Field label="Address" required>
          <TextInput testID="booking-address" multiline value={address} onChangeText={setAddress}
            placeholder="Flat, street, area, Bengaluru" style={[styles.input, { minHeight: 80, paddingVertical: 12 }]} />
        </Field>
        <Field label="Landmark (optional)">
          <TextInput testID="booking-landmark" value={landmark} onChangeText={setLandmark} placeholder="Near ABC temple" style={styles.input} />
        </Field>
        {/* Contact Phone */}
        <Field label="Mobile number (required for booking & payment)" required>
          <TextInput
            testID="booking-phone"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit mobile number"
            style={styles.input}
          />
        </Field>
        <Field label="Email for invoice (optional)">
          <TextInput testID="booking-email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} placeholder="you@example.com" style={styles.input} />
        </Field>
        <Field label="Notes to priest (optional)">
          <TextInput testID="booking-notes" multiline value={notes} onChangeText={setNotes} placeholder="Any special requests" style={[styles.input, { minHeight: 70, paddingVertical: 12 }]} />
        </Field>
        </View>

        <View style={desktop ? styles.summaryPane : undefined}>
        <Card style={styles.paymentCard}>
          <View style={styles.paymentTop}><View style={styles.qrMark}><ShieldCheck size={22} color={colors.saffron} /></View><View style={{ flex: 1 }}><Text style={styles.paymentTitle}>Secure Cashfree checkout</Text><Text style={styles.paymentSub}>Pay by UPI, card, netbanking, or an available wallet. Payment status is verified by signed Cashfree webhooks before the booking is confirmed.</Text></View></View>
          <View style={styles.secureLine}><WalletCards size={17} color={colors.ink} /><Text style={styles.secureText}>Your payment credentials are handled by Cashfree and are never stored in Purohith Connect.</Text></View>
        </Card>

        {/* Cart breakdown */}
        <Card testID="cart-breakdown" style={{ marginTop: spacing.md, ...shadow.card }}>
          <Row label={pooja.name} value={`₹${totals.pooja_price.toLocaleString("en-IN")}`} />
          <View style={{ height: 1, backgroundColor: colors.warmBorder, marginVertical: 8 }} />
          <Text style={{ color: colors.muted2, fontSize: font.sizes.xs }}>{t.includingGst} (₹{totals.gst.toLocaleString("en-IN")})</Text>
          <Row label={t.total} value={`₹${totals.subtotal.toLocaleString("en-IN")}`} tone="saffron" />
        </Card>
        </View>
        </View>
      </ScrollView>

      {/* Sticky pay bar */}
      <View style={styles.stickyBar}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Text style={{ color: colors.muted2, fontSize: font.sizes.xs }}>{t.includingGst}</Text>
          <Text testID="cart-total" style={{ color: colors.saffron, fontWeight: "800", fontSize: font.sizes.xl }}>
            ₹{totals.subtotal.toLocaleString("en-IN")}
          </Text>
        </View>
        <Button
          testID="pay-btn"
          title={!isOfferedCeremony ? "Select an offered ceremony" : busy ? "Opening secure checkout…" : `${t.payNow} with Cashfree`}
          onPress={submit}
          disabled={busy || !isOfferedCeremony}
        />
      </View>
    </View>
  );
}

function Row({ label, value, tone }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
      <Text style={{ color: colors.muted2, fontSize: font.sizes.sm, flex: 1 }} numberOfLines={1}>{label}</Text>
      <Text style={{ color: tone === "saffron" ? colors.saffron : colors.ink, fontWeight: "700", fontSize: tone === "saffron" ? font.sizes.lg : font.sizes.sm }}>{value}</Text>
    </View>
  );
}

function Step({ number, label, active }) { return <View style={styles.step}><View style={[styles.stepNumber, active && styles.stepNumberActive]}><Text style={[styles.stepNumberText, active && { color: colors.white }]}>{number}</Text></View><Text style={[styles.stepLabel, active && { color: colors.ink }]}>{label}</Text></View>; }

function normalizePooja(item) {
  return {
    ...item,
    base_price: Number(item?.base_price ?? item?.base_price_inr ?? 0),
  };
}

function normalizePoojaSlug(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";
  if (text.includes("satya")) return "satyanarayan";
  if (text.includes("griha") || text.includes("gruh")) return "griha-pravesh";
  if (text.includes("rudra")) return "rudrabhishek";
  if (text.includes("ganesha") || text.includes("gauri")) return "gauri-ganesha-vratha";
  if (text.includes("ayudha")) return "ayudha-puja";
  if (text.includes("navagraha")) return "navagraha-shanti";
  if (text.includes("lakshmi") || text.includes("varamahalakshmi")) return "varamahalakshmi-vratha";
  if (text.includes("namakar")) return "namakarna";
  if (text.includes("vivaha")) return "vivaha";
  return text.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function findDefaultPooja(slug) {
  return normalizePooja(DEFAULT_POOJAS.find((item) => item.slug === slug) || DEFAULT_POOJAS[2]);
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeoutMs)),
  ]);
}

const styles = StyleSheet.create({
  loadState: { flex: 1, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadTitle: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: "800", marginTop: 14, textAlign: "center" },
  loadBody: { maxWidth: 360, color: colors.muted2, fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 12, textAlign: "center" },
  loadingText: { color: colors.muted2, fontSize: 12, fontWeight: "600", marginTop: 12 },
  loadAction: { width: "100%", maxWidth: 320, marginTop: 10 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: spacing.lg, paddingBottom: 170 }, contentDesktop: { maxWidth: 1160, paddingHorizontal: 36, paddingTop: 28 }, confirmedPage: { width: "100%", maxWidth: 680, alignSelf: "center", padding: spacing.xxl, paddingTop: 72, paddingBottom: 60 },
  eyebrow: { color: colors.saffron, fontSize: 10, fontWeight: "700", letterSpacing: .7, marginTop: 4 }, h1: { fontSize: 28, lineHeight: 34, fontWeight: "700", color: colors.ink, marginTop: 6 },
  sub: { color: colors.muted2, fontSize: 12, marginTop: 4 }, providerSummary: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.warmBorder, marginTop: 16 }, providerAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted }, providerName: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  steps: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", marginTop: 22, marginBottom: 28 }, step: { width: 64, alignItems: "center" }, stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }, stepNumberActive: { backgroundColor: colors.brandBrown }, stepNumberText: { color: colors.muted2, fontSize: 10, fontWeight: "700" }, stepLabel: { color: colors.muted2, fontSize: 9, marginTop: 5 }, stepLine: { width: 42, height: 1, backgroundColor: colors.warmBorder, marginTop: 14 }, successIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: colors.success, marginBottom: 20 },
  checkoutGrid: { flexDirection: "row", alignItems: "flex-start", gap: 24 },
  formPane: { flex: 1.45, minWidth: 0 },
  summaryPane: { flex: 0.9, minWidth: 340 },
  sectionTitle: { fontSize: font.sizes.sm, fontWeight: "700", color: colors.ink, marginTop: spacing.md, marginBottom: 8 },
  ceremonyList: { gap: 9, paddingBottom: 4 },
  ceremonyChip: { minWidth: 170, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white },
  ceremonyChipActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  ceremonyName: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  ceremonyNameActive: { color: colors.white },
  ceremonyPrice: { color: colors.muted2, fontSize: 10, fontWeight: "700", marginTop: 4 },
  dayChip: {
    width: 54, height: 60, borderRadius: radii.md, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.warmBorder, alignItems: "center", justifyContent: "center", marginRight: 8,
  },
  dayChipActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  dayChipDow: { fontSize: font.sizes.xs, color: colors.muted2 },
  dayChipNum: { fontSize: font.sizes.lg, fontWeight: "700", color: colors.ink },
  timeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder },
  timeChipActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  timeChipTxt: { fontSize: font.sizes.sm, color: colors.ink, fontWeight: "600" },
  input: {
    minHeight: 50, borderRadius: radii.sm, backgroundColor: colors.muted,
    borderWidth: 0, paddingHorizontal: spacing.lg,
    fontSize: font.sizes.base, color: colors.ink,
  },
  paymentCard: { marginTop: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.warmBorder, ...shadow.card },
  paymentTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  qrMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFF1EB", alignItems: "center", justifyContent: "center" },
  paymentTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  paymentSub: { color: colors.muted2, fontSize: 11, lineHeight: 16, marginTop: 3 },
  secureLine: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.muted, flexDirection: "row", alignItems: "center", gap: 9 },
  secureText: { flex: 1, color: colors.muted2, fontSize: 10, lineHeight: 15, fontWeight: "600" },
  upiText: { color: colors.ink, fontSize: 12, fontWeight: "800", padding: 12, borderRadius: 12, backgroundColor: colors.muted, marginTop: 14 },
  upload: { marginTop: 12, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.warmBorder, borderBottomWidth: 3, borderBottomColor: "#D8D5CF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  uploadPressed: { transform: [{ translateY: 2 }, { scale: .99 }], borderBottomWidth: 1 },
  uploadText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  stickyBar: {
    position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg,
    backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.warmBorder,
    ...(Platform.OS === "ios" && { paddingBottom: 24 }),
  },
  ceremonyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FDF9F2",
    borderWidth: 1,
    borderColor: "#EFE3CD",
    marginTop: 8,
    marginBottom: 6,
  },
  noticeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F5EAD4",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
  },
  noticeBody: {
    color: colors.muted2,
    fontSize: 12,
    lineHeight: 17,
  },
  noticeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.brandBrown,
  },
  noticeBtnText: {
    color: colors.brandBrown,
    fontSize: 11,
    fontWeight: "700",
  },
});
