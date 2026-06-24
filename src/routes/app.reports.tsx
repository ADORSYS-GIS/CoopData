import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  FileSpreadsheet,
  FileBarChart,
  Download,
  Calendar,
  Mail,
  Plus,
  Clock,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { AppShell, Card } from "@/components/app-shell";
import { REPORTS } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/reports")({
  head: () => ({ meta: [{ title: "Reports — CoopData" }] }),
  component: ReportsPage,
});

const CATEGORIES = [
  {
    tag: "National",
    count: 24,
    edgeCls: "card-edge",
    iconBg: "bg-accent/10 text-accent",
    title: "National Snapshot",
    desc: "Aggregated views across all sectors and regions — federation-level intelligence.",
    icon: TrendingUp,
  },
  {
    tag: "Regional",
    count: 18,
    edgeCls: "card-edge-success",
    iconBg: "bg-success/10 text-success",
    title: "Regional Performance",
    desc: "Per-region deep dives with comparative benchmarks and penetration metrics.",
    icon: FileBarChart,
  },
  {
    tag: "Compliance",
    count: 12,
    edgeCls: "card-edge-warning",
    iconBg: "bg-warning/15 text-warning-foreground",
    title: "Compliance & Audit",
    desc: "Filing rates, late submission flags, and systemic risk indicators by type.",
    icon: FileText,
  },
];

const SCHEDULES = [
  {
    name: "National snapshot — weekly",
    schedule: "Mondays 06:00",
    to: "32 recipients",
    active: true,
  },
  {
    name: "Regional performance — Manzini",
    schedule: "1st of month 08:00",
    to: "12 recipients",
    active: true,
  },
  { name: "Compliance alerts digest", schedule: "Daily 17:00", to: "184 recipients", active: true },
];

const TEMPLATES = [
  "Quarterly Federation Brief",
  "Member Gender Index",
  "Sector Capital Stress Test",
  "Field Officer Activity Log",
];

function ReportsPage() {
  return (
    <AppShell
      title="Reporting Center"
      subtitle="Generate, schedule and distribute intelligence reports across the cooperative ecosystem"
      actions={
        <button
          onClick={() => toast.info("Report builder opened.")}
          className="press-feedback inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-[var(--shadow-elev-2)]"
        >
          <Plus className="size-4" /> New report
        </button>
      }
    >
      <div className="space-y-6">
        {/* Category Cards */}
        <div className="grid lg:grid-cols-3 gap-4">
          {CATEGORIES.map((c) => (
            <div
              key={c.title}
              className={`rounded-xl border border-border bg-surface p-5 hover-lift cursor-pointer ${c.edgeCls}`}
              onClick={() => toast.info(`Opening ${c.title} reports...`)}
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${c.iconBg}`}
                >
                  {c.tag}
                </span>
                <span className="text-xs font-mono text-muted-foreground">{c.count} reports</span>
              </div>
              <div className="flex items-start gap-3">
                <div className={`size-10 rounded-xl grid place-items-center shrink-0 ${c.iconBg}`}>
                  <c.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-bold text-foreground leading-tight">
                    {c.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.desc}</p>
                </div>
              </div>
              <button className="press-feedback mt-4 inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline">
                Browse reports <ChevronRight className="size-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Recent Reports Table */}
        <Card title="Recent Reports" subtitle="Most recently generated and published report files">
          <ul className="divide-y divide-border -my-2">
            {REPORTS.map((r) => {
              const Icon =
                r.format === "PDF"
                  ? FileText
                  : r.format === "XLSX"
                    ? FileSpreadsheet
                    : FileBarChart;
              return (
                <li
                  key={r.id}
                  className="py-3.5 flex items-center gap-4 hover:bg-muted/20 -mx-5 px-5 transition-colors rounded-lg cursor-pointer"
                >
                  <div className="size-10 rounded-xl bg-muted grid place-items-center shrink-0">
                    <Icon className="size-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.category} · {r.format} · {r.size}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5 shrink-0">
                    <Clock className="size-3" /> {r.updated}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.success(`Downloading ${r.title}...`);
                    }}
                    className="press-feedback inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg border border-border px-3 py-1.5 hover:bg-muted transition-colors shrink-0"
                  >
                    <Download className="size-3.5" /> Download
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Scheduled Distributions */}
          <Card
            title="Scheduled Distributions"
            subtitle="Automated report dispatch configuration"
            action={
              <button
                onClick={() => toast.info("New schedule dialog...")}
                className="press-feedback text-xs font-bold text-accent hover:underline"
              >
                + New schedule
              </button>
            }
          >
            <ul className="space-y-3">
              {SCHEDULES.map((s) => (
                <li
                  key={s.name}
                  className="rounded-xl border border-border p-4 flex items-center gap-3 hover:border-accent/30 hover:bg-muted/20 transition-all cursor-pointer"
                >
                  <div className="size-9 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
                    <Calendar className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {s.schedule} · {s.to}
                    </p>
                  </div>
                  <Mail className="size-4 text-muted-foreground shrink-0" />
                </li>
              ))}
            </ul>
          </Card>

          {/* Report Templates */}
          <Card
            title="Templates"
            subtitle="Reusable report definitions and definitions"
            action={
              <button className="press-feedback text-xs font-bold text-accent hover:underline">
                Browse all
              </button>
            }
          >
            <ul className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((t) => (
                <li
                  key={t}
                  onClick={() => toast.info(`Opening template: ${t}`)}
                  className="rounded-xl border border-border p-4 hover:border-accent/40 hover:shadow-[var(--shadow-elev-1)] transition-all cursor-pointer hover:bg-muted/20"
                >
                  <FileBarChart className="size-5 text-accent" />
                  <p className="mt-3 text-sm font-semibold leading-snug text-foreground">{t}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Template · v2.0</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
