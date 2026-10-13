import { useSyncExternalStore } from "react";

import {
  COOKIE_CONSENT_CHANGED_EVENT,
  getCookieConsentChoice,
  type CookieConsentChoice,
} from "@/lib/cookieConsent";

const subscribe = (onChange: () => void) => {
  window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

/** The current cookie banner choice, updated whenever it changes. */
export const useCookieConsentChoice = (): CookieConsentChoice | null =>
  useSyncExternalStore(subscribe, getCookieConsentChoice, () => null);
