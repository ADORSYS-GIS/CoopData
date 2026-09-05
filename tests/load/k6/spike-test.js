/**
 * k6 Spike Test — Scenario 4
 *
 * Purpose: Simulate sudden traffic burst (e.g., batch notification sent,
 * deadline reminder email, everyone opens the app at once).
 * Tests auto-scaling, recovery time, and connection pool resilience.
 *
 * VUs: 50 → 500 (instant) → 500 (sustain) → 50 (recovery)
 * Duration: 4 minutes
 *
 * What to watch for:
 *   - How fast does latency recover after the spike ends?
 *   - Does the connection pool recover or stay exhausted?
 *   - Does memory usage return to baseline?
 *   - Are there any 500 errors during the spike?
 *   - How long until p95 latency returns to normal?
 *
 * Usage:
 *   k6 run tests/load/k6/spike-test.js
 *   k6 run --out json=results/spike-test.json tests/load/k6/spike-test.js
 *   K6_TARGET_ENV=demo k6 run tests/load/k6/spike-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { fetchToken } from './helpers/auth.js';
import { config } from './helpers/config.js';
import { healthEndpoint, authEndpoints } from './helpers/endpoints.js';

// ── Options ────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 50 },    // Phase 1: normal load
    { duration: '1s',  target: 500 },   // Phase 2: SPIKE — instant jump to 500
    { duration: '2m',  target: 500 },   // Phase 3: sustain spike for 2 minutes
    { duration: '1s',  target: 50 },    // Phase 4: DROP — instant back to normal
    { duration: '1m',  target: 50 },    // Phase 5: observe recovery
  ],

  // Relaxed thresholds — spike will cause latency spikes, that's expected
  // We're measuring RECOVERY, not enforcing strict SLAs during the spike
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // relaxed: 1s during spike is ok
    http_req_failed: ['rate<0.05'],     // < 5% errors allowed during spike
  },
};

// ── Setup ──────────────────────────────────────────────────────────────────
export function setup() {
  console.log(`[spike-test] Target: ${config.baseUrl}`);
  console.log(`[spike-test] Spike: 50 → 500 VUs (instant)`);
  console.log(`[spike-test] Sustain: 2 minutes at 500 VUs`);
  console.log(`[spike-test] Recovery: 1 minute at 50 VUs`);

  const token = fetchToken();
  console.log('[spike-test] Token fetched');

  return { token: token };
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Pick a random endpoint — mixed traffic
  const endpoint = authEndpoints[Math.floor(Math.random() * authEndpoints.length)];

  group('spike request', function () {
    const url = `${config.baseUrl}${endpoint.path}`;
    const res = http.get(url, {
      headers,
      tags: { endpoint: endpoint.name },
    });

    check(res, {
      'status is not 500': (r) => r.status !== 500,
      'status is not 0': (r) => r.status !== 0,  // connection refused
      'latency < 5000ms': (r) => r.timings.duration < 5000,
    });
  });

  // Also hit health endpoint periodically (every 5th iteration)
  if (__ITER % 5 === 0) {
    group('health check', function () {
      const healthRes = http.get(`${config.baseUrl}${healthEndpoint.path}`);
      check(healthRes, {
        'health: status 200': (r) => r.status === 200,
      });
    });
  }

  sleep(Math.random() * 1 + 0.2); // 0.2–1.2s think time (fast during spike)
}

// ── Teardown ───────────────────────────────────────────────────────────────
export function teardown(data) {
  console.log('[spike-test] Complete — check recovery time in metrics above');
}
