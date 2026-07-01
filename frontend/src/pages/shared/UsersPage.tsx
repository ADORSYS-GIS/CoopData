import {
  Users,
  Network,
  Building2,
  ChevronRight,
  Loader2,
  AlertCircle,
  Shield,
  ArrowRight,
} from "lucide-react";
import { AppShell, StatCard } from "@/components/app-shell";
import { useApexes } from "@/hooks/apexes/useApexes";
import { type Role, useUserRole } from "@/lib/auth";
import { Link } from "@tanstack/react-router";

const INSTRUCTIONS: Record<Role, string> = {
  ministry: "Select an apex to oversee its user accounts.",
  federation: "Select an apex within your federation to manage its members.",
  apex: "Select an apex to review its members.",
  cooperative: "View and manage members within your cooperative.",
};

export const UsersPage: React.FC = () => {
  const role = useUserRole();
  const { data: apexes, isLoading, error } = useApexes();

  if (!role) return null;

  const totalMembers = apexes?.reduce((s, a) => s + (a.sub_groups?.length ?? 0), 0) ?? 0;

  if (isLoading) {
    return (
      <AppShell title="Users & Roles" subtitle="Select an organization to manage members">
        <div className="flex min-h-[40dvh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Users & Roles" subtitle="Select an organization to manage members">
        <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm font-semibold text-foreground">Failed to load apexes</p>
          <p className="text-xs text-muted-foreground">{String(error)}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Users & Roles" subtitle={INSTRUCTIONS[role]}>
      <div className="space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard
            icon={Network}
            label="Total Apexes"
            value={String(apexes?.length ?? 0)}
            subtitle="Oversight bodies"
            tone="primary"
          />
          <StatCard
            icon={Users}
            label="Cooperatives"
            value={String(totalMembers)}
            subtitle="Across all apexes"
            tone="accent"
          />
          <StatCard
            icon={Shield}
            label="Role"
            value={role.charAt(0).toUpperCase() + role.slice(1)}
            subtitle="Your access level"
            tone="info"
          />
        </div>

        {/* Apex grid */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-sm font-bold text-foreground">Apex Organizations</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click an apex to view and manage its members
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {apexes?.length ?? 0} apex{(apexes?.length ?? 0) !== 1 ? "es" : ""}
            </span>
          </div>

          {!apexes || apexes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-16 text-muted-foreground">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-4">
                <Network className="size-7 text-muted-foreground/60" />
              </div>
              <p className="font-semibold text-sm text-foreground">No apexes available</p>
              <p className="text-xs mt-1 max-w-xs text-center">
                {role === "federation"
                  ? "Create an apex first on the Apexes page."
                  : "There are no apexes in your scope."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {apexes.map((a) => (
                <Link
                  key={a.id}
                  to="/app/users/$apexId"
                  params={{ apexId: a.id }}
                  className="group relative flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)] transition-all duration-200 hover:shadow-[var(--shadow-elev-2)] hover:border-accent/30 hover:-translate-y-0.5"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/15 to-blue-600/10 border border-sky-200/60 text-sky-600">
                      <Network className="size-5" />
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent border border-accent/20 group-hover:bg-accent/15 transition-colors">
                      Manage
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  {/* Name + description */}
                  <div className="flex-1 mb-4">
                    <h4 className="font-heading text-[15px] font-bold text-foreground truncate leading-tight">
                      {a.name}
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {a.description ?? "No description provided."}
                    </p>
                  </div>

                  {/* Footer stats */}
                  <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      <Building2 className="size-3" />
                      {a.sub_groups?.length ?? 0} cooperatives
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                      <Users className="size-3" />
                      Members
                    </span>
                  </div>

                  {/* Hover indicator */}
                  <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-2xl bg-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};
