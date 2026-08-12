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
  status: "pending" | "syncing" | "failed" | "done";
  optimisticData?: unknown;
}

export interface OfflineMeta {
  key: string;
  value: unknown;
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

  constructor() {
    super("CoopDataOfflineDB");
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
