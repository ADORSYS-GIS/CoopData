import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";

export interface KpiValue {
  name: string;
  value: number;
  formatted: string;
  unit: string;
  status: string | null;
  benchmark: number | null;
  description: string;
}

export interface TrafficLightDistribution {
  green_pct: number;
  amber_pct: number;
  red_pct: number;
  no_data_pct: number;
  green_count: number;
  amber_count: number;
  red_count: number;
  no_data_count: number;
}

export interface CoopKpiRow {
  cooperative_id: string;
  name: string;
  region: string | null;
  sector: string | null;
  institution_type: string | null;
  has_data: boolean;
  kpis: Record<string, KpiValue>;
}

export interface NationalOverviewResponse {
  total_cooperatives: number;
  cooperatives_with_data: number;
  distributions: Record<string, TrafficLightDistribution>;
  cooperatives: CoopKpiRow[];
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const useNationalOverview = (enabled = true) =>
  useQuery<NationalOverviewResponse>({
    queryKey: ["national-overview"],
    enabled,
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/v1/analytics/national-overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>)["message"] ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<NationalOverviewResponse>;
    },
    staleTime: 5 * 60 * 1000,
  });
