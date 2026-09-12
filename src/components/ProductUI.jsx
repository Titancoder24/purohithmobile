import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react-native";
import { colors, font, radii, spacing, type } from "../lib/theme";
import { spiritualTap } from "../lib/spiritualSounds";

export function Screen({ children, style }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function PageScroll({ children, style, contentStyle, ...props }) {
  return (
    <ScrollView
      style={[styles.screen, style]}
      contentContainerStyle={[styles.pageContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action, compact = false }) {
  return (
    <View style={[styles.pageHeader, compact && styles.pageHeaderCompact]}>
      <View style={styles.pageHeaderCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={[styles.pageTitle, compact && styles.pageTitleCompact]}>{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.pageHeaderAction}>{action}</View> : null}
    </View>
  );
}

export function NativeHeader({ title, subtitle, onBack, right }) {
  return (
    <View style={styles.nativeHeader}>
      <IconButton label="Go back" icon={ArrowLeft} onPress={onBack} />
      <View style={styles.nativeHeaderCopy}>
        <Text numberOfLines={1} style={styles.nativeHeaderTitle}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.nativeHeaderSubtitle}>{subtitle}</Text> : null}
      </View>
      {right || <View style={styles.headerSpacer} />}
    </View>
  );
}

export function SearchField({ value, onChangeText, placeholder, onFilter, style }) {
  return (
    <View style={[styles.search, style]}>
      <Search size={19} color={colors.ink} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#777777"
        style={styles.searchInput}
        returnKeyType="search"
      />
      {onFilter ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Filters" onPress={onFilter} style={styles.searchFilter}>
          <SlidersHorizontal size={18} color={colors.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function IconButton({ icon: Icon, label, onPress, inverse = false, danger = false, size = 42, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={(event) => { spiritualTap(); onPress?.(event); }}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        inverse && styles.iconButtonInverse,
        danger && styles.iconButtonDanger,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Icon size={Math.round(size * .44)} color={inverse || danger ? colors.white : colors.ink} strokeWidth={2.2} />
    </Pressable>
  );
}

export function PrimaryButton({ title, onPress, icon: Icon, disabled, loading, tone = "dark", style, testID }) {
  const inverse = tone === "light";
  const accent = tone === "accent";
  const press = useRef(new Animated.Value(0)).current;
  const animate = (toValue) => Animated.spring(press, { toValue, speed: 32, bounciness: toValue ? 0 : 7, useNativeDriver: true }).start();
  const animatedStyle = { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, .975] }) }] };
  return (
    <Animated.View style={[animatedStyle, style]}><Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
      onPress={(event) => { spiritualTap(); onPress?.(event); }}
      style={({ pressed }) => [
        styles.primaryButton,
        inverse && styles.primaryButtonLight,
        accent && styles.primaryButtonAccent,
        (disabled || loading) && styles.disabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? <ActivityIndicator color={inverse ? colors.ink : colors.white} /> : (
        <>
          <Text style={[styles.primaryButtonText, inverse && styles.primaryButtonTextLight]}>{title}</Text>
          {Icon ? <Icon size={18} color={inverse ? colors.ink : colors.white} /> : null}
        </>
      )}
    </Pressable></Animated.View>
  );
}

export function TextButton({ title, onPress, icon: Icon = ArrowRight, danger = false, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed && styles.pressed, style]}
    >
      <Text style={[styles.textButtonLabel, danger && { color: colors.danger }]}>{title}</Text>
      {Icon ? <Icon size={16} color={danger ? colors.danger : colors.ink} /> : null}
    </Pressable>
  );
}

export function SegmentedControl({ options, value, onChange, style }) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((option) => {
        const key = typeof option === "string" ? option : option.value;
        const label = typeof option === "string" ? option : option.label;
        const active = key === value;
        return (
          <Pressable key={key} onPress={() => onChange(key)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon: Icon, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed, style]}
    >
      {Icon ? <Icon size={14} color={selected ? colors.white : colors.ink} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Surface({ children, style, elevated = false }) {
  return <View style={[styles.surface, elevated && styles.surfaceElevated, style]}>{children}</View>;
}

export function SectionTitle({ title, subtitle, action, style }) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionHeaderCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action || null}
    </View>
  );
}

export function Avatar({ name = "P", size = 48, verified = false, style }) {
  return (
    <View style={[styles.avatarWrap, { width: size, height: size }, style]}>
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarText, { fontSize: Math.round(size * .38) }]}>{name.slice(0, 1).toUpperCase()}</Text>
      </View>
      {verified ? <View style={styles.avatarVerified}><Check size={10} color={colors.white} strokeWidth={3} /></View> : null}
    </View>
  );
}

export function ListRow({ icon: Icon, title, subtitle, meta, onPress, trailing, destructive = false, style }) {
  const content = (
    <>
      {Icon ? <View style={styles.listIcon}><Icon size={18} color={destructive ? colors.danger : colors.ink} /></View> : null}
      <View style={styles.listCopy}>
        <Text style={[styles.listTitle, destructive && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
      </View>
      {meta ? <Text style={styles.listMeta}>{meta}</Text> : null}
      {trailing || (onPress ? <ChevronRight size={18} color="#9A9A9A" /> : null)}
    </>
  );
  if (!onPress) return <View style={[styles.listRow, style]}>{content}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed, style]}>{content}</Pressable>;
}

export function Notice({ icon: Icon, title, body, tone = "neutral", style }) {
  const accent = tone === "accent";
  const success = tone === "success";
  return (
    <View style={[styles.notice, accent && styles.noticeAccent, success && styles.noticeSuccess, style]}>
      {Icon ? <View style={styles.noticeIcon}><Icon size={18} color={success ? colors.success : accent ? colors.saffron : colors.ink} /></View> : null}
      <View style={styles.noticeCopy}>
        {title ? <Text style={styles.noticeTitle}>{title}</Text> : null}
        {body ? <Text style={styles.noticeBody}>{body}</Text> : null}
      </View>
    </View>
  );
}

export function StatusBadge({ label, tone = "neutral" }) {
  return (
    <View style={[styles.statusBadge, tone === "success" && styles.statusSuccess, tone === "accent" && styles.statusAccent, tone === "danger" && styles.statusDanger]}>
      <Text style={[styles.statusText, tone === "success" && { color: colors.success }, tone === "accent" && { color: colors.saffronDark }, tone === "danger" && { color: colors.danger }]}>{label}</Text>
    </View>
  );
}

export function FieldShell({ icon: Icon, children, focused = false, style }) {
  return (
    <View style={[styles.field, focused && styles.fieldFocused, style]}>
      {Icon ? <Icon size={18} color={focused ? colors.ink : colors.muted2} /> : null}
      {children}
    </View>
  );
}

export function EmptyState({ icon: Icon, title, body, action, style }) {
  return (
    <View style={[styles.empty, style]}>
      {Icon ? <View style={styles.emptyIcon}><Icon size={24} color={colors.ink} /></View> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function BottomAction({ children, style }) {
  return <View style={[styles.bottomAction, style]}>{children}</View>;
}

export function Divider({ inset = 0, style }) {
  return <View style={[styles.divider, { marginLeft: inset }, style]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  pageContent: { width: "100%", maxWidth: 960, alignSelf: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 48 },
  pageHeader: { flexDirection: "row", alignItems: "flex-start", gap: 16, paddingTop: 4, paddingBottom: 18 },
  pageHeaderCompact: { paddingBottom: 12 },
  pageHeaderCopy: { flex: 1, minWidth: 0 },
  eyebrow: type.eyebrow,
  pageTitle: { ...type.display, marginTop: 4, letterSpacing: 0 },
  pageTitleCompact: { fontSize: 27, lineHeight: 33 },
  pageSubtitle: { ...type.secondary, fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 350 },
  pageHeaderAction: { paddingTop: 4 },
  nativeHeader: { minHeight: 68, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.warmBorder },
  nativeHeaderCopy: { flex: 1, minWidth: 0, alignItems: "center" },
  nativeHeaderTitle: { fontFamily: font.bold, color: colors.ink, fontSize: 15 },
  nativeHeaderSubtitle: { fontFamily: font.regular, color: colors.muted2, fontSize: 10, marginTop: 2 },
  headerSpacer: { width: 42, height: 42 },
  search: { minHeight: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", gap: 11, paddingLeft: 17, paddingRight: 7, backgroundColor: colors.white, borderWidth: 1, borderColor: "#D8D8D4", shadowColor: "#000", shadowOpacity: .06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  searchInput: { flex: 1, minHeight: 50, fontFamily: font.regular, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  searchFilter: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted },
  iconButton: { alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder },
  iconButtonInverse: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  iconButtonDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
  pressed: { opacity: .66 },
  primaryButton: { minHeight: 52, borderRadius: 10, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: colors.brandBrown, shadowColor: colors.brandBrownDark, shadowOpacity: .2, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  primaryButtonLight: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder },
  primaryButtonAccent: { backgroundColor: colors.brandOrange },
  primaryButtonText: { fontFamily: font.bold, fontSize: 14, color: colors.white },
  primaryButtonTextLight: { color: colors.ink },
  disabled: { opacity: .38 },
  buttonPressed: { opacity: .82, shadowOpacity: .03 },
  textButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  textButtonLabel: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  segmented: { flexDirection: "row", padding: 3, borderRadius: 22, backgroundColor: colors.muted },
  segment: { flex: 1, minHeight: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  segmentActive: { backgroundColor: colors.white, shadowColor: "#000", shadowOpacity: .06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  segmentText: { fontFamily: font.medium, fontSize: 12, color: colors.muted2 },
  segmentTextActive: { fontFamily: font.bold, color: colors.ink },
  chip: { minHeight: 38, borderRadius: 19, paddingHorizontal: 14, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder },
  chipSelected: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  chipText: { fontFamily: font.semibold, fontSize: 11, color: colors.ink },
  chipTextSelected: { color: colors.white },
  surface: { borderRadius: radii.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder, padding: spacing.lg },
  surfaceElevated: { shadowColor: "#000", shadowOpacity: .06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: spacing.xxl, marginBottom: spacing.md },
  sectionHeaderCopy: { flex: 1 },
  sectionTitle: type.section,
  sectionSubtitle: { ...type.secondary, marginTop: 3 },
  avatarWrap: { position: "relative" },
  avatar: { alignItems: "center", justifyContent: "center", backgroundColor: colors.brandBrown },
  avatarText: { fontFamily: font.bold, color: colors.white },
  avatarVerified: { position: "absolute", right: -2, bottom: -1, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.saffron, borderWidth: 2, borderColor: colors.white },
  listRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderColor: colors.warmBorder },
  rowPressed: { backgroundColor: colors.muted },
  listIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted },
  listCopy: { flex: 1, minWidth: 0 },
  listTitle: { fontFamily: font.semibold, fontSize: 14, lineHeight: 19, color: colors.ink },
  listSubtitle: { fontFamily: font.regular, fontSize: 11, lineHeight: 16, color: colors.muted2, marginTop: 2 },
  listMeta: { fontFamily: font.medium, fontSize: 11, color: colors.muted2 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 11, padding: 14, borderRadius: 14, backgroundColor: colors.muted },
  noticeAccent: { backgroundColor: "#FFF1EB" },
  noticeSuccess: { backgroundColor: "#EEF8F2" },
  noticeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  noticeCopy: { flex: 1, minWidth: 0 },
  noticeTitle: { fontFamily: font.semibold, fontSize: 12, color: colors.ink },
  noticeBody: { fontFamily: font.regular, fontSize: 11, lineHeight: 16, color: colors.muted2, marginTop: 3 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.muted },
  statusSuccess: { backgroundColor: "#EEF8F2" },
  statusAccent: { backgroundColor: "#FFF1EB" },
  statusDanger: { backgroundColor: "#FFF0F0" },
  statusText: { fontFamily: font.bold, fontSize: 9, color: colors.muted2, textTransform: "uppercase", letterSpacing: .3 },
  field: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.muted, borderWidth: 1, borderColor: "transparent" },
  fieldFocused: { backgroundColor: colors.white, borderColor: colors.brandBrown },
  empty: { alignItems: "center", paddingHorizontal: spacing.xxl, paddingVertical: 44 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted },
  emptyTitle: { fontFamily: font.bold, fontSize: 17, color: colors.ink, textAlign: "center", marginTop: 14 },
  emptyBody: { fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: colors.muted2, textAlign: "center", marginTop: 6, maxWidth: 300 },
  emptyAction: { marginTop: 18, minWidth: 180 },
  bottomAction: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: Platform.OS === "ios" ? 28 : spacing.lg, borderTopWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white },
  divider: { height: 1, backgroundColor: colors.warmBorder },
});
