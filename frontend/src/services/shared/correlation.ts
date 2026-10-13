/**
 * Carries a sync-queue item's correlation id onto its first (online) request.
 *
 * runMutation queues every write, then sends it straight away through the
 * hook's own request code (openapi client or raw fetch). That request must carry
 * the same `X-Correlation-Id` the outbox would use on a retry; otherwise a save
 * whose reply was lost is replayed under an id the server has never seen and is
 * applied twice. The hook code can't see the id, so runMutation registers the
 * expected request here and the request interceptors attach the header.
 */

interface ExpectedRequest {
  method: string;
  path: string;
  correlationId: string;
}

const expected: ExpectedRequest[] = [];

/** Substitutes `{name}` placeholders in an endpoint template with encoded values. */
export function resolveEndpoint(endpoint: string, pathParams?: Record<string, string>): string {
  let path = endpoint;
  for (const [key, value] of Object.entries(pathParams ?? {})) {
    path = path.replaceAll(`{${key}}`, encodeURIComponent(value));
  }
  return path;
}

/** Registers the request a mutation is about to send; returns the release function. */
export function expectRequest(method: string, path: string, correlationId: string): () => void {
  const entry = { method: method.toUpperCase(), path, correlationId };
  expected.push(entry);
  return () => {
    const index = expected.indexOf(entry);
    if (index !== -1) expected.splice(index, 1);
  };
}

/**
 * Returns (and consumes) the correlation id registered for this request.
 * When two in-flight mutations target the same method and path the match is
 * ambiguous, so no id is attached rather than risk swapping them.
 */
export function takeCorrelationId(method: string, url: string): string | undefined {
  let pathname: string;
  try {
    pathname = new URL(url, window.location.origin).pathname;
  } catch {
    return undefined;
  }
  const matches = expected.filter((e) => e.method === method.toUpperCase() && e.path === pathname);
  if (matches.length !== 1) return undefined;
  expected.splice(expected.indexOf(matches[0]), 1);
  return matches[0].correlationId;
}

/** Header name shared with the backend idempotency middleware. */
export const CORRELATION_HEADER = "X-Correlation-Id";

let installed = false;

/** Wraps `window.fetch` once so raw `fetch` writes carry their correlation id too. */
export function installCorrelationInterceptor(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));
    // Outbox retries already carry their own id: leave them (and the registry) alone.
    if (headers.has(CORRELATION_HEADER)) return original(input, init);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const url = input instanceof Request ? input.url : String(input);
    const correlationId = takeCorrelationId(method, url);
    if (!correlationId) return original(input, init);
    headers.set(CORRELATION_HEADER, correlationId);
    return original(input, { ...init, headers });
  };
}
