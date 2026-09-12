import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { closestServiceArea, detectLocationFromIp, detectPreciseLocation } from "./location";

const KEY = "pc.preferences";
export const BENGALURU_AREAS = [
  { id: "jayanagar", name: "Jayanagar", latitude: 12.9299, longitude: 77.5826 },
  { id: "basavanagudi", name: "Basavanagudi", latitude: 12.9417, longitude: 77.5750 },
  { id: "malleshwaram", name: "Malleshwaram", latitude: 13.0035, longitude: 77.5648 },
  { id: "indiranagar", name: "Indiranagar", latitude: 12.9784, longitude: 77.6408 },
  { id: "koramangala", name: "Koramangala", latitude: 12.9352, longitude: 77.6245 },
  { id: "hsr-layout", name: "HSR Layout", latitude: 12.9116, longitude: 77.6389 },
  { id: "whitefield", name: "Whitefield", latitude: 12.9698, longitude: 77.7500 },
  { id: "yelahanka", name: "Yelahanka", latitude: 13.1007, longitude: 77.5963 },
  { id: "rajajinagar", name: "Rajajinagar", latitude: 12.9914, longitude: 77.5520 },
  { id: "banashankari", name: "Banashankari", latitude: 12.9255, longitude: 77.5468 },
];

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const [language, setLanguageState] = useState("en");
  const [area, setAreaState] = useState(BENGALURU_AREAS[0]);
  const [areas, setAreas] = useState(BENGALURU_AREAS);
  const [detectedLocation, setDetectedLocation] = useState(null);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [locating, setLocating] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.language) setLanguageState(saved.language);
        if (saved.areaId) setAreaState(BENGALURU_AREAS.find((item) => item.id === saved.areaId) || BENGALURU_AREAS[0]);
        if (saved.detectedLocation) setDetectedLocation(saved.detectedLocation);
        if (typeof saved.notificationsEnabled === "boolean") setNotificationsEnabledState(saved.notificationsEnabled);
      }
    }).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("service_areas").select("slug,name,center_latitude,center_longitude").eq("is_active", true).order("sort_order")
      .then(({ data }) => {
        if (!data?.length) return;
        const remote = data.map((item) => ({ id: item.slug, name: item.name, latitude: Number(item.center_latitude), longitude: Number(item.center_longitude) }));
        setAreas(remote);
        setAreaState((current) => remote.find((item) => item.id === current.id) || remote[0]);
      });
  }, []);

  const setLanguage = useCallback(async (next) => {
    setLanguageState(next);
    await AsyncStorage.mergeItem(KEY, JSON.stringify({ language: next }));
    const { data } = await supabase?.auth.getUser() || {};
    if (data?.user?.id) await supabase.from("app_users").update({ preferred_language: next }).eq("id", data.user.id);
  }, []);
  const setArea = useCallback(async (next) => {
    setAreaState(next);
    await AsyncStorage.mergeItem(KEY, JSON.stringify({ areaId: next.id }));
    const { data } = await supabase?.auth.getUser() || {};
    if (data?.user?.id) await supabase.from("priest_profiles").update({ primary_service_area: next.name }).eq("user_id", data.user.id);
  }, []);
  const setNotificationsEnabled = useCallback(async (next) => {
    setNotificationsEnabledState(next);
    await AsyncStorage.mergeItem(KEY, JSON.stringify({ notificationsEnabled: next }));
  }, []);
  const locate = useCallback(async (source = "ip") => {
    setLocating(true);
    try {
      const location = source === "gps" ? await detectPreciseLocation() : await detectLocationFromIp();
      const nearest = closestServiceArea(location, areas);
      setDetectedLocation(location);
      if (nearest) setAreaState(nearest);
      await AsyncStorage.mergeItem(KEY, JSON.stringify({ detectedLocation: location, areaId: nearest?.id || area.id }));
      return { location, area: nearest };
    } finally {
      setLocating(false);
    }
  }, [area.id, areas]);
  useEffect(() => {
    if (!ready || detectedLocation) return;
    locate("ip").catch(() => {});
  }, [detectedLocation, locate, ready]);
  const value = useMemo(() => ({
    language, setLanguage, area, setArea, areas, ready,
    detectedLocation, locating, locate,
    notificationsEnabled, setNotificationsEnabled,
  }), [area, areas, detectedLocation, language, locate, locating, notificationsEnabled, ready, setArea, setLanguage, setNotificationsEnabled]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export const usePreferences = () => useContext(PreferencesContext);
