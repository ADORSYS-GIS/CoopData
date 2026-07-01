export type Role = "ministry" | "federation" | "apex" | "cooperative";

export type NavGroupId = "oversight" | "intelligence" | "system";

export interface RoleDefinition {
  id: Role;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}

export const ROLES: RoleDefinition[] = [
  {
    id: "ministry",
    label: "Ministry Official",
    shortLabel: "Ministry",
    description:
      "National oversight — view all cooperatives, generate national reports, monitor compliance, manage users",
    icon: "Landmark",
  },
  {
    id: "federation",
    label: "Federation Officer",
    shortLabel: "Federation",
    description:
      "Regional management — validate submissions, generate federation reports, monitor regional performance",
    icon: "UserCog",
  },
  {
    id: "cooperative",
    label: "Cooperative Manager",
    shortLabel: "Cooperative",
    description:
      "Data submission — submit financial statements, update records, view own reports and analytics",
    icon: "Users",
  },
  {
    id: "apex",
    label: "Apex Officer",
    shortLabel: "Apex",
    description:
      "Cooperative oversight — review submissions, manage cooperatives, validate data, approve or request changes",
    icon: "ClipboardList",
  },
];

export const ROLE_NAV: Record<Role, NavGroupId[]> = {
  ministry: ["oversight", "intelligence", "system"],
  federation: ["oversight", "intelligence", "system"],
  cooperative: ["oversight", "intelligence"],
  apex: ["oversight", "intelligence", "system"],
};

export const ROLE_NAV_ITEMS: Record<Role, Partial<Record<NavGroupId, string[]>>> = {
  ministry: {
    oversight: [
      "/app/dashboard",
      "/app/federations",
      "/app/invitations",
      "/app/members",
      "/app/submissions",
    ],
    intelligence: ["/app/reports", "/app/analytics"],
    system: ["/app/users", "/app/settings"],
  },
  federation: {
    oversight: ["/app/dashboard", "/app/apexes", "/app/submissions"],
    intelligence: ["/app/reports", "/app/analytics"],
    system: ["/app/users"],
  },
  cooperative: {
    oversight: ["/app/dashboard", "/app/data-collection", "/app/submissions"],
    intelligence: ["/app/reports", "/app/analytics"],
  },
  apex: {
    oversight: ["/app/dashboard", "/app/cooperatives", "/app/submissions"],
    intelligence: ["/app/reports", "/app/analytics"],
    system: ["/app/users"],
  },
};

export const ROLE_DASHBOARD: Record<Role, { title: string; subtitle: string }> = {
  ministry: {
    title: "National Cooperative Intelligence",
    subtitle: "Real-time oversight · Ministry of Commerce & Cooperative Development",
  },
  federation: {
    title: "Federation Dashboard",
    subtitle: "Regional management · Validate submissions & monitor performance",
  },
  cooperative: {
    title: "Cooperative Dashboard",
    subtitle: "Data submission & reporting · Manage your cooperative",
  },
  apex: {
    title: "Apex Dashboard",
    subtitle: "Cooperative oversight · Review submissions, manage cooperatives & validate data",
  },
};

/** Mock user data per role — used in development login page only */
export const ROLE_USERS: Record<
  Role,
  { name: string; email: string; initials: string; region: string }
> = {
  ministry: { name: "Thabo Nkosi", email: "t.nkosi@gov.sz", initials: "TN", region: "National" },
  federation: {
    name: "Phindile Khumalo",
    email: "p.khumalo@manzini-fed.org",
    initials: "PK",
    region: "Manzini",
  },
  cooperative: {
    name: "Bongani Hlatshwayo",
    email: "b.hlat@lubombo-dairy.coop",
    initials: "BH",
    region: "Lubombo",
  },
  apex: {
    name: "Moses Dlamini",
    email: "m.dlamini@hhohho-apex.org",
    initials: "MD",
    region: "Hhohho",
  },
};

/** Map Keycloak realm role strings to our Role type */
export const KEYCLOAK_ROLE_MAP: Record<string, Role> = {
  ministry: "ministry",
  federation: "federation",
  apex: "apex",
  cooperative: "cooperative",
};

/** Get the primary Role from a list of Keycloak realm roles, respecting hierarchy */
export function mapKeycloakRolesToRole(realmRoles: string[]): Role | null {
  // Map all recognized roles from the token
  const mapped = realmRoles
    .map((r) => KEYCLOAK_ROLE_MAP[r])
    .filter((r): r is Role => r !== undefined);

  if (mapped.length === 0) return null;

  // Return the highest-privilege role — ministry > federation > apex > cooperative
  return mapped.reduce((best, current) =>
    ROLE_HIERARCHY[current] > ROLE_HIERARCHY[best] ? current : best,
  );
}

/** Role hierarchy for access control — higher roles can access lower routes */
export const ROLE_HIERARCHY: Record<Role, number> = {
  ministry: 4,
  federation: 3,
  apex: 2,
  cooperative: 1,
};

/** Default redirect path after login per role */
export const ROLE_DEFAULT_ROUTE: Record<Role, string> = {
  ministry: "/app/dashboard",
  federation: "/app/dashboard",
  apex: "/app/dashboard",
  cooperative: "/app/dashboard",
};
