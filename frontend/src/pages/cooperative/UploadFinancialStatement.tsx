import { useRef, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { useUploadFinancialStatement } from "@/hooks/submissions/useUpload";
import { useExtractionJob } from "@/hooks/submissions/useExtractionJob";
import { useQueryClient } from "@tanstack/react-query";

const ACCEPTED_MIMES = ["application/pdf", "image/png", "image/jpeg", "image/tiff"];

const ACCEPTED_EXT = ".pdf,.png,.jpg,.jpeg,.tiff,.tif";

export const UploadFinancialStatementWidget: React.FC<{
  onClose?: () => void;
  submissionId?: string;
  onExtractionComplete?: () => void;
}> = ({ onClose, submissionId, onExtractionComplete }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);
  const [dragOver, setDragOver] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [extractionFinished, setExtractionFinished] = useState(false);

  const upload = useUploadFinancialStatement(submissionId);
  const { data: job } = useExtractionJob(jobId);

  const isTerminal = job && ["succeeded", "failed", "partial"].includes(job.status);

  const handleFile = (f: File) => {
    if (!ACCEPTED_MIMES.includes(f.type) && !f.name.match(/\.(xlsx?|pdf|png|jpe?g|tiff?)$/i)) {
      toast.error(t("uploadFinancial.toastUnsupportedType"));
      return;
    }
    setFile(f);
    if (f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleSubmit = async () => {
    if (!file) return;
    try {
      const result = await upload.mutateAsync({
        file,
        submissionId,
      });
      setJobId(result.extraction_job_id);
      toast.success(t("uploadFinancial.toastUploadAccepted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("uploadFinancial.toastUploadFailed"));
    }
  };

  // When extraction succeeds, invalidate and notify parent
  useEffect(() => {
    if (isTerminal && job?.status === "succeeded" && !extractionFinished) {
      setExtractionFinished(true);
      void queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
      if (submissionId) {
        void queryClient.invalidateQueries({
          queryKey: ["cooperative-submissions", submissionId],
        });
      }
      if (onExtractionComplete) {
        onExtractionComplete();
      } else if (!submissionId) {
        navigate({ to: "/app/submissions/$id", params: { id: job.submission_id } });
      }
    }
  }, [
    isTerminal,
    job?.status,
    extractionFinished,
    submissionId,
    queryClient,
    onExtractionComplete,
    navigate,
    job?.submission_id,
  ]);

  return (
    <div className="space-y-4">
      {/* Extraction progress */}
      {jobId && job && !isTerminal && (
        <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
          <Loader2 className="size-4 animate-spin text-accent shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              {t("uploadFinancial.extractionRunning")}
              <span className="ml-2 text-xs text-muted-foreground font-normal capitalize">
                {job.status}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {job.confidence
                ? t("uploadFinancial.confidence", { confidence: (job.confidence * 100).toFixed(0) })
                : t("uploadFinancial.parsingDocument")}
            </p>
            <p className="text-xs text-muted-foreground/80 mt-1 font-medium">
              {t("uploadFinancial.processTimeWarning")}
            </p>
          </div>
        </div>
      )}

      {job?.status === "failed" && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <AlertCircle className="size-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            {t("uploadFinancial.extractionFailed", { error: job.error_message ?? "unknown error" })}
          </p>
        </div>
      )}

      {/* File dropzone */}
      {!jobId && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_EXT}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {file ? (
              <div className="flex flex-col items-center justify-center gap-4">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-48 rounded-lg object-contain border border-border shadow-sm"
                  />
                ) : (
                  <FileText className="size-12 text-primary shrink-0" />
                )}
                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <p className="text-sm font-semibold">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreviewUrl(null);
                    }}
                    className="ml-2 rounded-full p-1.5 hover:bg-muted transition-colors"
                  >
                    <X className="size-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Upload className="size-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-semibold">{t("uploadFinancial.dropOrBrowse")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("uploadFinancial.fileSizeHint")}
                </p>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={!file || upload.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {upload.isPending
                ? t("uploadFinancial.uploading")
                : t("uploadFinancial.uploadAndExtract")}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted/50 transition-colors"
              >
                {t("uploadFinancial.cancel")}
              </button>
            )}
          </div>
        </>
      )}

      {/* Success state (extraction queued, waiting for poll) */}
      {jobId && !job && (
        <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 px-4 py-3">
          <CheckCircle2 className="size-4 text-success shrink-0" />
          <p className="text-sm font-semibold">{t("uploadFinancial.acceptedStarting")}</p>
        </div>
      )}
    </div>
  );
};
