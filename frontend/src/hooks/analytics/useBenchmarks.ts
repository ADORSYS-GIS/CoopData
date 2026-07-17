import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";

export interface BenchmarkResponse {
  kpi_name: string;
  cooperative_type?: string;
  reporting_year: number;
  sector_average: number;
  national_average: number;
  percentile_25: number;
  percentile_50: number;
  percentile_75: number;
  sample_count: number;
}

interface BenchmarkParams {
  kpiName: string;
  cooperativeType?: string;
  reportingYear?: number;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Fetches sector benchmark statistics for a given KPI.
 * Results are cached server-side for 1 hour and client-side for 1 hour.
 * Accessible to all authenticated roles.
 */
export const useBenchmarks = (params: BenchmarkParams, enabled = true) => {
  const queryParams = new URLSearchParams({ kpi_name: params.kpiName });
  if (params.cooperativeType) queryParams.set("cooperative_type", params.cooperativeType);
  if (params.reportingYear) queryParams.set("reporting_year", String(params.reportingYear));

  return useQuery<BenchmarkResponse>({
    queryKey: ["benchmarks", params],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/v1/benchmarks?${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>)["message"] ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<BenchmarkResponse>;
    },
    enabled: enabled && !!params.kpiName,
    staleTime: 60 * 60 * 1000, // 1 hour — matches server cache TTL
  });
};

/**
 * Fetches benchmarks for multiple KPIs in parallel.
 * NOTE: This uses a single endpoint call per KPI — use sparingly.
 * For the insight panel, prefer calling useBenchmarks individually per KPI.
 */
export const useBenchmarkByName = (
  kpiName: string,
  cooperativeType?: string,
  reportingYear?: number,
  enabled = true,
) => useBenchmarks({ kpiName, cooperativeType, reportingYear }, enabled);
