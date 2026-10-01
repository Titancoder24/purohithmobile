import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { fetchMarketplaceSettings } from "./marketplace";
import { buildPalette, setLivePalette, syncBrandColors } from "./brandStyles";
import { colors } from "./theme";

const KEY = "pc.appearance";
const HEX = /^#[0-9A-Fa-f]{6}$/;

export const COLOR_SWATCHES = [
  { id: "maroon", label: "Maroon", hex: "#8F1028" },
  { id: "crimson", label: "Crimson", hex: "#B42318" },
  { id: "wine", label: "Wine", hex: "#7F1D1D" },
  { id: "lotus", label: "Lotus", hex: "#9D174D" },
  { id: "saffron", label: "Saffron", hex: "#E65319" },
  { id: "orange", label: "Orange", hex: "#F06412" },
  { id: "copper", label: "Copper", hex: "#A15C38" },
  { id: "gold", label: "Gold", hex: "#B8860B" },
  { id: "temple", label: "Temple", hex: "#6B3A2A" },
  { id: "forest", label: "Forest", hex: "#1B5E3B" },
  { id: "emerald", label: "Emerald", hex: "#0F766E" },
  { id: "peacock", label: "Peacock", hex: "#0E7490" },
  { id: "indigo", label: "Indigo", hex: "#1E3A8A" },
  { id: "royal", label: "Royal", hex: "#1D4ED8" },
  { id: "plum", label: "Plum", hex: "#6D28D9" },
  { id: "slate", label: "Slate", hex: "#334155" },
];

export const APPEARANCE_PRESETS = [
  { id: "maroon", label: "Maroon", primary: "#8F1028", accent: "#E65319" },
  { id: "crimson", label: "Crimson", primary: "#B42318", accent: "#B8860B" },
  { id: "saffron", label: "Saffron", primary: "#C94708", accent: "#F5A524" },
  { id: "temple", label: "Temple", primary: "#6B3A2A", accent: "#B8860B" },
  { id: "copper", label: "Copper", primary: "#A15C38", accent: "#E65319" },
  { id: "forest", label: "Forest", primary: "#1B5E3B", accent: "#C4A35A" },
  { id: "emerald", label: "Emerald", primary: "#0F766E", accent: "#E65319" },
  { id: "peacock", label: "Peacock", primary: "#0E7490", accent: "#B8860B" },
  { id: "indigo", label: "Indigo", primary: "#1E3A8A", accent: "#E07A3D" },
  { id: "royal", label: "Royal", primary: "#1D4ED8", accent: "#B8860B" },
  { id: "plum", label: "Plum", primary: "#6D28D9", accent: "#B8860B" },
  { id: "lotus", label: "Lotus", primary: "#9D174D", accent: "#E65319" },
  { id: "wine", label: "Wine", primary: "#7F1D1D", accent: "#B8860B" },
  { id: "slate", label: "Slate", primary: "#334155", accent: "#E65319" },
];

export const BUTTON_SHAPES = [
  { id: "pill", label: "Pill", radius: 999 },
  { id: "rounded", label: "Rounded", radius: 12 },
  { id: "square", label: "Square", radius: 4 },
];

export const BUTTON_STYLES = [
  { id: "solid", label: "Solid" },
  { id: "soft", label: "Soft" },
  { id: "outline", label: "Outline" },
];

export const DEFAULT_APPEARANCE = {
  preset: "maroon",
  primary: "#8F1028",
  accent: "#E65319",
  buttonShape: "pill",
  buttonStyle: "solid",
};

export function normalizeAppearance(input) {
  const source = input && typeof input === "object" ? input : {};
  const named = APPEARANCE_PRESETS.find((item) => item.id === source.preset);
  const primary = HEX.test(String(source.primary || "")) ? String(source.primary).toUpperCase() : (named?.primary || DEFAULT_APPEARANCE.primary);
  const accent = HEX.test(String(source.accent || "")) ? String(source.accent).toUpperCase() : (named?.accent || DEFAULT_APPEARANCE.accent);
  const buttonShape = BUTTON_SHAPES.some((item) => item.id === source.buttonShape) ? source.buttonShape : DEFAULT_APPEARANCE.buttonShape;
  const buttonStyle = BUTTON_STYLES.some((item) => item.id === source.buttonStyle) ? source.buttonStyle : DEFAULT_APPEARANCE.buttonStyle;
  const matched = APPEARANCE_PRESETS.find((item) => item.primary === primary && item.accent === accent);
  return { preset: matched?.id || "custom", primary, accent, buttonShape, buttonStyle };
}

export function buttonTokens(input) {
  const theme = normalizeAppearance(input);
  const radius = BUTTON_SHAPES.find((item) => item.id === theme.buttonShape)?.radius ?? 999;
  const palette = buildPalette(theme);
  const softBg = palette.tint;
  let primaryBg = theme.primary;
  let primaryFg = "#FFFFFF";
  let primaryBorder = theme.primary;
  if (theme.buttonStyle === "soft") {
    primaryBg = softBg;
    primaryFg = theme.primary;
    primaryBorder = softBg;
  } else if (theme.buttonStyle === "outline") {
    primaryBg = "#FFFFFF";
    primaryFg = theme.primary;
    primaryBorder = theme.primary;
  }
  return { ...theme, ...palette, radius, softBg, primaryBg, primaryFg, primaryBorder };
}

const AppearanceContext = createContext(null);

export function AppearanceProvider({ children }) {
  const [remote, setRemote] = useState(DEFAULT_APPEARANCE);
  const [local, setLocal] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (!raw) return;
      try { setLocal(normalizeAppearance(JSON.parse(raw))); } catch { setLocal(null); }
    }).finally(() => setReady(true));
  }, []);

  const applyRemoteAppearance = useCallback((raw) => {
    if (!raw) return;
    setRemote(normalizeAppearance(raw));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const readStoredAppearance = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.from("platform_settings").select("value").eq("key", "customer_appearance").maybeSingle();
        if (cancelled || !data?.value) return;
        const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        applyRemoteAppearance(parsed);
      } catch { /* keep the built-in theme */ }
    };
    fetchMarketplaceSettings().then((data) => {
      if (cancelled) return;
      if (data?.appearance) applyRemoteAppearance(data.appearance);
      else return readStoredAppearance();
    }).catch(() => readStoredAppearance().catch(() => {}));
    return () => { cancelled = true; };
  }, [applyRemoteAppearance]);

  const appearance = useMemo(() => normalizeAppearance(local || remote), [local, remote]);
  const tokens = useMemo(() => buttonTokens(appearance), [appearance]);
  setLivePalette(tokens);
  syncBrandColors(colors, tokens);

  const setAppearance = useCallback(async (patch) => {
    const next = normalizeAppearance({ ...appearance, ...patch });
    setLocal(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }, [appearance]);

  const resetAppearance = useCallback(async () => {
    setLocal(null);
    await AsyncStorage.removeItem(KEY);
  }, []);

  const value = useMemo(() => ({
    appearance,
    tokens,
    ready,
    followingAdmin: local == null,
    setAppearance,
    resetAppearance,
    applyRemoteAppearance,
  }), [appearance, applyRemoteAppearance, local, ready, resetAppearance, setAppearance, tokens]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  return useContext(AppearanceContext) || {
    appearance: DEFAULT_APPEARANCE,
    tokens: buttonTokens(DEFAULT_APPEARANCE),
    ready: true,
    followingAdmin: true,
    setAppearance: async () => DEFAULT_APPEARANCE,
    resetAppearance: async () => {},
    applyRemoteAppearance: () => {},
  };
}
