import { functions, httpsCallable, auth } from "./firebase.js";
import { publicSettings } from "./firebaseConfig.js";
import { showToast } from "./ui.js";
import { delay } from "../utils/helpers.js";

const loadRazorpay = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Failed to load Razorpay script"));
    document.body.appendChild(script);
  });

const createOrder = httpsCallable(functions, "createRazorpayOrder");
const activatePremium = httpsCallable(functions, "activatePremium");

export const initiatePremiumPurchase = async () => {
  const user = auth.currentUser;
  if (!user) {
    showToast("Sign in to upgrade to Premium.", "error");
    return;
  }

  try {
    showToast("Preparing secure checkout…", "info");
    await loadRazorpay();
    const { data: order } = await createOrder({
      planId: "studysnaps-premium-monthly",
    });

    const options = {
      key: publicSettings.razorpayKeyId,
      amount: order.amount,
      currency: order.currency,
      name: "StudySnaps Premium",
      description: "Ad-free + Pro perks",
      order_id: order.id,
      prefill: {
        name: user.displayName ?? "StudySnaps Learner",
        email: user.email ?? "user@studysnaps.com",
      },
      theme: {
        color: "#6366F1",
      },
      handler: async (response) => {
        try {
          showToast("Verifying payment…", "info");
          await activatePremium({
            orderId: order.id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
          await delay(300);
          showToast("Premium activated! Enjoy the pro perks.", "success");
          document.dispatchEvent(new CustomEvent("premium:activated"));
        } catch (error) {
          console.error(error);
          showToast("Payment verification failed. Contact support.", "error");
        }
      },
      modal: {
        ondismiss: () => showToast("Checkout dismissed. Upgrade anytime!", "info"),
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  } catch (error) {
    console.error(error);
    showToast(error.message ?? "Unable to start payment.", "error");
  }
};
