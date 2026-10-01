import type { TOptions } from "i18next";

import i18n from "@/i18n";
import { normalizeAppLang, type ContentLanguage } from "@/lib/contentLocalization";

/** Report text in the active language, from the `pdf` section of the locale files. */
export const tr = (key: string, options?: TOptions): string => i18n.t(`pdf.${key}`, options);

export const reportLanguage = (): ContentLanguage =>
  normalizeAppLang(i18n.resolvedLanguage ?? i18n.language);

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
