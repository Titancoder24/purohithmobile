import React, { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { LocateFixed, Navigation, ShieldCheck, Square } from "lucide-react-native";
import { colors, radii, spacing } from "../../lib/theme";
import { Button } from "../../components/UI";
import MapplsMap from "../../components/MapplsMap";
import MapplsDrawer from "../../components/MapplsDrawer";
import { pushBookingLocation, setTrackingConsent } from "../../lib/payments";

export default function ShareLocation({ route, navigation }) {
  const { booking } = route.params || {};
  const watcher = useRef(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState(null);
  const [message, setMessage] = useState("Both you and the customer must consent before sharing begins.");
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => () => watcher.current?.remove(), []);
  const start = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") return Alert.alert("Location permission required", "Allow location access while travelling to the booking.");
    try {
      const data = await setTrackingConsent(booking.id, true);
      if (data.tracking_status !== "active") setMessage("Consent saved. Waiting for the customer to enable tracking.");
      watcher.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 20 }, async (next) => {
        setPosition(next.coords);
        try {
          await pushBookingLocation(booking.id, { latitude: next.coords.latitude, longitude: next.coords.longitude, accuracy_meters: next.coords.accuracy, heading_degrees: next.coords.heading });
          setActive(true); setMessage("Live location is being shared for this booking.");
        } catch (error) {
          if (/both participants|tracking/i.test(error?.message || "")) setMessage("Waiting for the customer to enable tracking.");
        }
      });
    } catch (error) { Alert.alert("Unable to start", error?.message || "Please try again."); }
  };
  const stop = async () => {
    watcher.current?.remove(); watcher.current = null; setActive(false);
    try { await setTrackingConsent(booking.id, false); } catch (_) { /* Best effort. */ }
    navigation.goBack();
  };
  const latitude = position?.latitude || 12.9716;
  const longitude = position?.longitude || 77.5946;
  return <View style={styles.root}>
    <View style={styles.body}>
      <Text style={styles.eyebrow}>TRIP TO BOOKING</Text><Text style={styles.title}>Share arrival location</Text><Text style={styles.subtitle}>{booking?.customer_name} · {booking?.pooja_name}</Text>
      <Pressable onPress={() => setMapOpen(true)} style={styles.map}><MapplsMap latitude={latitude} longitude={longitude} title="Your live location" address={booking?.address} /></Pressable>
      <View style={styles.status}><Navigation size={19} color={active ? colors.success : colors.muted2} /><View style={{ flex: 1 }}><Text style={styles.statusTitle}>{active ? "Sharing live location" : "Not sharing yet"}</Text><Text style={styles.statusText}>{message}</Text></View></View>
      <View style={styles.privacy}><ShieldCheck size={17} color={colors.success} /><Text style={styles.privacyText}>Sharing is limited to this customer and stops when you end it or complete the booking.</Text></View>
    </View>
    <MapplsDrawer visible={mapOpen} onClose={() => setMapOpen(false)} location={{ latitude, longitude, address: booking?.address, title: "Your live location" }} />
    <View style={styles.footer}>{active ? <Button title="Stop sharing" icon={Square} variant="outline" onPress={stop} /> : <Button title="Start sharing" icon={LocateFixed} onPress={start} />}</View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white }, body: { flex: 1, padding: 20 },
  eyebrow: { fontSize: 10, color: colors.saffron, fontWeight: "700", letterSpacing: .7 }, title: { fontSize: 30, lineHeight: 36, color: colors.ink, fontWeight: "700", marginTop: 5 }, subtitle: { color: colors.muted2, fontSize: 13, marginTop: 6, marginBottom: 20 },
  map: { borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.warmBorder },
  status: { flexDirection: "row", gap: 11, alignItems: "center", paddingVertical: 19, borderBottomWidth: 1, borderColor: colors.warmBorder }, statusTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" }, statusText: { color: colors.muted2, fontSize: 10, lineHeight: 15, marginTop: 3 },
  privacy: { flexDirection: "row", gap: 9, marginTop: 18, padding: 15, borderRadius: radii.lg, backgroundColor: "#EEF8F2" }, privacyText: { flex: 1, color: colors.muted2, fontSize: 11, lineHeight: 16 },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderColor: colors.warmBorder },
});
