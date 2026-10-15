import { formatIndicatorValue, isNotReported } from "@/lib/basic-dashboard";
import { methodologyIndicators, narrativeText } from "@/lib/questionnaire-report";
import { IndicatorTable } from "@/pages/shared/print/quest/IndicatorTable";
import { labelOf, type QuestAnalysis } from "@/pages/shared/print/quest/data";
import { recommendationsOf } from "@/pages/shared/print/quest/text";
import { chunk } from "@/pages/shared/print/consolidated/stats";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { EndOfReport, Figure, SignOff } from "@/pages/shared/print/tpl/TplParts";
import { LineChart } from "@/pages/shared/print/tpl/TplTrend";
import { INDICATOR_KEYS, type IndicatorGroup } from "@/types/basic-dashboard";

export const performancePage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Operational & Economic Performance" },
  render: () => {
    const narrative = narrativeText(a.props.narratives, "financial_structure_profitability");
    const margin = a.line("profitability", "total_operating_margin_pct");
    return (
      <>
        <Sec no={no} title="Operational & Economic Performance" sub={a.period} />
        <p>
          The main activity margin is {a.text("main_activity_operating_margin_pct")} and the total
          operating margin is {a.text("total_operating_margin_pct")}.{" "}
          {a.num("member_economic_benefit_ratio_pct") === null ? (
            <>The share of the main activity surplus distributed to members is not reported.</>
          ) : (
            <>
              Of the main activity surplus, {a.text("member_economic_benefit_ratio_pct")} is
              distributed to members.
            </>
          )}
        </p>
        {narrative && (
          <div className="opinion keep">
            <div className="lbl">Performance insights</div>
            <p style={{ margin: 0 }}>{narrative}</p>
          </div>
        )}
        {margin.labels.length > 1 && (
          <Figure
            caption={
              <>
                <b>Figure F1.</b> Total operating margin by period (%).
              </>
            }
          >
            <LineChart labels={margin.labels} values={margin.values} unit="% of operating income" />
          </Figure>
        )}
        <IndicatorTable a={a} keys={INDICATOR_KEYS.profitability} />
      </>
    );
  },
});

/** Only rendered for multipurpose cooperatives that filled in the
 * chart-of-accounts financial questionnaire — null for everyone else (SACCO
 * cooperatives no longer use the questionnaire at all; a coop that hasn't
 * filled in the chart of accounts has nothing to show here). */
export const mpcFinancialRatiosPage = (a: QuestAnalysis, no: string): PageSpec | null => {
  const hasData = INDICATOR_KEYS.coa.some((key) => a.num(key) !== null);
  if (!hasData) return null;
  return {
    toc: { no, title: "MPC Financial Ratios" },
    render: () => (
      <>
        <Sec no={no} title="MPC Financial Ratios" sub={a.period} />
        <p>
          Ratios computed from the cooperative's own chart-of-accounts mapping (opening/closing
          balances and annual movements by standard account).
        </p>
        <IndicatorTable a={a} keys={INDICATOR_KEYS.coa} />
      </>
    ),
  };
};

const PRIORITY_CLASS = { High: "h", Medium: "m", Standard: "l" } as const;

export const findingsPage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Supervisory Findings & Recommendations" },
  render: () => {
    const recs = recommendationsOf(a);
    const outlook = narrativeText(a.props.narratives, "outlook_recommendations");
    return (
      <>
        <Sec no={no} title="Supervisory Findings & Recommendations" sub="Action plan" />
        <p>
          The following actions are recommended to the Board and management of {a.props.coopName}.
          Progress should be reported with the next return.
        </p>
        {outlook && (
          <div className="opinion keep">
            <div className="lbl">Outlook</div>
            <p style={{ margin: 0 }}>{outlook}</p>
          </div>
        )}
        <table className="tbl recs">
          <thead>
            <tr>
              <th />
              <th>Recommendation</th>
              <th style={{ width: "20mm" }}>Priority</th>
              <th style={{ width: "28mm" }}>Timeline</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((rec, index) => (
              <tr key={rec.lead}>
                <td>{index + 1}</td>
                <td>
                  <b>{rec.lead}</b> {rec.text}
                </td>
                <td>
                  <span className={`prio ${PRIORITY_CLASS[rec.priority]}`}>{rec.priority}</span>
                </td>
                <td>{rec.timeline}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <SignOff />
      </>
    );
  },
});

const ROWS_PER_PAGE = 10;

export const annexAPages = (a: QuestAnalysis, no: string): PageSpec[] => {
  const { indicators, scope } = a.props.dashboard;
  const flagged = methodologyIndicators(indicators);
  const total = indicators.length;
  const reported = indicators.filter((i) => !isNotReported(i)).length;
  const pages = chunk(flagged, ROWS_PER_PAGE);
  const parts = pages.length > 0 ? pages : [[]];
  return parts.map((rows, index): PageSpec => ({
    toc: index === 0 ? { no, title: "Annex A — Data Quality & Methodology" } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title="Data Quality & Methodology"
          sub={parts.length > 1 ? `Annex · part ${index + 1} of ${parts.length}` : "Annex"}
        />
        {index === 0 && (
          <p>
            {reported} of {total} indicators could be computed from the answers given.{" "}
            {flagged.length > 0
              ? "The indicators below are estimated or missing. An estimate is computed from grouped answers; a missing value has no answer to compute from."
              : "Every indicator was computed from exact answers."}
          </p>
        )}
        {rows.length > 0 && (
          <table className="tbl compact">
            <thead>
              <tr>
                <th>Indicator</th>
                <th style={{ width: "22mm" }}>Status</th>
                <th className="num" style={{ width: "22mm" }}>
                  Value
                </th>
                <th>Formula and source fields</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{labelOf(row.key)}</td>
                  <td>{isNotReported(row) ? "Not reported" : "Estimated"}</td>
                  <td className="num">{formatIndicatorValue(row, scope)}</td>
                  <td>
                    {row.formula}
                    {row.note ? ` ${row.note}` : ""}
                    {row.sources.length > 0 ? ` (${row.sources.join(", ")})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    ),
  }));
};

const GROUP_TITLE: Record<IndicatorGroup, string> = {
  membership: "Membership",
  governance: "Governance",
  training: "Training",
  profitability: "Performance",
  savings: "Savings",
  risk: "Loan quality",
  capital: "Resilience",
  coa: "Financial Ratios (Chart of Accounts)",
};

export const annexBPages = (a: QuestAnalysis, no: string): PageSpec[] => {
  const rows = a.props.dashboard.indicators
    .filter((i) => i.formula)
    .sort(
      (x, y) =>
        Object.keys(GROUP_TITLE).indexOf(x.group) - Object.keys(GROUP_TITLE).indexOf(y.group),
    );
  const pages = chunk(rows, 22);
  return pages.map((part, index): PageSpec => ({
    toc: index === 0 ? { no, title: "Annex B — Indicator Definitions" } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title="Indicator Definitions"
          sub={pages.length > 1 ? `Annex · part ${index + 1} of ${pages.length}` : "Annex"}
        />
        <table className="tbl compact">
          <thead>
            <tr>
              <th style={{ width: "24mm" }}>Group</th>
              <th style={{ width: "50mm" }}>Indicator</th>
              <th>Definition</th>
            </tr>
          </thead>
          <tbody>
            {part.map((row) => (
              <tr key={row.key}>
                <td>{GROUP_TITLE[row.group] ?? row.group}</td>
                <td>{labelOf(row.key)}</td>
                <td>{row.formula}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {index === pages.length - 1 && (
          <>
            <p className="src">
              Regulatory minimums: liquidity {a.props.dashboard.thresholds.liquidity_minimum_pct}%,
              institutional capital {a.props.dashboard.thresholds.institutional_capital_minimum_pct}
              %. PAR limits follow the PEARLS system as configured on the Coop Data platform.
            </p>
            <EndOfReport />
          </>
        )}
      </>
    ),
  }));
};
