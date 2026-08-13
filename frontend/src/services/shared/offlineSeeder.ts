import { apiClient } from "@/openapi-client";
import { cacheSet } from "./offlineCache";
import { getUserProfile, fetchWithAuth } from "./authService";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

let isSeeding = false;

/**
 * Pre-caches essential application datasets into IndexedDB while online.
 * Strictly respects the user's assigned role so only relevant, authorized
 * datasets are fetched and stored offline.
 */
export async function seedOfflineCache(): Promise<void> {
  if (!navigator.onLine || isSeeding) return;
  isSeeding = true;

  try {
    const profile = getUserProfile();
    if (!profile) return;
    const userId = profile.id ?? "anon";
    const role = profile.role;

    console.log(`[offlineSeeder] Pre-caching role-scoped data into IndexedDB for role '${role}'...`);

    const safeFetch = async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (err) {
        console.warn("[offlineSeeder] Role-scoped background seed task warning:", err);
      }
    };

    // ── COMMON FOR ALL ROLES ──

    // 1. Role-based Submissions List
    await safeFetch(async () => {
      if (role === "ministry") {
        const { data } = await apiClient.GET("/api/v1/ministry/submissions", {});
        if (data) await cacheSet("submissions", "ministry-list-default", userId, data);
      } else if (role === "federation") {
        const { data } = await apiClient.GET("/api/v1/federation/submissions", {});
        if (data) await cacheSet("submissions", "federation-list-default", userId, data);
      } else if (role === "apex") {
        const { data } = await apiClient.GET("/api/v1/apex/submissions", {});
        if (data) await cacheSet("submissions", "apex-list", userId, data);
      } else {
        const { data } = await apiClient.GET("/api/v1/cooperative/submissions", {});
        if (data) await cacheSet("submissions", "cooperative-list", userId, data);
      }
    });

    // 2. Active Questionnaire Template (for filling/viewing forms)
    await safeFetch(async () => {
      const res = await fetchWithAuth(
        `${BASE}/api/v1/cooperative/questionnaire-templates/active?questionnaire_type=financial&lang=en`,
      );
      if (res.ok) {
        const data = await res.json();
        await cacheSet("submissions", "active-template-financial-en", userId, data);
      }
    });

    // 3. Non-Financial Indicator Catalog
    await safeFetch(async () => {
      const { data } = await apiClient.GET("/api/v1/non-financial-indicators/catalog", {
        params: { query: { lang: "en" } },
      });
      if (data) {
        await cacheSet("submissions", "indicator-catalog-undefined-en", userId, data);
      }
    });

    // 4. Benchmark Analytics
    await safeFetch(async () => {
      const { data } = await apiClient.GET("/api/v1/analytics/benchmark", {});
      if (data) {
        await cacheSet("analytics", "benchmark-{}", userId, data);
      }
    });

    // ── ROLE-SPECIFIC SEEDING ──

    if (role === "ministry") {
      // Ministry Official: National overview, custom KPIs, audit logs, all templates, all entities
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/analytics/national-overview", {});
        if (data) await cacheSet("analytics", "national-overview-{}", userId, data);
      });

      await safeFetch(async () => {
        const res = await fetchWithAuth(`${BASE}/api/v1/analytics/questionnaire`);
        if (res.ok) {
          const data = await res.json();
          await cacheSet("submissions", "questionnaire-analytics-{}", userId, data);
        }
      });

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/ministry/custom-kpis", {
          params: { query: { lang: "en" } },
        });
        if (data) await cacheSet("analytics", "custom-kpis-en", userId, data);
      });

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/ministry/audit-logs", {
          params: { query: { page: 1, per_page: 20 } },
        });
        if (data) await cacheSet("analytics", 'audit-logs-{"page":1,"per_page":20}', userId, data);
      });

      await safeFetch(async () => {
        const res = await fetchWithAuth(`${BASE}/api/v1/ministry/questionnaire-templates`);
        if (res.ok) {
          const data = await res.json();
          await cacheSet("formTemplates", "questionnaire-templates", userId, data);
        }
      });

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/apex/cooperatives", {});
        if (data) await cacheSet("cooperatives", "ministry-cooperatives", userId, data);
      });

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/ministry/federations", {});
        if (data) await cacheSet("federations", "ministry-federations", userId, data);
      });

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/ministry/apexes", {});
        if (data) await cacheSet("apexes", "ministry-apexes", userId, data);
      });

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/users", {});
        if (data) await cacheSet("users", "ministry-users", userId, data);
      });

      // Seed members + invitations for each federation so they load offline
      await safeFetch(async () => {
        const { data: feds } = await apiClient.GET("/api/v1/ministry/federations", {});
        if (!feds || !Array.isArray(feds)) return;
        for (const fed of feds as Array<{ id: string }>) {
          await safeFetch(async () => {
            const { data: members } = await apiClient.GET("/api/v1/ministry/federations/{id}/members", {
              params: { path: { id: fed.id } },
            });
            if (members) await cacheSet("federations", `federation-${fed.id}-members`, userId, members);
          });
          await safeFetch(async () => {
            const { data: invitations } = await apiClient.GET("/api/v1/ministry/federations/{id}/invitations", {
              params: { path: { id: fed.id } },
            });
            if (invitations) await cacheSet("federations", `federation-${fed.id}-invitations`, userId, invitations);
          });
        }
      });
    } else if (role === "federation") {
      // Federation User: Federation apexes, national overview
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/federation/apexes", {});
        if (data) await cacheSet("apexes", "federation-apexes", userId, data);
      });
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/analytics/national-overview", {});
        if (data) await cacheSet("analytics", "national-overview-{}", userId, data);
      });
    } else if (role === "apex") {
      // Apex User: Cooperatives under this apex
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/apex/cooperatives", {});
        if (data) await cacheSet("cooperatives", "apex-cooperatives", userId, data);
      });
    } else if (role === "cooperative") {
      // Cooperative User: Own coop profile
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/apex/coop-profiles", {});
        if (data) await cacheSet("cooperatives", "cooperative-profiles", userId, data);
      });
    }

    console.log(`[offlineSeeder] Pre-caching complete for role '${role}'!`);
  } finally {
    isSeeding = false;
  }
}
