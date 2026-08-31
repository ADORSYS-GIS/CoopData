/**
 * k6 Load Test — Environment Configuration
 *
 * Usage:
 *   k6 run tests/load/k6/load-test.js                           # defaults to localhost
 *   K6_TARGET_ENV=production k6 run tests/load/k6/load-test.js  # EC2 production
 *
 * Production environment requires env vars (set in .env):
 *   K6_BASE_URL       - Backend URL (e.g., https://ec2-xx-xx-xx-xx.compute.amazonaws.com)
 *   K6_KEYCLOAK_URL   - Keycloak URL (same domain, Keycloak is at root path)
 *   K6_CLIENT_SECRET  - Production Keycloak client secret for coopdata-backend
 */

const environments = {
  localhost: {
    baseUrl: 'http://localhost:3000',
    keycloakUrl: 'http://localhost:8180',
    realm: 'coop-data',
    clientId: 'coopdata-backend',
    clientSecret: __ENV.K6_CLIENT_SECRET || '',
  },
  production: {
    baseUrl: __ENV.K6_BASE_URL || '',
    keycloakUrl: __ENV.K6_KEYCLOAK_URL || '',
    realm: __ENV.K6_REALM || 'coop-data',
    clientId: __ENV.K6_CLIENT_ID || 'coopdata-backend',
    clientSecret: __ENV.K6_CLIENT_SECRET || '',
  },
};

const envName = __ENV.K6_TARGET_ENV || 'localhost';

if (!environments[envName]) {
  throw new Error(
    `Unknown environment "${envName}". Valid options: ${Object.keys(environments).join(', ')}`
  );
}

export const config = environments[envName];
