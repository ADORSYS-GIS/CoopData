import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";
import type {
  FixedDepositResponse,
  CreateFixedDepositRequest,
  UpdateFixedDepositRequest,
  PaginatedResponse,
  NfListParams,
} from "@/types/non-financial";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const NF_FD_KEY = "non-financial-fixed-deposits";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

async function fetchFixedDeposits(
  params?: NfListParams,
): Promise<PaginatedResponse<FixedDepositResponse>> {
  const token = await getAccessToken();
  const query = new URLSearchParams();
  if (params?.submission_id) query.set("submission_id", params.submission_id);
  query.set("page", String(params?.page ?? 1));
  query.set("page_size", String(params?.page_size ?? 50));

  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/fixed-deposits?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as PaginatedResponse<FixedDepositResponse>;
}

async function createFixedDeposit(body: CreateFixedDepositRequest): Promise<FixedDepositResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/fixed-deposits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as FixedDepositResponse;
}

async function updateFixedDeposit({
  id,
  body,
}: {
  id: string;
  body: UpdateFixedDepositRequest;
}): Promise<FixedDepositResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/fixed-deposits/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as FixedDepositResponse;
}

async function deleteFixedDeposit(id: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/fixed-deposits/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    const json = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(json));
  }
}

export const useFixedDeposits = (params?: NfListParams) =>
  useQuery({
    queryKey: [NF_FD_KEY, params],
    queryFn: () => fetchFixedDeposits(params),
  });

export const useCreateFixedDeposit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFixedDeposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_FD_KEY] });
    },
  });
};

export const useUpdateFixedDeposit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateFixedDeposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_FD_KEY] });
    },
  });
};

export const useDeleteFixedDeposit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteFixedDeposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_FD_KEY] });
    },
  });
};
