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
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export const apiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Auth interceptor — attaches Bearer token to every request
apiClient.use({
  async onRequest({ request }) {
    try {
      const token = await getAccessToken();
      request.headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // Not authenticated — let the request proceed without token
      // The server will return 401 if auth is required
    }
    return request;
  },
  onResponse({ response }) {
    // Do NOT redirect here — navigation is handled by route guards and components.
    // A hard window.location redirect bypasses the router and causes flash/redirect
    // bugs on pages that fire API calls immediately on mount.
    return response;
  },
});

export type { paths };
