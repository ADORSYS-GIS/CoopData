import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { formatNative, type ExchangeRates } from "@/lib/currency";
import { apiClient } from "@/openapi-client";

interface ExchangeRateRow {
  currency_code: string;
  rate_to_zar: number;
}

/** Rates as configured on the admin settings page. Kept for reference; no longer used to convert a displayed figure. */
export const useExchangeRates = () =>
  useQuery<ExchangeRates>({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET("/api/v1/settings/exchange-rates");
      if (error || !Array.isArray(data)) throw new Error("Unable to load exchange rates.");
      return Object.fromEntries(
        (data as ExchangeRateRow[]).map((r) => [r.currency_code, r.rate_to_zar]),
      );
    },
    staleTime: 10 * 60 * 1000,
  });

/**
 * Formats an amount in the currency it was reported in. No conversion is
 * applied — `rateOverride` is accepted and ignored so call sites built
 * around the earlier SZL-standardization did not all need to change.
 */
export const useSzlFormatter = (nativeCurrency: string, _rateOverride?: number | null) => {
  const format = useCallback(
    (value: number) => formatNative(value, nativeCurrency),
    [nativeCurrency],
  );
  return { format, formatOriginal: format, zar: (value: number) => value, ready: true };
};
