import { afterEach, describe, expect, it } from "vitest";
import i18n, { applyOrgTermsToResources } from "@/i18n";
import { setOrgTermLabels } from "@/lib/org-terms";

const rename = () =>
  setOrgTermLabels({ cooperative: { label: "Society", plural_label: "Societies" } });

afterEach(() => {
  setOrgTermLabels({});
  applyOrgTermsToResources();
});

describe("configured level names in the UI strings", () => {
  it("rewrites bundled strings and restores them when the names are reset", async () => {
    await i18n.changeLanguage("en");

    rename();
    applyOrgTermsToResources();
    expect(i18n.t("coopProfile.registerNewHeader")).toBe("Register New Society");

    setOrgTermLabels({});
    applyOrgTermsToResources();
    expect(i18n.t("coopProfile.registerNewHeader")).toBe("Register New Cooperative");
  });

  it("rewrites default text written in code but not interpolated values", async () => {
    await i18n.changeLanguage("en");
    rename();
    applyOrgTermsToResources();

    const text = i18n.t("test.notInBundle", {
      defaultValue: "Welcome {{name}} to your cooperative",
      name: "Cooperative Union",
    });

    expect(text).toBe("Welcome Cooperative Union to your society");
  });
});

describe("default level names", () => {
  it("keep the platform wording and are translated", async () => {
    setOrgTermLabels({ cooperative: { label: "Society", plural_label: "Societies" } });
    applyOrgTermsToResources();

    await i18n.changeLanguage("en");
    expect(i18n.t("settings.terminology.defaultNames.cooperative")).toBe("Cooperative Manager");

    await i18n.changeLanguage("fr");
    expect(i18n.t("settings.terminology.defaultNames.apex")).toBe("Niveau régional");
    expect(i18n.t("settings.terminology.title")).toBe("Terminologie des rôles et niveaux");
    await i18n.changeLanguage("en");
  });
});
