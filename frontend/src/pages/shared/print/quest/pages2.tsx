import { formatIndicatorValue, isNotReported } from "@/lib/basic-dashboard";
import { narrativeText, OVERDUE_BUCKETS } from "@/lib/questionnaire-report";
import { IndicatorTable } from "@/pages/shared/print/quest/IndicatorTable";
import {
  PAR30_LIMIT,
  PAR90_LIMIT,
  labelOf,
  parTone,
  type QuestAnalysis,
} from "@/pages/shared/print/quest/data";
import { checksOf } from "@/pages/shared/print/quest/text";
import { VBarGroups } from "@/pages/shared/print/tpl/TplCharts";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure, Pill } from "@/pages/shared/print/tpl/TplParts";
import { LineChart } from "@/pages/shared/print/tpl/TplTrend";
import { INDICATOR_KEYS } from "@/types/basic-dashboard";

const hasValues = (values: (number | null)[]): boolean => values.some((v) => v !== null);

const BUCKET_LABEL: Record<string, string> = {
  gt7: "Overdue over 7 days",
  gt30: "Overdue over 30 days",
  d30to90: "Overdue 30 to 90 days",
  gt90: "Overdue over 90 days",
  d180to360: "Overdue 180 to 360 days",
  total: "Total portfolio at risk",
};

export const portfolioPage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Savings & Lending Portfolio" },
  render: () => {
    const loans = a.line("loan_portfolio", "gross_loans");
    const savings = a.line("savings_trend", "total_deposits");
    const scaled = (values: (number | null)[]) =>
      values.map((v) => (v === null ? null : Math.round(v)));
    const narrative = narrativeText(a.props.narratives, "portfolio_quality");
    const series = [
      { name: "Gross loans", color: "#1F4E62" },
      { name: "Member deposits", color: "#8FB0BF" },
    ];
    const labels = loans.labels.length >= savings.labels.length ? loans.labels : savings.labels;
    const hasHistory = labels.length > 1 && (hasValues(loans.values) || hasValues(savings.values));
    return (
      <>
        <Sec no={no} title="Savings & Lending Portfolio" sub={a.period} />
        <p>
          Member deposits are {a.text("total_deposits")} across {a.text("deposit_accounts")}{" "}
          accounts. The loan book is {a.text("gross_loan_portfolio")} over{" "}
          {a.text("loans_outstanding_count")} loans, with an average balance of{" "}
          {a.text("avg_loan_balance")}.
        </p>
        {narrative && (
          <div className="opinion keep">
            <div className="lbl">Portfolio insights</div>
            <p style={{ margin: 0 }}>{narrative}</p>
          </div>
        )}
        {hasHistory && (
          <Figure
            caption={
              <>
                <b>Figure P1.</b> Gross loans and member deposits by period (
                {a.props.dashboard.scope.currency}).
              </>
            }
          >
            <VBarGroups
              unit={a.props.dashboard.scope.currency}
              format={(v) => a.money(v).replace(/^\$/, "")}
              series={series}
              data={labels.map((label, i) => ({
                label,
                values: [scaled(loans.values)[i] ?? null, scaled(savings.values)[i] ?? null],
              }))}
            />
          </Figure>
        )}
        <h3>Savings and lending indicators</h3>
        <IndicatorTable a={a} keys={[...INDICATOR_KEYS.savings, ...INDICATOR_KEYS.loans]} />
      </>
    );
  },
});

export const riskPage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Portfolio Quality & Risk" },
  render: () => {
    const par30 = a.line("par_trend", "par_gt_30_pct");
    const par90 = a.line("par_trend", "par_gt_90_pct");
    const checks = checksOf(a);
    const scope = a.props.dashboard.scope;
    const rest = INDICATOR_KEYS.risk.filter(
      (k) =>
        !k.startsWith("par_") &&
        !k.startsWith("var_") &&
        k !== "value_at_risk" &&
        k !== "portfolio_at_risk_pct",
    );
    return (
      <>
        <Sec no={no} title="Portfolio Quality & Risk" sub={a.period} />
        <p>
          PAR over 30 days is {a.text("par_gt_30_pct")} against a limit of {PAR30_LIMIT}%, and PAR
          over 90 days is {a.text("par_gt_90_pct")} against {PAR90_LIMIT}%. Overall status:{" "}
          <Pill tone={checks.par30} />.
        </p>
        <h3>Loans by days overdue</h3>
        <table className="tbl compact">
          <thead>
            <tr>
              <th>Bucket</th>
              <th className="num">Rate</th>
              <th className="num">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {OVERDUE_BUCKETS.map((bucket) => {
              const rate = a.ind(bucket.rate);
              const amount = bucket.amount ? a.ind(bucket.amount) : undefined;
              return (
                <tr key={bucket.label} className={bucket.label === "total" ? "total" : undefined}>
                  <td>{BUCKET_LABEL[bucket.label]}</td>
                  <td className="num">{rate ? formatIndicatorValue(rate, scope) : "—"}</td>
                  <td className="num">{amount ? formatIndicatorValue(amount, scope) : "—"}</td>
                  <td>
                    {rate && !isNotReported(rate) && bucket.label === "gt30" ? (
                      <Pill tone={parTone(rate.value)} />
                    ) : rate && !isNotReported(rate) && bucket.label === "gt90" ? (
                      <Pill
                        tone={
                          (rate.value ?? 0) <= PAR90_LIMIT
                            ? "ok"
                            : (rate.value ?? 0) <= 5
                              ? "warn"
                              : "bad"
                        }
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(hasValues(par30.values) || hasValues(par90.values)) && par30.labels.length > 1 && (
          <div className="two">
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
                unit="% of gross loans"
                limit={{ value: PAR30_LIMIT, label: `Max ${PAR30_LIMIT}%` }}
              />
            </Figure>
            <Figure
              caption={
                <>
                  <b>Figure R2.</b> PAR over 90 days (%).
                </>
              }
            >
              <LineChart
                labels={par90.labels}
                values={par90.values}
                unit="% of gross loans"
                limit={{ value: PAR90_LIMIT, label: `Max ${PAR90_LIMIT}%` }}
              />
            </Figure>
          </div>
        )}
        <h3>Other risk indicators</h3>
        <IndicatorTable a={a} keys={rest} />
      </>
    );
  },
});

export const liquidityCapitalPage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Liquidity & Capital" },
  render: () => {
    const { thresholds } = a.props.dashboard;
    const liquidity = a.line("liquidity", "maintained_pct");
    const capital = a.line("institutional_capital", "ratio_pct");
    const narrative = narrativeText(a.props.narratives, "liquidity_capital");
    const checks = checksOf(a);
    return (
      <>
        <Sec no={no} title="Liquidity & Capital" sub={a.period} />
        <p>
          Liquid assets are {a.text("liquidity_ratio_pct")} of member savings against a minimum of{" "}
          {thresholds.liquidity_minimum_pct}% (<Pill tone={checks.liquidity} />
          ). Institutional capital is {a.text("institutional_capital_ratio_pct")} against a minimum
          of {thresholds.institutional_capital_minimum_pct}% (
          <Pill tone={checks.capital} />
          ).
        </p>
        {narrative && (
          <div className="opinion keep">
            <div className="lbl">Liquidity and capital insights</div>
            <p style={{ margin: 0 }}>{narrative}</p>
          </div>
        )}
        {liquidity.labels.length > 1 || capital.labels.length > 1 ? (
          <div className="two">
            <Figure
              caption={
                <>
                  <b>Figure L1.</b> Liquidity ratio (% of member savings).
                </>
              }
            >
              <LineChart
                labels={liquidity.labels}
                values={liquidity.values}
                unit="% of member savings"
                limit={{
                  value: thresholds.liquidity_minimum_pct,
                  label: `Min ${thresholds.liquidity_minimum_pct}%`,
                }}
              />
            </Figure>
            <Figure
              caption={
                <>
                  <b>Figure L2.</b> Institutional capital ratio (% of total assets).
                </>
              }
            >
              <LineChart
                labels={capital.labels}
                values={capital.values}
                unit="% of total assets"
                limit={{
                  value: thresholds.institutional_capital_minimum_pct,
                  label: `Min ${thresholds.institutional_capital_minimum_pct}%`,
                }}
              />
            </Figure>
          </div>
        ) : null}
        <h3>Liquidity</h3>
        <IndicatorTable a={a} keys={INDICATOR_KEYS.liquidity} />
        <h3>Capital</h3>
        <IndicatorTable a={a} keys={INDICATOR_KEYS.capital} />
        <p className="src">
          {labelOf("institutional_capital")} is retained earnings plus statutory reserves plus
          donations, measured against total assets. The liquidity ratio is liquid assets over member
          savings.
        </p>
      </>
    );
  },
});
