import { narrativeText } from "@/lib/questionnaire-report";
import { IndicatorTable } from "@/pages/shared/print/quest/IndicatorTable";
import { PAR30_LIMIT, type QuestAnalysis } from "@/pages/shared/print/quest/data";
import { checksOf } from "@/pages/shared/print/quest/text";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure, Pill } from "@/pages/shared/print/tpl/TplParts";
import { LineChart } from "@/pages/shared/print/tpl/TplTrend";
import { INDICATOR_KEYS } from "@/types/basic-dashboard";

const hasValues = (values: (number | null)[]): boolean => values.some((v) => v !== null);

export const savingsLoanQualityPage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Savings & Loan Quality" },
  render: () => {
    const par30 = a.line("risk", "par_gt_30_pct");
    const checks = checksOf(a);
    const narrative = narrativeText(a.props.narratives, "portfolio_quality");
    return (
      <>
        <Sec no={no} title="Savings & Loan Quality" sub={a.period} />
        <p>
          Savings accounts equal {a.text("savings_account_penetration_pct")} of registered members.
          PAR over 30 days is {a.text("par_gt_30_pct")} against a limit of {PAR30_LIMIT}% (
          <Pill tone={checks.par30} />
          ), and {a.text("delinquent_loan_account_rate_pct")} of outstanding loan accounts are
          delinquent.
        </p>
        {narrative && (
          <div className="opinion keep">
            <div className="lbl">Portfolio insights</div>
            <p style={{ margin: 0 }}>{narrative}</p>
          </div>
        )}
        {hasValues(par30.values) && par30.labels.length > 1 && (
          <Figure
            caption={
              <>
                <b>Figure R1.</b> PAR over 30 days (%).
              </>
            }
          >
            <LineChart
              labels={par30.labels}
              values={par30.values}
              unit="% of outstanding loans"
              limit={{ value: PAR30_LIMIT, label: `Max ${PAR30_LIMIT}%` }}
            />
          </Figure>
        )}
        <h3>Savings mobilisation</h3>
        <IndicatorTable a={a} keys={INDICATOR_KEYS.savings} />
        <h3>Loan portfolio quality</h3>
        <IndicatorTable a={a} keys={INDICATOR_KEYS.risk} />
      </>
    );
  },
});

export const resiliencePage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Institutional Resilience" },
  render: () => {
    const reserve = a.line("capital", "monetary_reserve_coverage_pct");
    const narrative = narrativeText(a.props.narratives, "liquidity_capital");
    return (
      <>
        <Sec no={no} title="Institutional Resilience" sub={a.period} />
        {a.num("monetary_reserve_coverage_pct") === null ? (
          <p>
            Monetary reserve coverage is not reported, so the bank backing of recorded reserves
            cannot be assessed (see Annex A).
          </p>
        ) : (
          <p>
            Accumulated reserves are backed by actual bank funds at{" "}
            {a.text("monetary_reserve_coverage_pct")}. This compares recorded reserves with their
            monetary backing; it is not a regulatory liquidity ratio.
          </p>
        )}
        {narrative && (
          <div className="opinion keep">
            <div className="lbl">Resilience insights</div>
            <p style={{ margin: 0 }}>{narrative}</p>
          </div>
        )}
        {hasValues(reserve.values) && reserve.labels.length > 1 && (
          <Figure
            caption={
              <>
                <b>Figure L1.</b> Monetary reserve coverage (%).
              </>
            }
          >
            <LineChart
              labels={reserve.labels}
              values={reserve.values}
              unit="% of accumulated reserves"
            />
          </Figure>
        )}
        <IndicatorTable a={a} keys={INDICATOR_KEYS.capital} />
      </>
    );
  },
});
