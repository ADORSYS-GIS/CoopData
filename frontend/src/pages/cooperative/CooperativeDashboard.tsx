import { Building2, Users, Layers, Loader2, AlertCircle, CheckCircle2, Tag } from "lucide-react";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import {
  useMyCooperativeProfile,
  useMyCooperativeMembers,
  useMyAssignedDimensions,
} from "@/hooks/cooperatives/useCooperatives";
import { useAuth } from "@/context/AuthContext";

type CoopProfile = { id: string; name?: string; description?: string };
type MemberItem = { id: string; first_name?: string; last_name?: string; email?: string };
type DimensionsResponse = { assigned_dimensions?: string[]; cooperative_id?: string };

export const CooperativeDashboard: React.FC = () => {
  const { user } = useAuth();
  const {
    data: profileRaw,
    isLoading: profileLoading,
    error: profileError,
  } = useMyCooperativeProfile();
  const { data: membersRaw, isLoading: membersLoading } = useMyCooperativeMembers();
  const { data: dimRaw, isLoading: dimLoading } = useMyAssignedDimensions();

  const profile = profileRaw as CoopProfile | undefined;
  const members = (membersRaw as MemberItem[]) ?? [];
  const dimData = dimRaw as DimensionsResponse | undefined;
  const dimensions = dimData?.assigned_dimensions ?? [];

  const isLoading = profileLoading || membersLoading || dimLoading;

  if (isLoading) {
    return (
      <AppShell title="Cooperative Dashboard" subtitle="Your cooperative overview">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (profileError) {
    return (
      <AppShell title="Cooperative Dashboard" subtitle="Your cooperative overview">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <AlertCircle className="size-8 mb-2 text-destructive" />
          <p className="font-semibold text-sm">Failed to load cooperative data</p>
          <p className="text-xs mt-1">{String(profileError)}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={profile?.name ?? "Cooperative Dashboard"}
      subtitle={profile?.description ?? "Your cooperative overview"}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard
            icon={Users}
            label="Members"
            value={String(members.length)}
            subtitle="In your cooperative"
            tone="primary"
          />
          <StatCard
            icon={Layers}
            label="Assigned Dimensions"
            value={String(dimensions.length)}
            subtitle="Data dimensions you can assess"
            tone="success"
          />
          <StatCard
            icon={Building2}
            label="Your Role"
            value="Cooperative"
            subtitle={user?.name ?? "Member"}
            tone="accent"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Cooperative Profile" subtitle="Your cooperative details">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Name
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {profile?.name ?? "—"}
                </span>
              </div>
              <div className="flex items-start justify-between py-2 border-b border-border/50">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Description
                </span>
                <span className="text-sm text-foreground text-right max-w-[60%]">
                  {profile?.description ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Members
                </span>
                <span className="text-sm font-semibold text-foreground">{members.length}</span>
              </div>
            </div>
          </Card>

          <Card title="Assigned Dimensions" subtitle="Data dimensions you can assess">
            {dimensions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Layers className="size-8 mb-2 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">No dimensions assigned</p>
                <p className="text-xs mt-1">
                  Contact your apex administrator to assign dimensions.
                </p>
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

        <Card title="Members" subtitle="All members in your cooperative">
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Users className="size-8 mb-2 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">No members yet</p>
            </div>
          ) : (
            <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    <th className="px-5 py-3">Member</th>
                    <th className="px-5 py-3 hidden md:table-cell">Email</th>
                    <th className="px-5 py-3">Role</th>
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
                            Cooperative
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
