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
import { logBookingCall } from "../lib/bookingChat";
import { notifyCallPush } from "../lib/notifications";
import { createMediaStream, createPeerConnection, getCallMedia, isCallSupported, startCallAudio, stopCallAudio, unsupportedReason } from "../lib/webrtc";
import CallVideo from "../components/CallVideo";

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
  try {
    return await getCallMedia({ audio: true, video: true });
  } catch (error) {
    if (error?.name === "NotAllowedError") throw new Error(error.message || "Allow the microphone and camera to place the call.");
    try {
      return await getCallMedia({ audio: true, video: false });
    } catch (audioError) {
      if (audioError?.name === "NotAllowedError") throw new Error("Allow the microphone to place the call.");
      throw new Error(audioError?.message || "Microphone access failed. Check the permission and try again.");
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
  const [localMedia, setLocalMedia] = useState(null);
  const [remoteMedia, setRemoteMedia] = useState(null);
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
  const isCaller = useRef(false);
  const connectedAt = useRef(0);
  const declined = useRef(false);
  const callLogged = useRef(true);
  const noAnswer = useRef(null);
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
    stopCallAudio();
    stream.current?.getTracks?.().forEach((track) => track.stop());
    stream.current = null;
    remoteStream.current = null;
    setLocalMedia(null);
    setRemoteMedia(null);
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

  const writeCallLog = () => {
    if (callLogged.current || !isCaller.current) return;
    callLogged.current = true;
    const outcome = connectedAt.current ? "completed" : declined.current ? "declined" : "missed";
    const durationSeconds = connectedAt.current ? (Date.now() - connectedAt.current) / 1000 : 0;
    logBookingCall({ bookingId, senderRole: user?.role, senderName: user?.name, outcome, durationSeconds }).catch(() => {});
    if (outcome === "missed") notifyCallPush(bookingId, "missed").catch(() => {});
  };
  const writeCallLogRef = useRef(writeCallLog);
  writeCallLogRef.current = writeCallLog;

  useEffect(() => () => {
    clearTimeout(noAnswer.current);
    writeCallLogRef.current();
    stopMedia();
  }, []);

  const markConnected = () => {
    clearTimeout(noAnswer.current);
    if (!connectedAt.current) connectedAt.current = Date.now();
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
    connection.addEventListener("iceconnectionstatechange", update);
    connection.addEventListener("connectionstatechange", () => {
      if (!currentPeer()) return;
      if (connection.connectionState === "connected") markConnected();
      else if (connection.connectionState === "failed") markFailed();
    });
  };

  const flushIce = async () => {
    if (!peer.current?.remoteDescription) return;
    const queued = pendingIce.current.splice(0);
    for (const candidate of queued) {
      try { await peer.current.addIceCandidate(candidate); } catch (_) {}
    }
  };

  const rememberRemoteTrack = (event) => {
    if (Platform.OS !== "web" && event.streams?.[0]) {
      remoteStream.current = event.streams[0];
      setRemoteMedia(event.streams[0]);
      return;
    }
    const media = remoteStream.current || createMediaStream();
    const tracks = event.streams?.[0]?.getTracks?.() || [event.track];
    tracks.forEach((track) => {
      if (track && !media.getTracks().some((item) => item.id === track.id)) media.addTrack(track);
    });
    remoteStream.current = media;
    setRemoteMedia(media);
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
      setLocalMedia(captured);
      setMediaReady(true);
      setCamera(captured.getVideoTracks().some((track) => track.readyState === "live"));
      attachLocal();
      startCallAudio();
    }
    if (generation.current !== token || !activeRef.current) return null;
    peer.current?.close?.();
    pendingIce.current = [];
    remoteStream.current = null;
    setRemoteMedia(null);
    const connection = createPeerConnection({ iceServers: ICE_SERVERS });
    peer.current = connection;
    stream.current.getTracks().forEach((track) => connection.addTrack(track, stream.current));
    connection.addEventListener("track", rememberRemoteTrack);
    connection.addEventListener("icecandidate", (event) => {
      if (event.candidate) sendIce(event.candidate.toJSON ? event.candidate.toJSON() : event.candidate);
    });
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
    if (row.signal_type === "hangup") {
      if (row.payload?.reason === "declined") declined.current = true;
      end(false);
      if (declined.current) setStatus(`${contactName} declined the call.`);
    }
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
    if (!isCallSupported) {
      setStatus(unsupportedReason);
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
    isCaller.current = false;
    connectedAt.current = 0;
    declined.current = false;
    callLogged.current = true;
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
      const otherWaiting = recent.some((row) => row.signal_type === "ready" && row.sender_id !== myId.current);
      if (params.autoStart && !otherWaiting) {
        activeRef.current = false;
        stopMedia();
        setMediaReady(false);
        setStarted(false);
        setStatus(`${contactName}'s call has ended. Press Start video call to call back.`);
        return;
      }
      isCaller.current = !params.autoStart && !otherWaiting;
      callLogged.current = !isCaller.current;
      for (const row of recent) await enqueue(row);
      if (!alive()) return;
      await sendCallSignal({ bookingId, signalType: "ready", payload: { role: user?.role || "customer" } });
      if (!alive()) return;
      if (!offerSent.current) {
        setStatus(isCustomer ? "Waiting for the purohit to join..." : "Waiting for the customer to join...");
      }
      if (isCaller.current) {
        notifyCallPush(bookingId, "ring").catch(() => {});
        clearTimeout(noAnswer.current);
        noAnswer.current = setTimeout(() => {
          if (!alive() || connectedAt.current) return;
          end(true);
          setStatus(`${contactName} did not answer.`);
        }, 45000);
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
    clearTimeout(noAnswer.current);
    if (wasActive) writeCallLog();
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
    if (!connectedAt.current) callLogged.current = true;
    end(true);
    connect();
  };

  const enableSound = () => playRemote();

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!params.autoStart || autoStarted.current) return;
    autoStarted.current = true;
    connect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.autoStart]);

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
      <CallVideo videoRef={remoteVideo} stream={remoteMedia} style={Platform.OS === "web" ? styles.remoteVideo : styles.remoteVideoNative} />
      <CallVideo videoRef={localVideo} stream={localMedia} muted mirror zOrder={1} style={Platform.OS === "web" ? styles.localVideo : styles.localVideoNative} />
      {started && !mediaReady ? <View style={styles.previewEmpty}><Video size={26} color={colors.muted2} /><Text style={styles.previewTitle}>Waiting for camera preview</Text><Text style={styles.previewText}>Allow microphone and camera access. Voice still works if the camera is blocked.</Text></View> : null}
      {soundLocked ? <Pressable accessibilityLabel="Turn call sound on" onPress={enableSound} style={styles.hear}><Text style={styles.hearText}>Tap to hear</Text></Pressable> : null}
      <View style={styles.status}><ShieldCheck size={14} color={colors.success} /><Text style={styles.statusText}>{connected ? "Connected" : status}</Text></View>
    </View>
    <View style={styles.controls}><Control icon={muted ? MicOff : Mic} label={muted ? "Unmute" : "Mute"} onPress={toggleMic} /><Control icon={camera ? Video : VideoOff} label={camera ? "Camera" : "Video"} onPress={toggleCamera} /><Pressable accessibilityLabel="End call" onPress={() => { end(); navigation.goBack(); }} style={styles.end}><PhoneOff size={20} color={colors.white} /></Pressable></View>
    {!started ? <Button title="Start video call" icon={Phone} onPress={connect} style={styles.start} /> : null}
    {failed ? <Button title="Try the call again" icon={Phone} onPress={retry} style={styles.start} /> : null}
    <Text style={styles.note}>{Platform.OS === "web" ? "The browser will ask for the microphone, and the camera if you want video." : "The app will ask for the microphone, and the camera if you want video."}</Text>
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
  remoteVideo: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#202020", zIndex: 1 },
  localVideo: { position: "absolute", right: 14, bottom: 14, width: 132, height: 174, objectFit: "cover", backgroundColor: "#151515", borderRadius: 14, borderWidth: 2, borderColor: colors.white, zIndex: 3 },
  hear: { position: "absolute", alignSelf: "center", top: "46%", zIndex: 5, minHeight: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  hearText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  remoteVideoNative: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#202020" },
  localVideoNative: { position: "absolute", right: 14, bottom: 14, width: 112, height: 150, backgroundColor: "#151515", borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: colors.white },
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
