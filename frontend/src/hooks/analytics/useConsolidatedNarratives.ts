import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";

export interface ApexNarratives {
  sector_overview: string;
  risk_assessment: string;
}

export interface FederationNarratives {
  sector_overview: string;
  sector_composition: string;
  pearls_compliance: string;
  social_impact: string;
}

export type MinistryNarratives = FederationNarratives;

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
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      return fetchJson<ApexNarratives>(
        `${baseUrl}/api/v1/apex/${apexId}/narratives?year=${year}`,
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
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      return fetchJson<FederationNarratives>(
        `${baseUrl}/api/v1/federation/${federationId}/narratives?year=${year}`,
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
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      return fetchJson<MinistryNarratives>(
        `${baseUrl}/api/v1/ministry/narratives?year=${year}`,
        token,
      );
    },
  });
