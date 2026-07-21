import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/services/shared/authService";
import type { components } from "@/openapi-client/api";

export type UploadResponse = components["schemas"]["UploadResponse"];

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export const useUploadFinancialStatement = (submissionId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      reportingYear = new Date().getFullYear(),
      accountingYear = "calendar",
      currency = "SZL",
      submissionId: sid,
    }: {
      file: File;
      reportingYear?: number;
      accountingYear?: string;
      currency?: string;
      submissionId?: string;
    }): Promise<UploadResponse> => {
      const token = await getAccessToken();
      const form = new FormData();
      form.append("file", file);
      form.append("reporting_year", String(reportingYear));
      form.append("accounting_year", accountingYear);
      form.append("currency", currency);
      const resolvedId = sid ?? submissionId;
      if (resolvedId) {
        form.append("submission_id", resolvedId);
      }

      const res = await fetch(`${API_BASE}/api/v1/cooperative/financial-statement/upload`, {
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
      return res.json();
    },
    onSuccess: (_data, vars) => {
      const sid = vars.submissionId ?? submissionId;
      queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
      if (sid) {
        queryClient.invalidateQueries({ queryKey: ["cooperative-submissions", sid] });
      }
    },
  });
};
