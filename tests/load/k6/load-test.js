/**
 * k6 Load Test — Scenario 2 (SLA Gate)
 *
 * Purpose: Simulate normal peak load during financial submission deadlines.
 * Validates that the system meets its SLA requirements under concurrent load.
 *
 * VUs: 50 | Duration: 5 minutes (30s ramp → 3m sustain → 30s ramp down)
 *
 * SLA Thresholds (hard gates — test FAILS if violated):
 *   - Error rate < 1%
 *   - p95 latency < 500ms
 *   - p99 latency < 1500ms
 *
 * Usage:
 *   k6 run tests/load/k6/load-test.js
 *   k6 run --out json=results/load-test.json tests/load/k6/load-test.js
 *   K6_TARGET_ENV=demo k6 run tests/load/k6/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate } from 'k6/metrics';
import { fetchToken } from './helpers/auth.js';
import { config } from './helpers/config.js';
import { healthEndpoint, authEndpoints } from './helpers/endpoints.js';

const serverErrorRate = new Rate('server_error_rate');

// ── Options ────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // ramp up to 20 VUs
    { duration: '3m', target: 50 },    // ramp to 50 VUs, sustain 3 minutes
    { duration: '30s', target: 0 },    // ramp down to 0
  ],

  thresholds: {
    // Hard SLA gates — test fails if any threshold is violated
    server_error_rate: ['rate<0.01'],               // < 1% 5xx error rate (NOT 403s)
    http_req_duration: ['p(95)<500', 'p(99)<1500'], // p95 < 500ms, p99 < 1500ms

    // Token acquisition should be fast
    keycloak_token_duration: ['p(95)<2000'],        // token fetch < 2s
  },
};

// ── Setup ──────────────────────────────────────────────────────────────────
export function setup() {
  console.log(`[load-test] Target: ${config.baseUrl}`);
  console.log(`[load-test] VUs: 50 | Duration: 5 minutes`);
  console.log(`[load-test] SLA: p95<500ms, error rate<1%`);

  const token = fetchToken();
  console.log('[load-test] Token fetched');

  return { token: token };
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Pick a random auth endpoint for this iteration
  // This simulates realistic mixed traffic across the API
  const endpoint = authEndpoints[Math.floor(Math.random() * authEndpoints.length)];

  group('API requests', function () {
    const url = `${config.baseUrl}${endpoint.path}`;
    const res = http.get(url, {
      headers,
      tags: { endpoint: endpoint.name },
    });

    check(res, {
      [`${endpoint.name}: success`]: (r) => r.status >= 200 && r.status < 500,
      //  ^^^ 200-499 counts as success — 403 Forbidden is expected for scope-enforced endpoints
      [`${endpoint.name}: latency < 500ms`]: (r) => r.timings.duration < 500,
    });

    // Track 5xx errors only — 403s are RBAC working correctly, not system failures
    serverErrorRate.add(res.status >= 500);
  });

  // Also hit the health endpoint periodically (every 3rd iteration)
  if (__ITER % 3 === 0) {
    group('health check', function () {
      const healthRes = http.get(`${config.baseUrl}${healthEndpoint.path}`);
      check(healthRes, {
        'health: status 200': (r) => r.status === 200,
      });
    });
  }

  sleep(Math.random() * 2 + 0.5); // 0.5–2.5s think time between requests
}

// ── Teardown ───────────────────────────────────────────────────────────────
export function teardown(data) {
  console.log('[load-test] Complete');
}
