import { useQuery, useQueryClient, type Query, type UseQueryOptions } from "@tanstack/react-query";
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
  /** Value to return when no cached copy exists (offline, or after a failed fetch). */
  fallbackData?: T;
}

/** Thrown when the device is offline and nothing is cached for the requested data. */
export class OfflineDataUnavailableError extends Error {
  readonly code = "OFFLINE_DATA_UNAVAILABLE";

  constructor(readonly cacheKey: string) {
    super(i18n.t("offline.dataUnavailable"));
    this.name = "OfflineDataUnavailableError";
  }
}

// Values served from the device cache or a fallback are a stale snapshot, not a
// fresh server answer. Tracking them lets staleTime treat them as stale, so
// TanStack refetches as soon as the connection returns instead of keeping the
// offline copy for the whole default staleTime window.
const offlineServed = new WeakSet<object>();

function markOfflineServed<T>(data: T): T {
  if (typeof data === "object" && data !== null) offlineServed.add(data);
  return data;
}

function isOfflineServed(data: unknown): boolean {
  return typeof data === "object" && data !== null && offlineServed.has(data);
}

/**
 * Wraps TanStack Query with an offline cache layer:
 *  - On successful fetch, the response is written to the offline DB.
 *  - When disconnected, serves from cache without calling the network.
 *  - On fetch failure, falls back to the cached value.
 *  - With no cached copy, returns `fallbackData` when the caller provides one,
 *    otherwise the query errors (offline: `OfflineDataUnavailableError`) so the
 *    page renders its error/empty state instead of receiving invented data.
 *  - NEVER throws to the React error boundary (`throwOnError: false`).
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
  const queryClient = useQueryClient();
  const { staleTime } = rest;

  const readCacheOrFallback = async (error: Error): Promise<T> => {
    const cached = await cacheGet<T>(cacheTable, cacheKey, userId, true);
    if (cached !== null) return markOfflineServed(cached);
    if (fallbackData !== undefined) return markOfflineServed(fallbackData);
    throw error;
  };

  return useQuery<T>({
    networkMode: "offlineFirst",
    retry: (failureCount, error) => {
      if (error instanceof OfflineDataUnavailableError) return false;
      if (!navigator.onLine || isOfflineModeActive()) return false;
      return failureCount < 1;
    },
    ...rest,
    staleTime: (query) => {
      if (isOfflineServed(query.state.data)) return 0;
      if (staleTime !== undefined) {
        return typeof staleTime === "function" ? staleTime(query) : staleTime;
      }
      const clientDefault = queryClient.getDefaultOptions().queries?.staleTime ?? 0;
      return typeof clientDefault === "function"
        ? clientDefault(query as unknown as Query)
        : clientDefault;
    },
    queryKey,
    // Must come AFTER ...rest so callers cannot accidentally override it
    throwOnError: false,
    queryFn: async () => {
      // Only bypass the network when the browser is TRULY disconnected.
      // The auth-service "offline mode" flag can flip on while the browser is
      // still online (Keycloak hiccup / failed token refresh). In that case we
      // must still try to fetch — otherwise users get stuck on stale cached
      // snapshots (e.g. organization labels one terminology-change behind)
      // for as long as the flag stays on.
      if (!navigator.onLine) {
        toast.warning(i18n.t("offline.banner"), { id: "offline-cache-warning" });
        return readCacheOrFallback(new OfflineDataUnavailableError(cacheKey));
      }

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
        if (!navigator.onLine || isOfflineModeActive()) {
          toast.warning(i18n.t("offline.banner"), { id: "offline-cache-warning" });
        }
        return readCacheOrFallback(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });
}
