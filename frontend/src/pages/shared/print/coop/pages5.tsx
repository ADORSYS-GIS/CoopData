import type { CoopAnalysis } from "@/pages/shared/print/coop/analysis";
import { fmtInt, fmtPct } from "@/pages/shared/print/coop/data";
import { compareWithPeers, type Rank } from "@/pages/shared/print/coop/peers";
import { compositionOf } from "@/pages/shared/print/coop/structure";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure } from "@/pages/shared/print/tpl/TplParts";
import { Donut } from "@/pages/shared/print/tpl/TplTrend";
import { tr } from "@/pages/shared/print/tpl/i18n";

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
              <b>{tr("coop.structure.fig_s1")}</b> {tr("coop.structure.fig_s1_caption")}
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
              <b>{tr("coop.structure.fig_s2")}</b> {tr("coop.structure.fig_s2_caption")}
            </>
          }
        >
          <Donut slices={funding} format={fmtInt} />
        </Figure>
      )}
    </div>
  );
}

const rankText = (rank: Rank | null): string =>
  rank ? tr("coop.peers.rank", { position: rank.position, of: rank.of }) : "—";

/** Where the cooperative stands against its apex and all cooperatives that filed. */
export const peerPage = (a: CoopAnalysis, no: string): PageSpec | null => {
  const { submission, peers } = a.props;
  const comparison = compareWithPeers(submission.cooperative_id, submission.apex_id, peers);
  if (!comparison) return null;
  return {
    toc: { no, title: tr("coop.peers.title") },
    render: () => (
      <>
        <Sec no={no} title={tr("coop.peers.title")} sub={tr("common.fy", { year: a.year })} />
        <p>
          {tr(comparison.apexCount > 1 ? "coop.peers.intro_apex" : "coop.peers.intro", {
            name: a.props.coopName,
            apexCount: comparison.apexCount,
            nationalCount: comparison.nationalCount,
            year: a.year,
          })}
        </p>
        <table className="tbl">
          <thead>
            <tr>
              <th>{tr("common.indicator")}</th>
              <th className="num">{tr("coop.peers.this_cooperative")}</th>
              <th className="num">{tr("coop.peers.apex_average")}</th>
              <th className="num">{tr("coop.peers.national_average")}</th>
              <th className="num">{tr("coop.peers.rank_apex")}</th>
              <th className="num">{tr("coop.peers.rank_national")}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.key}>
                <td>{tr(`coop.peers.indicators.${row.key}`, { defaultValue: row.label })}</td>
                <td className="num">{fmtPct(row.current)}</td>
                <td className="num">{fmtPct(row.apexAverage)}</td>
                <td className="num">{fmtPct(row.nationalAverage)}</td>
                <td className="num">{rankText(row.apexRank)}</td>
                <td className="num">{rankText(row.nationalRank)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="src">{tr("coop.peers.source")}</p>
      </>
    ),
  };
};
