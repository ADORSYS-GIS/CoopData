/**
 * k6 Load Test — Keycloak Authentication Helper
 *
 * Fetches a JWT access token using the client_credentials grant type.
 * Tokens are pre-fetched in setup() and shared across all VUs via SharedArray.
 *
 * Keycloak client: coopdata-backend (serviceAccountsEnabled: true)
 * Service account: service-account-coopdata-backend (bypasses all RBAC)
 */

import http from 'k6/http';
import { Trend, Counter } from 'k6/metrics';
import { config } from './config.js';

export const tokenDuration = new Trend('keycloak_token_duration', true);
export const tokenErrors = new Counter('keycloak_token_errors');

/**
 * Fetch a client_credentials access token from Keycloak.
 * Call this in setup() — NOT in the default function.
 *
 * @returns {string} The access_token JWT string
 */
export function fetchToken() {
  const url = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`;

  const payload = `grant_type=client_credentials&client_id=${config.clientId}&client_secret=${config.clientSecret}`;

  const params = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  const res = http.post(url, payload, params);

  tokenDuration.add(res.timings.duration);

  if (res.status !== 200) {
    tokenErrors.add(1);
    throw new Error(
      `Keycloak token fetch failed: status=${res.status} body=${res.body}`
    );
  }

  const body = JSON.parse(res.body);
  return body.access_token;
}
