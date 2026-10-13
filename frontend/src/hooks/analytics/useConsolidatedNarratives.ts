import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { getAccessToken } from "@/services/shared/authService";

export interface ApexNarratives {
  executive_dashboard: string;
  risk_distribution: string;
  risk_watch: string;
}

export interface FederationNarratives {
  executive_dashboard: string;
  risk_distribution: string;
  sector_breakdown: string;
  apex_comparison: string;
  pearls_analysis: string;
}

export type MinistryNarratives = FederationNarratives;

const BASE_URL =
  window.location.hostname.includes("frontend") || window.location.hostname.includes("gotenberg")
    ? "http://backend:3000"
    : import.meta.env.VITE_API_BASE_URL || "";

async function fetchJson<T>(url: string, token: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch narratives (${res.status})`);
  return (await res.json()) as T | null;
}

export const useApexNarratives = (
  apexId: string | undefined,
  year: number,
  tokenOverride?: string,
  lng?: string,
) =>
  useOfflineQuery({
    queryKey: ["apex-narratives", apexId, year, tokenOverride, lng],
    cacheTable: "analytics",
    cacheKey: `apex-narratives-${apexId}-${year}-${lng ?? "en"}`,
    enabled: !!apexId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      const lngParam = lng ? `&lng=${encodeURIComponent(lng)}` : "";
      return fetchJson<ApexNarratives>(
        `${BASE_URL}/api/v1/apex/${apexId}/narratives?year=${year}${lngParam}`,
        token,
      );
    },
  });

export const useFederationNarratives = (
  federationId: string | undefined,
  year: number,
  tokenOverride?: string,
  lng?: string,
) =>
  useOfflineQuery({
    queryKey: ["federation-narratives", federationId, year, tokenOverride, lng],
    cacheTable: "analytics",
    cacheKey: `federation-narratives-${federationId}-${year}-${lng ?? "en"}`,
    enabled: !!federationId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      const lngParam = lng ? `&lng=${encodeURIComponent(lng)}` : "";
      return fetchJson<FederationNarratives>(
        `${BASE_URL}/api/v1/federation/${federationId}/narratives?year=${year}${lngParam}`,
        token,
      );
    },
  });

export const useMinistryNarratives = (year: number, tokenOverride?: string, lng?: string) =>
  useOfflineQuery({
    queryKey: ["ministry-narratives", year, tokenOverride, lng],
    cacheTable: "analytics",
    cacheKey: `ministry-narratives-${year}-${lng ?? "en"}`,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      const lngParam = lng ? `&lng=${encodeURIComponent(lng)}` : "";
      return fetchJson<MinistryNarratives>(
        `${BASE_URL}/api/v1/ministry/narratives?year=${year}${lngParam}`,
        token,
      );
    },
  });
