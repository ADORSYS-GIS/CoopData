import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";
import { useUserRole } from "@/lib/auth";
import { runMutation } from "@/services/shared/syncQueueService";
import type { NfUploadResponse } from "@/types/non-financial";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const NF_KEY = "non-financial";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

export interface UploadParams {
  file: File;
  submissionId: string;
}

function nfUploadPath(role: string | null): string {
  return role === "apex"
    ? "/api/v1/apex/non-financial/upload"
    : "/api/v1/cooperative/non-financial/upload";
}

async function uploadFile(
  { file, submissionId }: UploadParams,
  role: string | null,
): Promise<NfUploadResponse> {
  const token = await getAccessToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("submission_id", submissionId);

  const path = nfUploadPath(role);
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(json));
  return json as NfUploadResponse;
}

export const useNfUpload = () => {
  const queryClient = useQueryClient();
  const role = useUserRole();
  return useMutation({
    mutationFn: async (vars: UploadParams) => {
      const endpoint = nfUploadPath(role);
      return runMutation<NfUploadResponse>(endpoint, "POST", {
        optimisticData: undefined,
        online: () => uploadFile(vars, role),
      });
    },
    onSuccess: (_data, vars) => {
      // Invalidate all 5 non-financial data caches so tables refresh immediately
      for (const key of [
        "non-financial-members",
        "non-financial-savings",
        "non-financial-loans",
        "non-financial-fixed-deposits",
        "non-financial-farm-coop",
        "non-financial",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      // Also refresh submission sections so status pills update
      void queryClient.invalidateQueries({
        queryKey: ["cooperative-submissions", vars.submissionId, "sections"],
      });
      void queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
      void queryClient.invalidateQueries({
        queryKey: ["cooperative-submissions", vars.submissionId],
      });
      void queryClient.invalidateQueries({ queryKey: ["apex-submissions"] });
    },
  });
};
