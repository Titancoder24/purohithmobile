import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, ImageBackground, Pressable, RefreshControl, ScrollView, TextInput, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, SlidersHorizontal, ArrowRight, Clock3, ShieldCheck, UserRoundPlus, UsersRound, FileText } from "lucide-react-native";
import { colors, radii, spacing, font } from "../../lib/theme";
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
  const columns = desktop ? 3 : width >= 360 ? 2 : 1;
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
    <SafeAreaView style={styles.root} edges={["top"]}>
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
            <Text style={styles.sectionMeta}>{filtered.length} services</Text>
          </View>
        </>}
        renderItem={({ item }) => {
          const imageSource = item.localImage || (item.image_url ? { uri: item.image_url.startsWith("http") ? item.image_url : `${API_URL}${item.image_url}` } : require("../../../assets/images/ritual-kalasha.webp"));
          return <Pressable testID={`pooja-card-${item.slug}`} style={({ pressed }) => [styles.card, columns > 1 && styles.cardGrid, desktop && styles.cardDesktop, pressed && styles.cardPressed]} onPress={() => openPooja(item)}>
            <View style={[styles.imageFrame, desktop && styles.imageFrameDesktop]}><Image source={imageSource} style={styles.image} resizeMode="cover" /></View>
            <View style={styles.cardBody}>
              <View style={styles.cardHeading}><Text numberOfLines={2} style={styles.name}>{item.name}</Text></View>
              <View style={styles.cardMeta}><Clock3 size={13} color={colors.muted2} /><Text style={styles.metaText}>{item.duration_hours} hr</Text></View>
              <View style={styles.priceRow}><Text style={styles.price}>From ₹{Number(item.base_price).toLocaleString("en-IN")}</Text><ArrowRight size={15} color={colors.ink} /></View>
              <View style={styles.cardActions}>
                <Pressable testID={`view-profiles-${item.slug}`} onPress={(event) => { event.stopPropagation?.(); spiritualTap(); navigation.navigate("PriestList", { poojaSlug: item.slug, poojaName: item.name }); }} style={({ pressed }) => [styles.cardAction, pressed && styles.controlPressed]}>
                  <UsersRound size={14} color={colors.ink} /><Text style={styles.cardActionText}>Profiles</Text>
                </Pressable>
                <Pressable testID={`request-proposals-${item.slug}`} onPress={(event) => { event.stopPropagation?.(); spiritualTap(); navigation.navigate("RequestPooja", { poojaSlug: item.slug, poojaName: item.name }); }} style={({ pressed }) => [styles.cardAction, styles.cardActionDark, pressed && styles.controlPressed]}>
                  <FileText size={14} color={colors.white} /><Text style={styles.cardActionDarkText}>Proposals</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>;
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  content: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: 44 },
  contentDesktop: { paddingHorizontal: 32 },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 20, marginBottom: 16 },
  topbarDesktop: { paddingTop: 32, marginBottom: 20 },
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
  heroCopy: { width: "62%", padding: 20, justifyContent: "center" },
  heroCopyDesktop: { width: "48%", padding: 32 },
  heroTag: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6 },
  heroTagText: { color: "#CFCFCF", fontWeight: "700", fontSize: 9, letterSpacing: .6 },
  heroTitle: { color: colors.white, fontWeight: "700", fontSize: 19, lineHeight: 23, marginTop: 10 },
  heroTitleDesktop: { fontSize: 34, lineHeight: 40 },
  heroBody: { color: "#C7C7C7", fontSize: 10, lineHeight: 14, marginTop: 5 },
  heroBodyDesktop: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  heroAction: { height: 36, marginTop: 12, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.saffron, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 3, borderBottomColor: colors.saffronDark, shadowColor: "#000", shadowOpacity: .22, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  heroActionText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  searchBox: { height: 54, borderRadius: 27, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 17, shadowColor: "#000", shadowOpacity: .07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  searchInput: { flex: 1, fontSize: font.sizes.base, color: colors.ink, paddingVertical: 0 },
  aiPanel: { marginTop: 12, minHeight: 76, padding: 14, borderRadius: radii.lg, backgroundColor: "#FFF1EB", flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 3, borderBottomColor: "#E7C8BB", shadowColor: "#9B3A18", shadowOpacity: .08, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  aiMark: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.saffron, alignItems: "center", justifyContent: "center" },
  om: { color: colors.white, fontSize: 24 },
  aiEyebrow: { color: colors.saffronDark, fontSize: 9, fontWeight: "700" },
  aiTitle: { color: colors.ink, fontSize: 15, fontWeight: "700", marginTop: 2 },
  aiBody: { color: colors.muted2, fontSize: 11, marginTop: 3 },
  requestPanel: { marginTop: 10, minHeight: 72, padding: 13, borderRadius: radii.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder, borderBottomWidth: 3, borderBottomColor: "#D8D5CF", flexDirection: "row", alignItems: "center", gap: 11, shadowColor: "#000", shadowOpacity: .06, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  requestBadge: { alignSelf: "center", backgroundColor: colors.brandBrown, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  requestBadgeText: { color: colors.white, fontSize: 8, fontWeight: "700", letterSpacing: .5 },
  requestTitle: { color: colors.ink, fontSize: 14, fontWeight: "700", lineHeight: 18 },
  requestBody: { color: colors.muted2, fontSize: 10, lineHeight: 14, marginTop: 3 },
  priestInvite: { marginTop: 6, minHeight: 68, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.warmBorder, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: colors.white },
  priestInviteIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted },
  priestInviteTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  priestInviteBody: { fontSize: 10, lineHeight: 14, color: colors.muted2, marginTop: 2 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 30 },
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
  card: { width: "100%", overflow: "hidden", backgroundColor: colors.white, marginBottom: 24 },
  cardGrid: { flex: 1, width: "auto", maxWidth: "49%" },
  cardDesktop: { maxWidth: "32.5%" },
  cardPressed: { opacity: .9, transform: [{ translateY: 2 }, { scale: .985 }] },
  imageFrame: { width: "100%", aspectRatio: 1.25, maxHeight: 150, overflow: "hidden", borderRadius: radii.md, backgroundColor: colors.muted },
  imageFrameDesktop: { aspectRatio: 1.42, maxHeight: 210 },
  image: { width: "100%", height: "100%" },
  cardBody: { paddingTop: 11, paddingHorizontal: 2 },
  cardHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  name: { flex: 1, fontSize: 14, lineHeight: 19, color: colors.ink, fontWeight: "700" },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  metaText: { fontSize: 11, color: colors.muted2 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  price: { color: colors.ink, fontWeight: "700", fontSize: 12 },
  cardActions: { flexDirection: "row", gap: 6, marginTop: 11 },
  cardAction: { flex: 1, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.warmBorder, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.white },
  cardActionDark: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown, borderBottomWidth: 3, borderBottomColor: colors.brandBrownDark },
  cardActionText: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  cardActionDarkText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  trustRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingVertical: 18, borderTopWidth: 1, borderColor: colors.warmBorder },
  trustText: { flex: 1, fontSize: 11, color: colors.muted2 },
  empty: { paddingVertical: 40 },
  emptyText: { textAlign: "center", color: colors.muted2 },
});
