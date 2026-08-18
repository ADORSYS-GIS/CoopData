import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useFinancialStatement,
  useLineItems,
  useUpdateLineItems,
  useValidateExtraction,
  useSubmitSubmission,
  type LineItemResponse,
} from "@/hooks/submissions/useFinancialStatement";
import {
  useDeleteSubmission,
  useDeleteFinancialStatement,
} from "@/hooks/submissions/useSubmissions";
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

// ── Flag explanations helper mapping ─────────────────────────────────────────

function getFlagExplanationKey(rule: string, message: string) {
  const text = (rule + " " + message).toUpperCase();
  if (text.includes("TOTAL_MISMATCH") || text.includes("SUM OF")) return "TOTAL_MISMATCH";
  if (text.includes("BALANCE") || text.includes("EQUATION")) return "BALANCE_UNBALANCED";
  if (text.includes("MISSING_ACCOUNT") || text.includes("MISSING")) return "MISSING_DATA";
  if (text.includes("LIQUIDITY_CRISIS") || text.includes("LIQUIDITY CRISIS"))
    return "LIQUIDITY_CRISIS";
  if (text.includes("LOW_LIQUIDITY") || text.includes("10% MINIMUM")) return "LOW_LIQUIDITY";
  if (text.includes("CASH_TOO_LOW") || text.includes("DANGEROUSLY LOW")) return "CASH_TOO_LOW";
  if (text.includes("STATUTORY") || text.includes("STATUTORY")) return "STATUTORY_RESERVE_MISSING";
  if (text.includes("LEVERAGE") || text.includes("DEBT-TO-EQUITY")) return "HIGH_LEVERAGE";
  if (text.includes("LOW_PROFITABILITY") || text.includes("ROA")) return "LOW_PROFITABILITY";
  if (text.includes("NPL") || text.includes("NON-PERFORMING")) return "NPL_HIGH";
  if (text.includes("PROVISION") || text.includes("PROVISION")) return "UNDER_PROVISIONING";
  if (text.includes("EQUITY") || text.includes("EQUITY")) return "LOW_EQUITY";
  return "DEFAULT";
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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const explanationKey = getFlagExplanationKey(rule, message);

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
          title={t("financialStatementEditor.flagRow.howToFixTitle")}
          className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
            open
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Info className="size-3" />
          {t("financialStatementEditor.flagRow.howToFix")}
          {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 mx-4 mb-3 pt-3 space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {t("financialStatementEditor.flagRow.whatThisMeans")}
            </p>
            <p className="text-xs text-foreground">
              {t(`financialStatementEditor.flags.${explanationKey}.what`)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {t("financialStatementEditor.flagRow.howToFixIt")}
            </p>
            <p className="text-xs text-foreground">
              {t(`financialStatementEditor.flags.${explanationKey}.fix`)}
            </p>
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
  const { t } = useTranslation();
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
                {t("financialStatementEditor.validationPanel.errors", { count: errors.length })}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning-foreground px-2.5 py-0.5 ring-1 ring-inset ring-warning/30">
                <AlertTriangle className="size-3" />
                {t("financialStatementEditor.validationPanel.warnings", { count: warnings.length })}
              </span>
            )}
            {infos.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 ring-1 ring-inset ring-border">
                <Info className="size-3" />
                {t("financialStatementEditor.validationPanel.infos", { count: infos.length })}
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
            {t("financialStatementEditor.validationPanel.revalidate")}
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
  isExtracting?: boolean;
}> = ({ fsId, submissionId, isDraft, isCooperative, isExtracting }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: fs } = useFinancialStatement(fsId);
  const { data: items = [], isLoading: itemsLoading } = useLineItems(fsId);
  const updateItems = useUpdateLineItems(fsId);
  const validate = useValidateExtraction();
  const submit = useSubmitSubmission();
  const { data: sections = [] } = useSubmissionSections(submissionId);
  const updateSection = useUpdateSubmissionSection(submissionId);
  const deleteSubmission = useDeleteSubmission();
  const deleteFs = useDeleteFinancialStatement();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDeleteFS = async () => {
    try {
      await deleteFs.mutateAsync(submissionId);
      toast.success(t("financialStatementEditor.toasts.fsDeleted"));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("financialStatementEditor.toasts.fsDeleteFailed"),
      );
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

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
      toast.success(t("financialStatementEditor.toasts.sectionReadySuccess"));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("financialStatementEditor.toasts.sectionUpdateFailed"),
      );
    }
  };

  const saveValue = async (item: LineItemResponse) => {
    const parsed = parseFloat(editValue);
    if (isNaN(parsed)) {
      toast.error(t("financialStatementEditor.toasts.valMustBeNumber"));
      return;
    }
    try {
      await updateItems.mutateAsync({ updates: [{ id: item.id, value: parsed }] });
      setEditingValueId(null);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("financialStatementEditor.toasts.updateFailed"),
      );
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
      toast.error(
        e instanceof Error ? e.message : t("financialStatementEditor.toasts.assignCodeFailed"),
      );
    }
  };

  const handleValidate = async () => {
    try {
      await validate.mutateAsync(submissionId);
      toast.success(t("financialStatementEditor.toasts.valComplete"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("financialStatementEditor.toasts.valFailed"));
    }
  };

  const handleSubmit = async () => {
    try {
      await submit.mutateAsync(submissionId);
      toast.success(t("financialStatementEditor.toasts.submitSuccess"));
      navigate({ to: "/app/submissions" });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("financialStatementEditor.toasts.submitFailed"),
      );
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("financialStatementEditor.deleteDialog.confirmDeleteDraft"))) return;
    try {
      await deleteSubmission.mutateAsync({ id: submissionId, verificationToken: "" });
      toast.success(t("financialStatementEditor.toasts.draftDeleted"));
      navigate({ to: "/app/submissions" });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("financialStatementEditor.toasts.deleteFailed"),
      );
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
    { month: 0, label: t("financialStatementEditor.months.decPrev") },
    { month: 1, label: t("financialStatementEditor.months.jan") },
    { month: 2, label: t("financialStatementEditor.months.feb") },
    { month: 3, label: t("financialStatementEditor.months.mar") },
    { month: 4, label: t("financialStatementEditor.months.apr") },
    { month: 5, label: t("financialStatementEditor.months.may") },
    { month: 6, label: t("financialStatementEditor.months.jun") },
    { month: 7, label: t("financialStatementEditor.months.jul") },
    { month: 8, label: t("financialStatementEditor.months.aug") },
    { month: 9, label: t("financialStatementEditor.months.sep") },
    { month: 10, label: t("financialStatementEditor.months.oct") },
    { month: 11, label: t("financialStatementEditor.months.nov") },
    { month: 12, label: t("financialStatementEditor.months.dec") },
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
        account_code: item.account_code ?? null,
        account_name:
          item.account_code && COA_BY_CODE.get(item.account_code)
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
      {validate.isPending && (
        <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
          <Loader2 className="size-4 animate-spin text-accent shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              {t("financialStatementEditor.aiProgress.title")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("financialStatementEditor.aiProgress.desc")}
            </p>
          </div>
        </div>
      )}

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
        title={t("financialStatementEditor.matrix.title", { year: fs?.reporting_year ?? "" })}
        subtitle={t("financialStatementEditor.matrix.subtitle", {
          total: items.length,
          unmapped: items.filter((i) => !i.account_code).length,
          lowConf: items.filter((i) => (i.ai_confidence ?? 1) < 0.6).length,
        })}
        action={
          <div className="flex items-center gap-3">
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
                  {t("financialStatementEditor.validationPanel.revalidate")}
                </button>

                {isCooperative && (
                  <button
                    onClick={() =>
                      navigate({
                        to: "/app/submissions/$id/manual-entry",
                        params: { id: submissionId },
                        search: { step: "financial" },
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <Edit3 className="size-3.5" />
                    {t("edit")}
                  </button>
                )}

                {isCooperative && (
                  <button
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={deleteFs.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/25 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {deleteFs.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    {t("financialStatementEditor.matrix.deleteStatement")}
                  </button>
                )}

                {financialSection && financialSection.status !== "ready" && (
                  <button
                    onClick={handleMarkFinancialReady}
                    disabled={
                      updateSection.isPending ||
                      hasErrors ||
                      isExtracting ||
                      itemsLoading ||
                      items.length === 0
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    title={
                      isExtracting
                        ? t("financialStatementEditor.matrix.extractingHint")
                        : hasErrors
                          ? t("financialStatementEditor.matrix.resolveErrorsHint")
                          : itemsLoading
                            ? ""
                            : items.length === 0
                              ? t("financialStatementEditor.matrix.enterDataHint")
                              : ""
                    }
                  >
                    {updateSection.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    {t("financialStatementEditor.matrix.markReady")}
                  </button>
                )}

                {financialSection && financialSection.status === "ready" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success">
                    <CheckCircle2 className="size-3.5" />
                    {t("financialStatementEditor.matrix.ready")}
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
            {t("financialStatementEditor.matrix.loading")}
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <p className="text-sm">{t("financialStatementEditor.matrix.empty")}</p>
          </div>
        ) : (
          /* ── 13-Month Matrix Table View ── */
          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left">
                  <th className="px-3 py-3 w-16 sticky left-0 bg-surface z-10 shadow-sm">
                    {t("financialStatementEditor.matrix.code")}
                  </th>
                  <th className="px-4 py-3 min-w-[200px] sticky left-16 bg-surface z-10 shadow-sm border-r border-border">
                    {t("financialStatementEditor.matrix.accountName")}
                  </th>
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
                              placeholder={t("financialStatementEditor.matrix.codePlaceholder")}
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
                                <p className="px-3 py-2 text-xs text-muted-foreground">
                                  {t("financialStatementEditor.matrix.noMatches")}
                                </p>
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
                            title={
                              isUnmapped && isDraft
                                ? t("financialStatementEditor.matrix.assignTooltip")
                                : ""
                            }
                          >
                            {row.account_code ?? "NULL"}
                          </button>
                        )}
                      </td>

                      {/* Account Name */}
                      <td className="px-4 py-2 sticky left-16 bg-surface z-10 shadow-sm border-r border-border font-sans">
                        <p
                          className="font-medium text-foreground text-xs truncate max-w-[220px]"
                          title={coaEntry ? coaEntry.name : row.account_name}
                        >
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
                                    : t("financialStatementEditor.matrix.valuePlaceholder")}
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
        )}
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("financialStatementEditor.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("financialStatementEditor.deleteDialog.desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("financialStatementEditor.deleteDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFS}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("financialStatementEditor.deleteDialog.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
