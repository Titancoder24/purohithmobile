import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, ChevronDown, MapPin, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors, spacing } from "../lib/theme";
import { usePreferences } from "../lib/preferences";
import { useAuth } from "../lib/auth";
import BrandLogo from "./BrandLogo";

export default function AppTopBar({ showLocation = true }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { language, area, setArea, areas } = usePreferences();
  const [open, setOpen] = useState(false);

  const isPriest = user?.role === "priest";
  const topInset = Math.max(insets.top, 12);

  return <>
    <View style={[styles.wrapper, { paddingTop: topInset }]}>
      <View style={styles.bar}>
        <View style={styles.sideSlotLeft}>
          <Pressable
            accessibilityLabel="Purohith Connect Home"
            onPress={() => navigation.navigate(isPriest ? "Dashboard" : "Home")}
            style={styles.brandWrap}
          >
            <BrandLogo size={34} showText={false} />
          </Pressable>
        </View>
        {showLocation ? (
          <Pressable style={styles.centerLocation} onPress={() => setOpen(true)}>
            <View style={styles.pinTile}><MapPin size={13} color={colors.saffron} /></View>
            <View style={styles.locationCopy}>
              <Text style={styles.label}>{isPriest ? "SERVING AREA" : "SERVICE LOCATION"}</Text>
              <Text numberOfLines={1} style={styles.value}>{area.name}</Text>
            </View>
            <ChevronDown size={13} color={colors.muted2} />
          </Pressable>
        ) : <View style={{ flex: 1 }} />}
        <View style={styles.sideSlotRight}>
          <Pressable accessibilityLabel="Language settings" onPress={() => navigation.navigate("Settings", { section: "language" })} style={styles.language}>
            <Text style={styles.languageText}>{language === "kn" ? "KN" : "EN"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissArea} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Select service area</Text>
              <Text style={styles.sheetSub}>Bengaluru</Text>
            </View>
            <Pressable style={styles.close} onPress={() => setOpen(false)}>
              <X size={18} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.areaList}
          >
            {areas.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.areaRow, pressed && styles.areaRowPressed]}
                onPress={async () => {
                  await setArea(item);
                  setOpen(false);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.areaName}>{item.name}</Text>
                  <Text style={styles.areaMeta}>Purohits serving within the local radius</Text>
                </View>
                {area.id === item.id ? <Check size={19} color={colors.success} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  wrapper: { width: "100%", backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.warmBorder },
  bar: { width: "100%", maxWidth: 1180, height: 54, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  sideSlotLeft: { minWidth: 44, alignItems: "flex-start", justifyContent: "center" },
  sideSlotRight: { minWidth: 44, alignItems: "flex-end", justifyContent: "center" },
  brandWrap: { alignItems: "center", justifyContent: "center" },
  centerLocation: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6 },
  locationCopy: { alignItems: "center", justifyContent: "center" },
  pinTile: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#FFF2EC", alignItems: "center", justifyContent: "center" },
  label: { fontSize: 8, color: colors.muted2, fontWeight: "600", letterSpacing: .5, textAlign: "center" },
  value: { fontSize: 13, color: colors.ink, fontWeight: "700", marginTop: 1, textAlign: "center" },
  language: { width: 36, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTint, borderWidth: 1, borderColor: "#E8C2CA" },
  languageText: { color: colors.brandBrown, fontSize: 10, fontWeight: "800" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.45)" },
  dismissArea: { flex: 1 },
  sheet: { maxHeight: "80%", backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing.lg },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 18, borderBottomWidth: 1, borderColor: colors.warmBorder },
  sheetTitle: { fontSize: 21, color: colors.ink, fontWeight: "700" },
  sheetSub: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  close: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.warmBorder, borderRadius: 18, backgroundColor: colors.muted },
  areaList: { paddingBottom: 24 },
  areaRow: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.warmBorder },
  areaRowPressed: { opacity: 0.7, backgroundColor: "#F9F8F6" },
  areaName: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  areaMeta: { color: colors.muted2, fontSize: 11, marginTop: 2 },
});
