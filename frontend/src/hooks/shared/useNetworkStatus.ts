import { useState, useEffect } from "react";
import { getPendingCount, flushSyncQueue } from "@/services/shared/syncQueueService";

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setWasOffline(true);
      void flushSyncQueue();
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
