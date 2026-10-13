import type { CoopAnalysis, ScoreRow } from "@/pages/shared/print/coop/analysis";
import { fmtInt, fmtMillions, fmtPct } from "@/pages/shared/print/coop/data";
import { listText, percentText, tr } from "@/pages/shared/print/tpl/i18n";

const AREA_KEYS = new Set([
  "par30",
  "par90",
  "npl_ratio",
  "loan_loss_coverage",
  "capital_adequacy_ratio",
  "roa",
  "roe",
  "operating_expense_ratio",
  "operational_self_sufficiency",
  "liquid_funds_ratio",
]);

const areaOf = (key: string): string | undefined =>
  AREA_KEYS.has(key) ? tr(`coop.areas.${key}`) : undefined;

const weak = (rows: ScoreRow[]): ScoreRow[] =>
  rows.filter((r) => !r.info && (r.tone === "bad" || r.tone === "na"));

export const growthNote = (a: CoopAnalysis): string => {
  const assets = a.growth[0]?.current;
  return assets === null || assets === undefined
    ? ""
    : tr(assets >= 0 ? "coop.text.assets_grew" : "coop.text.assets_fell", {
        change: percentText(Math.abs(assets)),
      });
};

export const verdictOf = (a: CoopAnalysis): { verdict: string; body: string } => {
  const name = a.props.coopName;
  if (!a.reported) {
    return {
      verdict: tr("coop.text.no_assets_verdict"),
      body: tr("coop.text.no_assets_body", { name, year: a.year }),
    };
  }
  const byKey = new Map(a.scorecard.map((r) => [r.key, r]));
  const capital = byKey.get("capital_adequacy_ratio");
  const assetsGrowth = a.growth[0]?.current ?? null;
  const problems = weak(a.scorecard);
  const areas = [
    ...new Set(problems.map((r) => areaOf(r.key)).filter((x): x is string => Boolean(x))),
  ];
  const lead =
    capital?.tone === "bad"
      ? tr("coop.text.lead_under_capitalised")
      : problems.length === 0 || capital?.tone === "ok"
        ? tr("coop.text.lead_sound")
        : tr("coop.text.lead_mixed");
  const growth =
    assetsGrowth === null
      ? ""
      : assetsGrowth >= 0
        ? tr("coop.text.growing")
        : tr("coop.text.shrinking");
  const tail =
    areas.length > 0
      ? tr("coop.text.with_weaknesses", { areas: listText(areas) })
      : tr("coop.text.all_met");
  const facts = tr("coop.text.facts", {
    name,
    assets: fmtMillions(a.statement.totals.assets.current),
    equity: fmtMillions(a.statement.totals.equity.current),
    surplus: fmtMillions(a.statement.totals.surplus.current),
  });
  const status =
    problems.length > 0
      ? tr("coop.text.problems", {
          count: problems.length,
          total: a.scorecard.filter((r) => !r.info).length,
        })
      : tr("coop.text.no_problems");
  const validation =
    a.validation.length > 0 ? tr("coop.text.inconsistencies", { count: a.validation.length }) : "";
  return { verdict: `${lead}${growth}${tail}.`, body: `${facts}${status}${validation}` };
};

export const strengthsOf = (a: CoopAnalysis): string[] => {
  const out: string[] = [];
  const growth = growthNote(a);
  if (growth && (a.growth[0]?.current ?? 0) > 0) out.push(growth);
  for (const row of a.scorecard.filter((r) => !r.info && r.tone === "ok")) {
    out.push(
      tr("coop.text.within_benchmark", {
        label: row.label,
        value: fmtPct(row.current),
        bench: row.bench,
      }),
    );
  }
  const savings = a.growth[2]?.current;
  if (savings !== null && savings !== undefined && savings > 0)
    out.push(tr("coop.text.savings_grew", { change: percentText(savings) }));
  return out.slice(0, 5);
};

export const concernsOf = (a: CoopAnalysis): string[] => {
  const out: string[] = [];
  for (const row of weak(a.scorecard)) {
    out.push(
      row.tone === "na"
        ? tr("coop.text.not_reported", { label: row.label })
        : tr("coop.text.against_benchmark", {
            label: row.label,
            value: fmtPct(row.current),
            bench: row.bench,
          }),
    );
  }
  if ((a.growth[0]?.current ?? 0) < 0) out.push(growthNote(a));
  if (a.validation.length > 0)
    out.push(tr("coop.text.not_reconciled", { count: a.validation.length }));
  return out.slice(0, 5);
};

export type Priority = "High" | "Medium" | "Standard";

export interface Recommendation {
  lead: string;
  text: string;
  priority: Priority;
  timeline: string;
}

/** Recommended action per ratio key; NPL shares the PAR >90 days action. */
const ACTIONS: Record<string, [string, "High" | "Medium"]> = {
  par30: ["par30", "High"],
  par90: ["par90", "High"],
  npl_ratio: ["par90", "High"],
  loan_loss_coverage: ["loan_loss_coverage", "High"],
  capital_adequacy_ratio: ["capital_adequacy_ratio", "High"],
  roa: ["roa", "Medium"],
  roe: ["roe", "Medium"],
  operating_expense_ratio: ["operating_expense_ratio", "Medium"],
  operational_self_sufficiency: ["operational_self_sufficiency", "Medium"],
  liquid_funds_ratio: ["liquid_funds_ratio", "Medium"],
};

export const recommendationsOf = (a: CoopAnalysis): Recommendation[] => {
  const out: Recommendation[] = [];
  const seen = new Set<string>();
  for (const row of weak(a.scorecard)) {
    const action = ACTIONS[row.key];
    if (!action || seen.has(action[0])) continue;
    seen.add(action[0]);
    out.push({
      lead: tr(`coop.actions.${action[0]}.lead`),
      text: tr(`coop.actions.${action[0]}.text`),
      priority: action[1],
      timeline: tr(
        action[1] === "High" ? "common.timelines.within_30_days" : "common.timelines.next_quarter",
      ),
    });
  }
  if (a.validation.length > 0) {
    out.push({
      lead: tr("coop.actions.reconciliation_lead"),
      text: tr("coop.actions.reconciliation", { count: a.validation.length }),
      priority: "High",
      timeline: tr("common.timelines.within_30_days"),
    });
  }
  out.push({
    lead: tr("coop.actions.inclusion_lead"),
    text: tr("coop.actions.inclusion"),
    priority: "Standard",
    timeline: tr("common.timelines.next_financial_year"),
  });
  return out;
};

export const scoreText = (row: ScoreRow): string => fmtPct(row.current);
export const wholeNumber = fmtInt;
