import { isNotReported } from "@/lib/basic-dashboard";
import { methodologyIndicators, narrativeText } from "@/lib/questionnaire-report";
import { IndicatorTable } from "@/pages/shared/print/quest/IndicatorTable";
import {
  definitionOf,
  labelOf,
  reportValue,
  type QuestAnalysis,
} from "@/pages/shared/print/quest/data";
import { recommendationsOf } from "@/pages/shared/print/quest/text";
import { chunk } from "@/pages/shared/print/consolidated/stats";
import { tr } from "@/pages/shared/print/tpl/i18n";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { EndOfReport, Figure, SignOff } from "@/pages/shared/print/tpl/TplParts";
import { LineChart } from "@/pages/shared/print/tpl/TplTrend";
import { INDICATOR_KEYS, type IndicatorGroup } from "@/types/basic-dashboard";

export const performancePage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: tr("quest.performance.title") },
  render: () => {
    const narrative = narrativeText(a.props.narratives, "financial_structure_profitability");
    const margin = a.line("profitability", "total_operating_margin_pct");
    return (
      <>
        <Sec no={no} title={tr("quest.performance.title")} sub={a.period} />
        <p>
          {a.num("member_economic_benefit_ratio_pct") === null
            ? tr("quest.performance.summary_missing_benefit", {
                main: a.text("main_activity_operating_margin_pct"),
                total: a.text("total_operating_margin_pct"),
              })
            : tr("quest.performance.summary", {
                main: a.text("main_activity_operating_margin_pct"),
                total: a.text("total_operating_margin_pct"),
                benefit: a.text("member_economic_benefit_ratio_pct"),
              })}
        </p>
        {narrative && (
          <div className="opinion keep">
            <div className="lbl">{tr("quest.performance.insights")}</div>
            <p style={{ margin: 0 }}>{narrative}</p>
          </div>
        )}
        {margin.labels.length > 1 && (
          <Figure
            caption={
              <>
                <b>{tr("quest.figure", { id: "F1" })}</b> {tr("quest.performance.fig_f1")}
              </>
            }
          >
            <LineChart
              labels={margin.labels}
              values={margin.values}
              unit={tr("quest.performance.unit")}
            />
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
    toc: { no, title: tr("quest.coa.title") },
    render: () => (
      <>
        <Sec no={no} title={tr("quest.coa.title")} sub={a.period} />
        <p>{tr("quest.coa.intro")}</p>
        <IndicatorTable a={a} keys={INDICATOR_KEYS.coa} />
      </>
    ),
  };
};

const PRIORITY_CLASS = { High: "h", Medium: "m", Standard: "l" } as const;

export const findingsPage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: tr("coop.findings.title") },
  render: () => {
    const recs = recommendationsOf(a);
    const outlook = narrativeText(a.props.narratives, "outlook_recommendations");
    return (
      <>
        <Sec no={no} title={tr("coop.findings.title")} sub={tr("common.action_plan")} />
        <p>{tr("quest.findings.intro", { name: a.props.coopName })}</p>
        {outlook && (
          <div className="opinion keep">
            <div className="lbl">{tr("quest.findings.outlook")}</div>
            <p style={{ margin: 0 }}>{outlook}</p>
          </div>
        )}
        <table className="tbl recs">
          <thead>
            <tr>
              <th />
              <th>{tr("common.recommendation")}</th>
              <th style={{ width: "20mm" }}>{tr("common.priority")}</th>
              <th style={{ width: "28mm" }}>{tr("common.timeline")}</th>
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
                  <span className={`prio ${PRIORITY_CLASS[rec.priority]}`}>
                    {tr(`common.priorities.${rec.priority}`)}
                  </span>
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
    toc: index === 0 ? { no, title: tr("quest.annex_a.toc") } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title={tr("quest.annex_a.title")}
          sub={
            parts.length > 1
              ? tr("common.annex_part_of", { part: index + 1, parts: parts.length })
              : tr("common.annex")
          }
        />
        {index === 0 && (
          <p>
            {tr("quest.annex_a.intro", { reported, total })}{" "}
            {flagged.length > 0
              ? tr("quest.annex_a.intro_flagged")
              : tr("quest.annex_a.intro_exact")}
          </p>
        )}
        {rows.length > 0 && (
          <table className="tbl compact">
            <thead>
              <tr>
                <th>{tr("common.indicator")}</th>
                <th style={{ width: "22mm" }}>{tr("common.status")}</th>
                <th className="num" style={{ width: "22mm" }}>
                  {tr("quest.measure_value")}
                </th>
                <th>{tr("common.definition")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{labelOf(row.key)}</td>
                  <td>
                    {isNotReported(row) ? tr("status.not_reported") : tr("quest.annex_a.estimated")}
                  </td>
                  <td className="num">{reportValue(row, scope)}</td>
                  <td>{definitionOf(row.key, row.formula)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    ),
  }));
};

const GROUP_ORDER: IndicatorGroup[] = [
  "membership",
  "governance",
  "training",
  "profitability",
  "savings",
  "risk",
  "capital",
  "coa",
];

export const annexBPages = (a: QuestAnalysis, no: string): PageSpec[] => {
  const rows = a.props.dashboard.indicators
    .filter((i) => i.formula)
    .sort((x, y) => GROUP_ORDER.indexOf(x.group) - GROUP_ORDER.indexOf(y.group));
  const pages = chunk(rows, 22);
  return pages.map((part, index): PageSpec => ({
    toc: index === 0 ? { no, title: tr("quest.annex_b.toc") } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title={tr("quest.annex_b.title")}
          sub={
            pages.length > 1
              ? tr("common.annex_part_of", { part: index + 1, parts: pages.length })
              : tr("common.annex")
          }
        />
        <table className="tbl compact">
          <thead>
            <tr>
              <th style={{ width: "24mm" }}>{tr("quest.annex_b.group")}</th>
              <th style={{ width: "50mm" }}>{tr("common.indicator")}</th>
              <th>{tr("common.definition")}</th>
            </tr>
          </thead>
          <tbody>
            {part.map((row) => (
              <tr key={row.key}>
                <td>{tr(`quest.groups.${row.group}`, { defaultValue: row.group })}</td>
                <td>{labelOf(row.key)}</td>
                <td>{definitionOf(row.key, row.formula)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {index === pages.length - 1 && (
          <>
            <p className="src">{tr("common.pearls_source")}</p>
            <EndOfReport />
          </>
        )}
      </>
    ),
  }));
};
