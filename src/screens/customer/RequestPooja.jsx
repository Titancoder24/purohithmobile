import React, { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import * as Location from "expo-location";
import { ChevronRight, LocateFixed, MapPin, Sparkles, WalletCards } from "lucide-react-native";
import { colors, radii, spacing } from "../../lib/theme";
import MapplsMap from "../../components/MapplsMap";
import MapplsDrawer from "../../components/MapplsDrawer";
import { useAuth } from "../../lib/auth";
import { createCeremonyRequest } from "../../lib/payments";

const CEREMONIES = [
  ["gauri-ganesha-vratha", "Gauri and Ganesha Vratha"], ["rudrabhishek", "Rudra Abhishek"],
  ["satyanarayan", "Satyanarayana Puja"], ["griha-pravesh", "Griha Pravesh Puja"],
  ["ayudha-puja", "Ayudha Puja"], ["navagraha-shanti", "Navagraha Shanti"],
  ["varamahalakshmi-vratha", "Varamahalakshmi Vratha"], ["namakarna", "Namakarna"], ["vivaha", "Vivaha"],
];

const dates = Array.from({ length: 8 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
const iso = (d) => d.toISOString().slice(0, 10);

const proposalParams = (request) => ({
  requestId: request.id,
  poojaName: request.pooja_name,
  ceremonyDate: request.ceremony_date,
  ceremonyTime: request.ceremony_time,
  address: request.address,
  landmark: request.landmark,
  lat: request.lat,
  lng: request.lng,
});

export default function RequestPooja({ navigation, route }) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [poojaSlug, setPoojaSlug] = useState(route.params?.poojaSlug || "gauri-ganesha-vratha");
  const [date, setDate] = useState(iso(dates[0]));
  const [time, setTime] = useState("09:00");
  const [address, setAddress] = useState(route.params?.area ? `${route.params.area}, Bengaluru` : "");
  const [landmark, setLandmark] = useState("");
  const [coords, setCoords] = useState(null);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const ceremony = useMemo(() => CEREMONIES.find(([slug]) => slug === poojaSlug), [poojaSlug]);
  const latitude = coords?.latitude || 12.9784;
  const longitude = coords?.longitude || 77.6408;

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") return Alert.alert("Location permission required", "Allow location access so purohits can see the exact ceremony area.");
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const nextCoords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setCoords(nextCoords);
      const places = await Location.reverseGeocodeAsync(nextCoords).catch(() => []);
      const place = places?.[0];
      if (place) {
        const parts = [place.name, place.street, place.district || place.subregion, place.city, place.region].filter(Boolean);
        setAddress((currentAddress) => currentAddress || parts.join(", "));
      }
    } catch (error) {
      Alert.alert("Could not read location", error?.message || "Please enter the street address manually.");
    } finally { setLocating(false); }
  };

  const submit = async () => {
    if (address.trim().length < 8) return Alert.alert("Add your service address", "Purohits need an area or address to prepare their proposal.");
    if (!user?.id || user?.demo) {
      return navigation.replace("RequestProposals", proposalParams({ id: "demo-request", pooja_name: ceremony?.[1], ceremony_date: date, ceremony_time: time, address, landmark, lat: coords?.latitude, lng: coords?.longitude }));
    }
    const payload = {
      customer_id: user.id,
      pooja_slug: poojaSlug,
      ceremony_date: date,
      ceremony_time: time,
      address: address.trim(),
      landmark: landmark.trim(),
      lat: coords?.latitude,
      lng: coords?.longitude,
      notes,
      budget_min: Number(budgetMin) || 0,
      budget_max: Number(budgetMax) || 0,
    };
    setBusy(true);
    try {
      const data = await createCeremonyRequest(payload);
      navigation.replace("RequestProposals", proposalParams(data.request));
    } catch (error) {
      Alert.alert("Could not post request", error?.message || "Try again in a moment.");
    } finally { setBusy(false); }
  };

  return <View style={styles.root}>
    <ScrollView contentContainerStyle={[styles.content, desktop && styles.contentDesktop]} keyboardShouldPersistTaps="handled">
      <View style={styles.intro}><View style={styles.mark}><Sparkles size={19} color={colors.saffron} /></View><View style={{ flex: 1 }}><Text style={styles.kicker}>REQUEST PROPOSALS</Text><Text style={styles.title}>Let the right purohits come to you.</Text><Text style={styles.sub}>Verified priests can respond with their price, availability, and a personal note.</Text></View></View>
      <View style={desktop ? styles.desktopGrid : undefined}>
      <View style={desktop ? styles.formColumn : undefined}>
      <Text style={styles.label}>Ceremony <Text style={styles.requiredStar}>*</Text></Text>
      <View style={styles.choices}>{CEREMONIES.map(([slug, name]) => <Pressable key={slug} onPress={() => setPoojaSlug(slug)} style={[styles.choice, poojaSlug === slug && styles.choiceActive]}><Text style={[styles.choiceText, poojaSlug === slug && styles.choiceTextActive]}>{name}</Text></Pressable>)}</View>
      <Text style={styles.label}>When <Text style={styles.requiredStar}>*</Text></Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateList}>{dates.map((item) => <Pressable key={iso(item)} onPress={() => setDate(iso(item))} style={[styles.date, date === iso(item) && styles.dateActive]}><Text style={[styles.dateDow, date === iso(item) && styles.dateTextActive]}>{item.toLocaleDateString("en-IN", { weekday: "short" })}</Text><Text style={[styles.dateNum, date === iso(item) && styles.dateTextActive]}>{item.getDate()}</Text></Pressable>)}</ScrollView>
      <View style={styles.timeRow}>{["06:00", "09:00", "16:00", "19:00"].map((slot) => <Pressable key={slot} onPress={() => setTime(slot)} style={[styles.time, time === slot && styles.timeActive]}><Text style={[styles.timeText, time === slot && { color: colors.white }]}>{slot}</Text></Pressable>)}</View>
      <Text style={styles.label}>Where <Text style={styles.requiredStar}>*</Text></Text>
      <Pressable onPress={() => setMapOpen(true)} style={styles.mapWrap}><MapplsMap latitude={latitude} longitude={longitude} title={ceremony?.[1]} address={address || "Bengaluru preview"} style={styles.map} /><View style={styles.mapBadge}><MapPin size={14} color={colors.ink} /><Text style={styles.mapBadgeText}>{coords ? "Exact ceremony pin" : "Bengaluru preview"}</Text></View></Pressable>
      <Pressable onPress={useCurrentLocation} disabled={locating} style={({ pressed }) => [styles.locationButton, pressed && styles.locationPressed]}>
        <LocateFixed size={18} color={colors.ink} /><Text style={styles.locationButtonText}>{locating ? "Reading location..." : "Use current location"}</Text>
      </Pressable>
      <View style={styles.field}><MapPin size={18} color={colors.saffron} /><TextInput value={address} onChangeText={setAddress} placeholder="Flat, street, area, Bengaluru" placeholderTextColor="#8D8A85" style={styles.input} /></View>
      <TextInput value={landmark} onChangeText={setLandmark} placeholder="Landmark, apartment, gate number" placeholderTextColor="#8D8A85" style={[styles.field, styles.fullInput]} />
      <Text style={styles.label}>Budget range <Text style={styles.optional}>optional</Text></Text>
      <View style={styles.budgetRow}>
        <TextInput value={budgetMin} onChangeText={(value) => setBudgetMin(value.replace(/[^0-9]/g, ""))} keyboardType="numeric" placeholder="Min ₹" placeholderTextColor="#8D8A85" style={[styles.field, styles.budgetInput]} />
        <TextInput value={budgetMax} onChangeText={(value) => setBudgetMax(value.replace(/[^0-9]/g, ""))} keyboardType="numeric" placeholder="Max ₹" placeholderTextColor="#8D8A85" style={[styles.field, styles.budgetInput]} />
      </View>
      <Text style={styles.label}>A note for purohits <Text style={styles.optional}>optional</Text></Text>
      <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Tell them about your family, ritual preferences, or samagri needs." placeholderTextColor="#8D8A85" style={[styles.field, styles.notes]} />
      <View style={styles.info}><WalletCards size={18} color={colors.saffron} /><Text style={styles.infoText}>No payment is required now. Compare verified proposals first, choose a purohit, then complete secure Cashfree checkout.</Text></View>
      </View>

      <View style={desktop ? styles.paymentColumn : undefined}>
      <View style={styles.paymentCard}>
        <View style={styles.paymentTop}><View style={styles.qrMark}><WalletCards size={22} color={colors.saffron} /></View><View style={{ flex: 1 }}><Text style={styles.paymentTitle}>No payment before bids</Text><Text style={styles.paymentSub}>Create the ceremony request now. Purohits will see your budget range and location, send proposals, and you pay only after choosing the final purohit.</Text></View></View>
        <View style={styles.reviewSteps}><Text style={styles.reviewStep}>1. Share ceremony, timing, address, and budget</Text><Text style={styles.reviewStep}>2. Eligible purohits submit their prices</Text><Text style={styles.reviewStep}>3. Choose one proposal, then pay securely with Cashfree</Text></View>
      </View>
      </View>
      </View>
    </ScrollView>
    <MapplsDrawer visible={mapOpen} onClose={() => setMapOpen(false)} location={{ latitude, longitude, address: address || "Bengaluru preview", landmark, title: ceremony?.[1] }} />
    <View style={styles.footer}><SubmitRequestButton busy={busy} onPress={submit} /></View>
  </View>;
}

function SubmitRequestButton({ busy, onPress }) {
  const title = busy ? "Processing..." : "Request proposals";
  if (Platform.OS === "web") {
    const activate = () => { if (!busy) onPress(); };
    return <div
      data-testid="request-proposals-submit"
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-label="Request proposals"
      aria-disabled={busy}
      onClick={activate}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } }}
      style={{
        minHeight: 52, width: "100%", border: 0, borderRadius: 12, background: colors.brandBrown,
        color: colors.white, display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
        cursor: busy ? "wait" : "pointer", fontSize: 16, fontWeight: 700,
        boxShadow: `0 4px 9px ${colors.brandBrownDark}33`,
      }}
    ><ChevronRight size={18} color={colors.white} /><span>{title}</span></div>;
  }
  return <Pressable
    testID="request-proposals-submit"
    accessibilityRole="button"
    accessibilityLabel="Request proposals"
    onPress={onPress}
    disabled={busy}
    style={({ pressed }) => [styles.submitButton, (pressed || busy) && styles.submitButtonPressed]}
  ><ChevronRight size={18} color={colors.white} /><Text style={styles.submitButtonText}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white }, content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 20, paddingBottom: 130 }, contentDesktop: { maxWidth: 1160, paddingHorizontal: 34, paddingTop: 28 }, desktopGrid: { flexDirection: "row", alignItems: "flex-start", gap: 24 }, formColumn: { flex: 1.45, minWidth: 0 }, paymentColumn: { flex: .9, minWidth: 340 }, intro: { flexDirection: "row", gap: 14, paddingVertical: 10, paddingBottom: 24, borderBottomWidth: 1, borderColor: colors.warmBorder, marginBottom: 4 }, mark: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFF1EB", alignItems: "center", justifyContent: "center" }, kicker: { color: colors.saffron, fontSize: 10, fontWeight: "700", letterSpacing: .8 }, title: { fontSize: 25, lineHeight: 30, fontWeight: "700", color: colors.ink, marginTop: 5 }, sub: { fontSize: 12, lineHeight: 18, color: colors.muted2, marginTop: 6 }, label: { marginTop: 25, marginBottom: 10, fontSize: 14, fontWeight: "700", color: colors.ink }, optional: { color: colors.muted2, fontSize: 10, fontWeight: "500" }, requiredStar: { color: colors.danger, fontWeight: "700" }, choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { paddingHorizontal: 13, minHeight: 38, justifyContent: "center", borderRadius: 19, borderWidth: 1, borderColor: colors.warmBorder }, choiceActive: { borderColor: colors.brandBrown, backgroundColor: colors.brandBrown }, choiceText: { fontSize: 11, fontWeight: "600", color: colors.ink }, choiceTextActive: { color: colors.white }, dateList: { gap: 8 }, date: { width: 58, height: 64, borderRadius: 14, borderWidth: 1, borderColor: colors.warmBorder, alignItems: "center", justifyContent: "center" }, dateActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown }, dateDow: { fontSize: 10, color: colors.muted2, fontWeight: "600" }, dateNum: { marginTop: 3, fontSize: 19, color: colors.ink, fontWeight: "700" }, dateTextActive: { color: colors.white }, timeRow: { flexDirection: "row", gap: 7, marginTop: 11 }, time: { flex: 1, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.warmBorder, alignItems: "center", justifyContent: "center" }, timeActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown }, timeText: { color: colors.ink, fontSize: 11, fontWeight: "600" }, mapWrap: { height: 210, overflow: "hidden", borderRadius: radii.lg, borderWidth: 1, borderColor: colors.warmBorder, marginBottom: 10 }, map: { minHeight: 210 }, mapBadge: { position: "absolute", left: 12, bottom: 12, flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: colors.white, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, shadowColor: "#000", shadowOpacity: .08, shadowRadius: 7, shadowOffset: { width: 0, height: 3 } }, mapBadgeText: { color: colors.ink, fontSize: 10, fontWeight: "700" }, locationButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10, borderBottomWidth: 3, borderBottomColor: "#D8D5CF" }, locationPressed: { transform: [{ translateY: 2 }, { scale: .99 }], borderBottomWidth: 1 }, locationButtonText: { color: colors.ink, fontSize: 13, fontWeight: "700" }, field: { minHeight: 54, borderWidth: 1, borderColor: colors.warmBorder, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: colors.muted }, input: { flex: 1, fontSize: 14, color: colors.ink }, fullInput: { color: colors.ink, fontSize: 14, marginTop: 10 }, budgetRow: { flexDirection: "row", gap: 10 }, budgetInput: { flex: 1, color: colors.ink, fontSize: 14 }, notes: { minHeight: 96, alignItems: "flex-start", paddingTop: 13, fontSize: 13, lineHeight: 18 }, info: { marginTop: 22, flexDirection: "row", gap: 10, padding: 15, backgroundColor: "#FFF1EB", borderRadius: 14 }, infoText: { flex: 1, color: colors.muted2, fontSize: 11, lineHeight: 16 }, paymentCard: { marginTop: 22, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white, shadowColor: "#000", shadowOpacity: .07, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, paymentTop: { flexDirection: "row", gap: 12, alignItems: "center" }, qrMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFF1EB", alignItems: "center", justifyContent: "center" }, paymentTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" }, paymentSub: { color: colors.muted2, fontSize: 11, lineHeight: 16, marginTop: 3 }, paymentLabel: { color: colors.muted2, fontSize: 10, fontWeight: "800", marginTop: 16, marginBottom: 6, textTransform: "uppercase" }, upiText: { color: colors.ink, fontSize: 13, fontWeight: "800", padding: 12, borderRadius: 12, backgroundColor: colors.muted }, paymentInput: { minHeight: 48, borderRadius: 12, backgroundColor: colors.muted, color: colors.ink, fontSize: 14, paddingHorizontal: 14 }, upload: { marginTop: 12, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.warmBorder, borderBottomWidth: 3, borderBottomColor: "#D8D5CF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, uploadText: { color: colors.ink, fontSize: 13, fontWeight: "800" }, invoiceButton: { marginTop: 12, minHeight: 48, borderRadius: 14, backgroundColor: colors.brandBrown, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, invoiceText: { color: colors.white, fontSize: 13, fontWeight: "800" }, aiNote: { color: colors.muted2, fontSize: 11, lineHeight: 16, marginTop: 12 }, reviewSteps: { marginTop: 16, gap: 8 }, reviewStep: { color: colors.ink, fontSize: 12, fontWeight: "700", padding: 10, borderRadius: 12, backgroundColor: colors.muted }, footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, borderTopWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white }, submitButton: { minHeight: 52, borderRadius: radii.md, backgroundColor: colors.brandBrown, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, shadowColor: colors.brandBrownDark, shadowOpacity: .2, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, submitButtonPressed: { opacity: .86, transform: [{ translateY: 1 }, { scale: .995 }] }, submitButtonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
});
