import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Image, ScrollView, TextInput, useWindowDimensions } from "react-native";
import { MapPin, Languages, ShieldCheck, ArrowRight, SlidersHorizontal, BadgeCheck, Search, Check, X } from "lucide-react-native";
import { colors, font } from "../../lib/theme";
import api, { API_URL } from "../../lib/api";
import { fetchMarketplacePriests } from "../../lib/marketplace";
import BrandLogo from "../../components/BrandLogo";

const POOJA_FILTERS = [
  ["all", "All Pujas"], ["gauri-ganesha-vratha", "Gauri Ganesha"], ["rudrabhishek", "Rudra Abhishek"],
  ["satyanarayan", "Satyanarayana"], ["griha-pravesh", "Griha Pravesh"], ["ayudha-puja", "Ayudha Puja"],
  ["navagraha-shanti", "Navagraha Shanti"], ["varamahalakshmi-vratha", "Varalakshmi"], ["namakarna", "Namakarna"], ["vivaha", "Vivaha"],
];
const LANGUAGE_FILTERS = ["All", "Kannada", "Sanskrit", "Hindi", "Marathi", "Tamil", "Telugu", "English"];
const AREA_FILTERS = ["All", "Bengaluru", "South India", "Delhi NCR", "Mumbai", "Pune", "North India"];
const PRICE_BANDS = [
  { label: "All", min: 0, max: 0 },
  { label: "₹100 - ₹5K", min: 100, max: 5000 },
  { label: "₹5K - ₹15K", min: 5000, max: 15000 },
  { label: "₹15K - ₹50K", min: 15000, max: 50000 },
  { label: "₹50K - ₹80K", min: 50000, max: 80000 },
];

export default function PriestList({ route, navigation }) {
  const { width } = useWindowDimensions();
  const { poojaSlug, poojaName, area } = route.params || {};
  const desktop = width >= 980;
  const tablet = width >= 720;
  const [priests, setPriests] = useState([]);
  const [language, setLanguage] = useState("All");
  const [areaFilter, setAreaFilter] = useState(area || "All");
  const [category, setCategory] = useState(poojaSlug || "all");
  const [query, setQuery] = useState("");
  const [priceBand, setPriceBand] = useState("All");
  const activePrice = PRICE_BANDS.find((item) => item.label === priceBand) || PRICE_BANDS[0];
  const activePoojaSlug = category === "all" ? "" : category;

  useEffect(() => {
    fetchMarketplacePriests({
      pooja_slug: activePoojaSlug || undefined,
      area: areaFilter === "All" ? undefined : areaFilter,
      language: language === "All" ? undefined : language,
      query,
      min_price_inr: activePrice.min,
      max_price_inr: activePrice.max,
    })
      .then((data) => setPriests(data?.priests || []))
      .catch(() => api.get("/priests", { params: { pooja: activePoojaSlug || undefined, area: areaFilter === "All" ? undefined : areaFilter, language: language === "All" ? undefined : language } })
        .then(({ data }) => setPriests(Array.isArray(data) ? data : []))
        .catch(() => setPriests([])));
  }, [activePoojaSlug, activePrice.max, activePrice.min, areaFilter, language, query]);

  const filtered = useMemo(() => priests.filter((p) => {
    const languages = p.languages || [];
    const areas = p.areas || p.service_areas || [];
    const slugs = p.pooja_slugs || p.pooja_specialties || [];
    const starting = Number(p.starting_price_inr || 0);
    const max = Number(p.max_price_inr || starting || 0);
    const text = [p.name, p.display_name, p.tradition, p.bio, ...languages, ...areas, ...slugs].join(" ").toLowerCase();
    const matchesLanguage = language === "All" || languages.includes(language);
    const matchesArea = areaFilter === "All" || areas.some((item) => item.toLowerCase().includes(areaFilter.toLowerCase()));
    const matchesCategory = category === "all" || slugs.includes(category);
    const matchesPrice = priceBand === "All" || (max >= activePrice.min && starting <= activePrice.max);
    const matchesSearch = !query || text.includes(query.toLowerCase());
    return matchesLanguage && matchesArea && matchesCategory && matchesPrice && matchesSearch;
  }), [activePrice.max, activePrice.min, areaFilter, category, language, priceBand, priests, query]);

  const clearAll = () => {
    setLanguage("All");
    setAreaFilter("All");
    setCategory("all");
    setPriceBand("All");
    setQuery("");
  };

  return (
    <View style={styles.root}>
      <View style={styles.marketHeader}>
        <BrandLogo width={104} height={46} showText={false} style={styles.brandMark} />
        <View style={styles.searchBox}><Search size={19} color={colors.muted2} /><TextInput value={query} onChangeText={setQuery} placeholder="Search priests, rituals, languages and areas" placeholderTextColor="#8B8B87" style={styles.searchInput} /></View>
        <View style={styles.headerIcon}><SlidersHorizontal size={20} color={colors.ink} /></View>
      </View>

      <View style={styles.breadcrumb}><Text style={styles.crumb}>Home / Purohits / </Text><Text style={styles.crumbStrong}>{poojaName || labelForCategory(category)}</Text></View>
      <View style={styles.titleRow}><Text style={styles.title}>{poojaName || "Purohit marketplace"} <Text style={styles.itemCount}>- {filtered.length} profiles</Text></Text>{desktop ? <Text style={styles.sortBox}>Sort by: Recommended</Text> : null}</View>

      <View style={styles.shell}>
        {desktop ? <View style={styles.sidebar}>
          <View style={styles.filterHead}><Text style={styles.filterHeadText}>FILTERS</Text><Pressable onPress={clearAll}><Text style={styles.clear}>CLEAR ALL</Text></Pressable></View>
          <FilterGroup title="Categories" options={POOJA_FILTERS.map(([value, label]) => ({ value, label }))} value={category} onChange={setCategory} />
          <FilterGroup title="Languages" options={LANGUAGE_FILTERS.map((item) => ({ value: item, label: item }))} value={language} onChange={setLanguage} />
          <FilterGroup title="Service Area" options={AREA_FILTERS.map((item) => ({ value: item, label: item }))} value={areaFilter} onChange={setAreaFilter} />
          <FilterGroup title="Price Range" options={PRICE_BANDS.map((item) => ({ value: item.label, label: item.label }))} value={priceBand} onChange={setPriceBand} />
        </View> : null}

        <FlatList
          style={styles.results}
          contentContainerStyle={styles.resultsContent}
          data={filtered}
          key={desktop ? "desktop-grid" : tablet ? "tablet-grid" : "mobile-list"}
          numColumns={desktop ? 4 : tablet ? 2 : 1}
          columnWrapperStyle={desktop || tablet ? styles.gridRow : undefined}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={!desktop ? <MobileFilters
            category={category} setCategory={setCategory}
            language={language} setLanguage={setLanguage}
            areaFilter={areaFilter} setAreaFilter={setAreaFilter}
            priceBand={priceBand} setPriceBand={setPriceBand}
            clearAll={clearAll}
          /> : <ActiveChips category={category} language={language} areaFilter={areaFilter} priceBand={priceBand} clearAll={clearAll} />}
          renderItem={({ item }) => <PriestCard item={item} desktop={desktop} onPress={() => navigation.navigate("PriestDetail", { priestId: item.id, poojaSlug: activePoojaSlug || poojaSlug })} />}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No matching purohits</Text><Text style={styles.emptySub}>Clear filters or try another language, area, or price range.</Text></View>}
        />
      </View>
    </View>
  );
}

function FilterGroup({ title, options, value, onChange }) {
  return <View style={styles.filterGroup}><Text style={styles.filterTitle}>{title}</Text>{options.map((item) => {
    const active = item.value === value;
    return <Pressable key={item.value} onPress={() => onChange(item.value)} style={styles.checkRow}><View style={[styles.checkBox, active && styles.checkBoxActive]}>{active ? <Check size={13} color={colors.white} /> : null}</View><Text style={[styles.checkLabel, active && styles.checkLabelActive]}>{item.label}</Text></Pressable>;
  })}</View>;
}

function MobileFilters({ category, setCategory, language, setLanguage, areaFilter, setAreaFilter, priceBand, setPriceBand, clearAll }) {
  return <View style={styles.mobileFilters}>
    <View style={styles.mobileFilterTop}><Text style={styles.filterHeadText}>Filters</Text><Pressable onPress={clearAll}><Text style={styles.clear}>Clear all</Text></Pressable></View>
    <ChipRow title="Puja" items={POOJA_FILTERS.map(([value, label]) => ({ value, label }))} value={category} onChange={setCategory} />
    <ChipRow title="Language" items={LANGUAGE_FILTERS.map((item) => ({ value: item, label: item }))} value={language} onChange={setLanguage} />
    <ChipRow title="Area" items={AREA_FILTERS.map((item) => ({ value: item, label: item }))} value={areaFilter} onChange={setAreaFilter} />
    <ChipRow title="Price" items={PRICE_BANDS.map((item) => ({ value: item.label, label: item.label }))} value={priceBand} onChange={setPriceBand} />
  </View>;
}

function ChipRow({ title, items, value, onChange }) {
  return <View><Text style={styles.mobileChipTitle}>{title}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{items.map((item) => {
    const active = item.value === value;
    return <Pressable key={item.value} onPress={() => onChange(item.value)} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text></Pressable>;
  })}</ScrollView></View>;
}

function ActiveChips({ category, language, areaFilter, priceBand, clearAll }) {
  const chips = [
    category !== "all" ? labelForCategory(category) : null,
    language !== "All" ? language : null,
    areaFilter !== "All" ? areaFilter : null,
    priceBand !== "All" ? priceBand : null,
  ].filter(Boolean);
  if (!chips.length) return <View style={styles.activeSpacer} />;
  return <View style={styles.activeChips}>{chips.map((chip) => <View key={chip} style={styles.activeChip}><Text style={styles.activeChipText}>{chip}</Text><X size={13} color={colors.muted2} /></View>)}<Pressable onPress={clearAll}><Text style={styles.clear}>CLEAR ALL</Text></Pressable></View>;
}

function PriestCard({ item, desktop, onPress }) {
  const imageSource = item.image || item.localImage || (item.photo_url ? { uri: item.photo_url.startsWith("http") ? item.photo_url : `${API_URL}${item.photo_url}` } : require("../../../assets/images/purohit-ramachandra.webp"));
  const experience = item.experience ?? item.experience_years ?? 0;
  const rating = item.rating ?? item.rating_avg ?? 0;
  const reviews = item.reviews_count ?? item.rating_count ?? 0;
  const areas = item.areas || item.service_areas || [];
  const starting = item.starting_price_inr || 100;
  const maxPrice = item.max_price_inr || 80000;
  return <Pressable testID={`priest-${item.id}`} onPress={onPress} style={({ pressed }) => [styles.card, desktop && styles.cardDesktop, pressed && styles.cardPressed]}>
    <View style={styles.photoWrap}><Image source={imageSource} style={styles.photo} /><View style={styles.ratingBadge}><Text style={styles.ratingBadgeText}>{Number(rating).toFixed(1)} ★ | {reviews}</Text></View></View>
    <View style={styles.cardBody}>
      <View style={styles.cardTop}><Text numberOfLines={1} style={styles.name}>{item.name}</Text><BadgeCheck size={17} color={colors.ink} /></View>
      <Text numberOfLines={1} style={styles.tradition}>{item.tradition || "Vedic Purohit"}</Text>
      <Text style={styles.price}>₹{Number(starting).toLocaleString("en-IN")} - ₹{Number(maxPrice).toLocaleString("en-IN")}</Text>
      <View style={styles.detail}><Languages size={13} color={colors.muted2} /><Text numberOfLines={1} style={styles.detailText}>{(item.languages || []).join(", ")}</Text></View>
      <View style={styles.detail}><MapPin size={13} color={colors.muted2} /><Text numberOfLines={1} style={styles.detailText}>{areas.join(" · ")}</Text></View>
      <View style={styles.bottomRow}><View style={styles.verified}><ShieldCheck size={13} color={colors.success} /><Text style={styles.verifiedText}>{experience}+ yrs</Text></View><View style={styles.action}><ArrowRight size={15} color={colors.white} /></View></View>
    </View>
  </Pressable>;
}

function labelForCategory(value) {
  return POOJA_FILTERS.find(([slug]) => slug === value)?.[1] || "All Pujas";
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  marketHeader: { minHeight: 74, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: colors.warmBorder, flexDirection: "row", alignItems: "center", gap: 18 },
  brandMark: { width: 104, height: 46, alignItems: "center", justifyContent: "center" },
  searchBox: { flex: 1, maxWidth: 760, height: 50, borderRadius: 6, backgroundColor: colors.muted, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15, paddingVertical: 0 },
  headerIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  breadcrumb: { paddingHorizontal: 20, paddingTop: 22, flexDirection: "row" },
  crumb: { color: colors.muted2, fontSize: 13 },
  crumbStrong: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  titleRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  itemCount: { color: colors.muted2, fontWeight: "500" },
  sortBox: { minWidth: 220, paddingHorizontal: 18, paddingVertical: 13, borderWidth: 1, borderColor: colors.warmBorder, color: colors.ink, fontWeight: "700" },
  shell: { flex: 1, flexDirection: "row", borderTopWidth: 1, borderColor: colors.warmBorder },
  sidebar: { width: 282, borderRightWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white },
  filterHead: { minHeight: 64, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: colors.warmBorder },
  filterHeadText: { color: colors.ink, fontSize: 15, fontWeight: "900", letterSpacing: .2 },
  clear: { color: "#FF4F7A", fontSize: 12, fontWeight: "900" },
  filterGroup: { paddingHorizontal: 18, paddingVertical: 18, borderBottomWidth: 1, borderColor: colors.warmBorder },
  filterTitle: { color: colors.ink, fontSize: 13, fontWeight: "900", marginBottom: 12, textTransform: "uppercase" },
  checkRow: { minHeight: 31, flexDirection: "row", alignItems: "center", gap: 12 },
  checkBox: { width: 18, height: 18, borderRadius: 3, borderWidth: 1.3, borderColor: "#C9CBD3", alignItems: "center", justifyContent: "center" },
  checkBoxActive: { backgroundColor: "#FF4F7A", borderColor: "#FF4F7A" },
  checkLabel: { color: colors.muted2, fontSize: 14, fontWeight: "600" },
  checkLabelActive: { color: colors.ink, fontWeight: "800" },
  results: { flex: 1 },
  resultsContent: { padding: 22, paddingBottom: 70 },
  gridRow: { gap: 22 },
  activeSpacer: { height: 4 },
  activeChips: { minHeight: 46, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  activeChip: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "#D7D8DF" },
  activeChipText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  mobileFilters: { marginBottom: 14 },
  mobileFilterTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  mobileChipTitle: { color: colors.ink, fontSize: 12, fontWeight: "900", marginTop: 8 },
  chips: { gap: 8, paddingVertical: 10 },
  chip: { height: 36, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: colors.warmBorder, justifyContent: "center" },
  chipActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  card: { flex: 1, minWidth: 0, marginBottom: 22, backgroundColor: colors.white },
  cardDesktop: { maxWidth: "25%" },
  cardPressed: { opacity: .9, transform: [{ translateY: 1 }] },
  photoWrap: { aspectRatio: 0.76, backgroundColor: colors.muted, overflow: "hidden", position: "relative" },
  photo: { width: "100%", height: "100%", resizeMode: "cover" },
  ratingBadge: { position: "absolute", left: 10, bottom: 10, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "rgba(255,255,255,.92)", borderRadius: 2 },
  ratingBadgeText: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  cardBody: { paddingTop: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  name: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: "900" },
  tradition: { color: colors.muted2, fontSize: 13, marginTop: 4, fontWeight: "600" },
  price: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 8 },
  detail: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7 },
  detailText: { flex: 1, color: colors.muted2, fontSize: 11, fontWeight: "600" },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  verified: { flexDirection: "row", alignItems: "center", gap: 5 },
  verifiedText: { color: colors.success, fontSize: 11, fontWeight: "800" },
  action: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" },
  empty: { paddingVertical: 70, alignItems: "center" },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  emptySub: { color: colors.muted2, fontSize: font.sizes.sm, marginTop: 7, textAlign: "center" },
});
