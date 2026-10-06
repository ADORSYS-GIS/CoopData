/**
 * The cookie choice made in the cookie banner. It is a browser preference, kept
 * in local storage: CoopData only uses essential cookies, so there is no optional
 * processing to record a server-side consent for. "accepted" allows optional
 * technologies should any be introduced; "rejected" keeps essential ones only.
 */
export const COOKIE_CONSENT_KEY = "coopdata_cookie_consent";
export const COOKIE_CONSENT_CHANGED_EVENT = "coopdata:cookie-consent-changed";
export const OPEN_COOKIE_SETTINGS_EVENT = "coopdata:open-cookie-settings";

export type CookieConsentChoice = "accepted" | "rejected";

export function getCookieConsentChoice(): CookieConsentChoice | null {
  try {
    const v = localStorage.getItem(COOKIE_CONSENT_KEY);
    return v === "accepted" || v === "rejected" ? v : null;
  } catch {
    return null;
  }
}

export function setCookieConsentChoice(choice: CookieConsentChoice) {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  } catch {
    // Storage unavailable (e.g. private mode): the banner will simply ask again.
  }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT));
}

/** Reopens the cookie banner, e.g. from a "Cookie settings" link. */
export function openCookieSettings() {
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT));
}
