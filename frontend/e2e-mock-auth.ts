import type { Plugin } from "vite";

export function e2eMockAuth(): Plugin {
  const enabled = process.env.VITE_E2E_MOCK_AUTH === "1";

  return {
    name: "e2e-mock-auth",
    enforce: "pre",
    resolveId(source, importer) {
      if (!enabled) return null;
      if (source === "keycloak-js") return "\0virtual:e2e-keycloak-mock";
      return null;
    },
    load(id) {
      if (!enabled) return null;
      if (id === "\0virtual:e2e-keycloak-mock") {
        return `
const mockInstance = {
  authenticated: false,
  token: undefined,
  refreshToken: undefined,
  idToken: undefined,
  tokenParsed: undefined,
  init: async function(opts) {
    const e2eAuth = (window).__E2E_AUTH__;
    if (e2eAuth) {
      this.authenticated = true;
      this.token = e2eAuth.token;
      this.refreshToken = e2eAuth.token;
      this.idToken = e2eAuth.token;
      this.tokenParsed = e2eAuth.tokenParsed;
    } else {
      this.authenticated = false;
    }
    return this.authenticated;
  },
  login: async function(opts) {
    if ((window).__E2E_AUTH__) {
      const redirectUri = opts?.redirectUri || window.location.origin + "/app/dashboard";
      window.location.href = redirectUri;
      return;
    }
    (window).__E2E_LOGIN_CALLED__ = true;
  },
  logout: async function(opts) {
    this.authenticated = false;
    const redirectUri = opts?.redirectUri || window.location.origin + "/";
    window.location.href = redirectUri;
  },
  updateToken: async function() { return false; },
  hasRealmRole: function(role) { return false; },
  hasResourceRole: function() { return false; },
  loadUserProfile: async function() { return {}; },
  isTokenExpired: function() { return false; },
  clearToken: function() { this.authenticated = false; },
};

export default function KeycloakMock(config) {
  const e2eAuth = (window).__E2E_AUTH__;
  if (e2eAuth) {
    mockInstance.authenticated = true;
    mockInstance.token = e2eAuth.token;
    mockInstance.refreshToken = e2eAuth.token;
    mockInstance.idToken = e2eAuth.token;
    mockInstance.tokenParsed = e2eAuth.tokenParsed;
  }
  return mockInstance;
}
`;
      }
      return null;
    },
    transform(code, id) {
      if (!enabled) return null;
      if (id.includes("authService") && id.endsWith(".ts")) {
        return code.replace(
          /export function waitForKeycloakReady[\s\S]*?^\}/m,
          `export function waitForKeycloakReady(timeoutMs = 8000) { return Promise.resolve(true); }`,
        );
      }
      return null;
    },
  };
}