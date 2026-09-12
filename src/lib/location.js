import * as Location from "expo-location";

const IP_LOCATION_URL = "https://ipwho.is/";

function normalizeLocation(payload, source) {
  return {
    source,
    city: payload.city || "Bengaluru",
    region: payload.region || "Karnataka",
    country: payload.country || "India",
    postalCode: payload.postal || "",
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
    ip: payload.ip || "",
    updatedAt: new Date().toISOString(),
  };
}

export async function detectLocationFromIp() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(IP_LOCATION_URL, { signal: controller.signal });
    if (!response.ok) throw new Error("Location service is unavailable");
    const payload = await response.json();
    if (!payload.success || !Number.isFinite(Number(payload.latitude))) {
      throw new Error(payload.message || "Could not detect your city");
    }
    return normalizeLocation(payload, "ip");
  } finally {
    clearTimeout(timeout);
  }
}

export async function detectPreciseLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Location permission was not granted");
  const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const [address] = await Location.reverseGeocodeAsync(point.coords);
  return normalizeLocation({
    city: address?.city || address?.district || "Bengaluru",
    region: address?.region || "Karnataka",
    country: address?.country || "India",
    postal: address?.postalCode || "",
    latitude: point.coords.latitude,
    longitude: point.coords.longitude,
  }, "gps");
}

export function closestServiceArea(location, areas) {
  if (!location || !areas?.length) return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return areas.reduce((closest, item) => {
    const distance = Math.hypot(latitude - Number(item.latitude), longitude - Number(item.longitude));
    return !closest || distance < closest.distance ? { item, distance } : closest;
  }, null)?.item || null;
}
