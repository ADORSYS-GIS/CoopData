import { restoreOnlineSession, type RestoreResult } from "./authService";

/** Waits between attempts while Keycloak is unreachable; the last one repeats. */
export const RESTORE_RETRY_DELAYS_MS = [10_000, 30_000, 60_000, 120_000, 300_000] as const;

/**
 * Reconnects the saved login once the network is back, retrying while Keycloak
 * can't be reached yet instead of giving up after one failed attempt. Stops when
 * the browser goes offline again (the next "online" event starts over).
 *
 * Calls `onSettled` once with the final outcome. Returns a function that cancels
 * any pending retry.
 */
export function keepRestoringSession(
  onSettled: (result: Exclude<RestoreResult, "unreachable">) => void,
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const attempt = async (retry: number) => {
    const result = await restoreOnlineSession();
    if (cancelled) return;
    if (result !== "unreachable") {
      onSettled(result);
      return;
    }
    if (!navigator.onLine) return;
    const delay = RESTORE_RETRY_DELAYS_MS[Math.min(retry, RESTORE_RETRY_DELAYS_MS.length - 1)];
    timer = setTimeout(() => void attempt(retry + 1), delay);
  };

  void attempt(0);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
