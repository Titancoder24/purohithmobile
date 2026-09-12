import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as Linking from "expo-linking";

const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || extra.supabaseAnonKey || "";
const ANONYMOUS_KEY = "pc.analytics.anonymous-id";
let currentSessionId = null;

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    return (token === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfig = {
  url: supabaseUrl,
  publishableKey: supabaseAnonKey,
};

export function authRedirectUrl(path = "auth/callback") {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/${path.replace(/^\//, "")}`;
  }
  return Linking.createURL(path.replace(/^\//, ""));
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
      },
      global: {
        headers: { "x-application-name": "purohith-connect-expo" },
      },
    })
  : null;

export async function startMobileSession() {
  if (!supabase) return { skipped: true };
  let anonymousId = await AsyncStorage.getItem(ANONYMOUS_KEY);
  if (!anonymousId) {
    anonymousId = uuid();
    await AsyncStorage.setItem(ANONYMOUS_KEY, anonymousId);
  }
  const platform = Platform.OS === "web" ? "expo-web" : Platform.OS;
  const { data, error } = await supabase.from("platform_sessions").insert({
    anonymous_id: anonymousId,
    platform,
    user_agent: Platform.OS === "web" ? globalThis.navigator?.userAgent || "" : `expo-${Platform.OS}`,
  }).select("id").single();
  if (!error) currentSessionId = data.id;
  return { data, error };
}

export async function trackMobileEvent(eventName, properties = {}, platform = "unknown") {
  if (!supabase) return { skipped: true };
  const { data: authData } = await supabase.auth.getUser();
  return supabase.from("analytics_events").insert({
    session_id: currentSessionId,
    user_id: authData?.user?.id || null,
    event_name: eventName,
    route: properties.route || "",
    platform: platform === "unknown" ? (Platform.OS === "web" ? "expo-web" : Platform.OS) : platform,
    properties,
  });
}
