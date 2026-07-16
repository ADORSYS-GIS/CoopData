import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/openapi-client";

export interface SubmissionActivityPoint {
  month: number;
  month_label: string;
  submitted: number;
  approved: number;
  rejected: number;
  in_review: number;
}

export interface SubmissionActivityResponse {
  year: number;
  months: SubmissionActivityPoint[];
}

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Unable to load submission activity.";
};

export const useSubmissionActivity = (reportingYear: number, enabled = true) =>
  useQuery<SubmissionActivityResponse>({
    queryKey: ["submission-activity", reportingYear],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/analytics/submission-activity", {
        params: { query: { reporting_year: reportingYear } },
      });
      if (error) throw new Error(extractErrorMessage(error));
      if (!data) throw new Error("Submission activity response was empty.");
      return data as SubmissionActivityResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
