import type { Role } from "@/lib/auth";

export interface AnalyticsFilterValues {
  year: string;
  region: string;
  sector: string;
  federationId: string;
  apexId: string;
  cooperativeId: string;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  id: string;
  label: string;
  options: FilterOption[];
  disabled?: boolean;
}

export const titleByRole: Record<Role, string> = {
  ministry: "National Analytics",
  federation: "Federation Analytics",
  apex: "Apex Analytics",
  cooperative: "My Analytics",
};

export const subtitleByRole: Record<Role, string> = {
  ministry: "Drill-down national, regional, and sector intelligence with live data sourcing",
  federation: "Analyze performance across apexes and cooperatives under your federation",
  apex: "Analyze performance across cooperatives under your apex organization",
  cooperative: "View your cooperative's performance trends and key metrics",
};

export const roleBadge: Record<Role, { label: string; color: string }> = {
  ministry: { label: "Ministry View", color: "bg-primary/10 text-primary" },
  federation: { label: "Federation View", color: "bg-info/10 text-info" },
  apex: { label: "Apex View", color: "bg-accent/10 text-accent" },
  cooperative: { label: "Cooperative View", color: "bg-success/10 text-success" },
};

export const defaultFilterValues: AnalyticsFilterValues = {
  year: String(new Date().getFullYear()),
  region: "all",
  sector: "all",
  federationId: "all",
  apexId: "all",
  cooperativeId: "all",
};
