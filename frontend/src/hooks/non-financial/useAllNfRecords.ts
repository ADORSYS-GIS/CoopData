import { useQuery } from "@tanstack/react-query";
import type { PaginatedResponse, NfListParams } from "@/types/non-financial";

const PAGE_SIZE = 200;

async function fetchAllPages<T>(
  fetchPage: (params: NfListParams) => Promise<PaginatedResponse<T>>,
  baseParams: NfListParams,
): Promise<PaginatedResponse<T>> {
  const first = await fetchPage({ ...baseParams, page: 1, page_size: PAGE_SIZE });
  const totalPages = first.total_pages ?? Math.ceil(first.total / PAGE_SIZE);
  if (totalPages <= 1) return first;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      fetchPage({ ...baseParams, page: i + 2, page_size: PAGE_SIZE }),
    ),
  );
  return {
    ...first,
    data: [...first.data, ...rest.flatMap((r) => r.data)],
  };
}

export const useAllNfRecords = <T>(
  key: string,
  fetchPage: (params: NfListParams) => Promise<PaginatedResponse<T>>,
  baseParams?: NfListParams,
) =>
  useQuery({
    queryKey: [key, "all-pages", baseParams],
    queryFn: () => fetchAllPages(fetchPage, baseParams ?? {}),
    staleTime: 30_000,
  });
