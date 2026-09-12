// Auth context: role, user, biometric-guarded session restore.
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import api, { tokens } from "./api";
import { t } from "./i18n";
import { supabase } from "./supabase";

const AuthCtx = createContext(null);

function normalizeRole(role) {
  return role === "priest" ? "priest" : "customer";
}

function profileFromSupabaseUser(authUser, fallbackRole) {
  const metadata = authUser?.user_metadata || {};
  const role = normalizeRole(metadata.role || fallbackRole);
  return {
    id: authUser.id,
    role,
    name: metadata.full_name || metadata.name || authUser.email?.split("@")[0] || "Purohith user",
    phone: metadata.phone || "",
    email: authUser.email || "",
    emailVerified: Boolean(authUser.email_confirmed_at),
    onboardingRequired: role === "priest" && metadata.onboarding_required === true,
  };
}

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);   // { id, role, name, phone, ... }
  const [role, setRoleState] = useState(null);
  const signingOutRef = useRef(false);

  const setRole = useCallback(async (r) => {
    setRoleState(r);
    await tokens.setRole(r);
  }, []);

  const resetRole = useCallback(async () => {
    setRoleState(null);
    await tokens.setRole(null);
  }, []);

  const syncSupabaseProfile = useCallback(async (authUser, fallbackRole) => {
    if (!supabase || !authUser) return null;
    const metadataUser = profileFromSupabaseUser(authUser, fallbackRole);
    const [{ data: existing }, { data: priestProfile }] = await Promise.all([
      supabase.from("app_users").select("id,role,full_name,phone,email,is_active").eq("id", authUser.id).maybeSingle(),
      supabase.from("priest_profiles").select("id,onboarding_step,verification_status").eq("user_id", authUser.id).maybeSingle(),
    ]);
    if (existing?.is_active === false) throw new Error("This account has been suspended. Contact support for help.");
    const resolvedRole = existing?.role === "priest" || priestProfile ? "priest" : metadataUser.role;
    const nextUser = {
      ...metadataUser,
      role: resolvedRole,
      name: existing?.full_name || metadataUser.name,
      phone: existing?.phone || metadataUser.phone,
      email: existing?.email || metadataUser.email,
      onboardingRequired: resolvedRole === "priest" && (
        metadataUser.onboardingRequired || !priestProfile || Number(priestProfile.onboarding_step || 0) < 3
      ),
      priestProfileId: priestProfile?.id || null,
      verificationStatus: priestProfile?.verification_status || null,
    };
    const payload = {
      id: authUser.id,
      role: nextUser.role,
      full_name: nextUser.name,
      phone: nextUser.phone || null,
      email: nextUser.email || null,
      preferred_language: "en",
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("app_users").upsert(payload, { onConflict: "id" });
    if (error) {
      const { data } = await supabase.from("app_users").select("id,role,full_name,phone,email,is_active").eq("id", authUser.id).maybeSingle();
      if (data) {
        return {
          id: data.id,
          role: data.role,
          name: data.full_name,
          phone: data.phone || "",
          email: data.email || authUser.email || "",
          emailVerified: Boolean(authUser.email_confirmed_at),
          onboardingRequired: nextUser.onboardingRequired,
        };
      }
      throw error;
    }
    return nextUser;
  }, []);

  const applySupabaseSession = useCallback(async (session, fallbackRole) => {
    if (!session?.user) return null;
    const nextUser = await syncSupabaseProfile(session.user, fallbackRole);
    if (!nextUser) return null;
    await tokens.setAccess(session.access_token);
    if (session.refresh_token) await tokens.setRefresh(session.refresh_token);
    await tokens.setUser(nextUser);
    await tokens.setRole(nextUser.role);
    setUser(nextUser);
    setRoleState(nextUser.role);
    return nextUser;
  }, [syncSupabaseProfile]);

  const login = useCallback(async ({ access_token, refresh_token, user: u }) => {
    await tokens.setAccess(access_token);
    if (refresh_token) await tokens.setRefresh(refresh_token);
    await tokens.setUser(u);
    setUser(u);
    setRoleState(u.role);
    await tokens.setRole(u.role);
  }, []);

  const logout = useCallback(async () => {
    signingOutRef.current = true;
    setUser(null);
    setRoleState(null);
    await tokens.clear();
    try {
      if (supabase) await supabase.auth.signOut({ scope: "local" });
    } catch (_) { /* local app state is already signed out */ }
    try { await api.post("/auth/logout"); } catch (_) { /* legacy API is best effort */ }
    signingOutRef.current = false;
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.updateUser({
        data: { onboarding_required: false, onboarding_completed: true },
      });
      if (error) throw error;
    }
    setUser((current) => {
      if (!current) return current;
      const updated = { ...current, onboardingRequired: false };
      tokens.setUser(updated).catch(() => {});
      return updated;
    });
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      await tokens.setUser(data);
      return data;
    } catch (_) { return null; }
  }, []);

  const restoreWithBiometric = useCallback(async () => {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        const restored = await applySupabaseSession(data.session, role);
        return Boolean(restored);
      }
    }
    const rt = await tokens.getRefresh();
    if (!rt) return false;
    if (Platform.OS === "web") {
      const me = await refreshMe();
      if (me) { setRoleState(me.role); return true; }
      return false;
    }
    // Only prompt if hardware supports it
    const hasHw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hasHw && (await LocalAuthentication.isEnrolledAsync());
    if (enrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t.biometricPrompt,
        fallbackLabel: "Use passcode",
        disableDeviceFallback: false,
      });
      if (!result.success) return false;
    }
    // Force a refresh via /auth/me (interceptor will auto-refresh access token)
    const me = await refreshMe();
    if (me) { setRoleState(me.role); return true; }
    return false;
  }, [applySupabaseSession, refreshMe, role]);

  useEffect(() => {
    (async () => {
      const [savedRole, savedUser] = await Promise.all([tokens.getRole(), tokens.getUser()]);
      if (savedRole) setRoleState(savedRole);
      if (savedUser) setUser(savedUser);
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data?.session) await applySupabaseSession(data.session, savedRole);
      }
      setReady(true);
    })();
  }, [applySupabaseSession]);

  useEffect(() => {
    if (!supabase) return undefined;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || signingOutRef.current) {
        setUser(null);
        if (event === "SIGNED_OUT") {
          setRoleState(null);
          tokens.clear().catch(() => {});
        }
        return;
      }
      if (session?.user) {
        setTimeout(() => {
          applySupabaseSession(session, role).catch((error) => {
            console.warn("Supabase profile sync failed", error?.message || error);
          });
        }, 0);
      }
    });
    return () => listener?.subscription?.unsubscribe?.();
  }, [applySupabaseSession, role]);

  return (
    <AuthCtx.Provider value={{
      ready, user, role,
      setRole, resetRole, login, logout, completeOnboarding, refreshMe, restoreWithBiometric, applySupabaseSession,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
