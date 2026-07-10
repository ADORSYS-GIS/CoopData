import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";
import type {
  LoanResponse,
  CreateLoanRequest,
  UpdateLoanRequest,
  PaginatedResponse,
  NfListParams,
} from "@/types/non-financial";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const NF_LOANS_KEY = "non-financial-loans";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

async function fetchLoans(params?: NfListParams): Promise<PaginatedResponse<LoanResponse>> {
  const token = await getAccessToken();
  const query = new URLSearchParams();
  if (params?.submission_id) query.set("submission_id", params.submission_id);
  query.set("page", String(params?.page ?? 1));
  query.set("page_size", String(params?.page_size ?? 50));

  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/loans?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as PaginatedResponse<LoanResponse>;
}

async function createLoan(body: CreateLoanRequest): Promise<LoanResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/loans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as LoanResponse;
}

async function updateLoan({
  id,
  body,
}: {
  id: string;
  body: UpdateLoanRequest;
}): Promise<LoanResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/loans/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as LoanResponse;
}

async function deleteLoan(id: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/loans/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    const json = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(json));
  }
}

export const useLoans = (params?: NfListParams) =>
  useQuery({
    queryKey: [NF_LOANS_KEY, params],
    queryFn: () => fetchLoans(params),
  });

export const useLoan = (id: string) =>
  useQuery({
    queryKey: [NF_LOANS_KEY, id],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/loans/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(json));
      return json as LoanResponse;
    },
    enabled: !!id,
  });

export const useCreateLoan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_LOANS_KEY] });
    },
  });
};

export const useUpdateLoan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_LOANS_KEY] });
    },
  });
};

export const useDeleteLoan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_LOANS_KEY] });
    },
  });
};
