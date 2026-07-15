import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";

export interface MonthlyTrendPoint {
  month: number;
  month_label: string;
  savings: number;
  loans: number;
  deposits: number;
}

export interface MonthlyTrendResponse {
  year: number;
  months: MonthlyTrendPoint[];
}

interface MonthlyTrendParams {
  reportingYear?: number;
  cooperativeId?: string;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const useMonthlyTrend = (params: MonthlyTrendParams = {}, enabled = true) => {
  const queryParams = new URLSearchParams();
  if (params.reportingYear) queryParams.set("reporting_year", String(params.reportingYear));
  if (params.cooperativeId) queryParams.set("cooperative_id", params.cooperativeId);

  const qs = queryParams.toString();
  const url = `${BASE_URL}/api/v1/analytics/monthly-trend${qs ? `?${qs}` : ""}`;

  return useQuery<MonthlyTrendResponse>({
    queryKey: ["monthly-trend", params],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>)["message"] ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<MonthlyTrendResponse>;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
};
