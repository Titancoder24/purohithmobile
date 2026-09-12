import { load } from "@cashfreepayments/cashfree-js";
export async function openCashfreeCheckout(order) {
  if (!order?.payment_session_id || !order?.order_id) {
    throw new Error("Cashfree did not return a valid payment session.");
  }
  const cashfree = await load({ mode: order.environment === "production" ? "production" : "sandbox" });
  if (!cashfree) throw new Error("Cashfree checkout could not be loaded.");
  const result = await cashfree.checkout({
    paymentSessionId: order.payment_session_id,
    redirectTarget: "_modal",
  });
  if (result?.error) throw new Error(result.error.message || "Cashfree checkout failed.");
  return { orderId: order.order_id };
}
