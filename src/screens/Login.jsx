import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { ArrowLeft, Mail, UserRound, ShieldCheck, KeyRound } from "lucide-react-native";
import { colors, radii, spacing, font } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { Button, Field } from "../components/UI";
import { PrimaryButton } from "../components/ProductUI";
import { tokens } from "../lib/api";
import { useAuth } from "../lib/auth";
import { registerForPush } from "../lib/notifications";
import BrandLogo from "../components/BrandLogo";
import { authRedirectUrl, isSupabaseConfigured, supabase } from "../lib/supabase";

const OTP_LENGTH = 8;

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

export default function Login() {
  const { t } = useI18n();
  const { role, resetRole, restoreWithBiometric, applySupabaseSession } = useAuth();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState("signIn");
  const [stage, setStage] = useState("email"); // email → otp → reset
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRefresh, setHasRefresh] = useState(false);

  useEffect(() => {
    tokens.getRefresh().then(rt => setHasRefresh(!!rt));
  }, []);

  const requestOtp = async () => {
    const normalized = normalizeEmail(email);
    setFormError("");
    setNotice("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (mode === "signUp" && name.trim().length < 2) {
      setFormError("Enter your full name to create your account.");
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setFormError("Account creation is temporarily unavailable. Please try again shortly.");
      return;
    }
    setLoading(true);
    setNotice(mode === "signUp"
      ? "Creating your account and sending the secure email code. This can take a few seconds."
      : "Sending your secure sign-in code. This can take a few seconds.");
    try {
      const options = { shouldCreateUser: mode === "signUp" };
      if (mode === "signUp") {
        options.data = {
          role: role || "customer",
          full_name: name.trim(),
          onboarding_required: role === "priest",
          source: Platform.OS === "web" ? "expo-web" : "expo-mobile",
        };
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options,
      });
      if (error) throw error;
      setEmail(normalized);
      setStage("otp");
      setNotice(mode === "signUp"
        ? "Account verification sent. Enter the code from your email to finish creating your account."
        : "Sign-in code sent. Enter the code from your email.");
    } catch (e) {
      const message = e?.message || "Please try again";
      setNotice("");
      const friendlyMessage = mode === "signIn" && /signups|user/i.test(message)
        ? "No account exists for this email. Choose Create account first."
        : /rate limit/i.test(message)
          ? "Too many email attempts. Wait a minute, then try again."
          : /sending|smtp|email/i.test(message)
            ? "We could not send the verification email. Please try again shortly."
            : message;
      setFormError(friendlyMessage);
      if (Platform.OS !== "web") Alert.alert("Email verification failed", friendlyMessage);
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    const normalized = normalizeEmail(email);
    const normalizedOtp = otp.replace(/\D/g, "");
    setFormError("");
    setNotice("");
    if (normalizedOtp.length !== OTP_LENGTH) {
      setFormError(`Enter the complete ${OTP_LENGTH}-digit code from your latest email.`);
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setFormError("Verification is temporarily unavailable. Please try again shortly.");
      return;
    }
    setLoading(true);
    setNotice("Verifying your secure email code...");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalized,
        token: normalizedOtp,
        type: "email",
      });
      if (error) throw error;
      if (!data?.session?.user) throw new Error("Verification completed without a session. Request a new code and try again.");
      const nextUser = await applySupabaseSession(data.session, role);
      if (!nextUser) throw new Error("Your session could not be opened. Request a new code and try again.");
      setNotice("Email verified. Opening your account...");
      // Best-effort push registration; won't block login.
      registerForPush().catch(() => {});
    } catch (e) {
      setNotice("");
      const message = e?.message || "Invalid verification code";
      const friendlyMessage = /expired|invalid|token/i.test(message)
        ? "That code is expired or no longer valid. Tap Resend email OTP, then enter only the newest code."
        : message;
      setFormError(friendlyMessage);
      if (Platform.OS !== "web") Alert.alert("Verify failed", friendlyMessage);
    } finally { setLoading(false); }
  };

  const sendPasswordReset = async () => {
    const normalized = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return Alert.alert("Invalid", "Enter your account email first");
    if (!isSupabaseConfigured || !supabase) return Alert.alert("Configuration required", "Add the Supabase project URL and publishable key before sending reset emails.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: authRedirectUrl("auth/reset-password"),
      });
      if (error) throw error;
      setNotice("Password reset email sent. Open the secure link from your inbox to set a new password.");
      setStage("email");
    } catch (e) {
      Alert.alert("Reset failed", e?.message || "Please try again");
    } finally { setLoading(false); }
  };

  const tryBiometric = async () => {
    const ok = await restoreWithBiometric();
    if (!ok) Alert.alert("Session expired", "Please sign in with OTP again.");
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.cotton }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable accessibilityLabel="Choose account type" onPress={resetRole} hitSlop={12} style={styles.back}><ArrowLeft size={20} color={colors.brandBrown} /></Pressable>
          <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{role === "priest" ? "PRIEST APP" : "BOOKING APP"}</Text></View>
        </View>
        <View style={styles.brandRow}><BrandLogo width={214} height={96} showText={false} /><Text style={styles.brandMode}>{role === "priest" ? "Purohit partner workspace" : "Book trusted Vedic services"}</Text></View>
        {stage === "email" ? (
          <View style={styles.authTabs}>
            <Pressable testID="sign-in-tab" onPress={() => { setMode("signIn"); setNotice(""); setFormError(""); }} style={[styles.authTab, mode === "signIn" && styles.authTabActive]}><Text style={[styles.authTabText, mode === "signIn" && styles.authTabTextActive]}>Sign in</Text></Pressable>
            <Pressable testID="sign-up-tab" onPress={() => { setMode("signUp"); setNotice(""); setFormError(""); }} style={[styles.authTab, mode === "signUp" && styles.authTabActive]}><Text style={[styles.authTabText, mode === "signUp" && styles.authTabTextActive]}>Create account</Text></Pressable>
          </View>
        ) : null}
        <Text style={styles.title}>{stage === "otp" ? "Check your email" : stage === "reset" ? "Reset your password" : mode === "signUp" ? "Create your account" : "Welcome back"}</Text>
        <Text style={styles.sub}>{stage === "otp" ? `We sent a verification code to ${email}` : role === "priest" ? "Join families looking for trusted Purohits." : "Plan and manage every sacred ceremony in one place."}</Text>
        <View style={styles.security}><ShieldCheck size={15} color={colors.success} /><Text style={styles.securityText}>Verified by secure email OTP</Text></View>
        {notice ? (
          <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View>
        ) : null}
        {formError ? (
          <View testID="auth-error" accessibilityRole="alert" style={styles.errorNotice}><Text style={styles.errorNoticeText}>{formError}</Text></View>
        ) : null}

        {stage === "email" ? (
          <>
            <Field label="Email address">
              <View style={styles.inputWrap}><Mail size={18} color={colors.muted2} />
              <TextInput
                testID="email-input"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={(value) => { setEmail(value); setFormError(""); }}
                placeholder="you@example.com"
                style={styles.inputBare}
                returnKeyType={mode === "signUp" ? "next" : "go"}
                onSubmitEditing={mode === "signIn" ? requestOtp : undefined}
              />
              </View>
            </Field>
            {mode === "signUp" ? <Field label="Full name">
              <View style={styles.inputWrap}><UserRound size={18} color={colors.muted2} /><TextInput
                testID="name-input"
                value={name}
                onChangeText={(value) => { setName(value); setFormError(""); }}
                placeholder="Your full name"
                style={styles.inputBare}
                returnKeyType="go"
                onSubmitEditing={requestOtp}
              />
              </View>
            </Field> : null}
            <PrimaryButton testID="send-otp-btn" title={loading ? (mode === "signUp" ? "Creating account..." : "Sending code...") : mode === "signUp" ? "Create account with email" : "Continue with email"} onPress={requestOtp} disabled={loading} />
            <Pressable onPress={() => setStage("reset")} style={styles.linkBtn}>
              <KeyRound size={15} color={colors.saffron} />
              <Text style={styles.linkText}>Forgot password?</Text>
            </Pressable>
            {hasRefresh && (
              <Button
                testID="biometric-btn"
                title={t.biometricUnlock}
                onPress={tryBiometric}
                variant="outline"
                style={{ marginTop: spacing.md }}
              />
            )}
          </>
        ) : stage === "reset" ? (
          <>
            <Field label="Account email">
              <View style={styles.inputWrap}><Mail size={18} color={colors.muted2} />
              <TextInput
                testID="reset-email-input"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                style={styles.inputBare}
              />
              </View>
            </Field>
            <PrimaryButton testID="reset-password-btn" title={loading ? t.loggingIn : "Send password reset email"} onPress={sendPasswordReset} disabled={loading} />
            <Pressable onPress={() => setStage("email")}>
              <Text style={{ color: colors.brandOrangeDark, textAlign: "center", marginTop: spacing.md }}>Back to sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Field label={`${t.enterOtp} (${OTP_LENGTH} digits)`}>
              <TextInput
                testID="otp-input"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={OTP_LENGTH}
                value={otp}
                onChangeText={(value) => { setOtp(value.replace(/\D/g, "").slice(0, OTP_LENGTH)); setFormError(""); }}
                placeholder={`${OTP_LENGTH}-digit email verification code`}
                returnKeyType="done"
                onSubmitEditing={verifyOtp}
                style={styles.input}
              />
            </Field>
            <PrimaryButton testID="verify-otp-btn" title={loading ? t.loggingIn : t.verifyOtp} onPress={verifyOtp} disabled={loading} />
            <Pressable onPress={() => { setOtp(""); requestOtp(); }} disabled={loading}>
              <Text style={{ color: colors.brandOrangeDark, textAlign: "center", marginTop: spacing.md }}>Resend email OTP</Text>
            </Pressable>
            <Text style={styles.otpHint}>After resending, earlier codes stop working. Always use the newest email.</Text>
            <Pressable onPress={() => { setStage("email"); setOtp(""); }}>
              <Text style={{ color: colors.muted2, textAlign: "center", marginTop: spacing.sm }}>Change email</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48, gap: spacing.md, backgroundColor: colors.white, minHeight: "100%" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 44, height: 44, borderWidth: 1, borderColor: "#E4C8CE", borderRadius: 22, alignItems: "center", justifyContent: "center" },
  roleBadge: { borderRadius: radii.pill, backgroundColor: colors.brandTint, paddingHorizontal: 11, paddingVertical: 7 },
  roleBadgeText: { color: colors.brandBrown, fontSize: 9, fontWeight: "800", letterSpacing: .7 },
  brandRow: { alignItems: "flex-start", gap: 3, marginBottom: 8 },
  brandMode: { color: colors.muted2, fontSize: 11, fontWeight: "700", marginLeft: 4, marginTop: -8 },
  authTabs: { flexDirection: "row", padding: 4, borderRadius: 12, backgroundColor: colors.brandTint, marginBottom: 8 },
  authTab: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  authTabActive: { backgroundColor: colors.white, shadowColor: colors.brandBrown, shadowOpacity: .1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  authTabText: { color: colors.muted2, fontSize: 13, fontWeight: "700" },
  authTabTextActive: { color: colors.brandBrown },
  title: { fontSize: 32, lineHeight: 39, fontWeight: "700", color: colors.ink },
  sub: { fontSize: font.sizes.sm, color: colors.muted2, marginBottom: spacing.sm },
  security: { flexDirection: "row", gap: 7, alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.warmBorder, marginBottom: spacing.lg },
  securityText: { color: colors.muted2, fontSize: 11 },
  notice: { backgroundColor: colors.brandTint, borderWidth: 1, borderColor: "#F5C7AA", borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm },
  noticeText: { color: colors.brandBrown, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  errorNotice: { backgroundColor: "#FFF1F0", borderWidth: 1, borderColor: "#E7AAA3", borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm },
  errorNoticeText: { color: "#8F271F", fontSize: 12, lineHeight: 18, fontWeight: "700" },
  otpHint: { color: colors.muted2, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: -4 },
  input: {
    height: 50, borderRadius: radii.md, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.warmBorder, paddingHorizontal: spacing.lg,
    fontSize: font.sizes.base, color: colors.ink,
  },
  inputWrap: { height: 54, borderRadius: radii.md, backgroundColor: colors.muted, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: "transparent" },
  inputBare: { flex: 1, fontSize: font.sizes.base, color: colors.ink, paddingVertical: 0 },
  linkBtn: { minHeight: 44, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  linkText: { color: colors.brandOrangeDark, fontWeight: "700", fontSize: font.sizes.sm },
  demoBtn: { minHeight: 52, borderWidth: 1, borderColor: "#D9ADB6", backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.md, alignItems: "center", justifyContent: "center" },
  demoBtnTxt: { color: colors.brandBrown, fontWeight: "700", fontSize: font.sizes.sm },
  demoHint: { color: colors.muted2, fontSize: 10, textAlign: "center", marginTop: -4 },
});
