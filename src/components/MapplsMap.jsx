import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { isValidCoordinate, mapplsConfig } from "../lib/maps";

function safeText(value) {
  return String(value || "").replace(/[<>&"']/g, (match) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
  }[match]));
}

// Default Bengaluru coordinates
const DEFAULT_LAT = 12.9716;
const DEFAULT_LNG = 77.5946;

function generateMapplsHtml({ latitude, longitude, title, address, token }) {
  const lat = isValidCoordinate(latitude, longitude) ? Number(latitude) : DEFAULT_LAT;
  const lng = isValidCoordinate(latitude, longitude) ? Number(longitude) : DEFAULT_LNG;
  const safeTitle = safeText(title || "Purohith Connect Ceremony Location");
  const safeAddress = safeText(address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  const popupHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:4px 2px;"><strong style="font-size:13px;color:#1E1B18;display:block;margin-bottom:3px;">${safeTitle}</strong><span style="color:#6A655F;font-size:11px;line-height:1.4;display:block;">${safeAddress}</span></div>`.replace(/"/g, '\\"');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: #F8F5EF; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
    .badge {
      position: absolute; top: 12px; left: 12px; z-index: 1000;
      background: #FFFFFF; color: #1E1B18; border: 1px solid #E8E0D5;
      border-radius: 20px; padding: 6px 13px; font-size: 11px; font-weight: 700;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12); display: flex; align-items: center; gap: 6px;
      pointer-events: none;
    }
    .badge-dot { width: 8px; height: 8px; border-radius: 4px; background: #E05638; display: inline-block; animation: pulse 2s infinite; }
    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
      100% { opacity: 1; transform: scale(1); }
    }
    .custom-saffron-pin {
      width: 32px;
      height: 32px;
      background: #E05638;
      border: 2px solid #FFFFFF;
      border-radius: 16px 16px 16px 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 12px rgba(224,86,56,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .custom-saffron-pin::after {
      content: '';
      width: 10px;
      height: 10px;
      background: #FFFFFF;
      border-radius: 50%;
      transform: rotate(45deg);
    }
    .mappls-popup-content-wrapper, .leaflet-popup-content-wrapper {
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      border: 1px solid #E8E0D5;
    }
    .mappls-popup-content, .leaflet-popup-content {
      margin: 10px 14px;
    }
  </style>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  ${token ? `<script src="https://apis.mappls.com/advancedmaps/api/${token}/map_sdk?v=3.0&layer=vector"></script>` : ""}
</head>
<body>
  <div class="badge"><span class="badge-dot"></span>Mappls Map</div>
  <div id="map"></div>

  <script>
    (function() {
      var lat = ${lat};
      var lng = ${lng};

      function initMapplsMap() {
        if (typeof mappls !== "undefined" && typeof mappls.Map === "function") {
          try {
            var map = new mappls.Map("map", {
              center: [lat, lng],
              zoom: 15,
              zoomControl: true,
              hybrid: false
            });

            map.addListener("load", function() {
              try {
                new mappls.Marker({
                  map: map,
                  position: { lat: lat, lng: lng },
                  popupHtml: "${popupHtml}",
                  popupOptions: {
                    openPopup: true,
                    maxWidth: 320
                  }
                });
              } catch (e) {
                console.warn("Mappls marker setup warning", e);
              }
            });
            return true;
          } catch (err) {
            console.warn("Mappls map initialization fallback", err);
          }
        }
        return false;
      }

      function initFallbackMap() {
        if (typeof L === "undefined") return;
        try {
          var map = L.map("map", { zoomControl: true, attributionControl: false }).setView([lat, lng], 15);
          L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19
          }).addTo(map);

          var saffronIcon = L.divIcon({
            className: "leaflet-saffron-pin",
            html: '<div style="background:#E05638;width:30px;height:30px;border-radius:15px 15px 15px 0;transform:rotate(-45deg);border:2px solid #FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.25);"><div style="width:10px;height:10px;background:#FFFFFF;border-radius:5px;transform:rotate(45deg);"></div></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30]
          });

          var marker = L.marker([lat, lng], { icon: saffronIcon }).addTo(map);
          marker.bindPopup("${popupHtml}").openPopup();

          setTimeout(function() { map.invalidateSize(); }, 350);
        } catch (e) {
          console.error("Fallback map init error", e);
        }
      }

      var initialized = false;
      window.onload = function() {
        if (initMapplsMap()) {
          initialized = true;
        } else {
          setTimeout(function() {
            if (!initialized && !initMapplsMap()) {
              initFallbackMap();
            }
          }, 300);
        }
      };
    })();
  </script>
</body>
</html>`;
}

export default function MapplsMap({ latitude, longitude, title, address, style }) {
  const hasValidCoords = isValidCoordinate(latitude, longitude);
  const effectiveLat = hasValidCoords ? Number(latitude) : DEFAULT_LAT;
  const effectiveLng = hasValidCoords ? Number(longitude) : DEFAULT_LNG;
  const token = mapplsConfig.accessToken || "";

  const html = generateMapplsHtml({
    latitude: effectiveLat,
    longitude: effectiveLng,
    title,
    address,
    token,
  });

  if (Platform.OS === "web") {
    return (
      <View style={[styles.map, style]}>
        {React.createElement("iframe", {
          srcDoc: html,
          title: "Mappls interactive ceremony map",
          style: { width: "100%", height: "100%", border: 0 },
        })}
      </View>
    );
  }

  return (
    <WebView
      source={{ html }}
      style={[styles.map, style]}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      scalesPageToFit
    />
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    minHeight: 320,
    overflow: "hidden",
    backgroundColor: "#F8F5EF",
  },
});
