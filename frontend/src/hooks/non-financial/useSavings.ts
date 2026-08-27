import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { getAccessToken } from "@/services/shared/authService";
import { runMutation } from "@/services/shared/syncQueueService";
import type {
  SavingsAccountResponse,
  CreateSavingsAccountRequest,
  UpdateSavingsAccountRequest,
  PaginatedResponse,
  NfListParams,
} from "@/types/non-financial";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const NF_SAVINGS_KEY = "non-financial-savings";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

async function fetchSavings(
  params?: NfListParams,
): Promise<PaginatedResponse<SavingsAccountResponse>> {
  const token = await getAccessToken();
  const query = new URLSearchParams();
  if (params?.submission_id) query.set("submission_id", params.submission_id);
  query.set("page", String(params?.page ?? 1));
  query.set("page_size", String(params?.page_size ?? 50));

  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/savings?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as PaginatedResponse<SavingsAccountResponse>;
}

async function createSavings(body: CreateSavingsAccountRequest): Promise<SavingsAccountResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/savings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as SavingsAccountResponse;
}

async function updateSavings({
  id,
  body,
}: {
  id: string;
  body: UpdateSavingsAccountRequest;
}): Promise<SavingsAccountResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/savings/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as SavingsAccountResponse;
}

async function deleteSavings(id: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/savings/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    const json = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(json));
  }
}

export const useSavings = (params?: NfListParams) =>
  useOfflineQuery({
    queryKey: [NF_SAVINGS_KEY, params],
    cacheTable: "submissions",
    cacheKey: `savings-list-${JSON.stringify(params ?? {})}`,
    queryFn: () => fetchSavings(params),
  });

export const useSaving = (id: string) =>
  useOfflineQuery({
    queryKey: [NF_SAVINGS_KEY, id],
    cacheTable: "submissions",
    cacheKey: `saving-${id}`,
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/savings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(json));
      return json as SavingsAccountResponse;
    },
    enabled: !!id,
  });

export const useCreateSavings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateSavingsAccountRequest) => {
      return runMutation<SavingsAccountResponse>(
        "/api/v1/cooperative/non-financial/savings",
        "POST",
        {
          body,
          optimisticData: body as unknown as SavingsAccountResponse,
          online: () => createSavings(body),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_SAVINGS_KEY] });
    },
  });
};

export const useUpdateSavings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; body: UpdateSavingsAccountRequest }) => {
      return runMutation<SavingsAccountResponse>(
        "/api/v1/cooperative/non-financial/savings/{id}",
        "PUT",
        {
          pathParams: { id: vars.id },
          body: vars.body,
          optimisticData: vars.body as unknown as SavingsAccountResponse,
          online: () => updateSavings(vars),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_SAVINGS_KEY] });
    },
  });
};

export const useDeleteSavings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return runMutation<void>("/api/v1/cooperative/non-financial/savings/{id}", "DELETE", {
        pathParams: { id },
        online: () => deleteSavings(id),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_SAVINGS_KEY] });
    },
  });
};
