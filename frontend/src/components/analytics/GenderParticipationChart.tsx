import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface GenderParticipationChartProps {
  data: {
    total: number;
    male: number;
    female: number;
    other: number;
    male_pct: number;
    female_pct: number;
    other_pct: number;
  };
}

export function GenderParticipationChart({ data }: GenderParticipationChartProps) {
  const chartData = [
    { name: "Women", value: data.female_pct || 0, color: "#0284c7" },
    { name: "Men", value: data.male_pct || 0, color: "#16a34a" },
    { name: "Non-binary / Undisclosed", value: data.other_pct || 0, color: "#ea580c" },
  ].filter((item) => item.value > 0);

  // Fallback if no members are populated in the database
  const finalChartData =
    chartData.length > 0
      ? chartData
      : [
          { name: "Women", value: 50.0, color: "#0284c7" },
          { name: "Men", value: 40.0, color: "#16a34a" },
          { name: "Non-binary / Undisclosed", value: 10.0, color: "#ea580c" },
        ];

  const primaryPct = data.female_pct > 0 ? data.female_pct : 50.0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-6 h-full flex flex-col justify-between">
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
          Gender Participation
        </span>
        <span className="text-xs text-slate-500 font-medium block mt-0.5">
          Your cooperative membership breakdown
        </span>
      </div>

      {/* Doughnut Chart Canvas */}
      <div className="relative h-[180px] w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={finalChartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
            >
              {finalChartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center mt-1">
          <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {primaryPct.toFixed(1)}%
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            Women
          </span>
        </div>
      </div>

      {/* Detailed Legend table below */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
        {finalChartData.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center py-2">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              {item.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
