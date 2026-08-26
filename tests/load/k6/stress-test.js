/**
 * k6 Stress / Spike Test — Scenario 3
 *
 * Purpose: Find the system's breaking point. Ramp from 0 to 300 VUs in 3 minutes.
 * This test is EXPLORATORY — no SLA thresholds. We observe what happens when the
 * system is overloaded: error rates, latency degradation, cgroup limits, auto-heal.
 *
 * VUs: 0 → 300 | Duration: 3 minutes
 *
 * What to watch for during this test:
 *   - Latency spike at what VU count?
 *   - Error rate climb starting at what VU count?
 *   - Container CPU/RAM hitting cgroup limits?
 *   - Auto-healing kicking in after container restart?
 *   - Graceful degradation (429/503) vs crash (connection refused)?
 *
 * Usage:
 *   k6 run tests/load/k6/stress-test.js
 *   k6 run --out json=results/stress-test.json tests/load/k6/stress-test.js
 *   K6_TARGET_ENV=demo k6 run tests/load/k6/stress-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { fetchToken } from './helpers/auth.js';
import { config } from './helpers/config.js';
import { healthEndpoint, authEndpoints } from './helpers/endpoints.js';

// ── Options ────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 50 },    // Phase 1: ramp to normal load
    { duration: '30s', target: 100 },   // Phase 2: ramp to heavy load
    { duration: '30s', target: 200 },   // Phase 3: ramp to stress
    { duration: '30s', target: 300 },   // Phase 4: spike to breaking point
    { duration: '30s', target: 300 },   // Phase 5: sustain at peak
    { duration: '30s', target: 0 },     // Phase 6: cool down
  ],

  // NO thresholds — this is exploratory. We want to observe failure modes,
  // not enforce SLAs. The value is in the metrics, not pass/fail.
  thresholds: {},
};

// ── Setup ──────────────────────────────────────────────────────────────────
export function setup() {
  console.log(`[stress-test] Target: ${config.baseUrl}`);
  console.log(`[stress-test] Spike: 0 → 300 VUs over 3 minutes`);
  console.log(`[stress-test] NO SLA thresholds — this is exploratory`);

  const token = fetchToken();
  console.log('[stress-test] Token fetched');

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

  group('stress request', function () {
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

  sleep(Math.random() * 1.5 + 0.2); // 0.2–1.7s think time (faster than load test)
}

// ── Teardown ───────────────────────────────────────────────────────────────
export function teardown(data) {
  console.log('[stress-test] Complete — review metrics above for breaking point');
}
