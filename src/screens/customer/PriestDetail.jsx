import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, useWindowDimensions } from "react-native";
import { Star, ShieldCheck, Languages, MapPin, Clock3, Send } from "lucide-react-native";
import { colors, spacing, font } from "../../lib/theme";
import { Button, Card } from "../../components/UI";
import { useI18n } from "../../lib/i18n";
import api, { API_URL } from "../../lib/api";
import { fetchMarketplaceProfile } from "../../lib/marketplace";

export default function PriestDetail({ route, navigation }) {
  const { priestId, poojaSlug } = route.params || {};
  const { t, language } = useI18n();
  const [priest, setPriest] = useState(null);
  const [reviews, setReviews] = useState([]);
  const { width } = useWindowDimensions();
  const desktop = width >= 860;

  useEffect(() => {
    fetchMarketplaceProfile(priestId).then((data) => {
      setPriest(data.profile);
      setReviews(data.profile?.reviews || []);
    }).catch(() => api.get(`/priests/${priestId}`).then(({ data }) => setPriest(data)).catch(() => {}));
    api.get(`/priests/${priestId}/reviews`).then(({ data }) => setReviews(data)).catch(() => {});
  }, [priestId]);

  if (!priest) return <View style={{ flex: 1, backgroundColor: colors.cotton, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.saffron} /></View>;
  const experience = priest.experience ?? priest.experience_years ?? 0;
  const rating = priest.rating ?? priest.rating_avg ?? 0;
  const reviewCount = priest.reviews_count ?? priest.rating_count ?? reviews.length;
  const specialties = priest.pooja_specialties || priest.pooja_slugs || priest.poojas_offered || priest.poojas || [];
  const offeredSlugs = new Set([
    ...(priest.services || []).map((s) => s.pooja_slug),
    ...(priest.pooja_slugs || []),
    ...specialties.map(normalizePoojaSlug),
  ].filter(Boolean));
  const isRequestedPoojaOffered = Boolean(poojaSlug && (offeredSlugs.has(poojaSlug) || offeredSlugs.has(normalizePoojaSlug(poojaSlug))));
  const defaultPoojaSlug = isRequestedPoojaOffered
    ? poojaSlug
    : (priest.services?.[0]?.pooja_slug || (priest.pooja_slugs && priest.pooja_slugs[0]) || normalizePoojaSlug(specialties[0]) || "satyanarayan");
  const serviceAreas = priest.areas || priest.service_areas || [];
  const starting = priest.starting_price_inr || 100;
  const maxPrice = priest.max_price_inr || 80000;
  const portrait = priest.photo_url ? { uri: priest.photo_url.startsWith("http") ? priest.photo_url : `${API_URL}${priest.photo_url}` } : require("../../../assets/images/purohithconnect-logo.png");
  const portfolio = (priest.portfolio || priest.portfolio_urls || []).map((item) => typeof item === "string" ? { uri: item.startsWith("http") ? item : `${API_URL}${item}` } : item);

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {poojaSlug && !isRequestedPoojaOffered ? (
          <View style={styles.notOfferedBanner}>
            <Text style={styles.notOfferedText}>
              {priest.name} does not perform {labelFromSlug(poojaSlug)}. You can book their available ceremonies below, or request proposals from other purohits.
            </Text>
          </View>
        ) : null}
        <View style={[styles.hero, desktop && styles.heroDesktop]}>
          <View style={styles.portraitWrap}><Image source={portrait} style={[styles.avatar, desktop && styles.avatarDesktop]} /><View style={styles.onlineDot} /></View>
          <View style={[styles.heroBody, desktop && styles.heroBodyDesktop]}>
            {priest.verified && <View style={styles.verified}><ShieldCheck size={14} color={colors.success} /><Text style={styles.verifiedText}>Verified purohit</Text></View>}
            <Text style={styles.name}>{priest.name}</Text>
            <View style={styles.ratingRow}><Star size={14} fill={colors.ink} color={colors.ink} /><Text style={styles.rating}>{Number(rating).toFixed(1)}</Text><Text style={styles.meta}>· {reviewCount} reviews · {experience}+ years</Text></View>
            <View style={styles.pricePill}><Text style={styles.pricePillText}>Starts ₹{Number(starting).toLocaleString("en-IN")} · up to ₹{Number(maxPrice).toLocaleString("en-IN")}</Text></View>
            <View style={styles.replyPromise}><Clock3 size={14} color={colors.ink} /><Text style={styles.replyPromiseText}>Usually responds within 30 minutes</Text></View>
          </View>
        </View>

        <View style={styles.statRail}><View style={styles.profileStat}><Text style={styles.profileStatValue}>{experience}+</Text><Text style={styles.profileStatLabel}>Years</Text></View><View style={styles.profileStat}><Text style={styles.profileStatValue}>{Number(rating).toFixed(1)}</Text><Text style={styles.profileStatLabel}>Rating</Text></View><View style={styles.profileStat}><Text style={styles.profileStatValue}>{reviewCount}</Text><Text style={styles.profileStatLabel}>Reviews</Text></View></View>

        <View style={styles.sectionBlock}>
          <Text style={styles.section}>{language === "kn" ? "ಪುರೋಹಿತರ ಬಗ್ಗೆ" : "About"}</Text>
          <Text style={styles.body}>{priest.bio || "—"}</Text>
        </View>

        {portfolio.length ? <View style={styles.portfolioBlock}>
          <View style={styles.portfolioHead}><View><Text style={styles.section}>Ceremony portfolio</Text><Text style={styles.portfolioSub}>Verified work shared by this Purohit</Text></View><Text style={styles.portfolioCount}>{portfolio.length} photos</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolioRail}>{portfolio.map((source, index) => <Image key={index} source={source} style={[styles.portfolioImage, desktop && styles.portfolioImageDesktop]} resizeMode="cover" />)}</ScrollView>
        </View> : null}

        <View style={styles.sectionBlock}>
          <View style={styles.detailTitle}><Languages size={16} color={colors.ink} /><Text style={styles.section}>{language === "kn" ? "ಭಾಷೆಗಳು" : "Languages"}</Text></View>
          <Text style={styles.body}>{(priest.languages || []).join(" · ") || "—"}</Text>
          <Text style={[styles.section, { marginTop: spacing.md }]}>{language === "kn" ? "ಪೂಜಾ ವಿಶೇಷತೆಗಳು" : "Pooja specialties"}</Text>
          <Text style={styles.body}>{specialties.join(" · ") || "—"}</Text>
          <View style={[styles.detailTitle, { marginTop: spacing.md }]}><MapPin size={16} color={colors.ink} /><Text style={styles.section}>{language === "kn" ? "ಸೇವಾ ಪ್ರದೇಶಗಳು" : "Serves in"}</Text></View>
          <Text style={styles.body}>{serviceAreas.join(" · ") || "—"}</Text>
        </View>

        <Text style={[styles.section, { marginTop: spacing.xl, marginHorizontal: spacing.lg }]}>{language === "kn" ? "ವಿಮರ್ಶೆಗಳು" : "Reviews"} ({reviews.length})</Text>
        {reviews.slice(0, 5).map((r) => (
          <Card key={r.id} style={{ marginTop: spacing.sm, marginHorizontal: spacing.lg }}>
            <Text style={{ color: colors.saffron, fontWeight: "700" }}>★ {r.rating}</Text>
            <Text style={styles.body}>{r.comment}</Text>
            <Text style={styles.meta}>{r.customer_name} · {(r.created_at || "").slice(0, 10)}</Text>
          </Card>
        ))}
      </ScrollView>

      <View style={styles.stickyBar}>
        <Button
          testID="book-now-btn"
          title={t.bookNow}
          onPress={() => navigation.navigate("Booking", { priestId, poojaSlug: defaultPoojaSlug })}
          style={styles.stickyPrimary}
        />
        <Button
          testID="request-profile-proposal-btn"
          title="Request proposals"
          variant="outline"
          icon={Send}
          onPress={() => navigation.navigate("RequestPooja", { poojaSlug: defaultPoojaSlug, poojaName: labelFromSlug(defaultPoojaSlug) })}
          style={styles.stickySecondary}
        />
      </View>
    </View>
  );
}

function normalizePoojaSlug(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";
  if (text.includes("satya")) return "satyanarayan";
  if (text.includes("griha") || text.includes("gruh")) return "griha-pravesh";
  if (text.includes("rudra")) return "rudrabhishek";
  if (text.includes("ganesha") || text.includes("gauri")) return "gauri-ganesha-vratha";
  if (text.includes("ayudha")) return "ayudha-puja";
  if (text.includes("navagraha")) return "navagraha-shanti";
  if (text.includes("lakshmi") || text.includes("varamahalakshmi")) return "varamahalakshmi-vratha";
  if (text.includes("namakar")) return "namakarna";
  if (text.includes("vivaha")) return "vivaha";
  return text.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function labelFromSlug(slug) {
  return String(slug || "").split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

const styles = StyleSheet.create({
  notOfferedBanner: {
    backgroundColor: "#FFF8F0",
    borderBottomWidth: 1,
    borderColor: colors.warmBorder,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  notOfferedText: {
    color: colors.brandBrownDark,
    fontSize: 12,
    lineHeight: 18,
  },
  hero: { backgroundColor: colors.white, alignItems: "center", paddingHorizontal: 20, paddingTop: 26, paddingBottom: 22 },
  heroDesktop: { maxWidth: 820, width: "100%", alignSelf: "center", flexDirection: "row", textAlign: "left", paddingVertical: 34 },
  portraitWrap: { position: "relative" },
  avatar: { width: 128, height: 128, borderRadius: 64, backgroundColor: colors.muted, resizeMode: "cover" },
  avatarDesktop: { width: 154, height: 154, borderRadius: 77 },
  onlineDot: { position: "absolute", width: 20, height: 20, borderRadius: 10, right: 5, bottom: 8, backgroundColor: colors.success, borderWidth: 4, borderColor: colors.white },
  heroBody: { width: "100%", alignItems: "center", marginTop: 17 },
  heroBodyDesktop: { flex: 1, alignItems: "flex-start", marginTop: 0, marginLeft: 30 },
  verified: { flexDirection: "row", alignItems: "center", gap: 6 },
  verifiedText: { fontSize: 10, color: colors.success, fontWeight: "700", textTransform: "uppercase" },
  name: { fontSize: 28, lineHeight: 34, fontWeight: "700", color: colors.ink, marginTop: 9 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  pricePill: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15, backgroundColor: "#FFF1EB" },
  pricePillText: { color: colors.saffronDark, fontSize: 12, fontWeight: "800" },
  replyPromise: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderColor: colors.warmBorder },
  replyPromiseText: { fontSize: 11, color: colors.muted2, fontWeight: "650" },
  rating: { fontSize: 12, color: colors.ink, fontWeight: "700" },
  meta: { fontSize: font.sizes.xs, color: colors.muted2 },
  statRail: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.warmBorder, maxWidth: 820, width: "100%", alignSelf: "center" },
  profileStat: { flex: 1, minHeight: 82, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderColor: colors.warmBorder }, profileStatValue: { color: colors.ink, fontSize: 18, fontWeight: "700" }, profileStatLabel: { color: colors.muted2, fontSize: 10, marginTop: 4 },
  sectionBlock: { padding: 20, borderBottomWidth: 1, borderColor: colors.warmBorder },
  portfolioBlock: { paddingVertical: 20, borderBottomWidth: 1, borderColor: colors.warmBorder }, portfolioHead: { paddingHorizontal: 20, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }, portfolioSub: { color: colors.muted2, fontSize: 10, marginTop: 3 }, portfolioCount: { color: colors.brandOrangeDark, fontSize: 10, fontWeight: "800" }, portfolioRail: { gap: 10, paddingHorizontal: 20, paddingTop: 13 }, portfolioImage: { width: 236, height: 178, borderRadius: 10, backgroundColor: colors.muted }, portfolioImageDesktop: { width: 310, height: 220 },
  detailTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  section: { fontSize: font.sizes.sm, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  body: { fontSize: font.sizes.sm, color: colors.muted2, lineHeight: 20 },
  stickyBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.warmBorder,
    flexDirection: "row", gap: 10, justifyContent: "center",
  },
  stickyPrimary: { flex: 1, maxWidth: 340 },
  stickySecondary: { flex: 1, maxWidth: 260 },
});
