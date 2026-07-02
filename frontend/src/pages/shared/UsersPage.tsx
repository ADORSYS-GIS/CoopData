import { Users, Network, Building2, Loader2, AlertCircle, Shield, ArrowRight } from "lucide-react";
import { AppShell, StatCard } from "@/components/app-shell";
import { useApexes } from "@/hooks/apexes/useApexes";
import { useCooperatives } from "@/hooks/cooperatives/useCooperatives";
import { useUserRole } from "@/lib/auth";
import { Link } from "@tanstack/react-router";
import type { Role } from "@/constants/roles";

const SUBTITLE: Record<Role, string> = {
  ministry: "Select an apex to oversee its user accounts.",
  federation: "Select an apex within your federation to manage its members.",
  apex: "Select a cooperative to manage its members.",
  cooperative: "View members within your cooperative.",
};

// ─── Federation / Ministry view: list apexes → drill into apex members ───────

function ApexList() {
  const { data: apexes, isLoading, error } = useApexes();

  if (isLoading) return <CenteredSpinner />;
  if (error) return <ErrorBlock message={String(error)} label="Failed to load apexes" />;

  const list = apexes ?? [];

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 mb-6">
        <StatCard
          icon={Network}
          label="Total Apexes"
          value={String(list.length)}
          subtitle="Oversight bodies"
          tone="primary"
        />
        <StatCard
          icon={Building2}
          label="Cooperatives"
          value={String(list.reduce((s, a) => s + (a.sub_groups?.length ?? 0), 0))}
          subtitle="Across all apexes"
          tone="accent"
        />
        <StatCard
          icon={Shield}
          label="Your Role"
          value="Federation"
          subtitle="Access level"
          tone="info"
        />
      </div>

      <SectionHeader title="Apex Organizations" count={list.length} unit="apex" />

      {list.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No apexes available"
          hint="Create an apex first on the Apexes page."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <Link
              key={a.id}
              to="/app/users/$apexId"
              params={{ apexId: a.id }}
              className="group relative flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)] transition-all duration-200 hover:shadow-[var(--shadow-elev-2)] hover:border-accent/30 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 border border-sky-200 text-sky-600">
                  <Network className="size-5" />
                </div>
                <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent border border-accent/20">
                  Manage <ArrowRight className="size-3" />
                </span>
              </div>
              <div className="flex-1 mb-4">
                <h4 className="font-heading text-[15px] font-bold text-foreground truncate">
                  {a.name}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {a.description ?? "No description."}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <Building2 className="size-3" /> {a.sub_groups?.length ?? 0} cooperatives
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-2xl bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Apex view: list cooperatives → drill into cooperative members ───────────

type CoopItem = { id: string; name: string; description?: string | null };

function CooperativeList() {
  const { data: rawData, isLoading, error } = useCooperatives();
  const coops = (rawData as CoopItem[]) ?? [];

  if (isLoading) return <CenteredSpinner />;
  if (error) return <ErrorBlock message={String(error)} label="Failed to load cooperatives" />;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 mb-6">
        <StatCard
          icon={Building2}
          label="Cooperatives"
          value={String(coops.length)}
          subtitle="Under your apex"
          tone="primary"
        />
        <StatCard
          icon={Shield}
          label="Your Role"
          value="Apex"
          subtitle="Access level"
          tone="info"
        />
      </div>

      <SectionHeader title="Cooperatives" count={coops.length} unit="cooperative" />

      {coops.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No cooperatives yet"
          hint={
            <span>
              Go to{" "}
              <Link to="/app/cooperatives" className="text-accent underline">
                Cooperatives
              </Link>{" "}
              to register your first one.
            </span>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coops.map((c) => (
            <Link
              key={c.id}
              to="/app/cooperative-members/$cooperativeId"
              params={{ cooperativeId: c.id }}
              className="group relative flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-elev-1)] transition-all duration-200 hover:shadow-[var(--shadow-elev-2)] hover:border-accent/30 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
                  <Building2 className="size-5" />
                </div>
                <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent border border-accent/20">
                  Manage Members <ArrowRight className="size-3" />
                </span>
              </div>
              <div className="flex-1 mb-4">
                <h4 className="font-heading text-[15px] font-bold text-foreground truncate">
                  {c.name}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {c.description ?? "No description."}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                  <Users className="size-3" /> Members
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-2xl bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Shared primitives ───────────────────────────────────────────────────────

function CenteredSpinner() {
  return (
    <div className="flex min-h-[40dvh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function ErrorBlock({ label, message }: { label: string; message: string }) {
  return (
    <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3">
      <AlertCircle className="size-8 text-destructive" />
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground max-w-sm text-center">{message}</p>
    </div>
  );
}

function SectionHeader({ title, count, unit }: { title: string; count: number; unit: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="font-heading text-sm font-bold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Click to manage members</p>
      </div>
      <span className="text-xs font-semibold text-muted-foreground">
        {count} {unit}
        {count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ElementType;
  title: string;
  hint: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-16 text-muted-foreground">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-4">
        <Icon className="size-7 text-muted-foreground/60" />
      </div>
      <p className="font-semibold text-sm text-foreground">{title}</p>
      <p className="text-xs mt-1 max-w-xs text-center">{hint}</p>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export const UsersPage: React.FC = () => {
  const role = useUserRole();

  if (!role) return null;

  return (
    <AppShell title="Users & Roles" subtitle={SUBTITLE[role]}>
      <div className="space-y-2">{role === "apex" ? <CooperativeList /> : <ApexList />}</div>
    </AppShell>
  );
};
