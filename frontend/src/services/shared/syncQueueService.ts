import { offlineDb, type SyncQueueItem } from "./offlineDb";
import { getAccessToken, isOfflineModeActive, getUserProfile } from "./authService";

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

const syncChannel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("coopdata-sync-channel") : null;
let isSyncingInOtherTab = false;
let otherTabSyncTimeout: NodeJS.Timeout | null = null;

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data === "sync-start") {
      isSyncingInOtherTab = true;
      if (otherTabSyncTimeout) clearTimeout(otherTabSyncTimeout);
      otherTabSyncTimeout = setTimeout(() => {
        isSyncingInOtherTab = false;
      }, 30000);
    } else if (event.data === "sync-end") {
      isSyncingInOtherTab = false;
      if (otherTabSyncTimeout) clearTimeout(otherTabSyncTimeout);
    } else if (event.data === "sync-complete") {
      window.dispatchEvent(new CustomEvent("coopdata-sync-complete"));
    }
  };
}

export async function runMutation<T>(
  endpoint: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  opts: {
    body?: unknown;
    pathParams?: Record<string, string>;
    optimisticData?: unknown;
    online: () => Promise<T>;
    verificationToken?: string;
  },
): Promise<T> {
  const isOffline = !navigator.onLine || isOfflineModeActive();
  if (isOffline && method === "DELETE") {
    throw new Error("Destructive actions cannot be performed while offline.");
  }

  const profile = getUserProfile();
  const userId = profile?.id ?? "anonymous";
  const correlationId = await enqueue({
    endpoint,
    method,
    pathParams: opts.pathParams,
    body: opts.body,
    optimisticData: opts.optimisticData,
    userId,
    verificationToken: opts.verificationToken,
  });

  if (!isOffline) {
    try {
      const item = await offlineDb.syncQueue.where("correlationId").equals(correlationId).first();
      if (item) {
        await offlineDb.syncQueue.update(item.id!, { status: "syncing" });
        const data = await opts.online();
        await offlineDb.syncQueue.update(item.id!, { status: "done" });
        return data;
      }
    } catch (err) {
      console.warn("[runMutation] Online request failed:", err);
      const item = await offlineDb.syncQueue.where("correlationId").equals(correlationId).first();
      if (item) {
        if (method === "DELETE") {
          await offlineDb.syncQueue.delete(item.id!);
        } else {
          await offlineDb.syncQueue.update(item.id!, { status: "pending", lastError: String(err) });
        }
      }
      throw err;
    }
  }

  return opts.optimisticData as T;
}

let isFlushing = false;

export async function pruneSyncQueue(): Promise<void> {
  try {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await offlineDb.syncQueue
      .where("status")
      .equals("done")
      .and((item) => item.createdAt < oneWeekAgo)
      .delete();
  } catch (err) {
    console.warn("[syncQueue] Pruning failed:", err);
  }
}

async function doFlushSyncQueue(): Promise<void> {
  isFlushing = true;
  if (syncChannel) {
    syncChannel.postMessage("sync-start");
  }

  try {
    // Reset any items stuck in 'syncing' for more than 2 minutes back to 'pending'
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    await offlineDb.syncQueue
      .where("status")
      .equals("syncing")
      .and((item) => (item.createdAt ?? 0) < twoMinutesAgo)
      .modify({ status: "pending" });

    const profile = getUserProfile();
    const currentUserId = profile?.id;
    if (!currentUserId) return;

    const pending = await offlineDb.syncQueue
      .where("status")
      .equals("pending")
      .and((item) => item.userId === currentUserId)
      .toArray();
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

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Correlation-Id": item.correlationId,
        };
        if (item.verificationToken) {
          headers["x-verification-token"] = item.verificationToken;
        }

        const res = await fetch(url, {
          method: item.method,
          headers,
          body: item.body ? JSON.stringify(item.body) : undefined,
        });

        if (res.ok) {
          await offlineDb.syncQueue.update(item.id!, { status: "done" });
        } else {
          const errorText = await res.text().catch(() => `HTTP ${res.status}`);
          let isIdempotentDone = false;
          try {
            const errObj = JSON.parse(errorText);
            if (
              errObj.error === "conflict" &&
              errObj.message &&
              (errObj.message.toLowerCase().includes("already exists") ||
                errObj.message.toLowerCase().includes("duplicate"))
            ) {
              isIdempotentDone = true;
            }
          } catch {
            if (
              (res.status === 409 || res.status === 400) &&
              (errorText.toLowerCase().includes("already exists") ||
                errorText.toLowerCase().includes("duplicate"))
            ) {
              isIdempotentDone = true;
            }
          }

          if (isIdempotentDone) {
            console.log(
              `[syncQueue] Item ${item.id} already processed on server (${res.status}), marking done.`,
            );
            await offlineDb.syncQueue.update(item.id!, { status: "done" });
          } else if (res.status === 422) {
            // 422 = Unprocessable Entity: body schema mismatch — won't fix itself with retries
            console.error(
              `[syncQueue] Item ${item.id} got 422 (body validation error), marking failed.`,
              { endpoint: item.endpoint, errorText },
            );
            await offlineDb.syncQueue.update(item.id!, {
              status: "failed",
              retryCount: (item.retryCount ?? 0) + 1,
              lastError: errorText,
            });
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
    if (syncChannel) {
      syncChannel.postMessage("sync-complete");
    }
    void pruneSyncQueue();
  } finally {
    isFlushing = false;
    if (syncChannel) {
      syncChannel.postMessage("sync-end");
    }
  }
}

export async function flushSyncQueue(): Promise<void> {
  if (!navigator.onLine || isOfflineModeActive() || isFlushing || isSyncingInOtherTab) return;

  if (typeof navigator !== "undefined" && "locks" in navigator) {
    try {
      await navigator.locks.request(
        "flush-sync-queue-lock",
        { ifAvailable: true },
        async (lock) => {
          if (!lock) return;
          await doFlushSyncQueue();
        },
      );
    } catch (e) {
      console.warn("[syncQueue] Lock acquisition failed, falling back to local lock:", e);
      await doFlushSyncQueue();
    }
  } else {
    await doFlushSyncQueue();
  }
}
