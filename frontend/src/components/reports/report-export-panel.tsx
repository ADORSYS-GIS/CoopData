import { useState } from "react";
import {
  Download,
  FileText,
  FileSpreadsheet,
  FileBarChart,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/app-shell";
import { useAuth, type Role } from "@/lib/auth";
import { toast } from "sonner";

export type ExportFormat = "pdf" | "xlsx" | "csv";

export type ReportScope =
  | "consolidated"
  | "individual"
  | "comparative"
  | "trend";

interface ReportExportOption {
  id: string;
  label: string;
  description: string;
  scope: ReportScope;
  formats: ExportFormat[];
  availableTo: Role[];
}

const REPORT_EXPORT_OPTIONS: ReportExportOption[] = [
  {
    id: "national-consolidated",
    label: "National Consolidated Report",
    description: "Aggregated data across all federations, apexes, and cooperatives nationwide.",
    scope: "consolidated",
    formats: ["pdf", "xlsx", "csv"],
    availableTo: ["ministry"],
  },
  {
    id: "federation-consolidated",
    label: "Federation Consolidated Report",
    description: "Aggregated data for all apexes and cooperatives under your federation.",
    scope: "consolidated",
    formats: ["pdf", "xlsx", "csv"],
    availableTo: ["ministry", "federation"],
  },
  {
    id: "apex-consolidated",
    label: "Apex Consolidated Report",
    description: "Aggregated data for all cooperatives under your apex organization.",
    scope: "consolidated",
    formats: ["pdf", "xlsx", "csv"],
    availableTo: ["ministry", "federation", "apex"],
  },
  {
    id: "cooperative-individual",
    label: "Cooperative Individual Report",
    description: "Detailed financial statement and database report for a single cooperative.",
    scope: "individual",
    formats: ["pdf", "xlsx"],
    availableTo: ["ministry", "federation", "apex", "cooperative"],
  },
  {
    id: "comparative-analysis",
    label: "Comparative Analysis Report",
    description: "Side-by-side comparison of multiple cooperatives or regions.",
    scope: "comparative",
    formats: ["pdf", "xlsx"],
    availableTo: ["ministry", "federation", "apex"],
  },
  {
    id: "trend-analysis",
    label: "Trend & Growth Report",
    description: "Historical trends, growth patterns, and projections over time.",
    scope: "trend",
    formats: ["pdf", "xlsx"],
    availableTo: ["ministry", "federation", "apex"],
  },
  {
    id: "compliance-audit",
    label: "Compliance & Audit Report",
    description: "Filing rates, late submission flags, and systemic risk indicators.",
    scope: "consolidated",
    formats: ["pdf", "xlsx", "csv"],
    availableTo: ["ministry", "federation", "apex"],
  },
  {
    id: "membership-report",
    label: "Membership Demographics Report",
    description: "Gender participation, youth engagement, and membership statistics.",
    scope: "consolidated",
    formats: ["pdf", "xlsx"],
    availableTo: ["ministry", "federation", "apex", "cooperative"],
  },
];

const SCOPE_LABELS: Record<ReportScope, string> = {
  consolidated: "Consolidated",
  individual: "Individual",
  comparative: "Comparative",
  trend: "Trend",
};

const SCOPE_COLORS: Record<ReportScope, string> = {
  consolidated: "bg-accent/10 text-accent",
  individual: "bg-success/10 text-success",
  comparative: "bg-info/10 text-info",
  trend: "bg-warning/15 text-warning-foreground",
};

const FORMAT_ICONS: Record<ExportFormat, typeof FileText> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  csv: FileBarChart,
};

interface ReportExportPanelProps {
  className?: string;
}

export function ReportExportPanel({ className }: ReportExportPanelProps) {
  const { role } = useAuth();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("pdf");
  const [isExporting, setIsExporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const availableReports = REPORT_EXPORT_OPTIONS.filter((r) =>
    r.availableTo.includes(role),
  );

  const selectedOption = availableReports.find((r) => r.id === selectedReport);

  const handleExport = () => {
    if (!selectedReport || !selectedOption) return;

    setIsExporting(true);
    // Simulate export
    setTimeout(() => {
      setIsExporting(false);
      setIsModalOpen(false);
      toast.success(
        `${selectedOption.label} exported as ${selectedFormat.toUpperCase()} successfully!`,
      );
      setSelectedReport(null);
    }, 1500);
  };

  return (
    <>
      <Card
        title="Export Reports"
        subtitle="Generate and download reports based on your access level"
        className={className}
        action={
          <button
            onClick={() => setIsModalOpen(true)}
            className="press-feedback inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Download className="size-3.5" /> Export Report
          </button>
        }
      >
        <div className="space-y-3">
          {availableReports.map((report) => (
            <div
              key={report.id}
              onClick={() => {
                setSelectedReport(report.id);
                setSelectedFormat(report.formats[0]);
                setIsModalOpen(true);
              }}
              className="group rounded-xl border border-border p-4 hover:border-accent/40 hover:bg-muted/20 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${SCOPE_COLORS[report.scope]}`}
                    >
                      {SCOPE_LABELS[report.scope]}
                    </span>
                    <h4 className="font-heading font-bold text-sm text-foreground truncate">
                      {report.label}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {report.description}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {report.formats.map((fmt) => {
                    const Icon = FORMAT_ICONS[fmt];
                    return (
                      <span
                        key={fmt}
                        className="size-7 rounded-lg bg-muted grid place-items-center text-muted-foreground group-hover:text-accent transition-colors"
                        title={fmt.toUpperCase()}
                      >
                        <Icon className="size-3.5" />
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Export Modal */}
      {isModalOpen && selectedOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => {
              if (!isExporting) setIsModalOpen(false);
            }}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity"
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] animate-panel z-10">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-accent/10 grid place-items-center">
                  <Download className="size-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-foreground">
                    Export Report
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Configure your export settings
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isExporting}
                className="press-feedback rounded-lg p-1 hover:bg-muted text-muted-foreground disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Selected Report */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${SCOPE_COLORS[selectedOption.scope]}`}
                  >
                    {SCOPE_LABELS[selectedOption.scope]}
                  </span>
                  <span className="font-heading font-bold text-sm text-foreground">
                    {selectedOption.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedOption.description}
                </p>
              </div>

              {/* Format Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Export Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {selectedOption.formats.map((fmt) => {
                    const Icon = FORMAT_ICONS[fmt];
                    const isSelected = selectedFormat === fmt;
                    return (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setSelectedFormat(fmt)}
                        disabled={isExporting}
                        className={`press-feedback flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                            : "border-border text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        <Icon className="size-5" />
                        <span className="text-xs font-bold uppercase">
                          {fmt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Range (placeholder) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    defaultValue="2025-01-01"
                    disabled={isExporting}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    defaultValue="2025-12-31"
                    disabled={isExporting}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                  />
                </div>
              </div>

              {/* Scope Info */}
              {role !== "cooperative" && (
                <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-success mt-0.5" />
                  <span>
                    {role === "ministry"
                      ? "This report includes data from all federations, apexes, and cooperatives nationwide."
                      : role === "federation"
                        ? "This report includes data from all apexes and cooperatives under your federation."
                        : "This report includes data from all cooperatives under your apex organization."}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4 mt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isExporting}
                className="press-feedback px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="press-feedback inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Exporting...
                  </>
                ) : (
                  <>
                    <Download className="size-3.5" /> Export{" "}
                    {selectedFormat.toUpperCase()}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}