import { test, expect } from "@playwright/test";
import { mockKeycloakAuthenticated, mockBackendApi } from "./fixtures/auth";

test.describe("Apex user navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockKeycloakAuthenticated(page, "apex");
    await mockBackendApi(page);
  });

  test("should access dashboard", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test("should see apex dashboard title", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByText("Apex Supervision Workspace")).toBeVisible({ timeout: 15000 });
  });

  test("should access cooperatives management", async ({ page }) => {
    await page.goto("/app/cooperatives");
    await expect(page).toHaveURL(/\/app\/cooperatives/);
  });

  test("should access users page", async ({ page }) => {
    await page.goto("/app/users");
    await expect(page).toHaveURL(/\/app\/users/);
  });

  test("should see Cooperatives in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Cooperatives/ })).toBeVisible({ timeout: 20000 });
  });

  test("should see Users & Roles in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Users & Roles/ })).toBeVisible({ timeout: 20000 });
  });

  test("should NOT see Federations in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Federations$/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Apexes in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Apexes$/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Settings in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /^Settings$/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Invitations in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Invitations/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should NOT see Data Collection in sidebar nav", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.getByRole("link", { name: /Data Collection/ })).not.toBeVisible({ timeout: 10000 });
  });

  test("should navigate to cooperatives via sidebar", async ({ page }) => {
    await page.goto("/app/dashboard");
    await page.getByRole("link", { name: /Cooperatives/ }).first().click();
    await expect(page).toHaveURL(/\/app\/cooperatives/);
  });

  test("should be denied access to federations page", async ({ page }) => {
    await page.goto("/app/federations");
    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should be denied access to apexes page", async ({ page }) => {
    await page.goto("/app/apexes");
    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should be denied access to settings page", async ({ page }) => {
    await page.goto("/app/settings");
    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });
});