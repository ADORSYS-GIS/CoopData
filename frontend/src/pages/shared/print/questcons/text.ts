import { PAR30_LIMIT, type QuestAnalysis } from "@/pages/shared/print/quest/data";
import type { Recommendation } from "@/pages/shared/print/quest/text";
import { coverageOf, complianceOf } from "@/pages/shared/print/questcons/stats";

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const concernsOf = (a: QuestAnalysis): string[] => {
  const { dashboard } = a.props;
  const c = complianceOf(dashboard);
  const cover = coverageOf(dashboard);
  const out: string[] = [];
  if (c.par30.below > 0)
    out.push(
      `${plural(c.par30.below, "cooperative has", "cooperatives have")} PAR over 30 days above ${PAR30_LIMIT}%.`,
    );
  if (c.operatingMargin.below > 0)
    out.push(
      `${plural(c.operatingMargin.below, "cooperative has", "cooperatives have")} a negative total operating margin.`,
    );
  if (c.reserveCoverage.below > 0)
    out.push(
      `${plural(c.reserveCoverage.below, "cooperative holds", "cooperatives hold")} less than its accumulated reserves in the bank.`,
    );
  if (cover.missing > 0)
    out.push(
      `${plural(cover.missing, "cooperative has", "cooperatives have")} no questionnaire return for this period.`,
    );
  const missing = dashboard.indicators.filter((i) => i.value === null).length;
  if (missing > 0)
    out.push(
      `${plural(missing, "indicator", "indicators")} could not be computed from the answers given; see Annex A.`,
    );
  return out.slice(0, 5);
};

export const strengthsOf = (a: QuestAnalysis): string[] => {
  const { dashboard } = a.props;
  const c = complianceOf(dashboard);
  const cover = coverageOf(dashboard);
  const out: string[] = [];
  if (cover.inScope > 0 && cover.missing === 0)
    out.push(
      cover.inScope === 1
        ? "The cooperative in scope filed a questionnaire."
        : `All ${cover.inScope} cooperatives in scope filed a questionnaire.`,
    );
  if (c.par30.meets > 0)
    out.push(
      `${plural(c.par30.meets, "cooperative keeps", "cooperatives keep")} PAR over 30 days within ${PAR30_LIMIT}%.`,
    );
  if (c.operatingMargin.meets > 0)
    out.push(
      `${plural(c.operatingMargin.meets, "cooperative reports", "cooperatives report")} a non-negative total operating margin.`,
    );
  if (c.reserveCoverage.meets > 0)
    out.push(
      `${plural(c.reserveCoverage.meets, "cooperative has", "cooperatives have")} its reserves fully backed in the bank.`,
    );
  return out.slice(0, 5);
};

export const recommendationsOf = (a: QuestAnalysis): Recommendation[] => {
  const { dashboard } = a.props;
  const c = complianceOf(dashboard);
  const cover = coverageOf(dashboard);
  const out: Recommendation[] = [];
  if (c.par30.below > 0)
    out.push({
      lead: "Portfolio quality.",
      text: `Require a recovery plan from the ${plural(c.par30.below, "cooperative", "cooperatives")} above the ${PAR30_LIMIT}% PAR limit and follow progress each period.`,
      priority: "High",
      timeline: "Within 30 days",
    });
  if (c.operatingMargin.below > 0)
    out.push({
      lead: "Operating performance.",
      text: `Agree recovery plans with the ${plural(c.operatingMargin.below, "cooperative", "cooperatives")} running an operating deficit.`,
      priority: "High",
      timeline: "Within 30 days",
    });
  if (c.reserveCoverage.below > 0)
    out.push({
      lead: "Reserves.",
      text: `Ask the ${plural(c.reserveCoverage.below, "cooperative", "cooperatives")} with unbacked reserves to move them into the bank.`,
      priority: "Medium",
      timeline: "Next quarter",
    });
  if (cover.missing > 0)
    out.push({
      lead: "Reporting coverage.",
      text: `Follow up the ${plural(cover.missing, "cooperative", "cooperatives")} that did not file, so that the next report covers every cooperative.`,
      priority: "Medium",
      timeline: "Next return",
    });
  if (dashboard.indicators.some((i) => i.value === null))
    out.push({
      lead: "Data quality.",
      text: "Ask cooperatives to complete the questionnaire fields listed in Annex A so that every indicator can be computed.",
      priority: "Medium",
      timeline: "Next return",
    });
  out.push({
    lead: "Financial statements.",
    text: "Encourage cooperatives to move to full statement reporting, so that ratios are computed from ledger balances.",
    priority: "Standard",
    timeline: "Next financial year",
  });
  return out;
};
