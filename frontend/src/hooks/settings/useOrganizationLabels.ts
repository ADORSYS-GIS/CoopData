import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import { runMutation } from "@/services/shared/syncQueueService";

const LABELS_KEY = "organization-labels";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

export const DEFAULT_ORGANIZATION_LABELS = [
  {
    key: "ministry",
    label: "Ministry Official",
    short_label: "Ministry",
    plural_label: "Ministries",
    description:
      "National oversight — view all cooperatives, generate national reports, monitor compliance, manage users",
    icon: "Landmark",
    translations: {},
  },
  {
    key: "federation",
    label: "Federation Officer",
    short_label: "Federation",
    plural_label: "Federations",
    description:
      "Regional management — validate submissions, generate federation reports, monitor regional performance",
    icon: "UserCog",
    translations: {},
  },
  {
    key: "apex",
    label: "Apex Officer",
    short_label: "Apex",
    plural_label: "Apexes",
    description:
      "Cooperative oversight — review submissions, manage cooperatives, validate data, approve or request changes",
    icon: "ClipboardList",
    translations: {},
  },
  {
    key: "cooperative",
    label: "Cooperative Manager",
    short_label: "Cooperative",
    plural_label: "Cooperatives",
    description:
      "Data submission — submit financial statements, update records, view own reports and analytics",
    icon: "Users",
    translations: {},
  },
];

/** List all organization level labels */
export const useOrganizationLabels = () =>
  useOfflineQuery({
    queryKey: [LABELS_KEY],
    cacheTable: "analytics",
    cacheKey: "organization-labels-list",
    queryFn: async () => {
      try {
        const { data, error } = await apiClient.GET("/api/v1/settings/organization-labels");
        if (error || !data || data.length === 0) {
          return DEFAULT_ORGANIZATION_LABELS;
        }
        return data;
      } catch {
        return DEFAULT_ORGANIZATION_LABELS;
      }
    },
  });

/** Update organization label settings for a specific key (ministry, federation, apex, cooperative) */
export const useUpdateOrganizationLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      key,
      ...body
    }: {
      key: string;
      label: string;
      short_label: string;
      plural_label: string;
      description?: string | null;
      icon: string;
      translations: Record<string, unknown>;
    }) => {
      const { data, error } = await apiClient.PUT("/api/v1/settings/organization-labels/{key}", {
        params: { path: { key } },
        body: body as never,
      });
      if (error) {
        throw new Error(extractErrorMessage(error));
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LABELS_KEY] });
    },
  });
};
