import { test, expect } from "@playwright/test";
import { mockKeycloakAuthenticated, mockBackendApi, type TestRole } from "./fixtures/auth";

test.describe("Role-based redirect after login", () => {
  const roles: TestRole[] = ["ministry", "federation", "apex", "cooperative"];

  for (const role of roles) {
    test(`should redirect ${role} user to /app/dashboard after login`, async ({ page }) => {
      await mockKeycloakAuthenticated(page, role);
      await mockBackendApi(page);

      await page.goto("/app/dashboard");

      await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10000 });
    });
  }

  test("should redirect authenticated user from /login to dashboard", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "ministry");
    await mockBackendApi(page);

    await page.goto("/login");

    await page.waitForURL(/\/app\/dashboard/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test("should redirect unauthenticated user from /app to /login", async ({ page }) => {
    await mockBackendApi(page);

    await page.goto("/app/dashboard");

    await expect(page.getByText("Redirecting to login")).toBeVisible({ timeout: 10000 });
  });

  test("should redirect unauthenticated user from any /app/* route to /login", async ({ page }) => {
    await mockBackendApi(page);

    await page.goto("/app/federations");

    await expect(page.getByText("Redirecting to login")).toBeVisible({ timeout: 10000 });
  });
});
