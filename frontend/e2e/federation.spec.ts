import { test, expect } from "@playwright/test";
import { mockKeycloakAuthenticated, mockBackendApi } from "./fixtures/auth";

test.describe("Federation user navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockKeycloakAuthenticated(page, "federation");
    await mockBackendApi(page);
  });

  test("should access dashboard", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test("should see federation dashboard title", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByText("Federation Workspace")).toBeVisible({ timeout: 15000 });
  });

  test("should access apexes management", async ({ page }) => {
    await page.goto("/app/apexes");
    await expect(page).toHaveURL(/\/app\/apexes/);
  });

  test("should access users page", async ({ page }) => {
    await page.goto("/app/users");
    await expect(page).toHaveURL(/\/app\/users/);
  });

  test("should see Apexes in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Apexes/ })).toBeVisible({ timeout: 10000 });
  });

  test("should see Users & Roles in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Users & Roles/ })).toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Federations in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Federations$/ })).not.toBeVisible({
      timeout: 10000,
    });
  });

  test("should NOT see Settings in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Settings$/ })).not.toBeVisible({
      timeout: 10000,
    });
  });

  test("should NOT see Invitations in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Invitations/ })).not.toBeVisible({
      timeout: 10000,
    });
  });

  test("should NOT see Members in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Members$/ })).not.toBeVisible({ timeout: 10000 });
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

  test("should navigate to apexes via sidebar", async ({ page }) => {
    await page.goto("/app/dashboard");
    await page
      .getByRole("link", { name: /Apexes/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/apexes/);
  });

  test("should be denied access to federations page", async ({ page }) => {
    await page.goto("/app/federations");
    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should be denied access to settings page", async ({ page }) => {
    await page.goto("/app/settings");
    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should be denied access to invitations page", async ({ page }) => {
    await page.goto("/app/invitations");
    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 15000 });
  });
});
