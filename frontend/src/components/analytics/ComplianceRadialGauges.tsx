import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";

interface ComplianceRadialGaugesProps {
  carValue?: number; // Capital adequacy ratio (%), undefined when not reported
  liquidityValue?: number; // Liquid assets to total assets (%), undefined when not reported
  nplValue?: number; // Loans overdue more than 90 days (%), undefined when not reported
}

interface Gauge {
  name: string;
  value: number;
  fill: string;
  target: number;
  max: number;
  rawValue: string;
  lowerIsBetter: boolean;
}

const statusFill = (good: boolean, warn: boolean): string =>
  good ? "var(--success)" : warn ? "var(--warning)" : "var(--destructive)";

export function ComplianceRadialGauges({
  carValue,
  liquidityValue,
  nplValue,
}: ComplianceRadialGaugesProps) {
  const { t } = useTranslation();
  const candidates: (Gauge | null)[] = [
    carValue === undefined
      ? null
      : {
          name: t("analytics.gaugeCapitalAdequacy"),
          value: Math.min(carValue, 30),
          fill: statusFill(carValue >= 10, carValue >= 8),
          target: 10,
          max: 30,
          rawValue: carValue.toFixed(1) + "%",
          lowerIsBetter: false,
        },
    liquidityValue === undefined
      ? null
      : {
          name: t("analytics.gaugeLiquidity"),
          value: Math.min(liquidityValue, 100),
          fill: statusFill(liquidityValue >= 15, liquidityValue >= 10),
          target: 15,
          max: 100,
          rawValue: liquidityValue.toFixed(1) + "%",
          lowerIsBetter: false,
        },
    nplValue === undefined
      ? null
      : {
          name: t("analytics.gaugeNonPerformingLoans"),
          value: Math.min(nplValue, 20),
          fill: statusFill(nplValue <= 2, nplValue <= 5),
          target: 2,
          max: 20,
          rawValue: nplValue.toFixed(1) + "%",
          lowerIsBetter: true,
        },
  ];
  const gauges = candidates.filter((gauge): gauge is Gauge => gauge !== null);

  if (gauges.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        {t("analytics.stmt.notReported")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[200px]">
      {gauges.map((gauge, index) => {
        // Data for RadialBar requires at least two objects if we want a track background,
        // or we use PolarAngleAxis domain.
        const data = [{ name: gauge.name, value: gauge.value, fill: gauge.fill }];

        return (
          <div key={index} className="flex flex-col items-center justify-center relative">
            <ResponsiveContainer width="100%" height={140}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="70%"
                outerRadius="100%"
                barSize={15}
                data={data}
                startAngle={180}
                endAngle={0}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, gauge.max]}
                  angleAxisId={0}
                  tick={false}
                  axisLine={false}
                />
                <RadialBar
                  background={{ fill: "var(--muted)" }}
                  dataKey="value"
                  cornerRadius={10}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            {/* Center Label Overlay */}
            <div className="absolute flex flex-col items-center justify-center top-[55%] pointer-events-none">
              <span className="text-xl font-heading font-bold" style={{ color: gauge.fill }}>
                {gauge.rawValue}
              </span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                {gauge.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {t("analytics.targetPrefix")}
                {gauge.lowerIsBetter ? "<" : ">"}
                {gauge.target}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
