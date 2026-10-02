import React from "react";
import { View } from "react-native";
import { RTCView } from "../lib/webrtc";

export default function CallVideo({ stream, mirror = false, style, zOrder = 0 }) {
  const streamURL = stream?.toURL?.();
  if (!RTCView || !streamURL) return <View style={style} />;
  return <RTCView streamURL={streamURL} objectFit="cover" mirror={mirror} zOrder={zOrder} style={style} />;
}
