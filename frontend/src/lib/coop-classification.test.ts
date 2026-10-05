import { describe, expect, it } from "vitest";

import { isConsistent, sectorForType, typeForSector } from "@/lib/coop-classification";

describe("coop classification", () => {
  it("prefills the sector from the institution type", () => {
    expect(sectorForType("housing")).toBe("housing");
    expect(sectorForType("sacco")).toBe("finance");
    expect(sectorForType("farm")).toBe("agriculture");
  });

  it("prefills the institution type from the sector", () => {
    expect(typeForSector("agriculture")).toBe("farm");
    expect(typeForSector("finance")).toBe("sacco");
    expect(typeForSector("housing")).toBe("housing");
  });

  it("keeps a compatible current type when the sector is chosen", () => {
    expect(typeForSector("finance", "finance")).toBe("finance");
    expect(typeForSector("other", "multipurpose")).toBe("multipurpose");
  });

  it("rejects a housing type with a finance sector", () => {
    expect(isConsistent("housing", "finance")).toBe(false);
    expect(isConsistent("sacco", "finance")).toBe(true);
  });
});
