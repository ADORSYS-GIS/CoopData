import Keycloak from "keycloak-js";

const getFallbackKeycloakUrl = () => {
  if (typeof window !== "undefined") {
    const isProd = import.meta.env.PROD;
    if (isProd) {
      return `${window.location.origin}/auth`;
    }
  }
  return "http://localhost:8180";
};

const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL || getFallbackKeycloakUrl();
const keycloakRealm = import.meta.env.VITE_KEYCLOAK_REALM || "coop-data";
const keycloakClientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "coopdata-frontend";

export const keycloak = new Keycloak({
  url: keycloakUrl,
  realm: keycloakRealm,
  clientId: keycloakClientId,
});

export const KEYCLOAK_CONFIG = {
  url: keycloakUrl,
  realm: keycloakRealm,
  clientId: keycloakClientId,
} as const;
