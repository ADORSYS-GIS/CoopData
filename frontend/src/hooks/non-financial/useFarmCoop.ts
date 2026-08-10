import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";
import type {
  FarmCoopResponse,
  CreateFarmCoopRequest,
  UpdateFarmCoopRequest,
  PaginatedResponse,
  NfListParams,
} from "@/types/non-financial";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const NF_FARM_KEY = "non-financial-farm-coop";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

async function fetchFarmCoop(params?: NfListParams): Promise<PaginatedResponse<FarmCoopResponse>> {
  const token = await getAccessToken();
  const query = new URLSearchParams();
  if (params?.submission_id) query.set("submission_id", params.submission_id);
  query.set("page", String(params?.page ?? 1));
  query.set("page_size", String(params?.page_size ?? 50));

  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/farm-coop?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as PaginatedResponse<FarmCoopResponse>;
}

async function createFarmCoop(body: CreateFarmCoopRequest): Promise<FarmCoopResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/farm-coop`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as FarmCoopResponse;
}

async function updateFarmCoop({
  id,
  body,
}: {
  id: string;
  body: UpdateFarmCoopRequest;
}): Promise<FarmCoopResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/farm-coop/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as FarmCoopResponse;
}

async function deleteFarmCoop(id: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/farm-coop/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    const json = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(json));
  }
}

export const useFarmCoops = (params?: NfListParams) =>
  useQuery({
    queryKey: [NF_FARM_KEY, params],
    queryFn: () => fetchFarmCoop(params),
  });

export const useFarmCoop = (id: string) =>
  useQuery({
    queryKey: [NF_FARM_KEY, id],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/farm-coop/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(json));
      return json as FarmCoopResponse;
    },
    enabled: !!id,
  });

export const useCreateFarmCoop = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFarmCoop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_FARM_KEY] });
    },
  });
};

export const useUpdateFarmCoop = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateFarmCoop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_FARM_KEY] });
    },
  });
};

export const useDeleteFarmCoop = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteFarmCoop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_FARM_KEY] });
    },
  });
};
