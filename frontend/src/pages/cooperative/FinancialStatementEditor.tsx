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
  UploadCloud,
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
import { useDeleteSubmission, useDeleteFinancialStatement } from "@/hooks/submissions/useSubmissions";
import {
  useSubmissionSections,
  useUpdateSubmissionSection,
} from "@/hooks/submissions/useSubmissionSections";
import { ACCOUNT_CODES } from "@/lib/financial-data";

// ── Flat CoA lookup for dropdown ─────────────────────────────────────────────

const COA_OPTIONS: { code: number; name: string; category: string }[] = Object.entries(
  ACCOUNT_CODES,
).flatMap(([category, codes]) =>
  Object.entries(codes as Record<string, number>).map(([key, code]) => ({
    code,
    name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    category: category.toLowerCase(),
  })),
);

const COA_BY_CODE = new Map(COA_OPTIONS.map((o) => [o.code, o]));

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
  const deleteFinancialStatement = useDeleteFinancialStatement();

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

  const handleRemoveFile = async () => {
    if (
      !window.confirm(
        "Remove the uploaded file and extracted data? The draft submission will be kept so you can re-upload a corrected file.",
      )
    )
      return;
    try {
      await deleteFinancialStatement.mutateAsync(submissionId);
      toast.success("File removed — you can now upload a new one");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove file");
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

  return (
    <div className="space-y-4">
      {/* Section status panel */}
      {sections.length > 0 && (
        <Card
          title="Submission Sections"
          subtitle={`${sections.filter((s) => s.status === "ready").length}/${sections.length} sections ready`}
        >
          <div className="space-y-2">
            {sections.map((sec) => (
              <div
                key={sec.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <SectionIcon status={sec.status} />
                  <span className="text-sm font-medium">
                    {SECTION_LABELS[sec.section] ?? sec.section}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill
                    tone={
                      sec.status === "ready"
                        ? "success"
                        : sec.status === "in_progress"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {sec.status === "ready"
                      ? "Ready"
                      : sec.status === "in_progress"
                        ? "In Progress"
                        : "Pending"}
                  </StatusPill>
                  {sec.section === "financial" && sec.status !== "ready" && isDraft && (
                    <button
                      onClick={handleMarkFinancialReady}
                      disabled={updateSection.isPending || hasErrors}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                    >
                      {updateSection.isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3" />
                      )}
                      Mark Ready
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!allReady && isDraft && (
              <p className="text-xs text-muted-foreground pt-1">
                All sections must be ready before submitting to Apex.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Validation flags */}
      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <div className="space-y-2">
          {validationErrors.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3"
            >
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-destructive">{e.rule}</p>
                <p className="text-xs text-muted-foreground">{e.message}</p>
              </div>
            </div>
          ))}
          {validationWarnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3"
            >
              <AlertTriangle className="size-4 text-warning-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-warning-foreground">{w.rule}</p>
                <p className="text-xs text-muted-foreground">{w.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        {isDraft && (
          <button
            onClick={handleValidate}
            disabled={validate.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/50 disabled:opacity-60 transition-colors"
          >
            {validate.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Re-validate
          </button>
        )}
        {isDraft && (
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submit.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {submit.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Submit to Apex
          </button>
        )}
        {isDraft && (
          <button
            onClick={handleRemoveFile}
            disabled={deleteFinancialStatement.isPending}
            title="Remove the uploaded file and extracted data so you can re-upload a corrected version"
            className="inline-flex items-center gap-2 rounded-lg border border-warning/40 px-4 py-2 text-sm font-semibold text-warning-foreground hover:bg-warning/10 disabled:opacity-50 transition-colors"
          >
            {deleteFinancialStatement.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UploadCloud className="size-4" />
            )}
            Re-upload File
          </button>
        )}
        {isDraft && (
          <button
            onClick={handleDelete}
            disabled={deleteSubmission.isPending}
            title="Permanently delete this draft submission and all its data"
            className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
          >
            {deleteSubmission.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Delete Draft
          </button>
        )}
        {hasErrors && isDraft && (
          <p className="text-xs text-destructive">
            Resolve {validationErrors.length} error(s) before submitting
          </p>
        )}
        {!hasErrors && !allReady && sections.length > 0 && isDraft && (
          <p className="text-xs text-muted-foreground">
            <Lock className="size-3 inline mr-1" />
            {sections.filter((s) => s.status !== "ready").length} section(s) not ready
          </p>
        )}
      </div>

      {/* Line items grid */}
      <Card
        title={`Financial Statement — ${fs?.reporting_year ?? ""}`}
        subtitle={`${items.length} items · ${items.filter((i) => !i.account_code).length} unmapped · ${items.filter((i) => (i.ai_confidence ?? 1) < 0.6).length} low confidence`}
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
        ) : (
          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left">
                  <th className="px-4 py-3 w-20">Code</th>
                  <th className="px-4 py-3">Account Name</th>
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
                      {/* Account code — click to assign if unmapped */}
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

                      {/* Category */}
                      <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize hidden md:table-cell">
                        {item.account_category}
                      </td>

                      {/* Source label — what the AI read from the document */}
                      <td className="px-4 py-2.5 text-xs text-muted-foreground italic hidden lg:table-cell">
                        {item.raw_label ? (
                          <span className="max-w-[180px] truncate block" title={item.raw_label}>
                            {item.raw_label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Value — inline editable */}
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
                            className={`inline-flex items-center gap-1 font-mono text-xs transition-colors group ${isDraft ? "hover:text-primary cursor-pointer" : "cursor-default"}`}
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
