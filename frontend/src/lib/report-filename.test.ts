import { describe, expect, it } from "vitest";

import { consolidatedFilename, individualFilename, withLanguage } from "@/lib/report-filename";

describe("consolidatedFilename", () => {
  it("names the apex and calls its report regional", () => {
    expect(
      consolidatedFilename({ level: "apex", entityName: "Southern SACCO Association", year: 2026 }),
    ).toBe("southern_sacco_association_regional_report_2026.pdf");
  });

  it("names the federation and calls its report commissional", () => {
    expect(
      consolidatedFilename({
        level: "federation",
        entityName: "Eswatini Federation",
        year: "2025",
      }),
    ).toBe("eswatini_federation_commissional_report_2025.pdf");
  });

  it("names the national report without an organisation", () => {
    expect(consolidatedFilename({ level: "ministry", entityName: "Ignored", year: 2026 })).toBe(
      "ministry_national_report_2026.pdf",
    );
  });

  it("keeps only the level when the organisation name is unknown", () => {
    expect(consolidatedFilename({ level: "apex", year: 2026 })).toBe("regional_report_2026.pdf");
    expect(consolidatedFilename({ level: "federation" })).toBe("commissional_report.pdf");
  });

  it("strips accents and punctuation", () => {
    expect(
      consolidatedFilename({ level: "apex", entityName: "Ndlovu & Fils (Sud)", year: 2026 }),
    ).toBe("ndlovu_fils_sud_regional_report_2026.pdf");
  });

  it("marks the questionnaire method so the two reports never share a name", () => {
    expect(
      consolidatedFilename({
        level: "apex",
        entityName: "Southern Sacco",
        year: 2026,
        method: "questionnaire",
      }),
    ).toBe("southern_sacco_regional_questionnaire_report_2026.pdf");
    expect(consolidatedFilename({ level: "ministry", year: 2026, method: "questionnaire" })).toBe(
      "ministry_national_questionnaire_report_2026.pdf",
    );
  });
});

describe("individualFilename", () => {
  it("uses the cooperative name and year", () => {
    expect(individualFilename("Lubombo Sacco", 2026)).toBe("lubombo_sacco_2026.pdf");
  });
});

describe("withLanguage", () => {
  it("adds the report language before the extension", () => {
    expect(withLanguage("ministry_national_report_2026.pdf", "ss")).toBe(
      "ministry_national_report_2026_ss.pdf",
    );
  });
});
