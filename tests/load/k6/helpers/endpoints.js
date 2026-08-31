/**
 * k6 Load Test — API Endpoint Catalog
 *
 * Complete list of CoopData API endpoints for load testing.
 * Each entry defines: name, method, path, and whether it requires auth.
 *
 * The service-account-coopdata-backend bypasses all RBAC checks,
 * so a single token can hit every endpoint.
 */

/**
 * @typedef {Object} Endpoint
 * @property {string} name       - Human-readable name for k6 check labels
 * @property {string} method     - HTTP method (GET, POST, PATCH, DELETE)
 * @property {string} path       - API path (relative to baseUrl)
 * @property {boolean} auth     - Whether this endpoint requires a JWT token
 * @property {string} [body]     - JSON body for POST/PATCH requests
 */

/** Health check — public, no auth */
export const healthEndpoint = {
  name: 'GET /health',
  method: 'GET',
  path: '/api/v1/health',
  auth: false,
};

/**
 * Endpoints requiring authentication.
 * The service account can hit all of these.
 */
export const authEndpoints = [
  // ── Shared ───────────────────────────────────────────────────
  {
    name: 'GET /me',
    method: 'GET',
    path: '/api/v1/me',
    auth: true,
  },

  // ── Ministry ─────────────────────────────────────────────────
  {
    name: 'GET /ministry/federations',
    method: 'GET',
    path: '/api/v1/ministry/federations',
    auth: true,
  },
  {
    name: 'GET /ministry/organizations',
    method: 'GET',
    path: '/api/v1/ministry/organizations',
    auth: true,
  },
  {
    name: 'GET /ministry/users',
    method: 'GET',
    path: '/api/v1/ministry/users',
    auth: true,
  },
  {
    name: 'GET /ministry/audit-logs',
    method: 'GET',
    path: '/api/v1/ministry/audit-logs',
    auth: true,
  },
  {
    name: 'GET /ministry/submissions',
    method: 'GET',
    path: '/api/v1/ministry/submissions',
    auth: true,
  },
  {
    name: 'GET /ministry/stats',
    method: 'GET',
    path: '/api/v1/ministry/stats',
    auth: true,
  },
  {
    name: 'GET /ministry/non-financial-indicators/catalog',
    method: 'GET',
    path: '/api/v1/ministry/non-financial-indicators/catalog',
    auth: true,
  },
  {
    name: 'GET /ministry/apexes',
    method: 'GET',
    path: '/api/v1/ministry/apexes',
    auth: true,
  },

  // ── Federation ───────────────────────────────────────────────
  {
    name: 'GET /federation/apexes',
    method: 'GET',
    path: '/api/v1/federation/apexes',
    auth: true,
  },
  {
    name: 'GET /federation/profile',
    method: 'GET',
    path: '/api/v1/federation/profile',
    auth: true,
  },
  {
    name: 'GET /federation/stats',
    method: 'GET',
    path: '/api/v1/federation/stats',
    auth: true,
  },
  {
    name: 'GET /federation/submissions',
    method: 'GET',
    path: '/api/v1/federation/submissions',
    auth: true,
  },

  // ── Apex ─────────────────────────────────────────────────────
  {
    name: 'GET /apex/cooperatives',
    method: 'GET',
    path: '/api/v1/apex/cooperatives',
    auth: true,
  },
  {
    name: 'GET /apex/profile',
    method: 'GET',
    path: '/api/v1/apex/profile',
    auth: true,
  },
  {
    name: 'GET /apex/stats',
    method: 'GET',
    path: '/api/v1/apex/stats',
    auth: true,
  },
  {
    name: 'GET /apex/submissions',
    method: 'GET',
    path: '/api/v1/apex/submissions',
    auth: true,
  },

  // ── Cooperative ──────────────────────────────────────────────
  {
    name: 'GET /cooperative/profile',
    method: 'GET',
    path: '/api/v1/cooperative/profile',
    auth: true,
  },
  {
    name: 'GET /cooperative/submissions',
    method: 'GET',
    path: '/api/v1/cooperative/submissions',
    auth: true,
  },
  {
    name: 'GET /cooperative/stats',
    method: 'GET',
    path: '/api/v1/cooperative/stats',
    auth: true,
  },
  {
    name: 'GET /cooperative/members',
    method: 'GET',
    path: '/api/v1/cooperative/members',
    auth: true,
  },
  {
    name: 'GET /cooperative/dimensions',
    method: 'GET',
    path: '/api/v1/cooperative/dimensions',
    auth: true,
  },

  // ── Analytics (shared routes) ────────────────────────────────
  {
    name: 'GET /analytics/monthly-trend',
    method: 'GET',
    path: '/api/v1/analytics/monthly-trend',
    auth: true,
  },
  {
    name: 'GET /analytics/region-compliance',
    method: 'GET',
    path: '/api/v1/analytics/region-compliance',
    auth: true,
  },
  {
    name: 'GET /analytics/sector-breakdown',
    method: 'GET',
    path: '/api/v1/analytics/sector-breakdown',
    auth: true,
  },
  {
    name: 'GET /analytics/national-overview',
    method: 'GET',
    path: '/api/v1/analytics/national-overview',
    auth: true,
  },
  {
    name: 'GET /analytics/benchmark',
    method: 'GET',
    path: '/api/v1/analytics/benchmark',
    auth: true,
  },
  {
    name: 'GET /analytics/basic-benchmark',
    method: 'GET',
    path: '/api/v1/analytics/basic-benchmark',
    auth: true,
  },
  {
    name: 'GET /analytics/questionnaire',
    method: 'GET',
    path: '/api/v1/analytics/questionnaire',
    auth: true,
  },
  {
    name: 'GET /analytics/submission-activity',
    method: 'GET',
    path: '/api/v1/analytics/submission-activity',
    auth: true,
  },
  {
    name: 'GET /analytics/comparative-statements',
    method: 'GET',
    path: '/api/v1/analytics/comparative-statements',
    auth: true,
  },
  {
    name: 'GET /analytics/nf-trend',
    method: 'GET',
    path: '/api/v1/analytics/nf-trend',
    auth: true,
  },
  {
    name: 'GET /analytics/consolidated-nf-statistics',
    method: 'GET',
    path: '/api/v1/analytics/consolidated-nf-statistics',
    auth: true,
  },
  {
    name: 'GET /benchmarks',
    method: 'GET',
    path: '/api/v1/benchmarks',
    auth: true,
  },
  {
    name: 'GET /non-financial-indicators/catalog',
    method: 'GET',
    path: '/api/v1/non-financial-indicators/catalog',
    auth: true,
  },
];

/**
 * All endpoints combined (health + auth).
 */
export const allEndpoints = [healthEndpoint, ...authEndpoints];
