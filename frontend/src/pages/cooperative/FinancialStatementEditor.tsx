import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Send,
  RefreshCw,
  Edit3,
  Lock,
  CircleDot,
  CircleDashed,
  Trash2,
  Info,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card, StatusPill } from "@/components/app-shell";
import {
  useFinancialStatement,
  useLineItems,
  useUpdateLineItems,
  useValidateExtraction,
  useSubmitSubmission,
  type LineItemResponse,
} from "@/hooks/submissions/useFinancialStatement";
import { useDeleteSubmission } from "@/hooks/submissions/useSubmissions";
import {
  useSubmissionSections,
  useUpdateSubmissionSection,
} from "@/hooks/submissions/useSubmissionSections";
import { useChartOfAccountsLeafs } from "@/hooks/submissions/useFinancialStatement";

// COA_BY_CODE is built dynamically from the live hook inside the component.
// We keep a module-level fallback map seeded from the static constants for
// the account_name display column (used even before the hook resolves).
import { ACCOUNT_CODES } from "@/lib/financial-data";

const STATIC_COA_OPTIONS: { code: number; name: string; category: string }[] = Object.entries(
  ACCOUNT_CODES,
).flatMap(([category, codes]) =>
  Object.entries(codes as Record<string, number>).map(([key, code]) => ({
    code,
    name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    category: category.toLowerCase(),
  })),
);

const STATIC_COA_BY_CODE = new Map(STATIC_COA_OPTIONS.map((o) => [o.code, o]));

// ── Flag explanations (shown in info popover) ─────────────────────────────────

const FLAG_EXPLANATIONS: Record<string, { what: string; fix: string }> = {
  // Balance sheet integrity
  TOTAL_MISMATCH: {
    what: "The sum of the sub-category line items does not add up to the reported total. This usually means some line items were mapped to the wrong account code, or key accounts are missing.",
    fix: "Check each line item in the table. Look for rows with 'Low' confidence — they are likely mapped to the wrong code. Use the account code dropdown to reassign them correctly. After fixing, click Re-validate.",
  },
  BALANCE_UNBALANCED: {
    what: "Total Assets ≠ Total Liabilities + Total Equity. The fundamental accounting equation is broken.",
    fix: "This usually means one or more totals are mapped incorrectly. Verify that code 1999 holds Total Assets, 2999 holds Total Liabilities, and 3999 holds Total Equity. Reassign any misplaced items.",
  },
  MISSING_ACCOUNT: {
    what: "A required account code is missing from the extracted data. The AI could not find or confidently map this field from your document.",
    fix: "Scroll to the 'Unmapped Items' section at the bottom of the table. Find the item that corresponds to this account and use the 'Assign ↑' dropdown to assign the correct code.",
  },
  // Liquidity
  LIQUIDITY_CRISIS: {
    what: "Liquid assets (cash + short-term investments) cover less than 50% of short-term liabilities. This is a critical risk indicator.",
    fix: "Verify that liquid asset codes (1101, 1102, 1103, 1104) and deposit codes (2101, 2102, 2103) are correctly assigned. If the values look right, this is a genuine financial risk requiring management attention.",
  },
  LOW_LIQUIDITY: {
    what: "Liquid assets are below 10% of total assets. Either cash/investments are underreported or the cooperative has very little liquid resources.",
    fix: "Check that all cash accounts (1101, 1102, 1103) and short-term investments (1104) have been correctly identified and mapped. Look for any cash items in the unmapped section.",
  },
  CASH_TOO_LOW: {
    what: "Cash on hand and at bank is below 2% of total assets, which is dangerously low for daily operations.",
    fix: "Verify codes 1101 (Cash on Hand), 1102 (Cash at Bank Current), 1103 (Cash at Bank Savings) are correctly mapped with the right values.",
  },
  // Credit risk
  NPL_HIGH: {
    what: "Non-performing loans exceed 10% of the total loan portfolio. This is above the alert threshold.",
    fix: "Verify codes 1201–1205 are correctly assigned to the right loan quality buckets. If the data is correct, this reflects a real credit risk requiring management action.",
  },
  UNDER_PROVISIONING: {
    what: "The specific loan loss provision (code 1252) covers less than 50% of non-performing loans (code 1205). This may be a regulatory violation.",
    fix: "Check that 1252 (Specific Loan Loss Provision) is mapped and stored as a NEGATIVE number. Also verify 1205 (Non-Performing Loans) is correct.",
  },
  // Capital
  LOW_EQUITY: {
    what: "Equity is below 10% of total assets. The cooperative may be under-capitalised.",
    fix: "Verify that all equity components are mapped: 3101 (Permanent Share Capital), 3102 (Withdrawable Shares), 3201 (Statutory Reserve), 3301 (Accumulated Surplus), 3302 (Current Year Surplus).",
  },
  STATUTORY_RESERVE_MISSING: {
    what: "The statutory reserve (code 3201) is zero or missing. This is legally required for cooperatives.",
    fix: "Check if the uploaded document includes a statutory or legal reserve. If it does, find it in the unmapped items and assign code 3201.",
  },
  HIGH_LEVERAGE: {
    what: "The debt-to-equity ratio exceeds the 2:1 target threshold.",
    fix: "Verify total liabilities (2999) and total equity (3999) are correctly mapped. If the data is accurate, this is a genuine financial concern.",
  },
  // Profitability
  LOW_PROFITABILITY: {
    what: "Return on Assets (ROA) is below 1%. The cooperative is generating very little profit relative to its asset base.",
    fix: "Verify income accounts (4101, 4102, 4201) and expense accounts (5101–5301) are all correctly mapped and that the current year surplus (3302) is present.",
  },
  // Missing data
  MISSING_DATA: {
    what: "A critical field that is required for financial analysis is missing from the extracted data.",
    fix: "Check the unmapped items section at the bottom of the table. The field may have been extracted but not assigned a code. Use the dropdown to assign the correct account code.",
  },
  // Default
  DEFAULT: {
    what: "A data quality or financial health issue was detected.",
    fix: "Review the flagged value, check for misassigned account codes, and click Re-validate after making corrections.",
  },
};

function getFlagExplanation(rule: string) {
  const key = Object.keys(FLAG_EXPLANATIONS).find((k) =>
    rule.toUpperCase().includes(k.replace(/_/g, " ").split(" ")[0]),
  );
  // Try direct prefix matches for known rule patterns
  if (rule.includes("TOTAL_MISMATCH") || rule.includes("sum of"))
    return FLAG_EXPLANATIONS.TOTAL_MISMATCH;
  if (rule.includes("BALANCE") || rule.includes("equation"))
    return FLAG_EXPLANATIONS.BALANCE_UNBALANCED;
  if (rule.includes("MISSING_ACCOUNT") || rule.includes("missing"))
    return FLAG_EXPLANATIONS.MISSING_DATA;
  if (rule.includes("LIQUIDITY_CRISIS") || rule.includes("Liquidity crisis"))
    return FLAG_EXPLANATIONS.LIQUIDITY_CRISIS;
  if (rule.includes("LOW_LIQUIDITY") || rule.includes("10% minimum"))
    return FLAG_EXPLANATIONS.LOW_LIQUIDITY;
  if (rule.includes("CASH_TOO_LOW") || rule.includes("Dangerously low"))
    return FLAG_EXPLANATIONS.CASH_TOO_LOW;
  if (rule.includes("STATUTORY") || rule.includes("statutory"))
    return FLAG_EXPLANATIONS.STATUTORY_RESERVE_MISSING;
  if (rule.includes("LEVERAGE") || rule.includes("Debt-to-Equity"))
    return FLAG_EXPLANATIONS.HIGH_LEVERAGE;
  if (rule.includes("LOW_PROFITABILITY") || rule.includes("ROA"))
    return FLAG_EXPLANATIONS.LOW_PROFITABILITY;
  if (rule.includes("NPL") || rule.includes("Non-performing")) return FLAG_EXPLANATIONS.NPL_HIGH;
  if (rule.includes("PROVISION") || rule.includes("provision"))
    return FLAG_EXPLANATIONS.UNDER_PROVISIONING;
  if (rule.includes("EQUITY") || rule.includes("equity")) return FLAG_EXPLANATIONS.LOW_EQUITY;
  return FLAG_EXPLANATIONS.DEFAULT;
}

// ── Flag row with info popover ────────────────────────────────────────────────

function FlagRow({
  rule,
  message,
  severity,
}: {
  rule: string;
  message: string;
  severity: "error" | "warning" | "info";
}) {
  const [open, setOpen] = useState(false);
  const explanation = getFlagExplanation(rule + " " + message);

  const colorCls =
    severity === "error"
      ? "border-destructive/20 bg-destructive/5"
      : severity === "warning"
        ? "border-warning/20 bg-warning/5"
        : "border-border bg-muted/20";

  const iconCls =
    severity === "error"
      ? "text-destructive"
      : severity === "warning"
        ? "text-warning-foreground"
        : "text-muted-foreground";

  const Icon = severity === "error" ? AlertCircle : severity === "warning" ? AlertTriangle : Info;

  return (
    <div className={`rounded-xl border ${colorCls}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon className={`size-4 ${iconCls} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${iconCls}`}>{rule}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          title="How to fix this"
          className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
            open
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Info className="size-3" />
          How to fix
          {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 mx-4 mb-3 pt-3 space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              What this means
            </p>
            <p className="text-xs text-foreground">{explanation.what}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              How to fix it
            </p>
            <p className="text-xs text-foreground">{explanation.fix}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Validation panel ──────────────────────────────────────────────────────────

function ValidationPanel({
  errors,
  warnings,
  infos,
  onRevalidate,
  isRevalidating,
}: {
  errors: { rule: string; message: string; severity: string }[];
  warnings: { rule: string; message: string; severity: string }[];
  infos: { rule: string; message: string; severity: string }[];
  onRevalidate: () => void;
  isRevalidating: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const total = errors.length + warnings.length + infos.length;
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            {errors.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2.5 py-0.5 ring-1 ring-inset ring-destructive/20">
                <AlertCircle className="size-3" />
                {errors.length} error{errors.length !== 1 ? "s" : ""}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning-foreground px-2.5 py-0.5 ring-1 ring-inset ring-warning/30">
                <AlertTriangle className="size-3" />
                {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
              </span>
            )}
            {infos.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 ring-1 ring-inset ring-border">
                <Info className="size-3" />
                {infos.length} info
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRevalidate}
            disabled={isRevalidating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 disabled:opacity-60 transition-colors"
          >
            {isRevalidating ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Re-validate
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
          {errors.map((e, i) => (
            <FlagRow key={`e-${i}`} rule={e.rule} message={e.message} severity="error" />
          ))}
          {warnings.map((w, i) => (
            <FlagRow key={`w-${i}`} rule={w.rule} message={w.message} severity="warning" />
          ))}
          {infos.map((n, i) => (
            <FlagRow key={`n-${i}`} rule={n.rule} message={n.message} severity="info" />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Section helpers ───────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  financial: "Financial Statement",
  members: "Members",
  savings: "Savings Accounts",
  loans: "Loans",
  fixed_deposits: "Fixed Deposits",
  farm_coop: "Farm Coops",
  indicators: "Non-Financial Indicators",
};

function SectionIcon({ status }: { status: string }) {
  if (status === "ready") return <CheckCircle2 className="size-4 text-success" />;
  if (status === "in_progress") return <CircleDot className="size-4 text-warning-foreground" />;
  return <CircleDashed className="size-4 text-muted-foreground" />;
}

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence === undefined)
    return <span className="text-xs text-muted-foreground">—</span>;
  if (confidence >= 0.8)
    return (
      <span className="inline-block rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
        High {(confidence * 100).toFixed(0)}%
      </span>
    );
  if (confidence >= 0.6)
    return (
      <span className="inline-block rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning-foreground">
        Med {(confidence * 100).toFixed(0)}%
      </span>
    );
  return (
    <span className="inline-block rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
      Low {(confidence * 100).toFixed(0)}%
    </span>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

export const FinancialStatementEditor: React.FC<{
  fsId: string;
  submissionId: string;
  isDraft: boolean;
  isCooperative: boolean;
}> = ({ fsId, submissionId, isDraft, isCooperative }) => {
  const navigate = useNavigate();
  const { data: fs } = useFinancialStatement(fsId);
  const { data: items = [], isLoading: itemsLoading } = useLineItems(fsId);
  const updateItems = useUpdateLineItems(fsId);
  const validate = useValidateExtraction();
  const submit = useSubmitSubmission();
  const { data: sections = [] } = useSubmissionSections(submissionId);
  const updateSection = useUpdateSubmissionSection(submissionId);
  const deleteSubmission = useDeleteSubmission();

  // Live CoA from backend — same data the LLM uses, sorted by display_order
  const { data: liveCoaLeafs = [] } = useChartOfAccountsLeafs();
  // Build a live lookup map; fall back to static map while hook is loading
  const COA_BY_CODE =
    liveCoaLeafs.length > 0
      ? new Map(
          liveCoaLeafs.map((c) => [
            c.account_code,
            { code: c.account_code, name: c.account_name, category: c.account_category },
          ]),
        )
      : STATIC_COA_BY_CODE;
  const COA_OPTIONS =
    liveCoaLeafs.length > 0
      ? liveCoaLeafs.map((c) => ({
          code: c.account_code,
          name: c.account_name,
          category: c.account_category,
        }))
      : STATIC_COA_OPTIONS;

  // View mode: 'matrix' (13-month Balance Sheet view) vs 'list' (flat line items list)
  const [viewMode, setViewMode] = useState<"matrix" | "list">("matrix");

  // Inline value editing
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Inline code editing for unmapped rows
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [codeSearch, setCodeSearch] = useState("");

  const financialSection = sections.find((s) => s.section === "financial");
  const allReady = sections.length > 0 && sections.every((s) => s.status === "ready");

  const validationErrors: { rule: string; message: string; severity: string }[] =
    (fs?.validation_errors as { errors?: typeof validationErrors } | null)?.errors ?? [];
  const validationWarnings: { rule: string; message: string; severity: string }[] =
    (fs?.validation_errors as { warnings?: typeof validationWarnings } | null)?.warnings ?? [];

  const hasErrors = validationErrors.length > 0;
  const canSubmit = !hasErrors && allReady && isDraft;

  const handleMarkFinancialReady = async () => {
    try {
      await updateSection.mutateAsync({ section: "financial", status: "ready" });
      toast.success("Financial section marked as ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update section");
    }
  };

  const saveValue = async (item: LineItemResponse) => {
    const parsed = parseFloat(editValue);
    if (isNaN(parsed)) {
      toast.error("Value must be a number");
      return;
    }
    try {
      await updateItems.mutateAsync({ updates: [{ id: item.id, value: parsed }] });
      setEditingValueId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const assignCode = async (item: LineItemResponse, code: number) => {
    try {
      await updateItems.mutateAsync({
        updates: [{ id: item.id, value: item.value ?? 0, account_code: code }],
      });
      setEditingCodeId(null);
      setCodeSearch("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign code");
    }
  };

  const handleValidate = async () => {
    try {
      await validate.mutateAsync(submissionId);
      toast.success("Validation complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Validation failed");
    }
  };

  const handleSubmit = async () => {
    try {
      await submit.mutateAsync(submissionId);
      toast.success("Submitted to Apex for review");
      navigate({ to: "/app/submissions" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this entire draft submission? This cannot be undone.")) return;
    try {
      await deleteSubmission.mutateAsync(submissionId);
      toast.success("Draft deleted");
      navigate({ to: "/app/submissions" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const filteredCoaOptions = codeSearch
    ? COA_OPTIONS.filter(
        (o) =>
          o.name.toLowerCase().includes(codeSearch.toLowerCase()) ||
          String(o.code).includes(codeSearch),
      ).slice(0, 12)
    : COA_OPTIONS.slice(0, 12);

  // Pivot line items by Account (code or label) for 13-month Monthly Matrix view
  const MONTH_HEADERS = [
    { month: 0, label: "Dec (Prev)" },
    { month: 1, label: "Jan" },
    { month: 2, label: "Feb" },
    { month: 3, label: "Mar" },
    { month: 4, label: "Apr" },
    { month: 5, label: "May" },
    { month: 6, label: "Jun" },
    { month: 7, label: "Jul" },
    { month: 8, label: "Aug" },
    { month: 9, label: "Sep" },
    { month: 10, label: "Oct" },
    { month: 11, label: "Nov" },
    { month: 12, label: "Dec" },
  ];

  interface MatrixRow {
    key: string;
    account_code: number | null;
    account_name: string;
    account_category: string;
    raw_label: string | null;
    sampleItem: LineItemResponse;
    itemsByMonth: Map<number, LineItemResponse>;
  }

  const matrixRowsMap = new Map<string, MatrixRow>();
  items.forEach((item) => {
    const key = item.account_code
      ? `code_${item.account_code}`
      : `label_${(item.raw_label || item.account_name).toLowerCase()}`;
    if (!matrixRowsMap.has(key)) {
      matrixRowsMap.set(key, {
        key,
        account_code: item.account_code,
        account_name: item.account_code && COA_BY_CODE.get(item.account_code)
          ? COA_BY_CODE.get(item.account_code)!.name
          : item.account_name,
        account_category: item.account_category,
        raw_label: item.raw_label ?? null,
        sampleItem: item,
        itemsByMonth: new Map(),
      });
    }
    matrixRowsMap.get(key)!.itemsByMonth.set(item.month, item);
  });

  const matrixRows = Array.from(matrixRowsMap.values());

  return (
    <div className="space-y-4">
      {/* Validation panel */}
      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <ValidationPanel
          errors={validationErrors}
          warnings={validationWarnings}
          infos={[]}
          onRevalidate={handleValidate}
          isRevalidating={validate.isPending}
        />
      )}

      {/* Line items grid */}
      <Card
        title={`Financial Statement — ${fs?.reporting_year ?? ""}`}
        subtitle={`${items.length} items · ${items.filter((i) => !i.account_code).length} unmapped · ${items.filter((i) => (i.ai_confidence ?? 1) < 0.6).length} low confidence`}
        action={
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
              <button
                onClick={() => setViewMode("matrix")}
                className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  viewMode === "matrix"
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly Matrix
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  viewMode === "list"
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                List View ({items.length})
              </button>
            </div>

            {isDraft && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleValidate}
                  disabled={validate.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 disabled:opacity-60 transition-colors"
                >
                  {validate.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Re-validate
                </button>

                {financialSection && financialSection.status !== "ready" && (
                  <button
                    onClick={handleMarkFinancialReady}
                    disabled={updateSection.isPending || hasErrors}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    title={hasErrors ? "Resolve errors before marking ready" : ""}
                  >
                    {updateSection.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    Mark Section Ready
                  </button>
                )}

                {financialSection && financialSection.status === "ready" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success">
                    <CheckCircle2 className="size-3.5" />
                    Section Ready
                  </span>
                )}
              </div>
            )}
          </div>
        }
      >
        {itemsLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" />
            Loading line items…
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <p className="text-sm">No line items extracted yet.</p>
          </div>
        ) : viewMode === "matrix" ? (
          /* ── 13-Month Matrix Table View ── */
          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left">
                  <th className="px-3 py-3 w-16 sticky left-0 bg-surface z-10 shadow-sm">Code</th>
                  <th className="px-4 py-3 min-w-[200px] sticky left-16 bg-surface z-10 shadow-sm border-r border-border">Account Name</th>
                  {MONTH_HEADERS.map((mh) => (
                    <th key={mh.month} className="px-3 py-3 text-right min-w-[90px]">
                      {mh.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {matrixRows.map((row) => {
                  const isUnmapped = !row.account_code;
                  const isEditingCode = editingCodeId === row.sampleItem.id;
                  const coaEntry = row.account_code ? COA_BY_CODE.get(row.account_code) : null;

                  return (
                    <tr
                      key={row.key}
                      className={`transition-colors ${
                        isUnmapped ? "bg-warning/5 hover:bg-warning/10" : "hover:bg-muted/20"
                      }`}
                    >
                      {/* Code column */}
                      <td className="px-3 py-2 sticky left-0 bg-surface z-10 shadow-sm">
                        {isEditingCode ? (
                          <div className="relative">
                            <input
                              autoFocus
                              type="text"
                              placeholder="Code…"
                              value={codeSearch}
                              onChange={(e) => setCodeSearch(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  setEditingCodeId(null);
                                  setCodeSearch("");
                                }
                              }}
                              className="w-20 rounded border border-ring bg-surface px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/20 font-sans"
                            />
                            <div className="absolute left-0 top-7 z-20 w-64 rounded-lg border border-border bg-surface shadow-lg font-sans">
                              {filteredCoaOptions.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
                              ) : (
                                filteredCoaOptions.map((opt) => (
                                  <button
                                    key={opt.code}
                                    onMouseDown={() => assignCode(row.sampleItem, opt.code)}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors"
                                  >
                                    <span className="font-mono text-muted-foreground w-10 shrink-0">
                                      {opt.code}
                                    </span>
                                    <span className="truncate">{opt.name}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => isDraft && setEditingCodeId(row.sampleItem.id)}
                            className={`font-mono text-xs transition-colors ${
                              isUnmapped
                                ? "text-warning-foreground font-bold hover:underline cursor-pointer"
                                : "text-muted-foreground cursor-default"
                            }`}
                            title={isUnmapped && isDraft ? "Click to assign account code" : ""}
                          >
                            {row.account_code ?? "NULL"}
                          </button>
                        )}
                      </td>

                      {/* Account Name */}
                      <td className="px-4 py-2 sticky left-16 bg-surface z-10 shadow-sm border-r border-border font-sans">
                        <p className="font-medium text-foreground text-xs truncate max-w-[220px]" title={coaEntry ? coaEntry.name : row.account_name}>
                          {coaEntry ? coaEntry.name : row.account_name}
                        </p>
                        {row.raw_label && (
                          <p className="text-[10px] text-muted-foreground italic truncate max-w-[220px]">
                            {row.raw_label}
                          </p>
                        )}
                      </td>

                      {/* 13 Monthly Value Columns */}
                      {MONTH_HEADERS.map((mh) => {
                        const monthItem = row.itemsByMonth.get(mh.month);
                        const isEditingValue = monthItem && editingValueId === monthItem.id;

                        return (
                          <td key={mh.month} className="px-3 py-2 text-right">
                            {monthItem ? (
                              isEditingValue ? (
                                <input
                                  autoFocus
                                  type="number"
                                  step="0.01"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveValue(monthItem);
                                    if (e.key === "Escape") setEditingValueId(null);
                                  }}
                                  onBlur={() => saveValue(monthItem)}
                                  className="w-24 rounded border border-ring bg-surface px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-ring/20 font-mono"
                                />
                              ) : (
                                <button
                                  onClick={() => {
                                    if (!isDraft) return;
                                    setEditingValueId(monthItem.id);
                                    setEditValue(String(monthItem.value ?? ""));
                                  }}
                                  className={`inline-flex items-center gap-0.5 font-mono text-xs transition-colors group ${
                                    isDraft ? "hover:text-primary cursor-pointer" : "cursor-default"
                                  }`}
                                >
                                  {monthItem.value !== null && monthItem.value !== undefined
                                    ? monthItem.value.toLocaleString("en-US", {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 2,
                                      })
                                    : "—"}
                                  {isDraft && (
                                    <Edit3 className="size-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                                  )}
                                </button>
                              )
                            ) : (
                              <span className="text-muted-foreground/40 text-[11px]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── Flat List View ── */
          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left">
                  <th className="px-4 py-3 w-20">Code</th>
                  <th className="px-4 py-3">Account Name</th>
                  <th className="px-4 py-3 w-20">Month</th>
                  <th className="px-4 py-3 hidden md:table-cell w-24">Category</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Source Label</th>
                  <th className="px-4 py-3 text-right w-32">Value</th>
                  <th className="px-4 py-3 w-24">Confidence</th>
                  <th className="px-4 py-3 w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const isUnmapped = !item.account_code;
                  const isLowConf = (item.ai_confidence ?? 1) < 0.6;
                  const isEditingValue = editingValueId === item.id;
                  const isEditingCode = editingCodeId === item.id;
                  const coaEntry = item.account_code ? COA_BY_CODE.get(item.account_code) : null;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isUnmapped
                          ? "bg-warning/5 hover:bg-warning/10"
                          : isLowConf
                            ? "bg-destructive/5 hover:bg-destructive/10"
                            : "hover:bg-muted/20"
                      }`}
                    >
                      {/* Account code */}
                      <td className="px-4 py-2.5">
                        {isEditingCode ? (
                          <div className="relative">
                            <input
                              autoFocus
                              type="text"
                              placeholder="Search code…"
                              value={codeSearch}
                              onChange={(e) => setCodeSearch(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  setEditingCodeId(null);
                                  setCodeSearch("");
                                }
                              }}
                              className="w-28 rounded border border-ring bg-surface px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring/20"
                            />
                            <div className="absolute left-0 top-7 z-10 w-64 rounded-lg border border-border bg-surface shadow-lg">
                              {filteredCoaOptions.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-muted-foreground">
                                  No matches
                                </p>
                              ) : (
                                filteredCoaOptions.map((opt) => (
                                  <button
                                    key={opt.code}
                                    onMouseDown={() => assignCode(item, opt.code)}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors"
                                  >
                                    <span className="font-mono text-muted-foreground w-10 shrink-0">
                                      {opt.code}
                                    </span>
                                    <span className="truncate">{opt.name}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => isDraft && setEditingCodeId(item.id)}
                            className={`font-mono text-xs transition-colors ${
                              isUnmapped
                                ? "text-warning-foreground font-bold hover:underline cursor-pointer"
                                : "text-muted-foreground cursor-default"
                            }`}
                            title={isUnmapped && isDraft ? "Click to assign account code" : ""}
                          >
                            {item.account_code ?? "NULL"}
                          </button>
                        )}
                      </td>

                      {/* Account name */}
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground text-xs">
                          {coaEntry ? coaEntry.name : item.account_name}
                        </p>
                      </td>

                      {/* Month column */}
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {item.month === 0 ? "Dec (Prev)" : `Month ${item.month}`}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize hidden md:table-cell">
                        {item.account_category}
                      </td>

                      {/* Source label */}
                      <td className="px-4 py-2.5 text-xs text-muted-foreground italic hidden lg:table-cell">
                        {item.raw_label ? (
                          <span className="max-w-[180px] truncate block" title={item.raw_label}>
                            {item.raw_label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Value */}
                      <td className="px-4 py-2.5 text-right">
                        {isEditingValue ? (
                          <input
                            autoFocus
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveValue(item);
                              if (e.key === "Escape") setEditingValueId(null);
                            }}
                            onBlur={() => saveValue(item)}
                            className="w-28 rounded border border-ring bg-surface px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-ring/20"
                          />
                        ) : (
                          <button
                            onClick={() => {
                              if (!isDraft) return;
                              setEditingValueId(item.id);
                              setEditValue(String(item.value ?? ""));
                            }}
                            className={`inline-flex items-center gap-1 font-mono text-xs transition-colors group ${
                              isDraft ? "hover:text-primary cursor-pointer" : "cursor-default"
                            }`}
                          >
                            {item.value !== null && item.value !== undefined
                              ? item.value.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "—"}
                            {isDraft && (
                              <Edit3 className="size-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                            )}
                          </button>
                        )}
                      </td>

                      {/* Confidence */}
                      <td className="px-4 py-2.5">
                        <ConfidenceBadge confidence={item.ai_confidence ?? null} />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2.5">
                        {item.manually_edited ? (
                          <StatusPill tone="info">Edited</StatusPill>
                        ) : isUnmapped ? (
                          <StatusPill tone="warning">
                            {isDraft ? "Assign ↑" : "Unmapped"}
                          </StatusPill>
                        ) : isLowConf ? (
                          <StatusPill tone="danger">Review</StatusPill>
                        ) : (
                          <StatusPill tone="success">
                            <CheckCircle2 className="size-3 mr-1 inline" />
                            OK
                          </StatusPill>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
