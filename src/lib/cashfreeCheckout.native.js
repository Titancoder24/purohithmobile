import { NativeModules, Linking } from "react-native";

export async function openCashfreeCheckout(order) {
  if (!order?.payment_session_id || !order?.order_id) {
    throw new Error("Cashfree did not return a valid payment session.");
  }

  // If running inside Expo Go where native SDK is not bundled, fallback to Cashfree Web Checkout URL
  if (!NativeModules.CashfreePgApi && !NativeModules.CashfreeEventEmitter) {
    const isProd = order.environment === "production";
    const webUrl =
      order.payment_url ||
      order.payment_link ||
      `https://${isProd ? "payments" : "payments-test"}.cashfree.com/order/#${order.payment_session_id}`;

    const supported = await Linking.canOpenURL(webUrl).catch(() => true);
    if (supported) {
      await Linking.openURL(webUrl);
      return { orderId: order.order_id, fallbackWeb: true };
    }

    throw new Error(
      "Cashfree native SDK is not bundled into Expo Go. Use a custom EAS development build or APK to test native SDK payments."
    );
  }

  const { CFEnvironment, CFSession } = require("cashfree-pg-api-contract");
  const { CFPaymentGatewayService } = require("react-native-cashfree-pg-sdk");

  const environment = order.environment === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
  const session = new CFSession(order.payment_session_id, order.order_id, environment);

  return new Promise((resolve, reject) => {
    const cleanup = () => CFPaymentGatewayService.removeCallback();
    CFPaymentGatewayService.setCallback({
      onVerify: (orderId) => {
        cleanup();
        resolve({ orderId });
      },
      onError: (error) => {
        cleanup();
        reject(new Error(error?.getMessage?.() || "Cashfree checkout was not completed."));
      },
    });
    CFPaymentGatewayService.doWebPayment(session);
  });
}

