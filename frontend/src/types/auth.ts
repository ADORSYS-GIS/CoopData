import type { Role, NavGroupId } from "@/constants/roles";

export type { Role, NavGroupId };

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  initials: string;
  role: Role;
  /** Computed region label from organization/cooperation */
  region: string;
  organizationId: string | null;
  organizationName: string | null;
  cooperationId: string | null;
  cooperationName: string | null;
  assignedDimensions: string[];
  realmRoles: string[];
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  role: Role | null;
  accessToken: string | null;
}

export interface AuthContextValue extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;
  getAccessToken: () => Promise<string>;
}

/** Keycloak token claims we care about */
export interface CustomKeycloakToken {
  sub: string;
  email?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  realm_access?: {
    roles: string[];
  };
  organization?: Record<string, { id: string }>;
  organization_id?: string;
  /** Array of group paths, e.g. ["/apex-group-uuid/cooperative-subgroup-uuid"] */
  cooperation?: string[];
  cooperation_id?: string;
  assigned_dimensions?: string[];
  is_member_of?: string[];
}

export interface PendingInvitation {
  id: string;
  organizationName: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
}
