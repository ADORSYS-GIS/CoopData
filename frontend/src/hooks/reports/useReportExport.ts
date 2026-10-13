import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  downloadReport,
  fetchReportStatus,
  prepareReport,
  type ReportRef,
  type ReportStatus,
} from "@/services/reports/reportExportApi";

export type { ReportRef, ReportStatus };

const REPORT_STATUS_KEY = "report-status";
/** How often the status is refreshed while something is being prepared. */
export const REPORT_POLL_MS = 4000;

export const reportStatusKey = (ref: ReportRef | null) => [REPORT_STATUS_KEY, ref] as const;

export const isPreparing = (status: ReportStatus | undefined) =>
  !!status?.languages.some((l) => l.state === "preparing");

/** Live status of every language of a report; refreshes while one is being prepared. */
export const useReportStatus = (ref: ReportRef | null) =>
  useQuery({
    queryKey: reportStatusKey(ref),
    queryFn: () => fetchReportStatus(ref as ReportRef),
    enabled: ref !== null,
    refetchInterval: (query) => (isPreparing(query.state.data) ? REPORT_POLL_MS : false),
    refetchOnWindowFocus: true,
  });

/** Starts preparing one language (or regenerating English) in the background. */
export const usePrepareReport = (ref: ReportRef | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lang, regenerate = false }: { lang: string; regenerate?: boolean }) => {
      if (!ref) throw new Error("no_report_selected");
      return prepareReport(ref, lang, regenerate);
    },
    onSuccess: (status) => queryClient.setQueryData(reportStatusKey(ref), status),
    onSettled: () => queryClient.invalidateQueries({ queryKey: reportStatusKey(ref) }),
  });
};

/** Downloads a ready PDF and saves it under `filename`. */
export const useDownloadReport = (ref: ReportRef | null) =>
  useMutation({
    mutationFn: ({ lang, filename }: { lang: string; filename: string }) => {
      if (!ref) throw new Error("no_report_selected");
      return downloadReport(ref, lang, filename);
    },
  });
