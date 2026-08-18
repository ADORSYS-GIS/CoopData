import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";

// Types matching the backend SubmissionKpisResponse
export interface KpiItemResponse {
  name: string;
  value: number;
  formatted: string;
  unit: "percent" | "currency" | "ratio";
  status?: "green" | "amber" | "red";
  benchmark?: number;
  description: string;
}

export interface SubmissionKpisResponse {
  submission_id: string;
  reporting_year: number;
  computed_at: string;
  submission_status: string;
  kpis: KpiItemResponse[];
  prior_year_kpis?: KpiItemResponse[];
}

export interface LineItemResponse {
  id: string;
  account_code?: number;
  account_name: string;
  account_category: string;
  account_subcategory?: string;
  month?: number;
  value?: number;
}

export interface SubmissionLineItemsResponse {
  submission_id: string;
  current_year: LineItemResponse[];
  prior_year?: LineItemResponse[];
}

export interface PortfolioCategoryDto {
  category: string;
  balance: number;
  count: number;
}

export interface PortfolioBreakdownResponse {
  submission_id: string;
  categories: PortfolioCategoryDto[];
}

export interface MembershipStatsResponse {
  submission_id: string;
  male_members: number;
  female_members: number;
  youth_members: number;
  active_members: number;
  inactive_members: number;
  agm_attendance: number;
}

// When running inside Docker (Gotenberg or frontend container), requests must go
// directly to the backend because Vite's dev proxy isn't available. The hostname
// check distinguishes Gotenberg's headless Chromium (hostname contains "frontend"
// or "gotenberg") from the user's browser (hostname is "localhost").
const BASE_URL =
  window.location.hostname.includes("frontend") || window.location.hostname.includes("gotenberg")
    ? "http://backend:3000"
    : import.meta.env.VITE_API_BASE_URL || "";

/**
 * Fetches computed KPIs for a specific submission.
 * KPIs are computed on-demand from the submission's balance sheet line items.
 * The submission_id should be the latest submission (highest reporting_year)
 * from useCooperativeSubmissions — regardless of status.
 */
export const useCooperativeKpis = (submissionId: string | undefined, tokenOverride?: string) =>
  useOfflineQuery<SubmissionKpisResponse>({
    queryKey: ["coop-kpis", submissionId, tokenOverride],
    cacheTable: "submissions",
    cacheKey: `kpis-${submissionId}`,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      const res = await fetch(
        `${BASE_URL}/api/v1/cooperative/submissions/${submissionId}/kpis?include_prior_year=true`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>)["message"] ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<SubmissionKpisResponse>;
    },
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      // Don't retry 404s — no financial statement yet
      if (error instanceof Error && error.message.includes("404")) return false;
      return failureCount < 2;
    },
  });

export const useSubmissionLineItems = (submissionId: string | undefined, tokenOverride?: string) =>
  useOfflineQuery<SubmissionLineItemsResponse>({
    queryKey: ["coop-line-items", submissionId, tokenOverride],
    cacheTable: "submissions",
    cacheKey: `line-items-${submissionId}`,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      const res = await fetch(
        `${BASE_URL}/api/v1/cooperative/submissions/${submissionId}/financial-statement/line-items?include_prior_year=true`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>)["message"] ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<SubmissionLineItemsResponse>;
    },
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

export const usePortfolioBreakdown = (submissionId: string | undefined, tokenOverride?: string) =>
  useOfflineQuery<PortfolioBreakdownResponse>({
    queryKey: ["portfolio-breakdown", submissionId, tokenOverride],
    cacheTable: "submissions",
    cacheKey: `portfolio-${submissionId}`,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      const res = await fetch(
        `${BASE_URL}/api/v1/cooperative/submissions/${submissionId}/portfolio-breakdown`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>)["message"] ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<PortfolioBreakdownResponse>;
    },
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

export const useMembershipStats = (submissionId: string | undefined, tokenOverride?: string) =>
  useOfflineQuery<MembershipStatsResponse>({
    queryKey: ["membership-stats", submissionId, tokenOverride],
    cacheTable: "submissions",
    cacheKey: `membership-${submissionId}`,
    queryFn: async () => {
      const token = tokenOverride || (await getAccessToken());
      const res = await fetch(
        `${BASE_URL}/api/v1/cooperative/submissions/${submissionId}/membership-stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>)["message"] ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<MembershipStatsResponse>;
    },
    enabled: !!submissionId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
