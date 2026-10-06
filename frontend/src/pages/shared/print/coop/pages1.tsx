import { Fragment } from "react";

import type { CoopAnalysis } from "@/pages/shared/print/coop/analysis";
import { changePct, fmtMillions, fmtPct, kpiOf } from "@/pages/shared/print/coop/data";
import { concernsOf, strengthsOf, verdictOf } from "@/pages/shared/print/coop/text";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Fn, FindList, Kpis, Opinion, Pill } from "@/pages/shared/print/tpl/TplParts";
import { percentText, tr } from "@/pages/shared/print/tpl/i18n";

/** Scorecard-at-a-glance rows, in display order. */
const AREA_KEYS = new Set([
  "capital_adequacy_ratio",
  "par30",
  "loan_loss_coverage",
  "roa",
  "operational_self_sufficiency",
  "liquid_funds_ratio",
]);

const arrow = (change: number | null, prior: string): string | undefined =>
  change === null
    ? undefined
    : tr("common.on_prior", {
        arrow: change < 0 ? "▼" : "▲",
        change: percentText(Math.abs(change)),
        prior,
      });

export const executivePage = (a: CoopAnalysis, no: string): PageSpec => ({
  toc: { no, title: tr("common.executive_summary") },
  render: () => {
    const { verdict, body } = verdictOf(a);
    const prior = tr("common.fy", { year: a.year - 1 });
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
        <Sec
          no={no}
          title={tr("common.executive_summary")}
          sub={tr("common.fy", { year: a.year })}
        />
        <Opinion label={tr("common.overall_view")} verdict={verdict}>
          {a.props.narratives?.executive_summary || body}
        </Opinion>
        <Kpis
          items={[
            {
              label: tr("coop.exec.total_assets"),
              value: fmtMillions(assets.current),
              note: arrow(assetChange, prior),
              down: (assetChange ?? 0) < 0,
            },
            {
              label: tr("coop.exec.net_loan_portfolio"),
              value: fmtMillions(netLoans),
              note: arrow(loanChange, prior),
              down: (loanChange ?? 0) < 0,
            },
            {
              label: tr("coop.exec.net_surplus"),
              value: fmtMillions(surplus.current),
              note: arrow(surplusChange, prior),
              down: (surplusChange ?? 0) < 0,
            },
            {
              label: tr("coop.exec.capital_assets"),
              value: fmtPct(capital?.current ?? null),
              note: tr("common.bench_meets", { value: percentText(10, 0) }),
              down: capital?.tone === "bad",
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
              <th className="num">{tr("common.fy", { year: a.year })}</th>
              <th className="num">{tr("common.benchmark")}</th>
              <th style={{ width: "24mm" }}>{tr("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {a.scorecard
              .filter((row) => AREA_KEYS.has(row.key))
              .map((row) => (
                <tr key={row.key}>
                  <td>{tr(`coop.scorecard_areas.${row.key}`)}</td>
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
  toc: { no, title: tr("coop.scorecard.title") },
  render: () => {
    const groups = [...new Set(a.scorecard.map((r) => r.group))];
    return (
      <>
        <Sec no={no} title={tr("coop.scorecard.title")} sub={tr("coop.scorecard.sub")} />
        <p>{tr("coop.scorecard.intro", { year: a.year })}</p>
        <table className="tbl">
          <thead>
            <tr>
              <th>{tr("common.indicator")}</th>
              <th>{tr("common.formula")}</th>
              <th className="num">{tr("common.fy", { year: a.year - 1 })}</th>
              <th className="num">{tr("common.fy", { year: a.year })}</th>
              <th className="num">{tr("common.benchmark")}</th>
              <th style={{ width: "22mm" }}>{tr("common.status")}</th>
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
                      <td>
                        {row.info ? (
                          <Pill tone="na">{tr("common.info")}</Pill>
                        ) : (
                          <Pill tone={row.tone} />
                        )}
                      </td>
                    </tr>
                  ))}
              </Fragment>
            ))}
            <tr className="grp">
              <td colSpan={6}>{tr("coop.scorecard.signs_of_growth")}</td>
            </tr>
            {a.growth.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="muted">{tr("coop.scorecard.change_prior")}</td>
                <td className="num">—</td>
                <td className="num">{fmtPct(row.current)}</td>
                <td className="num">—</td>
                <td>
                  <Pill tone="na">{tr("common.info")}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {a.validation.length > 0 && <p className="src">{tr("coop.scorecard.footnote_hint")}</p>}
      </>
    );
  },
});
