import { createFileRoute } from "@tanstack/react-router";
import {
  ClipboardList,
  Wifi,
  WifiOff,
  BarChart3,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  ArrowUpRight,
  Database,
  Users,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Eye,
  Settings2,
  Plus,
  CheckSquare,
  Hash,
  DollarSign,
  Type,
  Calendar,
  FileUp,
  GripVertical,
  ToggleRight,
  Zap,
  Clock,
  Send,
} from "lucide-react";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { FinancialStatementUpload } from "@/components/upload/financial-statement-upload";
import { ExcelDatabaseUpload } from "@/components/upload/excel-database-upload";
import type { BalanceSheet } from "@/lib/financial-data";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/data-collection")({
  head: () => ({ meta: [{ title: "Data Collection — CoopData" }] }),
  component: DataCollectionPage,
});

function DataCollectionPage() {
  const { role } = useAuth();
  const isCooperative = role === "cooperative";
  const isReadOnly = false;

  const [showFinancialUpload, setShowFinancialUpload] = useState(false);
  const [extractedFinancialData, setExtractedFinancialData] = useState<BalanceSheet | null>(null);

  const [activeQuestionnaires] = useState([
    {
      name: "Quarterly Financial Filing",
      v: "v4.2",
      submissions: 412,
      status: "Live",
      tone: "success" as const,
      category: "Financial",
    },
    {
      name: "Annual Compliance Disclosure",
      v: "v2.1",
      submissions: 188,
      status: "Live",
      tone: "success" as const,
      category: "Compliance",
    },
    {
      name: "Membership Census 2025",
      v: "v1.0",
      submissions: 1204,
      status: "Live",
      tone: "success" as const,
      category: "Census",
    },
    {
      name: "Loan Portfolio Stress Test",
      v: "v1.3",
      submissions: 84,
      status: "Draft",
      tone: "neutral" as const,
      category: "Financial",
    },
    {
      name: "Field Audit Visit Form",
      v: "v3.0",
      submissions: 642,
      status: "Live",
      tone: "success" as const,
      category: "Audit",
    },
  ]);

  // ── Cooperative View: Upload-first, no manual entry ──
  if (isCooperative) {
    return (
      <AppShell
        title="Data Upload Center"
        subtitle="Upload your financial statement and database sheets — we handle the rest"
      >
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={CheckCircle2}
              label="Databases Ready"
              value="4/5"
              subtitle="Almost complete"
              tone="success"
            />
            <StatCard
              icon={FileSpreadsheet}
              label="Financial Statement"
              value="Extracted"
              subtitle="Data populated"
              tone="primary"
            />
            <StatCard
              icon={Database}
              label="Total Records"
              value="24,810"
              subtitle="Across all databases"
              tone="accent"
            />
            <StatCard
              icon={Clock}
              label="Next Deadline"
              value="Jul 15"
              subtitle="Q4 filing closes"
              tone="warning"
            />
          </div>

          {/* Financial Statement Upload */}
          <Card
            title="Financial Statement"
            subtitle="Upload your audited balance sheet (PDF or image) — data is extracted automatically"
            action={
              showFinancialUpload ? undefined : (
                <button
                  onClick={() => setShowFinancialUpload(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Upload className="size-4" /> Upload Statement
                </button>
              )
            }
          >
            {showFinancialUpload ? (
              <FinancialStatementUpload
                onDataExtracted={(data) => {
                  setExtractedFinancialData(data);
                  toast.success("Financial data extracted! Review your data below.");
                }}
                onClose={() => setShowFinancialUpload(false)}
              />
            ) : extractedFinancialData ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-success/5 border border-success/20">
                <CheckCircle2 className="size-5 text-success shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Financial statement processed
                  </p>
                  <p className="text-xs text-muted-foreground">
                    All account codes and figures have been extracted. Your financial data is ready
                    for submission.
                  </p>
                </div>
                <button
                  onClick={() => setShowFinancialUpload(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <Upload className="size-3.5" /> Upload New
                </button>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="size-14 rounded-2xl bg-accent/10 grid place-items-center mx-auto mb-4">
                  <FileSpreadsheet className="size-7 text-accent" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  Upload your financial statement
                </p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Upload a PDF or image of your audited balance sheet. We'll extract all financial
                  data automatically — no manual entry needed.
                </p>
                <button
                  onClick={() => setShowFinancialUpload(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Upload className="size-4" /> Upload Statement
                </button>
              </div>
            )}
          </Card>

          {/* Excel Database Uploads */}
          <Card
            title="Database Excel Sheets"
            subtitle="Upload Excel/CSV files for each of the 5 cooperative databases"
          >
            <ExcelDatabaseUpload
              onUploadComplete={(dbType, result) => {
                toast.success(`${dbType} database: ${result.validRows} records validated`);
              }}
            />
          </Card>

          {/* Filing Instructions */}
          <Card
            title="Filing Guidelines"
            subtitle="Important information about your data submissions"
          >
            <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                As a cooperative manager, you are required to submit your financial data through the
                upload process above. Simply upload your audited financial statement and Excel
                database sheets — the system will extract and validate all data automatically.
              </p>
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/15">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="size-4 text-accent" />
                  <span className="font-semibold text-foreground">Next Deadline</span>
                </div>
                <p className="text-xs text-foreground/80">
                  Q4 reporting cycle closes on <strong>July 1, 2026</strong>. Avoid penalties by
                  filing before July 15.
                </p>
              </div>
              <ul className="space-y-2">
                {[
                  "Upload your audited financial statement (PDF or image)",
                  "Upload Excel sheets for all 5 databases",
                  "Review extracted data for accuracy",
                  "Submit validated data to your Apex for review",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  // ── Admin / Ministry / Federation / Apex View: Form Builder ──
  return (
    <AppShell
      title="Data Collection Center"
      subtitle="Configure questionnaires · Collect field data · Sync offline"
      actions={
        !isReadOnly ? (
          <button
            onClick={() =>
              toast.success("Simulation: Opened new empty questionnaire draft canvas.")
            }
            className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 hover:bg-primary/90 transition-colors shadow-sm press-feedback"
          >
            <Plus className="size-4" /> New questionnaire
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {isReadOnly && (
          <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 flex items-center gap-3">
            <div className="size-8 rounded-lg bg-warning/20 grid place-items-center shrink-0">
              <AlertTriangle className="size-4 text-warning-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-warning-foreground">Audit Mode Active</p>
              <p className="text-xs text-warning-foreground/70 mt-0.5">
                Form building canvases are locked as read-only. Drag actions disabled.
              </p>
            </div>
          </div>
        )}

        {/* KPI Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Wifi}
            label="Online users"
            value="412"
            subtitle="Active field officers"
            tone="success"
          />
          <StatCard
            icon={WifiOff}
            label="Offline (queued)"
            value="38"
            subtitle="Auto-sync on reconnect"
            tone="warning"
          />
          <StatCard
            icon={ClipboardList}
            label="Active questionnaires"
            value={activeQuestionnaires.length.toString()}
            subtitle="Published forms"
            tone="primary"
          />
          <StatCard
            icon={BarChart3}
            label="Submissions today"
            value="1,284"
            subtitle="Incoming data"
            tone="accent"
          />
        </div>

        {/* Form Builder + Palette */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card
            className="lg:col-span-2"
            title="Form builder — Quarterly Financial Filing"
            subtitle={
              isReadOnly
                ? "Drag actions disabled (View only)"
                : "Drag fields to compose · Conditional logic · No-code"
            }
            action={
              <div className="flex gap-2">
                <button
                  onClick={() => toast.info("Form properties panel opened.")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg border border-border px-2.5 py-1.5 hover:bg-muted transition-colors"
                >
                  <Settings2 className="size-3.5" /> Settings
                </button>
                <button
                  onClick={() => toast.info("Opening form preview modal...")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg border border-border px-2.5 py-1.5 hover:bg-muted transition-colors"
                >
                  <Eye className="size-3.5" /> Preview
                </button>
              </div>
            }
          >
            <FormBuilder isReadOnly={isReadOnly} />
          </Card>

          <Card title="Field palette" subtitle="Drag fields to canvas layout">
            <Palette isReadOnly={isReadOnly} />
            <div className="mt-6 pt-5 border-t border-border">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Zap className="size-3 text-warning-foreground" /> Conditional logic
              </p>
              <ul className="space-y-2.5">
                <li className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Zap className="size-3.5 text-warning-foreground shrink-0" />
                    <span className="text-sm truncate">
                      Show "Loan provisions" if portfolio &gt; $1M
                    </span>
                  </div>
                  <ToggleRight className="size-4 text-success shrink-0" />
                </li>
                <li className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Zap className="size-3.5 text-warning-foreground shrink-0" />
                    <span className="text-sm truncate">
                      Require audit doc if status = "Verified"
                    </span>
                  </div>
                  <ToggleRight className="size-4 text-success shrink-0" />
                </li>
              </ul>
            </div>
          </Card>
        </div>

        {/* Active Templates List */}
        <Card
          title="Active templates"
          subtitle="Currently distributed across the national data grid"
        >
          <ul className="divide-y divide-border -my-2">
            {activeQuestionnaires.map((q) => (
              <li
                key={q.name}
                className="py-3.5 flex items-center gap-4 group hover:bg-muted/20 -mx-5 px-5 transition-colors cursor-pointer"
                onClick={() => toast.info(`Opening configuration console for ${q.name}`)}
              >
                <div
                  className={`size-10 rounded-xl grid place-items-center shrink-0 bg-muted text-muted-foreground`}
                >
                  <ClipboardList className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{q.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {q.v} · {q.submissions.toLocaleString()} submissions · {q.category}
                  </p>
                </div>
                <StatusPill tone={q.tone}>{q.status}</StatusPill>
                <ArrowUpRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}

function FormBuilder({ isReadOnly }: { isReadOnly: boolean }) {
  const fields = [
    { type: "Text", label: "Cooperative registration number", icon: Hash, required: true },
    { type: "Date", label: "Reporting period end", icon: Calendar, required: true },
    { type: "Currency", label: "Total member savings", icon: DollarSign, required: true },
    { type: "Currency", label: "Total loan portfolio", icon: DollarSign, required: true },
    { type: "Number", label: "Active members at period end", icon: Type, required: true },
    { type: "Checkbox", label: "External audit completed?", icon: CheckSquare },
    { type: "File", label: "Audited financial statements", icon: FileUp },
  ];
  return (
    <ol className="space-y-2">
      {fields.map((f, i) => (
        <li
          key={i}
          className="group flex items-center gap-3 rounded-xl border border-border bg-background p-3 hover:border-accent/40 transition-all"
        >
          <GripVertical className="size-4 text-muted-foreground/30 cursor-grab" />
          <div className="size-8 rounded-lg bg-muted text-foreground grid place-items-center">
            <f.icon className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-foreground">{f.label}</p>
            <p className="text-[11px] text-muted-foreground">{f.type} field</p>
          </div>
          {f.required && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
              Required
            </span>
          )}
        </li>
      ))}
      {!isReadOnly && (
        <li>
          <button
            onClick={() => toast.success("Simulation: New custom form field placeholder appended.")}
            className="w-full mt-1 flex items-center justify-center gap-2 text-sm font-semibold rounded-xl border-2 border-dashed border-border p-3 text-muted-foreground hover:border-accent hover:text-accent transition-colors"
          >
            <Plus className="size-4" /> Add field
          </button>
        </li>
      )}
    </ol>
  );
}

function Palette({ isReadOnly }: { isReadOnly: boolean }) {
  const types = [
    { label: "Text", icon: Type },
    { label: "Number", icon: Hash },
    { label: "Currency", icon: DollarSign },
    { label: "Date", icon: Calendar },
    { label: "Checkbox", icon: CheckSquare },
    { label: "File", icon: FileUp },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {types.map((t) => (
        <button
          key={t.label}
          disabled={isReadOnly}
          onClick={() => {
            if (isReadOnly) return;
            toast.success(`Simulation: Dragged new ${t.label} type element onto canvas layout.`);
          }}
          className={`flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium transition-all press-feedback ${
            isReadOnly
              ? "opacity-50 cursor-not-allowed"
              : "hover:border-accent hover:bg-accent/5 hover:shadow-sm"
          }`}
        >
          <t.icon className="size-4 text-accent" /> {t.label}
        </button>
      ))}
    </div>
  );
}
