import { createFileRoute } from "@tanstack/react-router";
import {
  Plug,
  RefreshCw,
  Key,
  Webhook,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Clock,
  ChevronRight,
  Zap,
} from "lucide-react";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { INTEGRATIONS } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/integrations")({
  head: () => ({ meta: [{ title: "Integrations — CoopData" }] }),
  component: IntegrationsPage,
});

const API_KEYS = [
  {
    name: "Manzini Federation",
    scope: "read:cooperatives, write:submissions",
    created: "Aug 12, 2025",
  },
  { name: "Mambu Connector", scope: "read:loans, read:members", created: "Jul 03, 2025" },
  { name: "National Statistics Pull", scope: "read:aggregates", created: "Jun 21, 2025" },
];

const WEBHOOKS = [
  {
    url: "https://hooks.gov.sz/coopdata/submissions",
    events: "submission.verified, submission.rejected",
  },
  { url: "https://federation.manzini.org/api/sync", events: "cooperative.updated" },
  { url: "https://sms-gateway.gov.sz/incoming", events: "alert.compliance" },
];

function IntegrationsPage() {
  return (
    <AppShell
      title="Integration Center"
      subtitle="External data sources, identity bridges and automated sync pipelines"
      actions={
        <button
          onClick={() => toast.info("Connect source wizard opened.")}
          className="press-feedback inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-[var(--shadow-elev-2)]"
        >
          <Plus className="size-4" /> Connect source
        </button>
      }
    >
      <div className="space-y-6">
        {/* Health Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={CheckCircle2}
            label="Connected"
            value="5"
            subtitle="Active data sources"
            tone="success"
          />
          <StatCard
            icon={AlertTriangle}
            label="Degraded"
            value="1"
            subtitle="Needs attention"
            tone="warning"
          />
          <StatCard
            icon={Activity}
            label="Synced today"
            value="12,847"
            subtitle="Records processed"
            tone="primary"
          />
          <StatCard
            icon={Clock}
            label="Avg latency"
            value="1.2s"
            subtitle="Pipeline response time"
            tone="info"
          />
        </div>

        {/* Connected Integrations */}
        <Card
          title="Connected Integrations"
          subtitle="Active data sources and external systems with sync status"
        >
          <ul className="grid md:grid-cols-2 gap-4">
            {INTEGRATIONS.map((i) => {
              const isHealthy = i.status === "Connected";
              const isDegraded = i.status === "Degraded";
              const tone = isHealthy ? "success" : isDegraded ? "warning" : ("neutral" as const);
              const StatusIcon = isHealthy ? CheckCircle2 : isDegraded ? AlertTriangle : RefreshCw;
              const edgeCls = isHealthy
                ? "card-edge-success"
                : isDegraded
                  ? "card-edge-warning"
                  : "card-edge";

              return (
                <li
                  key={i.id}
                  className={`rounded-xl border border-border bg-background p-5 hover-lift cursor-pointer ${edgeCls}`}
                  onClick={() => toast.info(`Configuring: ${i.name}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-xl bg-muted text-accent grid place-items-center shrink-0">
                        <Plug className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{i.name}</p>
                        <p className="text-xs text-muted-foreground">{i.category}</p>
                      </div>
                    </div>
                    <StatusPill tone={tone}>
                      <StatusIcon className="size-3 mr-1 inline" />
                      {i.status}
                    </StatusPill>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Last sync</dt>
                      <dd className="font-semibold mt-0.5 text-foreground">{i.lastSync}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Records</dt>
                      <dd className="font-semibold mt-0.5 num text-foreground">{i.records}</dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.info(`Opening config for ${i.name}`);
                      }}
                      className="press-feedback text-xs font-bold text-accent hover:underline"
                    >
                      Configure
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.info(`Opening logs for ${i.name}`);
                      }}
                      className="press-feedback text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      View logs
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* API Keys */}
          <Card
            title="API Keys"
            subtitle="Service credentials issued to federations and data consumers"
            action={
              <button
                onClick={() => toast.success("New API key generated.")}
                className="press-feedback inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"
              >
                <Plus className="size-3.5" /> Issue key
              </button>
            }
          >
            <ul className="divide-y divide-border -my-2">
              {API_KEYS.map((k) => (
                <li
                  key={k.name}
                  className="py-3.5 flex items-center gap-3 hover:bg-muted/20 -mx-5 px-5 transition-colors"
                >
                  <div className="size-8 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
                    <Key className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{k.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {k.scope}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground hidden sm:block shrink-0">
                    {k.created}
                  </span>
                  <button
                    onClick={() => toast.warning(`Revoked key: ${k.name}`)}
                    className="press-feedback text-xs font-bold text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Webhooks */}
          <Card
            title="Webhooks"
            subtitle="Outbound event subscriptions to external endpoints"
            action={
              <button
                onClick={() => toast.success("Webhook endpoint added.")}
                className="press-feedback inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"
              >
                <Plus className="size-3.5" /> Add webhook
              </button>
            }
          >
            <ul className="divide-y divide-border -my-2">
              {WEBHOOKS.map((w) => (
                <li
                  key={w.url}
                  className="py-3.5 flex items-center gap-3 hover:bg-muted/20 -mx-5 px-5 transition-colors"
                >
                  <div className="size-8 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
                    <Webhook className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold font-mono text-foreground truncate">
                      {w.url}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{w.events}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="size-2 rounded-full bg-success" />
                    <span className="text-[10px] text-success font-bold">Live</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
