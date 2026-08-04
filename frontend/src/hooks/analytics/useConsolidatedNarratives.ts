import { useQuery } from "@tanstack/react-query";
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
) =>
  useQuery({
    queryKey: ["apex-narratives", apexId, year, tokenOverride],
    enabled: !!apexId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      return fetchJson<ApexNarratives>(
        `${BASE_URL}/api/v1/apex/${apexId}/narratives?year=${year}`,
        token,
      );
    },
  });

export const useFederationNarratives = (
  federationId: string | undefined,
  year: number,
  tokenOverride?: string,
) =>
  useQuery({
    queryKey: ["federation-narratives", federationId, year, tokenOverride],
    enabled: !!federationId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      return fetchJson<FederationNarratives>(
        `${BASE_URL}/api/v1/federation/${federationId}/narratives?year=${year}`,
        token,
      );
    },
  });

export const useMinistryNarratives = (year: number, tokenOverride?: string) =>
  useQuery({
    queryKey: ["ministry-narratives", year, tokenOverride],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      return fetchJson<MinistryNarratives>(
        `${BASE_URL}/api/v1/ministry/narratives?year=${year}`,
        token,
      );
    },
  });
