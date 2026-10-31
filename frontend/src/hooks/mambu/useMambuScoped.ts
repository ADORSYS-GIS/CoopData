/**
 * React Query hooks for the Mambu endpoints of cooperatives and apexes:
 * the SACCO sync status and the link between a cooperative and its Mambu branch.
 * Mambu actions are online-only, so no offline cache.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

type Schemas = components["schemas"];

export type MambuCooperativeStatus = Schemas["MambuCooperativeStatusResponse"];
export type MambuBranchPreview = Schemas["MambuBranchPreviewResponse"];
export type MambuCooperativeLink = Schemas["MambuCooperativeLinkResponse"];

const KEY = "mambu-scoped";
const POLL_MS = 5000;

function errorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["detail"] ?? e["error"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return "Request failed";
}

export const useCooperativeMambuStatus = (enabled = true) =>
  useQuery({
    queryKey: [KEY, "status"],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/cooperative/mambu/status");
      if (error) throw new Error(errorMessage(error));
      return data as MambuCooperativeStatus;
    },
    refetchInterval: (query) =>
      query.state.data?.running || (query.state.data?.cooldown_seconds_left ?? 0) > 0
        ? POLL_MS
        : false,
  });

/** Searches free Mambu branches by ID or part of the name (at least 3 letters, 8 results). */
export const useSearchMambuBranches = () =>
  useMutation({
    mutationFn: async (payload: { query: string; cooperativeId?: string }) => {
      const { data, error } = await apiClient.GET("/api/v1/apex/mambu/branches", {
        params: { query: { q: payload.query.trim(), cooperative_id: payload.cooperativeId } },
      });
      if (error) throw new Error(errorMessage(error));
      return data as MambuBranchPreview[];
    },
  });

export const useCooperativeMambuLink = (cooperativeId: string | undefined) =>
  useQuery({
    queryKey: [KEY, "link", cooperativeId],
    enabled: !!cooperativeId,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/cooperatives/{id}/mambu-link", {
        params: { path: { id: cooperativeId as string } },
      });
      if (error) throw new Error(errorMessage(error));
      return data as MambuCooperativeLink;
    },
  });

export const useSetMambuLink = (cooperativeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (branchId: string) => {
      const { data, error } = await apiClient.PUT("/api/v1/apex/cooperatives/{id}/mambu-link", {
        params: { path: { id: cooperativeId } },
        body: { mambu_branch_id: branchId.trim() },
      });
      if (error) throw new Error(errorMessage(error));
      return data as MambuCooperativeLink;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "link", cooperativeId] }),
  });
};

export const useClearMambuLink = (cooperativeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.DELETE("/api/v1/apex/cooperatives/{id}/mambu-link", {
        params: { path: { id: cooperativeId } },
      });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "link", cooperativeId] }),
  });
};
