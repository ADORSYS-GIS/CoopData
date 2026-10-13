import { test, expect } from "@playwright/test";
import {
  PWA_URL,
  cachedKeys,
  cachedValue,
  clearQueue,
  isPwaServerUp,
  loginForOffline,
  queueItems,
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
const SEND_INVITATION = "Send invitation";

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

  test("D-3: an invitation made offline says it will be sent once back online", async ({
    page,
    context,
  }) => {
    await loginForOffline(page, "apex");
    const coops =
      (await cachedValue<{ id: string }[]>(page, "cooperatives", "cooperatives-list")) ?? [];
    test.skip(coops.length === 0, "Apex account has no cooperative");
    await clearQueue(page);

    await context.setOffline(true);
    await page.goto(`/app/cooperative-members/${coops[0].id}`);
    await page.getByRole("button", { name: "Invite member" }).first().click();
    await page.getByPlaceholder("e.g. Jean").fill("E2E");
    await page.getByPlaceholder("e.g. Dupont").fill("Offline");
    await page.getByPlaceholder("email@example.com").fill("e2e-never-sent@example.invalid");
    await page.getByRole("button", { name: SEND_INVITATION }).click();

    await expect(page.getByText("Invitation saved on this device")).toBeVisible();
    await expect(page.getByText(/only receives the email then/)).toBeVisible();
    expect((await queueItems(page)).some((i) => i.endpoint.endsWith("/members"))).toBe(true);

    // Never send it: drop the queued invite before the connection returns.
    await clearQueue(page);
  });
});
