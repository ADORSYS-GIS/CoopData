import type { Analysis } from "@/pages/shared/print/cons/analysis";
import { concernsOf, strengthsOf, verdictOf } from "@/pages/shared/print/cons/text";
import {
  integer,
  money,
  percent,
  pointChange,
  TONE_LABEL,
  totalsOf,
  type Change,
} from "@/pages/shared/print/consolidated/stats";
import { HBarPairs } from "@/pages/shared/print/tpl/TplCharts";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import {
  Figure,
  FindList,
  Kpis,
  Opinion,
  Pill,
  type StatusTone,
} from "@/pages/shared/print/tpl/TplParts";

const tone = (value: string): StatusTone => (value === "na" ? "na" : (value as StatusTone));

const noteOf = (change: Change | null, prior: string): string | undefined =>
  change
    ? `${change.tone === "down" ? "▼" : "▲"} ${change.text.replace(/^[+-]/, "")} on ${prior}`
    : undefined;

const changeCell = (change: Change | null) => (
  <td className={`num ${change?.tone === "down" ? "dn" : change?.tone === "up" ? "up" : ""}`}>
    {change?.text ?? "—"}
  </td>
);

export const executivePage = (a: Analysis, no: string): PageSpec => ({
  toc: { no, title: "Executive Summary" },
  render: () => {
    const { year } = a.input;
    const { verdict, body } = verdictOf(a);
    const strengths = strengthsOf(a);
    const concerns = concernsOf(a);
    const prior = `${year - 1}`;
    return (
      <>
        <Sec no={no} title="Executive Summary" sub={`Reporting year ${year}`} />
        <Opinion label="Overall supervisory view" verdict={verdict}>
          {a.input.narrative || body}
        </Opinion>
        <Kpis
          items={[
            {
              label: "Total assets",
              value: money(a.now.assets),
              note: noteOf(a.changes.assets, prior),
              down: a.changes.assets?.tone === "down",
            },
            {
              label: "Gross loan portfolio",
              value: money(a.now.loans),
              note: noteOf(a.changes.loans, prior),
              down: a.changes.loans?.tone === "down",
            },
            {
              label: "Total equity",
              value: money(a.now.equity),
              note: noteOf(a.changes.equity, prior),
              down: a.changes.equity?.tone === "down",
            },
            {
              label: "Members",
              value: integer(a.now.members),
              note: noteOf(a.changes.members, prior),
              down: a.changes.members?.tone === "down",
            },
          ]}
        />
        <div className="two">
          <div>
            <h3 style={{ marginTop: 0 }}>Strengths</h3>
            <FindList
              items={
                strengths.length > 0 ? strengths : ["No indicator currently meets its benchmark."]
              }
            />
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>Areas of concern</h3>
            <FindList
              red
              items={concerns.length > 0 ? concerns : ["No area of concern was identified."]}
            />
          </div>
        </div>
        <h3>Scorecard at a glance</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Area</th>
              <th>Key indicator</th>
              <th className="num">{year}</th>
              <th className="num">Prior</th>
              <th className="num">Benchmark</th>
              <th style={{ width: "24mm" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {a.ratios.map((row) => (
              <tr key={row.key}>
                <td>
                  {row.key === "roa" || row.key === "roe" ? "Earnings" : row.label.split(" ")[0]}
                </td>
                <td>Average {row.label.toLowerCase()}</td>
                <td className="num">{percent(row.avgNow)}</td>
                <td className="num">{percent(row.avgPrior)}</td>
                <td className="num">{row.bench}</td>
                <td>
                  <Pill tone={tone(row.tone)}>
                    {TONE_LABEL[row.tone] === "Not reported" ? "Unverified" : TONE_LABEL[row.tone]}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  },
});

const METRICS: {
  label: string;
  key: "assets" | "loans" | "deposits" | "equity" | "surplus" | "members";
}[] = [
  { label: "Total assets", key: "assets" },
  { label: "Gross loan portfolio", key: "loans" },
  { label: "Member deposits", key: "deposits" },
  { label: "Total equity", key: "equity" },
  { label: "Net surplus / (loss)", key: "surplus" },
  { label: "Total members", key: "members" },
];

export const financialPage = (a: Analysis, no: string): PageSpec => ({
  toc: { no, title: "Consolidated Financial Position & KPIs" },
  render: () => {
    const { year } = a.input;
    const before = a.before;
    const millions = (v: number | undefined) => (v === undefined ? null : v / 1_000_000);
    return (
      <>
        <Sec no={no} title="Consolidated Financial Position & KPIs" sub="All filing cooperatives" />
        <p>
          The table adds up the approved returns of the {a.filing.filed} filing cooperatives and
          compares them with the prior year.
          {before ? "" : " No prior-year return is available, so no comparison is shown."}
        </p>
        <table className="tbl">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="num">{year}</th>
              <th className="num">Prior year</th>
              <th className="num">Change</th>
              <th className="num">Change %</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map(({ label, key }) => (
              <tr key={key}>
                <td>{label}</td>
                <td className="num">{integer(a.now[key])}</td>
                <td className="num">{before ? integer(before[key]) : "—"}</td>
                <td className="num">{before ? integer(a.now[key] - before[key]) : "—"}</td>
                {changeCell(a.changes[key])}
              </tr>
            ))}
          </tbody>
        </table>
        <Figure
          caption={
            <>
              <b>Figure 1.</b> Consolidated financial position, prior year vs {year} (million).
            </>
          }
        >
          <HBarPairs
            unit="million"
            priorLabel="Prior year"
            currentLabel={String(year)}
            rows={[
              {
                label: "Total assets",
                prior: millions(before?.assets),
                current: a.now.assets / 1_000_000,
              },
              {
                label: "Gross loan portfolio",
                prior: millions(before?.loans),
                current: a.now.loans / 1_000_000,
              },
              {
                label: "Member deposits",
                prior: millions(before?.deposits),
                current: a.now.deposits / 1_000_000,
              },
              {
                label: "Total equity",
                prior: millions(before?.equity),
                current: a.now.equity / 1_000_000,
              },
            ]}
          />
        </Figure>
        <h3>Consolidated prudential indicators</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Indicator</th>
              <th className="num">Average {year}</th>
              <th className="num">Average prior</th>
              <th className="num">Aggregate {year}</th>
              <th className="num">Benchmark</th>
              <th style={{ width: "24mm" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {a.ratios.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="num">{percent(row.avgNow)}</td>
                <td className="num">{percent(row.avgPrior)}</td>
                <td className="num">{percent(row.aggNow)}</td>
                <td className="num">{row.bench}</td>
                <td>
                  <Pill tone={tone(row.tone)}>
                    {TONE_LABEL[row.tone] === "Not reported" ? "Unverified" : TONE_LABEL[row.tone]}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="src">
          Average = simple average of the cooperatives' ratios. Aggregate = ratio of the summed
          figures; a dash means it cannot be derived from the summed figures.
        </p>
      </>
    );
  },
});
