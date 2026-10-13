import type { BrowserContext, ConsoleMessage, Page } from "@playwright/test";
import { loginAs, type TestRole } from "./login";

/**
 * Offline tests need the production build (service worker + precache), which
 * `docker compose up` serves as the `frontend-pwa` service. The Vite dev
 * server never registers a service worker.
 */
export const PWA_URL = process.env.E2E_PWA_URL ?? "http://localhost:5174";

const OFFLINE_DB = "CoopDataOfflineDB";
const SEED_DONE = "[offlineSeeder] Pre-caching complete";

export async function isPwaServerUp(): Promise<boolean> {
  try {
    const res = await fetch(`${PWA_URL}/sw.js`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Resolves on the next "seeding complete" console message. */
export function nextSeedCompletion(page: Page, timeout = 90_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Offline seeder did not finish")), timeout);
    const onMessage = (msg: ConsoleMessage) => {
      if (!msg.text().includes(SEED_DONE)) return;
      clearTimeout(timer);
      page.off("console", onMessage);
      resolve();
    };
    page.on("console", onMessage);
  });
}

/**
 * Logs in on the PWA build in English, waits for the background seeder and
 * makes sure the service worker controls the page (so it can reload offline).
 */
export async function loginForOffline(page: Page, role: TestRole): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "en"));
  const seeded = nextSeedCompletion(page);
  await loginAs(page, role, { frontendUrl: PWA_URL });
  await seeded;
  const controlled = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return !!navigator.serviceWorker.controller;
  });
  if (!controlled) await page.reload({ waitUntil: "networkidle" });
}

/** Re-runs the seeder the way the app does: an offline → online transition. */
export async function reseed(page: Page, context: BrowserContext): Promise<void> {
  const seeded = nextSeedCompletion(page);
  await context.setOffline(true);
  await page.waitForTimeout(500);
  await context.setOffline(false);
  await seeded;
}

export async function cachedKeys(page: Page, store: string): Promise<string[]> {
  return page.evaluate(
    async ({ db, store }) => {
      const conn = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(db);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const keys = await new Promise<IDBValidKey[]>((resolve) => {
        const req = conn.transaction(store).objectStore(store).getAllKeys();
        req.onsuccess = () => resolve(req.result);
      });
      conn.close();
      return keys.map(String);
    },
    { db: OFFLINE_DB, store },
  );
}

export async function cachedValue<T>(page: Page, store: string, key: string): Promise<T | null> {
  return page.evaluate(
    async ({ db, store, key }) => {
      const conn = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(db);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const row = await new Promise<{ data?: unknown } | undefined>((resolve) => {
        const req = conn.transaction(store).objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
      });
      conn.close();
      return (row?.data ?? null) as never;
    },
    { db: OFFLINE_DB, store, key },
  );
}

async function deleteRows(page: Page, db: string, store: string, keys: string[]) {
  await page.evaluate(
    async ({ db, store, keys }) => {
      const conn = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(db);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = conn.transaction(store, "readwrite");
        for (const key of keys) tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      conn.close();
    },
    { db, store, keys },
  );
}

/** Removes rows from the offline DB, simulating data that was never cached. */
export function deleteCached(page: Page, store: string, keys: string[]) {
  return deleteRows(page, OFFLINE_DB, store, keys);
}

/** Removes the persisted React Query snapshot (keeps the login tokens). */
export function deleteQuerySnapshot(page: Page) {
  return deleteRows(page, "keyval-store", "keyval", ["coopdata_query_cache"]);
}

/**
 * Moves the saved login's deadline (Keycloak's offline-token expiry) while
 * keeping the time of the last refresh recent, as after normal online use.
 */
export async function setSavedLoginDeadline(page: Page, expiresAt: number): Promise<void> {
  await page.evaluate(async (expiresAt) => {
    const conn = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("keyval-store");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const store = conn.transaction("keyval", "readwrite").objectStore("keyval");
      const get = store.get("coopdata_tokens");
      get.onsuccess = () => {
        const put = store.put(
          { ...get.result, timestamp: Date.now(), refreshTokenExpiry: expiresAt },
          "coopdata_tokens",
        );
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
      };
    });
    conn.close();
  }, expiresAt);
}

export interface QueueItemView {
  tag?: string;
  endpoint: string;
  status: string;
  retryCount: number;
  lastError?: string;
}

/** Adds an item to the sync queue exactly as enqueue() would, for the logged-in user. */
export async function addQueueItem(
  page: Page,
  item: { tag: string; endpoint: string; method: string; body?: unknown },
): Promise<void> {
  await page.evaluate(
    async ({ db, item }) => {
      const profile = JSON.parse(localStorage.getItem("coopdata_user_profile") ?? "{}");
      const conn = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(db);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = conn.transaction("syncQueue", "readwrite");
        tx.objectStore("syncQueue").add({
          ...item,
          correlationId: crypto.randomUUID(),
          userId: profile.id,
          createdAt: Date.now(),
          retryCount: 0,
          status: "pending",
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      conn.close();
    },
    { db: OFFLINE_DB, item },
  );
}

export async function queueItems(page: Page): Promise<QueueItemView[]> {
  return page.evaluate(async (db) => {
    const conn = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(db);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const rows = await new Promise<QueueItemView[]>((resolve) => {
      const req = conn.transaction("syncQueue").objectStore("syncQueue").getAll();
      req.onsuccess = () => resolve(req.result);
    });
    conn.close();
    return rows;
  }, OFFLINE_DB);
}

export async function clearQueue(page: Page): Promise<void> {
  await page.evaluate(async (db) => {
    const conn = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(db);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve) => {
      const tx = conn.transaction("syncQueue", "readwrite");
      tx.objectStore("syncQueue").clear();
      tx.oncomplete = () => resolve();
    });
    conn.close();
  }, OFFLINE_DB);
}
