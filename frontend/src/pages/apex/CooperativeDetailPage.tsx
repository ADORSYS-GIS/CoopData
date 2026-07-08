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
  const { cooperativeId } = useParams({ from: "/app/cooperative/$cooperativeId" });
  const navigate = useNavigate();
  const { data: coop, isLoading, error } = useCooperativeProfile(cooperativeId);

  if (isLoading) {
    return (
      <AppShell title="Cooperative Details" subtitle="View cooperative information">
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !coop) {
    return (
      <AppShell title="Cooperative Details" subtitle="View cooperative information">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="font-semibold text-sm">Failed to load cooperative</p>
          <p className="text-xs mt-1">{error ? String(error) : "Not found"}</p>
          <button
            onClick={() => navigate({ to: "/app/cooperatives" })}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Back to cooperatives
          </button>
        </div>
      </AppShell>
    );
  }

  const statusTone = STATUS_TONE[coop.status] ?? "default";

  return (
    <AppShell
      title={coop.name}
      subtitle={`Cooperative Profile — ${coop.institution_type ?? "Unknown type"}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/app/cooperatives" })}
          className="press-feedback inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to cooperatives
        </button>
        <div className="flex items-center gap-2">
          {coop.keycloak_id && (
            <Link
              to="/app/cooperative-members/$cooperativeId"
              params={{ cooperativeId: coop.keycloak_id }}
            >
              <Button variant="outline" size="sm" className="gap-2">
                <Users className="size-4" />
                Manage Members
              </Button>
            </Link>
          )}
          <Link to="/app/cooperative-profile/$cooperativeId" params={{ cooperativeId: coop.id }}>
            <Button size="sm" className="gap-2">
              <Pencil className="size-4" />
              Edit Profile
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Overview" subtitle="Primary cooperative information" className="lg:col-span-2">
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
            <InfoRow icon={Hash} label="Registration Number" value={coop.reg_no} />
            <InfoRow icon={FileText} label="TIN" value={coop.tin} />
            <InfoRow icon={MapPin} label="Address" value={coop.address} />
            <InfoRow icon={MapPin} label="Georeference (GPS)" value={coop.georeference} />
            <InfoRow icon={Globe} label="Region" value={coop.region} />
            <InfoRow
              icon={Globe}
              label="Geographic Classification"
              value={coop.geographic_classif}
            />
            <InfoRow icon={Phone} label="Phone" value={coop.phone} />
            <InfoRow icon={Landmark} label="Sector" value={coop.sector} />
            <InfoRow icon={Calendar} label="Registered On" value={coop.registered_on} />
            <InfoRow icon={FileText} label="Accounting Year" value={coop.accounting_year} />
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Status" subtitle="Operational state">
            <div className="flex flex-col items-center py-4">
              <Badge variant={statusTone} className="text-sm px-4 py-1.5 gap-1.5">
                {coop.status === "Active" && <CheckCircle2 className="size-4" />}
                {coop.status === "Inactive" && <PauseCircle className="size-4" />}
                {coop.status === "Suspended" && <XCircle className="size-4" />}
                {coop.status}
              </Badge>
              <p className="mt-3 text-xs text-muted-foreground text-center">
                {coop.status === "Active"
                  ? "This cooperative is operational and can submit data."
                  : coop.status === "Suspended"
                    ? "This cooperative is suspended and cannot submit data."
                    : "This cooperative is inactive."}
              </p>
            </div>
          </Card>

          <Card title="Metadata" subtitle="System information">
            <InfoRow icon={Calendar} label="Created At" value={coop.created_at} />
            <InfoRow icon={Calendar} label="Updated At" value={coop.updated_at} />
            <InfoRow icon={Hash} label="Cooperative ID" value={coop.id} />
            {coop.keycloak_id && (
              <InfoRow icon={Building2} label="Keycloak Group ID" value={coop.keycloak_id} />
            )}
          </Card>

          <Card title="Quick Actions" subtitle="Manage this cooperative">
            <div className="space-y-2">
              {coop.keycloak_id && (
                <Link
                  to="/app/cooperative-members/$cooperativeId"
                  params={{ cooperativeId: coop.keycloak_id }}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted/40 transition-colors group"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Users className="size-4 text-violet-600" />
                    Manage Members
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
                  Edit Profile
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
