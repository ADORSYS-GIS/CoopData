import { Users, Network, Building2, AlertCircle, ArrowRight } from "lucide-react";
import { AppShell, StatCard } from "@/components/app-shell";
import { useApexes } from "@/hooks/apexes/useApexes";
import { useCooperatives } from "@/hooks/cooperatives/useCooperatives";
import { useUserRole } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { Link } from "@tanstack/react-router";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { Spinner } from "@/components/ui/spinner";

// ─── Federation / Ministry view: list apexes → drill into apex members ───────

function ApexList() {
  const { t } = useOrganizationLabelsContext();
  const { data: apexes, isLoading, error } = useApexes();

  if (isLoading) return <CenteredSpinner />;
  if (error) return <ErrorBlock message={String(error)} label={t("users.failedLoadApexes")} />;

  const list = apexes ?? [];
  const totalCoops = list.reduce((s, a) => s + (a.sub_groups?.length ?? 0), 0);
  const apexesWithCoops = list.filter((a) => (a.sub_groups?.length ?? 0) > 0).length;
  const avgPerApex = list.length > 0 ? Math.round((totalCoops / list.length) * 10) / 10 : 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 mb-6">
        <StatCard
          icon={Network}
          label={t("users.totalApexes")}
          value={String(list.length)}
          subtitle={t("users.oversightBodies")}
          tone="primary"
        />
        <StatCard
          icon={Building2}
          label={t("users.cooperatives")}
          value={String(totalCoops)}
          subtitle={t("users.acrossAllApexes")}
          tone="accent"
        />
        <StatCard
          icon={Users}
          label={t("users.avgCoopApex")}
          value={String(avgPerApex)}
          subtitle={t("users.apexesHaveCoops", { count: apexesWithCoops })}
          tone="info"
        />
      </div>

      <SectionHeader title={t("users.apexOrganizations")} count={list.length} unit="apex" />

      {list.length === 0 ? (
        <EmptyState
          icon={Network}
          title={t("users.noApexesAvailable")}
          hint={t("users.createApexFirst")}
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
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent">
                  <Network className="size-5" />
                </div>
                <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent border border-accent/20">
                  {t("users.manage")} <ArrowRight className="size-3" />
                </span>
              </div>
              <div className="flex-1 mb-4">
                <h4 className="font-heading text-sm font-bold text-foreground truncate">
                  {a.name}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {a.description ?? t("users.noDescription")}
                </p>
                {a.path && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {a.path}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 border border-success/20 px-2.5 py-1 text-xs font-semibold text-success">
                  <Building2 className="size-3" />{" "}
                  {t("users.cooperativesCount", { count: a.sub_groups?.length ?? 0 })}
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
  const { t } = useOrganizationLabelsContext();
  const { data: rawData, isLoading, error } = useCooperatives();
  const coops = (rawData as CoopItem[]) ?? [];

  if (isLoading) return <CenteredSpinner />;
  if (error) return <ErrorBlock message={String(error)} label={t("users.failedLoadCoops")} />;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StatCard
          icon={Building2}
          label={t("users.cooperatives")}
          value={String(coops.length)}
          subtitle={t("users.underYourApex")}
          tone="primary"
        />
        <StatCard
          icon={Network}
          label={t("users.namedCoops")}
          value={String(coops.filter((c) => (c.name ?? "").trim().length > 0).length)}
          subtitle={t("users.readyForMembers")}
          tone="accent"
        />
      </div>

      <SectionHeader
        title={t("users.cooperatives")}
        count={coops.length}
        unit={t("users.sectionHeaderUnitCoop")}
      />

      {coops.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("users.noCooperativesYet")}
          hint={<span>{t("users.goToCooperativesRegister")}</span>}
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
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/10 border border-success/20 text-success">
                  <Building2 className="size-5" />
                </div>
                <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent border border-accent/20">
                  {t("users.manageMembers")} <ArrowRight className="size-3" />
                </span>
              </div>
              <div className="flex-1 mb-4">
                <h4 className="font-heading text-sm font-bold text-foreground truncate">
                  {c.name}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {c.description ?? t("users.noDescription")}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-2.5 py-1 text-xs font-semibold text-accent">
                  <Users className="size-3" /> {t("users.members")}
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
      <Spinner size="md" className="text-muted-foreground" />
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
  const { t } = useOrganizationLabelsContext();
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="font-heading text-sm font-bold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{t("users.sectionHeaderDesc")}</p>
      </div>
      <span className="text-xs font-semibold text-muted-foreground">
        {count} {unit}
        {count !== 1 && unit === "apex" ? "es" : ""}
        {count !== 1 && unit === "cooperative" ? "s" : ""}
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
  const { t } = useOrganizationLabelsContext();
  const { user } = useAuth();
  const role = useUserRole();

  if (!role) return null;

  return (
    <AppShell title={t("users.title")} subtitle={t(`users.subtitle.${role}`)}>
      <div className="space-y-6">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {t("users.welcome", { name: user?.firstName || user?.name || "" })}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t("users.welcomeSub")}</p>
        </div>
        {role === "apex" ? <CooperativeList /> : <ApexList />}
      </div>
    </AppShell>
  );
};
