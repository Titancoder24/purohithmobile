// Expo push token registration + foreground handling.
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import api from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Register the device for push and POST the token to the backend. */
export async function registerForPush() {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;   // simulators can't get real tokens
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Booking updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#EA580C",
    });
  }
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
  if (token) {
    try {
      await api.post("/users/push-token", { token, platform: Platform.OS });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log("push register skipped/failed", e?.response?.data || e?.message);
    }
  }
  return token;
}
