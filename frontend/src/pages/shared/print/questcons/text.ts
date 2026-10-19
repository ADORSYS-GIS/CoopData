import { par30Limit, type QuestAnalysis } from "@/pages/shared/print/quest/data";
import type { Recommendation } from "@/pages/shared/print/quest/text";
import { coverageOf, complianceOf } from "@/pages/shared/print/questcons/stats";
import { tr } from "@/pages/shared/print/tpl/i18n";

/** Text for a count that reads differently in the singular (`_one`) and the plural (`_other`). */
const counted = (key: string, count: number, extra: Record<string, unknown> = {}): string =>
  tr(`quest.cons.${key}_${count === 1 ? "one" : "other"}`, { count, ...extra });

export const concernsOf = (a: QuestAnalysis): string[] => {
  const { dashboard } = a.props;
  const c = complianceOf(dashboard);
  const cover = coverageOf(dashboard);
  const out: string[] = [];
  if (c.par30.below > 0) out.push(counted("con_par", c.par30.below, { limit: par30Limit() }));
  if (c.operatingMargin.below > 0) out.push(counted("con_margin", c.operatingMargin.below));
  if (c.reserveCoverage.below > 0) out.push(counted("con_reserve", c.reserveCoverage.below));
  if (cover.missing > 0) out.push(counted("con_missing_coops", cover.missing));
  const missing = dashboard.indicators.filter((i) => i.value === null).length;
  if (missing > 0) out.push(counted("con_missing_ind", missing));
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
        ? tr("quest.cons.str_filed_one")
        : tr("quest.cons.str_filed_all", { count: cover.inScope }),
    );
  if (c.par30.meets > 0) out.push(counted("str_par", c.par30.meets, { limit: par30Limit() }));
  if (c.operatingMargin.meets > 0) out.push(counted("str_margin", c.operatingMargin.meets));
  if (c.reserveCoverage.meets > 0) out.push(counted("str_reserve", c.reserveCoverage.meets));
  return out.slice(0, 5);
};

export const recommendationsOf = (a: QuestAnalysis): Recommendation[] => {
  const { dashboard } = a.props;
  const c = complianceOf(dashboard);
  const cover = coverageOf(dashboard);
  const out: Recommendation[] = [];
  if (c.par30.below > 0)
    out.push({
      lead: tr("quest.rec.portfolio.lead"),
      text: tr("quest.cons.rec_portfolio_text", { count: c.par30.below, limit: par30Limit() }),
      priority: "High",
      timeline: tr("common.timelines.within_30_days"),
    });
  if (c.operatingMargin.below > 0)
    out.push({
      lead: tr("quest.rec.operating.lead"),
      text: tr("quest.cons.rec_operating_text", { count: c.operatingMargin.below }),
      priority: "High",
      timeline: tr("common.timelines.within_30_days"),
    });
  if (c.reserveCoverage.below > 0)
    out.push({
      lead: tr("quest.rec.reserves.lead"),
      text: tr("quest.cons.rec_reserves_text", { count: c.reserveCoverage.below }),
      priority: "Medium",
      timeline: tr("common.timelines.next_quarter"),
    });
  if (cover.missing > 0)
    out.push({
      lead: tr("quest.cons.rec_coverage_lead"),
      text: tr("quest.cons.rec_coverage_text", { count: cover.missing }),
      priority: "Medium",
      timeline: tr("quest.timeline_next_return"),
    });
  if (dashboard.indicators.some((i) => i.value === null))
    out.push({
      lead: tr("quest.cons.rec_data_lead"),
      text: tr("quest.cons.rec_data_text"),
      priority: "Medium",
      timeline: tr("quest.timeline_next_return"),
    });
  out.push({
    lead: tr("quest.rec.statements.lead"),
    text: tr("quest.cons.rec_statements_text"),
    priority: "Standard",
    timeline: tr("common.timelines.next_financial_year"),
  });
  return out;
};
