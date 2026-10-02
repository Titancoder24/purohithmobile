export const isCallSupported = typeof globalThis.RTCPeerConnection !== "undefined";
export const unsupportedReason = "This browser cannot place calls. Open the booking in Chrome, Safari, or Firefox.";

export function createPeerConnection(config) {
  return new globalThis.RTCPeerConnection(config);
}

export function createMediaStream() {
  return new globalThis.MediaStream();
}

export async function getCallMedia(constraints) {
  const devices = globalThis.navigator?.mediaDevices;
  if (!devices?.getUserMedia) {
    throw new Error("This browser cannot use the microphone. Open the booking in Chrome, Safari, or Firefox.");
  }
  return devices.getUserMedia(constraints);
}

export function startCallAudio() {}

export function stopCallAudio() {}
