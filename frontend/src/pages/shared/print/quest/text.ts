import { par30Limit, parTone, pct, type QuestAnalysis } from "@/pages/shared/print/quest/data";
import { tr } from "@/pages/shared/print/tpl/i18n";
import type { StatusTone } from "@/pages/shared/print/tpl/TplParts";

export interface Checks {
  par30: StatusTone;
}

export const checksOf = (a: QuestAnalysis): Checks => ({
  par30: parTone(a.num("par_gt_30_pct")),
});

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
      ? tr("quest.verdict_none")
      : breaches === 0 && watches === 0
        ? tr("quest.verdict_sound")
        : breaches > 0
          ? tr("quest.verdict_weak")
          : tr("quest.verdict_mixed");
  const body = [
    tr("quest.body_a", {
      name: a.props.coopName,
      active: pct(a.num("active_members_pct")),
      women: pct(a.num("women_members_pct")),
      penetration: pct(a.num("savings_account_penetration_pct")),
    }),
    tr("quest.body_b", {
      par: pct(a.num("par_gt_30_pct")),
      limit: par30Limit(),
      margin: pct(margin),
      reserve: pct(a.num("monetary_reserve_coverage_pct")),
    }),
  ].join(" ");
  return { verdict, body };
};

export const strengthsOf = (a: QuestAnalysis): string[] => {
  const out: string[] = [];
  if (checksOf(a).par30 === "ok")
    out.push(tr("quest.str_par", { value: pct(a.num("par_gt_30_pct")), limit: par30Limit() }));
  const women = a.num("women_members_pct");
  if (women !== null && women >= 40) out.push(tr("quest.str_women", { value: pct(women) }));
  const active = a.num("active_members_pct");
  if (active !== null && active >= 80) out.push(tr("quest.str_active", { value: pct(active) }));
  const margin = a.num("total_operating_margin_pct");
  if (margin !== null && margin > 0) out.push(tr("quest.str_margin", { value: pct(margin) }));
  const reserve = a.num("monetary_reserve_coverage_pct");
  if (reserve !== null && reserve >= 100)
    out.push(tr("quest.str_reserve", { value: pct(reserve) }));
  return out.slice(0, 5);
};

export const concernsOf = (a: QuestAnalysis): string[] => {
  const c = checksOf(a);
  const out: string[] = [];
  if (c.par30 === "warn" || c.par30 === "bad")
    out.push(tr("quest.con_par", { value: pct(a.num("par_gt_30_pct")), limit: par30Limit() }));
  const margin = a.num("total_operating_margin_pct");
  if (margin !== null && margin < 0) out.push(tr("quest.con_margin", { value: pct(margin) }));
  const reserve = a.num("monetary_reserve_coverage_pct");
  if (reserve !== null && reserve < 100) out.push(tr("quest.con_reserve", { value: pct(reserve) }));
  const missing = a.props.dashboard.indicators.filter((i) => i.value === null).length;
  if (missing > 0) out.push(tr("quest.con_missing", { count: missing }));
  return out.slice(0, 5);
};

export type Priority = "High" | "Medium" | "Standard";

export interface Recommendation {
  lead: string;
  text: string;
  priority: Priority;
  timeline: string;
}

export const recommendationsOf = (a: QuestAnalysis): Recommendation[] => {
  const c = checksOf(a);
  const out: Recommendation[] = [];
  if (c.par30 === "warn" || c.par30 === "bad")
    out.push({
      lead: tr("quest.rec.portfolio.lead"),
      text: tr("quest.rec.portfolio.text"),
      priority: "High",
      timeline: tr("common.timelines.within_30_days"),
    });
  const margin = a.num("total_operating_margin_pct");
  if (margin !== null && margin < 0)
    out.push({
      lead: tr("quest.rec.operating.lead"),
      text: tr("quest.rec.operating.text"),
      priority: "High",
      timeline: tr("common.timelines.within_30_days"),
    });
  const reserve = a.num("monetary_reserve_coverage_pct");
  if (reserve !== null && reserve < 100)
    out.push({
      lead: tr("quest.rec.reserves.lead"),
      text: tr("quest.rec.reserves.text"),
      priority: "Medium",
      timeline: tr("common.timelines.next_quarter"),
    });
  if (a.props.dashboard.indicators.some((i) => i.value === null))
    out.push({
      lead: tr("quest.rec.reporting.lead"),
      text: tr("quest.rec.reporting.text"),
      priority: "Medium",
      timeline: tr("quest.timeline_next_return"),
    });
  out.push({
    lead: tr("quest.rec.statements.lead"),
    text: tr("quest.rec.statements.text"),
    priority: "Standard",
    timeline: tr("common.timelines.next_financial_year"),
  });
  return out;
};
