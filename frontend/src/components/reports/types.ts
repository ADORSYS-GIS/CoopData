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
    id: "national-consolidated",
    label: "National Consolidated Report",
    description: "Aggregated data across all federations, apexes, and cooperatives nationwide.",
    scope: "consolidated",
    formats: ["pdf", "xlsx", "csv", "docx"],
    availableTo: ["ministry"],
  },
  {
    id: "federation-consolidated",
    label: "Federation Consolidated Report",
    description: "Aggregated data for all apexes and cooperatives under your federation.",
    scope: "consolidated",
    formats: ["pdf", "xlsx", "csv", "docx"],
    availableTo: ["ministry", "federation"],
  },
  {
    id: "apex-consolidated",
    label: "Apex Consolidated Report",
    description: "Aggregated data for all cooperatives under your apex organization.",
    scope: "consolidated",
    formats: ["pdf", "xlsx", "csv", "docx"],
    availableTo: ["ministry", "federation", "apex"],
  },
  {
    id: "cooperative-individual",
    label: "Cooperative Individual Report",
    description: "Detailed financial statement and database report for a single cooperative.",
    scope: "individual",
    formats: ["pdf", "xlsx", "csv", "docx"],
    availableTo: ["ministry", "federation", "apex", "cooperative"],
  },
  {
    id: "membership-report",
    label: "Membership Demographics Report",
    description: "Gender participation, youth engagement, and membership statistics.",
    scope: "consolidated",
    formats: ["xlsx"],
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
