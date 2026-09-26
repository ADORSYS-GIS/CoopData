import { fmtMillions } from "@/pages/shared/print/coop/data";
import { VBarGroups, LIGHT, TEAL } from "@/pages/shared/print/tpl/TplCharts";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure } from "@/pages/shared/print/tpl/TplParts";
import { LineChart } from "@/pages/shared/print/tpl/TplTrend";
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

const compact = (value: number): string => String(Math.round(value * 10) / 10);

const movement = (rows: TrendRow[], pick: (row: TrendRow) => number, noun: string): string => {
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last || pick(first) === 0) return "";
  const change = ((pick(last) - pick(first)) / Math.abs(pick(first))) * 100;
  return `${noun} ${change >= 0 ? "rose" : "fell"} ${Math.abs(change).toFixed(1)}% from USD ${fmtMillions(pick(first))} in ${first.label} to USD ${fmtMillions(pick(last))} in ${last.label}.`;
};

/** Returns null when fewer than two periods carry a statement, so no trend page is drawn. */
export const trendPage = ({ rows, no, scope }: TrendPageProps): PageSpec | null => {
  if (rows.length < 2) return null;
  const labels = rows.map((row) => row.label);
  const bars = unitFor(Math.max(...rows.flatMap((row) => [row.assets, row.savings, row.loans])));
  const surplus = unitFor(Math.max(...rows.map((row) => Math.abs(row.surplus))));
  return {
    toc: { no, title: "Multi-Period Trend" },
    render: () => (
      <>
        <Sec no={no} title="Multi-Period Trend" sub={`${rows.length} periods, oldest first`} />
        <p>
          {[
            movement(rows, (row) => row.assets, "Total assets"),
            movement(rows, (row) => row.savings, "Member savings"),
            movement(rows, (row) => row.loans, "Gross loans"),
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
        <Figure
          caption={
            <>
              <b>Figure T1.</b> Total assets, member savings and gross loans of {scope}, in{" "}
              {bars.label}. Approved statements only, converted at the rate frozen on each
              submission.
            </>
          }
        >
          <VBarGroups
            unit={bars.label}
            format={compact}
            series={[
              { name: "Total assets", color: TEAL },
              { name: "Member savings", color: LIGHT },
              { name: "Gross loans", color: "#5E8FA3" },
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
          <Figure caption={<b>Figure T2. Net surplus ({surplus.label})</b>}>
            <LineChart
              labels={labels}
              values={rows.map((row) => scaled(row.surplus, surplus))}
              unit={surplus.label}
              format={compact}
            />
          </Figure>
          <Figure caption={<b>Figure T3. Portfolio at risk over 30 days (%)</b>}>
            <LineChart
              labels={labels}
              values={rows.map((row) => row.par30)}
              unit="% of gross loans"
              limit={{ value: PAR30_LIMIT, label: `Max ${PAR30_LIMIT}%` }}
            />
          </Figure>
        </div>
        <div className="two">
          <Figure caption={<b>Figure T4. Liquid assets (% of total assets)</b>}>
            <LineChart
              labels={labels}
              values={rows.map((row) => row.liquidity)}
              unit="% of total assets"
              limit={{ value: LIQUIDITY_MINIMUM, label: `Min ${LIQUIDITY_MINIMUM}%` }}
            />
          </Figure>
          <Figure caption={<b>Figure T5. Capital adequacy (equity % of total assets)</b>}>
            <LineChart
              labels={labels}
              values={rows.map((row) => row.capital)}
              unit="% of total assets"
              limit={{ value: CAPITAL_MINIMUM, label: `Min ${CAPITAL_MINIMUM}%` }}
            />
          </Figure>
        </div>
        <p className="src">
          Source: approved financial statements. Balances are taken at the latest month of each
          period. Amounts are shown in USD so that periods and cooperatives reporting in different
          currencies can be compared; the statement tables elsewhere in this report use the currency
          reported by the cooperative.
        </p>
      </>
    ),
  };
};
