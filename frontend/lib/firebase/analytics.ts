import { logEvent } from "firebase/analytics";
import { analytics } from "./firebaseConfig";

/**
 * Logs a referral visit event to Firebase Analytics.
 * @param ref string The referral source (e.g. 'producthunt')
 */
export const logReferralVisit = (ref: string) => {
  if (typeof window !== "undefined" && analytics) {
    logEvent(analytics, "referral_visit", {
      referral_source: ref,
    });
  }
};
