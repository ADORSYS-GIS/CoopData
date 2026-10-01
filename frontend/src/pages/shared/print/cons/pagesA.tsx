import type { Analysis } from "@/pages/shared/print/cons/analysis";
import { concernsOf, strengthsOf, verdictOf } from "@/pages/shared/print/cons/text";
import {
  integer,
  money,
  percent,
  pointChange,
  toneLabel,
  totalsOf,
  type Change,
} from "@/pages/shared/print/consolidated/stats";
import { tr } from "@/pages/shared/print/tpl/i18n";
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
    ? tr("common.on_prior", {
        arrow: change.tone === "down" ? "▼" : "▲",
        change: change.text.replace(/^[+-]/, ""),
        prior,
      })
    : undefined;

const changeCell = (change: Change | null) => (
  <td className={`num ${change?.tone === "down" ? "dn" : change?.tone === "up" ? "up" : ""}`}>
    {change?.text ?? "—"}
  </td>
);

export const executivePage = (a: Analysis, no: string): PageSpec => ({
  toc: { no, title: tr("common.executive_summary") },
  render: () => {
    const { year } = a.input;
    const { verdict, body } = verdictOf(a);
    const strengths = strengthsOf(a);
    const concerns = concernsOf(a);
    const prior = `${year - 1}`;
    return (
      <>
        <Sec
          no={no}
          title={tr("common.executive_summary")}
          sub={tr("common.reporting_year_value", { year })}
        />
        <Opinion label={tr("common.overall_view")} verdict={verdict}>
          {a.input.narrative || body}
        </Opinion>
        <Kpis
          items={[
            {
              label: tr("cons.financial.metrics.assets"),
              value: money(a.now.assets),
              note: noteOf(a.changes.assets, prior),
              down: a.changes.assets?.tone === "down",
            },
            {
              label: tr("cons.exec.gross_loan_portfolio"),
              value: money(a.now.loans),
              note: noteOf(a.changes.loans, prior),
              down: a.changes.loans?.tone === "down",
            },
            {
              label: tr("cons.exec.total_equity"),
              value: money(a.now.equity),
              note: noteOf(a.changes.equity, prior),
              down: a.changes.equity?.tone === "down",
            },
            {
              label: tr("common.members"),
              value: integer(a.now.members),
              note: noteOf(a.changes.members, prior),
              down: a.changes.members?.tone === "down",
            },
          ]}
        />
        <div className="two">
          <div>
            <h3 style={{ marginTop: 0 }}>{tr("common.strengths")}</h3>
            <FindList items={strengths.length > 0 ? strengths : [tr("common.no_strength")]} />
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>{tr("common.areas_of_concern")}</h3>
            <FindList red items={concerns.length > 0 ? concerns : [tr("common.no_concern")]} />
          </div>
        </div>
        <h3>{tr("common.scorecard_glance")}</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>{tr("common.area")}</th>
              <th>{tr("common.key_indicator")}</th>
              <th className="num">{year}</th>
              <th className="num">{tr("common.prior")}</th>
              <th className="num">{tr("common.benchmark")}</th>
              <th style={{ width: "24mm" }}>{tr("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {a.ratios.map((row) => (
              <tr key={row.key}>
                <td>{row.area}</td>
                <td>{tr("cons.exec.average", { label: row.label.toLowerCase() })}</td>
                <td className="num">{percent(row.avgNow)}</td>
                <td className="num">{percent(row.avgPrior)}</td>
                <td className="num">{row.bench}</td>
                <td>
                  <Pill tone={tone(row.tone)}>{toneLabel(row.tone)}</Pill>
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
  key: "assets" | "loans" | "deposits" | "equity" | "surplus" | "members";
}[] = [
  { key: "assets" },
  { key: "loans" },
  { key: "deposits" },
  { key: "equity" },
  { key: "surplus" },
  { key: "members" },
];

export const financialPage = (a: Analysis, no: string): PageSpec => ({
  toc: { no, title: tr("cons.financial.title") },
  render: () => {
    const { year } = a.input;
    const before = a.before;
    const millions = (v: number | undefined) => (v === undefined ? null : v / 1_000_000);
    return (
      <>
        <Sec no={no} title={tr("cons.financial.title")} sub={tr("cons.financial.sub")} />
        <p>
          {tr("cons.financial.intro", { count: a.filing.filed })}
          {before ? "" : tr("cons.financial.no_prior")}
        </p>
        <table className="tbl">
          <thead>
            <tr>
              <th>{tr("common.metric")}</th>
              <th className="num">{year}</th>
              <th className="num">{tr("common.prior_year")}</th>
              <th className="num">{tr("common.change")}</th>
              <th className="num">{tr("common.change_pct")}</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map(({ key }) => (
              <tr key={key}>
                <td>{tr(`cons.financial.metrics.${key}`)}</td>
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
              <b>{tr("cons.financial.fig_1")}</b> {tr("cons.financial.fig_1_caption", { year })}
            </>
          }
        >
          <HBarPairs
            unit={tr("common.million")}
            priorLabel={tr("common.prior_year")}
            currentLabel={String(year)}
            rows={[
              {
                label: tr("cons.financial.metrics.assets"),
                prior: millions(before?.assets),
                current: a.now.assets / 1_000_000,
              },
              {
                label: tr("cons.financial.metrics.loans"),
                prior: millions(before?.loans),
                current: a.now.loans / 1_000_000,
              },
              {
                label: tr("cons.financial.metrics.deposits"),
                prior: millions(before?.deposits),
                current: a.now.deposits / 1_000_000,
              },
              {
                label: tr("cons.financial.metrics.equity"),
                prior: millions(before?.equity),
                current: a.now.equity / 1_000_000,
              },
            ]}
          />
        </Figure>
        <h3>{tr("cons.financial.prudential")}</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>{tr("common.indicator")}</th>
              <th className="num">{tr("cons.financial.average_year", { year })}</th>
              <th className="num">{tr("cons.financial.average_prior")}</th>
              <th className="num">{tr("cons.financial.aggregate_year", { year })}</th>
              <th className="num">{tr("common.benchmark")}</th>
              <th style={{ width: "24mm" }}>{tr("common.status")}</th>
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
                  <Pill tone={tone(row.tone)}>{toneLabel(row.tone)}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="src">{tr("cons.financial.note")}</p>
      </>
    );
  },
});
