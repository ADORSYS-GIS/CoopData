import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/openapi-client";

export interface ExchangeRateRow {
  currency_code: string;
  rate_to_usd: number;
  updated_at: string;
  updated_by: string | null;
  effective_date: string;
  source_note: string | null;
}

export interface ExchangeRateHistoryRow {
  id: string;
  currency_code: string;
  rate_to_usd: number;
  effective_date: string;
  source_note: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface UpdateExchangeRateInput {
  currency_code: string;
  rate_to_usd: number;
  effective_date?: string;
  source_note?: string;
}

const errorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
};

export const useExchangeRateList = () =>
  useQuery<ExchangeRateRow[]>({
    queryKey: ["ministry-exchange-rates"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET("/api/v1/ministry/exchange-rates");
      if (error) throw new Error(errorMessage(error, "Unable to load exchange rates."));
      return data as ExchangeRateRow[];
    },
  });

export const useExchangeRateHistory = () =>
  useQuery<ExchangeRateHistoryRow[]>({
    queryKey: ["ministry-exchange-rate-history"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).GET(
        "/api/v1/ministry/exchange-rates/history",
      );
      if (error) throw new Error(errorMessage(error, "Unable to load rate history."));
      return data as ExchangeRateHistoryRow[];
    },
  });

export const useUpdateExchangeRate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateExchangeRateInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (apiClient as any).PUT("/api/v1/ministry/exchange-rates", {
        body: input,
      });
      if (error) throw new Error(errorMessage(error, "Unable to update the exchange rate."));
      return data as ExchangeRateRow;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ministry-exchange-rates"] });
      void queryClient.invalidateQueries({ queryKey: ["ministry-exchange-rate-history"] });
      void queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
  });
};
