import { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload,
  FileText,
  Image,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  Edit3,
  Trash2,
  ArrowRight,
  FileSpreadsheet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { BalanceSheet } from "@/lib/financial-data";
import { Spinner } from "@/components/ui/spinner";
import { useUploadFinancialStatement } from "@/hooks/submissions/useUpload";
import { useExtractionJob } from "@/hooks/submissions/useExtractionJob";
import { useLineItems } from "@/hooks/submissions/useFinancialStatement";
import { lineItemsToBalanceSheet } from "@/lib/line-items-to-balance-sheet";
import type { LineItemResponse } from "@/hooks/submissions/useFinancialStatement";

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────

type UploadStep = "upload" | "extracting" | "review" | "complete";

const ACCEPTED_MIMES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ACCEPTED_EXT = ".pdf,.png,.jpg,.jpeg,.tiff,.tif,.webp,.doc,.docx,.xls,.xlsx";

function isAcceptedFile(f: File): boolean {
  if (ACCEPTED_MIMES.includes(f.type)) return true;
  return /\.(pdf|png|jpe?g|tiff?|webp|docx?|xlsx?)$/i.test(f.name);
}

function fileIcon(f: File) {
  if (f.type === "application/pdf") return "pdf";
  if (f.type.startsWith("image/")) return "image";
  if (f.type.includes("word") || /\.docx?$/i.test(f.name)) return "doc";
  if (f.type.includes("excel") || /\.xlsx?$/i.test(f.name)) return "xls";
  return "file";
}

export const CONFIDENCE_HIGH_THRESHOLD = 0.8;
export const CONFIDENCE_MEDIUM_THRESHOLD = 0.6;

function confidenceLabel(conf: number | null | undefined): "high" | "medium" | "low" {
  if (conf == null) return "low";
  if (conf >= CONFIDENCE_HIGH_THRESHOLD) return "high";
  if (conf >= CONFIDENCE_MEDIUM_THRESHOLD) return "medium";
  return "low";
}

// ─────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────

interface FinancialStatementUploadProps {
  onDataExtracted: (data: BalanceSheet) => void;
  onClose?: () => void;
  submissionId?: string;
}

export function FinancialStatementUpload({
  onDataExtracted,
  onClose,
  submissionId,
}: FinancialStatementUploadProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<UploadStep>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fsId, setFsId] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useUploadFinancialStatement(submissionId);
  const { data: job } = useExtractionJob(jobId);
  const { data: lineItems = [] } = useLineItems(fsId);

  const isTerminal = job && ["succeeded", "failed", "partial"].includes(job.status);

  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  // Drive a fake progress bar while the job is running.
  useEffect(() => {
    if (jobId && job && !isTerminal) {
      setExtractionProgress(0);
      const interval = setInterval(() => {
        setExtractionProgress((p) => Math.min(p + 8, 92));
      }, 600);
      return () => clearInterval(interval);
    }
    if (isTerminal) setExtractionProgress(100);
  }, [jobId, job, isTerminal]);

  // When extraction succeeds, move to review.
  useEffect(() => {
    if (isTerminal && job?.status === "succeeded" && fsId) {
      setStep("review");
      toast.success(
        t("financialStatementUpload.toastExtracted", {
          count: lineItems.length,
          name: files.length,
        }),
      );
    } else if (isTerminal && job?.status === "failed") {
      setStep("upload");
      toast.error(
        t("financialStatementUpload.toastExtractionFailed", {
          error: job.error_message ?? "unknown error",
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTerminal, job?.status, fsId]);

  const handleFiles = useCallback(
    (incoming: FileList | File[]) => {
      const accepted: File[] = [];
      for (const f of Array.from(incoming)) {
        if (!isAcceptedFile(f)) {
          toast.error(t("financialStatementUpload.toastUnsupported", { name: f.name }));
          continue;
        }
        if (f.size > 20 * 1024 * 1024) {
          toast.error(t("financialStatementUpload.toastTooLarge", { name: f.name }));
          continue;
        }
        accepted.push(f);
      }
      if (accepted.length === 0) return;
      const getFileKey = (f: File) => `${f.name}_${f.size}_${f.lastModified}`;
      setFiles((prev) => {
        const seen = new Set(prev.map(getFileKey));
        const merged = [...prev];
        for (const f of accepted) {
          if (!seen.has(getFileKey(f))) merged.push(f);
        }
        return merged;
      });
      const newUrls: Record<string, string> = {};
      for (const f of accepted) {
        if (f.type.startsWith("image/")) {
          newUrls[getFileKey(f)] = URL.createObjectURL(f);
        }
      }
      setPreviewUrls((prev) => ({ ...prev, ...newUrls }));
    },
    [t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
      e.target.value = "";
    },
    [handleFiles],
  );

  const removeFile = (key: string) => {
    setFiles((prev) => prev.filter((f) => f.name + f.size !== key));
    setPreviewUrls((prev) => {
      const next = { ...prev };
      if (next[key]) {
        URL.revokeObjectURL(next[key]);
        delete next[key];
      }
      return next;
    });
  };

  const startExtraction = useCallback(async () => {
    if (files.length === 0) return;
    if (!submissionId) {
      toast.error(t("financialStatementUpload.toastNoSubmission"));
      return;
    }
    setStep("extracting");
    setExtractionProgress(0);
    try {
      const result = await upload.mutateAsync({ files, submissionId });
      setJobId(result.extraction_job_id);
      setFsId(result.financial_statement_id);
    } catch (err) {
      setStep("upload");
      toast.error(err instanceof Error ? err.message : t("financialStatementUpload.toastFailed"));
    }
  }, [files, submissionId, upload, t]);

  const handleApplyData = useCallback(() => {
    if (lineItems.length === 0) {
      toast.error(t("financialStatementUpload.toastNoData"));
      return;
    }
    const bs = lineItemsToBalanceSheet(lineItems as LineItemResponse[]);
    setStep("complete");
    onDataExtracted(bs);
    toast.success(t("financialStatementUpload.toastConfirmed"));
  }, [lineItems, onDataExtracted, t]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setFiles([]);
    setPreviewUrls({});
    setJobId(null);
    setFsId(null);
    setExtractionProgress(0);
  }, []);

  // ─── Upload Step ──────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            dragOver
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXT}
            multiple
            className="hidden"
            onChange={handleInputChange}
          />
          {files.length > 0 ? (
            <div className="flex flex-col items-center gap-3">
              <FileText className="size-10 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                {files.length} {files.length === 1 ? "file" : "files"} selected
              </p>
              <div className="w-full max-w-sm space-y-2 text-left">
                {files.map((f) => {
                  const key = `${f.name}_${f.size}_${f.lastModified}`;
                  const icon = fileIcon(f);
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      {icon === "image" && previewUrls[key] ? (
                        <img
                          src={previewUrls[key]}
                          alt="Preview"
                          className="size-8 rounded object-cover border border-border"
                        />
                      ) : icon === "pdf" ? (
                        <FileText className="size-4 text-destructive shrink-0" />
                      ) : icon === "doc" ? (
                        <FileText className="size-4 text-info shrink-0" />
                      ) : icon === "xls" ? (
                        <FileSpreadsheet className="size-4 text-success shrink-0" />
                      ) : (
                        <Image className="size-4 text-info shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(f.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(key);
                        }}
                        className="size-7 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {t("financialStatementUpload.dropMore", "Drop more files or click to add")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="size-14 rounded-2xl bg-muted text-muted-foreground grid place-items-center">
                <Upload className="size-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t("financialStatementUpload.dropStatement")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("financialStatementUpload.fileSpec")}
                </p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  {t("financialStatementUpload.supportedFormats")}
                </span>
                <div className="flex gap-2 flex-wrap justify-center">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                    <FileText className="size-3" /> PDF
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-info/10 text-info">
                    <Image className="size-3" /> PNG/JPG
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/10 text-warning-foreground">
                    <FileText className="size-3" /> DOC/DOCX
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">
                    <FileSpreadsheet className="size-3" /> XLS/XLSX
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {t("financialStatementUpload.maxSize")}
              </p>
            </div>
          )}
        </div>

        {files.length > 0 && (
          <button
            onClick={startExtraction}
            disabled={upload.isPending}
            className="mt-3 w-full inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {upload.isPending ? <Spinner size="sm" /> : <Eye className="size-4" />}
            {upload.isPending
              ? t("financialStatementUpload.uploading")
              : t("financialStatementUpload.extractFinancialData")}
          </button>
        )}

        <div className="p-3 rounded-lg bg-info/5 border border-info/20">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{t("financialStatementUpload.howItWorks")}</strong>{" "}
            {t("financialStatementUpload.howItWorksDesc")}
          </p>
        </div>
      </div>
    );
  }

  // ─── Extracting Step ──────────────────────────────────────────────
  if (step === "extracting") {
    return (
      <div className="space-y-6 py-8">
        <div className="flex flex-col items-center gap-4">
          <div className="size-16 rounded-2xl bg-primary/10 text-primary grid place-items-center animate-pulse">
            <Spinner size="lg" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">
              {t("financialStatementUpload.extractingTitle")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("financialStatementUpload.extractingDesc")}
            </p>
          </div>
        </div>
        <div className="max-w-md mx-auto space-y-3">
          <Progress value={extractionProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {t("financialStatementUpload.percentComplete", { progress: extractionProgress })}
            </span>
            <span className="capitalize">{job?.status ?? "queued"}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">
              {t("financialStatementUpload.stats.files")}
            </p>
            <p className="text-sm font-bold text-foreground">{files.length}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">
              {t("financialStatementUpload.stats.codesFound")}
            </p>
            <p className="text-sm font-bold text-foreground">
              {lineItems.length > 0 ? lineItems.length : "—"}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">
              {t("financialStatementUpload.stats.confidence")}
            </p>
            <p className="text-sm font-bold text-foreground">
              {job?.confidence != null
                ? `${(job.confidence * 100).toFixed(0)}%`
                : t("financialStatementUpload.stats.scanning")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Review Step ──────────────────────────────────────────────────
  if (step === "review") {
    const highConfidence = lineItems.filter(
      (l) => confidenceLabel(l.ai_confidence) === "high",
    ).length;
    const medConfidence = lineItems.filter(
      (l) => confidenceLabel(l.ai_confidence) === "medium",
    ).length;
    const lowConfidence = lineItems.filter(
      (l) => confidenceLabel(l.ai_confidence) === "low",
    ).length;
    const flagged = lineItems.filter((l) => l.ai_flagged).length;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-success/5 border border-success/20">
            <p className="text-[10px] uppercase tracking-wider font-bold text-success">
              {t("financialStatementUpload.confidenceLevel.high")}
            </p>
            <p className="text-xl font-bold text-foreground">{highConfidence}</p>
          </div>
          <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
            <p className="text-[10px] uppercase tracking-wider font-bold text-warning-foreground">
              {t("financialStatementUpload.confidenceLevel.medium")}
            </p>
            <p className="text-xl font-bold text-foreground">{medConfidence}</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <p className="text-[10px] uppercase tracking-wider font-bold text-destructive">
              {t("financialStatementUpload.confidenceLevel.low")}
            </p>
            <p className="text-xl font-bold text-foreground">{lowConfidence}</p>
          </div>
          <div className="p-3 rounded-lg bg-info/5 border border-info/20">
            <p className="text-[10px] uppercase tracking-wider font-bold text-info">
              {t("financialStatementUpload.flagged")}
            </p>
            <p className="text-xl font-bold text-foreground">{flagged}</p>
          </div>
        </div>

        {flagged > 0 && (
          <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4 text-warning-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-warning-foreground">
                {t("financialStatementUpload.flaggedWarning", {
                  count: flagged,
                  defaultValue: `${flagged} line item(s) were flagged for low confidence or were unmapped — please verify them manually.`,
                })}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          <FileText className="size-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {t("financialStatementUpload.docInfo.summary", {
                type: files.length > 1 ? "Multiple files" : (files[0]?.name ?? "Document"),
                size: files.length,
                pages: lineItems.length,
                fields: lineItems.length,
              })}
            </p>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/60 border-b border-border">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("financialStatementUpload.table.extractedAccountCodes")}
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("financialStatementUpload.table.code")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("financialStatementUpload.table.account")}
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    {t("financialStatementUpload.table.value")}
                  </th>
                  <th className="px-3 py-2 text-center font-semibold">
                    {t("financialStatementUpload.table.confidence")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lineItems.map((item) => {
                  const conf = confidenceLabel(item.ai_confidence);
                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {item.account_code ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">{item.account_name}</td>
                      <td className="px-3 py-2 text-right font-mono text-foreground">
                        {item.value != null ? item.value.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            conf === "high"
                              ? "bg-success/10 text-success"
                              : conf === "medium"
                                ? "bg-warning/10 text-warning-foreground"
                                : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {conf === "high" && <CheckCircle2 className="size-3" />}
                          {conf === "medium" && <Eye className="size-3" />}
                          {conf === "low" && <AlertTriangle className="size-3" />}
                          {t(`financialStatementUpload.confidenceLevel.${conf}`)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleReset}
            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Trash2 className="size-4" />
            {t("financialStatementUpload.actions.discard")}
          </button>
          <button
            onClick={handleApplyData}
            disabled={lineItems.length === 0}
            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
          >
            <Edit3 className="size-4" />
            {t("financialStatementUpload.actions.apply")}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Complete Step ────────────────────────────────────────────────
  if (step === "complete") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="size-16 rounded-2xl bg-success/10 text-success grid place-items-center">
          <CheckCircle2 className="size-8" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">
            {t("financialStatementUpload.success.title")}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("financialStatementUpload.success.desc")}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ArrowRight className="size-4" />
            {t("financialStatementUpload.success.goToStatement")}
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {t("financialStatementUpload.success.uploadAnother")}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
