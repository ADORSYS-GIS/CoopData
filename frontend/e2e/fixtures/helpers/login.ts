import type { Page } from "@playwright/test";

/**
 * Real user credentials for E2E testing.
 * These users authenticate via Keycloak with real credentials. localhost
 *
 * Credentials are resolved lazily so that mock-based smoke tests (which never
 * call loginAs) don't fail when E2E_* env vars are absent in CI.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set it in .env or your CI environment before running E2E tests.`,
    );
  }
  return value;
}

function getCredentials(role: TestRole): { email: string; password: string } {
  switch (role) {
    case "ministry":
      return {
        email: requireEnv("E2E_MINISTRY_EMAIL"),
        password: requireEnv("E2E_MINISTRY_PASSWORD"),
      };
    case "federation":
      return {
        email: requireEnv("E2E_FEDERATION_EMAIL"),
        password: requireEnv("E2E_FEDERATION_PASSWORD"),
      };
    case "apex":
      return {
        email: requireEnv("E2E_APEX_EMAIL"),
        password: requireEnv("E2E_APEX_PASSWORD"),
      };
    case "cooperative":
      return {
        email: requireEnv("E2E_COOP_EMAIL"),
        password: requireEnv("E2E_COOP_PASSWORD"),
      };
  }
}

export type TestRole = "ministry" | "federation" | "apex" | "cooperative";

const KEYCLOAK_BASE = "http://localhost:8180";
const KEYCLOAK_REALM = "coop-data";
const KEYCLOAK_CLIENT_ID = "coopdata-frontend";
const FRONTEND_URL = "http://localhost:5173"; // Must match registered redirect URI in Keycloak

/**
 * Login helper for full-stack E2E tests using real Keycloak authentication.
 *
 * Flow:
 * 1. Navigate directly to Keycloak auth URL
 * 2. Keycloak shows login form
 * 3. Fill in real email/password
 * 4. Submit form
 * 5. Keycloak redirects back to frontend with code
 * 6. Frontend exchanges code for token
 * 7. Redirects to dashboard
 */
export async function loginAs(page: Page, role: TestRole) {
  const credentials = getCredentials(role);

  // Build Keycloak auth URL - navigate directly to Keycloak
  const redirectUri = encodeURIComponent(`${FRONTEND_URL}/app/dashboard`);
  const keycloakAuthUrl = `${KEYCLOAK_BASE}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?client_id=${KEYCLOAK_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=openid profile email offline_access`;

  console.log(`[E2E] Navigating to Keycloak: ${keycloakAuthUrl}`);

  // Clear all browser storage to ensure clean session
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // Ignore errors
    }
  });

  // Navigate directly to Keycloak login page
  await page.goto(keycloakAuthUrl);

  // Wait for Keycloak login form to appear with retry logic
  try {
    await page.waitForSelector('input[name="username"]', { timeout: 30000 });
  } catch (error) {
    console.log(`[E2E] Login form not found, clearing storage and retrying...`);
    // Clear storage again and retry
    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // Ignore errors
      }
    });
    await page.goto(keycloakAuthUrl);
    await page.waitForSelector('input[name="username"]', { timeout: 30000 });
  }

  console.log(`[E2E] Filling credentials for: ${credentials.email}`);

  // Fill in Keycloak login form
  await page.fill('input[name="username"]', credentials.email);
  await page.fill('input[name="password"]', credentials.password);

  // Submit the form - Keycloak uses "Sign in" button
  await page.click('button:has-text("Sign in")');

  // Wait for redirect back to frontend dashboard
  await page.waitForURL(/\/app\/dashboard/, { timeout: 60000 });

  console.log(`[E2E] Successfully logged in as: ${credentials.email}`);

  // Wait for page to fully load
  await page.waitForLoadState("networkidle");
}
