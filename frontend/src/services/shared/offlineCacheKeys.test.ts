import { describe, it, expect } from "vitest";
import { offlineCacheKeys } from "./offlineCacheKeys";

// These labels are persisted on users' devices. A change here orphans every
// copy already downloaded, so this test makes such a change deliberate.
describe("offlineCacheKeys", () => {
  it.each([
    [offlineCacheKeys.cooperativeMembers("c1"), "cooperatives", "cooperative-c1-members"],
    [offlineCacheKeys.cooperative("c1"), "cooperatives", "cooperative-c1"],
    [offlineCacheKeys.cooperativesList(), "cooperatives", "cooperatives-list"],
    [offlineCacheKeys.cooperativeProfile("c1"), "cooperatives", "cooperative-profile-c1"],
    [offlineCacheKeys.ministryStats({}), "analytics", "ministry-stats-{}"],
    [offlineCacheKeys.customKpis("ss"), "analytics", "custom-kpis-ss"],
    [
      offlineCacheKeys.nationalOverview({ reportingYear: 2026 }),
      "analytics",
      'national-overview-{"reportingYear":2026}',
    ],
    [
      offlineCacheKeys.auditLogs({ page: 1, per_page: 20 }),
      "analytics",
      'audit-logs-{"page":1,"per_page":20}',
    ],
    [offlineCacheKeys.federationMembers("f1"), "federations", "federation-f1-members"],
    [offlineCacheKeys.federationSubmissions(), "submissions", "federation-list-default"],
    [offlineCacheKeys.ministrySubmissions(true), "submissions", "ministry-list-true"],
    [offlineCacheKeys.submission("s1"), "submissions", "submission-s1"],
    [
      offlineCacheKeys.questionnaire("s1", "financial"),
      "submissions",
      "questionnaire-s1-financial",
    ],
    [
      offlineCacheKeys.indicatorCatalog(undefined, "en"),
      "submissions",
      "indicator-catalog-undefined-en",
    ],
    [offlineCacheKeys.lineItems("fs1"), "submissions", "line-items-fs1"],
  ])("builds %o", (location, table, key) => {
    expect(location).toEqual({ cacheTable: table, cacheKey: key });
  });
});
