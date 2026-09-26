import { formatIndicatorValue, isNotReported } from "@/lib/basic-dashboard";
import { methodologyIndicators, narrativeText } from "@/lib/questionnaire-report";
import { IndicatorTable } from "@/pages/shared/print/quest/IndicatorTable";
import { labelOf, type QuestAnalysis } from "@/pages/shared/print/quest/data";
import { recommendationsOf } from "@/pages/shared/print/quest/text";
import { chunk } from "@/pages/shared/print/consolidated/stats";
import { VBarGroups } from "@/pages/shared/print/tpl/TplCharts";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { EndOfReport, Figure, SignOff } from "@/pages/shared/print/tpl/TplParts";
import { Donut, LineChart } from "@/pages/shared/print/tpl/TplTrend";
import { INDICATOR_KEYS, type IndicatorGroup } from "@/types/basic-dashboard";

export const structurePage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Financial Structure & Profitability" },
  render: () => {
    const narrative = narrativeText(a.props.narratives, "financial_structure_profitability");
    const savings = a.num("member_savings_ratio");
    const shares = a.num("member_share_ratio");
    const borrowed = a.num("borrowed_funds_ratio");
    const known = (savings ?? 0) + (shares ?? 0) + (borrowed ?? 0);
    const funding = [
      { label: "Member savings", value: savings ?? 0 },
      { label: "Member shares", value: shares ?? 0 },
      { label: "Borrowed funds", value: borrowed ?? 0 },
      { label: "Other funding", value: Math.max(100 - known, 0) },
    ];
    const hasFunding = savings !== null || shares !== null || borrowed !== null;
    const income = a.line("profitability", "net_income");
    return (
      <>
        <Sec no={no} title="Financial Structure & Profitability" sub={a.period} />
        <p>
          Loans and investments are {a.text("earning_asset_ratio")} of total assets. Member savings
          fund {a.text("member_savings_ratio")} of assets and borrowed funds{" "}
          {a.text("borrowed_funds_ratio")}. Net income is {a.text("net_income")}.
        </p>
        {narrative && (
          <div className="opinion keep">
            <div className="lbl">Structure and profitability insights</div>
            <p style={{ margin: 0 }}>{narrative}</p>
          </div>
        )}
        {(hasFunding || income.labels.length > 1) && (
          <div className="two">
            {hasFunding ? (
              <Figure
                caption={
                  <>
                    <b>Figure F1.</b> Funding of total assets (%). Other funding is the remainder.
                  </>
                }
              >
                <Donut slices={funding} format={(v) => `${v.toFixed(1)}%`} />
              </Figure>
            ) : (
              <div />
            )}
            {income.labels.length > 1 && (
              <Figure
                caption={
                  <>
                    <b>Figure F2.</b> Net income by period ({a.props.dashboard.scope.currency}).
                  </>
                }
              >
                <LineChart
                  labels={income.labels}
                  values={income.values}
                  unit={a.props.dashboard.scope.currency}
                  format={(v) => a.money(v).replace(/^\$/, "")}
                />
              </Figure>
            )}
          </div>
        )}
        <h3>Structure</h3>
        <IndicatorTable a={a} keys={INDICATOR_KEYS.structure} />
        <h3>Profitability</h3>
        <IndicatorTable a={a} keys={INDICATOR_KEYS.profitability} />
      </>
    );
  },
});

export const assetTrendPage = (a: QuestAnalysis, no: string): PageSpec | null => {
  const assets = a.line("asset_evolution", "total_assets");
  if (assets.labels.length < 2 || assets.values.every((v) => v === null)) return null;
  return {
    toc: { no, title: "Asset Trend" },
    render: () => (
      <>
        <Sec no={no} title="Asset Trend" sub={`${assets.labels.length} periods`} />
        <p>
          Total assets are {a.text("total_assets")} at {a.period}.
        </p>
        <Figure
          caption={
            <>
              <b>Figure T1.</b> Total assets by period ({a.props.dashboard.scope.currency}).
            </>
          }
        >
          <VBarGroups
            unit={a.props.dashboard.scope.currency}
            format={(v) => a.money(v).replace(/^\$/, "")}
            series={[{ name: "Total assets", color: "#1F4E62" }]}
            data={assets.labels.map((label, i) => ({ label, values: [assets.values[i] ?? null] }))}
          />
        </Figure>
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
  savings: "Savings",
  loans: "Loans",
  risk: "Risk",
  liquidity: "Liquidity",
  structure: "Structure",
  capital: "Capital",
  profitability: "Profitability",
  governance: "Governance",
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
              %. PAR limits follow the WOCCU PEARLS system as configured on the Coop Data platform.
            </p>
            <EndOfReport />
          </>
        )}
      </>
    ),
  }));
};
