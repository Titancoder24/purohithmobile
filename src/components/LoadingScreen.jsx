import React from "react";
import { bindBrandStyles } from "../lib/brandStyles";
import { View, Text, ActivityIndicator } from "react-native";
import { colors, font } from "../lib/theme";
import { t } from "../lib/i18n";

export default function LoadingScreen({ label }) {
  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={colors.saffron} />
      <Text style={styles.txt}>{label || t.loading}</Text>
    </View>
  );
}
const styles = bindBrandStyles({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cotton, gap: 12 },
  txt: { color: colors.muted2, fontSize: font.sizes.sm },
});
