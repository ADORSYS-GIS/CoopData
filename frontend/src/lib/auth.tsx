/**
 * Auth module — backward-compatible re-exports.
 *
 * NEW CODE should import directly from:
 *   - @/context/AuthContext (useAuth, useRole, useCanAccess)
 *   - @/constants/roles (ROLES, ROLE_NAV, etc.)
 *   - @/types/auth (UserProfile, Role, etc.)
 */

export {
  ROLES,
  ROLE_NAV,
  ROLE_NAV_ITEMS,
  ROLE_DASHBOARD,
  ROLE_USERS,
  type Role,
  type NavGroupId,
} from "@/constants/roles";

export { useAuth, useRole, useCanAccess, useUserRole } from "@/context/AuthContext";
