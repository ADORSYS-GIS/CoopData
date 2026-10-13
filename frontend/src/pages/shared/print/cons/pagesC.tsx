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
import { localizePercent, listText, tr } from "@/pages/shared/print/tpl/i18n";

const APEX_COLUMNS = 3;

type PearlsGroup = "p" | "e" | "a" | "r" | "l" | "s";

interface PearlsRow {
  group?: PearlsGroup;
  /** Key under `cons.pearls.rows`. */
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
  group: PearlsGroup | undefined,
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
  kpiRow("p", "loan_loss_coverage", "loan_loss_coverage", "100%"),
  {
    group: "e",
    label: "net_loans_assets",
    bench: "70–80%",
    value: (coops) =>
      share(
        sumKpi(filedOnly(coops), "net_loan_portfolio"),
        sumKpi(filedOnly(coops), "total_assets"),
      ),
    tone: range(70, 80),
  },
  {
    label: "deposits_assets",
    bench: "70–80%",
    value: (coops) =>
      share(
        sumKpi(filedOnly(coops), "total_member_deposits"),
        sumKpi(filedOnly(coops), "total_assets"),
      ),
    tone: range(70, 80),
  },
  kpiRow(undefined, "capital_adequacy", "capital_adequacy_ratio", "≥ 10%"),
  kpiRow("a", "par30", "par30", "≤ 5%"),
  {
    label: "npl",
    bench: "—",
    value: (coops) => avgKpi(coops, "npl_ratio"),
    tone: () => "na",
    info: true,
  },
  kpiRow("r", "roa", "roa", "≥ 3%"),
  kpiRow(undefined, "roe", "roe", "≥ 8%"),
  kpiRow(undefined, "oer", "operating_expense_ratio", "≤ 5%"),
  {
    group: "l",
    label: "liquid_funds",
    bench: "≥ 15%",
    value: (coops) => avgKpi(coops, "liquid_funds_ratio"),
    tone: (value) => (value === null ? "na" : value >= 15 ? "ok" : value >= 10 ? "warn" : "bad"),
  },
  {
    group: "s",
    label: "asset_growth",
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
    toc: index === 0 ? { no, title: tr("cons.pearls.title") } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title={tr("cons.pearls.title")}
          sub={
            columns.length > 1
              ? tr("common.part_of", { part: index + 1, parts: columns.length })
              : tr("cons.pearls.by_apex")
          }
        />
        {index === 0 && <p>{tr("cons.pearls.intro")}</p>}
        <table className="tbl">
          <thead>
            <tr>
              <th>{tr("common.indicator")}</th>
              {group.map((name) => (
                <th key={name} className="num">
                  {name}
                </th>
              ))}
              <th className="num">{tr("common.sector")}</th>
              <th className="num">{tr("common.benchmark")}</th>
              <th style={{ width: "22mm" }}>{tr("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const sector = row.value(a.coops, a.prior ?? undefined);
              return (
                <Fragment key={row.label}>
                  {row.group && (
                    <tr className="grp">
                      <td colSpan={group.length + 4}>{tr(`cons.pearls.groups.${row.group}`)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="ind">{tr(`cons.pearls.rows.${row.label}`)}</td>
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
                    <td className="num">{localizePercent(row.bench)}</td>
                    <td>
                      {row.info ? (
                        <Pill tone="na">{tr("common.info")}</Pill>
                      ) : (
                        <Pill tone={row.tone(sector)} />
                      )}
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
  toc: { no, title: tr("cons.social.title") },
  render: () => {
    const { year } = a.input;
    const now = a.filed;
    const before = a.prior && a.prior.length > 0 ? a.prior : null;
    const borrowers = sumNf(now, "active_borrowers");
    const borrowersBefore = before ? sumNf(before, "active_borrowers") : 0;
    const counts = [
      { label: tr("cons.social.active_members"), key: "active_members" as const },
      { label: tr("cons.social.active_borrowers"), key: "active_borrowers" as const },
    ];
    const rates = [
      { label: tr("cons.social.savings_penetration"), key: "savings_penetration_pct" as const },
      { label: tr("cons.social.credit_penetration"), key: "credit_penetration_pct" as const },
    ];
    const segments = [
      { label: tr("cons.social.women_borrowers"), key: "women_borrowers" as const },
      { label: tr("cons.social.youth_borrowers"), key: "youth_borrowers" as const },
      { label: tr("cons.social.rural_borrowers"), key: "rural_borrowers" as const },
    ];
    const declining = segments.filter((s) => {
      const shareNow = borrowers > 0 ? sumNf(now, s.key) / borrowers : 0;
      const shareBefore =
        before && borrowersBefore > 0 ? sumNf(before, s.key) / borrowersBefore : shareNow;
      return shareNow < shareBefore - 0.005;
    });

    return (
      <>
        <Sec no={no} title={tr("cons.social.title")} sub={tr("cons.social.sub")} />
        <p>{tr("cons.social.intro", { count: a.filing.filed })}</p>
        <table className="tbl">
          <thead>
            <tr>
              <th>{tr("common.metric")}</th>
              <th className="num">{year}</th>
              <th className="num">{tr("common.prior_year")}</th>
              <th className="num">{tr("common.change")}</th>
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

        <h3>{tr("cons.social.credit_flow")}</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>{tr("cons.social.segment")}</th>
              <th className="num">{tr("cons.social.borrowers_year", { year })}</th>
              <th className="num">{tr("cons.social.share_borrowers")}</th>
              <th className="num">{tr("cons.social.borrowers_prior")}</th>
              <th className="num">{tr("common.change")}</th>
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
              <b>{tr("cons.social.fig_3")}</b> {tr("cons.social.fig_3_caption", { year })}
            </>
          }
        >
          <HBarPairs
            unit={tr("cons.social.number_borrowers")}
            priorLabel={tr("common.prior_year")}
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
          <Note title={tr("cons.social.note_title")}>
            {tr(a.input.tier === "Apex" ? "cons.social.note_apex" : "cons.social.note", {
              segments: listText(declining.map((s) => tr(`cons.social.segment_names.${s.key}`))),
            })}
          </Note>
        )}
      </>
    );
  },
});
