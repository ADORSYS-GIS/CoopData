import type { Analysis } from "@/pages/shared/print/cons/analysis";
import { shareSlices, tileGroupsOf } from "@/pages/shared/print/cons/indicators";
import { integer, money, percent, sumKpi, totalsOf } from "@/pages/shared/print/consolidated/stats";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure, Kpis } from "@/pages/shared/print/tpl/TplParts";
import { Donut } from "@/pages/shared/print/tpl/TplTrend";
import type { TrendRow } from "@/pages/shared/print/tpl/trend";
import { tr } from "@/pages/shared/print/tpl/i18n";

const holders = (a: Analysis): { name: string; assets: number; loans: number }[] =>
  a.input.tier === "Apex"
    ? a.filed.map((coop) => ({
        name: coop.name,
        assets: sumKpi([coop], "total_assets"),
        loans: sumKpi([coop], "gross_loan_portfolio"),
      }))
    : a.apexes.map((apex) => {
        const totals = totalsOf(apex.filed);
        return { name: apex.name, assets: totals.assets, loans: totals.loans };
      });

/** Who holds the assets and the loans, and how many cooperatives filed. */
export const portfolioStructurePage = (a: Analysis, no: string): PageSpec | null => {
  const items = holders(a);
  const assets = shareSlices(items.map((item) => ({ name: item.name, value: item.assets })));
  const loans = shareSlices(items.map((item) => ({ name: item.name, value: item.loans })));
  if (assets.length === 0 && loans.length === 0) return null;
  const unit = a.input.tier === "Apex" ? "cooperative" : "apex";
  const { filed, notFiled, total, rate } = a.filing;
  return {
    toc: { no, title: tr("cons.structure.title") },
    render: () => (
      <>
        <Sec
          no={no}
          title={tr("cons.structure.title")}
          sub={tr("common.reporting_year_value", { year: a.input.year })}
        />
        <p>{tr(`cons.structure.intro_${unit}`, { count: a.filed.length })}</p>
        <div className="two">
          <Figure
            caption={
              <>
                <b>{tr("cons.structure.fig_p1")}</b> {tr(`cons.structure.fig_p1_${unit}`)}
              </>
            }
          >
            <Donut slices={assets} format={money} />
          </Figure>
          <Figure
            caption={
              <>
                <b>{tr("cons.structure.fig_p2")}</b> {tr(`cons.structure.fig_p2_${unit}`)}
              </>
            }
          >
            <Donut slices={loans} format={money} />
          </Figure>
        </div>
        <div className="two">
          <Figure
            caption={
              <>
                <b>{tr("cons.structure.fig_p3")}</b>{" "}
                {tr("cons.structure.fig_p3_caption", { year: a.input.year })}
              </>
            }
          >
            <Donut
              slices={[
                { label: tr("common.filed"), value: filed },
                { label: tr("common.not_filed"), value: notFiled },
              ]}
              format={integer}
            />
          </Figure>
          <div>
            <h3 style={{ marginTop: 0 }}>{tr("cons.structure.filing_status")}</h3>
            <table className="tbl compact">
              <tbody>
                <tr>
                  <td>{tr("cons.structure.under_supervision")}</td>
                  <td className="num">{integer(total)}</td>
                </tr>
                <tr>
                  <td>{tr("cons.structure.returns_filed")}</td>
                  <td className="num">{integer(filed)}</td>
                </tr>
                <tr>
                  <td>{tr("cons.structure.returns_not_filed")}</td>
                  <td className="num">{integer(notFiled)}</td>
                </tr>
                <tr className="total">
                  <td>{tr("cons.structure.filing_rate")}</td>
                  <td className="num">{percent(rate)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="src">{tr("cons.structure.source")}</p>
      </>
    ),
  };
};

/** Headline counts and amounts with their change on the prior year. */
export const indicatorsPage = (a: Analysis, no: string, trend: readonly TrendRow[]): PageSpec => ({
  toc: { no, title: tr("cons.indicators.title") },
  render: () => (
    <>
      <Sec
        no={no}
        title={tr("cons.indicators.title")}
        sub={tr("common.reporting_year_value", { year: a.input.year })}
      />
      <p>{tr("cons.indicators.intro", { count: a.filed.length })}</p>
      {tileGroupsOf(a, trend).map((group) => (
        <div key={group.title}>
          <h3>{group.title}</h3>
          <Kpis items={group.tiles} />
        </div>
      ))}
      <p className="src">{tr("cons.indicators.source")}</p>
    </>
  ),
});
