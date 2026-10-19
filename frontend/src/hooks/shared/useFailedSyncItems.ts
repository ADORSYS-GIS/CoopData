import { useCallback, useEffect, useState } from "react";
import type { SyncQueueItem } from "@/services/shared/offlineDb";
import {
  dismissItem,
  getFailedItems,
  retryFailed,
  retryItem,
} from "@/services/shared/syncQueueService";

const POLL_MS = 3000;

/** The current user's changes that couldn't be saved, with the actions to resolve them. */
export function useFailedSyncItems() {
  const [items, setItems] = useState<SyncQueueItem[]>([]);

  const refresh = useCallback(async () => {
    try {
      setItems(await getFailedItems());
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const act = useCallback(
    (action: () => Promise<void>) => async () => {
      await action();
      await refresh();
    },
    [refresh],
  );

  return {
    items,
    retry: (id: number) => act(() => retryItem(id))(),
    dismiss: (id: number) => act(() => dismissItem(id))(),
    retryAll: act(retryFailed),
  };
}
