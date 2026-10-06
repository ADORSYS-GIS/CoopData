import type { CoopAnalysis } from "@/pages/shared/print/coop/analysis";
import {
  changePct,
  fmtChange,
  fmtInt,
  fmtPct,
  type StatementLine,
} from "@/pages/shared/print/coop/data";
import { chunk } from "@/pages/shared/print/consolidated/stats";
import { HBarPairs, LIGHT, RED, TEAL, VBarGroups } from "@/pages/shared/print/tpl/TplCharts";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { StructureFigures } from "@/pages/shared/print/coop/pages5";
import { Fn, Figure } from "@/pages/shared/print/tpl/TplParts";
import { percentText, tr } from "@/pages/shared/print/tpl/i18n";

const ROWS_PER_PAGE = 28;
const FIGURE_ROOM = 22;
const POSITION_FIGURE_ROOM = 10;

interface Row {
  kind: "grp" | "line" | "total" | "grand";
  code?: number | string;
  name: string;
  current?: number;
  prior?: number;
  /** Footnote key for Annex A. */
  note?: string;
  /** Shown in brackets, as an expense. */
  neg?: boolean;
}

const linesOf = (lines: readonly StatementLine[]): Row[] =>
  lines.map((l) => ({
    kind: "line",
    code: l.code,
    name: l.name,
    current: l.current,
    prior: l.prior,
  }));

interface TableProps {
  rows: Row[];
  a: CoopAnalysis;
  shareLabel: string;
  base: { current: number; prior: number };
}

function StatementTable({ rows, a, shareLabel, base }: TableProps) {
  return (
    <table className="tbl compact">
      <thead>
        <tr>
          <th style={{ width: "14mm" }} className="code">
            {tr("coop.statement.code")}
          </th>
          <th>{tr("coop.statement.account")}</th>
          <th className="num">{tr("common.fy", { year: a.year })}</th>
          <th className="num">{tr("common.fy", { year: a.year - 1 })}</th>
          <th className="num">{tr("common.change")}</th>
          <th className="num">{shareLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          if (row.kind === "grp") {
            return (
              <tr key={`g${index}`} className="grp">
                <td colSpan={6}>{row.name}</td>
              </tr>
            );
          }
          const sign = (v: number | undefined) =>
            v === undefined ? undefined : row.neg ? -Math.abs(v) : v;
          const cur = sign(row.current);
          const pri = sign(row.prior);
          const change =
            row.current !== undefined
              ? changePct(
                  Math.abs(row.current),
                  row.prior === undefined ? undefined : Math.abs(row.prior),
                )
              : null;
          const share =
            base.current !== 0 && row.current !== undefined
              ? (Math.abs(row.current) / Math.abs(base.current)) * 100
              : null;
          return (
            <tr key={`${row.code}-${index}`} className={row.kind === "line" ? undefined : row.kind}>
              <td className="code">{row.code}</td>
              <td>
                {row.name}
                {row.note && a.footnote(row.note) && <Fn id={a.footnote(row.note) ?? ""} />}
              </td>
              <td className="num">{fmtInt(cur)}</td>
              <td className="num">{fmtInt(pri)}</td>
              <td className="num">{fmtChange(change)}</td>
              <td className="num">{fmtPct(share)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const paginate = (rows: Row[]): Row[][] => chunk(rows, ROWS_PER_PAGE);

export const positionPages = (a: CoopAnalysis, no: string): PageSpec[] => {
  const s = a.statement;
  const rows: Row[] = [
    { kind: "grp", name: tr("coop.statement.assets") },
    ...linesOf(s.assets),
    {
      kind: "total",
      code: 1999,
      name: tr("coop.statement.total_assets"),
      current: s.totals.assets.current,
      prior: s.totals.assets.prior,
      note: "assets",
    },
    { kind: "grp", name: tr("coop.statement.liabilities") },
    ...linesOf(s.liabilities),
    {
      kind: "total",
      code: 2999,
      name: tr("coop.statement.total_liabilities"),
      current: s.totals.liabilities.current,
      prior: s.totals.liabilities.prior,
    },
    { kind: "grp", name: tr("coop.statement.equity") },
    ...linesOf(s.equity),
    {
      kind: "total",
      code: 3999,
      name: tr("coop.statement.total_equity"),
      current: s.totals.equity.current,
      prior: s.totals.equity.prior,
      note: "equity",
    },
    {
      kind: "grand",
      name: tr("coop.statement.total_liabilities_equity"),
      current: s.totals.liabilities.current + s.totals.equity.current,
      prior: s.totals.liabilities.prior + s.totals.equity.prior,
    },
  ];
  const pages = paginate(rows);
  const lastRows = pages[pages.length - 1]?.length ?? 0;
  const figureOnLast = lastRows <= POSITION_FIGURE_ROOM;
  const assets = s.totals.assets;
  const netLoans = a.props.kpisData.kpis.find(
    (k) => k.name.toLowerCase() === "net_loan_portfolio",
  )?.value;
  const savings = a.props.kpisData.kpis.find(
    (k) => k.name.toLowerCase() === "total_member_deposits",
  )?.value;
  const priorKpis = a.props.kpisData.prior_year_kpis ?? [];
  const priorOf = (name: string) => priorKpis.find((k) => k.name.toLowerCase() === name)?.value;
  const m = (v: number | undefined) => (v === undefined ? null : v / 1_000_000);
  const figure = (
    <>
      <Figure
        caption={
          <>
            <b>{tr("coop.statement.fig_1")}</b>{" "}
            {tr("coop.statement.fig_1_caption", { prior: a.year - 1, year: a.year })}
          </>
        }
      >
        <HBarPairs
          unit={tr("common.million")}
          priorLabel={tr("common.fy", { year: a.year - 1 })}
          currentLabel={tr("common.fy", { year: a.year })}
          rows={[
            {
              label: tr("coop.statement.total_assets"),
              prior: m(assets.prior),
              current: m(assets.current) ?? 0,
            },
            {
              label: tr("coop.statement.net_loan_portfolio"),
              prior: m(priorOf("net_loan_portfolio")),
              current: m(netLoans) ?? 0,
            },
            {
              label: tr("coop.statement.member_savings"),
              prior: m(priorOf("total_member_deposits")),
              current: m(savings) ?? 0,
            },
            {
              label: tr("coop.statement.total_liabilities"),
              prior: m(s.totals.liabilities.prior),
              current: m(s.totals.liabilities.current) ?? 0,
            },
            {
              label: tr("coop.statement.total_equity"),
              prior: m(s.totals.equity.prior),
              current: m(s.totals.equity.current) ?? 0,
            },
          ]}
        />
      </Figure>
      <StructureFigures a={a} />
    </>
  );
  const growth = changePct(assets.current, assets.prior);
  const intro = (
    <p>
      {growth === null
        ? tr("coop.statement.position_as_reported")
        : tr(growth >= 0 ? "coop.statement.assets_increased" : "coop.statement.assets_decreased", {
            change: percentText(Math.abs(growth)),
            value: fmtInt(assets.current),
          })}{" "}
      {tr("coop.statement.equity_share", {
        share: fmtPct(assets.current > 0 ? (s.totals.equity.current / assets.current) * 100 : null),
      })}
    </p>
  );

  const result = pages.map((pageRows, index): PageSpec => ({
    toc: index === 0 ? { no, title: tr("coop.statement.position_title") } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title={tr("coop.statement.position_title")}
          sub={
            pages.length > 1
              ? tr("common.part_of", { part: index + 1, parts: pages.length })
              : tr("common.as_at_31_december")
          }
        />
        {index === 0 && intro}
        <StatementTable
          rows={pageRows}
          a={a}
          shareLabel={tr("coop.statement.pct_assets")}
          base={assets}
        />
        {index === pages.length - 1 && figureOnLast && figure}
      </>
    ),
  }));
  if (!figureOnLast) {
    result.push({
      render: () => (
        <>
          <Sec title={tr("coop.statement.position_title")} sub={tr("coop.statement.structure")} />
          {figure}
        </>
      ),
    });
  }
  return result;
};

export const performancePages = (a: CoopAnalysis, no: string): PageSpec[] => {
  const s = a.statement;
  const rows: Row[] = [
    { kind: "grp", name: tr("coop.statement.income") },
    ...linesOf(s.income),
    {
      kind: "total",
      name: tr("coop.statement.total_income"),
      code: 4999,
      current: s.totals.income.current,
      prior: s.totals.income.prior,
    },
    { kind: "grp", name: tr("coop.statement.expenditure") },
    ...s.expenses.map((l): Row => ({
      kind: "line",
      code: l.code,
      name: l.name,
      current: l.current,
      prior: l.prior,
      neg: true,
    })),
    {
      kind: "total",
      name: tr("coop.statement.total_expenditure"),
      code: 5999,
      current: Math.abs(s.totals.expenses.current),
      prior: Math.abs(s.totals.expenses.prior),
      neg: true,
    },
    {
      kind: "grand",
      name: tr("coop.statement.net_surplus_year"),
      code: 6999,
      current: s.totals.surplus.current,
      prior: s.totals.surplus.prior,
      note: "surplus",
    },
  ];
  const pages = paginate(rows);
  const lastRows = pages[pages.length - 1]?.length ?? 0;
  const figureOnLast = lastRows <= FIGURE_ROOM;
  const inc = s.totals.income;
  const exp = {
    current: Math.abs(s.totals.expenses.current),
    prior: Math.abs(s.totals.expenses.prior),
  };
  const sur = s.totals.surplus;
  const m = (v: number) => v / 1_000_000;
  const figure = (
    <Figure
      caption={
        <>
          <b>{tr("coop.statement.fig_2")}</b>{" "}
          {tr("coop.statement.fig_2_caption", { prior: a.year - 1, year: a.year })}
        </>
      }
    >
      <VBarGroups
        unit={tr("common.million")}
        series={[
          { name: tr("common.fy", { year: a.year - 1 }), color: LIGHT },
          { name: tr("coop.statement.series_income", { year: a.year }), color: TEAL },
          { name: tr("coop.statement.series_expenditure", { year: a.year }), color: RED },
        ]}
        data={[
          {
            label: tr("coop.statement.total_income"),
            values: [m(inc.prior), m(inc.current), null],
          },
          {
            label: tr("coop.statement.total_expenditure"),
            values: [m(exp.prior), null, m(exp.current)],
          },
          {
            label: tr("coop.statement.net_surplus"),
            values: [m(sur.prior), m(sur.current), null],
          },
        ]}
      />
    </Figure>
  );
  const growth = changePct(inc.current, inc.prior);
  const intro = (
    <p>
      {growth === null
        ? tr("coop.statement.performance_as_reported")
        : tr(growth >= 0 ? "coop.statement.income_rose" : "coop.statement.income_fell", {
            change: percentText(Math.abs(growth)),
            value: fmtInt(inc.current),
          })}{" "}
      {sur.prior
        ? tr("coop.statement.surplus_with_prior", {
            value: fmtInt(sur.current),
            prior: fmtInt(sur.prior),
          })
        : tr("coop.statement.surplus", { value: fmtInt(sur.current) })}
    </p>
  );
  const result = pages.map((pageRows, index): PageSpec => ({
    toc: index === 0 ? { no, title: tr("coop.statement.performance_title") } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title={tr("coop.statement.performance_title")}
          sub={
            pages.length > 1
              ? tr("common.part_of", { part: index + 1, parts: pages.length })
              : tr("common.year_ended_31_december")
          }
        />
        {index === 0 && intro}
        <StatementTable
          rows={pageRows}
          a={a}
          shareLabel={tr("coop.statement.pct_income")}
          base={inc}
        />
        {index === pages.length - 1 && figureOnLast && figure}
      </>
    ),
  }));
  if (!figureOnLast) {
    result.push({
      render: () => (
        <>
          <Sec
            title={tr("coop.statement.performance_title")}
            sub={tr("coop.statement.income_surplus")}
          />
          {figure}
        </>
      ),
    });
  }
  return result;
};
