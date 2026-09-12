import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BotMessageSquare, CornerDownRight, MousePointer2, Send, Sparkles, X } from "lucide-react-native";
import { colors, font, radii, shadow, spacing } from "../lib/theme";
import { askDAPGuide, getDAPHistory } from "../lib/puromitra";
import { useAuth } from "../lib/auth";
import { usePreferences } from "../lib/preferences";

const DAP_SESSION_PREFIX = "dap-guide-session";

export default function DAPWidget({ navigationRef }) {
  const { user, role } = useAuth();
  const { language } = usePreferences();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const pulse = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef();

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  useEffect(() => {
    let alive = true;
    const boot = async () => {
      const userKey = user?.id || user?.phone || role || "guest";
      const key = `${DAP_SESSION_PREFIX}:${userKey}`;
      let nextSession = await AsyncStorage.getItem(key);
      if (!nextSession) {
        nextSession = `${DAP_SESSION_PREFIX}-${userKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 120);
        await AsyncStorage.setItem(key, nextSession);
      }
      if (!alive) return;
      setSessionId(nextSession);
      try {
        const data = await getDAPHistory({ sessionId: nextSession, language, user: user || { role } });
        const saved = Array.isArray(data.messages) ? data.messages : [];
        setMessages(saved.length ? saved : [{
          role: "assistant",
          content: "I can guide you around Purohith Connect. Ask me where to book, compare proposals, message customers, or update availability.",
        }]);
      } catch {
        setMessages([{
          role: "assistant",
          content: "I can guide you around Purohith Connect. Ask me what you want to do next.",
        }]);
      }
    };
    boot();
    return () => { alive = false; };
  }, [language, role, user]);

  const navigateToTarget = (target) => {
    if (!navigationRef?.isReady?.()) return;
    if (["Home", "Bookings", "Messages", "Chat", "Profile", "Dashboard", "Marketplace", "Availability"].includes(target)) {
      navigationRef.navigate("Tabs", { screen: target });
      setOpen(false);
      return;
    }
    navigationRef.navigate(target);
    setOpen(false);
  };

  const send = async (value) => {
    const text = (value || input).trim();
    if (!text || busy || !sessionId) return;
    setInput("");
    setMessages((items) => [...items, { role: "user", content: text }]);
    setBusy(true);
    try {
      const route = navigationRef?.getCurrentRoute?.()?.name || "";
      const data = await askDAPGuide({ sessionId, message: text, language, user: user || { role }, currentRoute: route });
      setMessages((items) => [...items, { role: "assistant", content: data.reply || "I can guide you through that.", actions: data.actions || [] }]);
    } catch (error) {
      setMessages((items) => [...items, { role: "assistant", content: error?.message || "Guide is unavailable right now. Please try again." }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  if (!user) return null;

  return (
    <>
      <Animated.View pointerEvents="box-none" style={[styles.fabWrap, { transform: [{ scale: pulse }] }]}>
        <Pressable testID="dap-open" onPress={() => setOpen(true)} style={styles.fab}>
          <MousePointer2 size={20} color={colors.white} />
          <View style={styles.fabSpark}><Sparkles size={12} color={colors.saffron} /></View>
        </Pressable>
      </Animated.View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.dismissArea} onPress={() => setOpen(false)} />
          <View style={styles.panel}>
            <View style={styles.header}>
              <View style={styles.mark}><BotMessageSquare size={20} color={colors.saffron} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Guide</Text>
                <Text style={styles.subtitle}>Digital adoption assistant</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={styles.iconButton}><X size={18} color={colors.ink} /></Pressable>
            </View>

            <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={{ gap: 10 }}>
              {messages.map((message, index) => (
                <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.assistantBubble]}>
                  <Text style={[styles.messageText, message.role === "user" && { color: colors.white }]}>{message.content}</Text>
                  {message.actions?.map((action) => (
                    <Pressable key={`${action.type}-${action.target}`} onPress={() => navigateToTarget(action.target)} style={styles.action}>
                      <CornerDownRight size={14} color={colors.white} />
                      <Text style={styles.actionText}>{action.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
              {busy && (
                <View style={[styles.bubble, styles.assistantBubble]}>
                  <Text style={styles.messageText}>Looking around the app...</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.quickRow}>
              {["Book a puja", "Find messages", role === "priest" ? "Set availability" : "Compare proposals"].map((item) => (
                <Pressable key={item} onPress={() => send(item)} style={styles.quick}>
                  <Text style={styles.quickText}>{item}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.inputRow}>
              <TextInput
                testID="dap-input"
                value={input}
                onChangeText={setInput}
                placeholder="Ask where to go..."
                placeholderTextColor={colors.muted2}
                style={styles.input}
                onSubmitEditing={() => send()}
                returnKeyType="send"
              />
              <Pressable testID="dap-send" onPress={() => send()} disabled={busy || !input.trim()} style={[styles.send, (busy || !input.trim()) && { opacity: 0.45 }]}>
                <Send size={17} color={colors.white} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: { position: "absolute", right: 18, bottom: Platform.OS === "ios" ? 98 : 86, zIndex: 50 },
  fab: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center", ...shadow.saffron },
  fabSpark: { position: "absolute", right: -2, top: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.warmBorder },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(20,17,14,0.22)" },
  dismissArea: { flex: 1 },
  panel: { margin: spacing.md, borderRadius: 26, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder, overflow: "hidden", maxHeight: "78%", ...shadow.card },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.lg, borderBottomWidth: 1, borderColor: colors.warmBorder },
  mark: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFF1EB", alignItems: "center", justifyContent: "center" },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  subtitle: { color: colors.muted2, fontSize: font.sizes.xs, marginTop: 2 },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
  messages: { padding: spacing.lg, maxHeight: 360 },
  bubble: { maxWidth: "88%", paddingHorizontal: 13, paddingVertical: 11, borderRadius: 18 },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.brandBrown, borderBottomRightRadius: 5 },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: colors.muted, borderBottomLeftRadius: 5 },
  messageText: { color: colors.ink, fontSize: font.sizes.sm, lineHeight: 19 },
  action: { marginTop: 10, minHeight: 34, borderRadius: radii.pill, backgroundColor: colors.saffron, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12 },
  actionText: { color: colors.white, fontSize: font.sizes.xs, fontWeight: "800" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  quick: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.cotton, paddingHorizontal: 10, paddingVertical: 7 },
  quickText: { color: colors.muted2, fontSize: font.sizes.xs, fontWeight: "700" },
  inputRow: { flexDirection: "row", gap: 8, padding: spacing.lg, borderTopWidth: 1, borderColor: colors.warmBorder },
  input: { flex: 1, height: 44, borderRadius: radii.pill, backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.warmBorder, paddingHorizontal: spacing.md, color: colors.ink, fontSize: font.sizes.sm },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" },
});
