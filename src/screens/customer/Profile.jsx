import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Bell, ChevronRight, CircleHelp, Languages, LogOut, MapPin, ShieldCheck, Smartphone, Star, UserRound, WalletCards, BriefcaseBusiness, CalendarDays, Phone, X } from "lucide-react-native";
import { colors, font } from "../../lib/theme";
import { Avatar, PageHeader } from "../../components/ProductUI";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { usePreferences } from "../../lib/preferences";

export default function Profile({ navigation }) {
  const { t } = useI18n();
  const { user, logout, updateProfile } = useAuth();
  const { language, area, notificationsEnabled } = usePreferences();
  const { width } = useWindowDimensions();
  const [loggingOut, setLoggingOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [phoneInput, setPhoneInput] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);

  if (!user) return null;
  const priest = user.role === "priest";
  const desktop = width >= 860;

  const openEdit = () => {
    setNameInput(user?.name || "");
    setPhoneInput(user?.phone || "");
    setEditing(true);
  };

  const handleSave = async () => {
    const cleanPhone = phoneInput.replace(/\D/g, "").slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return Alert.alert("Invalid Phone Number", "Please enter a valid 10-digit mobile number.");
    }
    setSaving(true);
    try {
      await updateProfile({ name: nameInput.trim() || user.name, phone: cleanPhone });
      setEditing(false);
      Alert.alert("Profile Updated", "Your mobile number has been saved for bookings and Cashfree checkout.");
    } catch (err) {
      Alert.alert("Update Failed", err?.message || "Could not save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    { icon: Smartphone, title: "Mobile number", value: user.phone ? `+91 ${user.phone}` : "Add number", onPress: openEdit },
    { icon: Languages, title: "Language", value: language === "kn" ? "Kannada" : "English", onPress: () => navigation.navigate("Settings", { section: "language" }) },
    { icon: MapPin, title: "Service location", value: `${area.name}, Bengaluru`, onPress: () => navigation.navigate("Settings", { section: "location" }) },
    { icon: Bell, title: "Notifications", value: notificationsEnabled ? "On" : "Off", onPress: () => navigation.navigate("Settings", { section: "notifications" }) },
    { icon: Smartphone, title: "Signed-in devices", value: "View", onPress: () => navigation.navigate("Settings", { section: "devices" }) },
    { icon: CircleHelp, title: "Help and support", value: "", onPress: () => navigation.navigate("Settings", { section: "support" }) },
  ];

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>
        <PageHeader eyebrow={priest ? "YOUR PRACTICE" : "YOUR ACCOUNT"} title="Profile" subtitle={priest ? "Manage how families discover and book your services." : "Trips, preferences, payments, and account protection."} />
        
        <View style={[styles.profilePanel, desktop && styles.profilePanelDesktop]}>
          <Avatar name={user.name || "P"} size={desktop ? 92 : 78} verified />
          <View style={styles.identity}>
            <View style={styles.identityLine}>
              <Text style={styles.name}>{user.name || (priest ? "Purohit" : "Customer")}</Text>
              <ShieldCheck size={18} color={colors.saffron} />
            </View>
            <Text style={[styles.phone, !user.phone && styles.phoneMissing]}>
              {user.phone ? `+91 ${user.phone}` : "No phone number added"}
            </Text>
            <Text style={styles.member}>{priest ? "Verified priest account" : "Purohith Connect member"}</Text>
          </View>
          {priest ? (
            <Pressable onPress={() => navigation.navigate("PriestOnboarding")} style={styles.editButton}>
              <Text style={styles.editText}>Edit profile</Text>
            </Pressable>
          ) : (
            <Pressable onPress={openEdit} style={[styles.editButton, !user.phone && styles.addPhoneBtn]}>
              <Text style={[styles.editText, !user.phone && styles.addPhoneBtnText]}>
                {user.phone ? "Edit profile" : "+ Add phone"}
              </Text>
            </Pressable>
          )}
        </View>

        {!user.phone && !priest ? (
          <Pressable onPress={openEdit} style={({ pressed }) => [styles.missingPhoneBanner, pressed && styles.pressed]}>
            <View style={styles.missingPhoneIconWrap}>
              <Phone size={18} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.missingPhoneTitle}>Add verified mobile number</Text>
              <Text style={styles.missingPhoneBody}>
                Required for Cashfree payment checkout and ceremony coordination.
              </Text>
            </View>
            <View style={styles.missingPhoneAction}>
              <Text style={styles.missingPhoneActionText}>Add</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.metrics}>
          {priest ? (
            <>
              <Metric icon={Star} value="4.9" label="Rating" />
              <Metric icon={BriefcaseBusiness} value="28" label="Ceremonies" />
              <Metric icon={WalletCards} value="₹42K" label="Earned" />
            </>
          ) : (
            <>
              <Metric icon={CalendarDays} value="3" label="Bookings" />
              <Metric icon={Star} value="2" label="Reviews" />
              <Metric icon={ShieldCheck} value="100%" label="Protected" />
            </>
          )}
        </View>

        {priest ? (
          <Pressable onPress={() => navigation.navigate("PriestOnboarding")} style={({ pressed }) => [styles.practiceBanner, pressed && styles.pressed]}>
            <View style={styles.practiceIcon}><UserRound size={21} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.practiceEyebrow}>PUBLIC LISTING</Text>
              <Text style={styles.practiceTitle}>Complete your professional profile</Text>
              <Text style={styles.practiceBody}>Specialties, languages, service areas, photos, and verification.</Text>
            </View>
            <ChevronRight size={19} color={colors.white} />
          </Pressable>
        ) : (
          <View style={styles.protection}>
            <ShieldCheck size={20} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.protectionTitle}>Your bookings are protected</Text>
              <Text style={styles.protectionBody}>Verified purohits, secure sessions, and support for every ceremony.</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Account settings</Text>
        <View style={styles.settings}>
          {rows.map((row) => (
            <SettingRow key={row.title} {...row} />
          ))}
        </View>

        <Pressable disabled={loggingOut} onPress={async () => { setLoggingOut(true); await logout(); }} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
          {loggingOut ? <ActivityIndicator color={colors.brandBrown} /> : <LogOut size={18} color={colors.brandBrown} />}
          <Text style={styles.logoutText}>{loggingOut ? "Signing out..." : t.logout}</Text>
        </Pressable>
        <Text style={styles.footer}>Purohith Connect · Bengaluru</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={() => setEditing(false)} hitSlop={12} style={styles.closeBtn}>
                <X size={20} color={colors.ink} />
              </Pressable>
            </View>
            <Text style={styles.modalSub}>
              Enter your 10-digit mobile number for Cashfree payment sessions and ceremony updates.
            </Text>

            <Text style={styles.inputLabel}>Full name</Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              placeholderTextColor={colors.muted2}
              style={styles.modalInput}
            />

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Mobile number *</Text>
            <TextInput
              value={phoneInput}
              onChangeText={setPhoneInput}
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.muted2}
              style={styles.modalInput}
            />

            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditing(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={handleSave} style={styles.saveBtn}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Metric({ icon: Icon, value, label }) {
  return (
    <View style={styles.metric}>
      <Icon size={17} color={colors.ink} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SettingRow({ icon: Icon, title, value, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}>
      <Icon size={19} color={colors.ink} />
      <Text style={styles.settingTitle}>{title}</Text>
      {value ? <Text style={styles.settingValue}>{value}</Text> : null}
      <ChevronRight size={18} color="#999995" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 20, paddingBottom: 56 },
  contentDesktop: { paddingHorizontal: 42, paddingTop: 20 },
  profilePanel: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.warmBorder },
  profilePanelDesktop: { paddingVertical: 26 },
  identity: { flex: 1, minWidth: 0 },
  identityLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  name: { color: colors.ink, fontFamily: font.bold, fontSize: 23, lineHeight: 29 },
  phone: { color: colors.muted2, fontSize: 12, marginTop: 4 },
  phoneMissing: { color: colors.brandBrown, fontFamily: font.medium },
  member: { color: colors.saffronDark, fontFamily: font.semibold, fontSize: 11, marginTop: 7 },
  editButton: { minHeight: 38, justifyContent: "center", paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, borderColor: colors.brandBrown },
  addPhoneBtn: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  editText: { color: colors.ink, fontFamily: font.semibold, fontSize: 12 },
  addPhoneBtnText: { color: colors.white, fontFamily: font.semibold, fontSize: 12 },
  missingPhoneBanner: {
    marginTop: 14,
    minHeight: 64,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FCF3EE",
    borderWidth: 1,
    borderColor: "#F0D3C3",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  missingPhoneIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.brandBrown,
    alignItems: "center",
    justifyContent: "center",
  },
  missingPhoneTitle: { color: colors.brandBrown, fontFamily: font.bold, fontSize: 13 },
  missingPhoneBody: { color: colors.muted2, fontSize: 11, lineHeight: 15, marginTop: 2 },
  missingPhoneAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.brandBrown,
  },
  missingPhoneActionText: { color: colors.white, fontFamily: font.bold, fontSize: 11 },
  metrics: { flexDirection: "row", borderBottomWidth: 1, borderColor: colors.warmBorder, marginTop: 14 },
  metric: { flex: 1, minHeight: 104, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderColor: colors.warmBorder },
  metricValue: { color: colors.ink, fontFamily: font.bold, fontSize: 20, marginTop: 8 },
  metricLabel: { color: colors.muted2, fontSize: 10, marginTop: 3 },
  practiceBanner: { marginTop: 28, minHeight: 116, padding: 18, borderRadius: 14, backgroundColor: colors.brandBrown, flexDirection: "row", alignItems: "center", gap: 13 },
  practiceIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.brandOrange, alignItems: "center", justifyContent: "center" },
  practiceEyebrow: { color: "#F3CDD4", fontFamily: font.bold, fontSize: 9 },
  practiceTitle: { color: colors.white, fontFamily: font.bold, fontSize: 15, marginTop: 5 },
  practiceBody: { color: "#F4DDE1", fontSize: 10, lineHeight: 15, marginTop: 4 },
  protection: { marginTop: 28, minHeight: 84, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F0F7F3", borderRadius: 12 },
  protectionTitle: { color: colors.ink, fontFamily: font.semibold, fontSize: 13 },
  protectionBody: { color: colors.muted2, fontSize: 10, lineHeight: 15, marginTop: 3 },
  sectionTitle: { color: colors.ink, fontFamily: font.bold, fontSize: 18, marginTop: 32, marginBottom: 10 },
  settings: { borderTopWidth: 1, borderColor: colors.warmBorder },
  settingRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 13, borderBottomWidth: 1, borderColor: colors.warmBorder, paddingHorizontal: 2 },
  settingTitle: { flex: 1, color: colors.ink, fontFamily: font.medium, fontSize: 14 },
  settingValue: { color: colors.muted2, fontSize: 11 },
  rowPressed: { backgroundColor: colors.muted },
  logout: { minHeight: 54, marginTop: 24, flexDirection: "row", alignItems: "center", gap: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.warmBorder },
  logoutText: { color: colors.brandBrown, fontFamily: font.semibold, fontSize: 14 },
  pressed: { opacity: 0.75 },
  footer: { color: colors.muted2, fontSize: 10, textAlign: "center", marginTop: 24 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: { color: colors.ink, fontFamily: font.bold, fontSize: 18 },
  modalSub: { color: colors.muted2, fontSize: 12, lineHeight: 17, marginBottom: 18 },
  closeBtn: { padding: 4 },
  inputLabel: { color: colors.ink, fontFamily: font.semibold, fontSize: 12, marginBottom: 6 },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.warmBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: "#FAF8F6",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.warmBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { color: colors.ink, fontFamily: font.semibold, fontSize: 13 },
  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.brandBrown,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { color: colors.white, fontFamily: font.bold, fontSize: 13 },
});
