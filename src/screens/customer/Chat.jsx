import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, Modal, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Clock3, Menu, Plus, Sparkles, Send, X } from "lucide-react-native";
import { colors, radii, spacing, font } from "../../lib/theme";
import { askPuroMitra, getPuroMitraHistory, listPuroMitraThreads } from "../../lib/puromitra";
import { usePreferences } from "../../lib/preferences";
import { useAuth } from "../../lib/auth";

const SESSION_PREFIX = "puromitra-session";

const COPY = {
  en: {
    suggestions: ["Which pooja is right for a housewarming?", "How long does Navagraha take?", "Satyanarayan pooja items", "Cost of Rudrabhisheka?"],
    greeting: "Namaste. I'm PuroMitra. Ask me anything about poojas, samagri, timing or priest choice.",
    subtitle: "Your pooja assistant", thinking: "Thinking...", placeholder: "Ask a question...", fallback: "Sorry, please try again.",
  },
  kn: {
    suggestions: ["ಗೃಹಪ್ರವೇಶಕ್ಕೆ ಯಾವ ಪೂಜೆ ಸೂಕ್ತ?", "ನವಗ್ರಹ ಶಾಂತಿಗೆ ಎಷ್ಟು ಸಮಯ ಬೇಕು?", "ಸತ್ಯನಾರಾಯಣ ಪೂಜೆಯ ಸಾಮಗ್ರಿಗಳು", "ರುದ್ರಾಭಿಷೇಕದ ವೆಚ್ಚ ಎಷ್ಟು?"],
    greeting: "ನಮಸ್ಕಾರ. ನಾನು ಪುರೋಮಿತ್ರ. ಪೂಜೆ, ಸಾಮಗ್ರಿ, ಸಮಯ ಅಥವಾ ಪುರೋಹಿತರ ಆಯ್ಕೆಯ ಬಗ್ಗೆ ಕೇಳಿ.",
    subtitle: "ನಿಮ್ಮ ಪೂಜಾ ಸಹಾಯಕ", thinking: "ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ...", placeholder: "ಪ್ರಶ್ನೆ ಕೇಳಿ...", fallback: "ಕ್ಷಮಿಸಿ, ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
};

export default function Chat({ navigation }) {
  const { language } = usePreferences();
  const { user } = useAuth();
  const copy = COPY[language] || COPY.en;
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [threads, setThreads] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const listRef = useRef();

  const makeSessionId = useCallback(() => `${SESSION_PREFIX}-${user?.id || user?.phone || user?.role || "guest"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 120), [user]);

  const loadThreadList = useCallback(async () => {
    const result = await listPuroMitraThreads({ language, user });
    setThreads(Array.isArray(result.threads) ? result.threads : []);
  }, [language, user]);

  const loadSession = useCallback(async (nextSessionId) => {
    setLoadingHistory(true);
    setSessionId(nextSessionId);
    try {
      const history = await getPuroMitraHistory({ sessionId: nextSessionId, language, user });
      const savedMessages = Array.isArray(history.messages) ? history.messages : [];
      setMessages(savedMessages.length ? savedMessages : [{ role: "assistant", content: copy.greeting }]);
      await loadThreadList();
    } catch {
      setMessages([{ role: "assistant", content: copy.greeting }]);
    } finally {
      setLoadingHistory(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80);
    }
  }, [copy.greeting, language, loadThreadList, user]);

  useEffect(() => {
    let alive = true;
    const boot = async () => {
      const userKey = user?.id || user?.phone || user?.role || "guest";
      const storageKey = `${SESSION_PREFIX}:current:${userKey}`;
      let nextSessionId = await AsyncStorage.getItem(storageKey);
      if (!nextSessionId) {
        nextSessionId = makeSessionId();
        await AsyncStorage.setItem(storageKey, nextSessionId);
      }
      if (!alive) return;
      await loadSession(nextSessionId);
    };
    boot();
    return () => { alive = false; };
  }, [loadSession, makeSessionId, user]);

  const startNewChat = async () => {
    const userKey = user?.id || user?.phone || user?.role || "guest";
    const nextSessionId = makeSessionId();
    await AsyncStorage.setItem(`${SESSION_PREFIX}:current:${userKey}`, nextSessionId);
    setHistoryOpen(false);
    setMessages([{ role: "assistant", content: copy.greeting }]);
    setSessionId(nextSessionId);
    await loadThreadList().catch(() => {});
  };

  const openThread = async (thread) => {
    const userKey = user?.id || user?.phone || user?.role || "guest";
    await AsyncStorage.setItem(`${SESSION_PREFIX}:current:${userKey}`, thread.session_id);
    setHistoryOpen(false);
    await loadSession(thread.session_id);
  };

  const send = async (msg) => {
    const text = (msg || input).trim();
    if (!text || busy || !sessionId) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const data = await askPuroMitra({ sessionId, message: text, language, user });
      const reply = data.reply || data.message || copy.fallback;
      setMessages(m => [...m, { role: "assistant", content: reply, actions: data.actions || [] }]);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", content: e?.message || "PuroMitra could not respond. Please try again." }]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.cotton }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}>
      <View style={styles.header}>
        <View style={styles.assistantMark}><Sparkles size={20} color={colors.saffron} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>PuroMitra</Text>
          <Text style={styles.headerSub}>{copy.subtitle}</Text>
        </View>
        <Pressable testID="chat-history-open" onPress={() => { setHistoryOpen(true); loadThreadList().catch(() => {}); }} style={styles.headerButton}>
          <Menu size={20} color={colors.ink} />
        </Pressable>
        <Pressable testID="chat-new" onPress={startNewChat} style={styles.headerButtonDark}>
          <Plus size={20} color={colors.white} />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        contentContainerStyle={{ padding: spacing.lg }}
        data={messages}
        keyExtractor={(_, i) => `msg-${i}`}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <View testID={`msg-${item.role}`} style={[
            styles.bubble,
            item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant,
          ]}>
            <Text style={{ color: item.role === "user" ? colors.white : colors.ink, fontSize: font.sizes.sm, lineHeight: 20 }}>
              {item.content}
            </Text>
            {item.actions?.map((action) => (
              <Pressable
                key={action.id || action.type}
                testID={`ai-action-${action.type}`}
                onPress={() => {
                  if (action.type === "view_proposals") {
                    navigation.navigate("RequestProposals", {
                      requestId: action.request_id,
                      poojaName: action.pooja_name,
                      ceremonyDate: action.ceremony_date,
                      ceremonyTime: action.ceremony_time,
                      address: action.address,
                      landmark: action.landmark,
                      lat: action.lat,
                      lng: action.lng,
                    });
                  }
                  if (action.type === "view_profiles") navigation.navigate("PriestList", { poojaSlug: action.pooja_slug, poojaName: action.pooja_name });
                  if (action.type === "start_request") navigation.navigate("RequestPooja", { poojaSlug: action.pooja_slug });
                }}
                style={styles.actionButton}
              >
                <Text style={styles.actionText}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        ListFooterComponent={(busy || loadingHistory) ? (
          <View style={[styles.bubble, styles.bubbleAssistant, { marginTop: spacing.sm }]}>
            <Text style={{ color: colors.muted2 }}>{loadingHistory ? "Loading history..." : copy.thinking}</Text>
          </View>
        ) : null}
      />

      {messages.length <= 1 && (
        <View style={styles.suggestRow}>
          {copy.suggestions.map(s => (
            <Pressable key={s} testID={`suggest-${s.slice(0,10)}`} onPress={() => send(s)} style={styles.suggestChip}>
              <Text style={styles.suggestTxt} numberOfLines={1}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          testID="chat-input"
          value={input}
          onChangeText={setInput}
          placeholder={copy.placeholder}
          style={styles.input}
          onSubmitEditing={() => send()}
          returnKeyType="send"
        />
        <Pressable testID="chat-send" onPress={() => send()} disabled={busy || loadingHistory || !sessionId || !input.trim()}
          style={[styles.sendBtn, (busy || loadingHistory || !sessionId || !input.trim()) && { opacity: 0.4 }]}>
          <Send size={18} color={colors.white} />
        </Pressable>
      </View>

      <Modal visible={historyOpen} transparent animationType="fade" onRequestClose={() => setHistoryOpen(false)}>
        <Pressable style={styles.historyBackdrop} onPress={() => setHistoryOpen(false)}>
          <Pressable style={styles.historyPanel}>
            <View style={styles.historyHeader}>
              <View>
                <Text style={styles.historyTitle}>Chat history</Text>
                <Text style={styles.historySub}>Your saved PuroMitra conversations</Text>
              </View>
              <Pressable onPress={() => setHistoryOpen(false)} style={styles.headerButton}><X size={18} color={colors.ink} /></Pressable>
            </View>
            <Pressable testID="history-new-chat" onPress={startNewChat} style={styles.newChatRow}>
              <Plus size={18} color={colors.saffron} />
              <Text style={styles.newChatText}>Start new chat</Text>
            </Pressable>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
              {threads.map((thread) => (
                <Pressable key={thread.id || thread.session_id} testID="history-thread" onPress={() => openThread(thread)} style={[styles.threadRow, thread.session_id === sessionId && styles.threadRowActive]}>
                  <Clock3 size={16} color={thread.session_id === sessionId ? colors.saffron : colors.muted2} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.threadTitle}>{thread.title || "PuroMitra chat"}</Text>
                    <Text numberOfLines={1} style={styles.threadMeta}>{thread.last_pooja_slug ? thread.last_pooja_slug.replace(/-/g, " ") : thread.last_intent || "conversation"}</Text>
                  </View>
                </Pressable>
              ))}
              {!threads.length && <Text style={styles.emptyHistory}>No saved chats yet. Start one and it will appear here.</Text>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.warmBorder,
  },
  headerTitle: { fontSize: 19, fontWeight: "700", color: colors.ink },
  headerSub: { fontSize: font.sizes.xs, color: colors.muted2 },
  assistantMark: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFF1EB", alignItems: "center", justifyContent: "center" },
  headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cotton, borderWidth: 1, borderColor: colors.warmBorder, alignItems: "center", justifyContent: "center" },
  headerButtonDark: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18 },
  bubbleUser: { backgroundColor: colors.brandBrown, alignSelf: "flex-end", borderBottomRightRadius: 5 },
  bubbleAssistant: { backgroundColor: colors.muted, alignSelf: "flex-start", borderBottomLeftRadius: 5 },
  actionButton: { marginTop: 10, minHeight: 38, borderRadius: 19, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandBrown },
  actionText: { color: colors.white, fontSize: font.sizes.xs, fontWeight: "700" },
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: spacing.lg, marginBottom: 8 },
  suggestChip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.warmBorder, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radii.pill, maxWidth: "70%" },
  suggestTxt: { fontSize: font.sizes.xs, color: colors.muted2 },
  inputRow: {
    flexDirection: "row", padding: spacing.md, paddingHorizontal: spacing.lg, gap: 8, backgroundColor: colors.white,
    borderTopWidth: 1, borderColor: colors.warmBorder,
    ...(Platform.OS === "ios" && { paddingBottom: 20 }),
  },
  input: {
    flex: 1, height: 46, borderRadius: radii.pill, backgroundColor: colors.cotton,
    borderWidth: 1, borderColor: colors.warmBorder, paddingHorizontal: spacing.lg, fontSize: font.sizes.base, color: colors.ink,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandBrown, alignItems: "center", justifyContent: "center" },
  historyBackdrop: { flex: 1, backgroundColor: "rgba(20, 17, 14, 0.22)", justifyContent: "flex-end" },
  historyPanel: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.lg, borderWidth: 1, borderColor: colors.warmBorder },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  historyTitle: { fontSize: 20, fontWeight: "800", color: colors.ink },
  historySub: { fontSize: font.sizes.xs, color: colors.muted2, marginTop: 2 },
  newChatRow: { minHeight: 48, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.cotton, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  newChatText: { color: colors.ink, fontWeight: "800", fontSize: font.sizes.sm },
  threadRow: { minHeight: 58, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.md },
  threadRowActive: { borderColor: "#F0B093", backgroundColor: "#FFF7F2" },
  threadTitle: { color: colors.ink, fontWeight: "800", fontSize: font.sizes.sm },
  threadMeta: { color: colors.muted2, fontSize: font.sizes.xs, marginTop: 2, textTransform: "capitalize" },
  emptyHistory: { color: colors.muted2, fontSize: font.sizes.sm, paddingVertical: spacing.lg, textAlign: "center" },
});
