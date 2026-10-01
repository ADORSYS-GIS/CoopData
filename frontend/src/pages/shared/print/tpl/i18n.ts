import type { TOptions } from "i18next";

import i18n from "@/i18n";
import { normalizeAppLang, type ContentLanguage } from "@/lib/contentLocalization";

export const reportLanguage = (): ContentLanguage =>
  normalizeAppLang(i18n.resolvedLanguage ?? i18n.language);

/** One organisation level as configured by the Ministry (Settings → Terminology). */
export interface RoleLabel {
  key: string;
  short_label?: string | null;
  plural_label?: string | null;
  translations?: unknown;
}

type RoleKey = "cooperative" | "apex" | "federation" | "ministry";

/** Placeholder base name of each level in report strings, e.g. `{{apex}}`, `{{apexes}}`. */
const ROLE_VARIABLES: Record<RoleKey, { one: string; other: string }> = {
  cooperative: { one: "coop", other: "coops" },
  apex: { one: "apex", other: "apexes" },
  federation: { one: "federation", other: "federations" },
  ministry: { one: "ministry", other: "ministries" },
};

/** The seeded organisation names; a stored name equal to these has not been customised. */
const SEEDED_NAMES: Record<RoleKey, { one: string; other: string }> = {
  cooperative: { one: "Cooperative", other: "Cooperatives" },
  apex: { one: "Apex", other: "Apexes" },
  federation: { one: "Federation", other: "Federations" },
  ministry: { one: "Ministry", other: "Ministries" },
};

let roleLabels: readonly RoleLabel[] = [];

/** Sets the Ministry's organisation names used by every report rendered afterwards. */
export const setReportRoles = (labels: readonly RoleLabel[] | null | undefined): void => {
  roleLabels = labels ?? [];
};

const upperFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Name of one organisation level in the report language: the Ministry's translation,
 * then the Ministry's own name when it was customised, then the report default.
 */
const roleName = (key: RoleKey, form: "one" | "other"): { name: string; custom: boolean } => {
  const field = form === "one" ? "short_label" : "plural_label";
  const label = roleLabels.find((item) => item.key === key);
  const translations = (label?.translations ?? {}) as Record<string, Record<string, unknown>>;
  const translated = translations[reportLanguage()]?.[field];
  if (typeof translated === "string" && translated.trim()) {
    return { name: translated.trim(), custom: true };
  }
  const stored = label?.[field]?.trim();
  if (stored && stored !== SEEDED_NAMES[key][form]) return { name: stored, custom: true };
  return { name: i18n.t(`pdf.roles.${key}.${form}`), custom: false };
};

/**
 * Role placeholders for report strings. `{{apex}}` is the heading form (capitalised);
 * `{{apexLc}}` is the mid-sentence form, which keeps a Ministry-defined name exactly as
 * written and lowercases only the built-in defaults.
 */
const roleVariables = (): Record<string, string> => {
  const variables: Record<string, string> = {};
  for (const key of Object.keys(ROLE_VARIABLES) as RoleKey[]) {
    for (const form of ["one", "other"] as const) {
      const { name, custom } = roleName(key, form);
      const variable = ROLE_VARIABLES[key][form];
      variables[variable] = upperFirst(name);
      variables[`${variable}Lc`] = custom ? name : lowerFirst(name);
    }
  }
  return variables;
};

/** Report text in the active language, from the `pdf` section of the locale files. */
export const tr = (key: string, options?: TOptions): string =>
  i18n.t(`pdf.${key}`, { ...roleVariables(), ...options });

/** siSwati follows the English number conventions used in Eswatini. */
const NUMBER_LOCALE: Record<ContentLanguage, string> = {
  en: "en-US",
  fr: "fr-FR",
  pt: "pt-PT",
  ss: "en-US",
};

const DATE_LOCALE: Record<ContentLanguage, string> = {
  en: "en-GB",
  fr: "fr-FR",
  pt: "pt-PT",
  ss: "en-GB",
};

/** Browsers ship no siSwati calendar data, so the CLDR month names are listed here. */
const SISWATI_MONTHS = [
  "Bhimbidvwane",
  "iNdlovana",
  "iNdlovu-lenkhulu",
  "Mabasa",
  "iNkhwekhweti",
  "iNhlaba",
  "Kholwane",
  "iNgci",
  "iNyoni",
  "iMphala",
  "Lweti",
  "iNgongoni",
];

const numberLocale = (): string => NUMBER_LOCALE[reportLanguage()];

/** Fixed decimals without grouping, like `toFixed` but with the report's decimal mark. */
export const fixed = (value: number, digits: number): string =>
  value.toLocaleString(numberLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });

/** Rounded to at most `digits` decimals, trailing zeros dropped, without grouping (chart labels). */
export const short = (value: number, digits = 1): string =>
  value.toLocaleString(numberLocale(), { maximumFractionDigits: digits, useGrouping: false });

/** Whole number with the report's thousands separator. */
export const grouped = (value: number): string =>
  value.toLocaleString(numberLocale(), { maximumFractionDigits: 0 });

/** French sets a narrow no-break space before the percent sign. */
export const percentSign = (): string => (reportLanguage() === "fr" ? "\u202F%" : "%");

/** Puts the report's percent sign into a fixed label such as a benchmark ("≥ 10%"). */
export const localizePercent = (text: string): string => text.replace(/%/g, percentSign());

export const percentText = (value: number, digits = 1): string =>
  `${fixed(value, digits)}${percentSign()}`;

/** Long date, e.g. "15 January 2026" / "15 janvier 2026" / "15 Bhimbidvwane 2026". */
export const longDate = (date: Date): string => {
  const language = reportLanguage();
  if (language === "ss") {
    return `${date.getDate()} ${SISWATI_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }
  return date.toLocaleDateString(DATE_LOCALE[language], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/** Joins items as "a, b and c" in the report language. */
export const listText = (items: readonly string[]): string =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} ${tr("common.and")} ${items[items.length - 1]}`;
