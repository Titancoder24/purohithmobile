import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { BadgeIndianRupee, BriefcaseBusiness, Camera, Check, FileBadge2, Phone, UserRound } from "lucide-react-native";
import { colors, font, radii } from "../../lib/theme";
import { Button, Field } from "../../components/UI";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import BANGALORE_AREAS from "../../data/bangalore-areas.json";

const LANGUAGES = ["English", "Kannada", "Sanskrit", "Hindi", "Tamil", "Telugu", "Marathi", "Malayalam"];
const AREAS = BANGALORE_AREAS.map((area) => area.name);
const POOJAS = [
  ["gauri-ganesha-vratha", "Gauri and Ganesha Vrata"],
  ["rudrabhishek", "Rudra Abhishek"],
  ["satyanarayan", "Satyanarayana Puja"],
  ["griha-pravesh", "Griha Pravesh Puja"],
  ["ayudha-puja", "Ayudha Puja"],
  ["navagraha-shanti", "Navagraha Shanti"],
  ["varamahalakshmi-vratha", "Varamahalakshmi Vrata"],
  ["namakarna", "Namakarana"],
  ["vivaha", "Vivaha"],
];

const digits = (value, length = 7) => value.replace(/[^0-9]/g, "").slice(0, length);

export default function PriestOnboarding() {
  const { user, completeOnboarding } = useAuth();
  const desktop = useWindowDimensions().width >= 760;
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [langs, setLangs] = useState(new Set(["English"]));
  const [areas, setAreas] = useState(new Set());
  const [poojas, setPoojas] = useState(new Set());
  const [photoUrl, setPhotoUrl] = useState("");
  const [idDocPath, setIdDocPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");

  const completion = useMemo(() => {
    const checks = [name, phone.length >= 10, bio, experience, hourlyRate, langs.size, areas.size, poojas.size, photoUrl, idDocPath];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [areas.size, bio, experience, hourlyRate, idDocPath, langs.size, name, phone.length, photoUrl, poojas.size]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !user?.id || user.demo) return setLoading(false);
      const [profileResult, userResult] = await Promise.all([
        supabase.from("priest_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("app_users").select("full_name,phone").eq("id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (profileResult.error) Alert.alert("Profile unavailable", profileResult.error.message);
      const data = profileResult.data;
      setProfile(data || null);
      setName(data?.display_name || userResult.data?.full_name || user.name || "");
      setPhone(userResult.data?.phone || user.phone || "");
      setBio(data?.bio || "");
      setExperience(data?.years_experience == null ? "" : String(data.years_experience));
      setHourlyRate(data?.hourly_rate_inr ? String(data.hourly_rate_inr) : "");
      setStartingPrice(data?.starting_price_inr ? String(data.starting_price_inr) : "");
      setMaxPrice(data?.max_price_inr ? String(data.max_price_inr) : "");
      setLangs(new Set(data?.languages?.length ? data.languages : ["English"]));
      setAreas(new Set(data?.service_areas || []));
      setPoojas(new Set(data?.pooja_slugs || []));
      setPhotoUrl(data?.photo_url || "");
      setIdDocPath(data?.id_document_url || "");
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [user]);

  const toggle = (value, setter) => setter((current) => {
    const next = new Set(current);
    next.has(value) ? next.delete(value) : next.add(value);
    return next;
  });

  const uploadAsset = async (kind) => {
    if (!supabase || !user?.id || user.demo) return Alert.alert("Demo account", "Create a priest account to upload verification documents.");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Photo access needed", "Allow photo access to upload your profile image and ID proof.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: kind === "photo" ? [1, 1] : [4, 3], quality: 0.78 });
    if (result.canceled) return;
    setUploading(kind);
    try {
      const asset = result.assets[0];
      const mime = asset.mimeType || "image/jpeg";
      const extension = mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      const path = `${user.id}/${kind}-${Date.now()}.${extension}`;
      let body;
      if (Platform.OS === "web") body = await (await fetch(asset.uri)).arrayBuffer();
      else body = decode(await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 }));
      const bucket = kind === "photo" ? "priest-portfolio" : "priest-kyc";
      const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: mime, upsert: true });
      if (error) throw error;
      if (kind === "photo") setPhotoUrl(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl);
      else setIdDocPath(path);
    } catch (error) {
      Alert.alert("Upload failed", error?.message || "Please try another image.");
    } finally { setUploading(""); }
  };

  const save = async () => {
    const experienceValue = Number(experience);
    const hourlyValue = Number(hourlyRate);
    const startingValue = Number(startingPrice || hourlyRate);
    const maxValue = Number(maxPrice || startingValue);
    if (name.trim().length < 2) return Alert.alert("Name required", "Enter your full display name.");
    if (phone.length < 10) return Alert.alert("Phone required", "Enter a valid 10-digit phone number.");
    if (bio.trim().length < 30) return Alert.alert("Tell families more", "Add at least 30 characters about your practice and experience.");
    if (!Number.isFinite(experienceValue) || experienceValue < 0) return Alert.alert("Experience required", "Enter your years of experience.");
    if (!Number.isFinite(hourlyValue) || hourlyValue <= 0) return Alert.alert("Hourly charge required", "Enter your standard hourly charge.");
    if (langs.size === 0 || areas.size === 0 || poojas.size === 0) return Alert.alert("Practice details required", "Choose at least one language, service area, and puja specialty.");
    if (maxValue < startingValue) return Alert.alert("Check your pricing", "Maximum ceremony fee cannot be lower than the starting fee.");
    setSaving(true);
    try {
      if (user.demo) return Alert.alert("Demo profile complete", "Create a real priest account to submit this profile for verification.");
      if (!supabase) throw new Error("Supabase is not configured.");
      const now = new Date().toISOString();
      const { error: userError } = await supabase.from("app_users").update({ full_name: name.trim(), phone, updated_at: now }).eq("id", user.id);
      if (userError) throw userError;
      const { error: profileError } = await supabase.from("priest_profiles").upsert({
        user_id: user.id,
        display_name: name.trim(),
        bio: bio.trim(),
        years_experience: experienceValue,
        hourly_rate_inr: hourlyValue,
        starting_price_inr: startingValue,
        max_price_inr: maxValue,
        languages: Array.from(langs),
        service_areas: Array.from(areas),
        primary_service_area: Array.from(areas)[0],
        pooja_slugs: Array.from(poojas),
        photo_url: photoUrl || null,
        id_document_url: idDocPath || null,
        onboarding_step: 3,
        submitted_at: now,
        updated_at: now,
      }, { onConflict: "user_id" });
      if (profileError) throw profileError;
      await completeOnboarding();
      Alert.alert("Profile submitted", "Your profile is saved and has been sent for verification.");
    } catch (error) {
      console.error(`Priest onboarding save failed: ${error?.message || String(error)}`);
      Alert.alert("Could not save profile", error?.message || "Please try again.");
    } finally { setSaving(false); }
  };

  return <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.kicker}>PRIEST ONBOARDING</Text><Text style={styles.h1}>{profile ? "Update your professional profile" : "Create your professional profile"}</Text><Text style={styles.sub}>Families use these details to discover, compare, and book your services.</Text></View><View style={styles.completion}><Text style={styles.completionValue}>{completion}%</Text><Text style={styles.completionLabel}>complete</Text></View></View>
    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${completion}%` }]} /></View>

    <Section icon={UserRound} title="Identity" subtitle="Your public name and verified contact details">
      <View style={styles.photoRow}>{photoUrl ? <Image source={{ uri: photoUrl }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><UserRound size={30} color={colors.brandBrown} /></View>}<View style={styles.photoCopy}><Text style={styles.itemTitle}>Professional photo</Text><Text style={styles.hint}>Use a clear, recent portrait without filters.</Text><Button title={uploading === "photo" ? "Uploading..." : photoUrl ? "Change photo" : "Upload photo"} onPress={() => uploadAsset("photo")} disabled={Boolean(uploading)} variant="outline" style={styles.inlineButton} icon={Camera} /></View></View>
      <View style={[styles.formGrid, desktop && styles.formGridDesktop]}><Field label="Full name"><Input testID="priest-name-input" icon={UserRound} value={name} onChangeText={setName} placeholder="Your full name" /></Field><Field label="Phone number"><Input testID="priest-phone-input" icon={Phone} keyboardType={Platform.OS === "web" ? "default" : "phone-pad"} value={phone} onChangeText={(value) => setPhone(digits(value, 10))} placeholder="10-digit mobile number" /></Field></View>
      <Field label="About your practice"><TextInput testID="bio-input" multiline value={bio} onChangeText={setBio} placeholder="Describe your Vedic training, traditions, and the families you serve." placeholderTextColor="#8A8582" style={[styles.input, styles.textArea]} /></Field>
    </Section>

    <Section icon={BriefcaseBusiness} title="Experience and services" subtitle="Help families understand your background and specialties">
      <View style={[styles.formGrid, desktop && styles.formGridDesktop]}><Field label="Years of experience"><Input testID="experience-input" icon={BriefcaseBusiness} keyboardType="number-pad" value={experience} onChangeText={(value) => setExperience(digits(value, 2))} placeholder="e.g. 12" /></Field><Field label="Standard hourly charge"><Input testID="hourly-rate-input" icon={BadgeIndianRupee} keyboardType="number-pad" value={hourlyRate} onChangeText={(value) => setHourlyRate(digits(value))} placeholder="e.g. 1200" /></Field><Field label="Starting ceremony fee"><Input testID="starting-price-input" icon={BadgeIndianRupee} keyboardType="number-pad" value={startingPrice} onChangeText={(value) => setStartingPrice(digits(value))} placeholder="e.g. 2500" /></Field><Field label="Maximum ceremony fee"><Input testID="max-price-input" icon={BadgeIndianRupee} keyboardType="number-pad" value={maxPrice} onChangeText={(value) => setMaxPrice(digits(value))} placeholder="e.g. 25000" /></Field></View>
      <ChoiceGroup title="Languages" values={LANGUAGES.map((item) => [item, item])} selected={langs} onToggle={(value) => toggle(value, setLangs)} prefix="lang" />
      <ChoiceGroup title="Puja specialties" values={POOJAS} selected={poojas} onToggle={(value) => toggle(value, setPoojas)} prefix="pooja" />
      <ChoiceGroup title="Service areas" values={AREAS.map((item) => [item, item])} selected={areas} onToggle={(value) => toggle(value, setAreas)} prefix="area" />
    </Section>

    <Section icon={FileBadge2} title="Verification" subtitle="Your document is private and visible only to the verification team">
      <View style={styles.documentRow}><View style={[styles.documentIcon, idDocPath && styles.documentIconDone]}>{idDocPath ? <Check size={22} color={colors.white} /> : <FileBadge2 size={22} color={colors.brandBrown} />}</View><View style={styles.documentCopy}><Text style={styles.itemTitle}>{idDocPath ? "Identity document uploaded" : "Upload Aadhaar or PAN"}</Text><Text style={styles.hint}>JPG or PNG up to 5 MB.</Text></View><Button title={uploading === "id" ? "Uploading..." : idDocPath ? "Replace" : "Upload"} onPress={() => uploadAsset("id")} disabled={Boolean(uploading)} variant="outline" /></View>
    </Section>

    <View style={styles.submitBar}><View style={styles.submitCopy}><Text style={styles.submitTitle}>Ready for review?</Text><Text style={styles.hint}>You can update your details later from Profile.</Text></View><Button testID="save-profile-btn" title={saving || loading ? "Saving..." : "Submit for verification"} onPress={save} disabled={saving || loading} /></View>
  </ScrollView>;
}

function Input({ icon: Icon, ...props }) {
  return <View style={styles.inputShell}>{Icon ? <Icon size={18} color={colors.brandBrown} /> : null}<TextInput placeholderTextColor="#8A8582" style={styles.inputBare} {...props} /></View>;
}

function Section({ icon: Icon, title, subtitle, children }) {
  return <View style={styles.section}><View style={styles.sectionHeader}><View style={styles.sectionIcon}><Icon size={20} color={colors.brandBrown} /></View><View style={{ flex: 1 }}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text></View></View>{children}</View>;
}

function ChoiceGroup({ title, values, selected, onToggle, prefix }) {
  return <View style={styles.choiceGroup}><Text style={styles.choiceTitle}>{title}</Text><View style={styles.chipRow}>{values.map(([value, label]) => <Pressable key={value} testID={`${prefix}-${value}`} onPress={() => onToggle(value)} style={({ pressed }) => [styles.chip, selected.has(value) && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipText, selected.has(value) && styles.chipTextActive]}>{label}</Text>{selected.has(value) ? <Check size={14} color={colors.white} /> : null}</Pressable>)}</View></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white }, content: { width: "100%", maxWidth: 980, alignSelf: "center", padding: 20, paddingBottom: 64 }, contentDesktop: { paddingHorizontal: 42, paddingTop: 32 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 18 }, headerCopy: { flex: 1, minWidth: 0 }, kicker: { color: colors.brandOrangeDark, fontFamily: font.bold, fontSize: 10, letterSpacing: .8 }, h1: { color: colors.ink, fontFamily: font.bold, fontSize: 30, lineHeight: 37, marginTop: 7 }, sub: { color: colors.muted2, fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 560 },
  completion: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTint, borderWidth: 1, borderColor: "#F3C9B0" }, completionValue: { color: colors.brandBrown, fontFamily: font.bold, fontSize: 18 }, completionLabel: { color: colors.muted2, fontSize: 9, marginTop: 2 }, progressTrack: { height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "#F0E5E2", marginTop: 22 }, progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.brandOrange },
  section: { marginTop: 28, paddingTop: 24, borderTopWidth: 1, borderColor: colors.warmBorder }, sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }, sectionIcon: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTint }, sectionTitle: { color: colors.ink, fontFamily: font.bold, fontSize: 18 }, sectionSubtitle: { color: colors.muted2, fontSize: 11, lineHeight: 16, marginTop: 3 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 }, avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.muted }, avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTint }, photoCopy: { flex: 1, minWidth: 0 }, itemTitle: { color: colors.ink, fontFamily: font.semibold, fontSize: 14 }, hint: { color: colors.muted2, fontSize: 10, lineHeight: 15, marginTop: 3 }, inlineButton: { alignSelf: "flex-start", marginTop: 10 },
  formGrid: { gap: 0 }, formGridDesktop: {}, inputShell: { minHeight: 54, flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: radii.md, backgroundColor: colors.muted, borderWidth: 1, borderColor: "transparent" }, inputBare: { flex: 1, minHeight: 52, color: colors.ink, fontSize: 14, paddingVertical: 0 }, input: { minHeight: 54, borderRadius: radii.md, backgroundColor: colors.muted, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontSize: 14, borderWidth: 1, borderColor: "transparent" }, textArea: { minHeight: 112, textAlignVertical: "top" },
  choiceGroup: { marginTop: 18 }, choiceTitle: { color: colors.ink, fontFamily: font.semibold, fontSize: 13, marginBottom: 9 }, chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder }, chipActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown }, chipText: { color: colors.ink, fontFamily: font.semibold, fontSize: 11 }, chipTextActive: { color: colors.white }, pressed: { opacity: .72 },
  documentRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: radii.md, backgroundColor: colors.muted }, documentIcon: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTint }, documentIconDone: { backgroundColor: colors.success }, documentCopy: { flex: 1, minWidth: 0 },
  submitBar: { marginTop: 30, paddingTop: 22, borderTopWidth: 1, borderColor: colors.warmBorder, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }, submitCopy: { flex: 1, minWidth: 0 }, submitTitle: { color: colors.ink, fontFamily: font.bold, fontSize: 15 },
});
