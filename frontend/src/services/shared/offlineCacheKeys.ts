import type { CacheTable } from "./offlineCache";

/** Where a dataset lives in the offline DB: the table plus the row label. */
export interface OfflineCacheEntry {
  cacheTable: CacheTable;
  cacheKey: string;
}

const entry = (cacheTable: CacheTable, cacheKey: string): OfflineCacheEntry => ({
  cacheTable,
  cacheKey,
});

const json = (value: unknown) => JSON.stringify(value);

/** Ids may be null/undefined while the owning query is still disabled. */
type Id = string | null | undefined;

/**
 * Single source of truth for offline cache locations.
 *
 * The offline seeder pre-downloads data and the hooks read it back; both MUST
 * address the same table and label or the pre-downloaded copy is never found
 * offline. Build every seeded location here, and spread the result into
 * `useOfflineQuery({ ...offlineCacheKeys.x(...) })` / pass it to the seeder.
 *
 * Changing a label orphans copies already stored on users' devices, so only
 * change one when the data shape itself changes.
 */
export const offlineCacheKeys = {
  // ── analytics ──
  auditLogs: (query: unknown) => entry("analytics", `audit-logs-${json(query)}`),
  benchmark: (params: unknown) => entry("analytics", `benchmark-${json(params)}`),
  customKpis: (lang: string) => entry("analytics", `custom-kpis-${lang}`),
  federationStats: () => entry("analytics", "federation-stats"),
  ministryStats: (params: unknown) => entry("analytics", `ministry-stats-${json(params)}`),
  nationalOverview: (params: unknown) => entry("analytics", `national-overview-${json(params)}`),
  organizationLabels: () => entry("analytics", "organization-labels-list"),

  // ── apexes ──
  apexesList: () => entry("apexes", "apexes-list"),

  // ── cooperatives ──
  cooperativesList: () => entry("cooperatives", "cooperatives-list"),
  cooperative: (id: Id) => entry("cooperatives", `cooperative-${id}`),
  cooperativeMembers: (id: Id) => entry("cooperatives", `cooperative-${id}-members`),
  cooperativeProfiles: () => entry("cooperatives", "cooperative-profiles"),
  cooperativeProfile: (id: Id) => entry("cooperatives", `cooperative-profile-${id}`),
  cooperativeSelfProfile: () => entry("cooperatives", "cooperative-self-profile"),
  cooperativeSelfMembers: () => entry("cooperatives", "cooperative-self-members"),
  cooperativeSelfDimensions: () => entry("cooperatives", "cooperative-self-dimensions"),

  // ── federations ──
  federationsList: () => entry("federations", "federations-list"),
  federationMembers: (id: Id) => entry("federations", `federation-${id}-members`),
  federationInvitations: (id: Id) => entry("federations", `federation-${id}-invitations`),

  // ── form templates ──
  questionnaireTemplates: () => entry("formTemplates", "questionnaire-templates"),

  // ── submissions ──
  cooperativeSubmissions: () => entry("submissions", "cooperative-list"),
  apexSubmissions: () => entry("submissions", "apex-list"),
  federationSubmissions: (all?: boolean) =>
    entry("submissions", `federation-list-${all ?? "default"}`),
  ministrySubmissions: (all?: boolean) => entry("submissions", `ministry-list-${all ?? "default"}`),
  cooperativeStats: () => entry("submissions", "cooperative-stats"),
  apexStats: () => entry("submissions", "apex-stats"),
  submission: (id: Id) => entry("submissions", `submission-${id}`),
  submissionSections: (submissionId: Id) => entry("submissions", `sections-${submissionId}`),
  submissionReviews: (submissionId: Id) => entry("submissions", `reviews-${submissionId}`),
  submissionFlags: (submissionId: Id) => entry("submissions", `submission-flags-${submissionId}`),
  questionnaire: (submissionId: Id, questionnaireType?: string) =>
    entry("submissions", `questionnaire-${submissionId}-${questionnaireType}`),
  activeTemplate: (questionnaireType: string, lang: string) =>
    entry("submissions", `active-template-${questionnaireType}-${lang}`),
  questionnaireAnalytics: (filters: unknown) =>
    entry("submissions", `questionnaire-analytics-${json(filters)}`),
  financialStatement: (id: Id) => entry("submissions", `financial-statement-${id}`),
  lineItems: (financialStatementId: Id) =>
    entry("submissions", `line-items-${financialStatementId}`),
  indicatorCatalog: (coopType: string | undefined, lang: string) =>
    entry("submissions", `indicator-catalog-${coopType}-${lang}`),
  nfIndicators: (submissionId: Id) => entry("submissions", `nf-indicators-${submissionId}`),

  // ── users ──
  usersList: () => entry("users", "users-list"),
} as const;
