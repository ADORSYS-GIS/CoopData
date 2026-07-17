/**
 * AnalyticsPage — thin orchestrator
 *
 * Responsibilities:
 *  1. Determine user role
 *  2. Manage filter state (year + hierarchy filters)
 *  3. Render the role-specific analytics view
 *
 * Each role renders a separate, focused component:
 *   ministry  → MinistryAnalyticsView
 *   federation → FederationAnalyticsView
 *   apex       → ApexAnalyticsView
 *   cooperative → CooperativeAnalyticsView
 */
import React, { useState, useCallback } from "react";
import { AppShell } from "@/components/app-shell";
import { useUserRole } from "@/lib/auth";
import type { DateRange } from "@/components/analytics/date-range-picker";
import { AnalyticsFilterBar } from "../analytics/AnalyticsFilterBar";
import { CooperativeAnalyticsView } from "../analytics/CooperativeAnalyticsView";
import { ApexAnalyticsView } from "../analytics/ApexAnalyticsView";
import { FederationAnalyticsView } from "../analytics/FederationAnalyticsView";
import { MinistryAnalyticsView } from "../analytics/MinistryAnalyticsView";
import {
  titleByRole,
  subtitleByRole,
  roleBadge,
  defaultFilterValues,
  type AnalyticsFilterValues,
  type FilterConfig,
} from "../analytics/analyticsTypes";

// ── Filter config per role ──────────────────────────────────────────────────
const REGION_OPTIONS: FilterConfig["options"] = [
  { value: "all", label: "All Regions" },
  { value: "Manzini", label: "Manzini" },
  { value: "Hhohho", label: "Hhohho" },
  { value: "Shiselweni", label: "Shiselweni" },
  { value: "Lubombo", label: "Lubombo" },
];

const SECTOR_OPTIONS: FilterConfig["options"] = [
  { value: "all", label: "All Sectors" },
  { value: "Agriculture", label: "Agriculture" },
  { value: "Finance", label: "Finance" },
  { value: "Housing", label: "Housing" },
  { value: "Transport", label: "Transport" },
  { value: "Manufacturing", label: "Manufacturing" },
];


const FILTERS_BY_ROLE: Record<string, FilterConfig[]> = {
  ministry: [
    { id: "federation", label: "Federation", options: [{ value: "all", label: "All Federations" }] },
    { id: "apex", label: "Apex", options: [{ value: "all", label: "All Apexes" }] },
    { id: "cooperative", label: "Cooperative", options: [{ value: "all", label: "All Cooperatives" }] },
    { id: "region", label: "Region", options: REGION_OPTIONS },
    { id: "sector", label: "Sector", options: SECTOR_OPTIONS },
  ],
  federation: [
    { id: "apex", label: "Apex", options: [{ value: "all", label: "All Apexes" }] },
    { id: "cooperative", label: "Cooperative", options: [{ value: "all", label: "All Cooperatives" }] },
    { id: "region", label: "Region", options: REGION_OPTIONS },
    { id: "sector", label: "Sector", options: SECTOR_OPTIONS },
  ],
  apex: [
    { id: "cooperative", label: "Cooperative", options: [{ value: "all", label: "All Cooperatives" }] },
    { id: "region", label: "Region", options: REGION_OPTIONS },
    { id: "sector", label: "Sector", options: SECTOR_OPTIONS },
  ],
  cooperative: [],
};

// ── Component ───────────────────────────────────────────────────────────────
export const AnalyticsPage: React.FC = () => {
  const role = useUserRole();

  const [filterValues, setFilterValues] = useState<AnalyticsFilterValues>({
    ...defaultFilterValues,
    year: String(new Date().getFullYear()),
  });

  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), 0, 1),
    to: new Date(),
  });

  const handleFilterChange = useCallback((id: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleClear = useCallback(() => {
    setFilterValues({
      year: String(new Date().getFullYear()),
      region: "all",
      sector: "all",
      federationId: "all",
      apexId: "all",
      cooperativeId: "all",
    });
  }, []);

  if (!role) return null;

  const filters = FILTERS_BY_ROLE[role] ?? [];

  return (
    <AppShell title={titleByRole[role]} subtitle={subtitleByRole[role]}>
      <div className="space-y-6">
        {/* Role badge */}
        <div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${roleBadge[role].color}`}
          >
            {roleBadge[role].label}
          </span>
        </div>

        {/* Filter bar (hidden for cooperative — no hierarchy filters needed) */}
        {role !== "cooperative" && (
          <AnalyticsFilterBar
            filters={filters}
            filterValues={filterValues}
            dateRange={dateRange}
            onFilterChange={handleFilterChange}
            onDateRangeChange={setDateRange}
            onClear={handleClear}
          />
        )}

        {/* Year selector for cooperative (no other filters) */}
        {role === "cooperative" && (
          <AnalyticsFilterBar
            filters={[]}
            filterValues={filterValues}
            dateRange={dateRange}
            onFilterChange={handleFilterChange}
            onDateRangeChange={setDateRange}
            onClear={handleClear}
          />
        )}

        {/* Role-specific dashboard */}
        {role === "ministry" && (
          <MinistryAnalyticsView filterValues={filterValues} />
        )}
        {role === "federation" && (
          <FederationAnalyticsView filterValues={filterValues} />
        )}
        {role === "apex" && (
          <ApexAnalyticsView filterValues={filterValues} onFilterChange={handleFilterChange} />
        )}
        {role === "cooperative" && (
          <CooperativeAnalyticsView filterValues={filterValues} />
        )}
      </div>
    </AppShell>
  );
};
