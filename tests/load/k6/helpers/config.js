/**
 * k6 Load Test — Environment Configuration
 *
 * Usage:
 *   k6 run tests/load/k6/load-test.js                        # defaults to localhost
 *   K6_TARGET_ENV=demo k6 run tests/load/k6/load-test.js     # demo environment
 */

const environments = {
  localhost: {
    baseUrl: 'http://localhost:3000',
    keycloakUrl: 'http://localhost:8180',
    realm: 'coop-data',
    clientId: 'coopdata-backend',
    clientSecret: __ENV.K6_CLIENT_SECRET || 'bXEH0vTeuidB52EeJ2QixCKFumD9gZ1y',
  },
  demo: {
    baseUrl: __ENV.K6_BASE_URL || 'https://demo.coopdata.dgrvcoop360.com',
    keycloakUrl: __ENV.K6_KEYCLOAK_URL || 'https://keycloak.demo.coopdata.dgrvcoop360.com',
    realm: __ENV.K6_REALM || 'coop-data',
    clientId: __ENV.K6_CLIENT_ID || 'coopdata-backend',
    clientSecret: __ENV.K6_CLIENT_SECRET || '',
  },
  production: {
    baseUrl: __ENV.K6_BASE_URL || 'https://coopdata.dgrvcoop360.com',
    keycloakUrl: __ENV.K6_KEYCLOAK_URL || 'https://keycloak.coopdata.dgrvcoop360.com',
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
