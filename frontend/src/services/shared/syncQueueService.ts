import { offlineDb, type SyncQueueItem } from "./offlineDb";
import { getAccessToken, isOfflineModeActive } from "./authService";

export async function enqueue(
  item: Omit<SyncQueueItem, "id" | "correlationId" | "createdAt" | "retryCount" | "status">,
): Promise<string> {
  const correlationId = crypto.randomUUID();
  await offlineDb.syncQueue.add({
    ...item,
    correlationId,
    createdAt: Date.now(),
    retryCount: 0,
    status: "pending",
  });

  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const sw = await navigator.serviceWorker.ready;
      await (sw as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register(
        "coopdata-sync",
      );
    } catch (e) {
      console.warn("[syncQueue] Could not register background sync:", e);
    }
  }

  return correlationId;
}

export async function getPendingCount(): Promise<number> {
  try {
    return await offlineDb.syncQueue.where("status").equals("pending").count();
  } catch {
    return 0;
  }
}

export async function getFailedItems(): Promise<SyncQueueItem[]> {
  return await offlineDb.syncQueue.where("status").equals("failed").toArray();
}

export async function retryFailed(): Promise<void> {
  await offlineDb.syncQueue
    .where("status")
    .equals("failed")
    .modify({ status: "pending", retryCount: 0, lastError: undefined });

  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const sw = await navigator.serviceWorker.ready;
      await (sw as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register(
        "coopdata-sync",
      );
    } catch {
      // ignore
    }
  }
}

export async function runMutation<T>(
  endpoint: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  opts: {
    body?: unknown;
    pathParams?: Record<string, string>;
    optimisticData?: unknown;
    online: () => Promise<T>;
  },
): Promise<T> {
  const correlationId = await enqueue({
    endpoint,
    method,
    pathParams: opts.pathParams,
    body: opts.body,
    optimisticData: opts.optimisticData,
    userId: "current",
  });

  if (navigator.onLine) {
    try {
      const item = await offlineDb.syncQueue.where("correlationId").equals(correlationId).first();
      if (item) {
        await offlineDb.syncQueue.update(item.id!, { status: "syncing" });
        const data = await opts.online();
        await offlineDb.syncQueue.update(item.id!, { status: "done" });
        return data;
      }
    } catch (err) {
      console.warn("[runMutation] Online request failed, keeping in syncQueue:", err);
      const item = await offlineDb.syncQueue.where("correlationId").equals(correlationId).first();
      if (item) {
        await offlineDb.syncQueue.update(item.id!, { status: "pending", lastError: String(err) });
      }
    }
  }

  return opts.optimisticData as T;
}

let isFlushing = false;

export async function flushSyncQueue(): Promise<void> {
  if (!navigator.onLine || isOfflineModeActive() || isFlushing) return;
  isFlushing = true;

  try {
    const pending = await offlineDb.syncQueue.where("status").equals("pending").toArray();
    if (pending.length === 0) return;

    console.log(`[syncQueue] Processing ${pending.length} pending offline items...`);

    for (const item of pending) {
      try {
        await offlineDb.syncQueue.update(item.id!, { status: "syncing" });

        const token = await getAccessToken();
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
        // Substitute {id} placeholders with the stored path params.
        let path = item.endpoint;
        if (item.pathParams) {
          for (const [key, value] of Object.entries(item.pathParams)) {
            path = path.replaceAll(`{${key}}`, encodeURIComponent(value));
          }
        }
        const url = `${baseUrl}${path}`;

        const res = await fetch(url, {
          method: item.method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Correlation-Id": item.correlationId,
          },
          body: item.body ? JSON.stringify(item.body) : undefined,
        });

        if (res.ok) {
          await offlineDb.syncQueue.update(item.id!, { status: "done" });
        } else {
          const errorText = await res.text().catch(() => `HTTP ${res.status}`);
          const isIdempotentDone =
            res.status === 409 ||
            (res.status === 400 &&
              (errorText.toLowerCase().includes("already exists") ||
                errorText.toLowerCase().includes("duplicate")));

          if (isIdempotentDone) {
            console.log(
              `[syncQueue] Item ${item.id} already processed on server (${res.status}), marking done.`,
            );
            await offlineDb.syncQueue.update(item.id!, { status: "done" });
          } else {
            const retryCount = (item.retryCount ?? 0) + 1;
            await offlineDb.syncQueue.update(item.id!, {
              status: retryCount >= 5 ? "failed" : "pending",
              retryCount,
              lastError: errorText,
            });
          }
        }
      } catch (err) {
        const retryCount = (item.retryCount ?? 0) + 1;
        await offlineDb.syncQueue.update(item.id!, {
          status: retryCount >= 5 ? "failed" : "pending",
          retryCount,
          lastError: String(err),
        });
      }
    }

    // Dispatch custom event to notify React components to invalidate queries
    window.dispatchEvent(new CustomEvent("coopdata-sync-complete"));
  } finally {
    isFlushing = false;
  }
}
