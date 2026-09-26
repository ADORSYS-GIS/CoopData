export type ConsolidatedLevel = "apex" | "federation" | "ministry";

const slug = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

interface ConsolidatedNameInput {
  level: ConsolidatedLevel;
  /** Name of the apex or federation the report is about. */
  entityName?: string | null;
  year?: string | number | null;
}

/**
 * File name of an exported consolidated report, for example
 * `southern_sacco_association_apex_report_2026.pdf`. It names the entity and the
 * level, so reports of different apexes or federations never share a name.
 */
export const consolidatedFilename = ({
  level,
  entityName,
  year,
}: ConsolidatedNameInput): string => {
  const suffix = year ? `_${year}` : "";
  if (level === "ministry") return `ministry_national_report${suffix}.pdf`;
  const entity = entityName ? slug(entityName) : "";
  return `${entity ? `${entity}_` : ""}${level}_report${suffix}.pdf`;
};

export const individualFilename = (
  cooperativeName?: string | null,
  year?: string | number | null,
): string => {
  const name = cooperativeName ? slug(cooperativeName) : "cooperative";
  return `${name}_${year ?? "report"}.pdf`;
};
