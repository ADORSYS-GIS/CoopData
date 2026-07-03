import { redirect } from "@tanstack/react-router";
import {
  isAuthenticated,
  waitForKeycloakReady,
  hasAnyRole,
  getUserProfile,
} from "@/services/shared/authService";
import type { Role } from "@/constants/roles";
import { ROLE_DEFAULT_ROUTE } from "@/constants/roles";

export async function requireAuth() {
  const ready = await waitForKeycloakReady();
  if (!ready) {
    console.warn("[guard] requireAuth: Keycloak init timed out, redirecting to login");
    throw redirect({ to: "/auth/login" });
  }

  if (!isAuthenticated()) {
    console.log("[guard] requireAuth: Not authenticated, redirecting to Keycloak login");
    throw redirect({ to: "/auth/login" });
  }

  const profile = getUserProfile();
  if (!profile) {
    console.warn(
      "[guard] requireAuth: Authenticated but no profile/role, redirecting to /unauthorized",
    );
    throw redirect({ to: "/unauthorized" });
  }

  console.log("[guard] requireAuth: OK, role =", profile.role);
}

export async function requireRole(...roles: Role[]) {
  const ready = await waitForKeycloakReady();
  if (!ready) {
    console.warn("[guard] requireRole: Keycloak init timed out, redirecting to login");
    throw redirect({ to: "/auth/login" });
  }

  if (!isAuthenticated()) {
    console.log("[guard] requireRole: Not authenticated, redirecting to Keycloak login");
    throw redirect({ to: "/auth/login" });
  }

  const profile = getUserProfile();
  if (!profile) {
    console.warn(
      "[guard] requireRole: Authenticated but no profile/role, redirecting to /unauthorized",
    );
    throw redirect({ to: "/unauthorized" });
  }

  if (!hasAnyRole(roles)) {
    console.warn(
      "[guard] requireRole: User role =",
      profile.role,
      "needs one of",
      roles,
      "→ redirecting to /unauthorized",
    );
    throw redirect({ to: "/unauthorized" });
  }

  console.log("[guard] requireRole: OK, role =", profile.role, "required =", roles);
}

export async function redirectIfAuthenticated() {
  const ready = await waitForKeycloakReady();
  if (!ready) {
    console.warn("[guard] redirectIfAuthenticated: Keycloak init timed out, allowing render");
    return;
  }

  if (isAuthenticated()) {
    const profile = getUserProfile();
    if (!profile) {
      console.warn(
        "[guard] redirectIfAuthenticated: Authenticated but no profile, redirecting to /unauthorized",
      );
      throw redirect({ to: "/unauthorized" });
    }
    const redirectPath = ROLE_DEFAULT_ROUTE[profile.role];
    console.log(
      "[guard] redirectIfAuthenticated: Already authenticated as",
      profile.role,
      "→ redirecting to",
      redirectPath,
    );
    throw redirect({ to: redirectPath });
  }

  console.log("[guard] redirectIfAuthenticated: Not authenticated, showing login redirect");
}

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
