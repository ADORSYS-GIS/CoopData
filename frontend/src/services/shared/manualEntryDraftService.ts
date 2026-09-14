import { offlineDb, type ManualEntryDraft } from "./offlineDb";

export type ManualEntryMode = "financial" | "non_financial";

function draftKey(submissionId: string, mode: ManualEntryMode): string {
  return `${submissionId}:${mode}`;
}

/**
 * Persists an in-progress manual entry wizard draft to IndexedDB so the user's
 * work survives navigation or a page refresh while offline. Best-effort — never
 * throws so a storage failure cannot break the wizard.
 */
export async function saveManualEntryDraft<T>(
  submissionId: string,
  mode: ManualEntryMode,
  data: T,
): Promise<void> {
  try {
    const key = draftKey(submissionId, mode);
    await offlineDb.drafts.put({
      key,
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
 * Loads a previously saved draft, or null when none exists.
 */
export async function loadManualEntryDraft<T>(
  submissionId: string,
  mode: ManualEntryMode,
): Promise<T | null> {
  try {
    const row = await offlineDb.drafts.get(draftKey(submissionId, mode));
    return (row?.data as T) ?? null;
  } catch (err) {
    console.warn(`[manualEntryDraft] Failed to load draft for ${submissionId}:${mode}`, err);
    return null;
  }
}

/**
 * Removes the saved draft for a submission/mode (e.g. after a successful submit).
 */
export async function clearManualEntryDraft(
  submissionId: string,
  mode: ManualEntryMode,
): Promise<void> {
  try {
    await offlineDb.drafts.delete(draftKey(submissionId, mode));
  } catch (err) {
    console.warn(`[manualEntryDraft] Failed to clear draft for ${submissionId}:${mode}`, err);
  }
}

/**
 * Returns whether a draft exists for the given submission/mode.
 */
export async function hasManualEntryDraft(
  submissionId: string,
  mode: ManualEntryMode,
): Promise<boolean> {
  try {
    return (await offlineDb.drafts.get(draftKey(submissionId, mode))) !== undefined;
  } catch {
    return false;
  }
}
