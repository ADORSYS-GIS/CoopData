/**
 * React Query hooks for the apex Mambu endpoints: the cooperatives with their link and
 * latest sync, the syncs, the automatic sync setting and the ledger and product
 * mappings. Apex role only. Mambu actions are online-only, so no offline cache.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

type Schemas = components["schemas"];

export type MambuApexCooperative = Schemas["MambuApexCooperativeResponse"];
export type MambuSyncRun = Schemas["MambuSyncRunResponse"];
export type MambuSyncDetail = Schemas["MambuSyncDetailResponse"];
export type MambuSyncItem = Schemas["MambuSyncItemResponse"];
export type MambuGlAccount = Schemas["MambuGlAccountResponse"];
export type CoopAccountOption = Schemas["CoopAccountOption"];
export type MambuAccountMapping = Schemas["MambuAccountMappingResponse"];
export type MambuProduct = Schemas["MambuProductResponse"];

const KEY = "mambu";
const POLL_MS = 3000;

export function errorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const nested = e["error"];
    const msg =
      e["message"] ??
      e["detail"] ??
      (nested && typeof nested === "object"
        ? (nested as Record<string, unknown>)["message"]
        : nested);
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return "Request failed";
}

export const useMambuStatus = () =>
  useQuery({
    queryKey: [KEY, "status"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/mambu/status");
      if (error) throw new Error(errorMessage(error));
      return data as Schemas["MambuStatusResponse"];
    },
    staleTime: 60_000,
  });

/** The apex's cooperatives with their Mambu link and latest sync. Refreshes while one runs. */
export const useMambuCooperatives = () =>
  useQuery({
    queryKey: [KEY, "cooperatives"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/mambu/cooperatives");
      if (error) throw new Error(errorMessage(error));
      return data as MambuApexCooperative[];
    },
    refetchInterval: (query) => (query.state.data?.some((c) => c.running) ? POLL_MS : false),
  });

export const useMambuSyncs = () =>
  useQuery({
    queryKey: [KEY, "syncs"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/mambu/syncs");
      if (error) throw new Error(errorMessage(error));
      return data as MambuSyncRun[];
    },
    refetchInterval: (query) =>
      query.state.data?.some((r) => r.status === "running") ? POLL_MS : false,
  });

export const useMambuSync = (id: string | null) =>
  useQuery({
    queryKey: [KEY, "sync", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/mambu/syncs/{id}", {
        params: { path: { id: id as string } },
      });
      if (error) throw new Error(errorMessage(error));
      return data as MambuSyncDetail;
    },
    refetchInterval: (query) => (query.state.data?.run.status === "running" ? POLL_MS : false),
  });

/** Starts the sync of a whole year. Without `cooperativeIds` every linked cooperative is synced. */
export const useStartMambuSync = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { year: number; cooperativeIds?: string[] }) => {
      const { data, error } = await apiClient.POST("/api/v1/apex/mambu/syncs", {
        body: { year: payload.year, cooperative_ids: payload.cooperativeIds },
      });
      if (error) throw new Error(errorMessage(error));
      return data as MambuSyncRun;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
};

export const useSetMambuAutoSync = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { cooperativeId: string; autoSync: boolean }) => {
      const { error } = await apiClient.PUT("/api/v1/apex/cooperatives/{id}/mambu-auto-sync", {
        params: { path: { id: payload.cooperativeId } },
        body: { auto_sync: payload.autoSync },
      });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "cooperatives"] }),
  });
};

export const useMambuGlAccounts = (enabled: boolean) =>
  useQuery({
    queryKey: [KEY, "gl-accounts"],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/mambu/gl-accounts");
      if (error) throw new Error(errorMessage(error));
      return data as MambuGlAccount[];
    },
    staleTime: 60_000,
  });

export const useCoopAccounts = () =>
  useQuery({
    queryKey: [KEY, "coop-accounts"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/mambu/coop-accounts");
      if (error) throw new Error(errorMessage(error));
      return data as CoopAccountOption[];
    },
    staleTime: 5 * 60_000,
  });

export const useUpsertAccountMapping = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Schemas["UpsertMambuAccountMappingRequest"]) => {
      const { error } = await apiClient.PUT("/api/v1/apex/mambu/account-mappings", {
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
      const { error } = await apiClient.DELETE("/api/v1/apex/mambu/account-mappings/{code}", {
        params: { path: { code } },
      });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "gl-accounts"] }),
  });
};

export const useMambuProducts = (enabled: boolean) =>
  useQuery({
    queryKey: [KEY, "products"],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/mambu/products");
      if (error) throw new Error(errorMessage(error));
      return data as MambuProduct[];
    },
    staleTime: 60_000,
  });

export const useUpsertProductMapping = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Schemas["UpsertMambuProductMappingRequest"]) => {
      const { error } = await apiClient.PUT("/api/v1/apex/mambu/product-mappings", {
        body: payload,
      });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "products"] }),
  });
};
