import React from "react";
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { MapPin, Navigation, X } from "lucide-react-native";
import { colors, radii, spacing } from "../lib/theme";
import OpenStreetMap from "./OpenStreetMap";
import { normalizeLocation, openInGoogleMaps, openInMappls } from "../lib/maps";

export default function MapplsDrawer({ visible, onClose, location }) {
  const point = normalizeLocation(location);
  const title = point.title || point.pooja_name || "Ceremony location";
  const address = point.address || "Service address";
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.pin}><MapPin size={18} color={colors.saffron} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>MAPPLS LOCATION</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
            <Pressable accessibilityLabel="Close map drawer" onPress={onClose} style={styles.close}><X size={18} color={colors.ink} /></Pressable>
          </View>
          <View style={styles.mapWrap}>
            <OpenStreetMap latitude={point.latitude} longitude={point.longitude} title={title} address={address} style={styles.map} />
          </View>
          <View style={styles.detail}>
            <Text style={styles.address}>{address}</Text>
            {point.landmark ? <Text style={styles.meta}>{point.landmark}</Text> : null}
            <Text style={styles.meta}>{point.hasCoordinates ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : "Coordinates pending"}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => openInMappls(point)} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Navigation size={16} color={colors.white} />
              <Text style={styles.primaryText}>Open Mappls</Text>
            </Pressable>
            <Pressable onPress={() => openInGoogleMaps(point)} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>Open fallback map</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.42)" },
  sheet: { width: "100%", maxWidth: 760, alignSelf: "center", maxHeight: "88%", paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: spacing.lg, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.white },
  handle: { width: 48, height: 5, borderRadius: 3, alignSelf: "center", backgroundColor: "#DED8CE", marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 14 },
  pin: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1EB" },
  kicker: { color: colors.saffron, fontSize: 9, fontWeight: "800", letterSpacing: .8 },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800", marginTop: 3 },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted },
  mapWrap: { height: 330, overflow: "hidden", borderRadius: radii.lg, borderWidth: 1, borderColor: colors.warmBorder },
  map: { minHeight: 330 },
  detail: { paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.warmBorder },
  address: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  meta: { color: colors.muted2, fontSize: 11, lineHeight: 17, marginTop: 3 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: 14 },
  primary: { flex: 1, minWidth: 150, minHeight: 50, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brandBrown, borderBottomWidth: 3, borderBottomColor: colors.brandBrownDark },
  primaryText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  secondary: { flex: 1, minWidth: 150, minHeight: 50, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.warmBorder },
  secondaryText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  pressed: { transform: [{ translateY: 2 }, { scale: .99 }], opacity: .88 },
});
