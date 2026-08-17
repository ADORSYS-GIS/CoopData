import { Funnel, FunnelChart, Tooltip, LabelList, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import type { MembershipStats } from "@/hooks/analytics/useNfStatistics";

interface Props {
  stats: MembershipStats;
}

export function GovernanceFunnel({ stats }: Props) {
  const { t } = useTranslation();
  if (!stats) return null;

  if (stats.total === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
        {t("analytics.noMembershipData")}
      </div>
    );
  }

  const data = [
    {
      name: t("analytics.funnelTotalMembers"),
      value: stats.total,
      fill: "var(--chart-1)",
    },
    {
      name: t("analytics.funnelAttendedAgm"),
      value: stats.agm_attendance ?? 0,
      fill: "var(--chart-2)",
    },
    {
      name: t("analytics.funnelVotedElections"),
      value: stats.voting_count ?? 0,
      fill: "var(--chart-3)",
    },
    {
      name: t("analytics.funnelLeadershipRole"),
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
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              fontSize: "12px",
            }}
            formatter={(val: number) => [val.toLocaleString(), t("analytics.funnelMembers")]}
          />
          <Funnel dataKey="value" data={data} isAnimationActive>
            <LabelList
              position="right"
              fill="var(--foreground)"
              stroke="none"
              dataKey="name"
              fontSize={11}
              fontWeight="bold"
            />
            <LabelList
              position="center"
              fill="#fff"
              stroke="none"
              dataKey="value"
              formatter={(val: number) => val.toLocaleString()}
              fontSize={12}
              fontWeight="bold"
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
