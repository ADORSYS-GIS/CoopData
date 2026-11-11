import i18n, { type PostProcessorModule } from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import pt from "./locales/pt.json";
import ss from "./locales/ss.json";
import fr from "./locales/fr.json";
import { replaceOrgTermsText } from "@/lib/org-terms";

const resources = {
  en: { translation: en },
  pt: { translation: pt },
  ss: { translation: ss },
  fr: { translation: fr },
};

// i18next keeps the objects it is given and merges into them, so keep a pristine copy to rewrite from.
const originalResources = structuredClone(resources);

export type SupportedLanguage = keyof typeof resources;

/** Every UI language the app ships; the offline seeder pre-downloads translated data for each. */
export const SUPPORTED_LANGUAGES = Object.keys(resources) as SupportedLanguage[];

type TranslatorLike = {
  resolve: (key: string | string[], options: object) => { res?: unknown } | undefined;
  translate: (key: string | string[], options: object) => unknown;
};

/**
 * Strings written in code as `t(key, { defaultValue })` are not in the bundles, so the
 * bundle rewrite cannot reach them. For those only, the default text is rewritten before
 * interpolation, which keeps values such as an organisation's own name untouched.
 */
const orgTermsInDefaults: PostProcessorModule = {
  type: "postProcessor",
  name: "orgTermsInDefaults",
  process(value: string, key: string | string[], options: Record<string, unknown>, translator) {
    const template = options?.defaultValue;
    if (typeof template !== "string") return value;
    const t = translator as unknown as TranslatorLike;
    if (t.resolve(key, options)?.res !== undefined) return value;
    const rewritten = replaceOrgTermsText(template);
    if (rewritten === template) return value;
    return String(
      t.translate(key, { ...options, defaultValue: rewritten, applyPostProcessor: false }),
    );
  },
};

i18n
  .use(orgTermsInDefaults)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    postProcess: ["orgTermsInDefaults"],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      // No querystring detection: it would let any `?lng=` link permanently change
      // a user's language. Print pages switch to the report language themselves
      // (usePrintLanguage) and render only once it is active.
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
  });

type Bundle = { [key: string]: Bundle | string };

// Texts that must keep the platform's own wording, such as the default level names shown
// next to the fields where the ministry edits them.
const UNTOUCHED_PATHS = new Set(["settings.terminology.defaultNames"]);

const mapStrings = (node: Bundle | string, path = ""): Bundle | string => {
  if (typeof node === "string") return replaceOrgTermsText(node);
  if (UNTOUCHED_PATHS.has(path)) return node;
  const out: Bundle = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] = mapStrings(value, path ? `${path}.${key}` : key);
  }
  return out;
};

/**
 * Rewrites every UI string with the level names the ministry configured. The static bundles
 * stay untouched, so calling it again (names edited, language switched) always starts from the
 * original wording. Interpolated values such as an organisation's own name are not affected.
 */
export function applyOrgTermsToResources(): void {
  for (const lng of SUPPORTED_LANGUAGES) {
    i18n.addResourceBundle(
      lng,
      "translation",
      mapStrings(originalResources[lng].translation as Bundle) as Bundle,
      true,
      true,
    );
  }
  void i18n.changeLanguage(i18n.language);
}

export default i18n;
