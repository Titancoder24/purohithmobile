import { PermissionsAndroid, Platform } from "react-native";

let webrtc = null;
let inCall = null;
try {
  webrtc = require("react-native-webrtc");
} catch (_) {
  webrtc = null;
}
try {
  inCall = require("react-native-incall-manager").default;
} catch (_) {
  inCall = null;
}

export const isCallSupported = Boolean(webrtc?.RTCPeerConnection);
export const unsupportedReason = "Calls need the latest Purohith Connect app. Update the app, or open this booking on the website.";
export const RTCView = webrtc?.RTCView || null;

export function createPeerConnection(config) {
  return new webrtc.RTCPeerConnection(config);
}

export function createMediaStream() {
  return new webrtc.MediaStream();
}

async function ensureAndroidPermissions(wantsVideo) {
  if (Platform.OS !== "android") return;
  const wanted = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (wantsVideo) wanted.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  const result = await PermissionsAndroid.requestMultiple(wanted);
  if (result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED) {
    const error = new Error("Allow the microphone to place the call.");
    error.name = "NotAllowedError";
    throw error;
  }
  if (wantsVideo && result[PermissionsAndroid.PERMISSIONS.CAMERA] !== PermissionsAndroid.RESULTS.GRANTED) {
    const error = new Error("Camera permission was not granted.");
    error.name = "NotReadableError";
    throw error;
  }
}

export async function getCallMedia(constraints) {
  await ensureAndroidPermissions(Boolean(constraints?.video));
  const video = constraints?.video ? { facingMode: "user", width: 640, height: 480, frameRate: 24 } : false;
  return webrtc.mediaDevices.getUserMedia({ audio: Boolean(constraints?.audio), video });
}

export function startCallAudio() {
  try {
    inCall?.start({ media: "video" });
    inCall?.setKeepScreenOn(true);
    inCall?.setForceSpeakerphoneOn(true);
  } catch (_) {}
}

export function stopCallAudio() {
  try {
    inCall?.setForceSpeakerphoneOn(false);
    inCall?.setKeepScreenOn(false);
    inCall?.stop();
  } catch (_) {}
}
