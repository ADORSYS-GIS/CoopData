import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { useUploadFinancialStatement } from "@/hooks/submissions/useUpload";
import { useExtractionJob } from "@/hooks/submissions/useExtractionJob";

const ACCEPTED_MIMES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

const ACCEPTED_EXT = ".pdf,.png,.jpg,.jpeg,.tiff,.tif,.xlsx,.xls";

export const UploadFinancialStatementWidget: React.FC<{
  onClose?: () => void;
}> = ({ onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [reportingYear, setReportingYear] = useState(new Date().getFullYear());
  const [currency, setCurrency] = useState("SZL");
  const [jobId, setJobId] = useState<string | null>(null);

  const upload = useUploadFinancialStatement();
  const { data: job } = useExtractionJob(jobId);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const isTerminal = job && ["succeeded", "failed", "partial"].includes(job.status);

  const handleFile = (f: File) => {
    if (!ACCEPTED_MIMES.includes(f.type) && !f.name.match(/\.(xlsx?|pdf|png|jpe?g|tiff?)$/i)) {
      toast.error("Unsupported file type. Accepted: PDF, PNG, JPEG, TIFF, XLSX, XLS");
      return;
    }
    setFile(f);
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
        reportingYear,
        currency,
      });
      setJobId(result.extraction_job_id);
      toast.success("Upload accepted — AI extraction started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  // Navigate to submission detail when extraction done
  if (isTerminal && job?.status === "succeeded") {
    const submissionId = job.submission_id;
    navigate({ to: "/app/submissions/$id", params: { id: submissionId } });
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Extraction progress */}
      {jobId && job && !isTerminal && (
        <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
          <Loader2 className="size-4 animate-spin text-accent shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              Extraction running
              <span className="ml-2 text-xs text-muted-foreground font-normal capitalize">
                {job.status}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {job.confidence
                ? `Confidence: ${(job.confidence * 100).toFixed(0)}%`
                : "Parsing document…"}
            </p>
          </div>
        </div>
      )}

      {job?.status === "failed" && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <AlertCircle className="size-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            Extraction failed: {job.error_message ?? "unknown error"}
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
              <div className="flex items-center justify-center gap-3">
                <FileText className="size-8 text-primary shrink-0" />
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
                  }}
                  className="ml-2 rounded-full p-1 hover:bg-muted transition-colors"
                >
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="size-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-semibold">Drop file or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, PNG, JPEG, TIFF, XLSX — max 20 MB
                </p>
              </>
            )}
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Reporting Year
              </label>
              <select
                value={reportingYear}
                onChange={(e) => setReportingYear(Number(e.target.value))}
                className="w-full rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="SZL">SZL (Swazi Lilangeni)</option>
                <option value="USD">USD</option>
              </select>
            </div>
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
              {upload.isPending ? "Uploading…" : "Upload & Extract"}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}

      {/* Success state (extraction queued, waiting for poll) */}
      {jobId && !job && (
        <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 px-4 py-3">
          <CheckCircle2 className="size-4 text-success shrink-0" />
          <p className="text-sm font-semibold">Upload accepted — starting extraction…</p>
        </div>
      )}
    </div>
  );
};
