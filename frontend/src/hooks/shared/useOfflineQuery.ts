import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { cacheGet, cacheSet, type CacheTable } from "@/services/shared/offlineCache";
import { getUserProfile, isOfflineModeActive } from "@/services/shared/authService";
import i18n from "i18next";
import { toast } from "sonner";

export interface UseOfflineQueryOptions<T> extends Omit<
  UseQueryOptions<T>,
  "queryFn" | "queryKey"
> {
  queryKey: unknown[];
  queryFn: () => Promise<T>;
  cacheTable: CacheTable;
  cacheKey: string;
  /** Fallback value to return when offline and no cache exists, or when an online fetch fails. */
  fallbackData?: T;
}

/**
 * Wraps TanStack Query with an offline cache layer:
 *  - On successful fetch, the response is written to the offline DB.
 *  - When offline or in offline mode, serves from cache immediately.
 *  - On fetch failure (offline / network), falls back to the cached value.
 *  - NEVER throws to the React error boundary — always returns data or fallback.
 */
export function useOfflineQuery<T>({
  queryKey,
  queryFn,
  cacheTable,
  cacheKey,
  fallbackData,
  ...rest
}: UseOfflineQueryOptions<T>) {
  const userId = getUserProfile()?.id ?? "anon";

  // Default fallback: arrays for list/log/kpi keys, objects otherwise
  const getDefaultFallback = (): T => {
    if (fallbackData !== undefined) return fallbackData;
    return (cacheKey.includes("list") ||
    cacheKey.includes("logs") ||
    cacheKey.includes("kpi") ||
    cacheKey.includes("apexes") ||
    cacheKey.includes("federation") ||
    cacheKey.includes("cooperative") ||
    cacheKey.includes("reviews") ||
    cacheKey.includes("sections") ||
    cacheKey.includes("line-items")
      ? []
      : {}) as unknown as T;
  };

  return useQuery<T>({
    networkMode: "offlineFirst",
    retry: (failureCount) => {
      if (!navigator.onLine || isOfflineModeActive()) return false;
      return failureCount < 1;
    },
    ...rest,
    queryKey,
    // Must come AFTER ...rest so callers cannot accidentally override it
    throwOnError: false,
    queryFn: async () => {
      const isOffline = !navigator.onLine || isOfflineModeActive();

      // 1. When offline, return from cache immediately without trying network
      if (isOffline) {
        toast.warning(i18n.t("offline.banner"), { id: "offline-cache-warning" });
        const cached = await cacheGet<T>(cacheTable, cacheKey, userId, true);
        if (cached !== null) return cached;
        // Return type-safe fallback so UI never crashes offline
        return getDefaultFallback();
      }

      // 2. Try online fetch
      try {
        const data = await queryFn();
        if (data !== undefined && data !== null) {
          await cacheSet(cacheTable, cacheKey, userId, data);
        }
        return data;
      } catch (err) {
        console.warn(
          `[useOfflineQuery] Fetch failed for ${cacheKey}, falling back to IndexedDB:`,
          err,
        );
        toast.warning(i18n.t("offline.banner"), { id: "offline-cache-warning" });
        // 3. On fetch failure (offline / network error), serve cached data ignoring TTL
        const cached = await cacheGet<T>(cacheTable, cacheKey, userId, true);
        if (cached !== null) return cached;
        // Safe fallback so React never shows blank error screens
        return getDefaultFallback();
      }
    },
  });
}
