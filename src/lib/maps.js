import { Linking } from "react-native";
import Constants from "expo-constants";

export const mapplsConfig = {
  accessToken: process.env.EXPO_PUBLIC_MAPPLS_ACCESS_TOKEN || Constants.expoConfig?.extra?.mapplsAccessToken || "",
};

export function isValidCoordinate(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function normalizeLocation(location = {}) {
  const source = location || {};
  const latitude = Number(source.latitude ?? source.lat);
  const longitude = Number(source.longitude ?? source.lng);
  return {
    ...source,
    latitude,
    longitude,
    lat: latitude,
    lng: longitude,
    hasCoordinates: isValidCoordinate(latitude, longitude),
  };
}

export function googleMapsUrl({ lat, lng, address }) {
  const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const query = hasCoords ? `${Number(lat)},${Number(lng)}` : address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || "")}`;
}

export function openInGoogleMaps(location) {
  return Linking.openURL(googleMapsUrl(location));
}

export function mapplsUrl(location = {}) {
  const point = normalizeLocation(location);
  if (point.hasCoordinates) return `https://maps.mappls.com/@${point.latitude},${point.longitude},16z`;
  return `https://maps.mappls.com/search/${encodeURIComponent(point.address || "")}`;
}

export function openInMappls(location) {
  return Linking.openURL(mapplsUrl(location));
}
