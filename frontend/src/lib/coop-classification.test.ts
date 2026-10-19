import { describe, expect, it } from "vitest";

import { isConsistent, sectorForType, typeForSector } from "@/lib/coop-classification";

describe("coop classification", () => {
  it("prefills the sector from the institution type", () => {
    expect(sectorForType("sacco")).toBe("finance");
    expect(sectorForType("multipurpose")).toBe("agriculture");
  });

  it("prefills the institution type from the sector", () => {
    expect(typeForSector("agriculture")).toBe("multipurpose");
    expect(typeForSector("finance")).toBe("sacco");
    expect(typeForSector("housing")).toBe("multipurpose");
  });

  it("keeps a compatible current type when the sector is chosen", () => {
    expect(typeForSector("finance", "sacco")).toBe("sacco");
    expect(typeForSector("other", "multipurpose")).toBe("multipurpose");
  });

  it("rejects a housing sector with a sacco type", () => {
    expect(isConsistent("sacco", "housing")).toBe(false);
    expect(isConsistent("sacco", "finance")).toBe(true);
    expect(isConsistent("multipurpose", "housing")).toBe(true);
  });
});
