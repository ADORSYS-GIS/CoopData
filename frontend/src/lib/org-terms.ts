export type OrgTermKey = "federation" | "apex" | "cooperative" | "ministry";

export interface OrgTermLabels {
  label: string;
  plural_label: string;
}

const TERM_DEFAULTS: Record<
  OrgTermKey,
  { singular: string; plural: string; seedSingular: string }
> = {
  ministry: { singular: "Ministry", plural: "Ministries", seedSingular: "Ministry Official" },
  federation: {
    singular: "Federation",
    plural: "Federations",
    seedSingular: "Federation Officer",
  },
  apex: { singular: "Apex", plural: "Apexes", seedSingular: "Apex Officer" },
  cooperative: {
    singular: "Cooperative",
    plural: "Cooperatives",
    seedSingular: "Cooperative Manager",
  },
};

const TERM_KEYS = Object.keys(TERM_DEFAULTS) as OrgTermKey[];

let replacements = new Map<string, string>();
let pattern: RegExp | null = null;

const isOverride = (value: string | undefined, ...defaults: string[]): value is string =>
  !!value && value.trim().length > 0 && !defaults.includes(value);

/**
 * Registers the names the ministry configured for each level. A name that still equals the
 * built-in default is ignored, so an unconfigured level keeps its normal wording.
 * Returns true when the effective replacements changed.
 */
export function setOrgTermLabels(labels: Partial<Record<OrgTermKey, OrgTermLabels>>): boolean {
  const next = new Map<string, string>();
  for (const key of TERM_KEYS) {
    const configured = labels[key];
    const defaults = TERM_DEFAULTS[key];
    if (!configured) continue;
    if (isOverride(configured.label, defaults.singular, defaults.seedSingular)) {
      next.set(defaults.singular.toLowerCase(), configured.label.trim());
    }
    if (isOverride(configured.plural_label, defaults.plural)) {
      next.set(defaults.plural.toLowerCase(), configured.plural_label.trim());
    }
  }

  const same =
    next.size === replacements.size && [...next].every(([k, v]) => replacements.get(k) === v);
  if (same) return false;

  replacements = next;
  pattern =
    next.size === 0
      ? null
      : new RegExp(
          `\\b(${[...next.keys()].sort((a, b) => b.length - a.length).join("|")})\\b`,
          "gi",
        );
  return true;
}

/**
 * Swaps the default level words (Apex, Cooperatives, ...) in a text for the configured names.
 * A single pass, so a configured name that contains a default word is never replaced twice.
 */
export function replaceOrgTermsText(text: string): string {
  if (!pattern || !text || typeof text !== "string") return text;
  return text.replace(pattern, (match) => {
    const replacement = replacements.get(match.toLowerCase());
    if (replacement === undefined) return match;
    if (match === match.toLowerCase()) return replacement.toLowerCase();
    if (match.length > 1 && match === match.toUpperCase()) return replacement.toUpperCase();
    return replacement;
  });
}
