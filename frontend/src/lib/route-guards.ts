import { redirect } from "@tanstack/react-router";
import { isAuthenticated, hasAnyRole, getUserProfile, keycloakReady } from "@/services/shared/authService";
import type { Role } from "@/constants/roles";
import { ROLE_DEFAULT_ROUTE } from "@/constants/roles";

/**
 * Route guard for TanStack Router `beforeLoad`.
 *
 * Awaits `keycloakReady` before checking auth state. This is the key fix for
 * the flash-redirect bug: Keycloak initializes asynchronously at module load
 * time, and `keycloakReady` resolves once init is complete — ensuring guards
 * never evaluate auth state before it's known.
 */
export async function requireAuth() {
  await keycloakReady;

  if (!isAuthenticated()) {
    throw redirect({ to: "/auth/login" });
  }
}

export async function requireRole(...roles: Role[]) {
  console.log("[requireRole] Checking roles:", roles);

  await keycloakReady;

  if (!isAuthenticated()) {
    console.warn("[requireRole] Not authenticated, redirecting to login");
    throw redirect({ to: "/auth/login" });
  }

  if (!hasAnyRole(roles)) {
    console.warn("[requireRole] Access denied, redirecting to /unauthorized");
    throw redirect({ to: "/unauthorized" });
  }

  console.log("[requireRole] Access granted");
}

/**
 * Redirect authenticated users away from auth pages (e.g., login).
 * If already authenticated, redirect to the role-appropriate dashboard.
 */
export async function redirectIfAuthenticated() {
  await keycloakReady;

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
  "/app/invitations": ["ministry"],
  "/app/members": ["ministry"],
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
