import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import type { Analysis } from "@/pages/shared/print/cons/analysis";
import {
  avgKpi,
  chunk,
  groupBy,
  integer,
  money,
  percent,
  sumKpi,
  sumMembers,
  toneOf,
  type Tone,
} from "@/pages/shared/print/consolidated/stats";
import { VBarGroups, TEAL, LIGHT, RED } from "@/pages/shared/print/tpl/TplCharts";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure, Pill } from "@/pages/shared/print/tpl/TplParts";

const CHECKED = ["par30", "capital_adequacy_ratio", "roa", "operating_expense_ratio"];

/** Overall status of a group: how many of the four headline ratios are in breach. */
export const riskTone = (coops: readonly CoopKpiRow[]): Tone => {
  const filed = coops.filter((c) => c.has_data);
  if (filed.length === 0) return "na";
  const bad = CHECKED.filter((key) => toneOf(key, avgKpi(filed, key)) === "bad").length;
  const known = CHECKED.filter((key) => avgKpi(filed, key) !== null).length;
  if (known === 0) return "na";
  return bad === 0 ? "ok" : bad <= 1 ? "warn" : "bad";
};

const ratioCell = (key: string, value: number | null) => (
  <td
    className="num"
    style={{
      color:
        value === null
          ? undefined
          : `var(--${{ ok: "ok", warn: "warn", bad: "bad", na: "na" }[toneOf(key, value)]})`,
    }}
  >
    {percent(value)}
  </td>
);

const FILING = ({ rows }: { rows: { name: string; total: number; filed: number }[] }) => {
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const filed = rows.reduce((sum, r) => sum + r.filed, 0);
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Apex organisation</th>
          <th className="num">Cooperatives</th>
          <th className="num">Filed</th>
          <th className="num">Not filed</th>
          <th className="num">Filing rate</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
            <td className="num">{row.total}</td>
            <td className="num">{row.filed}</td>
            <td className="num">{row.total - row.filed}</td>
            <td className="num">
              {row.total > 0 ? `${((row.filed / row.total) * 100).toFixed(0)}%` : "—"}
            </td>
          </tr>
        ))}
        <tr className="total">
          <td>Total</td>
          <td className="num">{total}</td>
          <td className="num">{filed}</td>
          <td className="num">{total - filed}</td>
          <td className="num">{total > 0 ? `${((filed / total) * 100).toFixed(0)}%` : "—"}</td>
        </tr>
      </tbody>
    </table>
  );
};

const APEXES_PER_PAGE = 12;

export const sectorApexPages = (a: Analysis, no: string): PageSpec[] => {
  const sectors = [...groupBy(a.coops, (c) => c.sector || "Uncategorised")];
  const apexRows = a.apexes.map((apex) => ({
    ...apex,
    members: sumMembers(apex.filed),
    assets: sumKpi(apex.filed, "total_assets"),
  }));
  const compact = apexRows.length <= 4;
  const top = [...apexRows].sort((x, y) => y.assets - x.assets).slice(0, 3);
  const palette = [TEAL, LIGHT, RED, "#5E8FA3"];
  const keys = [
    ["par30", "PAR >30 days"],
    ["capital_adequacy_ratio", "Capital adequacy"],
    ["roa", "Return on assets"],
    ["operating_expense_ratio", "Operating expense"],
  ] as const;

  const sectorTable = (
    <>
      <h3>Sector breakdown</h3>
      <table className="tbl">
        <thead>
          <tr>
            <th>Sector</th>
            <th className="num">Cooperatives</th>
            <th className="num">Share</th>
            <th className="num">Filing rate</th>
            <th className="num">Avg PAR30</th>
            <th className="num">Avg CAR</th>
            <th className="num">Avg ROA</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map(([sector, members]) => {
            const filed = members.filter((c) => c.has_data);
            return (
              <tr key={sector}>
                <td>{sector}</td>
                <td className="num">{members.length}</td>
                <td className="num">
                  {percent((members.length / Math.max(a.coops.length, 1)) * 100, 0)}
                </td>
                <td className="num">{percent((filed.length / members.length) * 100, 0)}</td>
                {ratioCell("par30", avgKpi(members, "par30"))}
                {ratioCell("capital_adequacy_ratio", avgKpi(members, "capital_adequacy_ratio"))}
                {ratioCell("roa", avgKpi(members, "roa"))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );

  const comparison = (rows: typeof apexRows, showTotal: boolean) => (
    <>
      <h3>Apex comparison</h3>
      <table className="tbl compact">
        <thead>
          <tr>
            <th>Apex organisation</th>
            <th className="num">Coops</th>
            <th className="num">Members</th>
            <th className="num">Assets</th>
            <th className="num">PAR30</th>
            <th className="num">CAR</th>
            <th className="num">ROA</th>
            <th className="num">OER</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td className="num">{row.coops.length}</td>
              <td className="num">{integer(row.members)}</td>
              <td className="num">{money(row.assets)}</td>
              {ratioCell("par30", avgKpi(row.coops, "par30"))}
              {ratioCell("capital_adequacy_ratio", avgKpi(row.coops, "capital_adequacy_ratio"))}
              {ratioCell("roa", avgKpi(row.coops, "roa"))}
              {ratioCell("operating_expense_ratio", avgKpi(row.coops, "operating_expense_ratio"))}
              <td>
                <Pill tone={riskTone(row.coops)} />
              </td>
            </tr>
          ))}
          {showTotal && (
            <tr className="total">
              <td>Sector</td>
              <td className="num">{a.coops.length}</td>
              <td className="num">{integer(a.now.members)}</td>
              <td className="num">{money(a.now.assets)}</td>
              {ratioCell("par30", avgKpi(a.coops, "par30"))}
              {ratioCell("capital_adequacy_ratio", avgKpi(a.coops, "capital_adequacy_ratio"))}
              {ratioCell("roa", avgKpi(a.coops, "roa"))}
              {ratioCell("operating_expense_ratio", avgKpi(a.coops, "operating_expense_ratio"))}
              <td>
                <Pill tone={riskTone(a.coops)} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );

  const figure = (
    <Figure
      caption={
        <>
          <b>Figure 2.</b> Key ratios by apex organisation and for the whole sector (%).
        </>
      }
    >
      <VBarGroups
        unit="%"
        series={[
          ...top.map((t, i) => ({ name: t.name.slice(0, 22), color: palette[i] })),
          { name: "Sector", color: palette[3] },
        ]}
        data={keys.map(([key, label]) => ({
          label,
          values: [...top.map((t) => avgKpi(t.coops, key)), avgKpi(a.coops, key)],
        }))}
      />
    </Figure>
  );

  const filingRows = apexRows.map((r) => ({
    name: r.name,
    total: r.coops.length,
    filed: r.filed.length,
  }));
  const intro = (
    <p>
      {a.coops.length} cooperatives operate in {sectors.length} sector
      {sectors.length === 1 ? "" : "s"} and are affiliated to {apexRows.length} apex organisation
      {apexRows.length === 1 ? "" : "s"}. Ratios are simple averages of the cooperatives that filed.
    </p>
  );

  if (compact) {
    return [
      {
        toc: { no, title: "Sector & Apex Overview" },
        render: () => (
          <>
            <Sec no={no} title="Sector & Apex Overview" sub="Distribution & compliance" />
            {intro}
            {sectorTable}
            {comparison(apexRows, true)}
            {figure}
            <h3>Filing compliance by apex</h3>
            <FILING rows={filingRows} />
          </>
        ),
      },
    ];
  }

  const chunks = chunk(apexRows, APEXES_PER_PAGE);
  const filingChunks = chunk(filingRows, 18);
  return [
    {
      toc: { no, title: "Sector & Apex Overview" },
      render: () => (
        <>
          <Sec no={no} title="Sector & Apex Overview" sub="Distribution & compliance" />
          {intro}
          {sectorTable}
          {figure}
        </>
      ),
    },
    ...chunks.map((rows, index): PageSpec => ({
      render: () => (
        <>
          <Sec
            title="Sector & Apex Overview"
            sub={`Apex comparison ${index + 1} of ${chunks.length}`}
          />
          {comparison(rows, index === chunks.length - 1)}
        </>
      ),
    })),
    ...filingChunks.map((rows, index): PageSpec => ({
      render: () => (
        <>
          <Sec
            title="Sector & Apex Overview"
            sub={`Filing compliance ${index + 1} of ${filingChunks.length}`}
          />
          <h3>Filing compliance by apex</h3>
          <FILING rows={rows} />
        </>
      ),
    })),
  ];
};

const COOPS_PER_PAGE = 13;

export const cooperativePages = (a: Analysis, no: string): PageSpec[] => {
  const pages = chunk(a.coops, COOPS_PER_PAGE);
  const parts = pages.length > 0 ? pages : [[]];
  return parts.map((rows, index): PageSpec => ({
    toc: index === 0 ? { no, title: "Cooperative Overview" } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title="Cooperative Overview"
          sub={parts.length > 1 ? `Part ${index + 1} of ${parts.length}` : "Every cooperative"}
        />
        {index === 0 && (
          <p>
            Key figures and prudential ratios for each cooperative. A dash means the cooperative has
            not filed or has not reported the figure.
          </p>
        )}
        <table className="tbl compact">
          <thead>
            <tr>
              <th>Cooperative</th>
              <th className="num">Members</th>
              <th className="num">Assets</th>
              <th className="num">Loans</th>
              <th className="num">Deposits</th>
              <th className="num">PAR30</th>
              <th className="num">CAR</th>
              <th className="num">ROA</th>
              <th className="num">OER</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((coop) => {
              const kpi = (key: string) =>
                coop.has_data ? (coop.kpis?.[key]?.value ?? null) : null;
              return (
                <tr key={coop.cooperative_id}>
                  <td>{coop.name}</td>
                  <td className="num">
                    {coop.has_data ? integer(coop.non_financial?.total_members ?? 0) : "—"}
                  </td>
                  <td className="num">{money(kpi("total_assets"))}</td>
                  <td className="num">{money(kpi("gross_loan_portfolio"))}</td>
                  <td className="num">{money(kpi("total_member_deposits"))}</td>
                  {ratioCell("par30", kpi("par30"))}
                  {ratioCell("capital_adequacy_ratio", kpi("capital_adequacy_ratio"))}
                  {ratioCell("roa", kpi("roa"))}
                  {ratioCell("operating_expense_ratio", kpi("operating_expense_ratio"))}
                  <td>
                    {coop.has_data ? (
                      <Pill tone={riskTone([coop])} />
                    ) : (
                      <Pill tone="na">Not filed</Pill>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </>
    ),
  }));
};
