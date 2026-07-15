import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";

export interface SectorBreakdownPoint {
  name: string;
  value: number;
  count: number;
}

export interface SectorBreakdownResponse {
  sectors: SectorBreakdownPoint[];
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const useSectorBreakdown = (enabled = true) =>
  useQuery<SectorBreakdownResponse>({
    queryKey: ["sector-breakdown"],
    enabled,
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/v1/analytics/sector-breakdown`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>)["message"] ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<SectorBreakdownResponse>;
    },
    staleTime: 5 * 60 * 1000,
  });
