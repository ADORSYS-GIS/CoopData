import { apiClient } from "@/openapi-client";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { cacheSet } from "./offlineCache";
import { offlineCacheKeys, type OfflineCacheEntry } from "./offlineCacheKeys";
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

    console.log(
      `[offlineSeeder] Pre-caching role-scoped data into IndexedDB for role '${role}'...`,
    );

    const currentYear = new Date().getFullYear();
    const save = (location: OfflineCacheEntry, data: unknown) =>
      cacheSet(location.cacheTable, location.cacheKey, userId, data);
    const safeFetch = async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (err) {
        console.warn("[offlineSeeder] Role-scoped background seed task warning:", err);
      }
    };

    // ── COMMON FOR ALL ROLES ──

    // 1. Role-based Submissions List
    let submissions: { id: string; financial_statement_id?: string | null }[] = [];
    await safeFetch(async () => {
      if (role === "ministry") {
        const { data } = await apiClient.GET("/api/v1/ministry/submissions", {});
        if (data) {
          submissions = (data as { id: string; financial_statement_id?: string | null }[]) ?? [];
          await save(offlineCacheKeys.ministrySubmissions(), data);
        }
      } else if (role === "federation") {
        const { data } = await apiClient.GET("/api/v1/federation/submissions", {});
        if (data) {
          submissions = (data as { id: string; financial_statement_id?: string | null }[]) ?? [];
          await save(offlineCacheKeys.federationSubmissions(), data);
        }
      } else if (role === "apex") {
        const { data } = await apiClient.GET("/api/v1/apex/submissions", {});
        if (data) {
          submissions = (data as { id: string; financial_statement_id?: string | null }[]) ?? [];
          await save(offlineCacheKeys.apexSubmissions(), data);
        }
      } else {
        const { data } = await apiClient.GET("/api/v1/cooperative/submissions", {});
        if (data) {
          submissions = (data as { id: string; financial_statement_id?: string | null }[]) ?? [];
          await save(offlineCacheKeys.cooperativeSubmissions(), data);
        }
      }
    });

    // 2. Active Questionnaire Template (for filling/viewing forms)
    await safeFetch(async () => {
      for (const qType of ["financial", "agriculture"]) {
        for (const lang of SUPPORTED_LANGUAGES) {
          const res = await fetchWithAuth(
            `${BASE}/api/v1/cooperative/questionnaire-templates/active?questionnaire_type=${qType}&lang=${lang}`,
          );
          if (res.ok) {
            const data = await res.json();
            await save(offlineCacheKeys.activeTemplate(qType, lang), data);
          }
        }
      }
    });

    // 3. Non-Financial Indicator Catalog
    await safeFetch(async () => {
      for (const coopType of [undefined, "financial", "agriculture"]) {
        for (const lang of SUPPORTED_LANGUAGES) {
          const { data } = await apiClient.GET("/api/v1/non-financial-indicators/catalog", {
            params: {
              query: coopType ? { coop_type: coopType, lang } : { lang },
            },
          });
          if (data) {
            await save(offlineCacheKeys.indicatorCatalog(coopType, lang), data);
          }
        }
      }
    });

    // 4. Benchmark Analytics
    await safeFetch(async () => {
      const { data } = await apiClient.GET("/api/v1/analytics/benchmark", {});
      if (data) {
        await save(offlineCacheKeys.benchmark({}), data);
      }
    });

    // 5. Organization labels — needed by ALL roles so the configured
    // terminology renders correctly offline at every level, not just ministry.
    await safeFetch(async () => {
      const { data } = await apiClient.GET("/api/v1/settings/organization-labels", {});
      if (data) await save(offlineCacheKeys.organizationLabels(), data);
    });

    // ── ROLE-SPECIFIC SEEDING ──

    if (role === "ministry") {
      // Ministry Official: National overview, custom KPIs, audit logs, all templates, all entities
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/ministry/stats");
        if (data) await save(offlineCacheKeys.ministryStats({}), data);
      });

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/analytics/national-overview", {
          params: { query: { reporting_year: currentYear } as Record<string, unknown> },
        });
        if (data) {
          // Seed both the default key and the year-keyed key so both match
          await save(offlineCacheKeys.nationalOverview({}), data);
          await save(offlineCacheKeys.nationalOverview({ reportingYear: currentYear }), data);
        }
      });

      await safeFetch(async () => {
        const res = await fetchWithAuth(`${BASE}/api/v1/analytics/questionnaire`);
        if (res.ok) {
          const data = await res.json();
          await save(offlineCacheKeys.questionnaireAnalytics({}), data);
        }
      });

      for (const lang of SUPPORTED_LANGUAGES) {
        await safeFetch(async () => {
          const { data } = await apiClient.GET("/api/v1/ministry/custom-kpis", {
            params: { query: { lang } },
          });
          if (data) await save(offlineCacheKeys.customKpis(lang), data);
        });
      }

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/ministry/audit-logs", {
          params: { query: { page: 1, per_page: 20 } },
        });
        if (data) await save(offlineCacheKeys.auditLogs({ page: 1, per_page: 20 }), data);
      });

      await safeFetch(async () => {
        const res = await fetchWithAuth(`${BASE}/api/v1/ministry/questionnaire-templates`);
        if (res.ok) {
          const data = await res.json();
          await save(offlineCacheKeys.questionnaireTemplates(), data);
        }
      });

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/apex/cooperatives", {});
        if (data) await save(offlineCacheKeys.cooperativesList(), data);
      });

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/ministry/federations", {});
        if (data) await save(offlineCacheKeys.federationsList(), data);
      });

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/ministry/apexes", {});
        if (data) await save(offlineCacheKeys.apexesList(), data);
      });

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/users", {});
        if (data) await save(offlineCacheKeys.usersList(), data);
      });

      // Seed members + invitations for each federation so they load offline
      await safeFetch(async () => {
        const { data: feds } = await apiClient.GET("/api/v1/ministry/federations", {});
        if (!feds || !Array.isArray(feds)) return;
        for (const fed of feds as Array<{ id: string }>) {
          await safeFetch(async () => {
            const { data: members } = await apiClient.GET(
              "/api/v1/ministry/federations/{id}/members",
              {
                params: { path: { id: fed.id } },
              },
            );
            if (members) await save(offlineCacheKeys.federationMembers(fed.id), members);
          });
          await safeFetch(async () => {
            const { data: invitations } = await apiClient.GET(
              "/api/v1/ministry/federations/{id}/invitations",
              {
                params: { path: { id: fed.id } },
              },
            );
            if (invitations)
              await save(offlineCacheKeys.federationInvitations(fed.id), invitations);
          });
        }
      });
    } else if (role === "federation") {
      // Federation User: Federation apexes, national overview
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/federation/stats");
        if (data) await save(offlineCacheKeys.federationStats(), data);
      });
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/federation/apexes", {});
        if (data) await save(offlineCacheKeys.apexesList(), data);
      });
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/analytics/national-overview", {
          params: { query: { reporting_year: currentYear } as Record<string, unknown> },
        });
        if (data) {
          await save(offlineCacheKeys.nationalOverview({}), data);
          await save(offlineCacheKeys.nationalOverview({ reportingYear: currentYear }), data);
        }
      });
    } else if (role === "apex") {
      // Apex User: Cooperatives under this apex
      let coopIds: string[] = [];

      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/apex/cooperatives", {});
        if (data) {
          await save(offlineCacheKeys.cooperativesList(), data);
          if (Array.isArray(data)) {
            coopIds = (data as Array<{ id: string }>).map((c) => c.id);
          }
        }
      });

      // Cooperative Profiles
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/apex/coop-profiles");
        if (data) {
          await save(offlineCacheKeys.cooperativeProfiles(), data);
          if (Array.isArray(data)) {
            const profileIds = (data as Array<{ id: string }>).map((c) => c.id);
            coopIds = Array.from(new Set([...coopIds, ...profileIds]));
          }
        }
      });

      // Apex Stats
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/apex/stats");
        if (data) {
          await save(offlineCacheKeys.apexStats(), data);
        }
      });

      // Apex Analytics — national-overview scoped to this apex
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/analytics/national-overview", {
          params: { query: { reporting_year: currentYear } as Record<string, unknown> },
        });
        if (data) {
          await save(offlineCacheKeys.nationalOverview({}), data);
          await save(offlineCacheKeys.nationalOverview({ reportingYear: currentYear }), data);
        }
      });

      // Pre-cache details, profile, members for each cooperative
      for (const coopId of coopIds) {
        // Cooperative Profile Detail
        await safeFetch(async () => {
          const { data } = await apiClient.GET("/api/v1/apex/coop-profiles/{id}", {
            params: { path: { id: coopId } },
          });
          if (data) {
            await save(offlineCacheKeys.cooperativeProfile(coopId), data);
          }
        });

        // Cooperative Basic Detail
        await safeFetch(async () => {
          const { data } = await apiClient.GET("/api/v1/apex/cooperatives/{id}", {
            params: { path: { id: coopId } },
          });
          if (data) {
            await save(offlineCacheKeys.cooperative(coopId), data);
          }
        });

        // Cooperative Members
        await safeFetch(async () => {
          const { data } = await apiClient.GET("/api/v1/apex/cooperatives/{id}/members", {
            params: { path: { id: coopId } },
          });
          if (data) {
            await save(offlineCacheKeys.cooperativeMembers(coopId), data);
          }
        });
      }
    } else if (role === "cooperative") {
      // Cooperative User: Stats, Profile, Members, and Dimensions self-service APIs
      await safeFetch(async () => {
        const { data } = await apiClient.GET("/api/v1/cooperative/stats");
        if (data) await save(offlineCacheKeys.cooperativeStats(), data);
      });
      await safeFetch(async () => {
        const res = await fetchWithAuth(`${BASE}/api/v1/cooperative/profile`);
        if (res.ok) {
          const data = await res.json();
          await save(offlineCacheKeys.cooperativeSelfProfile(), data);
        }
      });
      await safeFetch(async () => {
        const res = await fetchWithAuth(`${BASE}/api/v1/cooperative/members`);
        if (res.ok) {
          const data = await res.json();
          await save(offlineCacheKeys.cooperativeSelfMembers(), data);
        }
      });
      await safeFetch(async () => {
        const res = await fetchWithAuth(`${BASE}/api/v1/cooperative/dimensions`);
        if (res.ok) {
          const data = await res.json();
          await save(offlineCacheKeys.cooperativeSelfDimensions(), data);
        }
      });
    }

    // ── COMMON SUBMISSIONS DETAIL PRE-CACHING ──
    if (submissions.length > 0) {
      for (const sub of submissions) {
        const subId = sub.id;

        // a. Single Submission Detail (role-specific endpoint)
        await safeFetch(async () => {
          let res;
          if (role === "ministry") {
            res = await apiClient.GET("/api/v1/ministry/submissions/{id}", {
              params: { path: { id: subId } },
            });
          } else if (role === "federation") {
            res = await apiClient.GET("/api/v1/federation/submissions/{id}", {
              params: { path: { id: subId } },
            });
          } else if (role === "apex") {
            res = await apiClient.GET("/api/v1/apex/submissions/{id}", {
              params: { path: { id: subId } },
            });
          } else {
            res = await apiClient.GET("/api/v1/cooperative/submissions/{id}", {
              params: { path: { id: subId } },
            });
          }
          if (res && res.data) {
            await save(offlineCacheKeys.submission(subId), res.data);
          }
        });

        // b. Submission Sections
        await safeFetch(async () => {
          const { data } = await apiClient.GET("/api/v1/cooperative/submissions/{id}/sections", {
            params: { path: { id: subId } },
          });
          if (data) {
            await save(offlineCacheKeys.submissionSections(subId), data);
          }
        });

        // c. Questionnaire Answers (financial & agriculture)
        for (const qType of ["financial", "agriculture"]) {
          await safeFetch(async () => {
            const res = await fetchWithAuth(
              `${BASE}/api/v1/cooperative/submissions/${subId}/questionnaire?questionnaire_type=${qType}`,
            );
            if (res.ok) {
              const data = await res.json();
              await save(offlineCacheKeys.questionnaire(subId, qType), data);
            }
          });
        }

        // d. Non-financial entries
        await safeFetch(async () => {
          const { data } = await apiClient.GET(
            "/api/v1/cooperative/submissions/{id}/non-financial-indicators",
            {
              params: { path: { id: subId } },
            },
          );
          if (data) {
            await save(offlineCacheKeys.nfIndicators(subId), data);
          }
        });

        // e. Submission Reviews History
        await safeFetch(async () => {
          const res = await fetchWithAuth(
            `${BASE}/api/v1/cooperative/submissions/${subId}/reviews`,
          );
          if (res.ok) {
            const data = await res.json();
            await save(offlineCacheKeys.submissionReviews(subId), data);
          }
        });

        // e2. Apex Abnormality Flags
        if (role === "apex") {
          await safeFetch(async () => {
            const { data } = await apiClient.GET("/api/v1/apex/submissions/{id}/flags", {
              params: { path: { id: subId } },
            });
            if (data) {
              await save(offlineCacheKeys.submissionFlags(subId), data);
            }
          });
        }

        // f. Financial Statement & Line Items
        if (sub.financial_statement_id) {
          const fsId = sub.financial_statement_id;
          await safeFetch(async () => {
            const { data } = await apiClient.GET("/api/v1/cooperative/financial-statements/{id}", {
              params: { path: { id: fsId } },
            });
            if (data) {
              await save(offlineCacheKeys.financialStatement(fsId), data);
            }
          });

          await safeFetch(async () => {
            const { data } = await apiClient.GET(
              "/api/v1/cooperative/financial-statements/{id}/line-items",
              { params: { path: { id: fsId } } },
            );
            if (data) {
              await save(offlineCacheKeys.lineItems(fsId), data);
            }
          });
        }
      }
    }

    console.log(`[offlineSeeder] Pre-caching complete for role '${role}'!`);
  } finally {
    isSeeding = false;
  }
}
