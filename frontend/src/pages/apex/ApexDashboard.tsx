import {
  Building2,
  Users,
  Loader2,
  AlertCircle,
  Network,
  ChevronRight,
  Inbox,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import { useCooperatives } from "@/hooks/cooperatives/useCooperatives";
import { useApexStats } from "@/hooks/submissions/useSubmissions";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";

export const ApexDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: cooperativesData, isLoading: coopLoading, error } = useCooperatives();
  const { data: stats, isLoading: statsLoading } = useApexStats();

  const cooperatives =
    (cooperativesData as Array<{ id: string; name: string; description?: string }>) ?? [];

  const isLoading = coopLoading || statsLoading;

  if (isLoading) {
    return (
      <AppShell title="Apex Dashboard" subtitle="Your apex overview">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Apex Dashboard" subtitle="Your apex overview">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <AlertCircle className="size-8 mb-2 text-destructive" />
          <p className="font-semibold text-sm">Failed to load dashboard</p>
          <p className="text-xs mt-1">{String(error)}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Apex Dashboard"
      subtitle="Overview of cooperatives and members under your apex"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Building2}
            label="Cooperatives"
            value={String(stats?.total_cooperatives ?? cooperatives.length)}
            subtitle="Under your apex"
            tone="primary"
          />
          <StatCard
            icon={Inbox}
            label="Pending"
            value={String(stats?.pending_submissions ?? 0)}
            subtitle="Awaiting review"
            tone="warning"
          />
          <StatCard
            icon={CheckCircle2}
            label="Approved"
            value={String(stats?.approved_submissions ?? 0)}
            subtitle="Finalized"
            tone="success"
          />
          <StatCard
            icon={XCircle}
            label="Rejected"
            value={String(stats?.rejected_submissions ?? 0)}
            subtitle="Needs correction"
            tone="danger"
          />
        </div>

        <Card title="Cooperatives" subtitle="Manage cooperatives under your apex">
          {cooperatives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Building2 className="size-8 mb-2 text-muted-foreground/50" />
              <p className="font-semibold text-sm text-foreground">No cooperatives yet</p>
              <p className="text-xs mt-1">Go to Cooperatives to register your first one.</p>
              <Link
                to="/app/cooperatives"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Building2 className="size-3.5" /> Manage Cooperatives
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border -mx-5 -mb-5">
              {cooperatives.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                    <Building2 className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.description ?? "—"}</p>
                  </div>
                  <Link
                    to="/app/cooperatives"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                  >
                    Manage <ChevronRight className="size-3" />
                  </Link>
                </div>
              ))}
              {cooperatives.length > 5 && (
                <div className="px-5 py-3">
                  <Link
                    to="/app/cooperatives"
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    View all {cooperatives.length} cooperatives →
                  </Link>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
};
