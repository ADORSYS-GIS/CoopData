import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PaginatedResponse, NfListParams } from "@/types/non-financial";

/**
 * One page of a non-financial record list. With `pageSize` 1 it is a cheap way to learn
 * the total of a list, and with `enabled` false nothing is fetched, so a long list that is
 * folded costs nothing.
 */
export const useNfRecordsPage = <T>(
  key: string,
  fetchPage: (params: NfListParams) => Promise<PaginatedResponse<T>>,
  baseParams: NfListParams,
  page: number,
  pageSize: number,
  enabled = true,
) =>
  useQuery({
    queryKey: [key, "page", baseParams, page, pageSize],
    queryFn: () => fetchPage({ ...baseParams, page, page_size: pageSize }),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
