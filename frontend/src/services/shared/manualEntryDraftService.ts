import { getUserProfile } from "./authService";
import { offlineDb } from "./offlineDb";

export type ManualEntryMode = "financial" | "non_financial";

/**
 * Drafts belong to the signed-in user: they survive logout (so an automatic
 * idle logout loses no work) and the device may be shared.
 */
function draftOwner(): string | null {
  return getUserProfile()?.id ?? null;
}

function draftKey(userId: string, submissionId: string, mode: ManualEntryMode): string {
  return `${userId}:${submissionId}:${mode}`;
}

/**
 * Persists an in-progress manual entry wizard draft to IndexedDB so the user's
 * work survives navigation, a page refresh or a logout while offline.
 * Best-effort — never throws so a storage failure cannot break the wizard.
 */
export async function saveManualEntryDraft<T>(
  submissionId: string,
  mode: ManualEntryMode,
  data: T,
): Promise<void> {
  const userId = draftOwner();
  if (!userId) return;
  try {
    await offlineDb.drafts.put({
      key: draftKey(userId, submissionId, mode),
      userId,
      submissionId,
      mode,
      data,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn(`[manualEntryDraft] Failed to save draft for ${submissionId}:${mode}`, err);
  }
}

/**
 * Loads the signed-in user's draft, or null when none exists.
 */
export async function loadManualEntryDraft<T>(
  submissionId: string,
  mode: ManualEntryMode,
): Promise<T | null> {
  const userId = draftOwner();
  if (!userId) return null;
  try {
    const row = await offlineDb.drafts.get(draftKey(userId, submissionId, mode));
    return (row?.data as T) ?? null;
  } catch (err) {
    console.warn(`[manualEntryDraft] Failed to load draft for ${submissionId}:${mode}`, err);
    return null;
  }
}

/**
 * Removes the signed-in user's draft for a submission/mode (e.g. after a successful submit).
 */
export async function clearManualEntryDraft(
  submissionId: string,
  mode: ManualEntryMode,
): Promise<void> {
  const userId = draftOwner();
  if (!userId) return;
  try {
    await offlineDb.drafts.delete(draftKey(userId, submissionId, mode));
  } catch (err) {
    console.warn(`[manualEntryDraft] Failed to clear draft for ${submissionId}:${mode}`, err);
  }
}

/**
 * Returns whether the signed-in user has a draft for the given submission/mode.
 */
export async function hasManualEntryDraft(
  submissionId: string,
  mode: ManualEntryMode,
): Promise<boolean> {
  const userId = draftOwner();
  if (!userId) return false;
  try {
    return (await offlineDb.drafts.get(draftKey(userId, submissionId, mode))) !== undefined;
  } catch {
    return false;
  }
}
