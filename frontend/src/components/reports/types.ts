import { type Role } from "@/lib/auth";
import { FileText, FileSpreadsheet, FileBarChart } from "lucide-react";

export type ExportFormat = "pdf" | "xlsx" | "csv" | "docx";
export type ReportScope = "consolidated" | "individual" | "comparative" | "trend";

export interface ReportExportOption {
  id: string;
  label: string;
  description: string;
  scope: ReportScope;
  formats: ExportFormat[];
  availableTo: Role[];
}

export const REPORT_EXPORT_OPTIONS: ReportExportOption[] = [
  {
    id: "consolidated-report",
    label: "Consolidated Performance Report",
    description: "Comprehensive multi-sheet workbook and executive summary aggregating data for all cooperatives within your jurisdiction.",
    scope: "consolidated",
    formats: ["pdf", "xlsx", "csv", "docx"],
    availableTo: ["ministry", "federation", "apex"],
  },
  {
    id: "cooperative-individual",
    label: "Cooperative Financial Report",
    description: "Detailed financial statement, KPIs, and demographic database report for a single cooperative.",
    scope: "individual",
    formats: ["pdf", "xlsx", "csv", "docx"],
    availableTo: ["ministry", "federation", "apex", "cooperative"],
  },
];

export const SCOPE_LABELS: Record<ReportScope, string> = {
  consolidated: "Consolidated",
  individual: "Individual",
  comparative: "Comparative",
  trend: "Trend",
};

export const SCOPE_COLORS: Record<ReportScope, string> = {
  consolidated: "bg-accent/10 text-accent",
  individual: "bg-success/10 text-success",
  comparative: "bg-info/10 text-info",
  trend: "bg-warning/15 text-warning-foreground",
};

export const FORMAT_ICONS: Record<ExportFormat, typeof FileText> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  csv: FileBarChart,
  docx: FileText,
};

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: "PDF",
  xlsx: "Excel",
  csv: "CSV",
  docx: "Word",
};

export const EXPORTABLE_STATUSES = ["submitted", "approved"];
