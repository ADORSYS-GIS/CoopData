import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis, Tooltip } from "recharts";

interface ComplianceRadialGaugesProps {
  carValue: number; // Capital Adequacy Ratio (%)
  liquidityValue: number; // Liquidity Ratio (%)
  nplValue: number; // NPL Ratio (%)
}

export function ComplianceRadialGauges({
  carValue,
  liquidityValue,
  nplValue,
}: ComplianceRadialGaugesProps) {
  // Gauges:
  // CAR Target > 15%, Max 30% for dial
  // Liquidity Target > 20%, Max 100% for dial
  // NPL Target < 5%, Max 20% for dial (inverted visually so green is full? Actually standard gauge is fine)

  const gauges = [
    {
      name: "Capital Adequacy",
      value: Math.min(carValue, 30),
      fill:
        carValue >= 15
          ? "var(--success)"
          : carValue >= 10
            ? "var(--warning)"
            : "var(--destructive)",
      target: 15,
      max: 30,
      rawValue: carValue.toFixed(1) + "%",
    },
    {
      name: "Liquidity",
      value: Math.min(liquidityValue, 100),
      fill: liquidityValue >= 20 ? "var(--success)" : "var(--destructive)",
      target: 20,
      max: 100,
      rawValue: liquidityValue.toFixed(1) + "%",
    },
    {
      name: "Non-Performing Loans",
      value: Math.min(nplValue, 20),
      fill:
        nplValue <= 5 ? "var(--success)" : nplValue <= 10 ? "var(--warning)" : "var(--destructive)",
      target: 5,
      max: 20,
      rawValue: nplValue.toFixed(1) + "%",
    },
  ];

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
                Target: {gauge.name === "Non-Performing Loans" ? "<" : ">"}
                {gauge.target}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
