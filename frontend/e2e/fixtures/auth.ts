import type { Page, Route } from "@playwright/test";

export type TestRole = "ministry" | "federation" | "apex" | "cooperative";

interface TestUser {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  realmRoles: string[];
  organization?: Record<string, { id: string }>;
  cooperation?: string[];
  organization_id?: string;
  cooperation_id?: string;
}

export const TEST_USERS: Record<TestRole, TestUser> = {
  ministry: {
    email: "ministry@test.coopdata",
    name: "Ministry Officer",
    firstName: "Ministry",
    lastName: "Officer",
    realmRoles: ["ministry"],
  },
  federation: {
    email: "federation@test.coopdata",
    name: "Federation Officer",
    firstName: "Federation",
    lastName: "Officer",
    realmRoles: ["federation"],
    organization: { "Test Federation": { id: "fed-123" } },
    organization_id: "fed-123",
  },
  apex: {
    email: "apex@test.coopdata",
    name: "Apex Officer",
    firstName: "Apex",
    lastName: "Officer",
    realmRoles: ["regional_officer"],
    cooperation: ["/apex-456/coop-789"],
    cooperation_id: "coop-789",
  },
  cooperative: {
    email: "cooperative@test.coopdata",
    name: "Cooperative Manager",
    firstName: "Cooperative",
    lastName: "Manager",
    realmRoles: ["default-roles-coop-data"],
    cooperation: ["/apex-456/coop-789"],
    cooperation_id: "coop-789",
  },
};

const KEYCLOAK_BASE = "http://localhost:8180";

function base64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function createFakeJWT(user: TestUser): string {
  const header = base64url({ alg: "none", typ: "JWT", kid: "test-kid" });
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: `user-${user.email}`,
    email: user.email,
    name: user.name,
    given_name: user.firstName,
    family_name: user.lastName,
    preferred_username: user.email,
    realm_access: { roles: user.realmRoles },
    organization: user.organization,
    cooperation: user.cooperation,
    organization_id: user.organization_id,
    cooperation_id: user.cooperation_id,
    assigned_dimensions: [] as string[],
    is_member_of: [] as string[],
    iss: `${KEYCLOAK_BASE}/realms/coop-data`,
    aud: "coopdata-frontend",
    exp: now + 86400,
    iat: now,
    jti: `test-jti-${Date.now()}`,
    session_state: "test-session",
  };
  const body = base64url(payload);
  return `${header}.${body}.`;
}

export function getTestToken(role: TestRole): string {
  return createFakeJWT(TEST_USERS[role]);
}

async function mockKeycloakRoute(
  route: Route,
  user: TestUser,
  token: string,
  silentSsoSuccess: boolean,
) {
  const url = route.request().url();
  const method = route.request().method();

  if (url.includes("/protocol/openid-connect/auth")) {
    const parsedUrl = new URL(url);
    const redirectUri =
      parsedUrl.searchParams.get("redirect_uri") || "http://localhost:5173/app/dashboard";
    const state = parsedUrl.searchParams.get("state") || "test-state";
    const isSilent = redirectUri.includes("silent-check-sso.html");

    if (isSilent && !silentSsoSuccess) {
      const callbackUrl = `${redirectUri}?error=login_required&state=${state}`;
      await route.fulfill({
        status: 302,
        headers: { Location: callbackUrl },
      });
      return;
    }

    const callbackUrl = `${redirectUri}?code=test-code-${Date.now()}&state=${state}`;
    await route.fulfill({
      status: 302,
      headers: { Location: callbackUrl },
    });
    return;
  }

  if (url.includes("/protocol/openid-connect/token") && method === "POST") {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: token,
        refresh_token: token,
        id_token: token,
        token_type: "Bearer",
        expires_in: 86400,
        refresh_expires_in: 86400,
        session_state: "test-session",
      }),
    });
    return;
  }

  if (url.includes("/protocol/openid-connect/userinfo")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sub: `user-${user.email}`,
        email: user.email,
        name: user.name,
        given_name: user.firstName,
        family_name: user.lastName,
        preferred_username: user.email,
        realm_access: { roles: user.realmRoles },
      }),
    });
    return;
  }

  if (url.includes("/protocol/openid-connect/logout")) {
    await route.fulfill({ status: 204 });
    return;
  }

  if (url.includes("login-status-iframe.html") || url.includes("3p-cookies")) {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body></body></html>",
    });
    return;
  }

  if (url.includes("/realms/coop-data/")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ realm: "coop-data" }),
    });
    return;
  }

  await route.continue();
}

export async function mockKeycloak(page: Page, role: TestRole) {
  const user = TEST_USERS[role];
  const token = createFakeJWT(user);

  await page.route(`${KEYCLOAK_BASE}/**`, async (route) => {
    await mockKeycloakRoute(route, user, token, false);
  });
}

export async function mockKeycloakAuthenticated(page: Page, role: TestRole) {
  const user = TEST_USERS[role];
  const token = createFakeJWT(user);

  await page.route(`${KEYCLOAK_BASE}/**`, async (route) => {
    await mockKeycloakRoute(route, user, token, true);
  });

  await page.addInitScript(
    ({ token, user }) => {
      const tokenParts = token.split(".");
      const payload = JSON.parse(atob(tokenParts[1]));

      (window as unknown as Record<string, unknown>).__E2E_AUTH__ = {
        token,
        tokenParsed: payload,
        user,
      };
    },
    { token, user },
  );
}

export async function mockBackendApi(page: Page) {
  await page.route("http://localhost:3000/api/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/api/v1/health")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
      return;
    }

    if (url.includes("/api/v1/me") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "test-user", email: "test@test.com", name: "Test User" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
}
