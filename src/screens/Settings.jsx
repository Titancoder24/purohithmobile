import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as Device from "expo-device";
import { Bell, Check, ChevronRight, CircleHelp, Crosshair, Globe2, Laptop, LocateFixed, LogOut, Mail, MapPin, MessageCircleQuestion, ShieldCheck, Smartphone } from "lucide-react-native";
import { colors, font } from "../lib/theme";
import { usePreferences } from "../lib/preferences";
import { registerForPush } from "../lib/notifications";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

export default function Settings({ route, navigation }) {
  const section = route.params?.section || "location";
  const titles = { location: "Service location", notifications: "Notifications", devices: "Signed-in devices", support: "Help and support", language: "Language" };
  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>ACCOUNT SETTINGS</Text>
    <Text style={styles.title}>{titles[section]}</Text>
    {section === "location" ? <LocationSettings /> : null}
    {section === "notifications" ? <NotificationSettings /> : null}
    {section === "devices" ? <DeviceSettings /> : null}
    {section === "support" ? <SupportSettings navigation={navigation} /> : null}
    {section === "language" ? <LanguageSettings /> : null}
  </ScrollView>;
}

function LocationSettings() {
  const { area, areas, setArea, detectedLocation, locating, locate } = usePreferences();
  const [error, setError] = useState("");
  const detect = async (source) => {
    setError("");
    try { await locate(source); } catch (reason) { setError(reason?.message || "Could not detect your location"); }
  };
  return <>
    <View style={styles.summary}>
      <View style={styles.summaryIcon}><MapPin size={23} color={colors.white} /></View>
      <View style={{ flex: 1 }}><Text style={styles.summaryLabel}>CURRENT SERVICE AREA</Text><Text style={styles.summaryTitle}>{area.name}, Bengaluru</Text><Text style={styles.summaryBody}>{detectedLocation ? `${detectedLocation.city}, ${detectedLocation.region}${detectedLocation.postalCode ? ` · ${detectedLocation.postalCode}` : ""}` : "Choose automatic detection or select an area below."}</Text></View>
    </View>
    <View style={styles.actionPair}>
      <ActionButton icon={Globe2} title="Detect by IP" loading={locating} onPress={() => detect("ip")} />
      <ActionButton icon={LocateFixed} title="Use precise GPS" loading={locating} onPress={() => detect("gps")} secondary />
    </View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Text style={styles.sectionTitle}>Bengaluru service areas</Text>
    <View style={styles.list}>{areas.map((item) => <Pressable key={item.id} onPress={() => setArea(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.rowIcon}><Crosshair size={17} color={colors.ink} /></View><Text style={styles.rowTitle}>{item.name}</Text>{area.id === item.id ? <Check size={19} color={colors.brandOrangeDark} /> : <ChevronRight size={17} color={colors.muted2} />}</Pressable>)}</View>
  </>;
}

function NotificationSettings() {
  const { notificationsEnabled, setNotificationsEnabled } = usePreferences();
  const [busy, setBusy] = useState(false);
  const update = async (next) => {
    setBusy(true);
    try {
      if (next) {
        const token = await registerForPush();
        if (Platform.OS !== "web" && !token) throw new Error("Notification permission was not granted");
      }
      await setNotificationsEnabled(next);
    } catch (reason) { Alert.alert("Notifications", reason?.message || "Could not update notifications"); }
    finally { setBusy(false); }
  };
  return <>
    <View style={styles.summary}><View style={styles.summaryIcon}><Bell size={23} color={colors.white} /></View><View style={{ flex: 1 }}><Text style={styles.summaryLabel}>BOOKING UPDATES</Text><Text style={styles.summaryTitle}>{notificationsEnabled ? "Notifications are on" : "Notifications are off"}</Text><Text style={styles.summaryBody}>Proposal, payment, chat, and priest-arrival updates.</Text></View>{busy ? <ActivityIndicator color={colors.brandOrange} /> : <Switch value={notificationsEnabled} onValueChange={update} trackColor={{ false: "#D6D4D0", true: "#E6A177" }} thumbColor={notificationsEnabled ? colors.brandOrangeDark : "#FFFFFF"} />}</View>
    <Text style={styles.sectionTitle}>What you will receive</Text>
    <InfoRow icon={ShieldCheck} title="Booking status" body="Confirmation, payment verification, and ceremony updates." />
    <InfoRow icon={Bell} title="New activity" body="Proposals, messages, and schedule reminders." />
  </>;
}

function DeviceSettings() {
  const { user, logout } = useAuth();
  const [lastSignIn, setLastSignIn] = useState("");
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setLastSignIn(data?.user?.last_sign_in_at || ""));
  }, []);
  const deviceName = Platform.OS === "web" ? "Web browser" : Device.deviceName || `${Platform.OS} device`;
  const signOutEverywhere = async () => {
    try { await supabase?.auth.signOut({ scope: "global" }); } finally { await logout(); }
  };
  return <>
    <View style={styles.deviceCard}><View style={styles.deviceIcon}>{Platform.OS === "web" ? <Laptop size={23} color={colors.ink} /> : <Smartphone size={23} color={colors.ink} />}</View><View style={{ flex: 1 }}><View style={styles.currentRow}><Text style={styles.deviceTitle}>{deviceName}</Text><Text style={styles.current}>THIS DEVICE</Text></View><Text style={styles.deviceBody}>{user?.email || user?.phone || "Authenticated account"}</Text><Text style={styles.deviceMeta}>{lastSignIn ? `Last sign-in ${new Date(lastSignIn).toLocaleString()}` : "Current secure session"}</Text></View></View>
    <Pressable onPress={signOutEverywhere} style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}><LogOut size={18} color={colors.brandBrown} /><Text style={styles.dangerText}>Sign out on all devices</Text></Pressable>
  </>;
}

function SupportSettings({ navigation }) {
  const faqs = useMemo(() => [
    ["How are Purohits verified?", "Profiles are reviewed for identity, experience, service categories, and submitted documents."],
    ["How do proposals work?", "Share your ceremony details once, compare responses, and select the Purohit you prefer."],
    ["Where can I see my booking?", "Open Bookings from the navigation bar to view its status, payment, chat, and arrival details."],
  ], []);
  const [open, setOpen] = useState(0);
  return <>
    <View style={styles.contactGrid}>
      <Pressable onPress={() => Linking.openURL("mailto:support@purohithconnect.com?subject=Purohith%20Connect%20support")} style={({ pressed }) => [styles.contactCard, pressed && styles.pressed]}><Mail size={22} color={colors.brandOrangeDark} /><Text style={styles.contactTitle}>Email support</Text><Text style={styles.contactBody}>support@purohithconnect.com</Text></Pressable>
      <Pressable onPress={() => navigation.navigate("Tabs", { screen: "Chat" })} style={({ pressed }) => [styles.contactCard, pressed && styles.pressed]}><MessageCircleQuestion size={22} color={colors.brandOrangeDark} /><Text style={styles.contactTitle}>Ask PuroMitra</Text><Text style={styles.contactBody}>Get guided help inside the app.</Text></Pressable>
    </View>
    <Text style={styles.sectionTitle}>Frequently asked questions</Text>
    <View style={styles.list}>{faqs.map(([question, answer], index) => <Pressable key={question} onPress={() => setOpen(open === index ? -1 : index)} style={styles.faq}><View style={styles.faqHead}><CircleHelp size={18} color={colors.ink} /><Text style={styles.rowTitle}>{question}</Text><ChevronRight size={17} color={colors.muted2} style={{ transform: [{ rotate: open === index ? "90deg" : "0deg" }] }} /></View>{open === index ? <Text style={styles.faqBody}>{answer}</Text> : null}</Pressable>)}</View>
  </>;
}

function LanguageSettings() {
  const { language, setLanguage } = usePreferences();
  return (
    <>
      <Text style={styles.lede}>Choose the language used across booking and priest workspaces.</Text>
      <View style={styles.list}>
        {[["en", "English", "English"], ["kn", "Kannada", "ಕನ್ನಡ"]].map(([value, title, native]) => (
          <Pressable key={value} onPress={() => setLanguage(value)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.rowIcon}><Globe2 size={18} color={colors.ink} /></View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitleText}>{title}</Text>
              <Text style={styles.rowBodyText}>{native}</Text>
            </View>
            {language === value ? <Check size={20} color={colors.brandOrangeDark} /> : null}
          </Pressable>
        ))}
      </View>
    </>
  );
}

function ActionButton({ icon: Icon, title, onPress, loading, secondary }) { return <Pressable disabled={loading} onPress={onPress} style={({ pressed }) => [styles.actionButton, secondary && styles.actionButtonSecondary, pressed && styles.pressed]}>{loading ? <ActivityIndicator color={secondary ? colors.brandBrown : colors.white} /> : <Icon size={17} color={secondary ? colors.brandBrown : colors.white} />}<Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{title}</Text></Pressable>; }
function InfoRow({ icon: Icon, title, body }) { return <View style={styles.infoRow}><View style={styles.rowIcon}><Icon size={17} color={colors.ink} /></View><View style={styles.rowTextCol}><Text style={styles.rowTitleText}>{title}</Text><Text style={styles.rowBodyText}>{body}</Text></View></View>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white }, content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 22, paddingBottom: 64 },
  eyebrow: { color: colors.brandOrangeDark, fontFamily: font.bold, fontSize: 10, letterSpacing: .7 }, title: { color: colors.ink, fontFamily: font.bold, fontSize: 30, lineHeight: 37, marginTop: 7, marginBottom: 20 }, lede: { color: colors.muted2, fontSize: 13, lineHeight: 20, marginBottom: 18 },
  summary: { minHeight: 116, borderRadius: 14, padding: 17, backgroundColor: colors.brandBrown, flexDirection: "row", alignItems: "center", gap: 13 }, summaryIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.brandOrange, alignItems: "center", justifyContent: "center" }, summaryLabel: { color: "#F1CDD4", fontFamily: font.bold, fontSize: 9, letterSpacing: .5 }, summaryTitle: { color: colors.white, fontFamily: font.bold, fontSize: 17, marginTop: 4 }, summaryBody: { color: "#F4DCE1", fontSize: 10, lineHeight: 15, marginTop: 4 },
  actionPair: { flexDirection: "row", gap: 10, marginTop: 12 }, actionButton: { flex: 1, minHeight: 48, borderRadius: 10, backgroundColor: colors.brandOrangeDark, borderBottomWidth: 3, borderBottomColor: "#A83C08", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, actionButtonSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: "#D9ADB6", borderBottomWidth: 3, borderBottomColor: "#D9ADB6" }, actionText: { color: colors.white, fontFamily: font.bold, fontSize: 12 }, actionTextSecondary: { color: colors.brandBrown },
  sectionTitle: { color: colors.ink, fontFamily: font.bold, fontSize: 18, marginTop: 28, marginBottom: 10 }, list: { borderTopWidth: 1, borderColor: colors.warmBorder },
  row: { minHeight: 64, borderBottomWidth: 1, borderColor: colors.warmBorder, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
  rowTextCol: { flex: 1, justifyContent: "center" },
  rowTitleText: { color: colors.ink, fontFamily: font.semibold, fontSize: 14, lineHeight: 19 },
  rowBodyText: { color: colors.muted2, fontSize: 11, lineHeight: 16, marginTop: 2 },
  rowTitle: { color: colors.ink, fontFamily: font.semibold, fontSize: 13 },
  rowBody: { color: colors.muted2, fontSize: 10, lineHeight: 15, marginTop: 3 },
  infoRow: { minHeight: 76, borderBottomWidth: 1, borderColor: colors.warmBorder, flexDirection: "row", alignItems: "center", gap: 12 }, error: { color: colors.brandBrown, fontSize: 11, marginTop: 10 }, pressed: { opacity: .76, transform: [{ translateY: 1 }] },
  deviceCard: { minHeight: 112, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.warmBorder, flexDirection: "row", alignItems: "center", gap: 14 }, deviceIcon: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }, currentRow: { flexDirection: "row", alignItems: "center", gap: 8 }, deviceTitle: { color: colors.ink, fontFamily: font.bold, fontSize: 15 }, current: { color: colors.success, fontFamily: font.bold, fontSize: 8 }, deviceBody: { color: colors.muted2, fontSize: 11, marginTop: 5 }, deviceMeta: { color: colors.muted2, fontSize: 9, marginTop: 5 }, dangerButton: { minHeight: 54, marginTop: 22, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.warmBorder, flexDirection: "row", alignItems: "center", gap: 10 }, dangerText: { color: colors.brandBrown, fontFamily: font.semibold, fontSize: 13 },
  contactGrid: { flexDirection: "row", gap: 10 }, contactCard: { flex: 1, minHeight: 128, borderWidth: 1, borderColor: colors.warmBorder, borderRadius: 12, padding: 15, justifyContent: "center" }, contactTitle: { color: colors.ink, fontFamily: font.bold, fontSize: 13, marginTop: 12 }, contactBody: { color: colors.muted2, fontSize: 10, lineHeight: 15, marginTop: 4 }, faq: { borderBottomWidth: 1, borderColor: colors.warmBorder, paddingVertical: 15 }, faqHead: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 10 }, faqBody: { color: colors.muted2, fontSize: 11, lineHeight: 18, paddingLeft: 28, paddingTop: 8 },
});
