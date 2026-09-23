import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { formatNative, formatUsd, toUsd, type ExchangeRates } from "@/lib/currency";
import { apiClient } from "@/openapi-client";

interface ExchangeRateRow {
  currency_code: string;
  rate_to_usd: number;
}

export const useExchangeRates = () =>
  useQuery<ExchangeRates>({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET("/api/v1/settings/exchange-rates");
      if (error || !Array.isArray(data)) throw new Error("Unable to load exchange rates.");
      return Object.fromEntries(
        (data as ExchangeRateRow[]).map((r) => [r.currency_code, r.rate_to_usd]),
      );
    },
    staleTime: 10 * 60 * 1000,
  });

export const useUsdFormatter = (nativeCurrency: string) => {
  const { data: rates } = useExchangeRates();
  const ready = !!rates && (nativeCurrency === "USD" || rates[nativeCurrency] > 0);
  const usd = useCallback(
    (value: number) => (rates ? toUsd(value, nativeCurrency, rates) : value),
    [rates, nativeCurrency],
  );
  const format = useCallback(
    (value: number, fractionDigits = 2) =>
      ready ? formatUsd(usd(value), fractionDigits) : formatNative(value, nativeCurrency),
    [ready, usd, nativeCurrency],
  );
  const formatOriginal = useCallback(
    (value: number) => formatNative(value, nativeCurrency),
    [nativeCurrency],
  );
  return { format, formatOriginal, usd, ready };
};
