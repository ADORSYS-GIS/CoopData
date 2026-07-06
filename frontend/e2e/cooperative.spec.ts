import { test, expect } from "@playwright/test";
import { mockKeycloakAuthenticated, mockBackendApi } from "./fixtures/auth";

test.describe("Cooperative user navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockKeycloakAuthenticated(page, "cooperative");
    await mockBackendApi(page);
  });

  test("should access dashboard", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test("should see cooperative dashboard title", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByText("Cooperative Workspace")).toBeVisible({ timeout: 15000 });
  });

  test("should access data collection page", async ({ page }) => {
    await page.goto("/app/data-collection");
    await expect(page).toHaveURL(/\/app\/data-collection/);
  });

  test("should access financial statement page", async ({ page }) => {
    await page.goto("/app/financial-statement");
    await expect(page).toHaveURL(/\/app\/financial-statement/);
  });

  test("should access non-financial data page", async ({ page }) => {
    await page.goto("/app/non-financial-data");
    await expect(page).toHaveURL(/\/app\/non-financial-data/);
  });

  test("should see Data Collection in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Data Collection/ })).toBeVisible({ timeout: 10000 });
  });

  test("should see Reports in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Reports/ })).toBeVisible({ timeout: 10000 });
  });

  test("should see Analytics in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Analytics/ })).toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Federations in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Federations$/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Apexes in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Apexes$/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Cooperatives in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Cooperatives$/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Settings in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Settings$/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Users & Roles in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Users & Roles/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Invitations in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Invitations/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Members in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Members$/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should navigate to data collection via sidebar", async ({ page }) => {
    await page.goto("/app/dashboard");
    await page.getByRole("link", { name: /Data Collection/ }).first().click();
    await expect(page).toHaveURL(/\/app\/data-collection/);
  });

  test("should be denied access to federations page", async ({ page }) => {
    await page.goto("/app/federations");
    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should be denied access to apexes page", async ({ page }) => {
    await page.goto("/app/apexes");
    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should be denied access to cooperatives page", async ({ page }) => {
    await page.goto("/app/cooperatives");
    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should be denied access to settings page", async ({ page }) => {
    await page.goto("/app/settings");
    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should be denied access to users page", async ({ page }) => {
    await page.goto("/app/users");
    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });
});