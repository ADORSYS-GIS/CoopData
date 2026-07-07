/**
 * React Query hooks for the audit log endpoint.
 *
 * Ministry role required — the backend gates `/api/v1/ministry/audit-logs`.
 * All API calls go through apiClient (openapi-fetch) with automatic Bearer token injection.
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { components } from "@/openapi-client/api";

export type AuditLog = components["schemas"]["AuditLogResponse"];
export type PaginatedAuditLog = components["schemas"]["PaginatedAuditLogResponse"];

export interface AuditLogFilters {
  action?: string;
  resource_type?: string;
  actor_keycloak_id?: string;
  resource_keycloak_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

const AUDIT_KEY = "audit-logs";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"] ?? e["error"] ?? e["detail"];
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return String(err);
}

export const useAuditLogs = (filters: AuditLogFilters) => {
  const query: Record<string, string | number> = {};
  if (filters.action) query.action = filters.action;
  if (filters.resource_type) query.resource_type = filters.resource_type;
  if (filters.actor_keycloak_id) query.actor_keycloak_id = filters.actor_keycloak_id;
  if (filters.resource_keycloak_id) query.resource_keycloak_id = filters.resource_keycloak_id;
  if (filters.date_from) query.date_from = filters.date_from;
  if (filters.date_to) query.date_to = filters.date_to;
  query.page = filters.page ?? 1;
  query.per_page = filters.per_page ?? 20;

  return useQuery({
    queryKey: [AUDIT_KEY, query],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/ministry/audit-logs", {
        params: { query },
      });
      if (error) throw new Error(extractErrorMessage(error));
      return data as unknown as PaginatedAuditLog;
    },
    placeholderData: keepPreviousData,
    retry: false,
  });
};
