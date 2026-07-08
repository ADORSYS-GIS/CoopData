import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import { getAccessToken } from "@/services/shared/authService";

const COOP_PROFILES_KEY = "cooperative-profiles";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface CooperativeProfile {
  id: string;
  keycloak_id: string | null;
  apex_id: string | null;
  keycloak_group_id: string | null;
  apex_group_id: string | null;
  federation_org_id: string | null;
  name: string;
  institution_type: string | null;
  reg_no: string | null;
  tin: string | null;
  address: string | null;
  georeference: string | null;
  region: string | null;
  geographic_classif: string | null;
  phone: string | null;
  sector: string | null;
  responsibe_financial: string | null;
  responsible_non_financial: string | null;
  status: string;
  registered_on: string | null;
  accounting_year: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCooperativeProfileInput {
  name: string;
  institution_type: string;
  reg_no: string;
  tin?: string;
  address?: string;
  georeference?: string;
  region: string;
  geographic_classif: string;
  phone?: string;
  sector: string;
  responsibe_financial?: string;
  responsible_non_financial?: string;
  status?: string;
  registered_on: string;
  accounting_year?: string;
  apex_group_id?: string;
  federation_org_id?: string;
}

export interface UpdateCooperativeProfileInput {
  name?: string;
  institution_type?: string;
  reg_no?: string;
  tin?: string;
  address?: string;
  georeference?: string;
  region?: string;
  geographic_classif?: string;
  phone?: string;
  sector?: string;
  responsibe_financial?: string;
  responsible_non_financial?: string;
  status?: string;
  registered_on?: string;
  accounting_year?: string;
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

export const useCooperativeProfiles = () =>
  useQuery({
    queryKey: [COOP_PROFILES_KEY],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/apex/coop-profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => []);
      if (!res.ok) throw new Error(extractErrorMessage(json));
      return json as CooperativeProfile[];
    },
  });

export const useCooperativeProfile = (id: string) =>
  useQuery({
    queryKey: [COOP_PROFILES_KEY, id],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/apex/coop-profiles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(json));
      return json as CooperativeProfile;
    },
    enabled: !!id,
  });

export const useCreateCooperativeProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCooperativeProfileInput) => {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/apex/coop-profiles`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(json));
      return json as CooperativeProfile;
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
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/apex/coop-profiles/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(json));
      return json as CooperativeProfile;
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
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/apex/coop-profiles/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(json));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COOP_PROFILES_KEY] });
    },
  });
};
