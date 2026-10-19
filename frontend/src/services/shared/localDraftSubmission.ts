import { cacheGet, cacheSet } from "./offlineCache";
import { offlineCacheKeys, type OfflineCacheEntry } from "./offlineCacheKeys";

const DRAFT_SECTIONS = [
  "financial",
  "members",
  "savings",
  "loans",
  "fixed_deposits",
  "farm_coop",
] as const;

/**
 * Makes a draft created on the device usable offline before the server has it:
 * adds it to the cached submissions list and caches its detail, an empty
 * review history and pending sections. The draft keeps its client-generated id
 * once synced, so these entries stay valid. Best-effort (cache writes never throw).
 */
export async function cacheLocalDraftSubmission(
  draft: { id: string },
  list: OfflineCacheEntry,
  userId: string,
): Promise<void> {
  const cached = await cacheGet<{ id: string }[]>(list.cacheTable, list.cacheKey, userId, true);
  const items = cached ?? [];
  if (!items.some((s) => s.id === draft.id)) {
    await cacheSet(list.cacheTable, list.cacheKey, userId, [draft, ...items]);
  }

  const now = new Date().toISOString();
  const sections = DRAFT_SECTIONS.map((section) => ({
    id: crypto.randomUUID(),
    submission_id: draft.id,
    section,
    status: "pending",
    created_at: now,
    updated_at: now,
  }));
  const entries: [OfflineCacheEntry, unknown][] = [
    [offlineCacheKeys.submission(draft.id), draft],
    [offlineCacheKeys.submissionReviews(draft.id), []],
    [offlineCacheKeys.submissionSections(draft.id), sections],
  ];
  for (const [location, data] of entries) {
    await cacheSet(location.cacheTable, location.cacheKey, userId, data);
  }
}
