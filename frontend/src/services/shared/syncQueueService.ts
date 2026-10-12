import { offlineDb, type SyncQueueItem } from "./offlineDb";
import { getAccessToken, isOfflineModeActive, getUserProfile } from "./authService";
import { OfflineActionError } from "./networkGuard";
import { CORRELATION_HEADER, expectRequest, resolveEndpoint } from "./correlation";

interface SyncManagerLike {
  register(tag: string): Promise<void>;
}

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
    navigator.serviceWorker.ready
      .then((sw) => (sw as unknown as { sync: SyncManagerLike }).sync.register("coopdata-sync"))
      .catch((e) => console.warn("[syncQueue] Could not register background sync:", e));
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
    navigator.serviceWorker.ready
      .then((sw) => (sw as unknown as { sync: SyncManagerLike }).sync.register("coopdata-sync"))
      .catch(() => {});
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
    /** Refuse instead of queueing when offline (deletes always require a connection). */
    requiresConnection?: boolean;
  },
): Promise<T> {
  const isOffline = !navigator.onLine || isOfflineModeActive();
  if (isOffline && (method === "DELETE" || opts.requiresConnection)) {
    throw new OfflineActionError();
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
        // Same id as an outbox retry would use, so a lost reply can't cause a duplicate.
        const release = expectRequest(
          method,
          resolveEndpoint(endpoint, opts.pathParams),
          correlationId,
        );
        let data: T;
        try {
          data = await opts.online();
        } finally {
          release();
        }
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

/** Turns an error response into the message the server meant for the user. */
function readableError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
    if (typeof parsed.message === "string" && parsed.message) return parsed.message;
    if (typeof parsed.error === "string" && parsed.error) return parsed.error;
  } catch {
    // not JSON
  }
  return body.trim() || `HTTP ${status}`;
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
        const url = `${baseUrl}${resolveEndpoint(item.endpoint, item.pathParams)}`;

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          [CORRELATION_HEADER]: item.correlationId,
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
          const reason = readableError(res.status, await res.text().catch(() => ""));
          // A real conflict (e.g. "a submission already exists for this period") or a
          // body the server rejects won't change on retry. Retried saves that already
          // succeeded are answered 200 by the idempotency check (same correlation id).
          if (res.status === 409 || res.status === 422) {
            console.warn(`[syncQueue] Item ${item.id} refused (${res.status}): ${reason}`);
            await offlineDb.syncQueue.update(item.id!, {
              status: "failed",
              retryCount: (item.retryCount ?? 0) + 1,
              lastError: reason,
              lastStatus: res.status,
            });
          } else {
            const retryCount = (item.retryCount ?? 0) + 1;
            await offlineDb.syncQueue.update(item.id!, {
              status: retryCount >= 5 ? "failed" : "pending",
              retryCount,
              lastError: reason,
              lastStatus: res.status,
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
