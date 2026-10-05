import { Fragment } from "react";

import type { CoopAnalysis } from "@/pages/shared/print/coop/analysis";
import { changePct, fmtMillions, fmtPct, kpiOf } from "@/pages/shared/print/coop/data";
import { concernsOf, strengthsOf, verdictOf } from "@/pages/shared/print/coop/text";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Fn, FindList, Kpis, Opinion, Pill } from "@/pages/shared/print/tpl/TplParts";

const AREA: Record<string, string> = {
  capital_adequacy_ratio: "Capital adequacy",
  par30: "Asset quality",
  loan_loss_coverage: "Provisioning",
  roa: "Earnings",
  operational_self_sufficiency: "Sustainability",
  liquid_funds_ratio: "Liquidity",
};

const arrow = (change: number | null, prior: string): string | undefined =>
  change === null
    ? undefined
    : `${change < 0 ? "▼" : "▲"} ${Math.abs(change).toFixed(1)}% on ${prior}`;

export const executivePage = (a: CoopAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Executive Summary" },
  render: () => {
    const { verdict, body } = verdictOf(a);
    const prior = `FY ${a.year - 1}`;
    const kpis = a.props.kpisData.kpis;
    const before = a.props.kpisData.prior_year_kpis;
    const assets = a.statement.totals.assets;
    const netLoans = kpiOf(kpis, "net_loan_portfolio")?.value;
    const netLoansPrior = kpiOf(before, "net_loan_portfolio")?.value;
    const surplus = a.statement.totals.surplus;
    const capital = a.scorecard.find((r) => r.key === "capital_adequacy_ratio");
    const strengths = strengthsOf(a);
    const concerns = concernsOf(a);
    const assetChange = changePct(assets.current, assets.prior);
    const loanChange = netLoans !== undefined ? changePct(netLoans, netLoansPrior) : null;
    const surplusChange = changePct(surplus.current, surplus.prior);

    return (
      <>
        <Sec no={no} title="Executive Summary" sub={`FY ${a.year}`} />
        <Opinion label="Overall supervisory view" verdict={verdict}>
          {a.props.narratives?.executive_summary || body}
        </Opinion>
        <Kpis
          items={[
            {
              label: "Total assets",
              value: fmtMillions(assets.current),
              note: arrow(assetChange, prior),
              down: (assetChange ?? 0) < 0,
            },
            {
              label: "Net loan portfolio",
              value: fmtMillions(netLoans),
              note: arrow(loanChange, prior),
              down: (loanChange ?? 0) < 0,
            },
            {
              label: "Net surplus",
              value: fmtMillions(surplus.current),
              note: arrow(surplusChange, prior),
              down: (surplusChange ?? 0) < 0,
            },
            {
              label: "Capital / assets",
              value: fmtPct(capital?.current ?? null),
              note: "Benchmark ≥ 10%",
              down: capital?.tone === "bad",
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
              <th className="num">FY {a.year}</th>
              <th className="num">Benchmark</th>
              <th style={{ width: "24mm" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {a.scorecard
              .filter((row) => AREA[row.key])
              .map((row) => (
                <tr key={row.key}>
                  <td>{AREA[row.key]}</td>
                  <td>{row.label}</td>
                  <td className="num">
                    {fmtPct(row.current)}
                    {a.footnote(row.key) && <Fn id={a.footnote(row.key) ?? ""} />}
                  </td>
                  <td className="num">{row.bench}</td>
                  <td>
                    <Pill tone={row.tone} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </>
    );
  },
});

export const scorecardPage = (a: CoopAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Prudential Ratio Scorecard" },
  render: () => {
    const groups = [...new Set(a.scorecard.map((r) => r.group))];
    return (
      <>
        <Sec no={no} title="Prudential Ratio Scorecard" sub="PEARLS-based" />
        <p>
          The table sets out each prudential indicator for FY {a.year} against the prior year and
          the applicable benchmark. All ratios are taken from the submitted financial statements.
        </p>
        <table className="tbl">
          <thead>
            <tr>
              <th>Indicator</th>
              <th>Formula</th>
              <th className="num">FY {a.year - 1}</th>
              <th className="num">FY {a.year}</th>
              <th className="num">Benchmark</th>
              <th style={{ width: "22mm" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group}>
                <tr className="grp">
                  <td colSpan={6}>{group}</td>
                </tr>
                {a.scorecard
                  .filter((row) => row.group === group)
                  .map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td className="muted">{row.formula}</td>
                      <td className="num">{fmtPct(row.prior)}</td>
                      <td className="num">
                        {fmtPct(row.current)}
                        {a.footnote(row.key) && <Fn id={a.footnote(row.key) ?? ""} />}
                      </td>
                      <td className="num">{row.bench}</td>
                      <td>{row.info ? <Pill tone="na">Info</Pill> : <Pill tone={row.tone} />}</td>
                    </tr>
                  ))}
              </Fragment>
            ))}
            <tr className="grp">
              <td colSpan={6}>Signs of growth</td>
            </tr>
            {a.growth.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="muted">Change on the prior year</td>
                <td className="num">—</td>
                <td className="num">{fmtPct(row.current)}</td>
                <td className="num">—</td>
                <td>
                  <Pill tone="na">Info</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {a.validation.length > 0 && (
          <p className="src">
            Superscript references (for example A1) point to the corresponding item in Annex A —
            Data Validation &amp; Corrections.
          </p>
        )}
      </>
    );
  },
});
