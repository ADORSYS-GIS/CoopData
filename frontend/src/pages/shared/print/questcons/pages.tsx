import { chunk } from "@/pages/shared/print/consolidated/stats";
import {
  changeNote,
  isDown,
  minimumTone,
  par30Limit,
  parTone,
  pct,
  type QuestAnalysis,
} from "@/pages/shared/print/quest/data";
import { verdictOf } from "@/pages/shared/print/quest/text";
import {
  complianceOf,
  coverageOf,
  parBandSlices,
  type TestCount,
} from "@/pages/shared/print/questcons/stats";
import { concernsOf, recommendationsOf, strengthsOf } from "@/pages/shared/print/questcons/text";
import { grouped, percentText, tr } from "@/pages/shared/print/tpl/i18n";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure, FindList, Kpis, Opinion, SignOff } from "@/pages/shared/print/tpl/TplParts";
import { Donut } from "@/pages/shared/print/tpl/TplTrend";
import type { CooperativeRow } from "@/types/basic-dashboard";

const SUMMARY: readonly string[] = [
  "active_members_pct",
  "women_members_pct",
  "savings_account_penetration_pct",
  "par_gt_30_pct",
  "delinquent_loan_account_rate_pct",
  "agm_attendance_pct",
  "total_operating_margin_pct",
  "monetary_reserve_coverage_pct",
];

const count = (n: number): string => grouped(n);

export const executivePage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: tr("common.executive_summary") },
  render: () => {
    const { dashboard } = a.props;
    const { verdict, body } = verdictOf(a);
    const cover = coverageOf(dashboard);
    const c = complianceOf(dashboard);
    const rows: { label: string; limit: string; test: TestCount }[] = [
      {
        label: tr("quest.kpi.par_gt_30_pct"),
        limit: `≤ ${par30Limit()}`,
        test: c.par30,
      },
      {
        label: tr("quest.kpi.total_operating_margin_pct"),
        limit: `≥ ${percentText(0, 0)}`,
        test: c.operatingMargin,
      },
      {
        label: tr("quest.kpi.monetary_reserve_coverage_pct"),
        limit: `≥ ${percentText(100, 0)}`,
        test: c.reserveCoverage,
      },
    ];
    return (
      <>
        <Sec no={no} title={tr("common.executive_summary")} sub={a.period} />
        <Opinion label={tr("common.overall_view")} verdict={verdict}>
          {`${body} ${tr("quest.cons.coverage_sentence", {
            reporting: count(cover.reporting),
            inScope: count(cover.inScope),
            rate: percentText(cover.rate, 1),
          })}`}
        </Opinion>
        <Kpis
          items={SUMMARY.map((key) => ({
            label: tr(`quest.kpi.${key}`),
            value: a.text(key),
            note: changeNote(a.ind(key)),
            down: isDown(a.ind(key)),
          }))}
        />
        <h3>{tr("quest.cons.limits_heading")}</h3>
        <table className="tbl compact">
          <thead>
            <tr>
              <th>{tr("quest.measure")}</th>
              <th className="num">{tr("common.limit")}</th>
              <th className="num">{tr("quest.cons.col_meet")}</th>
              <th className="num">{tr("quest.cons.col_not_meet")}</th>
              <th className="num">{tr("status.not_reported")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="num">{row.limit}</td>
                <td className="num">{count(row.test.meets)}</td>
                <td className={`num ${row.test.below > 0 ? "dn" : ""}`}>{count(row.test.below)}</td>
                <td className="num">{count(row.test.notReported)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="two">
          <div>
            <h3>{tr("common.strengths")}</h3>
            <FindList items={strengthsOf(a).length ? strengthsOf(a) : [tr("common.no_strength")]} />
          </div>
          <div>
            <h3>{tr("quest.concerns")}</h3>
            <FindList
              red
              items={concernsOf(a).length ? concernsOf(a) : [tr("common.no_concern")]}
            />
          </div>
        </div>
      </>
    );
  },
});

export const coveragePage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: tr("quest.cons.coverage_title") },
  render: () => {
    const { dashboard } = a.props;
    const cover = coverageOf(dashboard);
    const compliance = complianceOf(dashboard);
    return (
      <>
        <Sec no={no} title={tr("quest.cons.coverage_title")} sub={a.period} />
        <p>
          {tr("quest.cons.coverage_text", {
            reporting: count(cover.reporting),
            inScope: count(cover.inScope),
          })}
        </p>
        <div className="two">
          <Figure
            caption={
              <>
                <b>{tr("quest.figure", { id: "P1" })}</b> {tr("quest.cons.fig_p1")}
              </>
            }
          >
            <Donut
              slices={[
                { label: tr("common.filed"), value: cover.reporting },
                { label: tr("common.not_filed"), value: cover.missing },
              ]}
              format={count}
            />
          </Figure>
          <Figure
            caption={
              <>
                <b>{tr("quest.figure", { id: "P2" })}</b> {tr("quest.cons.fig_p2")}
              </>
            }
          >
            <Donut slices={parBandSlices(compliance)} format={count} />
          </Figure>
        </div>
        <p className="src">
          {tr("quest.cons.coverage_src", { currency: dashboard.scope.currency })}
        </p>
      </>
    );
  },
});

const ROWS_PER_PAGE = 16;

const cell = (tone: string): string => `num ${tone === "bad" || tone === "warn" ? "dn" : ""}`;

export const cooperativePages = (a: QuestAnalysis, no: string): PageSpec[] => {
  const { dashboard } = a.props;
  const rows = dashboard.cooperatives;
  const pages = chunk(rows, ROWS_PER_PAGE);
  if (pages.length === 0) return [];
  return pages.map((part, index): PageSpec => ({
    toc: index === 0 ? { no, title: tr("quest.cons.overview_title") } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title={tr("quest.cons.overview_title")}
          sub={
            pages.length > 1
              ? tr("common.part_of", { part: index + 1, parts: pages.length })
              : a.period
          }
        />
        {index === 0 && <p>{tr("quest.cons.overview_intro", { limit: par30Limit() })}</p>}
        <table className="tbl compact">
          <thead>
            <tr>
              <th>{tr("common.cooperative")}</th>
              <th className="num">{tr("common.members")}</th>
              <th className="num">{tr("common.active")}</th>
              <th className="num">{tr("common.women")}</th>
              <th className="num">{tr("quest.cons.col_par")}</th>
              <th className="num">{tr("quest.cons.col_op_margin")}</th>
              <th className="num">{tr("quest.cons.col_reserves")}</th>
            </tr>
          </thead>
          <tbody>
            {part.map((row: CooperativeRow) => (
              <tr key={row.cooperative_id}>
                <td>{row.name}</td>
                <td className="num">{count(row.total_members)}</td>
                <td className="num">{pct(row.active_members_pct)}</td>
                <td className="num">{pct(row.women_members_pct)}</td>
                <td className={cell(parTone(row.par_gt_30_pct))}>{pct(row.par_gt_30_pct)}</td>
                <td className={cell(minimumTone(row.total_operating_margin_pct, 0))}>
                  {pct(row.total_operating_margin_pct)}
                </td>
                <td className={cell(minimumTone(row.monetary_reserve_coverage_pct, 100))}>
                  {pct(row.monetary_reserve_coverage_pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ),
  }));
};

const PRIORITY_CLASS = { High: "h", Medium: "m", Standard: "l" } as const;

export const findingsPage = (a: QuestAnalysis, no: string, entity: string): PageSpec => ({
  toc: { no, title: tr("coop.findings.title") },
  render: () => (
    <>
      <Sec no={no} title={tr("coop.findings.title")} sub={tr("common.action_plan")} />
      <p>{tr("quest.cons.findings_intro", { entity })}</p>
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
          {recommendationsOf(a).map((rec, index) => (
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
  ),
});
