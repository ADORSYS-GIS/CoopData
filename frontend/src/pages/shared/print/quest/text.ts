import { PAR30_LIMIT, parTone, type QuestAnalysis } from "@/pages/shared/print/quest/data";
import type { StatusTone } from "@/pages/shared/print/tpl/TplParts";

export interface Checks {
  par30: StatusTone;
}

export const checksOf = (a: QuestAnalysis): Checks => ({
  par30: parTone(a.num("par_gt_30_pct")),
});

const pct = (value: number | null | undefined): string =>
  value == null ? "not reported" : `${value.toFixed(1)}%`;

export const verdictOf = (a: QuestAnalysis): { verdict: string; body: string } => {
  const c = checksOf(a);
  const margin = a.num("total_operating_margin_pct");
  const reported = [c.par30, margin === null ? "na" : margin >= 0 ? "ok" : "bad"].filter(
    (t) => t !== "na",
  );
  const breaches = reported.filter((t) => t === "bad").length;
  const watches = reported.filter((t) => t === "warn").length;
  const verdict =
    reported.length === 0
      ? "The questionnaire does not carry enough figures to assess the cooperative."
      : breaches === 0 && watches === 0
        ? "Sound on the reported indicators."
        : breaches > 0
          ? "Weaknesses on the reported indicators; corrective action is needed."
          : "Mixed results; some indicators need attention.";
  const body = [
    `${a.props.coopName} reports ${pct(a.num("active_members_pct"))} of members active and ${pct(a.num("women_members_pct"))} women members, with ${pct(a.num("savings_account_penetration_pct"))} savings account penetration.`,
    `PAR over 30 days is ${pct(a.num("par_gt_30_pct"))} (limit ${PAR30_LIMIT}%), the total operating margin is ${pct(margin)} and monetary reserve coverage is ${pct(a.num("monetary_reserve_coverage_pct"))}.`,
  ].join(" ");
  return { verdict, body };
};

export const strengthsOf = (a: QuestAnalysis): string[] => {
  const out: string[] = [];
  const par = a.num("par_gt_30_pct");
  if (checksOf(a).par30 === "ok")
    out.push(`PAR over 30 days is ${pct(par)}, within the ${PAR30_LIMIT}% limit.`);
  const women = a.num("women_members_pct");
  if (women !== null && women >= 40) out.push(`Women are ${pct(women)} of members.`);
  const active = a.num("active_members_pct");
  if (active !== null && active >= 80) out.push(`${pct(active)} of members are active.`);
  const margin = a.num("total_operating_margin_pct");
  if (margin !== null && margin > 0) out.push(`The total operating margin is ${pct(margin)}.`);
  const reserve = a.num("monetary_reserve_coverage_pct");
  if (reserve !== null && reserve >= 100)
    out.push(`Accumulated reserves are fully backed in the bank (${pct(reserve)}).`);
  return out.slice(0, 5);
};

export const concernsOf = (a: QuestAnalysis): string[] => {
  const c = checksOf(a);
  const out: string[] = [];
  if (c.par30 === "warn" || c.par30 === "bad")
    out.push(
      `PAR over 30 days is ${pct(a.num("par_gt_30_pct"))} against a limit of ${PAR30_LIMIT}%.`,
    );
  const margin = a.num("total_operating_margin_pct");
  if (margin !== null && margin < 0)
    out.push(`The total operating margin is negative (${pct(margin)}).`);
  const reserve = a.num("monetary_reserve_coverage_pct");
  if (reserve !== null && reserve < 100)
    out.push(`Only ${pct(reserve)} of accumulated reserves is held in the bank.`);
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
  const margin = a.num("total_operating_margin_pct");
  if (margin !== null && margin < 0)
    out.push({
      lead: "Operating performance.",
      text: "Present a plan to bring income above expenditure, starting with the main activity.",
      priority: "High",
      timeline: "Within 30 days",
    });
  const reserve = a.num("monetary_reserve_coverage_pct");
  if (reserve !== null && reserve < 100)
    out.push({
      lead: "Reserves.",
      text: "Move accumulated reserves into the bank until they are fully backed by actual funds.",
      priority: "Medium",
      timeline: "Next quarter",
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
