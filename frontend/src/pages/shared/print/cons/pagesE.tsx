import type { Analysis } from "@/pages/shared/print/cons/analysis";
import { shareSlices, tileGroupsOf } from "@/pages/shared/print/cons/indicators";
import { integer, money, percent, sumKpi, totalsOf } from "@/pages/shared/print/consolidated/stats";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure, Kpis } from "@/pages/shared/print/tpl/TplParts";
import { Donut } from "@/pages/shared/print/tpl/TplTrend";
import type { TrendRow } from "@/pages/shared/print/tpl/trend";

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
  const unit = a.input.tier === "Apex" ? "cooperative" : "apex organisation";
  const { filed, notFiled, total, rate } = a.filing;
  return {
    toc: { no, title: "Portfolio Structure & Filing Status" },
    render: () => (
      <>
        <Sec
          no={no}
          title="Portfolio Structure & Filing Status"
          sub={`Reporting year ${a.input.year}`}
        />
        <p>
          The charts show each {unit}&apos;s share of the assets and of the gross loans reported by
          the {a.filed.length} cooperatives that filed. The six largest are named; the rest are
          grouped as Other.
        </p>
        <div className="two">
          <Figure
            caption={
              <>
                <b>Figure P1.</b> Share of total assets by {unit}.
              </>
            }
          >
            <Donut slices={assets} format={money} />
          </Figure>
          <Figure
            caption={
              <>
                <b>Figure P2.</b> Share of gross loans by {unit}.
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
                <b>Figure P3.</b> Filing status for {a.input.year}.
              </>
            }
          >
            <Donut
              slices={[
                { label: "Filed", value: filed },
                { label: "Not filed", value: notFiled },
              ]}
              format={integer}
            />
          </Figure>
          <div>
            <h3 style={{ marginTop: 0 }}>Filing status</h3>
            <table className="tbl compact">
              <tbody>
                <tr>
                  <td>Cooperatives under supervision</td>
                  <td className="num">{integer(total)}</td>
                </tr>
                <tr>
                  <td>Returns filed</td>
                  <td className="num">{integer(filed)}</td>
                </tr>
                <tr>
                  <td>Returns not filed</td>
                  <td className="num">{integer(notFiled)}</td>
                </tr>
                <tr className="total">
                  <td>Filing rate</td>
                  <td className="num">{percent(rate)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="src">
          Only cooperatives that submitted financial statements are included. Amounts are as
          reported by each cooperative.
        </p>
      </>
    ),
  };
};

/** Headline counts and amounts with their change on the prior year. */
export const indicatorsPage = (a: Analysis, no: string, trend: readonly TrendRow[]): PageSpec => ({
  toc: { no, title: "Key Indicators" },
  render: () => (
    <>
      <Sec no={no} title="Key Indicators" sub={`Reporting year ${a.input.year}`} />
      <p>
        Headline figures for the {a.filed.length} cooperatives that filed, compared with the prior
        year where a comparison exists.
      </p>
      {tileGroupsOf(a, trend).map((group) => (
        <div key={group.title}>
          <h3>{group.title}</h3>
          <Kpis items={group.tiles} />
        </div>
      ))}
      <p className="src">
        Members, borrowers and their breakdowns come from the member and loan ledgers of the
        cooperatives that submitted them. The portfolio-at-risk amounts come from the approved
        financial statements, converted to USD.
      </p>
    </>
  ),
});
