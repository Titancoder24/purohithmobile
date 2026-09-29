import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Clock3, LocateFixed, Navigation, ShieldCheck } from "lucide-react-native";
import { colors, radii } from "../../lib/theme";
import { Button } from "../../components/UI";
import MapplsMap from "../../components/MapplsMap";
import MapplsDrawer from "../../components/MapplsDrawer";
import { usePreferences } from "../../lib/preferences";
import { getBookingLocation, setTrackingConsent } from "../../lib/payments";

export default function TrackPriest({ route }) {
  const { booking } = route.params || {};
  const { area } = usePreferences();
  const [consented, setConsented] = useState(Boolean(booking?.customer_tracking_consent_at));
  const [trackingStatus, setTrackingStatus] = useState(booking?.tracking_status || "disabled");
  const [location, setLocation] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [mapOpen, setMapOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await getBookingLocation(booking.id);
      setTrackingStatus(data.tracking_status);
      if (data.location) {
        setLocation(data.location);
        setUpdatedAt(data.location.recorded_at || "");
      }
    } catch (_) { /* Retain the last known point during temporary network loss. */ }
  }, [booking?.id]);
  useEffect(() => {
    if (!booking?.id || !consented) return undefined;
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [booking?.id, consented, refresh]);

  const enable = async () => {
    try {
      const data = await setTrackingConsent(booking.id, true);
      setConsented(true);
      setTrackingStatus(data.tracking_status);
    } catch (error) {
      Alert.alert("Unable to enable tracking", error?.message || "Please try again.");
    }
  };
  const disable = async () => {
    try {
      const data = await setTrackingConsent(booking.id, false);
      setConsented(false);
      setTrackingStatus(data.tracking_status);
      setLocation(null);
      setUpdatedAt("");
    } catch (error) {
      Alert.alert("Unable to disable tracking", error?.message || "Please try again.");
    }
  };

  const latitude = Number(location?.latitude ?? area.latitude);
  const longitude = Number(location?.longitude ?? area.longitude);
  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>BOOKING ARRIVAL</Text>
    <Text style={styles.title}>Track your purohit</Text>
    <Text style={styles.subtitle}>{booking?.pooja_name} · {booking?.priest_name}</Text>

    <Pressable onPress={() => setMapOpen(true)} style={styles.mapWrap}><MapplsMap latitude={latitude} longitude={longitude} title="Live priest location" address={booking?.address || area.name} /><View style={styles.mapBadge}><Navigation size={14} color={colors.ink} /><Text style={styles.mapBadgeText}>{location ? "Live priest location" : area.name}</Text></View></Pressable>

    <View style={styles.statusCard}>
      <View style={styles.statusIcon}><LocateFixed size={20} color={trackingStatus === "active" ? colors.success : colors.muted2} /></View>
      <View style={{ flex: 1 }}><Text style={styles.statusTitle}>{trackingStatus === "active" ? "Purohit is sharing location" : consented ? "Waiting for purohit consent" : "Location sharing is off"}</Text><Text style={styles.statusMeta}>{updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : "Tracking starts only after both parties consent."}</Text></View>
    </View>

    {!consented ? <Button title="Enable arrival tracking" icon={LocateFixed} onPress={enable} /> : <Button title="Disable arrival tracking" variant="outline" onPress={disable} />}
    <View style={styles.privacy}><ShieldCheck size={17} color={colors.success} /><Text style={styles.privacyText}>Location is visible only for this confirmed booking and expires after the ceremony window.</Text></View>
    <View style={styles.help}><Clock3 size={17} color={colors.muted2} /><Text style={styles.helpText}>If the map has not updated recently, call the purohit from your booking details.</Text></View>
    <MapplsDrawer visible={mapOpen} onClose={() => setMapOpen(false)} location={{ latitude, longitude, address: booking?.address || area.name, title: "Live priest location" }} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white }, content: { padding: 20, paddingBottom: 40 },
  eyebrow: { fontSize: 10, color: colors.saffron, fontWeight: "700", letterSpacing: .7 }, title: { fontSize: 31, lineHeight: 37, color: colors.ink, fontWeight: "700", marginTop: 5 },
  subtitle: { color: colors.muted2, fontSize: 13, marginTop: 6, marginBottom: 20 },
  mapWrap: { position: "relative", borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.warmBorder },
  mapBadge: { position: "absolute", left: 12, bottom: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.white, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9, shadowColor: "#000", shadowOpacity: .1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  mapBadgeText: { fontSize: 10, color: colors.ink, fontWeight: "700" },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 18, marginVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.warmBorder },
  statusIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
  statusTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" }, statusMeta: { color: colors.muted2, fontSize: 10, lineHeight: 15, marginTop: 3 },
  privacy: { flexDirection: "row", gap: 9, paddingVertical: 16, marginTop: 10 }, privacyText: { flex: 1, color: colors.muted2, fontSize: 11, lineHeight: 16 },
  help: { flexDirection: "row", gap: 9, padding: 15, borderRadius: radii.lg, backgroundColor: colors.muted }, helpText: { flex: 1, color: colors.muted2, fontSize: 11, lineHeight: 16 },
});
