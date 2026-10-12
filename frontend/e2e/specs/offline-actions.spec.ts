import { test, expect } from "@playwright/test";
import {
  PWA_URL,
  cachedKeys,
  cachedValue,
  isPwaServerUp,
  loginForOffline,
} from "../fixtures/helpers/offline";

/**
 * Offline action rules (issue B / decision D-1 in
 * docs/knowledge/frontend/offline-known-issues.md): cooperatives and apexes
 * may create and fill drafts offline; submit, review decisions and delegation
 * need a connection.
 *
 * Same requirements as offline.spec.ts. Run: npm run test:e2e:offline
 */

const NEEDS_CONNECTION = "This action needs an internet connection.";

test.describe("Offline action rules", () => {
  test.skip(!!process.env.CI, "Requires real backend + Keycloak + PWA build - skipped in CI");
  test.use({ baseURL: PWA_URL });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    test.skip(
      !(await isPwaServerUp()),
      `PWA build not reachable at ${PWA_URL} (docker compose up)`,
    );
  });

  test("B: a cooperative can still start a draft offline", async ({ page, context }) => {
    await loginForOffline(page, "cooperative");

    await context.setOffline(true);
    await page.goto("/app/submissions");

    await expect(page.getByRole("button", { name: "New Submission" })).toBeEnabled();
  });

  test("B: an apex can also start a draft offline", async ({ page, context }) => {
    await loginForOffline(page, "apex");

    await context.setOffline(true);
    await page.goto("/app/submissions");

    await expect(page.getByRole("button", { name: "New Submission" })).toBeEnabled();
  });

  test("B: submitting a draft for review needs a connection", async ({ page, context }) => {
    await loginForOffline(page, "cooperative");
    let draftId: string | undefined;
    for (const key of await cachedKeys(page, "submissions")) {
      if (!/^submission-[0-9a-f-]{36}$/.test(key)) continue;
      const sub = await cachedValue<{ status?: string }>(page, "submissions", key);
      if (sub?.status === "draft") draftId = key.slice("submission-".length);
    }
    test.skip(!draftId, "Cooperative account has no draft submission");

    await context.setOffline(true);
    await page.goto(`/app/submissions/${draftId}`);
    const submit = page.getByRole("button", { name: /^Submit to/ });
    test.skip(
      (await submit.count()) === 0,
      "Draft is not editable by this cooperative (no submit button)",
    );

    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute("title", NEEDS_CONNECTION);
  });

  test("B: delegating a draft to the cooperative needs a connection", async ({ page, context }) => {
    await loginForOffline(page, "apex");
    const drafts: string[] = [];
    for (const key of await cachedKeys(page, "submissions")) {
      if (!/^submission-[0-9a-f-]{36}$/.test(key)) continue;
      const sub = await cachedValue<{ status?: string }>(page, "submissions", key);
      if (sub?.status === "draft") drafts.push(key.slice("submission-".length));
    }
    test.skip(drafts.length === 0, "Apex account has no draft submission");

    await context.setOffline(true);
    for (const id of drafts) {
      await page.goto(`/app/submissions/${id}`);
      const delegate = page.getByRole("button", { name: /^Delegate to/ });
      await page.waitForTimeout(1_500);
      if ((await delegate.count()) === 0) continue;

      await expect(delegate).toBeDisabled();
      await expect(delegate).toHaveAttribute("title", NEEDS_CONNECTION);
      return;
    }
    test.skip(true, "No apex-held draft that can be delegated");
  });
});
