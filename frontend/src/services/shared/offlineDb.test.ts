import { describe, it, expect } from "vitest";
import { offlineDb, CoopDataOfflineDB } from "./offlineDb";

describe("offlineDb", () => {
  it("should export an instance of CoopDataOfflineDB", () => {
    expect(offlineDb).toBeInstanceOf(CoopDataOfflineDB);
  });

  it("should define the correct tables in the schema", () => {
    const tableNames = offlineDb.tables.map((t) => t.name);
    expect(tableNames).toContain("submissions");
    expect(tableNames).toContain("analytics");
    expect(tableNames).toContain("federations");
    expect(tableNames).toContain("apexes");
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("cooperatives");
    expect(tableNames).toContain("formTemplates");
    expect(tableNames).toContain("reports");
    expect(tableNames).toContain("syncQueue");
    expect(tableNames).toContain("meta");
  });

  it("should have correct version configurations", () => {
    expect(offlineDb.verno).toBeGreaterThanOrEqual(2);
  });
});
