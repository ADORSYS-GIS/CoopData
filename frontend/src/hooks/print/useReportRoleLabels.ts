import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/openapi-client";
import type { RoleLabel } from "@/pages/shared/print/tpl/i18n";

/**
 * The organisation names the Ministry configured (Settings → Terminology), for a print
 * page. A failed request yields no labels, so the report falls back to its default
 * names instead of never becoming ready for the PDF renderer.
 */
export const useReportRoleLabels = (tokenOverride?: string) =>
  useQuery({
    queryKey: ["report-role-labels", tokenOverride],
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<RoleLabel[]> => {
      const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : undefined;
      const { data, error } = await apiClient.GET("/api/v1/settings/organization-labels", {
        headers,
      });
      return error || !data ? [] : (data as RoleLabel[]);
    },
  });
