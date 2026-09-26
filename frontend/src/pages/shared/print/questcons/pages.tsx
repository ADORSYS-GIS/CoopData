import { formatMoneyValue } from "@/lib/basic-dashboard";
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
  marketSlices,
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
  ["registered_members", "Registered members"],
  ["total_assets", "Total assets"],
  ["total_deposits", "Member deposits"],
  ["gross_loan_portfolio", "Gross loans"],
  ["par_gt_30_pct", "PAR over 30 days"],
  ["liquidity_ratio_pct", "Liquidity ratio"],
  ["institutional_capital_ratio_pct", "Institutional capital"],
  ["female_borrowers_pct", "Female borrowers"],
];

const count = (n: number): string => n.toLocaleString("en-US");

export const executivePage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Executive Summary" },
  render: () => {
    const { dashboard } = a.props;
    const { verdict, body } = verdictOf(a);
    const cover = coverageOf(dashboard);
    const c = complianceOf(dashboard);
    const { thresholds } = dashboard;
    const rows: { label: string; limit: string; test: TestCount }[] = [
      { label: "PAR over 30 days", limit: `≤ ${PAR30_LIMIT}%`, test: c.par30 },
      {
        label: "Liquidity ratio",
        limit: `≥ ${thresholds.liquidity_minimum_pct}%`,
        test: c.liquidity,
      },
      {
        label: "Institutional capital",
        limit: `≥ ${thresholds.institutional_capital_minimum_pct}%`,
        test: c.capital,
      },
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
        <h3>Cooperatives against the regulatory limits</h3>
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
  toc: { no, title: "Coverage & Portfolio Structure" },
  render: () => {
    const { dashboard } = a.props;
    const cover = coverageOf(dashboard);
    const market = marketSlices(dashboard);
    const compliance = complianceOf(dashboard);
    const money = (v: number) => a.money(v);
    return (
      <>
        <Sec no={no} title="Coverage & Portfolio Structure" sub={a.period} />
        <p>
          {count(cover.reporting)} of {count(cover.inScope)} cooperatives in scope filed a
          questionnaire. The charts show who holds the assets and the loans, and how the reporting
          cooperatives compare on PAR over 30 days. The six largest are named; the rest are grouped
          as Other.
        </p>
        <div className="two">
          {market.assets.length > 0 && (
            <Figure
              caption={
                <>
                  <b>Figure P1.</b> Share of total assets by cooperative.
                </>
              }
            >
              <Donut slices={market.assets} format={money} />
            </Figure>
          )}
          {market.loans.length > 0 && (
            <Figure
              caption={
                <>
                  <b>Figure P2.</b> Share of gross loans by cooperative.
                </>
              }
            >
              <Donut slices={market.loans} format={money} />
            </Figure>
          )}
        </div>
        <div className="two">
          <Figure
            caption={
              <>
                <b>Figure P3.</b> Questionnaire coverage.
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
                <b>Figure P4.</b> Cooperatives by PAR over 30 days.
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
  const { scope, thresholds } = dashboard;
  const rows = dashboard.cooperatives;
  const pages = chunk(rows, ROWS_PER_PAGE);
  if (pages.length === 0) return [];
  const money = (v: number | null) => (v === null ? "—" : formatMoneyValue(v, scope.currency));
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
            PAR over {PAR30_LIMIT}%, liquidity below {thresholds.liquidity_minimum_pct}%,
            institutional capital below {thresholds.institutional_capital_minimum_pct}%.
          </p>
        )}
        <table className="tbl compact">
          <thead>
            <tr>
              <th>Cooperative</th>
              <th className="num">Members</th>
              <th className="num">Assets</th>
              <th className="num">Loans</th>
              <th className="num">PAR &gt;30</th>
              <th className="num">Liquidity</th>
              <th className="num">Capital</th>
            </tr>
          </thead>
          <tbody>
            {part.map((row: CooperativeRow) => (
              <tr key={row.cooperative_id}>
                <td>{row.name}</td>
                <td className="num">{count(row.total_members)}</td>
                <td className="num">{money(row.total_assets)}</td>
                <td className="num">{money(row.gross_loans)}</td>
                <td className={cell(parTone(row.par_gt_30_pct))}>{pct(row.par_gt_30_pct)}</td>
                <td
                  className={cell(
                    minimumTone(row.liquidity_ratio_pct, thresholds.liquidity_minimum_pct),
                  )}
                >
                  {pct(row.liquidity_ratio_pct)}
                </td>
                <td
                  className={cell(
                    minimumTone(
                      row.institutional_capital_ratio_pct,
                      thresholds.institutional_capital_minimum_pct,
                    ),
                  )}
                >
                  {pct(row.institutional_capital_ratio_pct)}
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
