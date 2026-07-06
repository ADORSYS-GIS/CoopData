import { test, expect } from "@playwright/test";
import { mockKeycloakAuthenticated, mockBackendApi } from "./fixtures/auth";

test.describe("Ministry user navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockKeycloakAuthenticated(page, "ministry");
    await mockBackendApi(page);
  });

  test("should access dashboard", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test("should see ministry dashboard title", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByText("National Cooperative Intelligence")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should access federations management", async ({ page }) => {
    await page.goto("/app/federations");
    await expect(page).toHaveURL(/\/app\/federations/);
  });

  test("should access invitations page", async ({ page }) => {
    await page.goto("/app/invitations");
    await expect(page).toHaveURL(/\/app\/invitations/);
  });

  test("should access members page", async ({ page }) => {
    await page.goto("/app/members");
    await expect(page).toHaveURL(/\/app\/members/);
  });

  test("should access settings page", async ({ page }) => {
    await page.goto("/app/settings");
    await expect(page).toHaveURL(/\/app\/settings/);
  });

  test("should access users page", async ({ page }) => {
    await page.goto("/app/users");
    await expect(page).toHaveURL(/\/app\/users/);
  });

  test("should see Federations in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Federations/ })).toBeVisible({ timeout: 10000 });
  });

  test("should see Invitations in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Invitations/ })).toBeVisible({ timeout: 10000 });
  });

  test("should see Members in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Members/ })).toBeVisible({ timeout: 10000 });
  });

  test("should see Settings in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Settings/ })).toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Apexes in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Apexes$/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Cooperatives in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Cooperatives$/ })).not.toBeVisible({
      timeout: 10000,
    });
  });

  test("should NOT see Data Collection in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Data Collection/ })).not.toBeVisible({
      timeout: 10000,
    });
  });

  test("should navigate to federations via sidebar", async ({ page }) => {
    await page.goto("/app/dashboard");
    await page
      .getByRole("link", { name: /Federations/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/federations/);
  });

  test("should navigate to settings via sidebar", async ({ page }) => {
    await page.goto("/app/dashboard");
    await page
      .getByRole("link", { name: /Settings/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/settings/);
  });
});
