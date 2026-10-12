import { test, expect } from "@playwright/test";
import {
  PWA_URL,
  addQueueItem,
  clearQueue,
  isPwaServerUp,
  loginForOffline,
  queueItems,
} from "../fixtures/helpers/offline";

/**
 * Sync queue (outbox) behaviour: issues C–F in
 * docs/knowledge/frontend/offline-known-issues.md. Queue items point at a
 * non-existent endpoint, so no server data is ever changed.
 *
 * Same requirements as offline.spec.ts. Run: npm run test:e2e:offline
 */

const NOOP_ENDPOINT = "/api/v1/__e2e_noop";
const OFFLINE_BANNER = "You're offline — showing cached data";

test.describe("Offline sync queue", () => {
  test.skip(!!process.env.CI, "Requires real backend + Keycloak + PWA build - skipped in CI");
  test.use({ baseURL: PWA_URL });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    test.skip(
      !(await isPwaServerUp()),
      `PWA build not reachable at ${PWA_URL} (docker compose up)`,
    );
  });

  test("C: after starting offline, the outbox sends as soon as the connection returns", async ({
    page,
    context,
  }) => {
    await loginForOffline(page, "ministry");
    await clearQueue(page);

    await context.setOffline(true);
    await page.reload(); // the app now starts offline (cached token, no Keycloak)
    await expect(page.getByText(OFFLINE_BANNER)).toBeVisible();
    await addQueueItem(page, { tag: "C", endpoint: NOOP_ENDPOINT, method: "POST", body: {} });

    await context.setOffline(false); // no reload
    await expect(page.getByText(OFFLINE_BANNER)).toHaveCount(0, { timeout: 20_000 });
    await expect
      .poll(async () => (await queueItems(page)).find((i) => i.tag === "C")?.retryCount ?? 0, {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);

    await clearQueue(page);
  });

  test("D: an online save and its outbox retries carry the same correlation id", async ({
    page,
  }) => {
    await loginForOffline(page, "ministry");
    await clearQueue(page);
    await page.goto("/app/custom-kpis");

    // Every attempt is dropped before reaching the server: nothing is saved.
    const ids: (string | null)[] = [];
    await page.route("**/api/v1/ministry/custom-kpis", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      ids.push(route.request().headers()["x-correlation-id"] ?? null);
      return route.abort("failed");
    });

    await page.getByRole("button", { name: /new custom kpi/i }).click();
    await page.fill("#dialog-kpi-name", `E2E-NOT-SAVED-${Date.now()}`);
    await page.fill("#dialog-formula-editor", "total_equity / total_assets * 100");
    await page.getByRole("button", { name: /save custom kpi/i }).click();

    await expect.poll(() => ids.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    expect(ids[0]).toBeTruthy();
    expect(new Set(ids).size).toBe(1);

    await clearQueue(page);
  });

  test("E: an 'already exists' refusal is reported as failed, not as saved", async ({ page }) => {
    await loginForOffline(page, "ministry");
    await clearQueue(page);

    // The server refuses: this email is already a user. Nothing is created.
    await addQueueItem(page, {
      tag: "E",
      endpoint: "/api/v1/users",
      method: "POST",
      body: { email: process.env.E2E_MINISTRY_EMAIL, full_name: "E2E", role: "ministry" },
    });

    await expect
      .poll(async () => (await queueItems(page)).find((i) => i.tag === "E")?.status, {
        timeout: 20_000,
      })
      .toBe("failed");
    const item = (await queueItems(page)).find((i) => i.tag === "E");
    expect(item?.lastError).toMatch(/already exists/i);

    await clearQueue(page);
  });
});
