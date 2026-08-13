import { useState, useEffect } from "react";
import { getPendingCount, flushSyncQueue } from "@/services/shared/syncQueueService";
import { isOfflineModeActive } from "@/services/shared/authService";

export interface NetworkStatus {
  isOnline: boolean;
  /** Briefly true after coming back online (resets after 5 s) */
  wasOffline: boolean;
  /** Number of offline actions waiting in syncQueue */
  pendingSyncCount: number;
}

/**
 * Tracks browser network connectivity and pending offline mutations.
 */
export function useNetworkStatus(): NetworkStatus {
  const checkStatus = () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return false;
    if (isOfflineModeActive()) return false;
    return true;
  };

  const [isOnline, setIsOnline] = useState(checkStatus);
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const handleOnline = async () => {
      const active = checkStatus();
      setIsOnline(active);
      if (active) {
        setWasOffline(true);
        void flushSyncQueue();
        const timer = setTimeout(() => setWasOffline(false), 5000);
        return () => clearTimeout(timer);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Poll status every 2 seconds so DevTools offline toggles and offline mode active flags reflect instantly
    const interval = setInterval(() => {
      const current = checkStatus();
      setIsOnline((prev) => {
        if (prev !== current) {
          if (current) {
            setWasOffline(true);
            setTimeout(() => setWasOffline(false), 5000);
          }
          return current;
        }
        return prev;
      });
    }, 2000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let unmounted = false;
    const updateCount = async () => {
      const count = await getPendingCount();
      if (!unmounted) setPendingSyncCount(count);
    };

    void updateCount();
    const interval = setInterval(updateCount, 3000);

    return () => {
      unmounted = true;
      clearInterval(interval);
    };
  }, []);

  return { isOnline, wasOffline, pendingSyncCount };
}
