import { offlineDb, type SyncQueueItem } from "./offlineDb";
import { getAccessToken, isOfflineModeActive, getUserProfile } from "./authService";
import { OfflineActionError } from "./networkGuard";
import { CORRELATION_HEADER, expectRequest, resolveEndpoint } from "./correlation";

/** Waits between automatic retries; after the last one the item is marked failed. */
const RETRY_DELAYS_MS = [10_000, 30_000, 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000];

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

const RESET_FOR_RETRY = {
  status: "pending" as const,
  retryCount: 0,
  lastError: undefined,
  lastStatus: undefined,
  nextAttemptAt: undefined,
};

/** The current user's changes the server refused or that ran out of retries. */
export async function getFailedItems(): Promise<SyncQueueItem[]> {
  const userId = getUserProfile()?.id;
  if (!userId) return [];
  return await offlineDb.syncQueue
    .where("status")
    .equals("failed")
    .and((item) => item.userId === userId)
    .toArray();
}

export async function retryFailed(): Promise<void> {
  const userId = getUserProfile()?.id;
  await offlineDb.syncQueue
    .where("status")
    .equals("failed")
    .and((item) => item.userId === userId)
    .modify(RESET_FOR_RETRY);
  void flushSyncQueue();
}

export async function retryItem(id: number): Promise<void> {
  await offlineDb.syncQueue.update(id, RESET_FOR_RETRY);
  void flushSyncQueue();
}

/** Drops a failed change for good (the user chose not to send it). */
export async function dismissItem(id: number): Promise<void> {
  await offlineDb.syncQueue.delete(id);
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
      // fetch rejects with a TypeError when the network drops: the write may not have
      // arrived, so keep it queued and carry on as if offline (the correlation id
      // prevents a duplicate). Any other error is the server's answer, which the
      // caller shows; retrying it in the background would only repeat it.
      const lostConnection =
        err instanceof TypeError && method !== "DELETE" && !opts.requiresConnection;
      const item = await offlineDb.syncQueue.where("correlationId").equals(correlationId).first();
      if (item) {
        if (lostConnection) {
          await offlineDb.syncQueue.update(item.id!, {
            status: "pending",
            retryCount: 0,
            nextAttemptAt: Date.now() + RETRY_DELAYS_MS[0],
          });
        } else {
          await offlineDb.syncQueue.delete(item.id!);
        }
      }
      if (lostConnection) return opts.optimisticData as T;
      throw err;
    }
  }

  return opts.optimisticData as T;
}

/** Answers that won't change on retry: the request itself is refused. */
const DEFINITIVE_STATUSES = new Set([400, 403, 404, 409, 410, 422]);

/** Next state for an item whose attempt failed for a reason that may be temporary. */
function retryLater(item: SyncQueueItem, failure: { lastError?: string; lastStatus?: number }) {
  const retryCount = (item.retryCount ?? 0) + 1;
  const delay = RETRY_DELAYS_MS[retryCount - 1];
  return delay === undefined
    ? { status: "failed" as const, retryCount, nextAttemptAt: undefined, ...failure }
    : { status: "pending" as const, retryCount, nextAttemptAt: Date.now() + delay, ...failure };
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
    // Reset items whose send started over 2 minutes ago and never finished
    // (tab closed or crashed mid-request) back to 'pending'.
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    await offlineDb.syncQueue
      .where("status")
      .equals("syncing")
      .and((item) => (item.syncStartedAt ?? item.createdAt ?? 0) < twoMinutesAgo)
      .modify({ status: "pending" });

    const profile = getUserProfile();
    const currentUserId = profile?.id;
    if (!currentUserId) return;

    const pending = await offlineDb.syncQueue
      .where("status")
      .equals("pending")
      .and((item) => item.userId === currentUserId && (item.nextAttemptAt ?? 0) <= Date.now())
      .toArray();
    if (pending.length === 0) return;

    console.log(`[syncQueue] Processing ${pending.length} pending offline items...`);

    for (const item of pending) {
      try {
        await offlineDb.syncQueue.update(item.id!, {
          status: "syncing",
          syncStartedAt: Date.now(),
        });

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
          // A refusal (e.g. "a submission already exists for this period", no
          // permission, record deleted) won't change on retry. Retried saves that
          // already succeeded are answered 200 by the idempotency check (same id).
          if (DEFINITIVE_STATUSES.has(res.status)) {
            console.warn(`[syncQueue] Item ${item.id} refused (${res.status}): ${reason}`);
            await offlineDb.syncQueue.update(item.id!, {
              status: "failed",
              retryCount: (item.retryCount ?? 0) + 1,
              nextAttemptAt: undefined,
              lastError: reason,
              lastStatus: res.status,
            });
          } else {
            await offlineDb.syncQueue.update(
              item.id!,
              retryLater(item, { lastError: reason, lastStatus: res.status }),
            );
          }
        }
      } catch (err) {
        // Network failure: no answer from the server, so no message to keep.
        console.warn(`[syncQueue] Item ${item.id} could not reach the server:`, err);
        await offlineDb.syncQueue.update(
          item.id!,
          retryLater(item, { lastError: undefined, lastStatus: undefined }),
        );
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
