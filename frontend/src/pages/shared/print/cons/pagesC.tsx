import { Fragment } from "react";

import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import type { Analysis } from "@/pages/shared/print/cons/analysis";
import {
  avgKpi,
  changeOf,
  chunk,
  integer,
  percent,
  pointChange,
  sumKpi,
  toneOf,
  type Change,
  type Tone,
} from "@/pages/shared/print/consolidated/stats";
import { HBarPairs } from "@/pages/shared/print/tpl/TplCharts";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure, Note, Pill } from "@/pages/shared/print/tpl/TplParts";

const APEX_COLUMNS = 3;

interface PearlsRow {
  group?: string;
  label: string;
  bench: string;
  value: (coops: readonly CoopKpiRow[], prior: readonly CoopKpiRow[] | undefined) => number | null;
  tone: (value: number | null) => Tone;
  info?: boolean;
}

const filedOnly = (coops: readonly CoopKpiRow[]) => coops.filter((c) => c.has_data);
const share = (a: number, b: number): number | null => (b > 0 ? (a / b) * 100 : null);
const range =
  (low: number, high: number) =>
  (value: number | null): Tone =>
    value === null ? "na" : value >= low && value <= high ? "ok" : "warn";

const growth =
  (key: string) =>
  (coops: readonly CoopKpiRow[], prior: readonly CoopKpiRow[] | undefined): number | null => {
    if (!prior || prior.length === 0) return null;
    const before = sumKpi(prior, key);
    return before > 0 ? ((sumKpi(filedOnly(coops), key) - before) / before) * 100 : null;
  };

const kpiRow = (
  group: string | undefined,
  label: string,
  key: string,
  bench: string,
): PearlsRow => ({
  group,
  label,
  bench,
  value: (coops) => avgKpi(coops, key),
  tone: (value) => toneOf(key, value),
});

const ROWS: PearlsRow[] = [
  kpiRow("P — Protection", "Loan-loss coverage", "loan_loss_coverage", "100%"),
  {
    group: "E — Effective financial structure",
    label: "Net loans / total assets",
    bench: "70–80%",
    value: (coops) =>
      share(
        sumKpi(filedOnly(coops), "net_loan_portfolio"),
        sumKpi(filedOnly(coops), "total_assets"),
      ),
    tone: range(70, 80),
  },
  {
    label: "Deposits / total assets",
    bench: "70–80%",
    value: (coops) =>
      share(
        sumKpi(filedOnly(coops), "total_member_deposits"),
        sumKpi(filedOnly(coops), "total_assets"),
      ),
    tone: range(70, 80),
  },
  kpiRow(undefined, "Capital adequacy", "capital_adequacy_ratio", "≥ 10%"),
  kpiRow("A — Asset quality", "PAR >30 days", "par30", "≤ 5%"),
  {
    label: "Non-performing loan ratio",
    bench: "—",
    value: (coops) => avgKpi(coops, "npl_ratio"),
    tone: () => "na",
    info: true,
  },
  kpiRow("R — Rates of return & costs", "Return on assets", "roa", "≥ 3%"),
  kpiRow(undefined, "Return on equity", "roe", "≥ 8%"),
  kpiRow(undefined, "Operating expense ratio", "operating_expense_ratio", "≤ 5%"),
  {
    group: "L — Liquidity",
    label: "Liquid funds ratio",
    bench: "≥ 15%",
    value: (coops) => avgKpi(coops, "liquid_funds_ratio"),
    tone: (value) => (value === null ? "na" : value >= 15 ? "ok" : value >= 10 ? "warn" : "bad"),
  },
  {
    group: "S — Signs of growth",
    label: "Asset growth (year on year)",
    bench: "—",
    value: growth("total_assets"),
    tone: () => "na",
    info: true,
  },
];

export const pearlsPages = (a: Analysis, no: string): PageSpec[] => {
  const names = a.apexes.map((apex) => apex.name);
  const parts = chunk(names, APEX_COLUMNS);
  const columns = parts.length > 0 ? parts : [[]];

  return columns.map((group, index): PageSpec => ({
    toc: index === 0 ? { no, title: "PEARLS Benchmark Comparison" } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title="PEARLS Benchmark Comparison"
          sub={
            columns.length > 1 ? `Part ${index + 1} of ${columns.length}` : "By apex organisation"
          }
        />
        {index === 0 && (
          <p>
            Prudential indicators grouped by PEARLS area. Each apex figure is the simple average of
            its filing cooperatives; the sector column covers all filing cooperatives. A dash means
            the figure was not reported.
          </p>
        )}
        <table className="tbl">
          <thead>
            <tr>
              <th>Indicator</th>
              {group.map((name) => (
                <th key={name} className="num">
                  {name}
                </th>
              ))}
              <th className="num">Sector</th>
              <th className="num">Benchmark</th>
              <th style={{ width: "22mm" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const sector = row.value(a.coops, a.prior ?? undefined);
              return (
                <Fragment key={row.label}>
                  {row.group && (
                    <tr className="grp">
                      <td colSpan={group.length + 4}>{row.group}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="ind">{row.label}</td>
                    {group.map((name) => {
                      const apex = a.apexes.find((x) => x.name === name);
                      const value = apex ? row.value(apex.coops, a.priorApexes.get(name)) : null;
                      return (
                        <td key={name} className="num">
                          {percent(value)}
                        </td>
                      );
                    })}
                    <td className="num">{percent(sector)}</td>
                    <td className="num">{row.bench}</td>
                    <td>
                      {row.info ? <Pill tone="na">Info</Pill> : <Pill tone={row.tone(sector)} />}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </>
    ),
  }));
};

const sumNf = (coops: readonly CoopKpiRow[], key: keyof CoopKpiRow["non_financial"]): number =>
  coops.reduce((total, coop) => {
    const value = coop.non_financial?.[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);

const avgNf = (
  coops: readonly CoopKpiRow[],
  key: keyof CoopKpiRow["non_financial"],
): number | null => {
  const values = coops
    .filter((c) => typeof c.non_financial?.[key] === "number")
    .map((c) => c.non_financial[key] as number);
  return values.length > 0 ? values.reduce((x, y) => x + y, 0) / values.length : null;
};

const cell = (change: Change | null) => (
  <td className={`num ${change?.tone === "down" ? "dn" : change?.tone === "up" ? "up" : ""}`}>
    {change?.text ?? "—"}
  </td>
);

export const socialPage = (a: Analysis, no: string): PageSpec => ({
  toc: { no, title: "Social Impact & Financial Inclusion" },
  render: () => {
    const { year } = a.input;
    const now = a.filed;
    const before = a.prior && a.prior.length > 0 ? a.prior : null;
    const borrowers = sumNf(now, "active_borrowers");
    const borrowersBefore = before ? sumNf(before, "active_borrowers") : 0;
    const counts = [
      { label: "Active members", key: "active_members" as const },
      { label: "Active borrowers", key: "active_borrowers" as const },
    ];
    const rates = [
      { label: "Savings penetration (average)", key: "savings_penetration_pct" as const },
      { label: "Credit penetration (average)", key: "credit_penetration_pct" as const },
    ];
    const segments = [
      { label: "Women borrowers", key: "women_borrowers" as const },
      { label: "Youth borrowers (18–35)", key: "youth_borrowers" as const },
      { label: "Rural borrowers", key: "rural_borrowers" as const },
    ];
    const declining = segments.filter((s) => {
      const shareNow = borrowers > 0 ? sumNf(now, s.key) / borrowers : 0;
      const shareBefore =
        before && borrowersBefore > 0 ? sumNf(before, s.key) / borrowersBefore : shareNow;
      return shareNow < shareBefore - 0.005;
    });

    return (
      <>
        <Sec
          no={no}
          title="Social Impact & Financial Inclusion"
          sub="Membership and credit reach"
        />
        <p>
          How many people the cooperatives serve and how credit reaches women, young people and
          rural members. Figures cover the {a.filing.filed} filing cooperatives.
        </p>
        <table className="tbl">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="num">{year}</th>
              <th className="num">Prior year</th>
              <th className="num">Change</th>
            </tr>
          </thead>
          <tbody>
            {counts.map(({ label, key }) => (
              <tr key={key}>
                <td>{label}</td>
                <td className="num">{integer(sumNf(now, key))}</td>
                <td className="num">{before ? integer(sumNf(before, key)) : "—"}</td>
                {cell(before ? changeOf(sumNf(now, key), sumNf(before, key)) : null)}
              </tr>
            ))}
            {rates.map(({ label, key }) => {
              const current = avgNf(now, key);
              const prior = before ? avgNf(before, key) : null;
              return (
                <tr key={key}>
                  <td>{label}</td>
                  <td className="num">{percent(current)}</td>
                  <td className="num">{percent(prior)}</td>
                  {cell(pointChange(current, prior))}
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3>Credit flow to priority segments</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Segment</th>
              <th className="num">Borrowers {year}</th>
              <th className="num">Share of borrowers</th>
              <th className="num">Borrowers prior</th>
              <th className="num">Change</th>
            </tr>
          </thead>
          <tbody>
            {segments.map(({ label, key }) => (
              <tr key={key}>
                <td>{label}</td>
                <td className="num">{integer(sumNf(now, key))}</td>
                <td className="num">
                  {borrowers > 0 ? percent((sumNf(now, key) / borrowers) * 100) : "—"}
                </td>
                <td className="num">{before ? integer(sumNf(before, key)) : "—"}</td>
                {cell(before ? changeOf(sumNf(now, key), sumNf(before, key)) : null)}
              </tr>
            ))}
          </tbody>
        </table>
        <Figure
          caption={
            <>
              <b>Figure 3.</b> Borrowers in priority segments, prior year vs {year}.
            </>
          }
        >
          <HBarPairs
            unit="Number of borrowers"
            priorLabel="Prior year"
            currentLabel={String(year)}
            format={(v) => integer(v)}
            rows={segments.map(({ label, key }) => ({
              label,
              prior: before ? sumNf(before, key) : null,
              current: sumNf(now, key),
            }))}
          />
        </Figure>
        {declining.length > 0 && (
          <Note title="Inclusion note.">
            The share of active borrowers who are{" "}
            {declining.map((s) => s.label.toLowerCase().replace(" borrowers", "")).join(" and ")}{" "}
            fell against the prior year. {a.input.tier === "Apex" ? "Cooperatives" : "Apexes"}{" "}
            should be asked to explain the trend and set inclusion targets.
          </Note>
        )}
      </>
    );
  },
});
