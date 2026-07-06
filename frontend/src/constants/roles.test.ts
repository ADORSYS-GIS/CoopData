import { describe, it, expect } from "vitest";
import {
  ROLES,
  ROLE_NAV,
  ROLE_NAV_ITEMS,
  ROLE_DASHBOARD,
  ROLE_HIERARCHY,
  ROLE_DEFAULT_ROUTE,
  KEYCLOAK_ROLE_MAP,
  mapKeycloakRolesToRole,
  type Role,
} from "@/constants/roles";

const ALL_ROLES: Role[] = ["ministry", "federation", "apex", "cooperative"];

describe("roles constants", () => {
  describe("ROLES", () => {
    it("should define all four roles", () => {
      expect(ROLES).toHaveLength(4);
      const ids = ROLES.map((r) => r.id);
      expect(ids).toEqual(expect.arrayContaining(ALL_ROLES));
    });

    it("should have label, shortLabel, description, and icon for each role", () => {
      for (const role of ROLES) {
        expect(role.label).toBeTruthy();
        expect(role.shortLabel).toBeTruthy();
        expect(role.description).toBeTruthy();
        expect(role.icon).toBeTruthy();
      }
    });
  });

  describe("ROLE_NAV", () => {
    it("should define nav groups for every role", () => {
      for (const role of ALL_ROLES) {
        expect(ROLE_NAV[role]).toBeDefined();
        expect(Array.isArray(ROLE_NAV[role])).toBe(true);
        expect(ROLE_NAV[role].length).toBeGreaterThan(0);
      }
    });

    it("should give ministry access to all three nav groups", () => {
      expect(ROLE_NAV.ministry).toEqual(
        expect.arrayContaining(["oversight", "intelligence", "system"]),
      );
    });

    it("should not give cooperative access to system group", () => {
      expect(ROLE_NAV.cooperative).not.toContain("system");
    });
  });

  describe("ROLE_NAV_ITEMS", () => {
    it("should define nav items for every role", () => {
      for (const role of ALL_ROLES) {
        expect(ROLE_NAV_ITEMS[role]).toBeDefined();
      }
    });

    it("should include /app/dashboard for every role", () => {
      for (const role of ALL_ROLES) {
        const allItems = Object.values(ROLE_NAV_ITEMS[role]).flat();
        expect(allItems).toContain("/app/dashboard");
      }
    });

    it("should include /app/federations only for ministry", () => {
      expect(ROLE_NAV_ITEMS.ministry.oversight).toContain("/app/federations");
      expect(ROLE_NAV_ITEMS.federation.oversight).not.toContain("/app/federations");
      expect(ROLE_NAV_ITEMS.apex.oversight).not.toContain("/app/federations");
      expect(ROLE_NAV_ITEMS.cooperative.oversight).not.toContain("/app/federations");
    });

    it("should include /app/apexes only for federation", () => {
      const fedItems = Object.values(ROLE_NAV_ITEMS.federation).flat();
      expect(fedItems).toContain("/app/apexes");
      const ministryItems = Object.values(ROLE_NAV_ITEMS.ministry).flat();
      expect(ministryItems).not.toContain("/app/apexes");
    });

    it("should include /app/cooperatives only for apex", () => {
      const apexItems = Object.values(ROLE_NAV_ITEMS.apex).flat();
      expect(apexItems).toContain("/app/cooperatives");
      const ministryItems = Object.values(ROLE_NAV_ITEMS.ministry).flat();
      expect(ministryItems).not.toContain("/app/cooperatives");
    });

    it("should include /app/data-collection only for cooperative", () => {
      const coopItems = Object.values(ROLE_NAV_ITEMS.cooperative).flat();
      expect(coopItems).toContain("/app/data-collection");
      const ministryItems = Object.values(ROLE_NAV_ITEMS.ministry).flat();
      expect(ministryItems).not.toContain("/app/data-collection");
    });

    it("should include /app/users for ministry, federation, and apex but not cooperative", () => {
      expect(ROLE_NAV_ITEMS.ministry.system).toContain("/app/users");
      const fedItems = Object.values(ROLE_NAV_ITEMS.federation).flat();
      expect(fedItems).toContain("/app/users");
      expect(ROLE_NAV_ITEMS.apex.system).toContain("/app/users");
      const coopItems = Object.values(ROLE_NAV_ITEMS.cooperative).flat();
      expect(coopItems).not.toContain("/app/users");
    });

    it("should include /app/settings only for ministry", () => {
      expect(ROLE_NAV_ITEMS.ministry.system).toContain("/app/settings");
      const fedItems = Object.values(ROLE_NAV_ITEMS.federation).flat();
      expect(fedItems).not.toContain("/app/settings");
    });
  });

  describe("ROLE_DASHBOARD", () => {
    it("should define title and subtitle for every role", () => {
      for (const role of ALL_ROLES) {
        expect(ROLE_DASHBOARD[role].title).toBeTruthy();
        expect(ROLE_DASHBOARD[role].subtitle).toBeTruthy();
      }
    });
  });

  describe("ROLE_HIERARCHY", () => {
    it("should assign ministry the highest level (4)", () => {
      expect(ROLE_HIERARCHY.ministry).toBe(4);
    });

    it("should assign cooperative the lowest level (1)", () => {
      expect(ROLE_HIERARCHY.cooperative).toBe(1);
    });

    it("should maintain correct ordering: ministry > federation > apex > cooperative", () => {
      expect(ROLE_HIERARCHY.ministry).toBeGreaterThan(ROLE_HIERARCHY.federation);
      expect(ROLE_HIERARCHY.federation).toBeGreaterThan(ROLE_HIERARCHY.apex);
      expect(ROLE_HIERARCHY.apex).toBeGreaterThan(ROLE_HIERARCHY.cooperative);
    });
  });

  describe("ROLE_DEFAULT_ROUTE", () => {
    it("should redirect all roles to /app/dashboard", () => {
      for (const role of ALL_ROLES) {
        expect(ROLE_DEFAULT_ROUTE[role]).toBe("/app/dashboard");
      }
    });
  });

  describe("KEYCLOAK_ROLE_MAP", () => {
    it("should map ministry role", () => {
      expect(KEYCLOAK_ROLE_MAP["ministry"]).toBe("ministry");
    });

    it("should map federation role", () => {
      expect(KEYCLOAK_ROLE_MAP["federation"]).toBe("federation");
    });

    it("should map apex role", () => {
      expect(KEYCLOAK_ROLE_MAP["apex"]).toBe("apex");
    });

    it("should map regional_officer to apex", () => {
      expect(KEYCLOAK_ROLE_MAP["regional_officer"]).toBe("apex");
    });

    it("should map cooperative role", () => {
      expect(KEYCLOAK_ROLE_MAP["cooperative"]).toBe("cooperative");
    });

    it("should map default-roles-coop-data to cooperative", () => {
      expect(KEYCLOAK_ROLE_MAP["default-roles-coop-data"]).toBe("cooperative");
    });
  });

  describe("mapKeycloakRolesToRole", () => {
    it("should return ministry when ministry role is present", () => {
      expect(mapKeycloakRolesToRole(["ministry"])).toBe("ministry");
    });

    it("should return federation when federation role is present", () => {
      expect(mapKeycloakRolesToRole(["federation"])).toBe("federation");
    });

    it("should return apex when apex role is present", () => {
      expect(mapKeycloakRolesToRole(["apex"])).toBe("apex");
    });

    it("should return cooperative when cooperative role is present", () => {
      expect(mapKeycloakRolesToRole(["cooperative"])).toBe("cooperative");
    });

    it("should return regional_officer as apex", () => {
      expect(mapKeycloakRolesToRole(["regional_officer"])).toBe("apex");
    });

    it("should return default-roles-coop-data as cooperative", () => {
      expect(mapKeycloakRolesToRole(["default-roles-coop-data"])).toBe("cooperative");
    });

    it("should prioritize ministry over all other roles", () => {
      expect(
        mapKeycloakRolesToRole(["cooperative", "apex", "federation", "ministry"]),
      ).toBe("ministry");
    });

    it("should prioritize federation over apex and cooperative", () => {
      expect(mapKeycloakRolesToRole(["cooperative", "apex", "federation"])).toBe("federation");
    });

    it("should prioritize apex over cooperative", () => {
      expect(mapKeycloakRolesToRole(["cooperative", "apex"])).toBe("apex");
    });

    it("should return null for empty array", () => {
      expect(mapKeycloakRolesToRole([])).toBeNull();
    });

    it("should return null for unrecognized roles", () => {
      expect(mapKeycloakRolesToRole(["unknown_role", "offline_access"])).toBeNull();
    });

    it("should return null for roles that are only Keycloak built-in (uma_authorization, offline_access)", () => {
      expect(mapKeycloakRolesToRole(["uma_authorization", "offline_access"])).toBeNull();
    });

    it("should pick ministry even when mixed with built-in roles", () => {
      expect(
        mapKeycloakRolesToRole(["uma_authorization", "offline_access", "ministry"]),
      ).toBe("ministry");
    });

    it("should pick apex from regional_officer when no higher role present", () => {
      expect(
        mapKeycloakRolesToRole(["default-roles-coop-data", "regional_officer"]),
      ).toBe("apex");
    });

    it("should handle duplicate roles", () => {
      expect(mapKeycloakRolesToRole(["ministry", "ministry"])).toBe("ministry");
    });
  });
});