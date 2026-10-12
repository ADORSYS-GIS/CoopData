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
});
