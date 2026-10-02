import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

export type ReportStatus = components["schemas"]["ReportStatusResponse"];

/** A report that can be exported: one submission, or a consolidated report. */
export type ReportRef =
  | { kind: "submission"; submissionId: string }
  | {
      kind: "consolidated";
      role: "apex" | "federation" | "ministry";
      year: number;
      apexId?: string;
      federationId?: string;
      questionnaire?: boolean;
    };

const consolidatedQuery = (ref: Extract<ReportRef, { kind: "consolidated" }>) => ({
  reporting_year: ref.year,
  apex_id: ref.apexId ?? null,
  federation_id: ref.federationId ?? null,
  method: ref.questionnaire ? "questionnaire" : null,
});

// The consolidated endpoints are documented once under /apex; federation and
// ministry expose the same handler with identical parameters under their prefix.
const consolidatedPath = (role: "apex" | "federation" | "ministry", suffix: string) =>
  `/api/v1/${role}/${suffix}` as `/api/v1/apex/${string}`;

/** Status of every language of a report. */
export const fetchReportStatus = async (ref: ReportRef): Promise<ReportStatus> => {
  const { data, error } =
    ref.kind === "submission"
      ? await apiClient.GET("/api/v1/cooperative/submissions/{id}/report", {
          params: { path: { id: ref.submissionId } },
        })
      : await apiClient.GET(consolidatedPath(ref.role, "report") as "/api/v1/apex/report", {
          params: { query: consolidatedQuery(ref) },
        });
  if (error || !data) throw new Error("report_status_unavailable");
  return data;
};

/** Starts preparing one language (or regenerating English) in the background. */
export const prepareReport = async (
  ref: ReportRef,
  lang: string,
  regenerate = false,
): Promise<ReportStatus> => {
  const { data, error } =
    ref.kind === "submission"
      ? await apiClient.POST("/api/v1/cooperative/submissions/{id}/report/prepare", {
          params: { path: { id: ref.submissionId }, query: { lang, regenerate } },
        })
      : await apiClient.POST(
          consolidatedPath(ref.role, "report/prepare") as "/api/v1/apex/report/prepare",
          { params: { query: { ...consolidatedQuery(ref), lang, regenerate } } },
        );
  if (error || !data) throw new Error("report_prepare_failed");
  return data;
};

/** Downloads a ready PDF and saves it under `filename`. */
export const downloadReport = async (
  ref: ReportRef,
  lang: string,
  filename: string,
): Promise<void> => {
  const { data, error } =
    ref.kind === "submission"
      ? await apiClient.GET("/api/v1/cooperative/submissions/{id}/export", {
          params: { path: { id: ref.submissionId }, query: { lang } },
          parseAs: "blob",
        })
      : await apiClient.GET(consolidatedPath(ref.role, "export") as "/api/v1/apex/export", {
          params: { query: { ...consolidatedQuery(ref), lang } },
          parseAs: "blob",
        });
  if (error || !(data instanceof Blob)) throw new Error("report_download_failed");
  saveBlob(data, filename);
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
