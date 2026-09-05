import {
  Plus,
  Search,
  Building2,
  Users,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  ChevronRight,
  Eye,
  CheckCircle2,
  XCircle,
  PauseCircle,
} from "lucide-react";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  useDeleteCooperative,
  useCooperativeDeletePreview,
} from "@/hooks/cooperatives/useCooperatives";
import {
  useCooperativeProfiles,
  type CooperativeProfile,
} from "@/hooks/cooperatives/useCooperativeProfile";
import { CooperativeProfileForm } from "@/pages/apex/CooperativeProfile";
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";
import { useVerifyIdentity } from "@/hooks/auth/useVerifyIdentity";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

const STATUS_TONE: Record<
  string,
  { variant: "default" | "secondary" | "destructive"; icon: typeof CheckCircle2 }
> = {
  Active: { variant: "default", icon: CheckCircle2 },
  Inactive: { variant: "secondary", icon: PauseCircle },
  Suspended: { variant: "destructive", icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE["Active"];
  const Icon = tone.icon;
  return (
    <Badge variant={tone.variant} className="gap-1">
      <Icon className="size-3" />
      {status}
    </Badge>
  );
}

export const CooperativesPage: React.FC = () => {
  const { t } = useOrganizationLabelsContext();
  const navigate = useNavigate();
  const { data: cooperatives, isLoading, error } = useCooperativeProfiles();
  const deleteCoop = useDeleteCooperative();
  const { verifyIdentity } = useVerifyIdentity();

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingCoop, setDeletingCoop] = useState<CooperativeProfile | null>(null);

  const { data: previewData, isLoading: previewLoading } = useCooperativeDeletePreview(
    deletingCoop?.id ?? "",
  );

  const handleVerifyIdentity = async (password: string, otp?: string) => {
    return verifyIdentity({ password, otp });
  };

  const handleConfirmDelete = async (verificationToken: string) => {
    if (!deletingCoop) return;
    return new Promise<void>((resolve, reject) => {
      deleteCoop.mutate(
        { id: deletingCoop.id, verificationToken },
        {
          onSuccess: () => {
            toast.success(t("cooperativesPage.toastDeleted", { name: deletingCoop.name }));
            setDeletingCoop(null);
            resolve();
          },
          onError: (err) => {
            toast.error(t("cooperativesPage.toastDeleteFailed"), { description: String(err) });
            reject(err);
          },
        },
      );
    });
  };

  const allCoops = cooperatives ?? [];

  const filtered = allCoops.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.reg_no ?? "").toLowerCase().includes(q) ||
      (c.region ?? "").toLowerCase().includes(q) ||
      (c.sector ?? "").toLowerCase().includes(q) ||
      (c.institution_type ?? "").toLowerCase().includes(q)
    );
  });

  const activeCount = allCoops.filter((c) => c.status === "Active").length;
  const suspendedCount = allCoops.filter((c) => c.status === "Suspended").length;
  const inactiveCount = allCoops.filter((c) => c.status === "Inactive").length;
  const saccoCount = allCoops.filter((c) => c.institution_type === "sacco").length;

  if (isLoading) {
    return (
      <AppShell title={t("cooperativesPage.title")} subtitle={t("cooperativesPage.subtitle")}>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" className="text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title={t("cooperativesPage.title")} subtitle={t("cooperativesPage.subtitle")}>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <AlertCircle className="size-8 mb-2 text-destructive" />
          <p className="font-semibold text-sm">{t("cooperativesPage.failedLoad")}</p>
          <p className="text-xs mt-1">{String(error)}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("cooperativesPage.title")} subtitle={t("cooperativesPage.createSubtitle")}>
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="press-feedback inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-[var(--shadow-elev-2)]"
          >
            <Plus className="size-4" /> {t("cooperativesPage.registerCoopBtn")}
          </button>
        </div>
        <div className="-m-2 space-y-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 shadow-inner">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={Building2}
              label={t("cooperativesPage.totalCooperatives")}
              value={String(allCoops.length)}
              subtitle={t("cooperativesPage.underYourApex")}
              tone="primary"
            />
            <StatCard
              icon={CheckCircle2}
              label={t("cooperativesPage.active")}
              value={String(activeCount)}
              subtitle={t("cooperativesPage.operational")}
              tone="success"
            />
            <StatCard
              icon={PauseCircle}
              label={t("cooperativesPage.inactiveSuspended")}
              value={String(inactiveCount + suspendedCount)}
              subtitle={t("cooperativesPage.inactiveSuspendedDesc", {
                inactive: inactiveCount,
                suspended: suspendedCount,
              })}
              tone="warning"
            />
            <StatCard
              icon={Building2}
              label={t("cooperativesPage.saccos")}
              value={String(saccoCount)}
              subtitle={t("cooperativesPage.saccosDesc")}
              tone="accent"
            />
          </div>

          <Card
            title={t("cooperativesPage.directoryTitle")}
            subtitle={t("cooperativesPage.directorySubtitle")}
          >
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div className="relative min-w-[280px] max-w-md w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("cooperativesPage.searchPlaceholder")}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 shadow-sm transition-all focus:border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/10"
                />
              </div>
            </div>

            <div className="-mx-5 -mb-5 overflow-x-auto border-t border-slate-200 bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/90 text-[10px] uppercase tracking-wider text-slate-700 font-bold">
                    <th className="px-5 py-3.5">
                      {t("cooperativesPage.tableHeaders.cooperative")}
                    </th>
                    <th className="px-5 py-3.5 hidden lg:table-cell">
                      {t("cooperativesPage.tableHeaders.regNo")}
                    </th>
                    <th className="px-5 py-3.5 hidden md:table-cell">
                      {t("cooperativesPage.tableHeaders.type")}
                    </th>
                    <th className="px-5 py-3.5 hidden lg:table-cell">
                      {t("cooperativesPage.tableHeaders.region")}
                    </th>
                    <th className="px-5 py-3.5 hidden xl:table-cell">
                      {t("cooperativesPage.tableHeaders.sector")}
                    </th>
                    <th className="px-5 py-3.5">{t("cooperativesPage.tableHeaders.status")}</th>
                    <th className="px-5 py-3.5 text-right">
                      {t("cooperativesPage.tableHeaders.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-600">
                        <div className="flex flex-col items-center justify-center">
                          <Building2 className="size-8 text-slate-400 mb-2" />
                          <p className="font-bold text-sm text-slate-900">
                            {allCoops.length === 0
                              ? t("cooperativesPage.noCoopsRegistered")
                              : t("cooperativesPage.noCoopsMatchSearch")}
                          </p>
                          <p className="text-xs mt-1">
                            {allCoops.length === 0
                              ? t("cooperativesPage.registerFirst")
                              : t("cooperativesPage.adjustSearch")}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() =>
                          navigate({
                            to: "/app/cooperative/$cooperativeId",
                            params: { cooperativeId: c.id },
                          })
                        }
                        className="group cursor-pointer hover:bg-accent/10/60 transition-colors duration-150"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-success/20 bg-success/10 text-success">
                              <Building2 className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-950 leading-tight">{c.name}</p>
                              <p className="mt-0.5 text-xs text-slate-500 truncate max-w-[200px]">
                                {c.phone ?? "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 hidden lg:table-cell">
                          <span className="font-mono text-xs text-slate-700">
                            {c.reg_no ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <span className="text-xs font-medium text-slate-700 capitalize">
                            {c.institution_type ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4 hidden lg:table-cell text-xs text-slate-700">
                          {c.region ?? "—"}
                        </td>
                        <td className="px-5 py-4 hidden xl:table-cell text-xs text-slate-700">
                          {c.sector ?? "—"}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                navigate({
                                  to: "/app/cooperative/$cooperativeId",
                                  params: { cooperativeId: c.id },
                                })
                              }
                              title={t("cooperativesPage.tooltipView")}
                              className="press-feedback inline-flex items-center justify-center size-8 rounded-lg border border-accent/20 bg-accent/10 text-accent shadow-sm transition-colors hover:border-accent/30 hover:bg-accent/15"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            {c.keycloak_id && (
                              <Link
                                to="/app/cooperative-members/$cooperativeId"
                                params={{ cooperativeId: c.keycloak_id }}
                                title={t("cooperativesPage.tooltipMembers")}
                                className="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent shadow-sm transition-colors hover:border-accent/30 hover:bg-accent/15"
                              >
                                <Users className="size-3.5" />
                                <ChevronRight className="size-3" />
                              </Link>
                            )}
                            <Link
                              to="/app/cooperative-profile/$cooperativeId"
                              params={{ cooperativeId: c.id }}
                              title={t("cooperativesPage.tooltipEdit")}
                              className="press-feedback inline-flex items-center justify-center size-8 rounded-lg border border-warning/20 bg-warning/10 text-warning-foreground shadow-sm transition-colors hover:border-warning/30 hover:bg-warning/10"
                            >
                              <Pencil className="size-3.5" />
                            </Link>
                            <button
                              onClick={() => setDeletingCoop(c)}
                              className="press-feedback inline-flex items-center justify-center size-8 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive shadow-sm transition-colors hover:border-destructive/30 hover:bg-destructive/10"
                              title={t("cooperativesPage.tooltipDelete")}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-600">
              <p>
                {t("cooperativesPage.showingCount", {
                  filtered: filtered.length,
                  total: allCoops.length,
                })}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            onClick={() => setIsCreateOpen(false)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-2xl my-8 z-10">
            <div className="flex items-center justify-between mb-2 px-2">
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-accent" />
                <h3 className="font-heading text-lg font-bold text-foreground">
                  {t("cooperativesPage.registerNewTitle")}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="press-feedback rounded-lg p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <CooperativeProfileForm onSuccess={() => setIsCreateOpen(false)} />
          </div>
        </div>
      )}

      <DeleteConfirmationDialog
        open={!!deletingCoop}
        onOpenChange={(open) => !open && setDeletingCoop(null)}
        entityName={deletingCoop?.name ?? ""}
        entityType="cooperative"
        entityId={deletingCoop?.id ?? ""}
        previewData={
          previewData as unknown as
            { apexes: number; cooperatives: number; members: number } | undefined
        }
        previewLoading={previewLoading}
        onVerifyIdentity={handleVerifyIdentity}
        onConfirmDelete={handleConfirmDelete}
      />
    </AppShell>
  );
};
