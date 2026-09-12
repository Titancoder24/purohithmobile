import { CFEnvironment, CFSession } from "cashfree-pg-api-contract";
import { CFPaymentGatewayService } from "react-native-cashfree-pg-sdk";
export async function openCashfreeCheckout(order) {
  if (!order?.payment_session_id || !order?.order_id) {
    throw new Error("Cashfree did not return a valid payment session.");
  }
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
