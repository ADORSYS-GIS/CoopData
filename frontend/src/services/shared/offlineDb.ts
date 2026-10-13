import Dexie, { type Table } from "dexie";

export interface CachedSubmission {
  id: string;
  userId: string;
  role: string;
  data: unknown;
  cachedAt: number;
  isDirty: boolean;
  localVersion: number;
}

export interface CachedAnalytics {
  key: string;
  userId: string;
  data: unknown;
  cachedAt: number;
}

export interface CachedFederation {
  id: string;
  userId: string;
  data: unknown;
  cachedAt: number;
}

export interface CachedApex {
  id: string;
  userId: string;
  data: unknown;
  cachedAt: number;
}

export interface CachedUser {
  id: string;
  userId: string;
  data: unknown;
  cachedAt: number;
}

export interface CachedCooperative {
  id: string;
  userId: string;
  data: unknown;
  cachedAt: number;
}

export interface CachedFormTemplate {
  id: string;
  userId: string;
  data: unknown;
  cachedAt: number;
}

export interface CachedReport {
  id: string;
  userId: string;
  data: unknown;
  cachedAt: number;
}

export interface SyncQueueItem {
  id?: number;
  correlationId: string;
  userId: string;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  pathParams?: Record<string, string>;
  body?: unknown;
  createdAt: number;
  retryCount: number;
  lastError?: string;
  /** HTTP status of the last refusal (absent for network errors). */
  lastStatus?: number;
  /** Earliest time (ms) of the next automatic retry. */
  nextAttemptAt?: number;
  /** When the current send started; used to rescue items stuck in "syncing". */
  syncStartedAt?: number;
  status: "pending" | "syncing" | "failed" | "done";
  optimisticData?: unknown;
  verificationToken?: string;
}

export interface OfflineMeta {
  key: string;
  value: unknown;
}

export interface ManualEntryDraft {
  key: string;
  /** Owner: drafts survive logout, so only this user may load them. */
  userId: string;
  submissionId: string;
  mode: "financial" | "non_financial";
  data: unknown;
  updatedAt: number;
}

export class CoopDataOfflineDB extends Dexie {
  submissions!: Table<CachedSubmission>;
  analytics!: Table<CachedAnalytics>;
  federations!: Table<CachedFederation>;
  apexes!: Table<CachedApex>;
  users!: Table<CachedUser>;
  cooperatives!: Table<CachedCooperative>;
  formTemplates!: Table<CachedFormTemplate>;
  reports!: Table<CachedReport>;
  syncQueue!: Table<SyncQueueItem>;
  meta!: Table<OfflineMeta>;
  drafts!: Table<ManualEntryDraft>;

  constructor() {
    super("CoopDataOfflineDB");

    // Version 1 Schema
    this.version(1).stores({
      submissions: "&id, userId, role, isDirty, cachedAt",
      analytics: "&key, userId, cachedAt",
      federations: "&id, userId, cachedAt",
      apexes: "&id, userId, cachedAt",
      users: "&id, userId, cachedAt",
      cooperatives: "&id, userId, cachedAt",
      formTemplates: "&id, userId, cachedAt",
      reports: "&id, userId, cachedAt",
      syncQueue: "++id, userId, status, correlationId, createdAt",
      meta: "&key",
    });

    // Version 2 Schema (placeholder for production schema upgrades)
    this.version(2)
      .stores({
        submissions: "&id, userId, role, isDirty, cachedAt",
        analytics: "&key, userId, cachedAt",
        federations: "&id, userId, cachedAt",
        apexes: "&id, userId, cachedAt",
        users: "&id, userId, cachedAt",
        cooperatives: "&id, userId, cachedAt",
        formTemplates: "&id, userId, cachedAt",
        reports: "&id, userId, cachedAt",
        syncQueue: "++id, userId, status, correlationId, createdAt",
        meta: "&key",
      })
      .upgrade(async (tx) => {
        // Additive-only migration: no table was added or removed here, so no
        // data transformation is required. If a future migration needs to
        // backfill/transform data, implement it in this closure.
        console.log("[offlineDb] Schema upgraded to version 2 successfully");
      });

    // Version 3 Schema — adds local draft persistence for in-progress manual
    // entry wizards so work survives navigation/refresh while offline.
    this.version(3)
      .stores({
        submissions: "&id, userId, role, isDirty, cachedAt",
        analytics: "&key, userId, cachedAt",
        federations: "&id, userId, cachedAt",
        apexes: "&id, userId, cachedAt",
        users: "&id, userId, cachedAt",
        cooperatives: "&id, userId, cachedAt",
        formTemplates: "&id, userId, cachedAt",
        reports: "&id, userId, cachedAt",
        syncQueue: "++id, userId, status, correlationId, createdAt",
        meta: "&key",
        drafts: "&key, submissionId, mode, updatedAt",
      })
      .upgrade(async (tx) => {
        // Additive-only migration: adds the `drafts` table; existing tables are
        // unchanged, so no data transformation is required.
        console.log("[offlineDb] Schema upgraded to version 3 (drafts table)");
      });

    // Version 4 — drafts are owned by a user (they now survive logout, so another
    // user on the same device must not load them). Older drafts have no owner and
    // can't be attributed safely, so they are removed.
    this.version(4)
      .stores({
        submissions: "&id, userId, role, isDirty, cachedAt",
        analytics: "&key, userId, cachedAt",
        federations: "&id, userId, cachedAt",
        apexes: "&id, userId, cachedAt",
        users: "&id, userId, cachedAt",
        cooperatives: "&id, userId, cachedAt",
        formTemplates: "&id, userId, cachedAt",
        reports: "&id, userId, cachedAt",
        syncQueue: "++id, userId, status, correlationId, createdAt",
        meta: "&key",
        drafts: "&key, userId, submissionId, mode, updatedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("drafts")
          .filter((draft: { userId?: string }) => !draft.userId)
          .delete();
      });
  }
}

export const offlineDb = new CoopDataOfflineDB();

export const CACHE_TTL_MS = {
  submissions: 7 * 24 * 60 * 60 * 1000,
  analytics: 60 * 60 * 1000,
  federations: 24 * 60 * 60 * 1000,
  apexes: 24 * 60 * 60 * 1000,
  users: 6 * 60 * 60 * 1000,
  cooperatives: 24 * 60 * 60 * 1000,
  formTemplates: 7 * 24 * 60 * 60 * 1000,
  reports: 24 * 60 * 60 * 1000,
} as const;
