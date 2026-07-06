import { test, expect } from "@playwright/test";
import { mockKeycloakAuthenticated, mockBackendApi, type TestRole } from "./fixtures/auth";

test.describe("Unauthorized route access", () => {
  test("should show Access Denied when cooperative user visits federations", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "cooperative");
    await mockBackendApi(page);

    await page.goto("/app/federations");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("You don't have the required permissions")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show Access Denied when cooperative user visits settings", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "cooperative");
    await mockBackendApi(page);

    await page.goto("/app/settings");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should show Access Denied when federation user visits federations", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "federation");
    await mockBackendApi(page);

    await page.goto("/app/federations");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should show Access Denied when apex user visits apexes", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "apex");
    await mockBackendApi(page);

    await page.goto("/app/apexes");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should show Access Denied when apex user visits settings", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "apex");
    await mockBackendApi(page);

    await page.goto("/app/settings");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should show Access Denied when federation user visits cooperatives", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "federation");
    await mockBackendApi(page);

    await page.goto("/app/cooperatives");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should show Access Denied when cooperative user visits users", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "cooperative");
    await mockBackendApi(page);

    await page.goto("/app/users");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should show Access Denied when cooperative user visits invitations", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "cooperative");
    await mockBackendApi(page);

    await page.goto("/app/invitations");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should show Access Denied when cooperative user visits members", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "cooperative");
    await mockBackendApi(page);

    await page.goto("/app/members");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should show Access Denied when federation user visits invitations", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "federation");
    await mockBackendApi(page);

    await page.goto("/app/invitations");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should show Access Denied when federation user visits members", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "federation");
    await mockBackendApi(page);

    await page.goto("/app/members");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should show Access Denied when apex user visits invitations", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "apex");
    await mockBackendApi(page);

    await page.goto("/app/invitations");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should show Access Denied when apex user visits members", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "apex");
    await mockBackendApi(page);

    await page.goto("/app/members");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
  });

  test("should show Return Home button on unauthorized page", async ({ page }) => {
    await mockKeycloakAuthenticated(page, "cooperative");
    await mockBackendApi(page);

    await page.goto("/app/federations");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Return Home")).toBeVisible({ timeout: 5000 });
  });

  test("should show Sign in with different account button on unauthorized page", async ({
    page,
  }) => {
    await mockKeycloakAuthenticated(page, "cooperative");
    await mockBackendApi(page);

    await page.goto("/app/federations");

    await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Sign in with different account")).toBeVisible({ timeout: 5000 });
  });

  test("should allow all roles to access dashboard", async ({ page }) => {
    const roles: TestRole[] = ["ministry", "federation", "apex", "cooperative"];

    for (const role of roles) {
      await mockKeycloakAuthenticated(page, role);
      await mockBackendApi(page);

      await page.goto("/app/dashboard");
      await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10000 });
      await expect(page.getByText("Access Denied")).not.toBeVisible({ timeout: 5000 });
    }
  });

  test("should allow all roles to access submissions", async ({ page }) => {
    const roles: TestRole[] = ["ministry", "federation", "apex", "cooperative"];

    for (const role of roles) {
      await mockKeycloakAuthenticated(page, role);
      await mockBackendApi(page);

      await page.goto("/app/submissions");
      await expect(page).toHaveURL(/\/app\/submissions/, { timeout: 10000 });
      await expect(page.getByText("Access Denied")).not.toBeVisible({ timeout: 5000 });
    }
  });

  test("should allow all roles to access reports", async ({ page }) => {
    const roles: TestRole[] = ["ministry", "federation", "apex", "cooperative"];

    for (const role of roles) {
      await mockKeycloakAuthenticated(page, role);
      await mockBackendApi(page);

      await page.goto("/app/reports");
      await expect(page).toHaveURL(/\/app\/reports/, { timeout: 10000 });
      await expect(page.getByText("Access Denied")).not.toBeVisible({ timeout: 5000 });
    }
  });

  test("should allow all roles to access analytics", async ({ page }) => {
    const roles: TestRole[] = ["ministry", "federation", "apex", "cooperative"];

    for (const role of roles) {
      await mockKeycloakAuthenticated(page, role);
      await mockBackendApi(page);

      await page.goto("/app/analytics");
      await expect(page).toHaveURL(/\/app\/analytics/, { timeout: 10000 });
      await expect(page.getByText("Access Denied")).not.toBeVisible({ timeout: 5000 });
    }
  });
});
