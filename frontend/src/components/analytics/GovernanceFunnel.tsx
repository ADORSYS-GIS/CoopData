import {
  Funnel,
  FunnelChart,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import type { MembershipStats } from "@/hooks/analytics/useNfStatistics";

interface Props {
  stats: MembershipStats;
}

export function GovernanceFunnel({ stats }: Props) {
  if (stats.total === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
        No membership data available
      </div>
    );
  }

  const data = [
    {
      name: "Total Members",
      value: stats.total,
      fill: "var(--chart-1)",
    },
    {
      name: "Attended AGM",
      value: stats.agm_attendance ?? 0,
      fill: "var(--chart-2)",
    },
    {
      name: "Voted in Elections",
      value: stats.voting_count ?? 0,
      fill: "var(--chart-3)",
    },
    {
      name: "Leadership Role",
      value: stats.leadership_count ?? 0,
      fill: "var(--chart-4)",
    },
  ];

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Tooltip 
            cursor={{ fill: "transparent" }}
            contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12px" }}
            formatter={(val: number) => [val.toLocaleString(), "Members"]}
          />
          <Funnel
            dataKey="value"
            data={data}
            isAnimationActive
          >
            <LabelList position="right" fill="var(--foreground)" stroke="none" dataKey="name" fontSize={11} fontWeight="bold" />
            <LabelList position="center" fill="#fff" stroke="none" dataKey="value" formatter={(val: number) => val.toLocaleString()} fontSize={12} fontWeight="bold" />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
