import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, ImageBackground, Pressable, RefreshControl, ScrollView, TextInput, useWindowDimensions } from "react-native";
import { Search, SlidersHorizontal, ArrowRight, Clock3, ShieldCheck, UserRoundPlus, UsersRound, FileText } from "lucide-react-native";
import { colors, radii, font } from "../../lib/theme";
import api, { API_URL } from "../../lib/api";
import { spiritualTap } from "../../lib/spiritualSounds";
import { fetchMarketplacePoojas } from "../../lib/marketplace";
import { usePreferences } from "../../lib/preferences";

const LOCAL_POOJAS = [
  { id: "local-gauri-ganesha", slug: "gauri-ganesha-vratha", name: "Gauri and Ganesha Vratha", category: "Festival", duration_hours: 2, base_price: 1800, localImage: require("../../../assets/images/gauri-ganesha-vratha.png") },
  { id: "local-rudra", slug: "rudrabhishek", name: "Rudra Abhishek", category: "Shanti", duration_hours: 2, base_price: 2500, localImage: require("../../../assets/images/ritual-havan.webp") },
  { id: "local-satyanarayan", slug: "satyanarayan", name: "Satyanarayana Puja", category: "Festival", duration_hours: 2, base_price: 2100, localImage: require("../../../assets/images/ritual-kalasha.webp") },
  { id: "local-griha", slug: "griha-pravesh", name: "Griha Pravesh Puja", category: "Home", duration_hours: 3, base_price: 5100, localImage: require("../../../assets/images/hero-purohit.webp") },
  { id: "local-ayudha", slug: "ayudha-puja", name: "Ayudha Puja", category: "Festival", duration_hours: 2, base_price: 1800, localImage: require("../../../assets/images/ritual-kalasha.webp") },
  { id: "local-navagraha", slug: "navagraha-shanti", name: "Navagraha Shanti", category: "Shanti", duration_hours: 3, base_price: 3200, localImage: require("../../../assets/images/ritual-havan.webp") },
  { id: "local-varamahalakshmi", slug: "varamahalakshmi-vratha", name: "Varamahalakshmi Vratha", category: "Festival", duration_hours: 2, base_price: 2200, localImage: require("../../../assets/images/ritual-kalasha.webp") },
  { id: "local-namakarna", slug: "namakarna", name: "Namakarna", category: "Family", duration_hours: 2, base_price: 2600, localImage: require("../../../assets/images/ritual-kalasha.webp") },
  { id: "local-vivaha", slug: "vivaha", name: "Vivaha", category: "Family", duration_hours: 5, base_price: 8500, localImage: require("../../../assets/images/hero-purohit.webp") },
];

const categories = ["All", "Home", "Festival", "Shanti", "Family"];

export default function Home({ navigation }) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const isTablet = width >= 600 && width < 900;
  const columns = desktop ? 3 : isTablet ? 2 : 1;
  const { area } = usePreferences();
  const [poojas, setPoojas] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const load = async () => {
    try {
      const data = await fetchMarketplacePoojas();
      const serverPoojas = (data.poojas || []).map((item) => ({
        ...item,
        duration_hours: Math.max(1, Math.round((item.duration_minutes || 120) / 60)),
        base_price: item.base_price_inr,
      }));
      const known = new Set(serverPoojas.map((item) => item.slug));
      setPoojas([...serverPoojas, ...LOCAL_POOJAS.filter((item) => !known.has(item.slug))]);
    } catch (_) {
      try {
        const { data } = await api.get("/poojas");
        const serverPoojas = data || [];
        const known = new Set(serverPoojas.map((item) => item.slug));
        setPoojas([...serverPoojas, ...LOCAL_POOJAS.filter((item) => !known.has(item.slug))]);
      } catch (error) { setPoojas(LOCAL_POOJAS); }
    }
  };
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const filtered = useMemo(() => poojas.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = category === "All" || item.category === category;
    return matchesQuery && matchesCategory;
  }), [poojas, query, category]);

  const openPooja = (item) => {
    spiritualTap();
    navigation.navigate("PriestList", { poojaSlug: item.slug, poojaName: item.name });
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={filtered}
        key={`${columns}-column-grid`}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        keyExtractor={(p) => p.id || p.slug}
        contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.saffron} />}
        ListHeaderComponent={<>
          <View style={[styles.topbar, desktop && styles.topbarDesktop]}>
            <View>
              <Text style={styles.eyebrow}>SERVING {area.name.toUpperCase()}</Text>
              <Text style={styles.heading}>A ceremony, handled well.</Text>
              <Text style={styles.headingSub}>Discover verified Purohits or invite proposals with one clear request.</Text>
            </View>
            <Pressable accessibilityLabel="Filters" style={({ pressed }) => [styles.iconButton, pressed && styles.controlPressed]}><SlidersHorizontal size={20} color={colors.ink} /></Pressable>
          </View>

          <View style={styles.searchBox}>
            <Search size={19} color={colors.muted2} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search poojas and ceremonies" placeholderTextColor="#8B8B87" style={styles.searchInput} />
          </View>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Explore ceremonies</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {categories.map((item) => {
              const active = category === item;
              return <Pressable key={item} onPress={() => setCategory(item)} style={({ pressed }) => [styles.filter, active && styles.filterActive, pressed && styles.controlPressed]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{item}</Text>
              </Pressable>;
            })}
          </ScrollView>
          <View style={[styles.sectionRow, styles.popularHeading]}>
            <Text style={styles.sectionTitle}>Popular poojas</Text>
            <Text style={styles.sectionMeta}>{filtered.length} ceremonies available</Text>
          </View>
        </>}
        renderItem={({ item }) => {
          const imageSource = item.localImage || (item.image_url ? { uri: item.image_url.startsWith("http") ? item.image_url : `${API_URL}${item.image_url}` } : require("../../../assets/images/ritual-kalasha.webp"));
          return (
            <Pressable testID={`pooja-card-${item.slug}`} style={({ pressed }) => [styles.card, columns > 1 && styles.cardGrid, pressed && styles.cardPressed]} onPress={() => openPooja(item)}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.imageFrame}>
                  <Image source={imageSource} style={styles.image} resizeMode="cover" />
                  <View style={styles.durationBadge}>
                    <Clock3 size={10} color={colors.ink} />
                    <Text style={styles.durationText}>{item.duration_hours} hr</Text>
                  </View>
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.categoryRow}>
                    <Text style={styles.categoryBadgeText}>{item.category || "Ceremony"}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.name}>{item.name}</Text>
                  <View style={styles.priceContainer}>
                    <Text style={styles.pricePrefix}>Starting from </Text>
                    <Text style={styles.priceAmount}>₹{Number(item.base_price).toLocaleString("en-IN")}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardActions}>
                <Pressable
                  testID={`view-profiles-${item.slug}`}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    spiritualTap();
                    navigation.navigate("PriestList", { poojaSlug: item.slug, poojaName: item.name });
                  }}
                  style={({ pressed }) => [styles.cardActionSecondary, pressed && styles.controlPressed]}
                >
                  <UsersRound size={14} color={colors.ink} />
                  <Text style={styles.cardActionSecondaryText}>View Purohits</Text>
                </Pressable>

                <Pressable
                  testID={`request-proposals-${item.slug}`}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    spiritualTap();
                    navigation.navigate("RequestPooja", { poojaSlug: item.slug, poojaName: item.name });
                  }}
                  style={({ pressed }) => [styles.cardActionPrimary, pressed && styles.controlPressed]}
                >
                  <FileText size={14} color={colors.white} />
                  <Text style={styles.cardActionPrimaryText}>Get Proposals</Text>
                  <ArrowRight size={13} color={colors.white} />
                </Pressable>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={<View>
          <Pressable style={({ pressed }) => [styles.hero, desktop && styles.heroDesktop, pressed && styles.panelPressed]} onPress={() => navigation.navigate("RequestPooja")}>
            <ImageBackground source={require("../../../assets/images/ceremony-proposal-editorial-v3.png")} style={styles.heroArtwork} imageStyle={styles.heroArtworkImage}>
              <View style={styles.heroShade} /><View style={[styles.heroCopy, desktop && styles.heroCopyDesktop]}><Text style={styles.heroTagText}>REQUEST PROPOSALS</Text><Text style={[styles.heroTitle, desktop && styles.heroTitleDesktop]}>Invite the right purohit to your ceremony.</Text><Text style={[styles.heroBody, desktop && styles.heroBodyDesktop]}>Share the details, compare verified offers, and choose comfortably.</Text><View style={styles.heroAction}><Text style={styles.heroActionText}>Start a request</Text><ArrowRight size={17} color={colors.white} /></View></View>
            </ImageBackground>
          </Pressable>
          <View style={styles.serviceLinks}>
            <Pressable style={({ pressed }) => [styles.serviceLink, pressed && styles.controlPressed]} onPress={() => navigation.navigate("Chat")}><View style={styles.aiMark}><Text style={styles.om}>ॐ</Text></View><View style={{ flex: 1 }}><Text style={styles.aiEyebrow}>PUROMITRA</Text><Text style={styles.aiTitle}>Ask your pooja assistant</Text><Text style={styles.aiBody}>Get guidance on rituals and samagri.</Text></View><ArrowRight size={18} color={colors.ink} /></Pressable>
            <Pressable style={({ pressed }) => [styles.serviceLink, pressed && styles.controlPressed]} onPress={() => navigation.navigate("RolePicker")}><View style={styles.priestInviteIcon}><UserRoundPlus size={18} color={colors.ink} /></View><View style={{ flex: 1 }}><Text style={styles.aiEyebrow}>FOR PUROHITS</Text><Text style={styles.aiTitle}>Grow your practice</Text><Text style={styles.aiBody}>Receive local ceremony requests.</Text></View><ArrowRight size={18} color={colors.ink} /></Pressable>
          </View>
          <View style={styles.trustRow}><ShieldCheck size={17} color={colors.success} /><Text style={styles.trustText}>Verified purohits · transparent pricing · samagri support</Text></View>
        </View>}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No poojas match your search.</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  content: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 110 },
  contentDesktop: { paddingHorizontal: 32 },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, marginBottom: 16 },
  topbarDesktop: { paddingTop: 20, marginBottom: 20 },
  eyebrow: { fontSize: 10, fontWeight: "700", color: colors.saffron, letterSpacing: .5 },
  heading: { maxWidth: "98%", fontSize: 27, lineHeight: 34, fontFamily: font.semibold, color: colors.ink, marginTop: 4 },
  headingSub: { maxWidth: 470, color: colors.muted2, fontSize: 11, lineHeight: 17, marginTop: 6 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.warmBorder, borderRadius: 22, backgroundColor: colors.white },
  controlPressed: { transform: [{ translateY: 2 }, { scale: .97 }], opacity: .86 },
  panelPressed: { transform: [{ translateY: 3 }, { scale: .988 }], opacity: .92, shadowOpacity: .04 },
  hero: { width: "100%", aspectRatio: 1.95, maxHeight: 260, minHeight: 178, overflow: "hidden", backgroundColor: colors.brandBrown, borderRadius: radii.xl, marginTop: 16 },
  heroDesktop: { aspectRatio: 3.9, minHeight: 230, maxHeight: 280 },
  heroArtwork: { width: "100%", height: "100%", justifyContent: "center" },
  heroArtworkImage: { resizeMode: "cover", borderRadius: radii.xl },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,10,10,.16)" },
  heroCopy: { paddingHorizontal: 16, paddingVertical: 14, justifyContent: "center" },
  heroCopyDesktop: { paddingHorizontal: 26, paddingVertical: 20 },
  heroTagText: { color: colors.saffron, fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
  heroTitle: { color: colors.white, fontSize: 17, lineHeight: 22, fontWeight: "800", marginTop: 4, maxWidth: "86%" },
  heroTitleDesktop: { fontSize: 23, lineHeight: 28 },
  heroBody: { color: "#F0EAE1", fontSize: 11, lineHeight: 15, marginTop: 4, maxWidth: "92%" },
  heroBodyDesktop: { fontSize: 12, lineHeight: 18, maxWidth: "70%" },
  heroAction: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.saffron, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, marginTop: 10 },
  heroActionText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.warmBorder, borderRadius: radii.pill, paddingHorizontal: 16, height: 50, backgroundColor: colors.white, marginTop: 16 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 13, height: "100%" },
  om: { fontSize: 20, color: colors.saffron, fontWeight: "700" },
  aiMark: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted },
  aiEyebrow: { color: colors.saffron, fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
  aiTitle: { color: colors.ink, fontSize: 13, fontWeight: "700", marginTop: 1 },
  aiBody: { color: colors.muted2, fontSize: 11, marginTop: 1 },
  requestBadge: { alignSelf: "center", backgroundColor: colors.brandBrown, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  requestBadgeText: { color: colors.white, fontSize: 8, fontWeight: "700", letterSpacing: .5 },
  priestInvite: { marginTop: 6, minHeight: 68, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.warmBorder, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: colors.white },
  priestInviteIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted },
  priestInviteTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  priestInviteBody: { fontSize: 10, lineHeight: 14, color: colors.muted2, marginTop: 2 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 26 },
  popularHeading: { marginTop: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 23, color: colors.ink, fontWeight: "700" },
  sectionMeta: { fontSize: 11, color: colors.muted2 },
  filters: { gap: 8, paddingVertical: 12 },
  filter: { height: 36, paddingHorizontal: 15, borderRadius: 18, borderWidth: 1, borderColor: colors.warmBorder, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  filterActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  filterText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: colors.white },
  serviceLinks: { marginTop: 16, borderTopWidth: 1, borderColor: colors.warmBorder },
  serviceLink: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderColor: colors.warmBorder, paddingVertical: 12 },
  gridRow: { gap: 14, alignItems: "flex-start" },
  card: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#EBE7DF",
    padding: 13,
    marginBottom: 13,
    shadowColor: "#2D2013",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardGrid: { flex: 1, width: "auto" },
  cardPressed: { opacity: 0.94, transform: [{ translateY: 2 }, { scale: 0.99 }] },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  imageFrame: {
    width: 90,
    height: 90,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.muted,
    position: "relative",
  },
  image: { width: "100%", height: "100%" },
  durationBadge: {
    position: "absolute",
    bottom: 5,
    left: 5,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  durationText: { fontSize: 9, fontWeight: "700", color: colors.ink },
  cardInfo: { flex: 1, justifyContent: "center" },
  categoryRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  categoryBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: colors.saffron,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  name: { fontSize: 16, lineHeight: 21, color: colors.ink, fontWeight: "700" },
  priceContainer: { flexDirection: "row", alignItems: "baseline", marginTop: 5 },
  pricePrefix: { fontSize: 11, color: colors.muted2, fontWeight: "500" },
  priceAmount: { fontSize: 14, fontWeight: "800", color: colors.ink },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#F4F1EC",
  },
  cardActionSecondary: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E2DDD5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FBF9F5",
    paddingHorizontal: 8,
  },
  cardActionSecondaryText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  cardActionPrimary: {
    flex: 1.15,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandBrown,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  cardActionPrimaryText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  trustRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingVertical: 18, borderTopWidth: 1, borderColor: colors.warmBorder },
  trustText: { flex: 1, fontSize: 11, color: colors.muted2 },
  empty: { paddingVertical: 40 },
  emptyText: { textAlign: "center", color: colors.muted2 },
});
