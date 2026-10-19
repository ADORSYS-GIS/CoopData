import { isNotReported } from "@/lib/basic-dashboard";
import { pickIndicators } from "@/lib/questionnaire-report";
import { labelOf, reportValue, type QuestAnalysis } from "@/pages/shared/print/quest/data";
import { percentText, tr } from "@/pages/shared/print/tpl/i18n";

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
          <th>{tr("common.indicator")}</th>
          <th className="num">{valueHeading ?? a.period}</th>
          <th className="num">{tr("quest.prior_period_col")}</th>
          <th className="num">{tr("common.change")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{labelOf(row.key)}</td>
            <td className="num">{reportValue(row, scope)}</td>
            <td className="num">
              {row.previous === null || isNotReported(row)
                ? "—"
                : reportValue({ ...row, value: row.previous, status: "computed" }, scope)}
            </td>
            <td className="num">
              {row.change_pct === null
                ? "—"
                : `${row.change_pct > 0 ? "+" : ""}${percentText(row.change_pct, 1)}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
