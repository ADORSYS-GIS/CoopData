import { useParams, useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Pencil,
  Users,
  Building2,
  Hash,
  MapPin,
  Phone,
  Calendar,
  Landmark,
  Globe,
  FileText,
  CheckCircle2,
  XCircle,
  PauseCircle,
  ChevronRight,
} from "lucide-react";
import { AppShell, Card } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useCooperativeProfile,
  type CooperativeProfile,
} from "@/hooks/cooperatives/useCooperativeProfile";
import { useTranslation } from "react-i18next";

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive"> = {
  Active: "default",
  Inactive: "secondary",
  Suspended: "destructive",
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground break-words">
          {value && value.trim() !== "" ? value : "—"}
        </p>
      </div>
    </div>
  );
}

export const CooperativeDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { cooperativeId } = useParams({ from: "/app/cooperative/$cooperativeId" });
  const navigate = useNavigate();
  const { data: coop, isLoading, error } = useCooperativeProfile(cooperativeId);

  if (isLoading) {
    return (
      <AppShell title={t("coopDetail.title")} subtitle={t("coopDetail.subtitle")}>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">{t("coopDetail.loading")}</p>
        </div>
      </AppShell>
    );
  }

  if (error || !coop) {
    return (
      <AppShell title={t("coopDetail.title")} subtitle={t("coopDetail.subtitle")}>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="font-semibold text-sm">{t("coopDetail.failed")}</p>
          <p className="text-xs mt-1">{error ? String(error) : t("coopDetail.notFound")}</p>
          <button
            onClick={() => navigate({ to: "/app/cooperatives" })}
            className="mt-4 text-sm text-primary hover:underline"
          >
            {t("coopDetail.backToCoops")}
          </button>
        </div>
      </AppShell>
    );
  }

  const statusTone = STATUS_TONE[coop.status] ?? "default";

  return (
    <AppShell
      title={coop.name}
      subtitle={`${t("coopDetail.cooperativeProfile")} — ${coop.institution_type ?? t("analytics.unknown")}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/app/cooperatives" })}
          className="press-feedback inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          {t("coopDetail.backToCoops")}
        </button>
        <div className="flex items-center gap-2">
          {coop.keycloak_id && (
            <Link
              to="/app/cooperative-members/$cooperativeId"
              params={{ cooperativeId: coop.keycloak_id }}
            >
              <Button variant="outline" size="sm" className="gap-2">
                <Users className="size-4" />
                {t("coopDetail.manageMembers")}
              </Button>
            </Link>
          )}
          <Link to="/app/cooperative-profile/$cooperativeId" params={{ cooperativeId: coop.id }}>
              <Button size="sm" className="gap-2">
                <Pencil className="size-4" />
                {t("coopDetail.editProfile")}
              </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={t("coopDetail.overview")} subtitle={t("coopDetail.overviewSub")} className="lg:col-span-2">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Building2 className="size-8" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-xl font-bold text-foreground">{coop.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={statusTone} className="gap-1">
                  {coop.status === "Active" && <CheckCircle2 className="size-3" />}
                  {coop.status === "Inactive" && <PauseCircle className="size-3" />}
                  {coop.status === "Suspended" && <XCircle className="size-3" />}
                  {coop.status}
                </Badge>
                <span className="text-xs text-muted-foreground capitalize">
                  {coop.institution_type ?? "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <InfoRow icon={Hash} label={t("coopDetail.regNumber")} value={coop.reg_no} />
            <InfoRow icon={FileText} label={t("coopDetail.tin")} value={coop.tin} />
            <InfoRow icon={MapPin} label={t("coopDetail.address")} value={coop.address} />
            <InfoRow icon={MapPin} label={t("coopDetail.georeference")} value={coop.georeference} />
            <InfoRow icon={Globe} label={t("coopDetail.region")} value={coop.region} />
            <InfoRow
              icon={Globe}
              label={t("coopDetail.geoClassif")}
              value={coop.geographic_classif}
            />
            <InfoRow icon={Phone} label={t("coopDetail.phone")} value={coop.phone} />
            <InfoRow icon={Landmark} label={t("coopDetail.sector")} value={coop.sector} />
            <InfoRow icon={Calendar} label={t("coopDetail.registeredOn")} value={coop.registered_on} />
            <InfoRow icon={FileText} label={t("coopDetail.accountingYear")} value={coop.accounting_year} />
          </div>
        </Card>

        <div className="space-y-6">
          <Card title={t("coopDetail.status")} subtitle={t("coopDetail.statusSub")}>
            <div className="flex flex-col items-center py-4">
              <Badge variant={statusTone} className="text-sm px-4 py-1.5 gap-1.5">
                {coop.status === "Active" && <CheckCircle2 className="size-4" />}
                {coop.status === "Inactive" && <PauseCircle className="size-4" />}
                {coop.status === "Suspended" && <XCircle className="size-4" />}
                {coop.status}
              </Badge>
              <p className="mt-3 text-xs text-muted-foreground text-center">
                {coop.status === "Active"
                  ? t("coopDetail.statusActive")
                  : coop.status === "Suspended"
                    ? t("coopDetail.statusSuspended")
                    : t("coopDetail.statusInactive")}
              </p>
            </div>
          </Card>

          <Card title={t("coopDetail.metadata")} subtitle={t("coopDetail.metadataSub")}>
            <InfoRow icon={Calendar} label={t("coopDetail.createdAt")} value={coop.created_at} />
            <InfoRow icon={Calendar} label={t("coopDetail.updatedAt")} value={coop.updated_at} />
            <InfoRow icon={Hash} label={t("coopDetail.cooperativeId")} value={coop.id} />
            {coop.keycloak_id && (
              <InfoRow icon={Building2} label={t("coopDetail.keycloakId")} value={coop.keycloak_id} />
            )}
          </Card>

          <Card title={t("coopDetail.quickActions")} subtitle={t("coopDetail.quickActionsSub")}>
            <div className="space-y-2">
              {coop.keycloak_id && (
                <Link
                  to="/app/cooperative-members/$cooperativeId"
                  params={{ cooperativeId: coop.keycloak_id }}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted/40 transition-colors group"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Users className="size-4 text-violet-600" />
                    {t("coopDetail.manageMembers")}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
              <Link
                to="/app/cooperative-profile/$cooperativeId"
                params={{ cooperativeId: coop.id }}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted/40 transition-colors group"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Pencil className="size-4 text-amber-600" />
                  {t("coopDetail.editProfile")}
                </span>
                <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};
