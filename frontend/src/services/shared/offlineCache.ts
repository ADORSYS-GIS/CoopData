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

    // 2. Fall back to primary key alone
    if (!row) {
      row = (await tbl.where(pk).equals(key).first()) as CacheRow | undefined;
    }

    // 3. Fall back to prefix matching (e.g. "audit-logs-", "questionnaire-analytics-", "national-overview-", "custom-kpis-")
    if (!row && key.includes("-")) {
      const parts = key.split("-");
      const baseKey = parts[0];
      row = (await tbl.where(pk).startsWith(baseKey).first()) as CacheRow | undefined;
    }

    // 4. Fall back to any row in that table if available
    if (!row) {
      const allRows = (await tbl.toArray()) as CacheRow[];
      if (allRows.length > 0) {
        row = allRows[0];
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
