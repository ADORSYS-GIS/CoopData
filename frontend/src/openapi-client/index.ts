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

// Production: empty baseUrl means requests go to the same origin (nginx proxies /api to backend)
// Development: VITE_API_BASE_URL should be set to http://localhost:3000
let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// If we are executing inside the Gotenberg headless chrome container, localhost points to gotenberg!
// We must route API calls directly to the backend container.
if (window.location.hostname.includes("frontend") || window.location.hostname.includes("gotenberg")) {
  API_BASE_URL = "http://backend:3000";
}

export const apiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.use({
  async onRequest({ request }) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryToken = urlParams.get("token");
      const token = queryToken || await getAccessToken();
      request.headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // Not authenticated — let the request proceed without token
    }
    return request;
  },
  onResponse({ response }) {
    // Only redirect to login on 401 if we're not already on an app page.
    // When the backend is misconfigured (wrong JWT issuer, etc.) it returns 401
    // even for authenticated users — we should NOT kick them out in that case.
    // Let the individual hooks/pages handle the error instead.
    if (response.status === 401) {
      const isAppRoute = window.location.pathname.startsWith("/app");
      const isPrintRoute = window.location.pathname.startsWith("/print");
      if (!isAppRoute && !isPrintRoute) {
        window.location.href = "/auth/login";
      }
    }
    return response;
  },
});

export type { paths };
