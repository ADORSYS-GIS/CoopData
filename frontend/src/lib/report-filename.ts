export type ConsolidatedLevel = "apex" | "federation" | "ministry";

const slug = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

/** Word that names each level in a file name; the same for every organisation. */
const LEVEL_WORD: Record<ConsolidatedLevel, string> = {
  apex: "regional",
  federation: "commissional",
  ministry: "ministry_national",
};

interface ConsolidatedNameInput {
  level: ConsolidatedLevel;
  /** Name of the apex or federation the report is about. */
  entityName?: string | null;
  year?: string | number | null;
  /** `questionnaire` marks a report built from questionnaire returns. */
  method?: "standard" | "questionnaire";
}

/**
 * File name of an exported consolidated report, for example `southern_sacco_regional_report_2026.pdf`,
 * `eswatini_federation_commissional_report_2026.pdf` or `ministry_national_report_2026.pdf`.
 */
export const consolidatedFilename = ({
  level,
  entityName,
  year,
  method = "standard",
}: ConsolidatedNameInput): string => {
  const suffix = year ? `_${year}` : "";
  const kind = method === "questionnaire" ? "questionnaire_report" : "report";
  const entity = level !== "ministry" && entityName ? slug(entityName) : "";
  return `${entity ? `${entity}_` : ""}${LEVEL_WORD[level]}_${kind}${suffix}.pdf`;
};

export const individualFilename = (
  cooperativeName?: string | null,
  year?: string | number | null,
): string => {
  const name = cooperativeName ? slug(cooperativeName) : "cooperative";
  return `${name}_${year ?? "report"}.pdf`;
};

/** Adds the report language to a file name: `report_2026.pdf` → `report_2026_fr.pdf`. */
export const withLanguage = (filename: string, lang: string): string =>
  filename.replace(/\.pdf$/i, "") + `_${lang}.pdf`;
