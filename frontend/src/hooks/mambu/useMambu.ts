/**
 * React Query hooks for the Ministry Mambu synchronisation endpoints.
 * Ministry role required. Mambu actions are online-only, so no offline cache.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

type Schemas = components["schemas"];

export type MambuBranch = Schemas["MambuBranchResponse"];
export type MambuCooperative = Schemas["MambuCooperativeOption"];
export type MambuSyncRun = Schemas["MambuSyncRunResponse"];
export type MambuSyncDetail = Schemas["MambuSyncDetailResponse"];
export type MambuSyncItem = Schemas["MambuSyncItemResponse"];
export type MambuGlAccount = Schemas["MambuGlAccountResponse"];
export type CoopAccountOption = Schemas["CoopAccountOption"];
export type MambuAccountMapping = Schemas["MambuAccountMappingResponse"];

/** Who runs the sync: decides which endpoints are used and where results land. */
export type MambuScope = "ministry" | "apex" | "cooperative";

const KEY = "mambu";
const POLL_MS = 3000;

function errorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["detail"] ?? e["error"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return "Request failed";
}

/** Whether Mambu is configured. A cooperative reads it from its own status endpoint. */
export const useMambuStatus = (scope: MambuScope = "ministry") =>
  useQuery({
    queryKey: [KEY, scope, "status"],
    enabled: scope !== "cooperative",
    queryFn: async () => {
      const { data, error } =
        scope === "apex"
          ? await apiClient.GET("/api/v1/apex/mambu/status")
          : await apiClient.GET("/api/v1/ministry/mambu/status");
      if (error) throw new Error(errorMessage(error));
      return data as Schemas["MambuStatusResponse"];
    },
    staleTime: 60_000,
  });

export const useMambuBranches = (enabled: boolean) =>
  useQuery({
    queryKey: [KEY, "branches"],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/mambu/branches");
      if (error) throw new Error(errorMessage(error));
      return data as MambuBranch[];
    },
    staleTime: 60_000,
  });

export const useMambuCooperatives = () =>
  useQuery({
    queryKey: [KEY, "cooperatives"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/mambu/cooperatives");
      if (error) throw new Error(errorMessage(error));
      return data as MambuCooperative[];
    },
  });

async function fetchSyncs(scope: MambuScope) {
  if (scope === "apex") return apiClient.GET("/api/v1/apex/mambu/syncs");
  if (scope === "cooperative") return apiClient.GET("/api/v1/cooperative/mambu/syncs");
  return apiClient.GET("/api/v1/ministry/mambu/syncs");
}

async function fetchSync(scope: MambuScope, id: string) {
  const params = { params: { path: { id } } };
  if (scope === "apex") return apiClient.GET("/api/v1/apex/mambu/syncs/{id}", params);
  if (scope === "cooperative") return apiClient.GET("/api/v1/cooperative/mambu/syncs/{id}", params);
  return apiClient.GET("/api/v1/ministry/mambu/syncs/{id}", params);
}

async function postSync(scope: MambuScope, payload: { year: number; month: number }) {
  if (scope === "apex") return apiClient.POST("/api/v1/apex/mambu/syncs", { body: payload });
  if (scope === "cooperative") {
    return apiClient.POST("/api/v1/cooperative/mambu/syncs", { body: payload });
  }
  return apiClient.POST("/api/v1/ministry/mambu/syncs", { body: payload });
}

export const useMambuSyncs = (scope: MambuScope = "ministry") =>
  useQuery({
    queryKey: [KEY, scope, "syncs"],
    queryFn: async () => {
      const { data, error } = await fetchSyncs(scope);
      if (error) throw new Error(errorMessage(error));
      return data as MambuSyncRun[];
    },
    refetchInterval: (query) =>
      query.state.data?.some((r) => r.status === "running") ? POLL_MS : false,
  });

export const useMambuSync = (id: string | null, scope: MambuScope = "ministry") =>
  useQuery({
    queryKey: [KEY, scope, "sync", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await fetchSync(scope, id as string);
      if (error) throw new Error(errorMessage(error));
      return data as MambuSyncDetail;
    },
    refetchInterval: (query) => (query.state.data?.run.status === "running" ? POLL_MS : false),
  });

export const useStartMambuSync = (scope: MambuScope = "ministry") => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { year: number; month: number }) => {
      const { data, error } = await postSync(scope, payload);
      if (error) throw new Error(errorMessage(error));
      return data as MambuSyncRun;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, scope] }),
  });
};

export const useUpsertMambuLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { cooperative_id: string; mambu_branch_id: string }) => {
      const { error } = await apiClient.PUT("/api/v1/ministry/mambu/links", { body: payload });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "branches"] });
      qc.invalidateQueries({ queryKey: [KEY, "cooperatives"] });
    },
  });
};

export const useDeleteMambuLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cooperativeId: string) => {
      const { error } = await apiClient.DELETE("/api/v1/ministry/mambu/links/{cooperative_id}", {
        params: { path: { cooperative_id: cooperativeId } },
      });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "branches"] });
      qc.invalidateQueries({ queryKey: [KEY, "cooperatives"] });
    },
  });
};

export const useMambuGlAccounts = (enabled: boolean) =>
  useQuery({
    queryKey: [KEY, "gl-accounts"],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/mambu/gl-accounts");
      if (error) throw new Error(errorMessage(error));
      return data as MambuGlAccount[];
    },
    staleTime: 60_000,
  });

export const useCoopAccounts = () =>
  useQuery({
    queryKey: [KEY, "coop-accounts"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/mambu/coop-accounts");
      if (error) throw new Error(errorMessage(error));
      return data as CoopAccountOption[];
    },
    staleTime: 5 * 60_000,
  });

export const useUpsertAccountMapping = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Schemas["UpsertMambuAccountMappingRequest"]) => {
      const { error } = await apiClient.PUT("/api/v1/ministry/mambu/account-mappings", {
        body: payload,
      });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "gl-accounts"] }),
  });
};

export const useDeleteAccountMapping = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await apiClient.DELETE("/api/v1/ministry/mambu/account-mappings/{code}", {
        params: { path: { code } },
      });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "gl-accounts"] }),
  });
};
