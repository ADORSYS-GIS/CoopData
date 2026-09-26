import { describe, expect, it } from "vitest";

import { consolidatedFilename, individualFilename } from "@/lib/report-filename";

describe("consolidatedFilename", () => {
  it("names the apex and the level", () => {
    expect(
      consolidatedFilename({ level: "apex", entityName: "Southern SACCO Association", year: 2026 }),
    ).toBe("southern_sacco_association_apex_report_2026.pdf");
  });

  it("names the federation and the level", () => {
    expect(
      consolidatedFilename({
        level: "federation",
        entityName: "Eswatini Federation",
        year: "2025",
      }),
    ).toBe("eswatini_federation_federation_report_2025.pdf");
  });

  it("names the national report without an entity", () => {
    expect(consolidatedFilename({ level: "ministry", year: 2026 })).toBe(
      "ministry_national_report_2026.pdf",
    );
  });

  it("falls back to the level when the entity name is unknown", () => {
    expect(consolidatedFilename({ level: "apex", year: 2026 })).toBe("apex_report_2026.pdf");
  });

  it("strips accents and punctuation", () => {
    expect(
      consolidatedFilename({ level: "apex", entityName: "Ndlovu & Fils (Sud)", year: 2026 }),
    ).toBe("ndlovu_fils_sud_apex_report_2026.pdf");
  });
});

describe("individualFilename", () => {
  it("uses the cooperative name and year", () => {
    expect(individualFilename("Lubombo Sacco", 2026)).toBe("lubombo_sacco_2026.pdf");
  });
});
