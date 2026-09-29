import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MapPin, Navigation, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "../lib/theme";
import MapplsMap from "./MapplsMap";
import { normalizeLocation, openInMappls, openInMapplsDirections } from "../lib/maps";

export default function MapplsDrawer({ visible, onClose, location }) {
  const insets = useSafeAreaInsets();
  const point = normalizeLocation(location);
  const title = point.title || point.pooja_name || "Ceremony location";
  const address = point.address || "Service address";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.pin}><MapPin size={18} color={colors.saffron} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>MAPPLS LOCATION</Text>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>
            <Pressable accessibilityLabel="Close map drawer" onPress={onClose} style={styles.close}><X size={18} color={colors.ink} /></Pressable>
          </View>
          <View style={styles.mapWrap}>
            <MapplsMap latitude={point.latitude} longitude={point.longitude} title={title} address={address} style={styles.map} />
          </View>
          <View style={styles.detail}>
            <Text style={styles.address}>{address}</Text>
            {point.landmark ? <Text style={styles.meta}>{point.landmark}</Text> : null}
            <Text style={styles.meta}>{point.hasCoordinates ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : "Coordinates pending"}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => openInMappls(point)} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Navigation size={16} color={colors.white} />
              <Text style={styles.primaryText}>Open in Mappls</Text>
            </Pressable>
            <Pressable onPress={() => openInMapplsDirections(point)} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>Mappls Directions</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.48)" },
  sheet: { width: "100%", maxWidth: 760, alignSelf: "center", maxHeight: "90%", paddingHorizontal: spacing.lg, paddingTop: 12, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.white },
  handle: { width: 44, height: 4, borderRadius: 2, alignSelf: "center", backgroundColor: "#DED8CE", marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12 },
  pin: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1EB" },
  kicker: { color: colors.saffron, fontSize: 9, fontWeight: "800", letterSpacing: .8 },
  title: { color: colors.ink, fontSize: 17, fontWeight: "800", marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted },
  mapWrap: { height: 240, overflow: "hidden", borderRadius: radii.lg, borderWidth: 1, borderColor: colors.warmBorder },
  map: { height: "100%", width: "100%" },
  detail: { paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.warmBorder },
  address: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  meta: { color: colors.muted2, fontSize: 11, lineHeight: 16, marginTop: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: 14 },
  primary: { flex: 1, minWidth: 140, minHeight: 48, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brandBrown, borderBottomWidth: 3, borderBottomColor: colors.brandBrownDark },
  primaryText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  secondary: { flex: 1, minWidth: 140, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.warmBorder },
  secondaryText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  pressed: { transform: [{ translateY: 2 }, { scale: .99 }], opacity: .88 },
});
