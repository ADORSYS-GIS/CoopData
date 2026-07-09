import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";
import type { NfUploadResponse } from "@/types/non-financial";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
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

async function uploadFile({ file, submissionId }: UploadParams): Promise<NfUploadResponse> {
  const token = await getAccessToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("submission_id", submissionId);

  const res = await fetch(`${API_BASE}/api/v1/cooperative/non-financial/upload`, {
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
  return useMutation({
    mutationFn: uploadFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NF_KEY] });
    },
  });
};
