import { test, expect, type Page } from "@playwright/test";
import {
  PWA_URL,
  cachedKeys,
  cachedValue,
  deleteCached,
  deleteQuerySnapshot,
  isPwaServerUp,
  loginForOffline,
  reseed,
} from "../fixtures/helpers/offline";

/**
 * Offline-mode regression tests (issues A, G and H in
 * docs/knowledge/frontend/offline-known-issues.md).
 *
 * Requirements: real backend + Keycloak, the production build served by the
 * `frontend-pwa` service (`docker compose up`, http://localhost:5174), and the
 * E2E_* accounts from .env. The apex account needs at least one cooperative
 * with members; the ministry account at least one submission.
 *
 * Run: npm run test:e2e:offline
 */

const CRASH_TEXT = "This page didn't load";
const UNAVAILABLE_TEXT = "This information isn't available offline yet";
const UUID = "[0-9a-f-]{36}";

test.describe("Offline mode", () => {
  test.skip(!!process.env.CI, "Requires real backend + Keycloak + PWA build - skipped in CI");
  test.use({ baseURL: PWA_URL });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    test.skip(
      !(await isPwaServerUp()),
      `PWA build not reachable at ${PWA_URL} (docker compose up)`,
    );
  });

  async function cachedSubmissionIds(page: Page): Promise<string[]> {
    const keys = await cachedKeys(page, "submissions");
    const pattern = new RegExp(`^submission-(${UUID})$`);
    return keys.flatMap((k) => pattern.exec(k)?.[1] ?? []);
  }

  /** Cooperatives whose seeded member list is non-empty: [cooperativeId, memberCount]. */
  async function cooperativesWithMembers(page: Page): Promise<[string, number][]> {
    const keys = await cachedKeys(page, "cooperatives");
    const pattern = new RegExp(`^cooperative-(${UUID})-members$`);
    const result: [string, number][] = [];
    for (const key of keys) {
      const id = pattern.exec(key)?.[1];
      if (!id) continue;
      const members = await cachedValue<unknown[]>(page, "cooperatives", key);
      if (Array.isArray(members) && members.length > 0) result.push([id, members.length]);
    }
    return result;
  }

  const memberCount = (n: number) => new RegExp(`^${n} members?$`);

  test("the app opens with no connection", async ({ page, context }) => {
    await loginForOffline(page, "ministry");

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByText("You're offline — showing cached data")).toBeVisible();
    await expect(page.getByText(CRASH_TEXT)).toHaveCount(0);
  });

  test("A: an uncached submission shows the offline message instead of crashing", async ({
    page,
    context,
  }) => {
    await loginForOffline(page, "ministry");
    const [id] = await cachedSubmissionIds(page);
    test.skip(!id, "Ministry account has no submissions to open");

    await context.setOffline(true);
    await deleteCached(page, "submissions", [`submission-${id}`]);
    await deleteQuerySnapshot(page);
    await page.goto(`/app/submissions/${id}`);

    await expect(page.getByText(UNAVAILABLE_TEXT)).toBeVisible();
    await expect(page.getByText(CRASH_TEXT)).toHaveCount(0);
  });

  test("A: submissions with a financial statement open offline for apex", async ({
    page,
    context,
  }) => {
    await loginForOffline(page, "apex");
    const ids: string[] = [];
    for (const id of await cachedSubmissionIds(page)) {
      const sub = await cachedValue<{ financial_statement_id?: string | null }>(
        page,
        "submissions",
        `submission-${id}`,
      );
      if (sub?.financial_statement_id) ids.push(id);
    }
    test.skip(ids.length === 0, "Apex account has no submission with a financial statement");

    // The statement editor loads the chart of accounts, which is never seeded.
    await deleteCached(page, "submissions", ["chart-of-accounts"]);
    await context.setOffline(true);
    await deleteQuerySnapshot(page);
    await page.goto("/app/submissions");
    await expect(page.getByText(CRASH_TEXT)).toHaveCount(0);
    for (const id of ids.slice(0, 3)) {
      await page.goto(`/app/submissions/${id}`);
      await expect(page.getByText(/SUB-\d{4}-\d+/).first()).toBeVisible();
      const financialTab = page.getByRole("tab", { name: /financial/i }).first();
      if (await financialTab.isVisible()) await financialTab.click();
      await page.waitForTimeout(2_000);
      await expect(page.getByText(CRASH_TEXT)).toHaveCount(0);
    }
  });

  test("G: cooperative members downloaded by the seeder are found offline", async ({
    page,
    context,
  }) => {
    await loginForOffline(page, "apex");
    const keys = await cachedKeys(page, "cooperatives");
    expect(keys.filter((k) => k.startsWith("cooperative-members-"))).toEqual([]);
    const [coop] = await cooperativesWithMembers(page);
    test.skip(!coop, "Apex account has no cooperative with members");
    const [coopId, count] = coop;

    // The members page was never opened online: only the seeder's copy exists.
    await context.setOffline(true);
    await deleteQuerySnapshot(page);
    await page.goto(`/app/cooperative-members/${coopId}`);

    await expect(page.getByText(memberCount(count)).first()).toBeVisible();
  });

  test("H: the members page refreshes by itself when the connection returns", async ({
    page,
    context,
  }) => {
    await loginForOffline(page, "apex");
    // Find a cooperative with members by opening its page online, so the test
    // doesn't depend on what the seeder stored.
    const coops =
      (await cachedValue<{ id: string }[]>(page, "cooperatives", "cooperatives-list")) ?? [];
    let coop: [string, number] | undefined;
    for (const { id } of coops) {
      await page.goto(`/app/cooperative-members/${id}`, { waitUntil: "networkidle" });
      const label = page.getByText(/^\d+ members?$/).first();
      const n = (await label.isVisible()) ? parseInt(await label.innerText(), 10) : 0;
      if (n > 0) {
        coop = [id, n];
        break;
      }
    }
    test.skip(!coop, "Apex account has no cooperative with members");
    const [coopId, count] = coop as [string, number];

    await context.setOffline(true);
    await deleteCached(page, "cooperatives", [`cooperative-${coopId}-members`]);
    await deleteQuerySnapshot(page);
    await page.goto(`/app/cooperative-members/${coopId}`);
    await expect(page.getByText(memberCount(0)).first()).toBeVisible();

    await context.setOffline(false); // no reload: the page must refetch on its own
    await expect(page.getByText(memberCount(count)).first()).toBeVisible({ timeout: 20_000 });
  });

  test("G: the ministry seeder saves data where the pages read it, in every language", async ({
    page,
    context,
  }) => {
    await loginForOffline(page, "ministry");
    // Leave the pages that read these datasets so only the seeder can refill them.
    await page.goto("/app/profile");
    await deleteCached(page, "analytics", await cachedKeys(page, "analytics"));
    await deleteCached(page, "cooperatives", await cachedKeys(page, "cooperatives"));

    await reseed(page, context);

    const analytics = await cachedKeys(page, "analytics");
    const cooperatives = await cachedKeys(page, "cooperatives");
    expect(analytics).toContain("ministry-stats-{}");
    expect(cooperatives).toContain("cooperatives-list");
    expect(cooperatives).not.toContain("ministry-cooperatives");
    for (const lang of ["en", "fr", "pt", "ss"]) {
      expect(analytics).toContain(`custom-kpis-${lang}`);
    }
  });
});
