import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";

export interface RegionCompliancePoint {
  name: string;
  score: number;
  coops: number;
}

export interface RegionComplianceResponse {
  regions: RegionCompliancePoint[];
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const useRegionCompliance = (enabled = true) =>
  useQuery<RegionComplianceResponse>({
    queryKey: ["region-compliance"],
    enabled,
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${BASE_URL}/api/v1/analytics/region-compliance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>)["message"] ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<RegionComplianceResponse>;
    },
    staleTime: 5 * 60 * 1000,
  });
