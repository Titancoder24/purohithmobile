import React from "react";

export default function CallVideo({ videoRef, muted = false, mirror = false, style }) {
  const props = {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    style: mirror ? { ...style, transform: "scaleX(-1)" } : style,
  };
  if (muted) props.muted = true;
  return React.createElement("video", props);
}
