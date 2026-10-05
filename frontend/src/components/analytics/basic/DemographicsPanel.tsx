import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/analytics/basic/chart-shared";
import {
  AXIS_PROPS,
  CHART_COLORS,
  percentFormatters,
  TOOLTIP_STYLE,
  useChartText,
} from "@/components/analytics/basic/chart-config";
import { womenSharePct } from "@/lib/basic-dashboard";
import type { Demographics } from "@/types/basic-dashboard";

const hasCounts = (values: number[]): boolean => values.some((v) => v > 0);

export function DemographicsPanel({ demographics }: { demographics: Demographics }) {
  const { t } = useTranslation();
  const profile = useChartText("demographics");
  const governance = useChartText("governance");
  const label = (key: string) => t(`basicDashboard.demographics.${key}`);

  const genderData = [
    {
      name: label("registered"),
      male: demographics.registered.male,
      female: demographics.registered.female,
    },
    { name: label("active"), male: demographics.active.male, female: demographics.active.female },
  ];
  const ageData = [
    { name: label("age1825"), value: demographics.age.age_18_25 },
    { name: label("age2635"), value: demographics.age.age_26_35 },
    { name: label("age3660"), value: demographics.age.age_36_60 },
    { name: label("age61"), value: demographics.age.age_61_plus },
  ];
  const governanceData = [
    { name: label("board"), value: womenSharePct(demographics.board) },
    { name: label("executive"), value: womenSharePct(demographics.executive) },
    { name: label("creditCommittee"), value: womenSharePct(demographics.credit_committee) },
  ];

  const hasProfile = hasCounts([
    demographics.registered.male,
    demographics.registered.female,
    ...ageData.map((a) => a.value),
  ]);
  const hasGovernance = governanceData.some((g) => g.value !== null);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <ChartCard
        title={profile.title}
        subtitle={profile.subtitle}
        info={profile.info}
        hasData={hasProfile}
        className="lg:col-span-2"
      >
        <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={genderData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Bar
                dataKey="female"
                name={label("female")}
                fill={CHART_COLORS[0]}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="male"
                name={label("male")}
                fill={CHART_COLORS[1]}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ageData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar
                dataKey="value"
                name={profile.title}
                fill={CHART_COLORS[2]}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <ChartCard
        title={governance.title}
        subtitle={governance.subtitle}
        info={governance.info}
        hasData={hasGovernance}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={governanceData}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              {...AXIS_PROPS}
              tickFormatter={percentFormatters.axis}
            />
            <YAxis type="category" dataKey="name" width={96} {...AXIS_PROPS} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number) => [percentFormatters.tooltip(value), label("womenShare")]}
            />
            <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
