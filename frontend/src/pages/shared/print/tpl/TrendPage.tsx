import { fmtMillions } from "@/pages/shared/print/coop/data";
import { VBarGroups, LIGHT, TEAL } from "@/pages/shared/print/tpl/TplCharts";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure } from "@/pages/shared/print/tpl/TplParts";
import { LineChart } from "@/pages/shared/print/tpl/TplTrend";
import { fixed, percentText, tr } from "@/pages/shared/print/tpl/i18n";
import {
  CAPITAL_MINIMUM,
  LIQUIDITY_MINIMUM,
  PAR30_LIMIT,
  scaled,
  unitFor,
  type TrendRow,
} from "@/pages/shared/print/tpl/trend";

interface TrendPageProps {
  rows: TrendRow[];
  no: string;
  /** Who the series describes, for example "the cooperative" or "the apex portfolio". */
  scope: string;
}

const compact = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? fixed(rounded, 0) : fixed(rounded, 1);
};

const movement = (rows: TrendRow[], pick: (row: TrendRow) => number, noun: string): string => {
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last || pick(first) === 0) return "";
  const change = ((pick(last) - pick(first)) / Math.abs(pick(first))) * 100;
  return tr(change >= 0 ? "trend.rose" : "trend.fell", {
    noun,
    change: percentText(Math.abs(change)),
    from: fmtMillions(pick(first)),
    fromLabel: first.label,
    to: fmtMillions(pick(last)),
    toLabel: last.label,
  });
};

/** Returns null when fewer than two periods carry a statement, so no trend page is drawn. */
export const trendPage = ({ rows, no, scope }: TrendPageProps): PageSpec | null => {
  if (rows.length < 2) return null;
  const labels = rows.map((row) => row.label);
  const bars = unitFor(Math.max(...rows.flatMap((row) => [row.assets, row.savings, row.loans])));
  const surplus = unitFor(Math.max(...rows.map((row) => Math.abs(row.surplus))));
  const title = tr("trend.title");
  return {
    toc: { no, title },
    render: () => (
      <>
        <Sec no={no} title={title} sub={tr("trend.periods_oldest_first", { count: rows.length })} />
        <p>
          {[
            movement(rows, (row) => row.assets, tr("trend.total_assets")),
            movement(rows, (row) => row.savings, tr("trend.member_savings")),
            movement(rows, (row) => row.loans, tr("trend.gross_loans")),
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
        <Figure
          caption={
            <>
              <b>{tr("trend.fig_t1")}</b> {tr("trend.fig_t1_caption", { scope, unit: bars.label })}
            </>
          }
        >
          <VBarGroups
            unit={bars.label}
            format={compact}
            series={[
              { name: tr("trend.total_assets"), color: TEAL },
              { name: tr("trend.member_savings"), color: LIGHT },
              { name: tr("trend.gross_loans"), color: "#5E8FA3" },
            ]}
            data={rows.map((row) => ({
              label: row.label,
              values: [
                scaled(row.assets, bars),
                scaled(row.savings, bars),
                scaled(row.loans, bars),
              ],
            }))}
          />
        </Figure>
        <div className="two">
          <Figure caption={<b>{tr("trend.fig_t2", { unit: surplus.label })}</b>}>
            <LineChart
              labels={labels}
              values={rows.map((row) => scaled(row.surplus, surplus))}
              unit={surplus.label}
              format={compact}
            />
          </Figure>
          <Figure caption={<b>{tr("trend.fig_t3")}</b>}>
            <LineChart
              labels={labels}
              values={rows.map((row) => row.par30)}
              unit={tr("common.pct_of_gross_loans")}
              limit={{
                value: PAR30_LIMIT,
                label: tr("common.max_limit", { value: percentText(PAR30_LIMIT, 0) }),
              }}
            />
          </Figure>
        </div>
        <div className="two">
          <Figure caption={<b>{tr("trend.fig_t4")}</b>}>
            <LineChart
              labels={labels}
              values={rows.map((row) => row.liquidity)}
              unit={tr("common.pct_of_total_assets")}
              limit={{
                value: LIQUIDITY_MINIMUM,
                label: tr("common.min_limit", { value: percentText(LIQUIDITY_MINIMUM, 0) }),
              }}
            />
          </Figure>
          <Figure caption={<b>{tr("trend.fig_t5")}</b>}>
            <LineChart
              labels={labels}
              values={rows.map((row) => row.capital)}
              unit={tr("common.pct_of_total_assets")}
              limit={{
                value: CAPITAL_MINIMUM,
                label: tr("common.min_limit", { value: percentText(CAPITAL_MINIMUM, 0) }),
              }}
            />
          </Figure>
        </div>
        <p className="src">{tr("trend.source")}</p>
      </>
    ),
  };
};
