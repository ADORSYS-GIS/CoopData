import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import { runMutation } from "@/services/shared/syncQueueService";
import type { components } from "@/openapi-client/api";
import { cacheGet, cacheSet, cacheDelete } from "@/services/shared/offlineCache";
import { getUserProfile } from "@/services/shared/authService";

const COOP_PROFILES_KEY = "cooperative-profiles";

type CooperativeProfile = components["schemas"]["CooperativeProfileResponse"];
type CreateCooperativeProfileInput = components["schemas"]["CreateCooperativeProfileRequest"];
type UpdateCooperativeProfileInput = components["schemas"]["UpdateCooperativeProfileRequest"];

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

export type { CooperativeProfile, CreateCooperativeProfileInput, UpdateCooperativeProfileInput };

export const useCooperativeProfiles = () =>
  useOfflineQuery({
    queryKey: [COOP_PROFILES_KEY],
    cacheTable: "cooperatives",
    cacheKey: "cooperative-profiles",
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/apex/coop-profiles");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as unknown as CooperativeProfile[]) ?? [];
    },
  });

export const useCooperativeProfile = (id: string, tokenOverride?: string) =>
  useOfflineQuery({
    queryKey: [COOP_PROFILES_KEY, id],
    cacheTable: "cooperatives",
    cacheKey: `cooperative-profile-${id}`,
    queryFn: async () => {
      const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : undefined;
      const { data, error } = await apiClient.GET("/api/v1/apex/coop-profiles/{id}", {
        params: { path: { id } },
        headers,
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as unknown as CooperativeProfile;
    },
    enabled: !!id,
  });

export const useCreateCooperativeProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCooperativeProfileInput) => {
      const localId = crypto.randomUUID();
      const optimistic: CooperativeProfile = {
        id: localId,
        ...body,
      } as unknown as CooperativeProfile;

      const userId = getUserProfile()?.id ?? "anon";
      try {
        const cachedList = await cacheGet<CooperativeProfile[]>(
          "cooperatives",
          "cooperative-profiles",
          userId,
          true,
        );
        if (cachedList) {
          if (!cachedList.some((c) => c.id === localId)) {
            const updated = [optimistic, ...cachedList];
            await cacheSet("cooperatives", "cooperative-profiles", userId, updated);
          }
        } else {
          await cacheSet("cooperatives", "cooperative-profiles", userId, [optimistic]);
        }
      } catch (e) {
        console.warn("Failed to update cached cooperative profiles list on create", e);
      }

      try {
        await cacheSet("cooperatives", `cooperative-profile-${localId}`, userId, optimistic);
      } catch (e) {
        // ignore
      }

      const payload = {
        ...body,
        id: localId,
      };

      return runMutation<CooperativeProfile>("/api/v1/apex/coop-profiles", "POST", {
        body: payload,
        optimisticData: optimistic,
        online: async () => {
          const { data, error } = await apiClient.POST("/api/v1/apex/coop-profiles", {
            body: payload as CreateCooperativeProfileInput,
          });
          if (error) throw new Error(extractErrorMessage(error));
          return data as unknown as CooperativeProfile;
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COOP_PROFILES_KEY] });
    },
  });
};

export const useUpdateCooperativeProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateCooperativeProfileInput & { id: string }) => {
      const userId = getUserProfile()?.id ?? "anon";
      try {
        const cachedList = await cacheGet<CooperativeProfile[]>(
          "cooperatives",
          "cooperative-profiles",
          userId,
          true,
        );
        if (cachedList) {
          const updated = cachedList.map((c) =>
            c.id === id ? { ...c, ...body } : c,
          ) as CooperativeProfile[];
          await cacheSet("cooperatives", "cooperative-profiles", userId, updated);
        }
      } catch (e) {
        // ignore
      }

      try {
        const cachedDetail = await cacheGet<CooperativeProfile>(
          "cooperatives",
          `cooperative-profile-${id}`,
          userId,
          true,
        );
        if (cachedDetail) {
          const updated = { ...cachedDetail, ...body } as CooperativeProfile;
          await cacheSet("cooperatives", `cooperative-profile-${id}`, userId, updated);
        }
      } catch (e) {
        // ignore
      }

      return runMutation<CooperativeProfile>("/api/v1/apex/coop-profiles/{id}", "PATCH", {
        pathParams: { id },
        body,
        optimisticData: body as unknown as CooperativeProfile,
        online: async () => {
          const { data, error } = await apiClient.PATCH("/api/v1/apex/coop-profiles/{id}", {
            params: { path: { id } },
            body,
          });
          if (error) throw new Error(extractErrorMessage(error));
          return data as unknown as CooperativeProfile;
        },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [COOP_PROFILES_KEY] });
      queryClient.invalidateQueries({ queryKey: [COOP_PROFILES_KEY, variables.id] });
    },
  });
};

export const useDeleteCooperativeProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const userId = getUserProfile()?.id ?? "anon";
      try {
        const cachedList = await cacheGet<CooperativeProfile[]>(
          "cooperatives",
          "cooperative-profiles",
          userId,
          true,
        );
        if (cachedList) {
          const updated = cachedList.filter((c) => c.id !== id);
          await cacheSet("cooperatives", "cooperative-profiles", userId, updated);
        }
      } catch (e) {
        // ignore
      }

      try {
        await cacheDelete("cooperatives", `cooperative-profile-${id}`);
      } catch (e) {
        // ignore
      }

      return runMutation<void>("/api/v1/apex/coop-profiles/{id}", "DELETE", {
        pathParams: { id },
        online: async () => {
          const { error } = await apiClient.DELETE("/api/v1/apex/coop-profiles/{id}", {
            params: { path: { id } },
          });
          if (error) throw new Error(extractErrorMessage(error));
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COOP_PROFILES_KEY] });
    },
  });
};
