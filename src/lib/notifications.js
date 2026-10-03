// Expo push token registration + foreground handling.
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let registeredToken = null;

async function configureChannels() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Booking updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#EA580C",
    });
  }
}

/**
 * Register this device for push. Resolves to { status, token? } where status is
 * "registered", "denied", or "unsupported".
 */
export async function registerForPush() {
  if (Platform.OS === "web" || !Device.isDevice) return { status: "unsupported" };
  await configureChannels();
  const perms = await Notifications.getPermissionsAsync();
  let status = perms.status;
  if (status !== "granted" && perms.canAskAgain !== false) {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return { status: "denied" };
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;
  const tokenResp = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenResp?.data;
  if (token && supabase) {
    const { error } = await supabase.functions.invoke("call-notify", {
      body: { action: "register_token", token, platform: Platform.OS },
    });
    if (error) throw error;
    registeredToken = token;
  }
  return { status: "registered", token };
}

export async function unregisterPush() {
  if (!registeredToken || !supabase) return;
  const token = registeredToken;
  registeredToken = null;
  await supabase.functions.invoke("call-notify", { body: { action: "unregister_token", token } }).catch(() => {});
}
