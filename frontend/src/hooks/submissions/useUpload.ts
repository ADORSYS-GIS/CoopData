import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";
import { useUserRole } from "@/lib/auth";
import type { components } from "@/openapi-client/api";

export type UploadResponse = components["schemas"]["UploadResponse"];

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export const useUploadFinancialStatement = (submissionId?: string) => {
  const queryClient = useQueryClient();
  const role = useUserRole();
  return useMutation({
    mutationFn: async ({
      files,
      reportingYear = new Date().getFullYear(),
      accountingYear = "calendar",
      currency = "SZL",
      submissionId: sid,
    }: {
      files: File[];
      reportingYear?: number;
      accountingYear?: string;
      currency?: string;
      submissionId?: string;
    }): Promise<UploadResponse> => {
      const base = role === "apex" ? "/api/v1/apex" : "/api/v1/cooperative";
      const token = await getAccessToken();
      const form = new FormData();
      for (const file of files) {
        form.append("file", file);
      }
      form.append("reporting_year", String(reportingYear));
      form.append("accounting_year", accountingYear);
      form.append("currency", currency);
      const resolvedId = sid ?? submissionId;
      if (resolvedId) {
        form.append("submission_id", resolvedId);
      }

      const res = await fetch(`${API_BASE}${base}/financial-statement/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as Record<string, string>)["message"] ?? `Upload failed: ${res.status}`,
        );
      }
      return res.json() as Promise<UploadResponse>;
    },
    onSuccess: (_data, vars) => {
      const sid = vars.submissionId ?? submissionId;
      queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["apex-submissions"] });
      if (sid) {
        queryClient.invalidateQueries({ queryKey: ["cooperative-submissions", sid] });
        queryClient.invalidateQueries({ queryKey: ["submission-files", sid] });
      }
    },
  });
};

export interface UploadedFileItem {
  id: string;
  submission_id: string;
  original_name: string;
  mime_type?: string;
  size_bytes?: number;
  created_at: string;
}

export const useSubmissionFiles = (submissionId?: string, category: string = "financial") => {
  const role = useUserRole();
  return useQuery({
    queryKey: ["submission-files", submissionId, role, category],
    queryFn: async (): Promise<UploadedFileItem[]> => {
      if (!submissionId) return [];
      const token = await getAccessToken();
      const res = await fetch(
        `${API_BASE}/api/v1/${role}/submissions/${submissionId}/files?category=${category}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!submissionId,
  });
};

export const useDeleteSingleFile = (submissionId?: string) => {
  const queryClient = useQueryClient();
  const role = useUserRole();
  return useMutation({
    mutationFn: async ({ submissionId: sid, fileId }: { submissionId: string; fileId: string }) => {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/${role}/submissions/${sid}/files/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>)["message"] ?? "Failed to delete file");
      }
    },
    onSuccess: (_data, vars) => {
      const sid = vars.submissionId ?? submissionId;
      if (sid) {
        queryClient.invalidateQueries({ queryKey: ["submission-files", sid] });
        queryClient.invalidateQueries({ queryKey: ["cooperative-submissions", sid] });
      }
    },
  });
};

