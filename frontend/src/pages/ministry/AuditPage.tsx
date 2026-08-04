import { useState, useMemo } from "react";
import {
  Search,
  ClipboardList,
  ShieldCheck,
  Activity,
  Globe,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import { useAuditLogs, type AuditLog, type AuditLogFilters } from "@/hooks/audit/useAuditLogs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const ACTION_OPTIONS = [
  "",
  "CREATE",
  "UPDATE",
  "DELETE",
  "INVITE",
  "RESEND_INVITATION",
  "DELETE_INVITATION",
];
const RESOURCE_OPTIONS = ["", "user", "federation", "apex", "cooperative", "organization"];

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function shortId(id?: string | null): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

const actionTone: Record<string, string> = {
  CREATE: "text-emerald-600 bg-emerald-50 border-emerald-200",
  UPDATE: "text-sky-600 bg-sky-50 border-sky-200",
  DELETE: "text-rose-600 bg-rose-50 border-rose-200",
  INVITE: "text-violet-600 bg-violet-50 border-violet-200",
  DELETE_INVITATION: "text-rose-600 bg-rose-50 border-rose-200",
  RESEND_INVITATION: "text-amber-600 bg-amber-50 border-amber-200",
};

export const AuditPage: React.FC = () => {
  const { t } = useTranslation();
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [actor, setActor] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const filters: AuditLogFilters = useMemo(
    () => ({
      action: action || undefined,
      resource_type: resourceType || undefined,
      actor_keycloak_id: actor.trim() || undefined,
      page,
      per_page: perPage,
    }),
    [action, resourceType, actor, page, perPage],
  );

  const { data, isLoading, error, isFetching } = useAuditLogs(filters);
  const logs = useMemo(() => data?.data ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 0;

  const uniqueActions = useMemo(() => new Set(logs.map((l) => l.action)), [logs]);
  const uniqueResources = useMemo(() => new Set(logs.map((l) => l.resource_type)), [logs]);
  const uniqueActors = useMemo(() => new Set(logs.map((l) => l.actor_keycloak_id)), [logs]);

  const resetPage = () => setPage(1);

  return (
    <AppShell title={t("auditLog.title")} subtitle={t("auditLog.subtitle")}>
      <div className="-m-2 space-y-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 shadow-inner">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={ClipboardList}
            label={t("auditLog.totalEvents")}
            value={String(total)}
            subtitle={t("auditLog.acrossAllFilters")}
            tone="primary"
          />
          <StatCard
            icon={Activity}
            label={t("auditLog.actionsThisPage")}
            value={String(uniqueActions.size)}
            subtitle={t("auditLog.distinctActionTypes")}
            tone="accent"
          />
          <StatCard
            icon={Globe}
            label={t("auditLog.resourcesThisPage")}
            value={String(uniqueResources.size)}
            subtitle={t("auditLog.resourceTypesShown")}
            tone="info"
          />
          <StatCard
            icon={ShieldCheck}
            label={t("auditLog.activeActors")}
            value={String(uniqueActors.size)}
            subtitle={t("auditLog.usersOnThisPage")}
            tone="success"
          />
        </div>

        <Card title={t("auditLog.cardTitle")} subtitle={t("auditLog.cardSubtitle")}>
          <div className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                value={actor}
                onChange={(e) => {
                  setActor(e.target.value);
                  resetPage();
                }}
                placeholder={t("auditLog.filterActorPlaceholder")}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10"
              />
            </div>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                resetPage();
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10"
            >
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a || t("auditLog.allActions")}
                </option>
              ))}
            </select>
            <select
              value={resourceType}
              onChange={(e) => {
                setResourceType(e.target.value);
                resetPage();
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10"
            >
              {RESOURCE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r || t("auditLog.allResources")}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertCircle className="mb-2 size-8 text-destructive" />
              <p className="text-sm font-semibold">{t("auditLog.failedLoad")}</p>
              <p className="mt-1 text-xs">{String(error)}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ClipboardList className="mb-2 size-8 opacity-50" />
              <p className="text-sm font-semibold">{t("auditLog.noEventsFound")}</p>
              <p className="mt-1 text-xs">{t("auditLog.adjustFilters")}</p>
            </div>
          ) : (
            <>
              <div className="-mx-5 -mb-5 overflow-x-auto border-t border-slate-200 bg-white">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/90 text-[10px] uppercase tracking-wider text-slate-700 font-bold">
                      <th className="px-5 py-3.5">{t("auditLog.tableHeaders.when")}</th>
                      <th className="px-5 py-3.5">{t("auditLog.tableHeaders.action")}</th>
                      <th className="px-5 py-3.5">{t("auditLog.tableHeaders.resource")}</th>
                      <th className="px-5 py-3.5 hidden md:table-cell">
                        {t("auditLog.tableHeaders.actor")}
                      </th>
                      <th className="px-5 py-3.5 hidden lg:table-cell">
                        {t("auditLog.tableHeaders.ip")}
                      </th>
                      <th className="px-5 py-3.5 text-right">
                        {t("auditLog.tableHeaders.details")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-slate-100 transition-colors hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                              actionTone[log.action] ??
                              "text-slate-600 bg-slate-50 border-slate-200"
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-slate-900">{log.resource_type}</span>
                          <span className="ml-2 text-xs text-slate-500">
                            {shortId(log.resource_keycloak_id)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell font-mono text-xs text-slate-600">
                          {shortId(log.actor_keycloak_id)}
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-slate-500">
                          {log.ip_address ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => setSelected(log)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/10 transition-colors"
                            aria-label={t("auditLog.viewDetailsAria")}
                          >
                            <Eye className="size-3.5" /> {t("auditLog.viewBtn")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-center justify-between gap-3 px-5 py-4 sm:flex-row">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <label className="font-medium">{t("auditLog.rowsPerPage")}</label>
                  <select
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      resetPage();
                    }}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="ml-2 font-medium text-slate-500">
                    {isFetching
                      ? t("auditLog.updating")
                      : t("auditLog.pageIndicator", {
                          page,
                          totalPages: Math.max(totalPages, 1),
                          total,
                        })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="size-4" /> {t("auditLog.prev")}
                  </button>
                  <span className="text-xs font-bold text-slate-700">
                    {page} / {Math.max(totalPages, 1)}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("auditLog.next")} <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ─── Detail dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("auditLog.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {selected ? formatDateTime(selected.created_at) : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <DetailRow label={t("auditLog.detailRowLabels.action")} value={selected.action} />
              <DetailRow
                label={t("auditLog.detailRowLabels.resourceType")}
                value={selected.resource_type}
              />
              <DetailRow
                label={t("auditLog.detailRowLabels.resourceId")}
                value={selected.resource_keycloak_id ?? "—"}
              />
              <DetailRow
                label={t("auditLog.detailRowLabels.actorKeycloakId")}
                value={selected.actor_keycloak_id}
              />
              {selected.actor_id && (
                <DetailRow
                  label={t("auditLog.detailRowLabels.actorUserId")}
                  value={selected.actor_id}
                />
              )}
              <DetailRow
                label={t("auditLog.detailRowLabels.ipAddress")}
                value={selected.ip_address ?? "—"}
              />
              {selected.user_agent && (
                <DetailRow
                  label={t("auditLog.detailRowLabels.userAgent")}
                  value={selected.user_agent}
                />
              )}
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t("auditLog.detailsJson")}
                </p>
                <pre className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  {selected.details ? JSON.stringify(selected.details, null, 2) : "—"}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-right font-mono text-xs text-slate-800 break-all">{value}</span>
    </div>
  );
}
export default AuditPage;
