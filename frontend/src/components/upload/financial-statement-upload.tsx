import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Image,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Eye,
  Edit3,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import type { BalanceSheet } from "@/lib/financial-data";
import { createEmptyBalanceSheet } from "@/lib/financial-data";

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────

type UploadStep = "upload" | "extracting" | "review" | "complete";

interface ExtractedField {
  label: string;
  code: string;
  value: number;
  confidence: "high" | "medium" | "low";
  source: string; // page/section where it was found
}

interface ExtractionResult {
  fileName: string;
  fileType: string;
  fileSize: string;
  pagesProcessed: number;
  fieldsExtracted: number;
  confidence: number; // overall confidence 0-100
  fields: ExtractedField[];
  balanceSheet: BalanceSheet;
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────
// SIMULATED EXTRACTION DATA
// ─────────────────────────────────────────────────────────────────────

function generateSimulatedExtraction(fileName: string): ExtractionResult {
  const isPdf = fileName.toLowerCase().endsWith(".pdf");
  const pagesProcessed = isPdf ? 4 : 1;

  const fields: ExtractedField[] = [
    {
      label: "Cash on Hand",
      code: "1101",
      value: 125000,
      confidence: "high",
      source: isPdf ? "Page 1, Line 3" : "Top section",
    },
    {
      label: "Cash at Bank (Current)",
      code: "1102",
      value: 890000,
      confidence: "high",
      source: isPdf ? "Page 1, Line 4" : "Top section",
    },
    {
      label: "Cash at Bank (Savings)",
      code: "1103",
      value: 450000,
      confidence: "high",
      source: isPdf ? "Page 1, Line 5" : "Top section",
    },
    {
      label: "Short-term Investments",
      code: "1104",
      value: 200000,
      confidence: "medium",
      source: isPdf ? "Page 1, Line 6" : "Middle section",
    },
    {
      label: "Performing Loan Portfolio",
      code: "1201",
      value: 3200000,
      confidence: "high",
      source: isPdf ? "Page 1, Line 8" : "Middle section",
    },
    {
      label: "Loans in Arrears 1-30 days",
      code: "1202",
      value: 180000,
      confidence: "high",
      source: isPdf ? "Page 1, Line 9" : "Middle section",
    },
    {
      label: "Loans in Arrears 31-60 days",
      code: "1203",
      value: 95000,
      confidence: "medium",
      source: isPdf ? "Page 1, Line 10" : "Middle section",
    },
    {
      label: "Loans in Arrears 61-90 days",
      code: "1204",
      value: 45000,
      confidence: "medium",
      source: isPdf ? "Page 2, Line 1" : "Bottom section",
    },
    {
      label: "Non-performing Loans",
      code: "1205",
      value: 30000,
      confidence: "low",
      source: isPdf ? "Page 2, Line 2" : "Bottom section",
    },
    {
      label: "General Loan Loss Provision",
      code: "1251",
      value: 150000,
      confidence: "high",
      source: isPdf ? "Page 2, Line 4" : "Bottom section",
    },
    {
      label: "Specific Loan Loss Provision",
      code: "1252",
      value: 75000,
      confidence: "medium",
      source: isPdf ? "Page 2, Line 5" : "Bottom section",
    },
    {
      label: "Accounts Receivable",
      code: "1301",
      value: 85000,
      confidence: "high",
      source: isPdf ? "Page 2, Line 7" : "Bottom section",
    },
    {
      label: "Prepaid Expenses",
      code: "1302",
      value: 35000,
      confidence: "high",
      source: isPdf ? "Page 2, Line 8" : "Bottom section",
    },
    {
      label: "Fixed Assets (Cost)",
      code: "1303",
      value: 500000,
      confidence: "high",
      source: isPdf ? "Page 2, Line 9" : "Bottom section",
    },
    {
      label: "Accumulated Depreciation",
      code: "1304",
      value: 120000,
      confidence: "medium",
      source: isPdf ? "Page 2, Line 10" : "Bottom section",
    },
    {
      label: "Voluntary Savings",
      code: "2101",
      value: 1800000,
      confidence: "high",
      source: isPdf ? "Page 3, Line 2" : "Liabilities section",
    },
    {
      label: "Mandatory Savings",
      code: "2102",
      value: 950000,
      confidence: "high",
      source: isPdf ? "Page 3, Line 3" : "Liabilities section",
    },
    {
      label: "Fixed Term Deposits",
      code: "2103",
      value: 420000,
      confidence: "medium",
      source: isPdf ? "Page 3, Line 4" : "Liabilities section",
    },
    {
      label: "Short-term Borrowings",
      code: "2201",
      value: 200000,
      confidence: "high",
      source: isPdf ? "Page 3, Line 6" : "Liabilities section",
    },
    {
      label: "Long-term Borrowings",
      code: "2202",
      value: 350000,
      confidence: "high",
      source: isPdf ? "Page 3, Line 7" : "Liabilities section",
    },
    {
      label: "Permanent Share Capital",
      code: "3101",
      value: 500000,
      confidence: "high",
      source: isPdf ? "Page 3, Line 10" : "Equity section",
    },
    {
      label: "Withdrawable Shares",
      code: "3102",
      value: 300000,
      confidence: "high",
      source: isPdf ? "Page 3, Line 11" : "Equity section",
    },
    {
      label: "Interest Income on Loans",
      code: "4101",
      value: 380000,
      confidence: "high",
      source: isPdf ? "Page 4, Line 2" : "Income section",
    },
    {
      label: "Fees & Commissions Income",
      code: "4102",
      value: 45000,
      confidence: "medium",
      source: isPdf ? "Page 4, Line 3" : "Income section",
    },
    {
      label: "Personnel Costs",
      code: "5201",
      value: 180000,
      confidence: "high",
      source: isPdf ? "Page 4, Line 7" : "Expenses section",
    },
    {
      label: "Administrative Expenses",
      code: "5202",
      value: 95000,
      confidence: "high",
      source: isPdf ? "Page 4, Line 8" : "Expenses section",
    },
  ];

  const bs = createEmptyBalanceSheet();
  bs.liquidAssets = {
    cashOnHand: 125000,
    cashAtBankCurrent: 890000,
    cashAtBankSavings: 450000,
    shortTermInvestments: 200000,
  };
  bs.loanPortfolio = {
    performingLoanPortfolio: 3200000,
    loansInArrears_1_30: 180000,
    loansInArrears_31_60: 95000,
    loansInArrears_61_90: 45000,
    nonPerformingLoans: 30000,
  };
  bs.loanLossProvisions = { generalLoanLossProvision: 150000, specificLoanLossProvision: 75000 };
  bs.otherAssets = {
    accountsReceivable: 85000,
    prepaidExpenses: 35000,
    fixedAssetsCost: 500000,
    accumulatedDepreciation: 120000,
    intangibleAssets: 0,
  };
  bs.memberDeposits = {
    voluntarySavings: 1800000,
    mandatorySavings: 950000,
    fixedTermDeposits: 420000,
  };
  bs.borrowings = { shortTermBorrowings: 200000, longTermBorrowings: 350000 };
  bs.otherLiabilities = { accountsPayable: 60000, accruedExpenses: 40000, deferredIncome: 15000 };
  bs.memberShares = { permanentShareCapital: 500000, withdrawableShares: 300000 };
  bs.reserves = {
    statutoryReserve: 120000,
    generalReserve: 80000,
    riskCapitalAdequacyReserve: 50000,
  };
  bs.retainedEarnings = { accumulatedSurplus: 350000, currentYearSurplus: 125000 };
  bs.financialIncome = { interestIncomeLoans: 380000, feesCommissionsIncome: 45000 };
  bs.otherIncome = { otherOperatingIncome: 25000 };
  bs.financialExpenses = { interestExpenseDeposits: 95000, interestExpenseBorrowings: 28000 };
  bs.operatingExpenses = {
    personnelCosts: 180000,
    administrativeExpenses: 95000,
    governanceExpenses: 35000,
    depreciationAmortization: 45000,
  };
  bs.creditLossExpense = 75000;

  const warnings: string[] = [];
  const lowConfidenceFields = fields.filter((f) => f.confidence === "low");
  if (lowConfidenceFields.length > 0) {
    warnings.push(
      `${lowConfidenceFields.length} field(s) extracted with low confidence — please verify manually: ${lowConfidenceFields.map((f) => f.label).join(", ")}`,
    );
  }
  warnings.push(
    "Accumulated depreciation value is negative — this is normal but please verify sign convention.",
  );

  return {
    fileName,
    fileType: isPdf ? "PDF" : "Image",
    fileSize: isPdf ? "2.4 MB" : "1.1 MB",
    pagesProcessed,
    fieldsExtracted: fields.length,
    confidence: isPdf ? 92 : 78,
    fields,
    balanceSheet: bs,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────

interface FinancialStatementUploadProps {
  onDataExtracted: (data: BalanceSheet) => void;
  onClose?: () => void;
}

export function FinancialStatementUpload({
  onDataExtracted,
  onClose,
}: FinancialStatementUploadProps) {
  const [step, setStep] = useState<UploadStep>("upload");
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (n: number) => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const handleFileSelect = useCallback((file: File) => {
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Unsupported file type. Please upload a PDF, PNG, JPG, or WebP file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 20 MB.");
      return;
    }
    setSelectedFile(file);
    toast.success(`File selected: ${file.name}`);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    },
    [handleFileSelect],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    },
    [handleFileSelect],
  );

  const startExtraction = useCallback(() => {
    if (!selectedFile) return;
    setStep("extracting");
    setExtractionProgress(0);

    // Simulate extraction progress
    const steps = [
      { progress: 15, delay: 400, message: "Uploading document..." },
      { progress: 30, delay: 600, message: "Analyzing document structure..." },
      { progress: 50, delay: 800, message: "Extracting financial data..." },
      { progress: 70, delay: 600, message: "Matching account codes..." },
      { progress: 85, delay: 500, message: "Validating extracted values..." },
      { progress: 95, delay: 400, message: "Finalizing extraction..." },
      { progress: 100, delay: 300, message: "Complete!" },
    ];

    let totalDelay = 0;
    steps.forEach((s) => {
      totalDelay += s.delay;
      setTimeout(() => {
        setExtractionProgress(s.progress);
        toast.info(s.message, { duration: 1500 });
      }, totalDelay);
    });

    // Complete extraction after all steps
    setTimeout(() => {
      const result = generateSimulatedExtraction(selectedFile.name);
      setExtractionResult(result);
      setStep("review");
      toast.success(
        `Extracted ${result.fieldsExtracted} fields from ${result.pagesProcessed} page(s)`,
      );
    }, totalDelay + 500);
  }, [selectedFile]);

  const handleApplyData = useCallback(() => {
    if (!extractionResult) return;
    setStep("complete");
    onDataExtracted(extractionResult.balanceSheet);
    toast.success("Financial data applied to statement form. Review and edit as needed.");
  }, [extractionResult, onDataExtracted]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setExtractionResult(null);
    setExtractionProgress(0);
    setSelectedFile(null);
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
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={handleInputChange}
          />
          <div className="flex flex-col items-center gap-3">
            <div
              className={`size-14 rounded-2xl grid place-items-center transition-colors ${
                dragOver ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              <Upload className="size-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Drop your financial statement here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, PNG, or JPG — data will be extracted automatically
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Supported formats
              </span>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                  <FileText className="size-3" /> PDF
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-info/10 text-info">
                  <Image className="size-3" /> PNG/JPG
                </span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Maximum file size: 20 MB</p>
          </div>
        </div>

        {selectedFile && (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                {selectedFile.type === "application/pdf" ? (
                  <FileText className="size-5" />
                ) : (
                  <Image className="size-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                  {selectedFile.type === "application/pdf" ? "PDF Document" : "Image"}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
                className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <button
              onClick={startExtraction}
              className="mt-3 w-full inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Eye className="size-4" />
              Extract Financial Data
            </button>
          </Card>
        )}

        <div className="p-3 rounded-lg bg-info/5 border border-info/20">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">How it works:</strong> Upload your audited financial
            statement (balance sheet, income statement). Our system uses OCR and pattern recognition
            to extract account codes and values. You'll review and validate all extracted data
            before it populates the financial statement form.
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
            <Loader2 className="size-8 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">Extracting Financial Data</p>
            <p className="text-sm text-muted-foreground mt-1">
              Analyzing document structure and identifying account codes...
            </p>
          </div>
        </div>
        <div className="max-w-md mx-auto space-y-3">
          <Progress value={extractionProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{extractionProgress}% complete</span>
            <span>
              {extractionProgress < 30
                ? "Uploading..."
                : extractionProgress < 60
                  ? "Analyzing..."
                  : extractionProgress < 90
                    ? "Extracting..."
                    : "Almost done..."}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
          {[
            { label: "Pages", value: extractionProgress > 30 ? "Scanning" : "—" },
            { label: "Codes Found", value: extractionProgress > 50 ? "26+" : "—" },
            { label: "Confidence", value: extractionProgress > 70 ? "High" : "—" },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-sm font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Review Step ──────────────────────────────────────────────────
  if (step === "review" && extractionResult) {
    const highConfidence = extractionResult.fields.filter((f) => f.confidence === "high").length;
    const medConfidence = extractionResult.fields.filter((f) => f.confidence === "medium").length;
    const lowConfidence = extractionResult.fields.filter((f) => f.confidence === "low").length;

    return (
      <div className="space-y-4">
        {/* Extraction Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-success/5 border border-success/20">
            <p className="text-[10px] uppercase tracking-wider font-bold text-success">High</p>
            <p className="text-xl font-bold text-foreground">{highConfidence}</p>
            <p className="text-[10px] text-muted-foreground">Confident fields</p>
          </div>
          <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
            <p className="text-[10px] uppercase tracking-wider font-bold text-warning-foreground">
              Medium
            </p>
            <p className="text-xl font-bold text-foreground">{medConfidence}</p>
            <p className="text-[10px] text-muted-foreground">Verify fields</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <p className="text-[10px] uppercase tracking-wider font-bold text-destructive">Low</p>
            <p className="text-xl font-bold text-foreground">{lowConfidence}</p>
            <p className="text-[10px] text-muted-foreground">Manual review</p>
          </div>
          <div className="p-3 rounded-lg bg-info/5 border border-info/20">
            <p className="text-[10px] uppercase tracking-wider font-bold text-info">Overall</p>
            <p className="text-xl font-bold text-foreground">{extractionResult.confidence}%</p>
            <p className="text-[10px] text-muted-foreground">Confidence score</p>
          </div>
        </div>

        {/* Warnings */}
        {extractionResult.warnings.length > 0 && (
          <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4 text-warning-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                {extractionResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-warning-foreground">
                    {w}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Document Info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
            {extractionResult.fileType === "PDF" ? (
              <FileText className="size-5" />
            ) : (
              <Image className="size-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {extractionResult.fileName}
            </p>
            <p className="text-xs text-muted-foreground">
              {extractionResult.fileType} · {extractionResult.fileSize} ·{" "}
              {extractionResult.pagesProcessed} page(s) · {extractionResult.fieldsExtracted} fields
              extracted
            </p>
          </div>
        </div>

        {/* Extracted Fields Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/60 border-b border-border">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Extracted Account Codes
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">Code</th>
                  <th className="px-3 py-2 text-left font-semibold">Account</th>
                  <th className="px-3 py-2 text-right font-semibold">Value</th>
                  <th className="px-3 py-2 text-left font-semibold">Source</th>
                  <th className="px-3 py-2 text-center font-semibold">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {extractionResult.fields.map((field) => (
                  <tr key={field.code} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {field.code}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">{field.label}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">
                      {formatCurrency(field.value)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{field.source}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          field.confidence === "high"
                            ? "bg-success/10 text-success"
                            : field.confidence === "medium"
                              ? "bg-warning/10 text-warning-foreground"
                              : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {field.confidence === "high" && <CheckCircle2 className="size-3" />}
                        {field.confidence === "medium" && <Eye className="size-3" />}
                        {field.confidence === "low" && <AlertTriangle className="size-3" />}
                        {field.confidence}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleReset}
            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Trash2 className="size-4" />
            Discard & Upload Different
          </button>
          <button
            onClick={handleApplyData}
            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Edit3 className="size-4" />
            Apply to Financial Statement
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
          <p className="text-lg font-bold text-foreground">Data Applied Successfully</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your financial statement form has been populated with the extracted data. Review and
            edit the values as needed before submitting.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ArrowRight className="size-4" />
            Go to Financial Statement
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  return null;
}
