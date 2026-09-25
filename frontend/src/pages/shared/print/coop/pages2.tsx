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
import { Fn, Figure } from "@/pages/shared/print/tpl/TplParts";

const ROWS_PER_PAGE = 28;
const FIGURE_ROOM = 22;

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
            Code
          </th>
          <th>Account</th>
          <th className="num">FY {a.year}</th>
          <th className="num">FY {a.year - 1}</th>
          <th className="num">Change</th>
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
    { kind: "grp", name: "Assets" },
    ...linesOf(s.assets),
    {
      kind: "total",
      code: 1999,
      name: "Total assets",
      current: s.totals.assets.current,
      prior: s.totals.assets.prior,
      note: "assets",
    },
    { kind: "grp", name: "Liabilities" },
    ...linesOf(s.liabilities),
    {
      kind: "total",
      code: 2999,
      name: "Total liabilities",
      current: s.totals.liabilities.current,
      prior: s.totals.liabilities.prior,
    },
    { kind: "grp", name: "Equity" },
    ...linesOf(s.equity),
    {
      kind: "total",
      code: 3999,
      name: "Total equity",
      current: s.totals.equity.current,
      prior: s.totals.equity.prior,
      note: "equity",
    },
    {
      kind: "grand",
      name: "Total liabilities & equity",
      current: s.totals.liabilities.current + s.totals.equity.current,
      prior: s.totals.liabilities.prior + s.totals.equity.prior,
    },
  ];
  const pages = paginate(rows);
  const lastRows = pages[pages.length - 1]?.length ?? 0;
  const figureOnLast = lastRows <= FIGURE_ROOM;
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
    <Figure
      caption={
        <>
          <b>Figure 1.</b> Balance-sheet structure, FY {a.year - 1} vs FY {a.year} (million).
        </>
      }
    >
      <HBarPairs
        unit="million"
        priorLabel={`FY ${a.year - 1}`}
        currentLabel={`FY ${a.year}`}
        rows={[
          { label: "Total assets", prior: m(assets.prior), current: m(assets.current) ?? 0 },
          {
            label: "Net loan portfolio",
            prior: m(priorOf("net_loan_portfolio")),
            current: m(netLoans) ?? 0,
          },
          {
            label: "Member savings",
            prior: m(priorOf("total_member_deposits")),
            current: m(savings) ?? 0,
          },
          {
            label: "Total liabilities",
            prior: m(s.totals.liabilities.prior),
            current: m(s.totals.liabilities.current) ?? 0,
          },
          {
            label: "Total equity",
            prior: m(s.totals.equity.prior),
            current: m(s.totals.equity.current) ?? 0,
          },
        ]}
      />
    </Figure>
  );
  const growth = changePct(assets.current, assets.prior);
  const intro = (
    <p>
      {growth === null
        ? "The statement below lists the accounts as reported."
        : `Total assets ${growth >= 0 ? "increased" : "decreased"} by ${Math.abs(growth).toFixed(1)}% to ${fmtInt(assets.current)}.`}{" "}
      Equity is{" "}
      {fmtPct(assets.current > 0 ? (s.totals.equity.current / assets.current) * 100 : null)} of
      total assets.
    </p>
  );

  const result = pages.map((pageRows, index): PageSpec => ({
    toc: index === 0 ? { no, title: "Statement of Financial Position" } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title="Statement of Financial Position"
          sub={pages.length > 1 ? `Part ${index + 1} of ${pages.length}` : `As at 31 December`}
        />
        {index === 0 && intro}
        <StatementTable rows={pageRows} a={a} shareLabel="% of assets" base={assets} />
        {index === pages.length - 1 && figureOnLast && figure}
      </>
    ),
  }));
  if (!figureOnLast) {
    result.push({
      render: () => (
        <>
          <Sec title="Statement of Financial Position" sub="Structure" />
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
    { kind: "grp", name: "Income" },
    ...linesOf(s.income),
    {
      kind: "total",
      name: "Total income",
      code: 4999,
      current: s.totals.income.current,
      prior: s.totals.income.prior,
    },
    { kind: "grp", name: "Expenditure" },
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
      name: "Total expenditure",
      code: 5999,
      current: Math.abs(s.totals.expenses.current),
      prior: Math.abs(s.totals.expenses.prior),
      neg: true,
    },
    {
      kind: "grand",
      name: "Net surplus for the year",
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
          <b>Figure 2.</b> Income, expenditure and surplus, FY {a.year - 1} vs FY {a.year}{" "}
          (million).
        </>
      }
    >
      <VBarGroups
        unit="million"
        series={[
          { name: `FY ${a.year - 1}`, color: LIGHT },
          { name: `FY ${a.year} income / surplus`, color: TEAL },
          { name: `FY ${a.year} expenditure`, color: RED },
        ]}
        data={[
          { label: "Total income", values: [m(inc.prior), m(inc.current), null] },
          { label: "Total expenditure", values: [m(exp.prior), null, m(exp.current)] },
          { label: "Net surplus", values: [m(sur.prior), m(sur.current), null] },
        ]}
      />
    </Figure>
  );
  const growth = changePct(inc.current, inc.prior);
  const intro = (
    <p>
      {growth === null
        ? "The statement below lists income and expenditure as reported."
        : `Total income ${growth >= 0 ? "rose" : "fell"} ${Math.abs(growth).toFixed(1)}% to ${fmtInt(inc.current)}.`}{" "}
      The net surplus is {fmtInt(sur.current)}
      {sur.prior ? `, against ${fmtInt(sur.prior)} in the prior year` : ""}.
    </p>
  );
  const result = pages.map((pageRows, index): PageSpec => ({
    toc: index === 0 ? { no, title: "Statement of Financial Performance" } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title="Statement of Financial Performance"
          sub={pages.length > 1 ? `Part ${index + 1} of ${pages.length}` : "Year ended 31 December"}
        />
        {index === 0 && intro}
        <StatementTable rows={pageRows} a={a} shareLabel="% of income" base={inc} />
        {index === pages.length - 1 && figureOnLast && figure}
      </>
    ),
  }));
  if (!figureOnLast) {
    result.push({
      render: () => (
        <>
          <Sec title="Statement of Financial Performance" sub="Income & surplus" />
          {figure}
        </>
      ),
    });
  }
  return result;
};
