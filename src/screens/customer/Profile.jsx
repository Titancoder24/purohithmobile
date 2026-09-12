import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Bell, ChevronRight, CircleHelp, Languages, LogOut, MapPin, ShieldCheck, Smartphone, Star, UserRound, WalletCards, BriefcaseBusiness, CalendarDays } from "lucide-react-native";
import { colors, font } from "../../lib/theme";
import { Avatar, PageHeader } from "../../components/ProductUI";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { usePreferences } from "../../lib/preferences";

export default function Profile({ navigation }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const { language, area, notificationsEnabled } = usePreferences();
  const { width } = useWindowDimensions();
  const [loggingOut, setLoggingOut] = useState(false);
  if (!user) return null;
  const priest = user.role === "priest";
  const desktop = width >= 860;
  const rows = [
    { icon: Languages, title: "Language", value: language === "kn" ? "Kannada" : "English", section: "language" },
    { icon: MapPin, title: "Service location", value: `${area.name}, Bengaluru`, section: "location" },
    { icon: Bell, title: "Notifications", value: notificationsEnabled ? "On" : "Off", section: "notifications" },
    { icon: Smartphone, title: "Signed-in devices", value: "View", section: "devices" },
    { icon: CircleHelp, title: "Help and support", value: "", section: "support" },
  ];

  return <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>
    <PageHeader eyebrow={priest ? "YOUR PRACTICE" : "YOUR ACCOUNT"} title="Profile" subtitle={priest ? "Manage how families discover and book your services." : "Trips, preferences, payments, and account protection."} />
    <View style={[styles.profilePanel, desktop && styles.profilePanelDesktop]}>
      <Avatar name={user.name || "P"} size={desktop ? 92 : 78} verified />
      <View style={styles.identity}><View style={styles.identityLine}><Text style={styles.name}>{user.name || (priest ? "Purohit" : "Customer")}</Text><ShieldCheck size={18} color={colors.saffron} /></View><Text style={styles.phone}>{user.phone}</Text><Text style={styles.member}>{priest ? "Verified priest account" : "Purohith Connect member"}</Text></View>
      {priest ? <Pressable onPress={() => navigation.navigate("PriestOnboarding")} style={styles.editButton}><Text style={styles.editText}>Edit profile</Text></Pressable> : null}
    </View>

    <View style={styles.metrics}>{priest ? <><Metric icon={Star} value="4.9" label="Rating" /><Metric icon={BriefcaseBusiness} value="28" label="Ceremonies" /><Metric icon={WalletCards} value="₹42K" label="Earned" /></> : <><Metric icon={CalendarDays} value="3" label="Bookings" /><Metric icon={Star} value="2" label="Reviews" /><Metric icon={ShieldCheck} value="100%" label="Protected" /></>}</View>

    {priest ? <Pressable onPress={() => navigation.navigate("PriestOnboarding")} style={({ pressed }) => [styles.practiceBanner, pressed && styles.pressed]}><View style={styles.practiceIcon}><UserRound size={21} color={colors.white} /></View><View style={{ flex: 1 }}><Text style={styles.practiceEyebrow}>PUBLIC LISTING</Text><Text style={styles.practiceTitle}>Complete your professional profile</Text><Text style={styles.practiceBody}>Specialties, languages, service areas, photos, and verification.</Text></View><ChevronRight size={19} color={colors.white} /></Pressable> : <View style={styles.protection}><ShieldCheck size={20} color={colors.success} /><View style={{ flex: 1 }}><Text style={styles.protectionTitle}>Your bookings are protected</Text><Text style={styles.protectionBody}>Verified purohits, secure sessions, and support for every ceremony.</Text></View></View>}

    <Text style={styles.sectionTitle}>Account settings</Text>
    <View style={styles.settings}>{rows.map((row) => <SettingRow key={row.title} {...row} onPress={() => navigation.navigate("Settings", { section: row.section })} />)}</View>
    <Pressable disabled={loggingOut} onPress={async () => { setLoggingOut(true); await logout(); }} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>{loggingOut ? <ActivityIndicator color={colors.brandBrown} /> : <LogOut size={18} color={colors.brandBrown} />}<Text style={styles.logoutText}>{loggingOut ? "Signing out..." : t.logout}</Text></Pressable>
    <Text style={styles.footer}>Purohith Connect · Bengaluru</Text>
  </ScrollView>;
}

function Metric({ icon: Icon, value, label }) { return <View style={styles.metric}><Icon size={17} color={colors.ink} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function SettingRow({ icon: Icon, title, value, onPress }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}><Icon size={19} color={colors.ink} /><Text style={styles.settingTitle}>{title}</Text>{value ? <Text style={styles.settingValue}>{value}</Text> : null}<ChevronRight size={18} color="#999995" /></Pressable>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white }, content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 20, paddingBottom: 56 }, contentDesktop: { paddingHorizontal: 42, paddingTop: 20 },
  profilePanel: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.warmBorder }, profilePanelDesktop: { paddingVertical: 26 }, identity: { flex: 1, minWidth: 0 }, identityLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  name: { color: colors.ink, fontFamily: font.bold, fontSize: 23, lineHeight: 29 }, phone: { color: colors.muted2, fontSize: 12, marginTop: 4 }, member: { color: colors.saffronDark, fontFamily: font.semibold, fontSize: 11, marginTop: 7 }, editButton: { minHeight: 38, justifyContent: "center", paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, borderColor: colors.brandBrown }, editText: { color: colors.ink, fontFamily: font.semibold, fontSize: 12 },
  metrics: { flexDirection: "row", borderBottomWidth: 1, borderColor: colors.warmBorder }, metric: { flex: 1, minHeight: 104, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderColor: colors.warmBorder }, metricValue: { color: colors.ink, fontFamily: font.bold, fontSize: 20, marginTop: 8 }, metricLabel: { color: colors.muted2, fontSize: 10, marginTop: 3 },
  practiceBanner: { marginTop: 28, minHeight: 116, padding: 18, borderRadius: 14, backgroundColor: colors.brandBrown, flexDirection: "row", alignItems: "center", gap: 13 }, practiceIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.brandOrange, alignItems: "center", justifyContent: "center" }, practiceEyebrow: { color: "#F3CDD4", fontFamily: font.bold, fontSize: 9 }, practiceTitle: { color: colors.white, fontFamily: font.bold, fontSize: 15, marginTop: 5 }, practiceBody: { color: "#F4DDE1", fontSize: 10, lineHeight: 15, marginTop: 4 },
  protection: { marginTop: 28, minHeight: 84, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F0F7F3", borderRadius: 12 }, protectionTitle: { color: colors.ink, fontFamily: font.semibold, fontSize: 13 }, protectionBody: { color: colors.muted2, fontSize: 10, lineHeight: 15, marginTop: 3 },
  sectionTitle: { color: colors.ink, fontFamily: font.bold, fontSize: 18, marginTop: 32, marginBottom: 10 }, settings: { borderTopWidth: 1, borderColor: colors.warmBorder }, settingRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 13, borderBottomWidth: 1, borderColor: colors.warmBorder, paddingHorizontal: 2 }, settingTitle: { flex: 1, color: colors.ink, fontFamily: font.medium, fontSize: 14 }, settingValue: { color: colors.muted2, fontSize: 11 }, rowPressed: { backgroundColor: colors.muted },
  logout: { minHeight: 54, marginTop: 24, flexDirection: "row", alignItems: "center", gap: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.warmBorder }, logoutText: { color: colors.brandBrown, fontFamily: font.semibold, fontSize: 14 }, pressed: { opacity: .7 }, footer: { color: colors.muted2, fontSize: 10, textAlign: "center", marginTop: 24 },
});
