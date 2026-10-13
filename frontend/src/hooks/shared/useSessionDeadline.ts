import { useEffect, useRef, useState } from "react";
import { getOfflineSessionExpiry } from "@/services/shared/authService";

const CHECK_INTERVAL_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Start warning this many days before the saved login ends. */
export const SESSION_WARNING_DAYS = 3;

export interface SessionDeadline {
  /** When the saved login ends (Unix ms), or null when there is none. */
  expiresAt: number | null;
  /** Whole days left, rounded down; 0 within the last 24 hours. */
  daysLeft: number | null;
  /** True when the deadline is close enough to warn the user. */
  warn: boolean;
}

/**
 * Follows the deadline of the saved login (fixed by Keycloak at the password
 * sign-in). Checked every minute, so a long-open tab notices it too, and calls
 * `onExpired` once when it passes.
 */
export function useSessionDeadline(onExpired?: () => void): SessionDeadline {
  const [now, setNow] = useState(() => Date.now());
  const onExpiredRef = useRef(onExpired);
  const firedRef = useRef(false);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const expiresAt = getOfflineSessionExpiry();
      if (expiresAt === null) {
        firedRef.current = false;
      } else if (current >= expiresAt && !firedRef.current) {
        firedRef.current = true;
        onExpiredRef.current?.();
      }
    };
    tick();
    const id = setInterval(tick, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const expiresAt = getOfflineSessionExpiry();
  const daysLeft = expiresAt === null ? null : Math.max(0, Math.floor((expiresAt - now) / DAY_MS));
  return { expiresAt, daysLeft, warn: daysLeft !== null && daysLeft < SESSION_WARNING_DAYS };
}
