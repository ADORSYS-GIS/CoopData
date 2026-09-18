import { describe, expect, it } from "vitest";
import {
  CANONICAL_LANG,
  CONTENT_LANGUAGES,
  NON_EN_LANGS,
  fieldTranslation,
  normalizeAppLang,
  resolvePrimaryLang,
  sectionTranslation,
  setFieldTranslation,
  setLabelTranslation,
  setSectionTranslation,
  type QuestionnaireTranslations,
} from "./contentLocalization";

describe("language constants", () => {
  it("has english as canonical language", () => {
    expect(CANONICAL_LANG).toBe("en");
  });

  it("supports exactly en, pt, ss, fr", () => {
    expect(CONTENT_LANGUAGES).toEqual(["en", "pt", "ss", "fr"]);
  });

  it("non-en languages exclude english", () => {
    expect(NON_EN_LANGS).toEqual(["pt", "ss", "fr"]);
    expect(NON_EN_LANGS).not.toContain("en");
  });
});

describe("normalizeAppLang", () => {
  it("maps language tags with region to supported languages", () => {
    expect(normalizeAppLang("en-US")).toBe("en");
    expect(normalizeAppLang("pt-BR")).toBe("pt");
    expect(normalizeAppLang("fr-CA")).toBe("fr");
  });

  it("is case-insensitive", () => {
    expect(normalizeAppLang("EN")).toBe("en");
    expect(normalizeAppLang("SS")).toBe("ss");
  });

  it("falls back to english for unsupported languages", () => {
    expect(normalizeAppLang("de-DE")).toBe("en");
    expect(normalizeAppLang("zu")).toBe("en");
  });

  it("falls back to english for null, undefined, and empty input", () => {
    expect(normalizeAppLang(null)).toBe("en");
    expect(normalizeAppLang(undefined)).toBe("en");
    expect(normalizeAppLang("")).toBe("en");
  });
});

describe("resolvePrimaryLang", () => {
  it("returns display lang when a translation exists for it", () => {
    const t = { fr: "Bonjour" };
    expect(resolvePrimaryLang(t, "fr")).toBe("fr");
  });

  it("falls back to canonical when no translation exists", () => {
    expect(resolvePrimaryLang({ fr: "Bonjour" }, "ss")).toBe("en");
  });

  it("falls back to canonical when translations are undefined", () => {
    expect(resolvePrimaryLang(undefined, "fr")).toBe("en");
  });

  it("always returns canonical when display lang is english", () => {
    expect(resolvePrimaryLang({ fr: "Bonjour" }, "en")).toBe("en");
    expect(resolvePrimaryLang(undefined, "en")).toBe("en");
  });

  it("ignores empty-string translations", () => {
    expect(resolvePrimaryLang({ fr: "" }, "fr")).toBe("en");
  });
});

describe("sectionTranslation / fieldTranslation", () => {
  const translations: QuestionnaireTranslations = {
    fr: {
      label: "Questionnaire FR",
      sections: {
        sec1: {
          title: "Section 1 FR",
          fields: {
            f1: { label: "Champ 1", options: ["A", "B"] },
          },
        },
      },
    },
  };

  it("reads a section translation", () => {
    expect(sectionTranslation(translations, "fr", "sec1")?.title).toBe("Section 1 FR");
  });

  it("returns undefined for unknown language", () => {
    expect(sectionTranslation(translations, "ss", "sec1")).toBeUndefined();
  });

  it("returns undefined for unknown section", () => {
    expect(sectionTranslation(translations, "fr", "nope")).toBeUndefined();
  });

  it("returns undefined when translations object is undefined", () => {
    expect(sectionTranslation(undefined, "fr", "sec1")).toBeUndefined();
  });

  it("reads a field translation", () => {
    expect(fieldTranslation(translations, "fr", "sec1", "f1")?.label).toBe("Champ 1");
  });

  it("returns undefined for unknown field key", () => {
    expect(fieldTranslation(translations, "fr", "sec1", "nope")).toBeUndefined();
  });
});

describe("setSectionTranslation", () => {
  it("creates the language entry and section when missing", () => {
    const result = setSectionTranslation({}, "ss", "s1", { title: "Sisec" });
    expect(result.ss?.sections?.s1?.title).toBe("Sisec");
  });

  it("patches an existing section without losing siblings", () => {
    const base: QuestionnaireTranslations = {
      fr: { sections: { s1: { title: "Old" }, s2: { title: "Keep" } } },
    };
    const result = setSectionTranslation(base, "fr", "s1", { title: "New" });
    expect(result.fr?.sections?.s1?.title).toBe("New");
    expect(result.fr?.sections?.s2?.title).toBe("Keep");
  });

  it("preserves existing section fields when patching title only", () => {
    const base: QuestionnaireTranslations = {
      fr: {
        sections: { s1: { title: "Old", description: "Desc", fields: { f: { label: "L" } } } },
      },
    };
    const result = setSectionTranslation(base, "fr", "s1", { title: "New" });
    expect(result.fr?.sections?.s1?.description).toBe("Desc");
    expect(result.fr?.sections?.s1?.fields?.f?.label).toBe("L");
  });

  it("does not mutate the input map", () => {
    const base: QuestionnaireTranslations = { fr: { sections: { s1: { title: "Old" } } } };
    const snapshot = structuredClone(base);
    setSectionTranslation(base, "fr", "s1", { title: "New" });
    expect(base).toEqual(snapshot);
  });
});

describe("setFieldTranslation", () => {
  it("creates language, section, and field entries when missing", () => {
    const result = setFieldTranslation({}, "pt", "s1", "f1", { label: "Campo" });
    expect(result.pt?.sections?.s1?.fields?.f1?.label).toBe("Campo");
  });

  it("merges the patch into existing field translation", () => {
    const base: QuestionnaireTranslations = {
      fr: { sections: { s1: { fields: { f1: { label: "Old" } } } } },
    };
    const result = setFieldTranslation(base, "fr", "s1", "f1", { description: "D" });
    expect(result.fr?.sections?.s1?.fields?.f1?.label).toBe("Old");
    expect(result.fr?.sections?.s1?.fields?.f1?.description).toBe("D");
  });

  it("does not mutate the input map", () => {
    const base: QuestionnaireTranslations = {
      fr: { sections: { s1: { fields: { f1: { label: "Old" } } } } },
    };
    const snapshot = structuredClone(base);
    setFieldTranslation(base, "fr", "s1", "f1", { label: "New" });
    expect(base).toEqual(snapshot);
  });
});

describe("setLabelTranslation", () => {
  it("creates the language entry when missing", () => {
    const result = setLabelTranslation({}, "fr", "Bonjour");
    expect(result.fr?.label).toBe("Bonjour");
  });

  it("overwrites an existing label and keeps sections", () => {
    const base: QuestionnaireTranslations = {
      fr: { label: "Old", sections: { s1: { title: "T" } } },
    };
    const result = setLabelTranslation(base, "fr", "New");
    expect(result.fr?.label).toBe("New");
    expect(result.fr?.sections?.s1?.title).toBe("T");
  });

  it("only changes the target language", () => {
    const base: QuestionnaireTranslations = { pt: { label: "PT" } };
    const result = setLabelTranslation(base, "fr", "FR");
    expect(result.pt?.label).toBe("PT");
    expect(result.fr?.label).toBe("FR");
  });

  it("does not mutate the input map", () => {
    const base: QuestionnaireTranslations = { fr: { label: "Old" } };
    const snapshot = structuredClone(base);
    setLabelTranslation(base, "fr", "New");
    expect(base).toEqual(snapshot);
  });
});
