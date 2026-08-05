/**
 * Helpers for dynamic content localization (ministry-editable content).
 *
 * Canonical (source) content lives in the main fields of each entity
 * (e.g. `questionnaire_templates.label` / `sections[]`.title / fields[].label).
 * Translations live in a parallel map: `{ "<lang>": { <field-or-section>: <text> } }`
 *
 * Keep this in sync with `backend/src/services/localization.rs`.
 */

export const CONTENT_LANGUAGES = ["en", "pt", "ss", "fr"] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];

export const CANONICAL_LANG: ContentLanguage = "en";

/** The languages that live in a per-field translation map (English is canonical). */
export const NON_EN_LANGS = ["pt", "ss", "fr"] as const;
export type NonEnLanguage = (typeof NON_EN_LANGS)[number];

/** Normalize a raw app/browser language tag (e.g. "en-US") into a supported
 * content language, defaulting to English when unrecognized. */
export function normalizeAppLang(raw?: string | null): ContentLanguage {
  const primary = (raw ?? "").split("-")[0]?.toLowerCase();
  return (CONTENT_LANGUAGES as readonly string[]).includes(primary)
    ? (primary as ContentLanguage)
    : "en";
}

/**
 * Decide which language a translatable field should be *edited and displayed*
 * as its primary text in, given the app's current UI language.
 *
 * - If a translation already exists for the app's language, that language is
 *   primary (so a French admin sees/edits the French text they entered).
 * - Otherwise falls back to canonical English (nothing to show in the app's
 *   language yet — including brand-new, still-empty fields, which must stay
 *   bound to canonical so keys/validation work).
 */
export function resolvePrimaryLang(
  translations: Partial<Record<NonEnLanguage, string | undefined>> | undefined,
  displayLang: ContentLanguage,
): ContentLanguage {
  if (displayLang !== CANONICAL_LANG && translations?.[displayLang as NonEnLanguage]) {
    return displayLang;
  }
  return CANONICAL_LANG;
}

/** A translation map for questionnaire templates:
 *  { "ss": { label?, sections: { "<secId>": { title?, description?, fields: { "<key>": { label?, description?, options? } } } } } }
 */
export type QuestionnaireTranslations = Record<
  string,
  {
    label?: string;
    sections?: Record<
      string,
      {
        title?: string;
        description?: string;
        fields?: Record<string, { label?: string; description?: string; options?: string[] }>;
      }
    >;
  }
>;

/** Read the section translation object for a language (undefined-safe). */
export function sectionTranslation(
  translations: QuestionnaireTranslations | undefined,
  lang: string,
  sectionId: string,
):
  | {
      title?: string;
      description?: string;
      fields?: Record<string, { label?: string; description?: string; options?: string[] }>;
    }
  | undefined {
  return translations?.[lang]?.sections?.[sectionId];
}

/** Read a field translation object for a language (undefined-safe). */
export function fieldTranslation(
  translations: QuestionnaireTranslations | undefined,
  lang: string,
  sectionId: string,
  fieldKey: string,
): { label?: string; description?: string; options?: string[] } | undefined {
  return translations?.[lang]?.sections?.[sectionId]?.fields?.[fieldKey];
}

/** Dynamically set a section translation value, returning a new immutable map. */
export function setSectionTranslation(
  translations: QuestionnaireTranslations,
  lang: string,
  sectionId: string,
  patch: { title?: string; description?: string },
): QuestionnaireTranslations {
  const langEntry = translations[lang] ?? {};
  const sections = langEntry.sections ?? {};
  const current = sections[sectionId] ?? {};
  const next = structuredClone(translations);
  next[lang] = {
    ...langEntry,
    sections: {
      ...sections,
      [sectionId]: {
        ...current,
        ...patch,
      },
    },
  };
  return next;
}

/** Dynamically set a field translation value, returning a new immutable map. */
export function setFieldTranslation(
  translations: QuestionnaireTranslations,
  lang: string,
  sectionId: string,
  fieldKey: string,
  patch: { label?: string; description?: string; options?: string[] },
): QuestionnaireTranslations {
  const langEntry = translations[lang] ?? {};
  const sections = langEntry.sections ?? {};
  const sec = sections[sectionId] ?? {};
  const fields = sec.fields ?? {};
  const next = structuredClone(translations);
  next[lang] = {
    ...langEntry,
    sections: {
      ...sections,
      [sectionId]: {
        ...sec,
        fields: {
          ...fields,
          [fieldKey]: {
            ...(fields[fieldKey] ?? {}),
            ...patch,
          },
        },
      },
    },
  };
  return next;
}

/** Set a top-level label translation. */
export function setLabelTranslation(
  translations: QuestionnaireTranslations,
  lang: string,
  label: string,
): QuestionnaireTranslations {
  const langEntry = translations[lang] ?? {};
  const next = structuredClone(translations);
  next[lang] = { ...langEntry, label };
  return next;
}
