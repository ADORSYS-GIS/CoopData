import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import i18n from "@/i18n";
import type { components } from "@/openapi-client/api";

export type IndicatorCatalogResponse = components["schemas"]["IndicatorCatalogResponse"];
export type CreateIndicatorRequest = components["schemas"]["CreateIndicatorRequest"];
export type UpdateIndicatorRequest = components["schemas"]["UpdateIndicatorRequest"];
export type IndicatorEntryResponse = components["schemas"]["IndicatorEntryResponse"];
export type SaveIndicatorEntry = components["schemas"]["SaveIndicatorEntry"];
export type ConsolidationResponse = components["schemas"]["ConsolidationResponse"];

const INDICATOR_CATALOG_KEY = "indicator-catalog";
const SUBMISSION_ENTRIES_KEY = "submission-entries";
const CONSOLIDATION_KEY = "indicator-consolidation";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

export const useIndicatorCatalog = (coopType?: string) => {
  const lang = i18n.language?.split("-")[0] || "en";
  return useQuery({
    queryKey: [INDICATOR_CATALOG_KEY, coopType, lang],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/non-financial-indicators/catalog", {
        params: {
          query: coopType ? { coop_type: coopType, lang } : { lang },
        },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return (data as IndicatorCatalogResponse[]) ?? [];
    },
  });
};

export const useSubmissionEntries = (submissionId: string) =>
  useQuery({
    queryKey: [SUBMISSION_ENTRIES_KEY, submissionId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/cooperative/submissions/{id}/non-financial-indicators",
        {
          params: { path: { id: submissionId } },
        },
      );
      if (error) throw new Error(extractErrorMessage(error));
      return (data as IndicatorEntryResponse[]) ?? [];
    },
    enabled: !!submissionId,
  });

export const useSaveSubmissionEntries = (submissionId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entries: SaveIndicatorEntry[]) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/cooperative/submissions/{id}/non-financial-indicators",
        {
          params: { path: { id: submissionId } },
          body: { entries },
        },
      );
      if (error) throw new Error(extractErrorMessage(error));
      return data as IndicatorEntryResponse[];
    },
    onSuccess: () => {
      // Invalidate entries
      queryClient.invalidateQueries({ queryKey: [SUBMISSION_ENTRIES_KEY, submissionId] });
      // Invalidate sections so the status pills update immediately
      queryClient.invalidateQueries({
        queryKey: ["cooperative-submissions", submissionId, "sections"],
      });
      queryClient.invalidateQueries({ queryKey: ["cooperative-submissions", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
    },
  });
};

export const useCreateCatalogItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateIndicatorRequest) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/ministry/non-financial-indicators/catalog",
        { body },
      );
      if (error) throw new Error(extractErrorMessage(error));
      return data as IndicatorCatalogResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INDICATOR_CATALOG_KEY] });
    },
  });
};

export const useUpdateCatalogItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateIndicatorRequest }) => {
      const { data, error } = await apiClient.PUT(
        "/api/v1/ministry/non-financial-indicators/catalog/{id}",
        {
          params: { path: { id } },
          body,
        },
      );
      if (error) throw new Error(extractErrorMessage(error));
      return data as IndicatorCatalogResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INDICATOR_CATALOG_KEY] });
    },
  });
};

export const useDeleteCatalogItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.DELETE(
        "/api/v1/ministry/non-financial-indicators/catalog/{id}",
        {
          params: { path: { id } },
        },
      );
      if (error) throw new Error(extractErrorMessage(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INDICATOR_CATALOG_KEY] });
    },
  });
};

export const useConsolidateIndicator = (indicatorName: string) =>
  useQuery({
    queryKey: [CONSOLIDATION_KEY, indicatorName],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/ministry/non-financial-indicators/consolidate",
        {
          params: { query: { indicator_name: indicatorName } },
        },
      );
      if (error) throw new Error(extractErrorMessage(error));
      return data as ConsolidationResponse;
    },
    enabled: !!indicatorName,
  });
