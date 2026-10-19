import { narrativeText } from "@/lib/questionnaire-report";
import { IndicatorTable } from "@/pages/shared/print/quest/IndicatorTable";
import { PAR30_LIMIT, par30Limit, type QuestAnalysis } from "@/pages/shared/print/quest/data";
import { checksOf } from "@/pages/shared/print/quest/text";
import { tr } from "@/pages/shared/print/tpl/i18n";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure, Pill } from "@/pages/shared/print/tpl/TplParts";
import { LineChart } from "@/pages/shared/print/tpl/TplTrend";
import { INDICATOR_KEYS } from "@/types/basic-dashboard";

const hasValues = (values: (number | null)[]): boolean => values.some((v) => v !== null);

export const savingsLoanQualityPage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: tr("quest.savings.title") },
  render: () => {
    const par30 = a.line("risk", "par_gt_30_pct");
    const checks = checksOf(a);
    const narrative = narrativeText(a.props.narratives, "portfolio_quality");
    return (
      <>
        <Sec no={no} title={tr("quest.savings.title")} sub={a.period} />
        <p>
          {tr("quest.savings.summary_a", {
            penetration: a.text("savings_account_penetration_pct"),
            par: a.text("par_gt_30_pct"),
            limit: par30Limit(),
          })}
          <Pill tone={checks.par30} />
          {tr("quest.savings.summary_b", {
            delinquent: a.text("delinquent_loan_account_rate_pct"),
          })}
        </p>
        {narrative && (
          <div className="opinion keep">
            <div className="lbl">{tr("quest.savings.insights")}</div>
            <p style={{ margin: 0 }}>{narrative}</p>
          </div>
        )}
        {hasValues(par30.values) && par30.labels.length > 1 && (
          <Figure
            caption={
              <>
                <b>{tr("quest.figure", { id: "R1" })}</b> {tr("quest.savings.fig_r1")}
              </>
            }
          >
            <LineChart
              labels={par30.labels}
              values={par30.values}
              unit={tr("quest.savings.unit_par")}
              limit={{ value: PAR30_LIMIT, label: tr("common.max_limit", { value: par30Limit() }) }}
            />
          </Figure>
        )}
        <h3>{tr("quest.savings.savings_heading")}</h3>
        <IndicatorTable a={a} keys={INDICATOR_KEYS.savings} />
        <h3>{tr("quest.savings.loans_heading")}</h3>
        <IndicatorTable a={a} keys={INDICATOR_KEYS.risk} />
      </>
    );
  },
});

export const resiliencePage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: tr("quest.resilience.title") },
  render: () => {
    const reserve = a.line("capital", "monetary_reserve_coverage_pct");
    const narrative = narrativeText(a.props.narratives, "liquidity_capital");
    return (
      <>
        <Sec no={no} title={tr("quest.resilience.title")} sub={a.period} />
        <p>
          {tr("quest.resilience.summary", { reserve: a.text("monetary_reserve_coverage_pct") })}
        </p>
        {narrative && (
          <div className="opinion keep">
            <div className="lbl">{tr("quest.resilience.insights")}</div>
            <p style={{ margin: 0 }}>{narrative}</p>
          </div>
        )}
        {hasValues(reserve.values) && reserve.labels.length > 1 && (
          <Figure
            caption={
              <>
                <b>{tr("quest.figure", { id: "L1" })}</b> {tr("quest.resilience.fig_l1")}
              </>
            }
          >
            <LineChart
              labels={reserve.labels}
              values={reserve.values}
              unit={tr("quest.resilience.unit")}
            />
          </Figure>
        )}
        <IndicatorTable a={a} keys={INDICATOR_KEYS.capital} />
      </>
    );
  },
});
