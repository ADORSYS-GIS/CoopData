import { describe, expect, it } from "vitest";

import { mergeServerNames } from "@/services/shared/profileNames";
import type { UserProfile } from "@/types/auth";

const base = {
  id: "u1",
  email: "a@b.c",
  name: "A B",
  firstName: "A",
  lastName: "B",
  initials: "AB",
  role: "federation",
  region: "old-federation",
  organizationId: "org1",
  organizationName: "old-federation",
  cooperationId: null,
  cooperationName: null,
  assignedDimensions: [],
  realmRoles: [],
} as unknown as UserProfile;

describe("mergeServerNames", () => {
  it("replaces a stale federation name and region with the renamed one", () => {
    const merged = mergeServerNames(base, { organization_name: "Renamed Federation" });
    expect(merged.organizationName).toBe("Renamed Federation");
    expect(merged.region).toBe("Renamed Federation");
  });

  it("keeps the token values when the server sends nothing", () => {
    const merged = mergeServerNames(base, { organization_name: "  " });
    expect(merged.organizationName).toBe("old-federation");
  });

  it("updates the apex name for apex users only", () => {
    const apex = { ...base, role: "apex", cooperationName: "old" } as UserProfile;
    expect(mergeServerNames(apex, { apex_name: "New Apex" }).cooperationName).toBe("New Apex");
    expect(mergeServerNames(base, { apex_name: "New Apex" }).cooperationName).toBeNull();
  });

  it("updates the cooperative name for cooperative users", () => {
    const coop = { ...base, role: "cooperative", cooperationName: "old" } as UserProfile;
    expect(mergeServerNames(coop, { cooperation_name: "New Coop" }).cooperationName).toBe(
      "New Coop",
    );
  });
});
