import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

export type Role = "ministry" | "federation" | "apex" | "cooperative";

export const ROLES: {
  id: Role;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}[] = [
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

export type NavGroupId = "oversight" | "intelligence" | "system";

export const ROLE_NAV: Record<Role, NavGroupId[]> = {
  ministry: ["oversight", "intelligence", "system"],
  federation: ["oversight", "intelligence", "system"],
  cooperative: ["oversight", "intelligence"],
  apex: ["oversight", "intelligence", "system"],
};

export const ROLE_NAV_ITEMS: Record<Role, Partial<Record<NavGroupId, string[]>>> = {
  ministry: {
    oversight: ["/app/dashboard", "/app/federations", "/app/submissions"],
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

interface AuthState {
  role: Role;
  user: { name: string; email: string; initials: string; region: string };
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("coopdata_auth");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore
        }
      }
    }
    return {
      role: "ministry" as Role,
      user: ROLE_USERS.ministry,
      isAuthenticated: false,
    };
  });

  const login = useCallback((role: Role) => {
    const newState = {
      role,
      user: ROLE_USERS[role],
      isAuthenticated: true,
    };
    setAuth(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem("coopdata_auth", JSON.stringify(newState));
    }
  }, []);

  const logout = useCallback(() => {
    const newState = {
      role: "ministry" as Role,
      user: ROLE_USERS.ministry,
      isAuthenticated: false,
    };
    setAuth(newState);
    if (typeof window !== "undefined") {
      localStorage.removeItem("coopdata_auth");
    }
  }, []);

  return <AuthContext.Provider value={{ ...auth, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRole() {
  const { role } = useAuth();
  return role;
}

export function useCanAccess(path: string): boolean {
  const role = useRole();
  const groups = ROLE_NAV[role];
  for (const groupId of groups) {
    const items = ROLE_NAV_ITEMS[role][groupId as NavGroupId];
    if (items?.includes(path)) return true;
  }
  return false;
}
