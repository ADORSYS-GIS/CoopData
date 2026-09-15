import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineQuery } from "@/hooks/shared/useOfflineQuery";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";
import { runMutation } from "@/services/shared/syncQueueService";

const LABELS_KEY = "organization-labels";

type OrganizationLabelRow = components["schemas"]["OrganizationLabelResponse"];

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

/** List all organization level labels.
 *
 * IMPORTANT: This hook must NOT silently swallow API errors and return
 * `DEFAULT_ORGANIZATION_LABELS`. Doing so causes the offline cache to store
 * the hardcoded defaults as if they were real data, which means non-ministry
 * users (federation / apex / cooperative) never see the labels configured by
 * the ministry — they keep seeing the defaults forever (until the IDB cache
 * is cleared manually).
 *
 * Instead, we let errors propagate to `useOfflineQuery`, which will:
 *   1. serve the previously cached labels if any, OR
 *   2. fall back to `fallbackData` (the hardcoded defaults) as a last resort.
 *
 * The fallback is only used when there is no cache AND the fetch fails — it
 * is never written back to the cache, so a transient failure cannot poison
 * the cache for every subsequent user.
 */
export const useOrganizationLabels = (enabled = true) =>
  useOfflineQuery({
    queryKey: [LABELS_KEY],
    cacheTable: "analytics",
    cacheKey: "organization-labels-list",
    // Terminology changes made by ministry must reach other users immediately on login.
    // Setting staleTime to 0 ensures fresh labels are always fetched on mount when online.
    staleTime: 0,
    enabled,
    // The defaults are static UI fallbacks without DB timestamps; consumers
    // only read the label fields, so the missing created_at/updated_at are
    // irrelevant here.
    fallbackData: DEFAULT_ORGANIZATION_LABELS as unknown as OrganizationLabelRow[],
    queryFn: async () => {
      const { data, error, response } = await apiClient.GET("/api/v1/settings/organization-labels");
      if (error || !data) {
        // Surface a real error so useOfflineQuery can decide between
        // serving the cache or the fallback. Include status code for debugging.
        const status = (response as { status?: number } | undefined)?.status ?? "unknown";
        throw new Error(`Failed to load organization labels (status: ${status})`);
      }
      if (data.length === 0) {
        // Empty payload is also a problem — the backend should always seed
        // the four default rows. Treat as an error so we don't cache an
        // empty array and break the UI.
        throw new Error("Organization labels response was empty");
      }
      return data;
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
