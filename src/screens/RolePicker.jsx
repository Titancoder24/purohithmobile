import React from "react";
import { View, Text, StyleSheet, Pressable, SafeAreaView, Image, useWindowDimensions } from "react-native";
import { ArrowRight, House, BookOpen, Sparkles, ShieldCheck } from "lucide-react-native";
import { colors, radii, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { spiritualTap } from "../lib/spiritualSounds";
import BrandLogo from "../components/BrandLogo";

export default function RolePicker() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const { t } = useI18n();
  const { setRole } = useAuth();
  const pick = async (role) => {
    spiritualTap();
    await setRole(role);
  };

  const controls = <View style={styles.controls}>
    <View style={styles.chooseRow}><Text style={styles.choose}>{t.chooseRole}</Text><Text style={styles.step}>1 of 2</Text></View>
    <RoleButton testID="role-customer" Icon={House} title={t.roleCustomer} subtitle={t.roleCustomerSub} onPress={() => pick("customer")} primary />
    <RoleButton testID="role-priest" Icon={BookOpen} title={t.rolePriest} subtitle={t.rolePriestSub} onPress={() => pick("priest")} />
    <View style={styles.trust}><ShieldCheck size={15} color={colors.success}/><Text style={styles.trustText}>Secure accounts powered by Supabase</Text></View>
  </View>;

  const hero = <View style={[styles.hero, desktop && styles.heroDesktop]}>
    <Image source={require("../../assets/images/ritual-home-hero.png")} style={styles.heroImage} />
    <View style={styles.heroShade} />
    <View style={styles.heroCopy}>
      <View style={styles.verified}><Sparkles size={14} color={colors.white} /><Text style={styles.verifiedText}>THE TRUSTED WAY TO BEGIN</Text></View>
      <Text style={[styles.heroTitle, desktop && styles.heroTitleDesktop]}>Your shubh karya,{"\n"}handled with care.</Text>
    </View>
  </View>;

  return <SafeAreaView style={styles.root}>
    <View style={[styles.shell, desktop && styles.shellDesktop]}>
      <View style={[styles.content, desktop && styles.contentDesktop]}>
        <View style={styles.brandRow}><BrandLogo width={desktop ? 250 : 210} height={desktop ? 110 : 96} showText={false} /></View>
        {!desktop && hero}
        {controls}
        <Text style={styles.legal}>By continuing, you agree to our Terms and Privacy Policy.</Text>
      </View>
      {desktop && hero}
    </View>
  </SafeAreaView>;
}

function RoleButton({ Icon, title, subtitle, onPress, primary, testID }) {
  return <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.role, primary && styles.rolePrimary, pressed && styles.rolePressed]}>
    <View style={[styles.roleIcon, primary && styles.roleIconPrimary]}><Icon size={21} color={primary ? colors.white : colors.ink} /></View>
    <View style={{ flex: 1 }}><Text style={[styles.roleTitle, primary && { color: colors.white }]}>{title}</Text><Text numberOfLines={2} style={[styles.roleSub, primary && { color: "#F5DACE" }]}>{subtitle}</Text></View>
    <ArrowRight size={19} color={primary ? colors.white : colors.ink} />
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cotton },
  shell: { flex: 1, width: "100%", maxWidth: 1260, alignSelf: "center" },
  shellDesktop: { flexDirection: "row", alignItems: "stretch", padding: 28, gap: 28 },
  content: { flex: 1, backgroundColor: colors.white, paddingHorizontal: spacing.xl, paddingTop: 12 },
  contentDesktop: { maxWidth: 500, paddingHorizontal: 42, paddingVertical: 30, borderRadius: radii.xl, justifyContent: "center", shadowColor: "#4D2014", shadowOpacity: .08, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  brandRow: { minHeight: 96, flexDirection: "row", alignItems: "center" },
  hero: { height: 290, marginTop: 12, borderRadius: radii.xl, overflow: "hidden", backgroundColor: colors.muted },
  heroDesktop: { flex: 1, height: "auto", minHeight: 650, marginTop: 0, borderRadius: radii.xl },
  heroImage: { width: "100%", height: "100%", resizeMode: "cover" },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(30,12,7,.34)" },
  heroCopy: { position: "absolute", left: 24, right: 24, bottom: 24 },
  verified: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, height: 29, paddingHorizontal: 10, borderRadius: 15, backgroundColor: "rgba(65,24,14,.78)" },
  verifiedText: { color: colors.white, fontSize: 9, fontWeight: "700", letterSpacing: .5 },
  heroTitle: { color: colors.white, fontSize: 31, lineHeight: 37, fontWeight: "700", marginTop: 11 },
  heroTitleDesktop: { fontSize: 48, lineHeight: 55 },
  controls: { marginTop: 8 },
  chooseRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 10 },
  choose: { fontSize: 19, color: colors.ink, fontWeight: "700" },
  step: { fontSize: 11, color: colors.muted2 },
  role: { minHeight: 78, borderWidth: 1, borderColor: colors.warmBorder, borderRadius: radii.lg, backgroundColor: colors.white, padding: 14, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 11, shadowColor: "#4D2014", shadowOpacity: .06, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  rolePrimary: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown, shadowOpacity: .18 },
  rolePressed: { transform: [{ translateY: 2 }], shadowOpacity: 0 },
  roleIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
  roleIconPrimary: { backgroundColor: colors.brandOrangeDark },
  roleTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  roleSub: { color: colors.muted2, fontSize: 11, lineHeight: 15, marginTop: 3 },
  trust: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 },
  trustText: { color: colors.muted2, fontSize: 10 },
  legal: { color: colors.muted2, fontSize: 9, textAlign: "center", marginTop: "auto", paddingVertical: 16 },
});
