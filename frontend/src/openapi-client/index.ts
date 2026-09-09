/**
 * OpenAPI client configuration for CoopData.
 *
 * Uses openapi-fetch with auth interceptor from authService.
 * All API calls should go through this client — never use raw fetch.
 *
 * Usage:
 *   import { apiClient } from "@/openapi-client";
 *   const { data, error } = await apiClient.GET("/api/v1/organizations");
 */

import createClient from "openapi-fetch";
import type { paths } from "./api";
import { getAccessToken } from "@/services/shared/authService";
import i18n from "i18next";
import { toast } from "sonner";

// Production: empty baseUrl means requests go to the same origin (nginx proxies /api to backend)
// Development: VITE_API_BASE_URL should be set to http://localhost:3000
//
// When running inside Docker (Gotenberg or frontend container), requests must go directly
// to the backend because Vite's dev proxy isn't available. The hostname check distinguishes
// Gotenberg's headless Chromium from the user's browser. This is a Docker networking
// constraint, not a 12-factor violation — both consumers share the same container.
const API_BASE_URL =
  window.location.hostname.includes("frontend") || window.location.hostname.includes("gotenberg")
    ? "http://backend:3000"
    : import.meta.env.VITE_API_BASE_URL || "";

export const apiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const RATE_LIMIT_TOAST_ID = "rate-limit-429";
let rateLimitTimer: number | null = null;

/**
 * Shows a persistent toast with a live countdown when the backend returns 429.
 * The countdown is driven by the `Retry-After` header (seconds).
 * Any previously running countdown is cancelled first so repeated 429s don't
 * spawn overlapping intervals.
 */
function showRateLimitToast(retryAfterSecs: number) {
  if (rateLimitTimer !== null) {
    window.clearInterval(rateLimitTimer);
    rateLimitTimer = null;
  }

  const total = Math.max(1, Math.floor(retryAfterSecs));
  let remaining = total;

  const render = () =>
    toast.warning(i18n.t("errors.rateLimited", { seconds: remaining }), {
      id: RATE_LIMIT_TOAST_ID,
      duration: Infinity,
    });

  render();
  rateLimitTimer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      window.clearInterval(rateLimitTimer!);
      rateLimitTimer = null;
      toast.dismiss(RATE_LIMIT_TOAST_ID);
    } else {
      render();
    }
  }, 1000);
}

apiClient.use({
  async onRequest({ request }) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryToken = urlParams.get("token");
      const token = queryToken || (await getAccessToken());
      request.headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // Not authenticated — let the request proceed without token
    }
    return request;
  },
  onResponse({ response }) {
    // Rate limited: surface a friendly countdown instead of a generic error.
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After")) || 60;
      showRateLimitToast(retryAfter);
    }
    // Only redirect to login on 401 if we're not already on an app page.
    // When the backend is misconfigured (wrong JWT issuer, etc.) it returns 401
    // even for authenticated users — we should NOT kick them out in that case.
    // Let the individual hooks/pages handle the error instead.
    if (response.status === 401) {
      const isAppRoute = window.location.pathname.startsWith("/app");
      const isPrintRoute = window.location.pathname.startsWith("/print");
      if (!isAppRoute && !isPrintRoute) {
        window.location.href = "/login";
      }
    }
    return response;
  },
});

export type { paths };
