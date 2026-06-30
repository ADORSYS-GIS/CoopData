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
import { getAccessToken, isKeycloakReady, isAuthenticated } from "@/services/shared/authService";

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
    if (response.status === 401) {
      // Only redirect if Keycloak is ready and user was authenticated
      // This prevents redirect loops during initialization
      if (isKeycloakReady() && isAuthenticated()) {
        console.warn("[apiClient] 401 response — redirecting to login");
        window.location.href = "/auth/login";
      }
    }
    return response;
  },
});

export type { paths };
