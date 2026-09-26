import type { CoopAnalysis, ScoreRow } from "@/pages/shared/print/coop/analysis";
import { fmtInt, fmtMillions, fmtPct } from "@/pages/shared/print/coop/data";

const AREA: Record<string, string> = {
  par30: "portfolio quality",
  par90: "portfolio quality",
  npl_ratio: "portfolio quality",
  loan_loss_coverage: "provisioning",
  capital_adequacy_ratio: "capital",
  roa: "profitability",
  roe: "profitability",
  operating_expense_ratio: "cost control",
  operational_self_sufficiency: "sustainability",
  liquid_funds_ratio: "liquidity",
};

const join = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const weak = (rows: ScoreRow[]): ScoreRow[] =>
  rows.filter((r) => !r.info && (r.tone === "bad" || r.tone === "na"));

export const growthNote = (a: CoopAnalysis): string => {
  const assets = a.growth[0]?.current;
  return assets === null || assets === undefined
    ? ""
    : `Total assets ${assets >= 0 ? "grew" : "fell"} ${Math.abs(assets).toFixed(1)}% on the prior year.`;
};

export const verdictOf = (a: CoopAnalysis): { verdict: string; body: string } => {
  const name = a.props.coopName;
  if (!a.reported) {
    return {
      verdict: "The return carries no total assets, so the cooperative cannot be assessed.",
      body: `${name} has no reported total assets for ${a.year}. Prudential ratios cannot be computed until the return is corrected and resubmitted.`,
    };
  }
  const byKey = new Map(a.scorecard.map((r) => [r.key, r]));
  const capital = byKey.get("capital_adequacy_ratio");
  const assetsGrowth = a.growth[0]?.current ?? null;
  const problems = weak(a.scorecard);
  const areas = [...new Set(problems.map((r) => AREA[r.key]).filter(Boolean))];
  const lead =
    capital?.tone === "bad"
      ? "Under-capitalised"
      : problems.length === 0
        ? "Financially sound"
        : capital?.tone === "ok"
          ? "Financially sound"
          : "Mixed financial results";
  const growth = assetsGrowth === null ? "" : assetsGrowth >= 0 ? " and growing" : " but shrinking";
  const tail =
    areas.length > 0
      ? `, with weaknesses in ${join(areas)}`
      : ", and all reported benchmarks are met";
  const facts = [
    `${name} reports total assets of ${fmtMillions(a.statement.totals.assets.current)}`,
    `equity of ${fmtMillions(a.statement.totals.equity.current)} and a net surplus of ${fmtMillions(a.statement.totals.surplus.current)}.`,
  ].join(", ");
  const status =
    problems.length > 0
      ? ` ${problems.length} of ${a.scorecard.filter((r) => !r.info).length} prudential indicators are in breach or cannot be relied upon.`
      : " All prudential indicators are within their benchmarks.";
  const validation =
    a.validation.length > 0
      ? ` ${a.validation.length} data inconsistenc${a.validation.length === 1 ? "y was" : "ies were"} found; see Annex A.`
      : "";
  return { verdict: `${lead}${growth}${tail}.`, body: `${facts}${status}${validation}` };
};

export const strengthsOf = (a: CoopAnalysis): string[] => {
  const out: string[] = [];
  const growth = growthNote(a);
  if (growth && (a.growth[0]?.current ?? 0) > 0) out.push(growth);
  for (const row of a.scorecard.filter((r) => !r.info && r.tone === "ok")) {
    out.push(`${row.label} is ${fmtPct(row.current)}, within the benchmark (${row.bench}).`);
  }
  const savings = a.growth[2]?.current;
  if (savings !== null && savings !== undefined && savings > 0)
    out.push(`Member savings grew ${savings.toFixed(1)}%.`);
  return out.slice(0, 5);
};

export const concernsOf = (a: CoopAnalysis): string[] => {
  const out: string[] = [];
  for (const row of weak(a.scorecard)) {
    out.push(
      row.tone === "na"
        ? `${row.label} cannot be assessed because no figure is reported.`
        : `${row.label} is ${fmtPct(row.current)} against a benchmark of ${row.bench}.`,
    );
  }
  if ((a.growth[0]?.current ?? 0) < 0) out.push(growthNote(a));
  if (a.validation.length > 0)
    out.push(
      `System-generated figures did not reconcile in ${a.validation.length} place${a.validation.length === 1 ? "" : "s"}; see Annex A.`,
    );
  return out.slice(0, 5);
};

export interface Recommendation {
  lead: string;
  text: string;
  priority: "High" | "Medium" | "Standard";
  timeline: string;
}

const ACTIONS: Record<string, [string, string, "High" | "Medium"]> = {
  par30: [
    "Portfolio quality.",
    "Submit a loan-ageing schedule and reconcile the reported PAR to the loan register.",
    "High",
  ],
  par90: [
    "Non-performing loans.",
    "Prepare a recovery plan for loans more than 90 days overdue.",
    "High",
  ],
  npl_ratio: [
    "Non-performing loans.",
    "Prepare a recovery plan for loans more than 90 days overdue.",
    "High",
  ],
  loan_loss_coverage: [
    "Provisioning.",
    "Establish loan-loss provisions in line with prudential standards (general 1–2%; specific 100% for loans >90 days) and record the provision expense.",
    "High",
  ],
  capital_adequacy_ratio: [
    "Capital restoration.",
    "Present a capital-building plan to bring total equity to at least 10% of total assets.",
    "High",
  ],
  roa: [
    "Profitability.",
    "Review lending rates and the cost structure to lift return on assets towards 3%.",
    "Medium",
  ],
  roe: [
    "Returns to members.",
    "Review surplus allocation and cost structure to lift return on equity towards 8%.",
    "Medium",
  ],
  operating_expense_ratio: [
    "Efficiency.",
    "Set a cost-reduction plan to bring operating expenses within 5% of assets.",
    "Medium",
  ],
  operational_self_sufficiency: [
    "Sustainability.",
    "Adjust pricing and costs so that income covers expenses by at least 110%.",
    "Medium",
  ],
  liquid_funds_ratio: [
    "Liquidity.",
    "Build liquid assets to at least 15% of total assets.",
    "Medium",
  ],
};

export const recommendationsOf = (a: CoopAnalysis): Recommendation[] => {
  const out: Recommendation[] = [];
  const seen = new Set<string>();
  for (const row of weak(a.scorecard)) {
    const action = ACTIONS[row.key];
    if (!action || seen.has(action[0])) continue;
    seen.add(action[0]);
    out.push({
      lead: action[0],
      text: action[1],
      priority: action[2],
      timeline: action[2] === "High" ? "Within 30 days" : "Next quarter",
    });
  }
  if (a.validation.length > 0) {
    out.push({
      lead: "Data reconciliation.",
      text: `Correct and resubmit the return so that the ${a.validation.length} item${a.validation.length === 1 ? "" : "s"} in Annex A reconcile with the statements.`,
      priority: "High",
      timeline: "Within 30 days",
    });
  }
  out.push({
    lead: "Membership and inclusion.",
    text: "Report member and borrower demographics (women, youth, rural) and set targets for inclusion.",
    priority: "Standard",
    timeline: "Next financial year",
  });
  return out;
};

export const scoreText = (row: ScoreRow): string => fmtPct(row.current);
export const wholeNumber = fmtInt;
