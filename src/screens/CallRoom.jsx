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
import { currentCallerId, listRecentCallSignals, selectCallSignals, sendCallSignal, subscribeCallSignals } from "../lib/callSignaling";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

function waitForIce(connection) {
  if (!connection || connection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      connection.removeEventListener("icegatheringstatechange", onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (connection.iceGatheringState === "complete") finish();
    };
    const timer = setTimeout(finish, 4000);
    connection.addEventListener("icegatheringstatechange", onChange);
  });
}

function descriptionPayload(connection) {
  const description = connection?.localDescription;
  if (!description?.type || !description?.sdp) throw new Error("The call details were incomplete. Try again.");
  return { type: description.type, sdp: description.sdp };
}

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
  const [failed, setFailed] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [soundLocked, setSoundLocked] = useState(false);
  const peer = useRef(null);
  const stream = useRef(null);
  const remoteStream = useRef(null);
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const demoChannel = useRef(null);
  const signaler = useRef(null);
  const seenSignals = useRef(new Set());
  const pendingIce = useRef([]);
  const offerSent = useRef(false);
  const answerSeen = useRef(false);
  const myId = useRef(user?.id || null);
  const activeRef = useRef(false);
  const generation = useRef(0);
  const iceWatch = useRef(null);
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

  const playRemote = (node = remoteVideo.current) => {
    const media = remoteStream.current;
    if (!node || !media) return;
    node.srcObject = media;
    node.muted = false;
    node.volume = 1;
    node.play?.().then(() => setSoundLocked(false)).catch(() => {
      node.muted = true;
      node.play?.().catch?.(() => {});
      setSoundLocked(true);
    });
  };

  const attachLocal = () => {
    const video = localVideo.current;
    if (!video || !stream.current) return;
    video.srcObject = stream.current;
    video.muted = true;
    video.play?.().catch?.(() => {});
  };

  useEffect(() => {
    if (Platform.OS !== "web" || !mediaReady) return undefined;
    attachLocal();
    return undefined;
  }, [mediaReady]);

  const stopMedia = () => {
    clearTimeout(iceWatch.current);
    stream.current?.getTracks?.().forEach((track) => track.stop());
    stream.current = null;
    remoteStream.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    peer.current?.close?.();
    peer.current = null;
    signaler.current?.unsubscribe?.();
    signaler.current = null;
    demoChannel.current?.close?.();
    demoChannel.current = null;
    pendingIce.current = [];
  };

  useEffect(() => () => stopMedia(), []);

  const markConnected = () => {
    clearTimeout(iceWatch.current);
    setConnected(true);
    setFailed(false);
    setStatus("Connected");
    playRemote();
  };

  const markFailed = () => {
    setConnected(false);
    setFailed(true);
    setStatus("The call is not going through. Both people should press Try the call again.");
  };

  const watchIce = (connection) => {
    const currentPeer = () => peer.current === connection;
    const update = () => {
      if (!currentPeer()) return;
      const state = connection.iceConnectionState;
      if (state === "connected" || state === "completed") markConnected();
      else if (state === "failed") markFailed();
      else if (state === "checking") {
        setStatus("Connecting...");
        clearTimeout(iceWatch.current);
        iceWatch.current = setTimeout(() => {
          if (!currentPeer()) return;
          const current = connection.iceConnectionState;
          if (current !== "connected" && current !== "completed") markFailed();
        }, 12000);
      }
    };
    connection.oniceconnectionstatechange = update;
    connection.onconnectionstatechange = () => {
      if (!currentPeer()) return;
      if (connection.connectionState === "connected") markConnected();
      else if (connection.connectionState === "failed") markFailed();
    };
  };

  const flushIce = async () => {
    if (!peer.current?.remoteDescription) return;
    const queued = pendingIce.current.splice(0);
    for (const candidate of queued) {
      try { await peer.current.addIceCandidate(candidate); } catch (_) {}
    }
  };

  const rememberRemoteTrack = (event) => {
    const media = remoteStream.current || new MediaStream();
    const tracks = event.streams?.[0]?.getTracks?.() || [event.track];
    tracks.forEach((track) => {
      if (track && !media.getTracks().some((item) => item.id === track.id)) media.addTrack(track);
    });
    remoteStream.current = media;
    playRemote();
  };

  const setupPeer = async (sendIce) => {
    const token = generation.current;
    if (!stream.current) {
      const captured = await captureCallMedia();
      if (generation.current !== token || !activeRef.current) {
        captured.getTracks().forEach((track) => track.stop());
        return null;
      }
      stream.current = captured;
      setMediaReady(true);
      setCamera(captured.getVideoTracks().some((track) => track.readyState === "live"));
      attachLocal();
    }
    if (generation.current !== token || !activeRef.current) return null;
    peer.current?.close?.();
    pendingIce.current = [];
    remoteStream.current = null;
    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peer.current = connection;
    stream.current.getTracks().forEach((track) => connection.addTrack(track, stream.current));
    connection.ontrack = rememberRemoteTrack;
    connection.onicecandidate = (event) => {
      if (event.candidate) sendIce(event.candidate.toJSON ? event.candidate.toJSON() : event.candidate);
    };
    watchIce(connection);
    attachLocal();
    if (generation.current !== token || !activeRef.current) {
      connection.close();
      if (peer.current === connection) peer.current = null;
      return null;
    }
    return connection;
  };

  const publishDescription = async (signalType) => {
    await waitForIce(peer.current);
    await sendCallSignal({
      bookingId,
      signalType,
      payload: { sdp: descriptionPayload(peer.current) },
    });
  };

  const sendOffer = async () => {
    if (offerSent.current || !peer.current || !isCustomer) return;
    offerSent.current = true;
    answerSeen.current = false;
    setStatus("Calling...");
    try {
      const offer = await peer.current.createOffer();
      await peer.current.setLocalDescription(offer);
      await publishDescription("offer");
    } catch (error) {
      offerSent.current = false;
      throw error;
    }
  };

  const handleSignal = async (row) => {
    if (!row?.id || seenSignals.current.has(row.id) || !peer.current) return;
    seenSignals.current.add(row.id);
    if (row.sender_id && row.sender_id === myId.current) return;
    if (row.signal_type === "ready") {
      if (isCustomer) {
        if (answerSeen.current) {
          offerSent.current = false;
          const restarted = await setupPeer((candidate) => {
            sendCallSignal({ bookingId, signalType: "ice-candidate", payload: { candidate } }).catch(() => {});
          });
          if (!restarted) return;
        }
        await sendOffer();
      } else setStatus("Customer joined. Connecting...");
      return;
    }
    if (row.signal_type === "offer" && !isCustomer) {
      const description = row.payload?.sdp;
      if (!description?.type || !description?.sdp) return;
      if (peer.current.signalingState !== "stable") {
        const restarted = await setupPeer((candidate) => {
          sendCallSignal({ bookingId, signalType: "ice-candidate", payload: { candidate } }).catch(() => {});
        });
        if (!restarted) return;
      }
      await peer.current.setRemoteDescription(description);
      await flushIce();
      const answer = await peer.current.createAnswer();
      await peer.current.setLocalDescription(answer);
      await publishDescription("answer");
      setStatus("Connecting...");
      return;
    }
    if (row.signal_type === "answer" && isCustomer && peer.current.signalingState === "have-local-offer") {
      const description = row.payload?.sdp;
      if (!description?.type || !description?.sdp) return;
      await peer.current.setRemoteDescription(description);
      await flushIce();
      answerSeen.current = true;
      setStatus("Connecting...");
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
      await waitForIce(peer.current);
      sendSignal({ type: "answer", answer: peer.current.localDescription });
    }
    if (packet.type === "answer") await peer.current.setRemoteDescription(packet.answer);
    if (packet.type === "ice-candidate" && packet.candidate) {
      try { await peer.current.addIceCandidate(packet.candidate); } catch (_) {}
    }
    if (packet.type === "ready" && isCustomer) {
      setStatus("Calling paired priest demo...");
      const offer = await peer.current.createOffer();
      await peer.current.setLocalDescription(offer);
      await waitForIce(peer.current);
      sendSignal({ type: "offer", offer: peer.current.localDescription });
    }
    if (packet.type === "hangup") end(false);
  };

  const contactName = isCustomer
    ? (booking?.priest_name || params.priestName || "Purohit")
    : (booking?.customer_name || params.customerName || "Customer");

  const connect = async () => {
    if (activeRef.current) return;
    if (!bookingId) {
      setStatus("Open this call from the booking.");
      return;
    }
    if (Platform.OS !== "web" || typeof globalThis.RTCPeerConnection === "undefined") {
      setStatus("Voice and video calls run in the browser. Open this booking on the website and press Start video call.");
      return;
    }
    activeRef.current = true;
    const token = ++generation.current;
    const alive = () => activeRef.current && generation.current === token;
    setStarted(true);
    setFailed(false);
    setConnected(false);
    setSoundLocked(false);
    offerSent.current = false;
    answerSeen.current = false;
    seenSignals.current = new Set();
    pendingIce.current = [];
    const startedAt = Date.now();
    try {
      const isDemo = Boolean(user?.demo || booking?.demo || bookingId === "demo-confirmed");
      if (isDemo) {
        if (typeof globalThis.BroadcastChannel === "undefined") {
          activeRef.current = false;
          setStatus("Open the paired demo in a browser tab to test the call.");
          setStarted(false);
          return;
        }
        const sendSignal = (packet) => demoChannel.current?.postMessage(packet);
        demoChannel.current = new BroadcastChannel(`purohith-call-${bookingId || "demo"}`);
        demoChannel.current.onmessage = ({ data }) => receiveSignal(data, sendSignal);
        await setupPeer((candidate) => sendSignal({ type: "ice-candidate", candidate }));
        if (!alive()) return;
        sendSignal({ type: "ready" });
        setStatus(isCustomer ? "Waiting for the paired priest..." : "Waiting for the customer demo...");
        return;
      }
      if (!BOOKING_ID.test(bookingId)) {
        activeRef.current = false;
        setStatus("This call is not linked to a booking.");
        setStarted(false);
        return;
      }
      setStatus("Requesting microphone and camera access...");
      myId.current = await currentCallerId();
      if (!alive()) return;
      const connection = await setupPeer((candidate) => {
        sendCallSignal({ bookingId, signalType: "ice-candidate", payload: { candidate } }).catch(() => {});
      });
      if (!connection || !alive()) return;
      setStatus("Joining the call...");
      let chain = Promise.resolve();
      const enqueue = (row) => {
        chain = chain.then(async () => {
          if (!alive()) return;
          await handleSignal(row);
        }).catch((error) => {
          if (!alive()) return;
          setStatus(error?.message || "The call signal could not be applied. Try again.");
        });
        return chain;
      };
      const subscription = subscribeCallSignals(bookingId, enqueue);
      signaler.current = subscription;
      await subscription.ready;
      if (!alive()) return;
      const recent = selectCallSignals(await listRecentCallSignals(bookingId), startedAt);
      for (const row of recent) await enqueue(row);
      if (!alive()) return;
      await sendCallSignal({ bookingId, signalType: "ready", payload: { role: user?.role || "customer" } });
      if (!alive()) return;
      if (!offerSent.current) {
        setStatus(isCustomer ? "Waiting for the purohit to join..." : "Waiting for the customer to join...");
      }
    } catch (error) {
      if (!alive()) return;
      activeRef.current = false;
      stopMedia();
      setMediaReady(false);
      setStarted(false);
      setStatus(error?.message || "The call could not start.");
    }
  };

  const end = (notify = true) => {
    const wasActive = activeRef.current;
    activeRef.current = false;
    generation.current += 1;
    if (notify && wasActive && BOOKING_ID.test(bookingId) && !user?.demo && !booking?.demo) {
      sendCallSignal({ bookingId, signalType: "hangup", payload: {} }).catch(() => {});
    } else if (notify && wasActive) {
      demoChannel.current?.postMessage({ type: "hangup" });
    }
    stopMedia();
    setConnected(false);
    setFailed(false);
    setSoundLocked(false);
    setMediaReady(false);
    setStatus("Call ended");
    setStarted(false);
  };

  const retry = () => {
    end(true);
    connect();
  };

  const enableSound = () => playRemote();

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
    <View style={styles.stage}>
      <CallVideo videoRef={remoteVideo} />
      <CallVideo videoRef={localVideo} muted mirror />
      {started && !mediaReady ? <View style={styles.previewEmpty}><Video size={26} color={colors.muted2} /><Text style={styles.previewTitle}>Waiting for camera preview</Text><Text style={styles.previewText}>Allow microphone and camera access. Voice still works if the camera is blocked.</Text></View> : null}
      {soundLocked ? <Pressable accessibilityLabel="Turn call sound on" onPress={enableSound} style={styles.hear}><Text style={styles.hearText}>Tap to hear</Text></Pressable> : null}
      <View style={styles.status}><ShieldCheck size={14} color={colors.success} /><Text style={styles.statusText}>{connected ? "Connected" : status}</Text></View>
    </View>
    <View style={styles.controls}><Control icon={muted ? MicOff : Mic} label={muted ? "Unmute" : "Mute"} onPress={toggleMic} /><Control icon={camera ? Video : VideoOff} label={camera ? "Camera" : "Video"} onPress={toggleCamera} /><Pressable accessibilityLabel="End call" onPress={() => { end(); navigation.goBack(); }} style={styles.end}><PhoneOff size={20} color={colors.white} /></Pressable></View>
    {!started ? <Button title="Start video call" icon={Phone} onPress={connect} style={styles.start} /> : null}
    {failed ? <Button title="Try the call again" icon={Phone} onPress={retry} style={styles.start} /> : null}
    <Text style={styles.note}>Both people open this call from the booking. The browser will ask for the microphone, and the camera if you want video.</Text>
  </View>;
}

function Control({ icon: Icon, label, onPress }) { return <View style={styles.controlWrap}><Pressable accessibilityLabel={label} onPress={onPress} style={styles.control}><Icon size={19} color={colors.ink} /></Pressable><Text style={styles.controlLabel}>{label}</Text></View>; }

function CallVideo({ videoRef, muted = false, mirror = false }) {
  if (Platform.OS !== "web") {
    return <View style={styles.nativeVideo}><Video size={34} color={colors.muted2} /><Text style={styles.nativeVideoText}>Open the website to place this call</Text></View>;
  }
  const props = {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    style: mirror ? { ...styles.localVideo, transform: "scaleX(-1)" } : styles.remoteVideo,
  };
  if (muted) props.muted = true;
  return React.createElement("video", props);
}

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
  remoteVideo: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#202020", zIndex: 1 },
  localVideo: { position: "absolute", right: 14, bottom: 14, width: 132, height: 174, objectFit: "cover", backgroundColor: "#151515", borderRadius: 14, borderWidth: 2, borderColor: colors.white, zIndex: 3 },
  hear: { position: "absolute", alignSelf: "center", top: "46%", zIndex: 5, minHeight: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  hearText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  nativeVideo: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  nativeVideoText: { color: colors.muted2, fontSize: 12 },
  previewEmpty: { position: "absolute", alignSelf: "center", top: "42%", alignItems: "center", maxWidth: 230, zIndex: 4 },
  previewTitle: { color: colors.white, fontSize: 14, fontWeight: "700", marginTop: 10 },
  previewText: { color: "#A8A8A3", fontSize: 11, textAlign: "center", lineHeight: 16, marginTop: 5 },
  status: { position: "absolute", left: 14, top: 14, zIndex: 4, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(17,17,17,.82)" },
  statusText: { color: colors.white, fontSize: 10 },
  controls: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 26 },
  controlWrap: { alignItems: "center", gap: 6 },
  control: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  controlLabel: { color: "#C9C9C5", fontSize: 10 },
  end: { width: 56, height: 52, borderRadius: 26, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  start: { marginTop: spacing.lg, backgroundColor: colors.saffron },
  note: { color: "#8F8F8A", fontSize: 10, textAlign: "center", lineHeight: 15, marginTop: spacing.md, marginBottom: spacing.sm },
});
