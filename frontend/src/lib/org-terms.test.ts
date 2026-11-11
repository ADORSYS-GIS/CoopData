import { afterEach, describe, expect, it } from "vitest";
import { replaceOrgTermsText, setOrgTermLabels } from "./org-terms";

afterEach(() => setOrgTermLabels({}));

describe("org terms", () => {
  it("leaves text alone when no level was renamed", () => {
    setOrgTermLabels({});

    expect(replaceOrgTermsText("Register New Cooperative under your Apex")).toBe(
      "Register New Cooperative under your Apex",
    );
  });

  it("ignores names that still equal the built-in or seeded defaults", () => {
    setOrgTermLabels({
      apex: { label: "Apex Officer", plural_label: "Apexes" },
      cooperative: { label: "Cooperative", plural_label: "Cooperatives" },
    });

    expect(replaceOrgTermsText("Apex Officer reviews Cooperatives")).toBe(
      "Apex Officer reviews Cooperatives",
    );
  });

  it("replaces singular and plural names and keeps their casing", () => {
    setOrgTermLabels({
      apex: { label: "Union", plural_label: "Unions" },
      cooperative: { label: "Society", plural_label: "Societies" },
    });

    expect(replaceOrgTermsText("Apex reviews each cooperative")).toBe("Union reviews each society");
    expect(replaceOrgTermsText("All Cooperatives and apexes")).toBe("All Societies and unions");
  });

  it("does not replace a word twice when the new name contains a default word", () => {
    setOrgTermLabels({ apex: { label: "Apex Team", plural_label: "Apex Teams" } });

    expect(replaceOrgTermsText("Ask your Apex")).toBe("Ask your Apex Team");
  });

  it("reports whether the replacements changed", () => {
    expect(setOrgTermLabels({ apex: { label: "Union", plural_label: "Unions" } })).toBe(true);
    expect(setOrgTermLabels({ apex: { label: "Union", plural_label: "Unions" } })).toBe(false);
    expect(setOrgTermLabels({})).toBe(true);
  });
});
