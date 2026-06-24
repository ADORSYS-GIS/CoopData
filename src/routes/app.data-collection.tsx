import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  ClipboardList,
  Wifi,
  WifiOff,
  GripVertical,
  ToggleRight,
  Calendar,
  Hash,
  DollarSign,
  Type,
  CheckSquare,
  FileUp,
  Eye,
  Settings2,
  Zap,
  AlertTriangle,
  Send,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  FileText,
  Users,
  BarChart3,
  Sparkles,
  Grip,
  FileSpreadsheet,
} from "lucide-react";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/data-collection")({
  head: () => ({ meta: [{ title: "Data Collection — CoopData" }] }),
  component: DataCollectionPage,
});

function DataCollectionPage() {
  const { role } = useAuth();
  const isReadOnly = false; // Read-only access can be granted to ministry users via settings
  const isCooperative = role === "cooperative";

  const [activeQuestionnaires, setActiveQuestionnaires] = useState([
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

  const [coopReturn, setCoopReturn] = useState({
    title: "Annual Compliance Disclosure",
    savings: "",
    loans: "",
    comments: "",
  });

  const handleCreateQuestionnaire = () => {
    if (isReadOnly) {
      toast.error("Action denied: Auditor accounts are read-only.");
      return;
    }
    toast.success("Simulation: Opened new empty questionnaire draft canvas.");
  };

  const handleCoopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coopReturn.savings || !coopReturn.loans) {
      toast.error("Please specify savings and loan balances.");
      return;
    }
    toast.success(`${coopReturn.title} submitted successfully to Federation queue!`);
    setCoopReturn({ title: "Annual Compliance Disclosure", savings: "", loans: "", comments: "" });
  };

  return (
    <AppShell
      title="Data Collection Center"
      subtitle={
        isCooperative
          ? "File regulatory returns and statistics declarations"
          : "Configure questionnaires · Collect field data · Sync offline"
      }
      actions={
        !isCooperative && !isReadOnly ? (
          <button
            onClick={handleCreateQuestionnaire}
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

        {/* Cooperative Manager Submission Form */}
        {isCooperative ? (
          <>
            {/* Financial Statement Quick Access */}
            <Card
              title="Financial Statement Entry"
              subtitle="Complete balance sheet and income statement with 41+ account codes"
              edge="accent"
              action={
                <a
                  href="/app/financial-statement"
                  className="press-feedback inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <FileSpreadsheet className="size-4" /> Open Form
                </a>
              }
            >
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Assets</p>
                  <p className="text-lg font-bold text-foreground">16 Fields</p>
                  <p className="text-xs text-muted-foreground">Codes 1000-1999</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Liabilities & Equity</p>
                  <p className="text-lg font-bold text-foreground">15 Fields</p>
                  <p className="text-xs text-muted-foreground">Codes 2000-3999</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Income & Expenses</p>
                  <p className="text-lg font-bold text-foreground">10 Fields</p>
                  <p className="text-xs text-muted-foreground">Codes 4000-5999</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Complete financial statement entry with real-time balance validation. Enter your
                cooperative's audited figures for assets, liabilities, equity, income, and expenses.
              </p>
            </Card>

            <div className="grid lg:grid-cols-3 gap-6">
              <Card
                className="lg:col-span-2"
                title="Quick Filing Template"
                subtitle="Simple return for basic declarations"
                edge="none"
              >
                <form onSubmit={handleCoopSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Filing Template
                    </label>
                    <select
                      value={coopReturn.title}
                      onChange={(e) => setCoopReturn({ ...coopReturn, title: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-shadow"
                    >
                      <option>Annual Compliance Disclosure</option>
                      <option>Quarterly Financial Filing</option>
                      <option>Membership Census 2025</option>
                    </select>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 text-foreground">
                        Total Cooperative Savings (USD)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <input
                          type="number"
                          required
                          value={coopReturn.savings}
                          onChange={(e) =>
                            setCoopReturn({ ...coopReturn, savings: e.target.value })
                          }
                          placeholder="500,000"
                          className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm font-mono outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-shadow"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 text-foreground">
                        Outstanding Loans Portfolio (USD)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <input
                          type="number"
                          required
                          value={coopReturn.loans}
                          onChange={(e) => setCoopReturn({ ...coopReturn, loans: e.target.value })}
                          placeholder="350,000"
                          className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm font-mono outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-shadow"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Explanatory notes / Disclosures
                    </label>
                    <textarea
                      rows={3}
                      value={coopReturn.comments}
                      onChange={(e) => setCoopReturn({ ...coopReturn, comments: e.target.value })}
                      placeholder="Enter any variance declarations or explanatory notes for federation validation..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 resize-none transition-shadow"
                    />
                  </div>

                  <div className="flex flex-wrap justify-between items-center gap-3 pt-1">
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-success" /> Validated locally with schema
                      v2.5
                    </span>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm press-feedback"
                    >
                      <Send className="size-4" /> Submit Report Return
                    </button>
                  </div>
                </form>
              </Card>

              <Card title="Filing Instructions" subtitle="Registry guidelines" edge="info">
                <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
                  <p>
                    As a cooperative manager, you are required under Swaziland Cooperative Societies
                    Act guidelines to declare all financial metrics within 15 days of the reporting
                    cycle close.
                  </p>
                  <div className="p-3.5 rounded-xl bg-accent/5 border border-accent/15">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Clock className="size-4 text-accent" />
                      <span className="font-semibold text-foreground text-sm">Next Deadline</span>
                    </div>
                    <p className="text-xs text-foreground/80">
                      Q4 reporting cycle closes on <strong>July 1, 2026</strong>. Avoid fines by
                      filing before July 15.
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {[
                      "Ensure savings reports match bank reconciliation sheets",
                      "Disclose reserve ratio deposits",
                      "Include external audited balances for the annual census",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[11px]">
                        <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </div>
          </>
        ) : (
          /* Admin / Regional / Auditor view */
          <>
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
                edge="accent"
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

              <Card title="Field palette" subtitle="Drag fields to canvas layout" edge="none">
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
          </>
        )}

        {/* Active Templates List */}
        <Card
          title="Active templates"
          subtitle="Currently distributed across the national data grid"
          edge="none"
        >
          <ul className="divide-y divide-border -my-2">
            {activeQuestionnaires.map((q) => (
              <li
                key={q.name}
                className="py-3.5 flex items-center gap-4 group hover:bg-muted/20 -mx-5 px-5 transition-colors cursor-pointer"
                onClick={() => toast.info(`Opening configuration console for ${q.name}`)}
              >
                <div
                  className={`size-10 rounded-xl grid place-items-center shrink-0 ${
                    q.category === "Financial"
                      ? "bg-accent/10 text-accent"
                      : q.category === "Compliance"
                        ? "bg-success/10 text-success"
                        : q.category === "Census"
                          ? "bg-info/10 text-info"
                          : q.category === "Audit"
                            ? "bg-warning/15 text-warning-foreground"
                            : "bg-muted text-muted-foreground"
                  }`}
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
