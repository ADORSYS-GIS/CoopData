import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowUpRight,
  Clock,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Building2,
  User,
  Calendar,
  Hash,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  MessageSquare,
  Eye,
  Table,
  BarChart3,
  Shield,
  BadgeCheck,
} from "lucide-react";
import { AppShell, Card, StatusPill } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { SUBMISSIONS } from "@/lib/mock-data";
import { useState } from "react";
import { toast } from "sonner";
import { requireAuth } from "@/lib/route-guards";

// ─────────────────────────────────────────────────────────────────────
// MOCK DATA FOR DETAIL VIEW
// ─────────────────────────────────────────────────────────────────────

const FINANCIAL_STATEMENT_DATA = {
  fileName: "Lakeside_Agri_FS_2025_Q3.pdf",
  fileType: "pdf" as const,
  fileSize: "2.4 MB",
  uploadedOn: "2025-10-24 14:22",
  extractedData: {
    balanceSheet: [
      { code: "100", label: "Cash & Bank Balances", amount: 1245000, confidence: 0.97 },
      { code: "110", label: "Short-term Investments", amount: 380000, confidence: 0.94 },
      { code: "120", label: "Accounts Receivable", amount: 560000, confidence: 0.91 },
      { code: "130", label: "Inventories", amount: 245000, confidence: 0.89 },
      { code: "140", label: "Prepaid Expenses", amount: 85000, confidence: 0.96 },
      { code: "200", label: "Property, Plant & Equipment", amount: 2965000, confidence: 0.98 },
      { code: "210", label: "Long-term Investments", amount: 120000, confidence: 0.92 },
      { code: "300", label: "Total Assets", amount: 5475000, confidence: 0.99 },
      { code: "400", label: "Accounts Payable", amount: 485000, confidence: 0.95 },
      { code: "410", label: "Short-term Debt", amount: 620000, confidence: 0.93 },
      { code: "420", label: "Accrued Expenses", amount: 180000, confidence: 0.88 },
      { code: "500", label: "Long-term Debt", amount: 2500000, confidence: 0.97 },
      { code: "600", label: "Total Liabilities", amount: 3785000, confidence: 0.99 },
      { code: "700", label: "Member Equity", amount: 1565000, confidence: 0.96 },
      { code: "710", label: "Retained Earnings", amount: 125000, confidence: 0.94 },
      { code: "800", label: "Total Equity", amount: 1690000, confidence: 0.99 },
    ],
    summary: {
      totalAssets: 5475000,
      totalLiabilities: 3785000,
      totalEquity: 1690000,
      netSurplus: 125000,
      balanceCheck: true,
    },
  },
};

const DATABASE_EXTRACTIONS = [
  {
    id: "db-membership",
    name: "Membership",
    fileName: "Lakeside_Membership_2025.xlsx",
    rowCount: 12402,
    validRows: 12380,
    invalidRows: 22,
    columns: ["Member ID", "Full Name", "Gender", "Age", "Join Date", "Status", "Share Capital"],
    previewRows: [
      {
        "Member ID": "M-001",
        "Full Name": "Thandiwe Dlamini",
        Gender: "Female",
        Age: "34",
        "Join Date": "2019-03-15",
        Status: "Active",
        "Share Capital": "E 2,500",
      },
      {
        "Member ID": "M-002",
        "Full Name": "Sibusiso Mkhwanazi",
        Gender: "Male",
        Age: "41",
        "Join Date": "2018-07-22",
        Status: "Active",
        "Share Capital": "E 5,000",
      },
      {
        "Member ID": "M-003",
        "Full Name": "Nomsa Simelane",
        Gender: "Female",
        Age: "28",
        "Join Date": "2021-01-10",
        Status: "Active",
        "Share Capital": "E 1,500",
      },
    ],
  },
  {
    id: "db-savings",
    name: "Savings",
    fileName: "Lakeside_Savings_2025.xlsx",
    rowCount: 11980,
    validRows: 11950,
    invalidRows: 30,
    columns: [
      "Account No",
      "Member ID",
      "Balance",
      "Interest Rate",
      "Last Transaction",
      "Account Type",
    ],
    previewRows: [
      {
        "Account No": "SAV-001",
        "Member ID": "M-001",
        Balance: "E 12,400",
        "Interest Rate": "4.5%",
        "Last Transaction": "2025-10-20",
        "Account Type": "Regular",
      },
      {
        "Account No": "SAV-002",
        "Member ID": "M-002",
        Balance: "E 28,600",
        "Interest Rate": "4.5%",
        "Last Transaction": "2025-10-18",
        "Account Type": "Premium",
      },
      {
        "Account No": "SAV-003",
        "Member ID": "M-003",
        Balance: "E 3,200",
        "Interest Rate": "3.8%",
        "Last Transaction": "2025-10-22",
        "Account Type": "Regular",
      },
    ],
  },
  {
    id: "db-fixed-deposit",
    name: "Fixed Deposit",
    fileName: "Lakeside_FixedDeposits_2025.xlsx",
    rowCount: 3420,
    validRows: 3410,
    invalidRows: 10,
    columns: ["FD No", "Member ID", "Amount", "Rate", "Maturity Date", "Term"],
    previewRows: [
      {
        "FD No": "FD-001",
        "Member ID": "M-005",
        Amount: "E 50,000",
        Rate: "6.5%",
        "Maturity Date": "2026-06-15",
        Term: "12 months",
      },
      {
        "FD No": "FD-002",
        "Member ID": "M-012",
        Amount: "E 25,000",
        Rate: "5.8%",
        "Maturity Date": "2026-03-20",
        Term: "6 months",
      },
      {
        "FD No": "FD-003",
        "Member ID": "M-045",
        Amount: "E 100,000",
        Rate: "7.0%",
        "Maturity Date": "2027-01-10",
        Term: "24 months",
      },
    ],
  },
  {
    id: "db-loans",
    name: "Loans",
    fileName: "Lakeside_Loans_2025.xlsx",
    rowCount: 8750,
    validRows: 8700,
    invalidRows: 50,
    columns: ["Loan ID", "Member ID", "Principal", "Outstanding", "Rate", "Due Date", "Status"],
    previewRows: [
      {
        "Loan ID": "LN-001",
        "Member ID": "M-003",
        Principal: "E 15,000",
        Outstanding: "E 12,400",
        Rate: "9.5%",
        "Due Date": "2026-04-15",
        Status: "Performing",
      },
      {
        "Loan ID": "LN-002",
        "Member ID": "M-008",
        Principal: "E 8,000",
        Outstanding: "E 6,200",
        Rate: "10.0%",
        "Due Date": "2026-01-30",
        Status: "Performing",
      },
      {
        "Loan ID": "LN-003",
        "Member ID": "M-022",
        Principal: "E 25,000",
        Outstanding: "E 24,100",
        Rate: "8.5%",
        "Due Date": "2027-06-01",
        Status: "Arrears",
      },
    ],
  },
  {
    id: "db-multipurpose",
    name: "Multi-purpose/Farm",
    fileName: "Lakeside_MultiPurpose_2025.xlsx",
    rowCount: 5620,
    validRows: 5590,
    invalidRows: 30,
    columns: ["Project ID", "Member ID", "Type", "Amount", "Purpose", "Status", "Yield"],
    previewRows: [
      {
        "Project ID": "MP-001",
        "Member ID": "M-015",
        Type: "Farm",
        Amount: "E 30,000",
        Purpose: "Crop production",
        Status: "Active",
        Yield: "12%",
      },
      {
        "Project ID": "MP-002",
        "Member ID": "M-034",
        Type: "Multi-purpose",
        Amount: "E 10,000",
        Purpose: "Small retail",
        Status: "Active",
        Yield: "8%",
      },
      {
        "Project ID": "MP-003",
        "Member ID": "M-078",
        Type: "Farm",
        Amount: "E 45,000",
        Purpose: "Livestock",
        Status: "Completed",
        Yield: "15%",
      },
    ],
  },
];

const REVIEW_TRAIL = [
  {
    id: "rt1",
    reviewerName: "M. Dlamini",
    reviewerRole: "Cooperative Manager",
    action: "commented" as const,
    comment: "Submitted Q3 financial audit with all 5 databases and balance sheet.",
    timestamp: "2025-10-24 14:22",
  },
  {
    id: "rt2",
    reviewerName: "Sibusiso Mkhwanazi",
    reviewerRole: "Apex Reviewer",
    action: "approved" as const,
    comment:
      "All financial data verified. Balance sheet balanced. Databases complete with minimal validation errors.",
    timestamp: "2025-10-25 09:15",
  },
  {
    id: "rt3",
    reviewerName: "Sibusiso Mkhwanazi",
    reviewerRole: "Apex Reviewer",
    action: "forwarded" as const,
    comment: "Approved at apex level. Forwarded to federation for final review.",
    timestamp: "2025-10-25 09:16",
  },
];

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

const formatCurrency = (n: number) => {
  if (n >= 1e6) return `E ${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `E ${(n / 1e3).toFixed(0)}K`;
  return `E ${n.toFixed(0)}`;
};

type SubmissionStatus =
  | "Pending Review"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Changes Requested"
  | "Forwarded to Federation"
  | "Forwarded to Ministry";

const statusTone = (status: SubmissionStatus) => {
  switch (status) {
    case "Approved":
    case "Forwarded to Federation":
    case "Forwarded to Ministry":
      return "success" as const;
    case "Pending Review":
    case "Under Review":
      return "warning" as const;
    case "Rejected":
      return "danger" as const;
    case "Changes Requested":
      return "info" as const;
    default:
      return "neutral" as const;
  }
};

const actionIcon = (action: string) => {
  switch (action) {
    case "approved":
      return <CheckCircle2 className="size-4 text-success" />;
    case "rejected":
      return <XCircle className="size-4 text-destructive" />;
    case "changes_requested":
      return <RefreshCw className="size-4 text-info" />;
    case "forwarded":
      return <ArrowUpRight className="size-4 text-accent" />;
    case "commented":
      return <MessageSquare className="size-4 text-muted-foreground" />;
    default:
      return <MessageSquare className="size-4 text-muted-foreground" />;
  }
};

const actionLabel = (action: string) => {
  switch (action) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "changes_requested":
      return "Changes Requested";
    case "forwarded":
      return "Forwarded";
    case "commented":
      return "Commented";
    default:
      return action;
  }
};

const confidenceColor = (c: number) => {
  if (c >= 0.95) return "text-success";
  if (c >= 0.85) return "text-warning-foreground";
  return "text-destructive";
};

const confidenceLabel = (c: number) => {
  if (c >= 0.95) return "High";
  if (c >= 0.85) return "Medium";
  return "Low";
};

// ─────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────

export const SubmissionDetailPage: React.FC = () => {
  const { id } = useParams({ from: "/app/submissions_/$id" });
  const { role } = useAuth();
  const [comment, setComment] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    financials: true,
    membership: true,
    savings: true,
    fixedDeposit: true,
    loans: true,
    multipurpose: true,
    trail: true,
  });

  // Find submission from mock data
  const submission = SUBMISSIONS.find((s) => s.id === id);

  // Map mock status to detail status
  const statusMap: Record<string, SubmissionStatus> = {
    "Pending Review": "Forwarded to Federation",
    Verified: "Approved",
    Rejected: "Rejected",
    Resubmit: "Changes Requested",
  };
  const currentStatus = submission
    ? statusMap[submission.status] || "Pending Review"
    : "Pending Review";

  const canReview =
    (role === "apex" &&
      (currentStatus === "Pending Review" || currentStatus === "Changes Requested")) ||
    (role === "federation" &&
      (currentStatus === "Forwarded to Federation" || currentStatus === "Pending Review")) ||
    role === "ministry";

  const canForward =
    role === "apex" &&
    (currentStatus === "Pending Review" || currentStatus === "Changes Requested");
  const isCooperative = role === "cooperative";

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!submission) {
    return (
      <AppShell
        title="Submission Not Found"
        subtitle="The requested submission could not be located"
      >
        <div className="flex flex-col items-center justify-center py-20">
          <FileText className="size-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-bold text-foreground">Submission Not Found</h2>
          <p className="text-sm text-muted-foreground mt-2">No submission exists with ID "{id}"</p>
          <Link
            to="/app/submissions"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="size-4" /> Back to Submissions
          </Link>
        </div>
      </AppShell>
    );
  }

  const titleByRole: Record<string, string> = {
    ministry: "National Submission Review",
    federation: "Federation Submission Review",
    apex: "Apex Submission Review",
    cooperative: "My Submission Detail",
  };

  return (
    <AppShell
      title={titleByRole[role] || "Submission Detail"}
      subtitle={`${submission.coopName} · ${submission.type}`}
    >
      <div className="space-y-6">
        {/* Back Navigation */}
        <Link
          to="/app/submissions"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to Submissions
        </Link>

        {/* ─── STATUS HEADER ─── */}
        <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-elev-1)]">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
                  {submission.reference}
                </span>
                <StatusPill tone={statusTone(currentStatus)}>{currentStatus}</StatusPill>
              </div>
              <h2 className="text-xl font-heading font-bold text-foreground">
                {submission.coopName}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {submission.type} · Filed {submission.submittedOn}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {submission.priority === "Urgent" && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="size-3" /> Urgent
                </span>
              )}
              <button
                onClick={() => toast.success("Downloading submission package...")}
                className="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors"
              >
                <Download className="size-3.5" /> Export Package
              </button>
            </div>
          </div>

          {/* Details Grid */}
          <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Cooperative
                </p>
                <p className="text-sm font-semibold text-foreground">{submission.coopName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Filed By
                </p>
                <p className="text-sm font-semibold text-foreground">{submission.submittedBy}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Date
                </p>
                <p className="text-sm font-semibold text-foreground">{submission.submittedOn}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Reference
                </p>
                <p className="text-sm font-mono font-semibold text-foreground">
                  {submission.reference}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── FINANCIAL STATEMENT ─── */}
        <Card
          title="Financial Statement"
          subtitle="Uploaded document and extracted balance sheet data"
          action={
            <button
              onClick={() => toggleSection("financials")}
              className="press-feedback text-xs font-bold text-accent hover:underline flex items-center gap-1"
            >
              {expandedSections.financials ? "Collapse" : "Expand"}
              {expandedSections.financials ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </button>
          }
        >
          {expandedSections.financials && (
            <div className="space-y-5">
              {/* Uploaded File */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center gap-4">
                <div className="size-12 rounded-xl bg-destructive/10 grid place-items-center shrink-0">
                  <FileText className="size-6 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {FINANCIAL_STATEMENT_DATA.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {FINANCIAL_STATEMENT_DATA.fileSize} · Uploaded{" "}
                    {FINANCIAL_STATEMENT_DATA.uploadedOn}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toast.info("Opening document preview...")}
                    className="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors"
                  >
                    <Eye className="size-3.5" /> Preview
                  </button>
                  <button
                    onClick={() => toast.success("Downloading financial statement...")}
                    className="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors"
                  >
                    <Download className="size-3.5" /> Download
                  </button>
                </div>
              </div>

              {/* Extracted Balance Sheet */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Table className="size-4 text-accent" />
                    Extracted Balance Sheet
                  </h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {FINANCIAL_STATEMENT_DATA.extractedData.balanceSheet.length} line items
                  </span>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Code
                        </th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Account
                        </th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Amount
                        </th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Confidence
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {FINANCIAL_STATEMENT_DATA.extractedData.balanceSheet.map((row) => {
                        const isTotal =
                          row.code === "300" || row.code === "600" || row.code === "800";
                        const isSectionHeader =
                          row.code === "200" || row.code === "400" || row.code === "700";
                        return (
                          <tr
                            key={row.code}
                            className={`${isTotal ? "bg-accent/5 font-bold" : isSectionHeader ? "bg-muted/20" : "hover:bg-muted/10"} transition-colors`}
                          >
                            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                              {row.code}
                            </td>
                            <td className={`px-4 py-2.5 ${isTotal ? "text-foreground" : ""}`}>
                              {row.label}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-mono ${isTotal ? "text-accent" : ""}`}
                            >
                              {formatCurrency(row.amount)}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-bold ${confidenceColor(row.confidence)}`}
                              >
                                {Math.round(row.confidence * 100)}%
                                <span className={`text-[10px] ${confidenceColor(row.confidence)}`}>
                                  ({confidenceLabel(row.confidence)})
                                </span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                  <div className="p-3 rounded-lg bg-surface border border-border">
                    <p className="text-[10px] text-muted-foreground">Total Assets</p>
                    <p className="text-sm font-bold text-foreground">
                      {formatCurrency(FINANCIAL_STATEMENT_DATA.extractedData.summary.totalAssets)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-border">
                    <p className="text-[10px] text-muted-foreground">Liabilities</p>
                    <p className="text-sm font-bold text-foreground">
                      {formatCurrency(
                        FINANCIAL_STATEMENT_DATA.extractedData.summary.totalLiabilities,
                      )}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-border">
                    <p className="text-[10px] text-muted-foreground">Equity</p>
                    <p className="text-sm font-bold text-foreground">
                      {formatCurrency(FINANCIAL_STATEMENT_DATA.extractedData.summary.totalEquity)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-border">
                    <p className="text-[10px] text-muted-foreground">Net Surplus</p>
                    <p className="text-sm font-bold text-success">
                      +{formatCurrency(FINANCIAL_STATEMENT_DATA.extractedData.summary.netSurplus)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-border">
                    <p className="text-[10px] text-muted-foreground">Balance Check</p>
                    <p className="text-sm font-bold text-success flex items-center gap-1">
                      <BadgeCheck className="size-3.5" /> Balanced
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* ─── DATABASE EXTRACTIONS ─── */}
        <div className="space-y-4">
          <h3 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-accent" />
            Database Extractions
            <span className="text-xs font-normal text-muted-foreground">
              ({DATABASE_EXTRACTIONS.length} databases uploaded)
            </span>
          </h3>

          {DATABASE_EXTRACTIONS.map((db) => {
            const sectionKey = db.id.replace("db-", "");
            const isExpanded = expandedSections[sectionKey];
            const validPct = Math.round((db.validRows / db.rowCount) * 100);
            const hasIssues = db.invalidRows > 0;

            return (
              <Card
                key={db.id}
                title={db.name}
                subtitle={`${db.fileName} · ${db.rowCount.toLocaleString()} rows`}
                action={
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold ${validPct >= 99 ? "text-success" : validPct >= 95 ? "text-warning-foreground" : "text-destructive"}`}
                    >
                      {validPct}% valid
                    </span>
                    <button
                      onClick={() => toggleSection(sectionKey)}
                      className="press-feedback text-xs font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      {isExpanded ? "Collapse" : "Expand"}
                      {isExpanded ? (
                        <ChevronUp className="size-3" />
                      ) : (
                        <ChevronDown className="size-3" />
                      )}
                    </button>
                  </div>
                }
              >
                {isExpanded && (
                  <div className="space-y-4">
                    {/* Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-surface border border-border">
                        <p className="text-[10px] text-muted-foreground">Total Rows</p>
                        <p className="text-sm font-bold text-foreground">
                          {db.rowCount.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-surface border border-border">
                        <p className="text-[10px] text-muted-foreground">Valid Rows</p>
                        <p className="text-sm font-bold text-success">
                          {db.validRows.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-surface border border-border">
                        <p className="text-[10px] text-muted-foreground">Invalid Rows</p>
                        <p
                          className={`text-sm font-bold ${hasIssues ? "text-destructive" : "text-success"}`}
                        >
                          {db.invalidRows}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-surface border border-border">
                        <p className="text-[10px] text-muted-foreground">Columns</p>
                        <p className="text-sm font-bold text-foreground">{db.columns.length}</p>
                      </div>
                    </div>

                    {hasIssues && (
                      <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 flex items-start gap-2">
                        <AlertTriangle className="size-4 text-warning-foreground shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">Validation Issues</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {db.invalidRows} rows have validation errors. These rows will be flagged
                            for manual review before submission.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Data Preview Table */}
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        Data Preview (first 3 rows)
                      </h5>
                      <div className="rounded-xl border border-border overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/30 border-b border-border">
                              {db.columns.map((col) => (
                                <th
                                  key={col}
                                  className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {db.previewRows.map((row, i) => (
                              <tr key={i} className="hover:bg-muted/10 transition-colors">
                                {db.columns.map((col) => (
                                  <td
                                    key={col}
                                    className="px-3 py-2 text-foreground whitespace-nowrap"
                                  >
                                    {row[col as keyof typeof row] || "—"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toast.info(`Downloading ${db.fileName}...`)}
                        className="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors"
                      >
                        <Download className="size-3.5" /> Download Excel
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* ─── REVIEW TRAIL ─── */}
        <Card
          title="Review Trail"
          subtitle="Complete history of actions taken on this submission"
          action={
            <button
              onClick={() => toggleSection("trail")}
              className="press-feedback text-xs font-bold text-accent hover:underline flex items-center gap-1"
            >
              {expandedSections.trail ? "Collapse" : "Expand"}
              {expandedSections.trail ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </button>
          }
        >
          {expandedSections.trail && (
            <div className="space-y-4">
              {REVIEW_TRAIL.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{actionIcon(entry.action)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{entry.reviewerName}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {entry.reviewerRole}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          entry.action === "approved"
                            ? "bg-success/10 text-success"
                            : String(entry.action) === "rejected"
                              ? "bg-destructive/10 text-destructive"
                              : String(entry.action) === "forwarded"
                                ? "bg-accent/10 text-accent"
                                : String(entry.action) === "changes_requested"
                                  ? "bg-info/10 text-info"
                                  : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {actionLabel(entry.action)}
                      </span>
                    </div>
                    {entry.comment && (
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.comment}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{entry.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ─── REVIEW ACTIONS ─── */}
        {canReview && !isCooperative && (
          <Card title="Review Actions" subtitle="Take action on this submission">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Review Comment
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    role === "apex"
                      ? "Add review notes for the cooperative or federation..."
                      : role === "federation"
                        ? "Add review notes for the apex or ministry..."
                        : "Add review notes..."
                  }
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 resize-none transition-shadow"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                {canForward && (
                  <button
                    onClick={() => {
                      toast.success("Submission approved and forwarded to Federation for review");
                      setComment("");
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
                  >
                    <ArrowUpRight className="size-4" />
                    Approve & Forward to Federation
                  </button>
                )}
                {(role === "federation" || role === "ministry") && (
                  <button
                    onClick={() => {
                      toast.success("Submission approved successfully");
                      setComment("");
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-white hover:bg-success/90 transition-colors"
                  >
                    <CheckCircle2 className="size-4" />
                    Approve
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!comment.trim()) {
                      toast.error("Please provide a reason for requesting changes.");
                      return;
                    }
                    toast.success("Changes requested — notification sent to cooperative");
                    setComment("");
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-info bg-info/10 px-4 py-2.5 text-sm font-semibold text-info hover:bg-info/20 transition-colors"
                >
                  <RefreshCw className="size-4" />
                  Request Changes
                </button>
                <button
                  onClick={() => {
                    if (!comment.trim()) {
                      toast.error("Please provide a reason for rejection.");
                      return;
                    }
                    toast.success("Submission rejected");
                    setComment("");
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-white hover:bg-destructive/90 transition-colors"
                >
                  <XCircle className="size-4" />
                  Reject
                </button>
              </div>

              {/* Role-specific guidance */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground">
                  {role === "apex" && (
                    <>
                      <strong className="text-foreground">Apex Review:</strong> Approve to forward
                      this submission to the federation level. Request changes to send it back to
                      the cooperative for corrections. Reject to deny the submission entirely.
                    </>
                  )}
                  {role === "federation" && (
                    <>
                      <strong className="text-foreground">Federation Review:</strong> This
                      submission has been reviewed by the apex. You can approve, request further
                      changes, or reject it.
                    </>
                  )}
                  {role === "ministry" && (
                    <>
                      <strong className="text-foreground">Ministry Oversight:</strong> You have full
                      authority to approve, request changes, or reject any submission in the system.
                    </>
                  )}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* ─── COOPERATIVE READ-ONLY VIEW ─── */}
        {isCooperative && (
          <Card title="Submission Status" subtitle="Current status of your submission">
            <div className="p-4 rounded-lg bg-info/5 border border-info/20 flex items-start gap-3">
              <Shield className="size-5 text-info shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Your submission is currently <strong>{currentStatus}</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You will be notified when the review is complete or if changes are requested. You
                  can view the full review trail above to track progress.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
};
