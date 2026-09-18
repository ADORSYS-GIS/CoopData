import { describe, expect, it } from "vitest";
import { ruleGuidance, ruleTitle } from "./nf-parse-errors";

describe("ruleGuidance", () => {
  it("returns guidance for a known rule with all fields populated", () => {
    const g = ruleGuidance("MISSING_HEADERS");
    expect(g.title).toBe("Missing required columns");
    expect(g.description).toBeTruthy();
    expect(g.fix).toBeTruthy();
  });

  it("returns guidance for every rule in the catalog", () => {
    const knownRules = [
      "MISSING_HEADERS",
      "MISSING_REQUIRED",
      "INVALID_ENUM",
      "LOAN_WITHOUT_MEMBER",
      "SAVINGS_WITHOUT_MEMBER",
      "FIXED_DEPOSIT_WITHOUT_MEMBER",
      "EXIT_BEFORE_JOIN",
      "MATURITY_BEFORE_START",
      "DPD_STATUS_MISMATCH",
      "MEMBER_COUNT_DRIFT",
    ];
    for (const rule of knownRules) {
      const g = ruleGuidance(rule);
      expect(g.title).not.toBe(rule);
      expect(g.description).toBeTruthy();
      expect(g.fix).toBeTruthy();
    }
  });

  it("returns generic fallback for unknown rule", () => {
    const g = ruleGuidance("SOME_NEW_RULE");
    expect(g.title).toBe("SOME_NEW_RULE");
    expect(g.description).toContain("flagged during validation");
    expect(g.fix).toContain("re-upload");
  });

  it("fallback description differs from known-rule descriptions", () => {
    const known = ruleGuidance("MISSING_HEADERS");
    const unknown = ruleGuidance("WHATEVER");
    expect(known.description).not.toBe(unknown.description);
  });
});

describe("ruleTitle", () => {
  it("returns the human title for a known rule", () => {
    expect(ruleTitle("INVALID_ENUM")).toBe("Invalid value");
  });

  it("falls back to the raw rule string when unknown", () => {
    expect(ruleTitle("NOT_A_RULE")).toBe("NOT_A_RULE");
  });
});
