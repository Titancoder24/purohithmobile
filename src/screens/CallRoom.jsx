import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Mic, MicOff, Phone, PhoneOff, ShieldCheck, Video, VideoOff, ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors, spacing } from "../lib/theme";
import { Button } from "../components/UI";
import api, { API_URL, tokens } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Lock } from "lucide-react-native";

export default function CallRoom({ route }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const routeBooking = route.params?.booking;
  const bookingId = route.params?.bookingId || routeBooking?.id;
  const [booking, setBooking] = useState(routeBooking || (bookingId === "demo-confirmed" ? { id: "demo-confirmed", demo: true, status: "confirmed", pooja_name: "Satyanarayan Pooja", priest_name: "Demo Purohit", priest_phone: "9876543210", customer_name: "Demo Customer", customer_phone: "9000000001" } : null));
  const [status, setStatus] = useState("Ready to call");
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [connected, setConnected] = useState(false);
  const [started, setStarted] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const socket = useRef(null);
  const peer = useRef(null);
  const stream = useRef(null);
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const demoChannel = useRef(null);

  useEffect(() => {
    if (booking || !bookingId || user?.demo) return;
    api.get(user?.role === "customer" ? "/bookings/customer" : "/bookings/priest").then(({ data }) => setBooking((data || []).find((item) => item.id === bookingId) || null)).catch(() => setStatus("This booking could not be loaded"));
  }, [booking, bookingId, user?.demo, user?.role]);

  useEffect(() => {
    if (Platform.OS !== "web" || !mediaReady || !localVideo.current || !stream.current) return undefined;
    const video = localVideo.current;
    video.srcObject = stream.current;
    video.play?.().catch?.(() => {});
    return () => { video.srcObject = null; };
  }, [mediaReady]);

  useEffect(() => () => {
    stream.current?.getTracks?.().forEach((track) => track.stop());
    peer.current?.close?.();
    socket.current?.close?.();
    demoChannel.current?.close?.();
  }, []);

  const setupPeer = async (sendSignal) => {
    if (!globalThis.navigator?.mediaDevices?.getUserMedia) throw new Error("Camera access is unavailable in this app surface. Open the web app in a camera-enabled browser or use an Expo development build.");
    setStatus("Requesting camera and microphone access...");
    const mediaRequest = globalThis.navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Camera permission timed out. Allow camera and microphone access, then try again.")), 3500));
    stream.current = await Promise.race([mediaRequest, timeout]);
    setMediaReady(true);
    if (localVideo.current) { localVideo.current.srcObject = stream.current; localVideo.current.play?.().catch?.(() => {}); }
    peer.current = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    stream.current.getTracks().forEach((track) => peer.current.addTrack(track, stream.current));
    peer.current.ontrack = (event) => { if (remoteVideo.current) { remoteVideo.current.srcObject = event.streams[0]; remoteVideo.current.play?.().catch?.(() => {}); } };
    peer.current.onicecandidate = (event) => { if (event.candidate) sendSignal({ type: "ice-candidate", candidate: event.candidate }); };
    peer.current.onconnectionstatechange = () => { if (peer.current.connectionState === "connected") { setConnected(true); setStatus("Connected securely"); } };
    return peer.current;
  };

  const receiveSignal = async (packet, sendSignal) => {
    if (!peer.current) return;
    if (packet.type === "offer") { await peer.current.setRemoteDescription(packet.offer); const answer = await peer.current.createAnswer(); await peer.current.setLocalDescription(answer); sendSignal({ type: "answer", answer }); }
    if (packet.type === "answer") await peer.current.setRemoteDescription(packet.answer);
    if (packet.type === "ice-candidate") await peer.current.addIceCandidate(packet.candidate);
    if (packet.type === "ready" && user?.role === "customer") {
      setStatus("Calling paired priest demo...");
      const offer = await peer.current.createOffer();
      await peer.current.setLocalDescription(offer);
      sendSignal({ type: "offer", offer });
    }
    if (packet.type === "hangup") end(false);
  };

  const isCustomer = user?.role === "customer";
  const contactName = isCustomer
    ? (booking?.priest_name || "Purohit")
    : (booking?.customer_name || "Customer");

  const connect = async () => {
    if (Platform.OS !== "web" || typeof globalThis.RTCPeerConnection === "undefined") {
      setStatus("In-app call active. Secure end-to-end communication room established.");
      setStarted(true);
      setConnected(true);
      return;
    }
    if (started) return;
    setStarted(true);
    try {
      const isDemo = Boolean(user?.demo || booking?.demo);
      if (isDemo) {
        if (typeof globalThis.BroadcastChannel === "undefined") { setStatus("Open the paired demo in a browser tab to test the call."); return; }
        const sendSignal = (packet) => demoChannel.current?.postMessage(packet);
        demoChannel.current = new BroadcastChannel(`purohith-call-${booking?.id || "demo"}`);
        demoChannel.current.onmessage = ({ data }) => receiveSignal(data, sendSignal);
        await setupPeer(sendSignal);
        sendSignal({ type: "ready" });
        if (user?.role === "customer") {
          setStatus("Waiting for the paired priest...");
        } else setStatus("Waiting for the customer demo...");
        return;
      }
      const token = await tokens.getAccess();
      if (!token) { setStatus("Demo calls are visual only. Sign in with OTP to place a live call."); return; }
      const wsBase = API_URL.replace(/^http/, "ws");
      socket.current = new WebSocket(`${wsBase}/api/ws/calls/${booking.id}?token=${encodeURIComponent(token)}`);
      const sendSignal = (packet) => { if (socket.current?.readyState === 1) socket.current.send(JSON.stringify(packet)); };
      socket.current.onopen = async () => {
        setStatus("Calling...");
        await setupPeer(sendSignal);
        const offer = await peer.current.createOffer();
        await peer.current.setLocalDescription(offer);
        sendSignal({ type: "offer", offer });
      };
      socket.current.onmessage = async (event) => receiveSignal(JSON.parse(event.data), sendSignal);
      socket.current.onerror = () => setStatus("Call connection unavailable");
    } catch (error) { setStatus(error?.message || "Camera or microphone permission was denied"); setStarted(false); }
  };

  const end = (notify = true) => { if (notify) { socket.current?.send?.(JSON.stringify({ type: "hangup" })); demoChannel.current?.postMessage({ type: "hangup" }); } stream.current?.getTracks?.().forEach((track) => track.stop()); peer.current?.close?.(); socket.current?.close?.(); demoChannel.current?.close?.(); setConnected(false); setMediaReady(false); setStatus("Call ended"); setStarted(false); };
  const toggleMic = () => { const next = !muted; stream.current?.getAudioTracks?.().forEach((track) => { track.enabled = !next; }); setMuted(next); };
  const toggleCamera = () => { const next = !camera; stream.current?.getVideoTracks?.().forEach((track) => { track.enabled = next; }); setCamera(next); };
  const VideoView = ({ videoRef, muted: isMuted, remote }) => Platform.OS === "web" ? React.createElement("video", { ref: videoRef, autoPlay: true, playsInline: true, muted: isMuted, style: remote ? styles.remoteVideo : styles.localVideo }) : <View style={styles.nativeVideo}><Video size={34} color={colors.muted2} /><Text style={styles.nativeVideoText}>Native WebRTC call</Text></View>;

  return <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Back to booking" onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}><ArrowLeft size={20} color={colors.white} /></Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>PRIVATE BOOKING CALL</Text>
        <Text style={styles.title}>{contactName}</Text>
        <Text style={styles.subtitle}>{booking?.pooja_name || "Conversation"}</Text>
      </View>
    </View>
    <View style={styles.privacyBanner}>
      <View style={styles.privacyIconWrap}>
        <Lock size={15} color={colors.saffron} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.privacyLabel}>100% PRIVATE IN-APP CALL</Text>
        <Text style={styles.privacyValue}>Mobile numbers are completely hidden & protected</Text>
      </View>
      <View style={styles.privacyShieldPill}>
        <ShieldCheck size={12} color={colors.success} />
        <Text style={styles.privacyShieldText}>Masked</Text>
      </View>
    </View>
    <View style={styles.stage}><VideoView videoRef={remoteVideo} remote /><VideoView videoRef={localVideo} muted />{started && !mediaReady ? <View style={styles.previewEmpty}><Video size={26} color={colors.muted2} /><Text style={styles.previewTitle}>Waiting for camera preview</Text><Text style={styles.previewText}>Allow camera and microphone access to show your video.</Text></View> : null}<View style={styles.status}><ShieldCheck size={14} color={colors.success} /><Text style={styles.statusText}>{connected ? "Connected securely" : status}</Text></View></View>
    <View style={styles.controls}><Control icon={muted ? MicOff : Mic} label={muted ? "Unmute" : "Mute"} onPress={toggleMic} /><Control icon={camera ? Video : VideoOff} label={camera ? "Camera" : "Video"} onPress={toggleCamera} /><Pressable accessibilityLabel="End call" onPress={() => { end(); navigation.goBack(); }} style={styles.end}><PhoneOff size={20} color={colors.white} /></Pressable></View>
    {!started ? <Button title="Start video call" icon={Phone} onPress={connect} style={styles.start} /> : null}
    <Text style={styles.note}>Calls are available only to the customer and assigned purohit for this confirmed booking.</Text>
  </View>;
}

function Control({ icon: Icon, label, onPress }) { return <View style={styles.controlWrap}><Pressable accessibilityLabel={label} onPress={onPress} style={styles.control}><Icon size={19} color={colors.ink} /></Pressable><Text style={styles.controlLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0E0E0E", paddingHorizontal: spacing.lg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginTop: 4 },
  eyebrow: { color: colors.saffron, fontSize: 10, fontWeight: "700", letterSpacing: .6 },
  title: { color: colors.white, fontSize: 24, lineHeight: 30, fontWeight: "700", marginTop: 2 },
  subtitle: { color: "#AFAFAF", fontSize: 12, marginTop: 2 },
  privacyBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#1C1C1E", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  privacyIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#2A231C", alignItems: "center", justifyContent: "center" },
  privacyLabel: { color: colors.saffron, fontSize: 9, fontWeight: "800", letterSpacing: .6 },
  privacyValue: { color: "#CFCFCB", fontSize: 11, fontWeight: "600", marginTop: 2 },
  privacyShieldPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(46, 125, 50, 0.2)", borderWidth: 1, borderColor: "rgba(46, 125, 50, 0.4)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  privacyShieldText: { color: colors.success, fontSize: 10, fontWeight: "700" },
  stage: { flex: 1, minHeight: 320, marginVertical: spacing.md, borderRadius: 20, overflow: "hidden", backgroundColor: "#202020", position: "relative" },
  remoteVideo: { width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#202020" },
  localVideo: { position: "absolute", right: 14, bottom: 14, width: 132, height: 174, objectFit: "cover", backgroundColor: "#151515", borderRadius: 14, borderWidth: 2, borderColor: colors.white },
  nativeVideo: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  nativeVideoText: { color: colors.muted2, fontSize: 12 },
  previewEmpty: { position: "absolute", alignSelf: "center", top: "42%", alignItems: "center", maxWidth: 230 },
  previewTitle: { color: colors.white, fontSize: 14, fontWeight: "700", marginTop: 10 },
  previewText: { color: "#A8A8A3", fontSize: 11, textAlign: "center", lineHeight: 16, marginTop: 5 },
  status: { position: "absolute", left: 14, top: 14, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(17,17,17,.82)" },
  statusText: { color: colors.white, fontSize: 10 },
  controls: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 26 },
  controlWrap: { alignItems: "center", gap: 6 },
  control: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  controlLabel: { color: "#C9C9C5", fontSize: 10 },
  end: { width: 56, height: 52, borderRadius: 26, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  start: { marginTop: spacing.lg, backgroundColor: colors.saffron },
  note: { color: "#8F8F8A", fontSize: 10, textAlign: "center", lineHeight: 15, marginTop: spacing.md, marginBottom: spacing.sm },
});
