import type { CoopAnalysis } from "@/pages/shared/print/coop/analysis";
import { fmtInt, fmtPct } from "@/pages/shared/print/coop/data";
import { compareWithPeers, type Rank } from "@/pages/shared/print/coop/peers";
import { compositionOf } from "@/pages/shared/print/coop/structure";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure } from "@/pages/shared/print/tpl/TplParts";
import { Donut } from "@/pages/shared/print/tpl/TplTrend";

/** Donuts showing what the assets are and what funds them; null when no balance is reported. */
export function StructureFigures({ a }: { a: CoopAnalysis }) {
  const { assets, funding } = compositionOf(a.statement);
  const hasAssets = assets.some((slice) => slice.value > 0);
  const hasFunding = funding.some((slice) => slice.value > 0);
  if (!hasAssets && !hasFunding) return null;
  return (
    <div className="two">
      {hasAssets && (
        <Figure
          caption={
            <>
              <b>Figure S1.</b> Composition of assets (net loans are gross loans less the allowance
              for loan losses).
            </>
          }
        >
          <Donut slices={assets} format={fmtInt} />
        </Figure>
      )}
      {hasFunding && (
        <Figure
          caption={
            <>
              <b>Figure S2.</b> Funding of assets.
            </>
          }
        >
          <Donut slices={funding} format={fmtInt} />
        </Figure>
      )}
    </div>
  );
}

const rankText = (rank: Rank | null): string => (rank ? `${rank.position} of ${rank.of}` : "—");

/** Where the cooperative stands against its apex and all cooperatives that filed. */
export const peerPage = (a: CoopAnalysis, no: string): PageSpec | null => {
  const { submission, peers } = a.props;
  const comparison = compareWithPeers(submission.cooperative_id, submission.apex_id, peers);
  if (!comparison) return null;
  return {
    toc: { no, title: "Peer Comparison" },
    render: () => (
      <>
        <Sec no={no} title="Peer Comparison" sub={`FY ${a.year}`} />
        <p>
          {a.props.coopName} is compared with{" "}
          {comparison.apexCount > 1
            ? `the ${comparison.apexCount} cooperatives of its apex organisation and with `
            : ""}
          the {comparison.nationalCount} cooperatives that filed a return for FY {a.year}. A rank of
          1 is the best result. Averages are simple averages of each cooperative&apos;s ratio and
          include this cooperative.
        </p>
        <table className="tbl">
          <thead>
            <tr>
              <th>Indicator</th>
              <th className="num">This cooperative</th>
              <th className="num">Apex average</th>
              <th className="num">National average</th>
              <th className="num">Rank in apex</th>
              <th className="num">National rank</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="num">{fmtPct(row.current)}</td>
                <td className="num">{fmtPct(row.apexAverage)}</td>
                <td className="num">{fmtPct(row.nationalAverage)}</td>
                <td className="num">{rankText(row.apexRank)}</td>
                <td className="num">{rankText(row.nationalRank)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="src">
          Source: indicators computed by Coop Data for every cooperative with a return for the year.
          Cooperatives that did not file are not counted.
        </p>
      </>
    ),
  };
};
