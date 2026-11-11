export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export const itemTone = (status: string): StatusTone => {
  switch (status) {
    case "synced":
      return "success";
    case "flagged":
      return "warning";
    case "failed":
      return "danger";
    case "running":
      return "info";
    default:
      return "neutral";
  }
};

export const runTone = (status: string): StatusTone => {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "info";
  return "neutral";
};

/** Month 0 is a whole-year sync: one "Full 12 Mo" return per SACCO. */
export const WHOLE_YEAR = 0;

export const periodLabel = (year: number, month: number): string =>
  month === WHOLE_YEAR ? `Whole year ${year}` : `${MONTH_NAMES[month - 1] ?? month} ${year}`;

export type CooperativeSyncState =
  "not_linked" | "never" | "running" | "synced" | "attention" | "failed";

interface SyncFacts {
  mambu_branch_id?: string | null;
  running: boolean;
  last_status?: string | null;
  last_warning_count: number;
  last_unmapped_accounts: number;
}

/** Where a cooperative stands: not linked, never synced, running, fine, to check or failed. */
export const cooperativeState = (c: SyncFacts): CooperativeSyncState => {
  if (!c.mambu_branch_id) return "not_linked";
  if (c.running) return "running";
  if (!c.last_status) return "never";
  if (c.last_status === "failed") return "failed";
  if (c.last_status === "flagged" || c.last_unmapped_accounts > 0) return "attention";
  return "synced";
};

export const STATE_TONE: Record<CooperativeSyncState, StatusTone> = {
  not_linked: "neutral",
  never: "neutral",
  running: "info",
  synced: "success",
  attention: "warning",
  failed: "danger",
};

export const STATE_LABEL: Record<CooperativeSyncState, string> = {
  not_linked: "Not linked",
  never: "Not synced yet",
  running: "Syncing",
  synced: "Up to date",
  attention: "Check the warnings",
  failed: "Failed",
};

/** "just now", "5 min ago", "3 h ago", "2 days ago" for a past timestamp. */
export const timeAgo = (iso: string | null | undefined, now: Date = new Date()): string => {
  if (!iso) return "never";
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86_400)} days ago`;
};

/** What a running sync is doing, as the backend names it. */
export const PHASE_LABELS: Record<string, string> = {
  waiting: "Waiting for another large sync to finish",
  reading_members: "Reading members and loans",
  reading_ledger: "Reading the ledger",
  reading_deposits: "Reading deposit accounts",
  saving: "Saving the return",
};

/** The unit of a phase's counter: the ledger is read year by year. */
const PHASE_UNITS: Record<string, string> = { reading_ledger: " months" };

/** " · 83,770 of 126,350" while a count is known, otherwise nothing. */
export const progressCount = (read: number, total: number, phase?: string | null): string =>
  total > 0
    ? ` · ${read.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}${PHASE_UNITS[phase ?? ""] ?? ""}`
    : "";

/** How long a run took, or has been running: "45 s", "5 min 12 s", "1 h 4 min". */
export const runDuration = (
  startedAt: string,
  finishedAt: string | null | undefined,
  now: Date = new Date(),
): string => {
  const end = finishedAt ? new Date(finishedAt) : now;
  const seconds = Math.max(0, Math.round((end.getTime() - new Date(startedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

/** "11 Nov 2026, 19:40" in the viewer's time zone. */
export const startedLabel = (iso: string): string =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
