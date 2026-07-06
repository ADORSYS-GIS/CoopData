import { test, expect } from "@playwright/test";
import { mockKeycloak, mockKeycloakAuthenticated, mockBackendApi } from "./fixtures/auth";

test.describe("Login flow via Keycloak", () => {
  test("should redirect to Keycloak login when unauthenticated", async ({ page }) => {
    await mockKeycloak(page, "ministry");
    await mockBackendApi(page);

    await page.goto("/auth/login");

    await expect(page.getByText("Redirecting to login")).toBeVisible({ timeout: 10000 });
  });

  test("should show Sign in button on landing page", async ({ page }) => {
    await mockKeycloak(page, "ministry");
    await mockBackendApi(page);

    await page.goto("/");

    await expect(page.getByRole("button", { name: /^Sign in$/ }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("should call login when clicking Sign in button", async ({ page }) => {
    await mockKeycloak(page, "ministry");
    await mockBackendApi(page);

    await page.goto("/");

    await page
      .getByRole("button", { name: /^Sign in$/ })
      .first()
      .click();

    await expect(
      page.evaluate(() => (window as unknown as Record<string, unknown>).__E2E_LOGIN_CALLED__),
    ).resolves.toBe(true);
  });

  test("should reach dashboard when already authenticated", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "ministry");
    await mockBackendApi(page);

    await page.goto("/app/dashboard");

    await page.waitForURL(/\/app\/dashboard/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test("should show welcome toast after login", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "ministry");
    await mockBackendApi(page);

    await page.goto("/app/dashboard");

    await expect(page.getByText(/Welcome back/)).toBeVisible({ timeout: 15000 });
  });
});
