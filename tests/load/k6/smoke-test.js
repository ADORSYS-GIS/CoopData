/**
 * k6 Smoke Test — Scenario 1
 *
 * Purpose: Quick sanity check — verify all endpoints are alive and returning
 * valid responses before running heavier load/stress tests.
 *
 * VUs: 5 | Duration: 1 minute
 *
 * Usage:
 *   k6 run tests/load/k6/smoke-test.js
 *   K6_TARGET_ENV=demo k6 run tests/load/k6/smoke-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { fetchToken } from './helpers/auth.js';
import { config } from './helpers/config.js';
import { healthEndpoint, authEndpoints } from './helpers/endpoints.js';

export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate<0.05'],       // < 5% error rate for smoke
    http_req_duration: ['p(95)<2000'],     // relaxed: just verify endpoints are up
  },
};

/**
 * setup() runs ONCE before the test starts.
 * Pre-fetches the Keycloak token — all VUs share it.
 */
export function setup() {
  console.log(`[smoke-test] Target: ${config.baseUrl}`);
  console.log(`[smoke-test] Keycloak: ${config.keycloakUrl}`);

  const token = fetchToken();
  console.log('[smoke-test] Token fetched successfully');

  return { token: token };
}

/**
 * default() runs ONCE per VU per iteration.
 * Each VU hits every endpoint once per iteration.
 */
export default function (data) {
  // 1. Health check — no auth required
  const healthRes = http.get(`${config.baseUrl}${healthEndpoint.path}`);
  check(healthRes, {
    'health: status 200': (r) => r.status === 200,
    'health: response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  // 2. Authenticated endpoints — service account token
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  for (const ep of authEndpoints) {
    const url = `${config.baseUrl}${ep.path}`;
    const res = http.get(url, { headers, tags: { endpoint: ep.name } });

    check(res, {
      [`${ep.name}: status 2xx or 4xx`]: (r) => r.status >= 200 && r.status < 500,
      [`${ep.name}: response time < 2000ms`]: (r) => r.timings.duration < 2000,
    });
  }

  sleep(1); // Brief pause between iterations
}

/**
 * teardown() runs ONCE after the test finishes.
 */
export function teardown(data) {
  console.log('[smoke-test] Complete');
}
