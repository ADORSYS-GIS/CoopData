import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";
import { useUserRole } from "@/lib/auth";
import type { NfUploadResponse } from "@/types/non-financial";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

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

function nfUploadUrl(role: string | null): string {
  const base = role === "apex" ? "/api/v1/apex" : "/api/v1/cooperative";
  return `${API_BASE}${base}/non-financial/upload`;
}

export const useNfUpload = () => {
  const queryClient = useQueryClient();
  const role = useUserRole();
  return useMutation({
    mutationFn: async ({ file, submissionId }: UploadParams): Promise<NfUploadResponse> => {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("submission_id", submissionId);

      const url = nfUploadUrl(role);
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(json));
      return json as NfUploadResponse;
    },
    onSuccess: (_data, vars) => {
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
