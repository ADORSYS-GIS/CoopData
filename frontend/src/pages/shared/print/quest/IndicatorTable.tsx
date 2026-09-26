import { formatIndicatorValue, isNotReported } from "@/lib/basic-dashboard";
import { labelOf, type QuestAnalysis } from "@/pages/shared/print/quest/data";
import { pickIndicators } from "@/lib/questionnaire-report";

interface Props {
  a: QuestAnalysis;
  keys: readonly string[];
  valueHeading?: string;
}

/** Indicators with the value, the value in the prior period and the change. */
export function IndicatorTable({ a, keys, valueHeading }: Props) {
  const { scope, indicators } = a.props.dashboard;
  const rows = pickIndicators(indicators, keys);
  return (
    <table className="tbl compact">
      <thead>
        <tr>
          <th>Indicator</th>
          <th className="num">{valueHeading ?? a.period}</th>
          <th className="num">Prior period</th>
          <th className="num">Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{labelOf(row.key)}</td>
            <td className="num">{formatIndicatorValue(row, scope)}</td>
            <td className="num">
              {row.previous === null || isNotReported(row)
                ? "—"
                : formatIndicatorValue({ ...row, value: row.previous, status: "computed" }, scope)}
            </td>
            <td className="num">
              {row.change_pct === null
                ? "—"
                : `${row.change_pct > 0 ? "+" : ""}${row.change_pct.toFixed(1)}%`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
