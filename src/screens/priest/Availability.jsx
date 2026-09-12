import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3 } from "lucide-react-native";
import { colors, font } from "../../lib/theme";
import { Button } from "../../components/UI";
import { useAuth } from "../../lib/auth";
import api from "../../lib/api";

const TIME_SLOTS = ["06:00", "07:30", "09:00", "10:30", "16:00", "17:30", "19:00"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (date) => date.toISOString().slice(0, 10);
function nextDays(count = 28) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export default function Availability() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const [blocked, setBlocked] = useState(new Set());
  const [availabilitySlots, setAvailabilitySlots] = useState({});
  const [selectedDate, setSelectedDate] = useState(iso(nextDays(1)[0]));
  const [saving, setSaving] = useState(false);
  const days = useMemo(() => nextDays(), []);
  const desktop = width >= 820;

  useEffect(() => {
    if (!user?.demo) api.get("/priest/me").then(({ data }) => {
      setBlocked(new Set(data.blocked_dates || []));
      setAvailabilitySlots(data.availability_slots || {});
    }).catch(() => {});
  }, [user?.demo]);

  const toggleDate = (date) => setBlocked((current) => {
    const next = new Set(current);
    if (next.has(date)) next.delete(date); else next.add(date);
    return next;
  });
  const currentSlots = availabilitySlots[selectedDate] ?? TIME_SLOTS;
  const toggleSlot = (slot) => setAvailabilitySlots((current) => {
    const selection = current[selectedDate] ?? TIME_SLOTS;
    const nextSelection = selection.includes(slot) ? selection.filter((item) => item !== slot) : [...selection, slot].sort((a, b) => TIME_SLOTS.indexOf(a) - TIME_SLOTS.indexOf(b));
    return { ...current, [selectedDate]: nextSelection };
  });
  const save = async () => {
    setSaving(true);
    try {
      if (!user?.demo) await api.patch("/priest/availability", { blocked_dates: Array.from(blocked), availability_slots: availabilitySlots });
      Alert.alert("Availability saved", "Your calendar and ceremony times are updated.");
    } catch (error) {
      Alert.alert("Could not save", error?.response?.data?.detail || "Try again.");
    } finally { setSaving(false); }
  };

  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <View style={styles.header}><View><Text style={styles.kicker}>CEREMONY SCHEDULE</Text><Text style={styles.title}>Availability</Text><Text style={styles.subtitle}>Choose the dates and time windows where customers can book you.</Text></View><View style={styles.headerIcon}><CalendarDays size={20} color={colors.ink} /></View></View>
    <View style={[styles.workspace, desktop && styles.workspaceDesktop]}>
      <View style={[styles.panel, desktop && styles.calendarPanel]}>
        <View style={styles.calendarHeader}><View><Text style={styles.panelTitle}>Upcoming dates</Text><Text style={styles.panelMeta}>Select a date to manage its schedule</Text></View><View style={styles.monthControls}><ChevronLeft size={16} color={colors.muted2} /><ChevronRight size={16} color={colors.ink} /></View></View>
        <View style={styles.weekdays}>{DAY_LABELS.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
        <View style={styles.calendar}>{days.map((day) => {
          const date = iso(day); const isBlocked = blocked.has(date); const isSelected = selectedDate === date;
          return <Pressable key={date} testID={`avail-${date}`} onPress={() => setSelectedDate(date)} style={[styles.dateCell, isSelected && styles.dateSelected, isBlocked && styles.dateBlocked]}><Text style={[styles.dateNum, (isSelected || isBlocked) && styles.dateNumActive]}>{day.getDate()}</Text><View style={[styles.dateDot, isBlocked && styles.dateDotBlocked]} /></Pressable>;
        })}</View>
      </View>
      <View style={[styles.panel, desktop && styles.slotPanel]}>
        <View style={styles.slotHeader}><View style={styles.slotIcon}><Clock3 size={17} color={colors.ink} /></View><View style={{ flex: 1 }}><Text style={styles.slotTitle}>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</Text><Text style={styles.slotSub}>{blocked.has(selectedDate) ? "This date is unavailable" : `${currentSlots.length} bookable time slots`}</Text></View><Pressable onPress={() => toggleDate(selectedDate)} style={[styles.blockToggle, blocked.has(selectedDate) && styles.blockToggleActive]}><Text style={[styles.blockToggleText, blocked.has(selectedDate) && styles.blockToggleTextActive]}>{blocked.has(selectedDate) ? "Open" : "Block"}</Text></Pressable></View>
        <Text style={styles.slotLabel}>AVAILABLE TIMES</Text>
        <View style={styles.slots}>{TIME_SLOTS.map((slot) => {
          const active = !blocked.has(selectedDate) && currentSlots.includes(slot);
          return <Pressable key={slot} onPress={() => toggleSlot(slot)} disabled={blocked.has(selectedDate)} style={[styles.slot, active && styles.slotActive, blocked.has(selectedDate) && styles.slotDisabled]}><Text style={[styles.slotText, active && styles.slotTextActive]}>{slot}</Text>{active ? <Check size={13} color={colors.white} /> : null}</Pressable>;
        })}</View>
        <View style={styles.legend}><View style={styles.legendDot} /><Text style={styles.legendText}>Selected times are visible to customers immediately after saving.</Text></View>
      </View>
    </View>
    <Button title={saving ? "Saving..." : "Save availability"} onPress={save} disabled={saving} style={styles.save} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  content: { width: "100%", maxWidth: 980, alignSelf: "center", padding: 20, paddingBottom: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 6 },
  kicker: { color: colors.saffron, fontSize: 10, fontWeight: "700", letterSpacing: .8 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 36, fontFamily: font.semibold, marginTop: 6 },
  subtitle: { color: colors.muted2, fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 360 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
  workspace: { marginTop: 24, gap: 16 }, workspaceDesktop: { flexDirection: "row", alignItems: "flex-start" },
  panel: { borderWidth: 1, borderColor: colors.warmBorder, borderRadius: 12, padding: 16, backgroundColor: colors.white },
  calendarPanel: { flex: 1.35 }, slotPanel: { flex: 1 },
  calendarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 13, borderBottomWidth: 1, borderColor: colors.warmBorder },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" }, panelMeta: { color: colors.muted2, fontSize: 10, marginTop: 3 }, monthControls: { flexDirection: "row", gap: 16 },
  weekdays: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 14 }, weekday: { width: "14.28%", color: colors.muted2, fontSize: 10, fontWeight: "600", textAlign: "center" },
  calendar: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, dateCell: { width: "12.12%", aspectRatio: 1, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }, dateSelected: { backgroundColor: colors.brandBrown }, dateBlocked: { backgroundColor: "#9C3C3C" }, dateNum: { color: colors.ink, fontSize: 13, fontWeight: "600" }, dateNumActive: { color: colors.white }, dateDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.warmBorder, marginTop: 3 }, dateDotBlocked: { backgroundColor: colors.white },
  slotHeader: { flexDirection: "row", alignItems: "center", gap: 11 }, slotIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }, slotTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" }, slotSub: { color: colors.muted2, fontSize: 10, marginTop: 3 },
  blockToggle: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.warmBorder, alignItems: "center", justifyContent: "center" }, blockToggleActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown }, blockToggleText: { color: colors.ink, fontSize: 10, fontWeight: "700" }, blockToggleTextActive: { color: colors.white },
  slotLabel: { marginTop: 24, color: colors.muted2, fontSize: 9, fontWeight: "700", letterSpacing: .7 }, slots: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }, slot: { minWidth: "30%", minHeight: 42, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.warmBorder, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: colors.white }, slotActive: { backgroundColor: colors.brandBrown, borderColor: colors.brandBrown }, slotDisabled: { opacity: .42 }, slotText: { color: colors.ink, fontSize: 11, fontWeight: "600" }, slotTextActive: { color: colors.white },
  legend: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderColor: colors.warmBorder }, legendDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success, marginTop: 3 }, legendText: { flex: 1, color: colors.muted2, fontSize: 10, lineHeight: 15 }, save: { marginTop: 20, maxWidth: 360, width: "100%", alignSelf: "flex-end" },
});
