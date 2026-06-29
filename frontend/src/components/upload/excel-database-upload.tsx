import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Eye,
  Edit3,
  Trash2,
  ArrowRight,
  Users,
  Wallet,
  Database,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────

export type DatabaseType = "membership" | "savings" | "fixed-deposit" | "loans" | "multi-purpose";

interface DatabaseConfig {
  id: DatabaseType;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  columns: string[];
  sampleRows: Record<string, string | number>[];
  validationRules: string[];
}

type UploadStep = "upload" | "extracting" | "review" | "complete";

interface ExtractionResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warnings: string[];
  previewData: Record<string, string | number>[];
}

// ─────────────────────────────────────────────────────────────────────
// DATABASE CONFIGURATIONS
// ─────────────────────────────────────────────────────────────────────

const DATABASE_CONFIGS: DatabaseConfig[] = [
  {
    id: "membership",
    name: "Membership Database",
    icon: Users,
    description: "Member roster with demographics, status, and participation",
    columns: [
      "Member ID",
      "Full Name",
      "Gender",
      "Age Group",
      "Region",
      "Urban/Rural",
      "Join Date",
      "Status",
      "AGM Attendance",
      "Voting Exercised",
    ],
    sampleRows: [
      {
        "Member ID": "M-001",
        "Full Name": "Bongani Hlatshwayo",
        Gender: "Male",
        "Age Group": "36-50",
        Region: "Manzini",
        "Urban/Rural": "Rural",
        "Join Date": "2019-03-15",
        Status: "Active",
        "AGM Attendance": "Yes",
        "Voting Exercised": "Yes",
      },
      {
        "Member ID": "M-002",
        "Full Name": "Thandiwe Dlamini",
        Gender: "Female",
        "Age Group": "18-35",
        Region: "Hhohho",
        "Urban/Rural": "Urban",
        "Join Date": "2020-07-22",
        Status: "Active",
        "AGM Attendance": "Yes",
        "Voting Exercised": "No",
      },
      {
        "Member ID": "M-003",
        "Full Name": "Sibusiso Mkhwanazi",
        Gender: "Male",
        "Age Group": "50+",
        Region: "Lubombo",
        "Urban/Rural": "Rural",
        "Join Date": "2015-01-10",
        Status: "Active",
        "AGM Attendance": "No",
        "Voting Exercised": "No",
      },
    ],
    validationRules: [
      "Member ID must be unique",
      "Gender must be Male, Female, or Other",
      "Age Group must be <18, 18-35, 36-50, or 50+",
      "Status must be Active, Dormant, or Exited",
      "Join Date must be a valid date",
    ],
  },
  {
    id: "savings",
    name: "Savings Database",
    icon: Wallet,
    description: "Savings accounts, balances, and contribution patterns",
    columns: [
      "Savings ID",
      "Member ID",
      "Account Type",
      "Opening Date",
      "Status",
      "Contribution Frequency",
      "Last Contribution",
      "Balance",
      "Balance Trend",
    ],
    sampleRows: [
      {
        "Savings ID": "S-001",
        "Member ID": "M-001",
        "Account Type": "Voluntary",
        "Opening Date": "2019-04-01",
        Status: "Active",
        "Contribution Frequency": "Monthly",
        "Last Contribution": "2026-05-15",
        Balance: 12500,
        "Balance Trend": "Increasing",
      },
      {
        "Savings ID": "S-002",
        "Member ID": "M-002",
        "Account Type": "Mandatory",
        "Opening Date": "2020-08-01",
        Status: "Active",
        "Contribution Frequency": "Monthly",
        "Last Contribution": "2026-05-20",
        Balance: 8200,
        "Balance Trend": "Stable",
      },
      {
        "Savings ID": "S-003",
        "Member ID": "M-003",
        "Account Type": "Fixed",
        "Opening Date": "2022-01-15",
        Status: "Active",
        "Contribution Frequency": "Quarterly",
        "Last Contribution": "2026-04-01",
        Balance: 45000,
        "Balance Trend": "Increasing",
      },
    ],
    validationRules: [
      "Savings ID must be unique",
      "Member ID must reference a valid member",
      "Account Type must be Voluntary, Mandatory, or Fixed",
      "Balance must be a non-negative number",
      "Last Contribution must be a valid date",
    ],
  },
  {
    id: "fixed-deposit",
    name: "Fixed Deposit Database",
    icon: Database,
    description: "Term deposits, maturity dates, and renewal status",
    columns: [
      "FD ID",
      "Member ID",
      "Deposit Type",
      "Start Date",
      "Maturity Date",
      "Status",
      "Tenure Category",
      "Interest Rate",
      "Balance",
      "Rollover Flag",
    ],
    sampleRows: [
      {
        "FD ID": "FD-001",
        "Member ID": "M-001",
        "Deposit Type": "Medium-term",
        "Start Date": "2024-06-01",
        "Maturity Date": "2025-06-01",
        Status: "Active",
        "Tenure Category": "6-12m",
        "Interest Rate": 5.5,
        Balance: 25000,
        "Rollover Flag": "Yes",
      },
      {
        "FD ID": "FD-002",
        "Member ID": "M-002",
        "Deposit Type": "Short-term",
        "Start Date": "2025-01-15",
        "Maturity Date": "2025-04-15",
        Status: "Matured",
        "Tenure Category": "3-6m",
        "Interest Rate": 4.0,
        Balance: 15000,
        "Rollover Flag": "No",
      },
    ],
    validationRules: [
      "FD ID must be unique",
      "Member ID must reference a valid member",
      "Deposit Type must be Short-term, Medium-term, or Long-term",
      "Maturity Date must be after Start Date",
      "Interest Rate must be a positive number",
    ],
  },
  {
    id: "loans",
    name: "Loans Database",
    icon: FileText,
    description: "Loan portfolio, repayment status, and risk indicators",
    columns: [
      "Loan ID",
      "Member ID",
      "Loan Product Type",
      "Start Date",
      "Maturity Date",
      "Status",
      "Loan Amount",
      "Balance",
      "Days Past Due",
      "Repayment Regularity",
    ],
    sampleRows: [
      {
        "Loan ID": "L-001",
        "Member ID": "M-001",
        "Loan Product Type": "Agricultural",
        "Start Date": "2024-01-15",
        "Maturity Date": "2026-01-15",
        Status: "Performing",
        "Loan Amount": 50000,
        Balance: 35000,
        "Days Past Due": 0,
        "Repayment Regularity": "Regular",
      },
      {
        "Loan ID": "L-002",
        "Member ID": "M-003",
        "Loan Product Type": "Emergency",
        "Start Date": "2025-03-01",
        "Maturity Date": "2025-09-01",
        Status: "Arrears",
        "Loan Amount": 8000,
        Balance: 6500,
        "Days Past Due": 45,
        "Repayment Regularity": "Irregular",
      },
    ],
    validationRules: [
      "Loan ID must be unique",
      "Member ID must reference a valid member",
      "Status must be Performing, Arrears, Restructured, or Written Off",
      "Balance must not exceed Loan Amount",
      "Days Past Due must be a non-negative integer",
    ],
  },
  {
    id: "multi-purpose",
    name: "Multi-purpose / Farm",
    icon: Database,
    description: "Agricultural and special-purpose loan programs",
    columns: [
      "Loan ID",
      "Member ID",
      "Program Type",
      "Crop/Activity",
      "Season",
      "Loan Amount",
      "Disbursed Amount",
      "Balance",
      "Status",
      "Repayment Status",
    ],
    sampleRows: [
      {
        "Loan ID": "MP-001",
        "Member ID": "M-001",
        "Program Type": "Farm Input",
        "Crop/Activity": "Maize",
        Season: "2025/26",
        "Loan Amount": 15000,
        "Disbursed Amount": 12000,
        Balance: 10000,
        Status: "Active",
        "Repayment Status": "On Track",
      },
      {
        "Loan ID": "MP-002",
        "Member ID": "M-002",
        "Program Type": "Livestock",
        "Crop/Activity": "Cattle",
        Season: "2025",
        "Loan Amount": 25000,
        "Disbursed Amount": 25000,
        Balance: 22000,
        Status: "Active",
        "Repayment Status": "On Track",
      },
    ],
    validationRules: [
      "Loan ID must be unique",
      "Member ID must reference a valid member",
      "Program Type must be a recognized category",
      "Disbursed Amount must not exceed Loan Amount",
      "Season must be a valid format (e.g., 2025/26)",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────
// SIMULATED EXTRACTION
// ─────────────────────────────────────────────────────────────────────

function generateSimulatedExtraction(config: DatabaseConfig, fileName: string): ExtractionResult {
  const totalRows = Math.floor(Math.random() * 500) + 200;
  const invalidRows = Math.floor(Math.random() * 8) + 1;
  const validRows = totalRows - invalidRows;

  const warnings: string[] = [];
  if (invalidRows > 0) {
    warnings.push(`${invalidRows} row(s) have validation issues and will need manual review.`);
  }
  warnings.push("Column headers have been auto-mapped to standard field names.");
  if (fileName.toLowerCase().includes("old") || fileName.toLowerCase().includes("2024")) {
    warnings.push(
      "File appears to be from a previous reporting period. Please verify data currency.",
    );
  }

  return {
    fileName,
    totalRows,
    validRows,
    invalidRows,
    warnings,
    previewData: config.sampleRows,
  };
}

// ─────────────────────────────────────────────────────────────────────
// INDIVIDUAL DATABASE UPLOADER
// ─────────────────────────────────────────────────────────────────────

function DatabaseUploader({
  config,
  onUploadComplete,
}: {
  config: DatabaseConfig;
  onUploadComplete: (dbType: DatabaseType, result: ExtractionResult) => void;
}) {
  const [step, setStep] = useState<UploadStep>("upload");
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      toast.error("Unsupported file type. Please upload an Excel (.xlsx, .xls) or CSV file.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 50 MB.");
      return;
    }
    setSelectedFile(file);
    toast.success(`File selected: ${file.name}`);
  }, []);

  const startExtraction = useCallback(() => {
    if (!selectedFile) return;
    setStep("extracting");
    setExtractionProgress(0);

    const steps = [
      { progress: 20, delay: 300 },
      { progress: 45, delay: 500 },
      { progress: 70, delay: 600 },
      { progress: 90, delay: 400 },
      { progress: 100, delay: 300 },
    ];

    let totalDelay = 0;
    steps.forEach((s) => {
      totalDelay += s.delay;
      setTimeout(() => setExtractionProgress(s.progress), totalDelay);
    });

    setTimeout(() => {
      const result = generateSimulatedExtraction(config, selectedFile.name);
      setExtractionResult(result);
      setStep("review");
      toast.success(`Extracted ${result.totalRows} rows from ${config.name}`);
    }, totalDelay + 400);
  }, [selectedFile, config]);

  const handleConfirm = useCallback(() => {
    if (!extractionResult) return;
    setStep("complete");
    onUploadComplete(config.id, extractionResult);
    toast.success(
      `${config.name}: ${extractionResult.validRows} valid records ready for submission`,
    );
  }, [extractionResult, config, onUploadComplete]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setExtractionResult(null);
    setExtractionProgress(0);
    setSelectedFile(null);
  }, []);

  const Icon = config.icon;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="size-10 rounded-lg bg-accent/10 text-accent grid place-items-center shrink-0">
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{config.name}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {step === "complete" && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/10 text-success">
              <CheckCircle2 className="size-3" /> Ready
            </span>
          )}
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Upload Step */}
          {step === "upload" && (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 hover:bg-muted/20 transition-all cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                <FileSpreadsheet className="size-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-semibold text-foreground">
                  Drop your {config.name} Excel file here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  .xlsx, .xls, or .csv — up to 50 MB
                </p>
              </div>

              {selectedFile && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                  <FileSpreadsheet className="size-5 text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="size-7 rounded grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}

              <button
                onClick={startExtraction}
                disabled={!selectedFile}
                className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Eye className="size-4" />
                Extract & Validate Data
              </button>

              {/* Validation Rules */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Validation Rules
                </p>
                <ul className="space-y-1">
                  {config.validationRules.map((rule, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3 text-success shrink-0 mt-0.5" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Extracting Step */}
          {step === "extracting" && (
            <div className="py-6 flex flex-col items-center gap-4">
              <Loader2 className="size-8 text-primary animate-spin" />
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">Extracting {config.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Parsing rows and validating data...
                </p>
              </div>
              <div className="w-full max-w-xs space-y-2">
                <Progress value={extractionProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">{extractionProgress}%</p>
              </div>
            </div>
          )}

          {/* Review Step */}
          {step === "review" && extractionResult && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-success/5 border border-success/20 text-center">
                  <p className="text-lg font-bold text-foreground">{extractionResult.validRows}</p>
                  <p className="text-[10px] text-muted-foreground">Valid Rows</p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {extractionResult.invalidRows}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Need Review</p>
                </div>
                <div className="p-3 rounded-lg bg-info/5 border border-info/20 text-center">
                  <p className="text-lg font-bold text-foreground">{extractionResult.totalRows}</p>
                  <p className="text-[10px] text-muted-foreground">Total Rows</p>
                </div>
              </div>

              {/* Warnings */}
              {extractionResult.warnings.length > 0 && (
                <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                  {extractionResult.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-warning-foreground">
                      <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-muted/60 border-b border-border">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Data Preview (first {extractionResult.previewData.length} rows)
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {config.columns.slice(0, 6).map((col) => (
                          <th
                            key={col}
                            className="px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                        {config.columns.length > 6 && (
                          <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">
                            ...
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {extractionResult.previewData.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          {config.columns.slice(0, 6).map((col) => (
                            <td key={col} className="px-2 py-1.5 text-foreground whitespace-nowrap">
                              {String(row[col] ?? "—")}
                            </td>
                          ))}
                          {config.columns.length > 6 && (
                            <td className="px-2 py-1.5 text-muted-foreground">...</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Trash2 className="size-3.5" />
                  Discard
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Edit3 className="size-3.5" />
                  Confirm & Submit
                </button>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === "complete" && extractionResult && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="size-10 text-success" />
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{config.name} Uploaded</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {extractionResult.validRows} valid records ready for submission
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Upload a different file
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────

interface ExcelDatabaseUploadProps {
  onUploadComplete?: (dbType: DatabaseType, result: ExtractionResult) => void;
  onSubmitToApex?: (completedDbs: DatabaseType[]) => void;
}

export function ExcelDatabaseUpload({
  onUploadComplete,
  onSubmitToApex,
}: ExcelDatabaseUploadProps) {
  const [completedDbs, setCompletedDbs] = useState<Set<DatabaseType>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleUploadComplete = useCallback(
    (dbType: DatabaseType, result: ExtractionResult) => {
      setCompletedDbs((prev) => new Set([...prev, dbType]));
      onUploadComplete?.(dbType, result);
    },
    [onUploadComplete],
  );

  const allCompleted = completedDbs.size === DATABASE_CONFIGS.length;

  const handleSubmitToApex = () => {
    setIsSubmitting(true);
    // Simulate submission delay
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      const dbList = Array.from(completedDbs);
      onSubmitToApex?.(dbList);
      toast.success("Submission sent to Apex for review", {
        description: `${completedDbs.size} databases submitted successfully. You will be notified once the review is complete.`,
      });
    }, 1500);
  };

  return (
    <div className="space-y-4">
      {/* Progress Summary */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <Database className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Database Upload Progress</p>
            <p className="text-xs text-muted-foreground">
              {completedDbs.size} of {DATABASE_CONFIGS.length} databases uploaded
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Progress
            value={(completedDbs.size / DATABASE_CONFIGS.length) * 100}
            className="w-24 h-2"
          />
          <span className="text-xs font-bold text-foreground">
            {Math.round((completedDbs.size / DATABASE_CONFIGS.length) * 100)}%
          </span>
        </div>
      </div>

      {/* Database Uploaders */}
      <div className="space-y-3">
        {DATABASE_CONFIGS.map((config) => (
          <DatabaseUploader
            key={config.id}
            config={config}
            onUploadComplete={handleUploadComplete}
          />
        ))}
      </div>

      {/* Submit All */}
      {allCompleted && !isSubmitted && (
        <div className="p-4 rounded-xl bg-success/5 border border-success/20">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-6 text-success shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">
                All Databases Ready for Submission
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                All 5 databases have been uploaded and validated. You can now submit to your Apex
                for review.
              </p>
            </div>
            <button
              onClick={handleSubmitToApex}
              disabled={isSubmitting}
              className="press-feedback inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              {isSubmitting ? "Submitting..." : "Submit to Apex"}
            </button>
          </div>
        </div>
      )}

      {/* Submitted confirmation */}
      {isSubmitted && (
        <div className="p-4 rounded-xl bg-success/5 border border-success/20">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-6 text-success shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Submission Sent to Apex</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your 5 databases have been submitted for review. You will be notified once the Apex
                officer approves or requests changes.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
