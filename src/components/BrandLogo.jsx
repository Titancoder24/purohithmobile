import React from "react";
import { bindBrandStyles } from "../lib/brandStyles";
import { Image, Text, View } from "react-native";
import { colors } from "../lib/theme";

const logoSource = require("../../assets/images/purohithconnect-logo.png");

export default function BrandLogo({ size = 42, width, height, showText = true, subtitle, compact = false, style }) {
  const logoHeight = height || size;
  const logoWidth = width || size;
  return (
    <View style={[styles.wrap, style]}>
      <Image source={logoSource} style={[styles.logo, { width: logoWidth, height: logoHeight }]} />
      {showText ? <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.name, compact && styles.nameCompact]}>Purohith Connect</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
      </View> : null}
    </View>
  );
}

const styles = bindBrandStyles({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  logo: { resizeMode: "contain" },
  copy: { minWidth: 0 },
  name: { color: colors.ink, fontSize: 15, fontWeight: "900", letterSpacing: .1 },
  nameCompact: { fontSize: 13 },
  subtitle: { color: colors.muted2, fontSize: 10, marginTop: 2, fontWeight: "600" },
});
