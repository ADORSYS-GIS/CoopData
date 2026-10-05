import {
  PAR30_LIMIT,
  PAR90_LIMIT,
  minimumTone,
  parTone,
  type QuestAnalysis,
} from "@/pages/shared/print/quest/data";
import type { StatusTone } from "@/pages/shared/print/tpl/TplParts";

export interface Checks {
  par30: StatusTone;
  liquidity: StatusTone;
  capital: StatusTone;
}

export const checksOf = (a: QuestAnalysis): Checks => {
  const { thresholds } = a.props.dashboard;
  return {
    par30: parTone(a.num("par_gt_30_pct")),
    liquidity: minimumTone(a.num("liquidity_ratio_pct"), thresholds.liquidity_minimum_pct),
    capital: minimumTone(
      a.num("institutional_capital_ratio_pct"),
      thresholds.institutional_capital_minimum_pct,
    ),
  };
};

const pct = (value: number | null): string =>
  value === null ? "not reported" : `${value.toFixed(1)}%`;

export const verdictOf = (a: QuestAnalysis): { verdict: string; body: string } => {
  const c = checksOf(a);
  const reported = [c.par30, c.liquidity, c.capital].filter((t) => t !== "na");
  const breaches = reported.filter((t) => t === "bad").length;
  const watches = reported.filter((t) => t === "warn").length;
  const verdict =
    reported.length === 0
      ? "The questionnaire does not carry enough figures to assess the cooperative."
      : breaches === 0 && watches === 0
        ? "Sound on the reported indicators, with all regulatory minimums met."
        : breaches > 0
          ? "Weaknesses on the reported indicators; corrective action is needed."
          : "Mixed results; some indicators need attention.";
  const body = [
    `${a.props.coopName} reports ${a.text("registered_members")} members, total assets of ${a.text("total_assets")}, member deposits of ${a.text("total_deposits")} and a gross loan portfolio of ${a.text("gross_loan_portfolio")}.`,
    `PAR over 30 days is ${pct(a.num("par_gt_30_pct"))} (limit ${PAR30_LIMIT}%), liquidity is ${pct(a.num("liquidity_ratio_pct"))} of member savings and institutional capital is ${pct(a.num("institutional_capital_ratio_pct"))} of total assets.`,
  ].join(" ");
  return { verdict, body };
};

export const strengthsOf = (a: QuestAnalysis): string[] => {
  const c = checksOf(a);
  const out: string[] = [];
  if (c.par30 === "ok")
    out.push(
      `PAR over 30 days is ${pct(a.num("par_gt_30_pct"))}, within the ${PAR30_LIMIT}% limit.`,
    );
  if (c.liquidity === "ok")
    out.push(`Liquidity of ${pct(a.num("liquidity_ratio_pct"))} meets the minimum.`);
  if (c.capital === "ok")
    out.push(
      `Institutional capital of ${pct(a.num("institutional_capital_ratio_pct"))} meets the minimum.`,
    );
  const women = a.num("women_members_pct");
  if (women !== null && women >= 40) out.push(`Women are ${pct(women)} of members.`);
  return out.slice(0, 5);
};

export const concernsOf = (a: QuestAnalysis): string[] => {
  const c = checksOf(a);
  const out: string[] = [];
  if (c.par30 === "warn" || c.par30 === "bad")
    out.push(
      `PAR over 30 days is ${pct(a.num("par_gt_30_pct"))} against a limit of ${PAR30_LIMIT}%.`,
    );
  const par90 = a.num("par_gt_90_pct");
  if (par90 !== null && par90 > PAR90_LIMIT)
    out.push(`PAR over 90 days is ${pct(par90)} against a limit of ${PAR90_LIMIT}%.`);
  if (c.liquidity === "warn" || c.liquidity === "bad")
    out.push(
      `Liquidity of ${pct(a.num("liquidity_ratio_pct"))} is below the ${a.props.dashboard.thresholds.liquidity_minimum_pct}% minimum.`,
    );
  if (c.capital === "warn" || c.capital === "bad")
    out.push(
      `Institutional capital of ${pct(a.num("institutional_capital_ratio_pct"))} is below the ${a.props.dashboard.thresholds.institutional_capital_minimum_pct}% minimum.`,
    );
  const missing = a.props.dashboard.indicators.filter((i) => i.value === null).length;
  if (missing > 0)
    out.push(`${missing} indicators could not be computed from the answers given; see Annex A.`);
  return out.slice(0, 5);
};

export interface Recommendation {
  lead: string;
  text: string;
  priority: "High" | "Medium" | "Standard";
  timeline: string;
}

export const recommendationsOf = (a: QuestAnalysis): Recommendation[] => {
  const c = checksOf(a);
  const out: Recommendation[] = [];
  if (c.par30 === "warn" || c.par30 === "bad")
    out.push({
      lead: "Portfolio quality.",
      text: "Prepare a recovery plan for overdue loans and report progress with the next return.",
      priority: "High",
      timeline: "Within 30 days",
    });
  if (c.liquidity === "warn" || c.liquidity === "bad")
    out.push({
      lead: "Liquidity.",
      text: `Build liquid assets to at least ${a.props.dashboard.thresholds.liquidity_minimum_pct}% of member savings.`,
      priority: "High",
      timeline: "Within 30 days",
    });
  if (c.capital === "warn" || c.capital === "bad")
    out.push({
      lead: "Capital.",
      text: `Present a plan to raise institutional capital to at least ${a.props.dashboard.thresholds.institutional_capital_minimum_pct}% of total assets.`,
      priority: "High",
      timeline: "Within 30 days",
    });
  if (a.props.dashboard.indicators.some((i) => i.value === null))
    out.push({
      lead: "Reporting.",
      text: "Complete the questionnaire fields listed in Annex A so that every indicator can be computed.",
      priority: "Medium",
      timeline: "Next return",
    });
  out.push({
    lead: "Financial statements.",
    text: "Move to full statement reporting when the cooperative is ready, so that ratios are computed from ledger balances.",
    priority: "Standard",
    timeline: "Next financial year",
  });
  return out;
};
