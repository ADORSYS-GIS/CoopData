import i18n from "i18next";
import { isOfflineModeActive } from "./authService";

/** Thrown when an action that needs a live server connection is attempted offline. */
export class OfflineActionError extends Error {
  readonly code = "OFFLINE_ACTION_BLOCKED";

  constructor() {
    super(i18n.t("offline.actionRequiresConnection"));
    this.name = "OfflineActionError";
  }
}

/** Same definition of "offline" the sync queue uses: no network, or running on a cached token. */
export function isAppOffline(): boolean {
  return !navigator.onLine || isOfflineModeActive();
}

/**
 * Guard for online-only actions (submit, review decisions, delegation, deletes,
 * uploads…). Call it before any optimistic cache update so a blocked action
 * leaves no trace on the device.
 */
export function assertOnline(): void {
  if (isAppOffline()) throw new OfflineActionError();
}
