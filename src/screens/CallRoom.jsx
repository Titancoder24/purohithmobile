import React, { useEffect, useRef, useState } from "react";
import { bindBrandStyles } from "../lib/brandStyles";
import { Platform, Pressable, Text, View } from "react-native";
import { Mic, MicOff, Phone, PhoneOff, ShieldCheck, Video, VideoOff, ArrowLeft, Lock } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors, spacing } from "../lib/theme";
import { Button } from "../components/UI";
import { useAuth } from "../lib/auth";
import { listBookings } from "../lib/payments";
import { currentCallerId, listRecentCallSignals, sendCallSignal, subscribeCallSignals } from "../lib/callSignaling";

const BOOKING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeBooking(value) {
  return value && typeof value === "object" ? value : null;
}

async function captureCallMedia() {
  const devices = globalThis.navigator?.mediaDevices;
  if (!devices?.getUserMedia) {
    throw new Error("This browser cannot use the microphone. Open the booking in Chrome, Safari, or Firefox.");
  }
  try {
    return await devices.getUserMedia({ audio: true, video: true });
  } catch (error) {
    if (error?.name === "NotAllowedError") throw new Error("Allow the microphone and camera to place the call.");
    try {
      return await devices.getUserMedia({ audio: true, video: false });
    } catch (audioError) {
      if (audioError?.name === "NotAllowedError") throw new Error("Allow the microphone to place the call.");
      throw new Error("Microphone access failed. Check the browser permission and try again.");
    }
  }
}

export default function CallRoom({ route }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const params = route.params || {};
  const passedBooking = routeBooking(params.booking);
  const bookingId = params.bookingId || passedBooking?.id || "";
  const [booking, setBooking] = useState(passedBooking || (bookingId === "demo-confirmed" ? { id: "demo-confirmed", demo: true, status: "confirmed", pooja_name: "Satyanarayan Pooja", priest_name: params.priestName || "Demo Purohit", customer_name: params.customerName || "Demo Customer" } : {
    id: bookingId,
    priest_name: params.priestName || "Purohit",
    customer_name: params.customerName || "Customer",
    pooja_name: params.poojaName || "Ceremony",
  }));
  const [status, setStatus] = useState("Ready to call");
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [connected, setConnected] = useState(false);
  const [started, setStarted] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const peer = useRef(null);
  const stream = useRef(null);
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const demoChannel = useRef(null);
  const signaler = useRef(null);
  const seenSignals = useRef(new Set());
  const pendingIce = useRef([]);
  const offerSent = useRef(false);
  const myId = useRef(user?.id || null);
  const isCustomer = user?.role === "customer";

  useEffect(() => {
    if (!BOOKING_ID.test(bookingId) || user?.demo) return undefined;
    let cancelled = false;
    listBookings()
      .then(({ bookings }) => {
        const found = (bookings || []).find((item) => item.id === bookingId);
        if (!cancelled && found) setBooking(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [bookingId, user?.demo]);

  useEffect(() => {
    if (Platform.OS !== "web" || !mediaReady || !localVideo.current || !stream.current) return undefined;
    const video = localVideo.current;
    video.srcObject = stream.current;
    video.muted = true;
    video.play?.().catch?.(() => {});
    return () => { video.srcObject = null; };
  }, [mediaReady]);

  const stopMedia = () => {
    stream.current?.getTracks?.().forEach((track) => track.stop());
    stream.current = null;
    peer.current?.close?.();
    peer.current = null;
    signaler.current?.unsubscribe?.();
    signaler.current = null;
    demoChannel.current?.close?.();
    demoChannel.current = null;
    pendingIce.current = [];
  };

  useEffect(() => () => stopMedia(), []);

  const attachLocal = () => {
    if (localVideo.current && stream.current) {
      localVideo.current.srcObject = stream.current;
      localVideo.current.muted = true;
      localVideo.current.play?.().catch?.(() => {});
    }
  };

  const flushIce = async () => {
    if (!peer.current?.remoteDescription) return;
    const queued = pendingIce.current.splice(0);
    for (const candidate of queued) {
      try { await peer.current.addIceCandidate(candidate); } catch (_) {}
    }
  };

  const setupPeer = async (sendIce) => {
    stream.current = await captureCallMedia();
    setMediaReady(true);
    setCamera(stream.current.getVideoTracks().some((track) => track.enabled));
    attachLocal();
    peer.current = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    stream.current.getTracks().forEach((track) => peer.current.addTrack(track, stream.current));
    peer.current.ontrack = (event) => {
      const remoteStream = event.streams?.[0];
      if (remoteVideo.current && remoteStream) {
        remoteVideo.current.srcObject = remoteStream;
        remoteVideo.current.play?.().catch?.(() => {});
      }
    };
    peer.current.onicecandidate = (event) => {
      if (event.candidate) sendIce(event.candidate.toJSON ? event.candidate.toJSON() : event.candidate);
    };
    peer.current.onconnectionstatechange = () => {
      const state = peer.current?.connectionState;
      if (state === "connected") {
        setConnected(true);
        setStatus("Connected");
      } else if (state === "failed") {
        setStatus("The call could not connect. Ask the other person to stay on this screen and try again.");
      }
    };
    return peer.current;
  };

  const sendOffer = async () => {
    if (offerSent.current || !peer.current || !isCustomer) return;
    offerSent.current = true;
    setStatus("Calling...");
    const offer = await peer.current.createOffer();
    await peer.current.setLocalDescription(offer);
    await sendCallSignal({
      bookingId,
      signalType: "offer",
      payload: { sdp: { type: peer.current.localDescription.type, sdp: peer.current.localDescription.sdp } },
    });
  };

  const handleSignal = async (row) => {
    if (!row?.id || seenSignals.current.has(row.id) || !peer.current) return;
    seenSignals.current.add(row.id);
    if (row.sender_id && row.sender_id === myId.current) return;
    if (row.signal_type === "ready") {
      if (isCustomer) await sendOffer();
      else setStatus("Customer joined. Connecting...");
      return;
    }
    if (row.signal_type === "offer" && !isCustomer) {
      await peer.current.setRemoteDescription(row.payload?.sdp);
      await flushIce();
      const answer = await peer.current.createAnswer();
      await peer.current.setLocalDescription(answer);
      await sendCallSignal({
        bookingId,
        signalType: "answer",
        payload: { sdp: { type: peer.current.localDescription.type, sdp: peer.current.localDescription.sdp } },
      });
      setStatus("Connecting...");
      return;
    }
    if (row.signal_type === "answer" && isCustomer && peer.current.signalingState === "have-local-offer") {
      await peer.current.setRemoteDescription(row.payload?.sdp);
      await flushIce();
      return;
    }
    if (row.signal_type === "ice-candidate" && row.payload?.candidate) {
      if (!peer.current.remoteDescription) pendingIce.current.push(row.payload.candidate);
      else {
        try { await peer.current.addIceCandidate(row.payload.candidate); } catch (_) {}
      }
      return;
    }
    if (row.signal_type === "hangup") end(false);
  };

  const receiveSignal = async (packet, sendSignal) => {
    if (!peer.current) return;
    if (packet.type === "offer") {
      await peer.current.setRemoteDescription(packet.offer);
      const answer = await peer.current.createAnswer();
      await peer.current.setLocalDescription(answer);
      sendSignal({ type: "answer", answer });
    }
    if (packet.type === "answer") await peer.current.setRemoteDescription(packet.answer);
    if (packet.type === "ice-candidate") await peer.current.addIceCandidate(packet.candidate);
    if (packet.type === "ready" && isCustomer) {
      setStatus("Calling paired priest demo...");
      const offer = await peer.current.createOffer();
      await peer.current.setLocalDescription(offer);
      sendSignal({ type: "offer", offer });
    }
    if (packet.type === "hangup") end(false);
  };

  const contactName = isCustomer
    ? (booking?.priest_name || params.priestName || "Purohit")
    : (booking?.customer_name || params.customerName || "Customer");

  const connect = async () => {
    if (started) return;
    if (!bookingId) {
      setStatus("Open this call from the booking.");
      return;
    }
    if (Platform.OS !== "web" || typeof globalThis.RTCPeerConnection === "undefined") {
      setStatus("Voice and video calls run in the browser. Open this booking on the website and press Start video call.");
      return;
    }
    setStarted(true);
    offerSent.current = false;
    seenSignals.current = new Set();
    pendingIce.current = [];
    try {
      const isDemo = Boolean(user?.demo || booking?.demo || bookingId === "demo-confirmed");
      if (isDemo) {
        if (typeof globalThis.BroadcastChannel === "undefined") {
          setStatus("Open the paired demo in a browser tab to test the call.");
          setStarted(false);
          return;
        }
        const sendSignal = (packet) => demoChannel.current?.postMessage(packet);
        demoChannel.current = new BroadcastChannel(`purohith-call-${bookingId || "demo"}`);
        demoChannel.current.onmessage = ({ data }) => receiveSignal(data, sendSignal);
        await setupPeer((candidate) => sendSignal({ type: "ice-candidate", candidate }));
        sendSignal({ type: "ready" });
        setStatus(isCustomer ? "Waiting for the paired priest..." : "Waiting for the customer demo...");
        return;
      }
      if (!BOOKING_ID.test(bookingId)) {
        setStatus("This call is not linked to a booking.");
        setStarted(false);
        return;
      }
      setStatus("Requesting microphone and camera access...");
      myId.current = await currentCallerId();
      await setupPeer((candidate) => {
        sendCallSignal({ bookingId, signalType: "ice-candidate", payload: { candidate } }).catch(() => {});
      });
      setStatus("Joining the call...");
      const subscription = subscribeCallSignals(bookingId, (row) => {
        handleSignal(row).catch(() => setStatus("The call signal could not be applied. Try again."));
      });
      signaler.current = subscription;
      await subscription.ready;
      const recent = await listRecentCallSignals(bookingId);
      for (const row of recent) {
        if (row.signal_type === "ready") await handleSignal(row);
      }
      await sendCallSignal({ bookingId, signalType: "ready", payload: { role: user?.role || "customer" } });
      if (!offerSent.current) {
        setStatus(isCustomer ? "Waiting for the purohit to join..." : "Waiting for the customer to join...");
      }
    } catch (error) {
      stopMedia();
      setMediaReady(false);
      setStarted(false);
      setStatus(error?.message || "The call could not start.");
    }
  };

  const end = (notify = true) => {
    if (notify && started && BOOKING_ID.test(bookingId) && !user?.demo && !booking?.demo) {
      sendCallSignal({ bookingId, signalType: "hangup", payload: {} }).catch(() => {});
    } else if (notify) {
      demoChannel.current?.postMessage({ type: "hangup" });
    }
    stopMedia();
    setConnected(false);
    setMediaReady(false);
    setStatus("Call ended");
    setStarted(false);
  };

  const toggleMic = () => {
    const next = !muted;
    stream.current?.getAudioTracks?.().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  };
  const toggleCamera = () => {
    const next = !camera;
    stream.current?.getVideoTracks?.().forEach((track) => { track.enabled = next; });
    setCamera(next);
  };
  const VideoView = ({ videoRef, muted: isMuted, remote }) => Platform.OS === "web"
    ? React.createElement("video", { ref: videoRef, autoPlay: true, playsInline: true, muted: isMuted, style: remote ? styles.remoteVideo : styles.localVideo })
    : <View style={styles.nativeVideo}><Video size={34} color={colors.muted2} /><Text style={styles.nativeVideoText}>Open the website to place this call</Text></View>;

  return <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Back to booking" onPress={() => { end(started); navigation.goBack(); }} hitSlop={12} style={styles.backBtn}><ArrowLeft size={20} color={colors.white} /></Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>PRIVATE BOOKING CALL</Text>
        <Text style={styles.title}>{contactName}</Text>
        <Text style={styles.subtitle}>{booking?.pooja_name || params.poojaName || "Conversation"}</Text>
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
    <View style={styles.stage}><VideoView videoRef={remoteVideo} remote /><VideoView videoRef={localVideo} muted />{started && !mediaReady ? <View style={styles.previewEmpty}><Video size={26} color={colors.muted2} /><Text style={styles.previewTitle}>Waiting for camera preview</Text><Text style={styles.previewText}>Allow microphone and camera access. Voice still works if the camera is blocked.</Text></View> : null}<View style={styles.status}><ShieldCheck size={14} color={colors.success} /><Text style={styles.statusText}>{connected ? "Connected" : status}</Text></View></View>
    <View style={styles.controls}><Control icon={muted ? MicOff : Mic} label={muted ? "Unmute" : "Mute"} onPress={toggleMic} /><Control icon={camera ? Video : VideoOff} label={camera ? "Camera" : "Video"} onPress={toggleCamera} /><Pressable accessibilityLabel="End call" onPress={() => { end(); navigation.goBack(); }} style={styles.end}><PhoneOff size={20} color={colors.white} /></Pressable></View>
    {!started ? <Button title="Start video call" icon={Phone} onPress={connect} style={styles.start} /> : null}
    <Text style={styles.note}>Both people open this call from the booking. The browser will ask for the microphone, and the camera if you want video.</Text>
  </View>;
}

function Control({ icon: Icon, label, onPress }) { return <View style={styles.controlWrap}><Pressable accessibilityLabel={label} onPress={onPress} style={styles.control}><Icon size={19} color={colors.ink} /></Pressable><Text style={styles.controlLabel}>{label}</Text></View>; }

const styles = bindBrandStyles({
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
