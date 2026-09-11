import type { Page } from "@playwright/test";

/**
 * Real user credentials for E2E testing.
 * These users authenticate via Keycloak with real credentials.
 */
export const TEST_USERS = {
  ministry: {
    email: "admin@ministry.gov",
    password: "password",
  },
  federation: {
    email: "yejami7300@ebflyai.com",
    password: "password",
  },
  apex: {
    email: "apex@gmail.com",
    password: "password",
  },
  cooperative: {
    email: "coopadmin@gmail.com",
    password: "password",
  },
} as const;

export type TestRole = keyof typeof TEST_USERS;

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
  const credentials = TEST_USERS[role];
  
  // Build Keycloak auth URL - navigate directly to Keycloak
  const redirectUri = encodeURIComponent(`${FRONTEND_URL}/app/dashboard`);
  const keycloakAuthUrl = `${KEYCLOAK_BASE}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?client_id=${KEYCLOAK_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=openid profile email offline_access`;
  
  console.log(`[E2E] Navigating to Keycloak: ${keycloakAuthUrl}`);
  
  // Navigate directly to Keycloak login page
  await page.goto(keycloakAuthUrl);
  
  // Wait for Keycloak login form to appear
  await page.waitForSelector('input[name="username"]', { timeout: 30000 });
  
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