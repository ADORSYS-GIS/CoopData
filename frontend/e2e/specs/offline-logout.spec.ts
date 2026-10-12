import { test, expect } from "@playwright/test";
import { loginAs } from "../fixtures/helpers/login";
import {
  PWA_URL,
  addQueueItem,
  cachedKeys,
  clearQueue,
  isPwaServerUp,
  loginForOffline,
  queueItems,
} from "../fixtures/helpers/offline";

/**
 * Logout keeps offline work (decision D-5, step 1 in
 * docs/knowledge/frontend/offline-known-issues.md): drafts and queued changes
 * survive logout, and a manual logout asks first when offline or with unsent
 * changes. Queue items point at a non-existent endpoint: nothing reaches the server.
 *
 * Same requirements as offline.spec.ts. Run: npm run test:e2e:offline
 */

test.describe("Logout keeps offline work", () => {
  test.skip(!!process.env.CI, "Requires real backend + Keycloak + PWA build - skipped in CI");
  test.use({ baseURL: PWA_URL });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    test.skip(
      !(await isPwaServerUp()),
      `PWA build not reachable at ${PWA_URL} (docker compose up)`,
    );
  });

  test("D-5: logging out offline warns first, and the user can stay signed in", async ({
    page,
    context,
  }) => {
    await loginForOffline(page, "cooperative");

    await context.setOffline(true);
    await page.getByRole("button", { name: "Logout" }).first().click();

    await expect(page.getByText(/won't be able to sign in again/)).toBeVisible();
    await page.getByRole("button", { name: "Stay signed in" }).click();
    await expect(page.getByText(/won't be able to sign in again/)).toHaveCount(0);
    expect(page.url()).toContain("/app/");

    // Logging out anyway, offline, ends the session on the device and opens the
    // start page (not a browser error page from trying to reach Keycloak).
    await page.getByRole("button", { name: "Logout" }).first().click();
    await page.getByRole("button", { name: "Log out anyway" }).click();
    await expect(page).toHaveURL(`${PWA_URL}/`);
    await expect(page.getByText("Enter platform").first()).toBeVisible();
  });

  test("D-5: drafts and queued changes survive logout and sign-in", async ({ page }) => {
    await loginForOffline(page, "cooperative");
    // Settle on a page first: right after login the app may still redirect.
    await page.goto("/app/submissions", { waitUntil: "networkidle" });
    await clearQueue(page);
    const userId = await page.evaluate(
      () => JSON.parse(localStorage.getItem("coopdata_user_profile") ?? "{}").id as string,
    );
    const draftKey = `${userId}:e2e-submission:financial`;
    await page.evaluate(
      async ({ draftKey, userId }) => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const req = indexedDB.open("CoopDataOfflineDB");
          req.onsuccess = () => resolve(req.result);
        });
        await new Promise<void>((resolve) => {
          const tx = db.transaction("drafts", "readwrite");
          tx.objectStore("drafts").put({
            key: draftKey,
            userId,
            submissionId: "e2e-submission",
            mode: "financial",
            data: { note: "half-filled" },
            updatedAt: Date.now(),
          });
          tx.oncomplete = () => resolve();
        });
        db.close();
      },
      { draftKey, userId },
    );
    await addQueueItem(page, {
      tag: "D5",
      endpoint: "/api/v1/__e2e_noop",
      method: "POST",
      body: {},
    });

    await page.getByRole("button", { name: "Logout" }).first().click();
    await expect(page.getByText(/not sent yet/)).toBeVisible();
    await page.getByRole("button", { name: "Log out anyway" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/app"), { timeout: 30_000 });

    await loginAs(page, "cooperative", { frontendUrl: PWA_URL });
    await page.goto("/app/submissions", { waitUntil: "networkidle" });
    expect(await cachedKeys(page, "drafts")).toContain(draftKey);
    expect((await queueItems(page)).some((i) => i.tag === "D5")).toBe(true);

    await clearQueue(page);
  });
});
