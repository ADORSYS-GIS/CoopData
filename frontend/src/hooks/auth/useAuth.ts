/**
 * React Query hooks for auth-related API endpoints.
 *
 * /api/v1/me — current user profile (all authenticated roles).
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";

const AUTH_KEY = "auth";

/** Get current user profile from /api/v1/me */
export const useCurrentUser = () =>
  useQuery({
    queryKey: [AUTH_KEY, "me"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/me");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — profile doesn't change often
  });

/** Health check — useful for connectivity testing */
export const useHealthCheck = () =>
  useQuery({
    queryKey: [AUTH_KEY, "health"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/health");
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });