import { useState, useEffect } from "react";

export interface NetworkStatus {
  isOnline: boolean;
  /** Briefly true after coming back online (resets after 5 s) */
  wasOffline: boolean;
}

/**
 * Tracks browser network connectivity.
 * Uses the native `online` / `offline` window events which are reliable in
 * all modern browsers. For a more accurate check on flaky connections, pair
 * this with TanStack Query's own `onlineManager`.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Clear the "just came back online" flag after 5 s
      const timer = setTimeout(() => setWasOffline(false), 5000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
