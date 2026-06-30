import { redirect } from "@tanstack/react-router";
import {
  isAuthenticated,
  isKeycloakReady,
  hasAnyRole,
  getUserProfile,
} from "@/services/shared/authService";
import type { Role } from "@/constants/roles";
import { ROLE_DEFAULT_ROUTE } from "@/constants/roles";

/**
 * Route guard for TanStack Router `beforeLoad`.
 *
 * Checks authentication and role-based access before a route loads.
 * - If Keycloak is not ready yet, returns without redirecting
 *   (the component layer handles the loading state).
 * - If not authenticated, redirects to /auth/login.
 * - If authenticated but lacks the required role, redirects to /unauthorized.
 * - If authenticated and authorized, returns normally.
 */
export function requireAuth() {
  if (!isKeycloakReady()) {
    // Keycloak still initializing — let the component layer handle it
    return;
  }

  if (!isAuthenticated()) {
    throw redirect({ to: "/auth/login" });
  }
}

export function requireRole(...roles: Role[]) {
  if (!isKeycloakReady()) {
    return;
  }

  if (!isAuthenticated()) {
    throw redirect({ to: "/auth/login" });
  }

  if (!hasAnyRole(roles)) {
    throw redirect({ to: "/unauthorized" });
  }
}

/**
 * Redirect authenticated users away from auth pages (e.g., login).
 * If already authenticated, redirect to the role-appropriate dashboard.
 */
export function redirectIfAuthenticated() {
  if (!isKeycloakReady()) {
    return;
  }

  if (isAuthenticated()) {
    const profile = getUserProfile();
    const role: Role = profile?.role ?? "ministry";
    const redirectPath = ROLE_DEFAULT_ROUTE[role];
    throw redirect({ to: redirectPath });
  }
}

/** Role access map: route path → allowed roles */
export const ROUTE_ACCESS: Record<string, Role[]> = {
  "/app/dashboard": ["ministry", "federation", "apex", "cooperative"],
  "/app/federations": ["ministry"],
  "/app/apexes": ["federation"],
  "/app/cooperatives": ["apex"],
  "/app/data-collection": ["cooperative"],
  "/app/submissions": ["ministry", "federation", "apex", "cooperative"],
  "/app/reports": ["ministry", "federation", "apex", "cooperative"],
  "/app/analytics": ["ministry", "federation", "apex", "cooperative"],
  "/app/users": ["ministry", "federation", "apex"],
  "/app/settings": ["ministry"],
  "/app/profile": ["ministry", "federation", "apex", "cooperative"],
  "/app/financial-statement": ["cooperative"],
  "/app/non-financial-data": ["cooperative"],
};
