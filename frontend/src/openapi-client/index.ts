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

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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
      // Token expired or invalid — redirect to login
      // Use window.location to avoid circular imports
      window.location.href = "/auth/login";
    }
    return response;
  },
});

export type { paths };
