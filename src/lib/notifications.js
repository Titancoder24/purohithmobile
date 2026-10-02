// Expo push token registration + foreground handling.
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

export const CALL_CATEGORY = "incoming_call";
export const CALL_ACCEPT = "accept_call";
export const CALL_DECLINE = "decline_call";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification?.request?.content?.data?.type;
    const ringingInApp = type === "call" && AppState.currentState === "active";
    return {
      shouldShowAlert: !ringingInApp,
      shouldPlaySound: !ringingInApp,
      shouldSetBadge: false,
    };
  },
});

let registeredToken = null;

async function configureChannels() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Booking updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#EA580C",
    });
    await Notifications.setNotificationChannelAsync("calls", {
      name: "Incoming calls",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 800, 600, 800, 600, 800],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      lightColor: "#EA580C",
    });
  }
  await Notifications.setNotificationCategoryAsync(CALL_CATEGORY, [
    { identifier: CALL_ACCEPT, buttonTitle: "Accept", options: { opensAppToForeground: true } },
    { identifier: CALL_DECLINE, buttonTitle: "Decline", options: { opensAppToForeground: false, isDestructive: true } },
  ]);
}

/** Register the device for push and save the token for call alerts. */
export async function registerForPush() {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;
  await configureChannels();
  const perms = await Notifications.getPermissionsAsync();
  let status = perms.status;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return null;
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
  return token;
}

export async function unregisterPush() {
  if (!registeredToken || !supabase) return;
  const token = registeredToken;
  registeredToken = null;
  await supabase.functions.invoke("call-notify", { body: { action: "unregister_token", token } }).catch(() => {});
}

export async function notifyCallPush(bookingId, action) {
  if (!supabase || !bookingId) return;
  await supabase.functions.invoke("call-notify", { body: { action, booking_id: bookingId } });
}
