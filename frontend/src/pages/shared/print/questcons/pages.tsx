import { chunk } from "@/pages/shared/print/consolidated/stats";
import {
  PAR30_LIMIT,
  changeNote,
  isDown,
  minimumTone,
  parTone,
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
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure, FindList, Kpis, Opinion, SignOff } from "@/pages/shared/print/tpl/TplParts";
import { Donut } from "@/pages/shared/print/tpl/TplTrend";
import type { CooperativeRow } from "@/types/basic-dashboard";

const SUMMARY: readonly [string, string][] = [
  ["active_members_pct", "Active members"],
  ["women_members_pct", "Women members"],
  ["savings_account_penetration_pct", "Savings account penetration"],
  ["par_gt_30_pct", "PAR over 30 days"],
  ["delinquent_loan_account_rate_pct", "Delinquent loan accounts"],
  ["agm_attendance_pct", "AGM participation"],
  ["total_operating_margin_pct", "Total operating margin"],
  ["monetary_reserve_coverage_pct", "Monetary reserve coverage"],
];

const count = (n: number): string => n.toLocaleString("en-US");

export const executivePage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Executive Summary" },
  render: () => {
    const { dashboard } = a.props;
    const { verdict, body } = verdictOf(a);
    const cover = coverageOf(dashboard);
    const c = complianceOf(dashboard);
    const rows: { label: string; limit: string; test: TestCount }[] = [
      { label: "PAR over 30 days", limit: `≤ ${PAR30_LIMIT}%`, test: c.par30 },
      { label: "Total operating margin", limit: "≥ 0%", test: c.operatingMargin },
      { label: "Monetary reserve coverage", limit: "≥ 100%", test: c.reserveCoverage },
    ];
    return (
      <>
        <Sec no={no} title="Executive Summary" sub={a.period} />
        <Opinion label="Overall supervisory view" verdict={verdict}>
          {`${body} ${count(cover.reporting)} of ${count(cover.inScope)} cooperatives (${cover.rate.toFixed(1)}%) filed a questionnaire for this period.`}
        </Opinion>
        <Kpis
          items={SUMMARY.map(([key, label]) => ({
            label,
            value: a.text(key),
            note: changeNote(a.ind(key)),
            down: isDown(a.ind(key)),
          }))}
        />
        <h3>Cooperatives against the supervisory limits</h3>
        <table className="tbl compact">
          <thead>
            <tr>
              <th>Measure</th>
              <th className="num">Limit</th>
              <th className="num">Meet</th>
              <th className="num">Do not meet</th>
              <th className="num">Not reported</th>
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
            <h3>Strengths</h3>
            <FindList
              items={
                strengthsOf(a).length ? strengthsOf(a) : ["No indicator is within its benchmark."]
              }
            />
          </div>
          <div>
            <h3>Concerns</h3>
            <FindList
              red
              items={concernsOf(a).length ? concernsOf(a) : ["No concern identified."]}
            />
          </div>
        </div>
      </>
    );
  },
});

export const coveragePage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Coverage & Portfolio Quality" },
  render: () => {
    const { dashboard } = a.props;
    const cover = coverageOf(dashboard);
    const compliance = complianceOf(dashboard);
    return (
      <>
        <Sec no={no} title="Coverage & Portfolio Quality" sub={a.period} />
        <p>
          {count(cover.reporting)} of {count(cover.inScope)} cooperatives in scope filed a
          questionnaire. The charts show the filing coverage and how the reporting cooperatives
          compare on PAR over 30 days.
        </p>
        <div className="two">
          <Figure
            caption={
              <>
                <b>Figure P1.</b> Questionnaire coverage.
              </>
            }
          >
            <Donut
              slices={[
                { label: "Filed", value: cover.reporting },
                { label: "Did not file", value: cover.missing },
              ]}
              format={count}
            />
          </Figure>
          <Figure
            caption={
              <>
                <b>Figure P2.</b> Cooperatives by PAR over 30 days.
              </>
            }
          >
            <Donut slices={parBandSlices(compliance)} format={count} />
          </Figure>
        </div>
        <p className="src">
          Only approved questionnaire returns are counted. Amounts are in {dashboard.scope.currency}
          .
        </p>
      </>
    );
  },
});

const ROWS_PER_PAGE = 16;

const cell = (tone: string): string => `num ${tone === "bad" || tone === "warn" ? "dn" : ""}`;

export const cooperativePages = (a: QuestAnalysis, no: string): PageSpec[] => {
  const { dashboard } = a.props;
  const { scope } = dashboard;
  const rows = dashboard.cooperatives;
  const pages = chunk(rows, ROWS_PER_PAGE);
  if (pages.length === 0) return [];
  const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);
  return pages.map((part, index): PageSpec => ({
    toc: index === 0 ? { no, title: "Cooperative Overview" } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title="Cooperative Overview"
          sub={pages.length > 1 ? `Part ${index + 1} of ${pages.length}` : a.period}
        />
        {index === 0 && (
          <p>
            Each cooperative that filed, with its key figures. Values in red are outside the limit:
            PAR over {PAR30_LIMIT}%, a negative operating margin, or reserves below 100% backed.
          </p>
        )}
        <table className="tbl compact">
          <thead>
            <tr>
              <th>Cooperative</th>
              <th className="num">Members</th>
              <th className="num">Active</th>
              <th className="num">Women</th>
              <th className="num">PAR &gt;30</th>
              <th className="num">Op. margin</th>
              <th className="num">Reserves</th>
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
  toc: { no, title: "Supervisory Findings & Recommendations" },
  render: () => (
    <>
      <Sec no={no} title="Supervisory Findings & Recommendations" sub="Action plan" />
      <p>
        The following actions are recommended to the leadership responsible for {entity}. Progress
        should be reported with the next return.
      </p>
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
          {recommendationsOf(a).map((rec, index) => (
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
  ),
});
