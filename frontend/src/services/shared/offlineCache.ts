import { offlineDb, CACHE_TTL_MS } from "./offlineDb";
import { isOfflineModeActive } from "./authService";

export type CacheTable = keyof typeof CACHE_TTL_MS;

interface CacheRow {
  id?: string;
  key?: string;
  userId: string;
  data: unknown;
  cachedAt: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

/**
 * Reads a value from the offline cache.
 * When offline or offline mode is active, ignores TTL expiration so cached data is served.
 * Tries matching key + userId first, then falls back to key alone if userId differs.
 */
export async function cacheGet<T>(
  table: CacheTable,
  key: string,
  userId: string,
  ignoreTtlOverride?: boolean,
): Promise<T | null> {
  try {
    const pk = (table as string) === "analytics" || (table as string) === "meta" ? "key" : "id";
    const tbl = (offlineDb as AnyTable)[table];

    // 1. Try matching primary key AND userId
    let row = (await tbl
      .where(pk)
      .equals(key)
      .and((r: CacheRow) => r.userId === userId)
      .first()) as CacheRow | undefined;

    // 2. Fall back to prefix matching for list/overview keys (e.g. "audit-logs-", "questionnaire-analytics-", "national-overview-", "custom-kpis-")
    const prefixWhitelist = [
      "audit-logs-",
      "questionnaire-analytics-",
      "national-overview-",
      "custom-kpis-",
      "basic-benchmark-",
    ];
    if (!row) {
      const matchingPrefix = prefixWhitelist.find((prefix) => key.startsWith(prefix));
      if (matchingPrefix) {
        row = (await tbl
          .where(pk)
          .startsWith(matchingPrefix)
          .and((r: CacheRow) => r.userId === userId)
          .first()) as CacheRow | undefined;
      }
    }

    if (!row) return null;

    const isOffline = !navigator.onLine || isOfflineModeActive();
    const ignoreTtl = ignoreTtlOverride ?? isOffline;

    // Only enforce TTL when strictly online and not forcing offline recovery
    if (!ignoreTtl) {
      const ttl = CACHE_TTL_MS[table];
      if (Date.now() - row.cachedAt > ttl) return null;
    }

    return row.data as T;
  } catch (err) {
    console.warn(`[offlineCache] cacheGet failed for table ${table}, key ${key}:`, err);
    return null;
  }
}

async function evictOldestCacheEntries(): Promise<void> {
  const tablesToEvict: CacheTable[] = ["submissions", "analytics", "reports", "users"];
  for (const tableName of tablesToEvict) {
    try {
      const tbl = (offlineDb as AnyTable)[tableName];
      const count = await tbl.count();
      if (count > 20) {
        const limit = Math.ceil(count * 0.3);
        const oldest = (await tbl.orderBy("cachedAt").limit(limit).toArray()) as Record<
          string,
          unknown
        >[];
        const pKey =
          (tableName as string) === "analytics" || (tableName as string) === "meta" ? "key" : "id";
        const keysToDelete = oldest.map((r) => r[pKey] as string);
        await tbl.bulkDelete(keysToDelete);
        console.log(
          `[offlineCache] Evicted ${keysToDelete.length} oldest entries from ${tableName}`,
        );
      }
    } catch (err) {
      console.warn(`[offlineCache] Eviction failed for table ${tableName}:`, err);
    }
  }
}

export async function enforceStorageQuota(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.storage || !navigator.storage.estimate) return;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (usage && quota) {
      const usagePercent = usage / quota;
      if (usagePercent > 0.8 || usage > 50 * 1024 * 1024) {
        console.log("[offlineCache] Storage usage is high, running LRU eviction...");
        await evictOldestCacheEntries();
      }
    }
  } catch (err) {
    console.warn("[offlineCache] Failed to estimate storage:", err);
  }
}

/**
 * Writes a value to the offline cache. Best-effort — never throws.
 */
export async function cacheSet<T>(
  table: CacheTable,
  key: string,
  userId: string,
  data: T,
): Promise<void> {
  try {
    const pk = (table as string) === "analytics" || (table as string) === "meta" ? "key" : "id";
    const row: Record<string, unknown> = {
      [pk]: key,
      userId,
      data,
      cachedAt: Date.now(),
    };
    await (offlineDb as AnyTable)[table].put(row);
    void enforceStorageQuota();
  } catch (err) {
    console.warn(`[offlineCache] cacheSet failed for table ${table}, key ${key}:`, err);
  }
}

/**
 * Removes a single cached value (e.g. after a mutation invalidates it).
 */
export async function cacheDelete(table: CacheTable, key: string): Promise<void> {
  try {
    await (offlineDb as AnyTable)[table].delete(key);
  } catch {
    // ignore
  }
}

/**
 * Clears all cached rows for a user (e.g. on logout).
 */
export async function cacheClearForUser(table: CacheTable, userId: string): Promise<void> {
  try {
    await (offlineDb as AnyTable)[table].where("userId").equals(userId).delete();
  } catch {
    // ignore
  }
}
