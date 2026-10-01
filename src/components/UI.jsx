import React, { useRef } from "react";
import { bindBrandStyles } from "../lib/brandStyles";
import { Animated, Platform, View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { colors, radii, font, spacing } from "../lib/theme";
import { spiritualTap } from "../lib/spiritualSounds";
import { useAppearance } from "../lib/appearance";

export function Button({ title, onPress, variant = "primary", disabled, loading, testID, style, icon: Icon }) {
  const { tokens } = useAppearance();
  const press = useRef(new Animated.Value(0)).current;
  const themed = variant === "primary" || variant === "outline" || variant === "ghost";
  const bg = disabled ? colors.warmBorder :
    variant === "primary" ? tokens.primaryBg :
    variant === "danger" ? colors.danger :
    variant === "ghost" ? "transparent" : colors.white;
  const fg = variant === "outline" || variant === "ghost" ? tokens.primary : variant === "primary" ? tokens.primaryFg : colors.white;
  const border = variant === "outline" ? { borderWidth: 1, borderColor: tokens.primary } : variant === "primary" && tokens.buttonStyle !== "solid" ? { borderWidth: 1, borderColor: tokens.primaryBorder } : {};
  const radius = themed ? tokens.radius : radii.md;
  const dimensional = variant === "primary" || variant === "danger";
  const animate = (toValue) => Animated.spring(press, { toValue, speed: 32, bounciness: toValue ? 0 : 7, useNativeDriver: true }).start();
  const animatedStyle = { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, .975] }) }] };
  if (Platform.OS === "web") {
    const extra = StyleSheet.flatten(style) || {};
    const activate = (event) => { if (!disabled && !loading) { spiritualTap(); onPress?.(event); } };
    return <div
      data-testid={testID}
      role="button"
      tabIndex={disabled || loading ? -1 : 0}
      aria-label={title}
      aria-disabled={disabled || loading}
      onClick={activate}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(event); } }}
      style={{
        minHeight: 52,
        width: extra.width,
        alignSelf: extra.alignSelf,
        marginTop: extra.marginTop,
        marginBottom: extra.marginBottom,
        marginLeft: extra.marginLeft,
        marginRight: extra.marginRight,
        padding: "0 20px",
        borderRadius: radius,
        border: variant === "outline" ? `1px solid ${tokens.primary}` : variant === "primary" && tokens.buttonStyle !== "solid" ? `1px solid ${tokens.primaryBorder}` : "1px solid transparent",
        background: bg,
        color: fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? .65 : 1,
        fontSize: font.sizes.base,
        fontWeight: 700,
        boxShadow: dimensional ? `0 4px 9px ${variant === "danger" ? "#7F1D1D33" : `${tokens.primary}33`}` : "none",
      }}
    >{loading ? "Loading..." : <>{Icon ? <Icon size={18} color={fg} strokeWidth={2.2} /> : null}<span>{title}</span></>}</div>;
  }
  return (
    <Animated.View style={[animatedStyle, style]}><Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={(event) => { spiritualTap(); onPress?.(event); }}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.btn, dimensional && styles.dimensional, variant === "danger" && styles.dangerDepth, { backgroundColor: bg, borderRadius: radius, opacity: pressed ? 0.9 : 1 }, pressed && dimensional && styles.dimensionalPressed, border]}>
      {loading ? <ActivityIndicator color={fg} /> : <>
        {Icon ? <Icon size={18} color={fg} strokeWidth={2.2} /> : null}
        <Text style={[styles.btnTxt, { color: fg }]}>{title}</Text>
      </>}
    </Pressable></Animated.View>
  );
}

export function Card({ children, style, testID }) {
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function Pill({ label, tone = "neutral", style }) {
  const palette = {
    neutral: { bg: colors.muted, fg: colors.muted2 },
    saffron: { bg: colors.accentTint, fg: colors.saffronDark },
    green: { bg: "#DCFCE7", fg: colors.success },
    blue: { bg: "#DBEAFE", fg: colors.info },
    danger: { bg: "#FEE2E2", fg: colors.danger },
  }[tone] || { bg: colors.muted, fg: colors.muted2 };
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }, style]}>
      <Text style={{ color: palette.fg, fontSize: font.sizes.xs, fontWeight: "600", textTransform: "capitalize" }}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, subtitle }) {
  return (
    <View style={{ marginBottom: spacing.md, marginTop: spacing.lg }}>
      <Text style={{ fontSize: font.sizes.h1, lineHeight: 36, color: colors.ink, fontWeight: "700" }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.muted2, fontSize: font.sizes.sm, marginTop: 2 }}>{subtitle}</Text> : null}
    </View>
  );
}

export function Field({ label, required = false, children, style }) {
  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      {label ? (
        <Text style={{ fontSize: font.sizes.sm, color: colors.muted2, marginBottom: 6, fontWeight: "600" }}>
          {label}
          {required ? <Text style={{ color: colors.danger, fontWeight: "700" }}> *</Text> : null}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = bindBrandStyles({
  btn: {
    minHeight: 52, borderRadius: radii.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 20,
    flexDirection: "row", gap: 9,
  },
  dimensional: { shadowColor: colors.brandBrownDark, shadowOpacity: .2, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  dangerDepth: { shadowColor: "#7F1D1D" },
  dimensionalPressed: { shadowOpacity: .03, elevation: 1 },
  btnTxt: { fontSize: font.sizes.base, fontWeight: "700" },
  card: {
    backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.warmBorder,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, alignSelf: "flex-start" },
});
