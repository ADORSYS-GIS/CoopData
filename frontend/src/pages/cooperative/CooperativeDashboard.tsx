import { useTranslation } from "react-i18next";
import {
  Building2,
  Users,
  Layers,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Tag,
  Inbox,
  Clock,
  XCircle,
} from "lucide-react";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import {
  useMyCooperativeProfile,
  useMyCooperativeMembers,
  useMyAssignedDimensions,
} from "@/hooks/cooperatives/useCooperatives";
import { useCooperativeStats } from "@/hooks/submissions/useSubmissions";
import { useAuth } from "@/context/AuthContext";

type CoopProfile = { id: string; name?: string; description?: string };
type MemberItem = { id: string; first_name?: string; last_name?: string; email?: string };
type DimensionsResponse = { assigned_dimensions?: string[]; cooperative_id?: string };

export const CooperativeDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    data: profileRaw,
    isLoading: profileLoading,
    error: profileError,
  } = useMyCooperativeProfile();
  const { data: membersRaw, isLoading: membersLoading } = useMyCooperativeMembers();
  const { data: dimRaw, isLoading: dimLoading } = useMyAssignedDimensions();
  const { data: stats, isLoading: statsLoading } = useCooperativeStats();

  const profile = profileRaw as CoopProfile | undefined;
  const members = (membersRaw as MemberItem[]) ?? [];
  const dimData = dimRaw as DimensionsResponse | undefined;
  const dimensions = dimData?.assigned_dimensions ?? [];

  const isLoading = profileLoading || membersLoading || dimLoading || statsLoading;

  if (isLoading) {
    return (
      <AppShell
        title={t("cooperativeDashboard.title")}
        subtitle={t("cooperativeDashboard.subtitle")}
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (profileError) {
    return (
      <AppShell
        title={t("cooperativeDashboard.title")}
        subtitle={t("cooperativeDashboard.subtitle")}
      >
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <AlertCircle className="size-8 mb-2 text-destructive" />
          <p className="font-semibold text-sm">{t("cooperativeDashboard.failedLoad")}</p>
          <p className="text-xs mt-1">{String(profileError)}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={profile?.name ?? t("cooperativeDashboard.title")}
      subtitle={profile?.description ?? t("cooperativeDashboard.subtitle")}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Inbox}
            label={t("cooperativeDashboard.totalSubmissions")}
            value={String(stats?.total_submissions ?? 0)}
            subtitle={t("cooperativeDashboard.allDataReturns")}
            tone="primary"
          />
          <StatCard
            icon={Clock}
            label={t("cooperativeDashboard.pending")}
            value={String(stats?.pending_submissions ?? 0)}
            subtitle={t("cooperativeDashboard.inReviewPipeline")}
            tone="warning"
          />
          <StatCard
            icon={CheckCircle2}
            label={t("cooperativeDashboard.approved")}
            value={String(stats?.approved_submissions ?? 0)}
            subtitle={t("cooperativeDashboard.finalized")}
            tone="success"
          />
          <StatCard
            icon={XCircle}
            label={t("cooperativeDashboard.rejected")}
            value={String(stats?.rejected_submissions ?? 0)}
            subtitle={t("cooperativeDashboard.needsCorrection")}
            tone="danger"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title={t("cooperativeDashboard.profileTitle")}
            subtitle={t("cooperativeDashboard.profileSubtitle")}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("cooperativeDashboard.profileName")}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {profile?.name ?? "—"}
                </span>
              </div>
              <div className="flex items-start justify-between py-2 border-b border-border/50">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("cooperativeDashboard.profileDesc")}
                </span>
                <span className="text-sm text-foreground text-right max-w-[60%]">
                  {profile?.description ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("cooperativeDashboard.profileMembers")}
                </span>
                <span className="text-sm font-semibold text-foreground">{members.length}</span>
              </div>
            </div>
          </Card>

          <Card
            title={t("cooperativeDashboard.assignedDimensions")}
            subtitle={t("cooperativeDashboard.dimensionsSubtitle")}
          >
            {dimensions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Layers className="size-8 mb-2 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">
                  {t("cooperativeDashboard.noDimensions")}
                </p>
                <p className="text-xs mt-1">{t("cooperativeDashboard.contactAdminDimensions")}</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {dimensions.map((dim) => (
                  <span
                    key={dim}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                  >
                    <CheckCircle2 className="size-3" />
                    {dim}
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card
          title={t("cooperativeDashboard.membersTitle")}
          subtitle={t("cooperativeDashboard.membersSubtitle")}
        >
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Users className="size-8 mb-2 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">
                {t("cooperativeDashboard.noMembers")}
              </p>
            </div>
          ) : (
            <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    <th className="px-5 py-3">{t("cooperativeDashboard.tableMember")}</th>
                    <th className="px-5 py-3 hidden md:table-cell">
                      {t("cooperativeDashboard.tableEmail")}
                    </th>
                    <th className="px-5 py-3">{t("cooperativeDashboard.tableRole")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((m) => {
                    const name =
                      [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || m.id;
                    return (
                      <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-foreground">{name}</p>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs hidden md:table-cell">
                          {m.email ?? "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <Tag className="size-3" />
                            {t("cooperativeDashboard.roleCooperative")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
};
