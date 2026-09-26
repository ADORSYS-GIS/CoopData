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
import { Skeleton } from "@/components/ui/skeleton";
import { PanelSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { useUserRole } from "@/lib/auth";
import { resolveSelection } from "@/lib/analytics-filters";
import { usePeriodOptions } from "@/hooks/analytics/usePeriodOptions";
import { AnalyticsFilterBar } from "../analytics/AnalyticsFilterBar";
import { AnalyticsTabs, type AnalyticsTab } from "../analytics/AnalyticsTabs";
import { CooperativeAnalyticsView } from "../analytics/CooperativeAnalyticsView";
import type { components } from "@/openapi-client/api";
import { ApexAnalyticsView } from "../analytics/ApexAnalyticsView";
import { FederationAnalyticsView } from "../analytics/FederationAnalyticsView";
import { MinistryAnalyticsView } from "../analytics/MinistryAnalyticsView";
import { CooperativeRanking } from "@/components/analytics/CooperativeRanking";
import { PortfolioClassification } from "@/components/analytics/PortfolioClassification";
import { ComparativeIncomeStatement } from "@/components/analytics/ComparativeIncomeStatement";
import { FinancialIndicators } from "@/components/analytics/FinancialIndicators";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useFederations } from "@/hooks/federations/useFederations";
import { useApexes, useMinistryApexes } from "@/hooks/apexes/useApexes";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
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
    {
      id: "federation",
      label: "Federation",
      options: [{ value: "all", label: "All Federations" }],
    },
    { id: "apex", label: "Apex", options: [{ value: "all", label: "All Apexes" }] },
    {
      id: "cooperative",
      label: "Cooperative",
      options: [{ value: "all", label: "All Cooperatives" }],
    },
    { id: "region", label: "Region", options: REGION_OPTIONS },
    { id: "sector", label: "Sector", options: SECTOR_OPTIONS },
  ],
  federation: [
    { id: "apex", label: "Apex", options: [{ value: "all", label: "All Apexes" }] },
    {
      id: "cooperative",
      label: "Cooperative",
      options: [{ value: "all", label: "All Cooperatives" }],
    },
    { id: "region", label: "Region", options: REGION_OPTIONS },
    { id: "sector", label: "Sector", options: SECTOR_OPTIONS },
  ],
  apex: [
    {
      id: "cooperative",
      label: "Cooperative",
      options: [{ value: "all", label: "All Cooperatives" }],
    },
    { id: "region", label: "Region", options: REGION_OPTIONS },
    { id: "sector", label: "Sector", options: SECTOR_OPTIONS },
  ],
  cooperative: [],
};

// ── Component ───────────────────────────────────────────────────────────────
export const AnalyticsPage: React.FC = () => {
  const { t, replaceOrgTerms } = useOrganizationLabelsContext();
  const role = useUserRole();

  // Build filter configs inside component to use t()
  const REGION_OPTIONS_T: FilterConfig["options"] = [
    { value: "all", label: t("analytics.allRegions") },
    { value: "Manzini", label: "Manzini" },
    { value: "Hhohho", label: "Hhohho" },
    { value: "Shiselweni", label: "Shiselweni" },
    { value: "Lubombo", label: "Lubombo" },
  ];

  const SECTOR_OPTIONS_T: FilterConfig["options"] = [
    { value: "all", label: t("analytics.allSectors") },
    { value: "Agriculture", label: t("analytics.sector.agriculture") },
    { value: "Finance", label: t("analytics.sector.finance") },
    { value: "Housing", label: t("analytics.sector.housing") },
    { value: "Transport", label: t("analytics.sector.transport") },
    { value: "Manufacturing", label: t("analytics.sector.manufacturing") },
  ];

  const FILTERS_BY_ROLE_T: Record<string, FilterConfig[]> = {
    ministry: [
      {
        id: "federation",
        label: t("analytics.filter.federation"),
        options: [{ value: "all", label: t("analytics.allFederations") }],
      },
      {
        id: "apex",
        label: t("analytics.filter.apex"),
        options: [{ value: "all", label: t("analytics.allApexes") }],
      },
      {
        id: "cooperative",
        label: t("analytics.filter.cooperative"),
        options: [{ value: "all", label: t("analytics.allCooperatives") }],
      },
      { id: "region", label: t("analytics.filter.region"), options: REGION_OPTIONS_T },
      { id: "sector", label: t("analytics.filter.sector"), options: SECTOR_OPTIONS_T },
    ],
    federation: [
      {
        id: "apex",
        label: t("analytics.filter.apex"),
        options: [{ value: "all", label: t("analytics.allApexes") }],
      },
      {
        id: "cooperative",
        label: t("analytics.filter.cooperative"),
        options: [{ value: "all", label: t("analytics.allCooperatives") }],
      },
      { id: "region", label: t("analytics.filter.region"), options: REGION_OPTIONS_T },
      { id: "sector", label: t("analytics.filter.sector"), options: SECTOR_OPTIONS_T },
    ],
    apex: [
      {
        id: "cooperative",
        label: t("analytics.filter.cooperative"),
        options: [{ value: "all", label: t("analytics.allCooperatives") }],
      },
      { id: "region", label: t("analytics.filter.region"), options: REGION_OPTIONS_T },
      { id: "sector", label: t("analytics.filter.sector"), options: SECTOR_OPTIONS_T },
    ],
    cooperative: [],
  };

  const [filterValues, setFilterValues] = useState<AnalyticsFilterValues>(defaultFilterValues);
  const periods = usePeriodOptions(role);
  const selection = React.useMemo(
    () => resolveSelection(filterValues, periods),
    [filterValues, periods],
  );
  const effectiveFilters = React.useMemo<AnalyticsFilterValues>(
    () => ({
      ...filterValues,
      year: String(selection.year),
      periodType: selection.periodType,
      periodValue: selection.periodValue,
    }),
    [filterValues, selection],
  );

  const [activeTab, setActiveTab] = useState<AnalyticsTab>("dashboard");

  const handleFilterChange = useCallback((id: string, value: string) => {
    setFilterValues((prev) => {
      const next = { ...prev, [id]: value };
      // Cascade resets
      if (id === "federationId") {
        next.apexId = "all";
        next.cooperativeId = "all";
      } else if (id === "apexId") {
        next.cooperativeId = "all";
      }
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setFilterValues(defaultFilterValues);
  }, []);

  // Build API params from current filter state
  const filterParams = React.useMemo(
    () => ({
      reportingYear: selection.year,
      periodType: selection.periodType,
      periodValue: selection.periodValue,
      cooperativeId: filterValues.cooperativeId !== "all" ? filterValues.cooperativeId : undefined,
      apexId: filterValues.apexId !== "all" ? filterValues.apexId : undefined,
      federationId: filterValues.federationId !== "all" ? filterValues.federationId : undefined,
      region: filterValues.region !== "all" ? filterValues.region : undefined,
      sector: filterValues.sector !== "all" ? filterValues.sector : undefined,
    }),
    [filterValues, selection],
  );

  // Fetch cooperatives list scoped to current filters (for cooperative dropdown + tabs)
  const { data: overview, isLoading: overviewLoading } = useNationalOverview(
    filterParams,
    role !== "cooperative" && role !== undefined,
  );

  const { data: federations, isLoading: federationsLoading } = useFederations(role === "ministry");
  // federation role: use federation endpoint; ministry/superadmin: use ministry endpoint
  const { data: apexes, isLoading: apexesLoading } = useApexes(role === "federation");
  const { data: ministryApexes, isLoading: ministryApexesLoading } = useMinistryApexes(
    filterValues.federationId !== "all" ? filterValues.federationId : undefined,
    role === "ministry",
  );

  const filters = React.useMemo(() => {
    if (!role) return [];
    const baseFilters = FILTERS_BY_ROLE_T[role] ?? [];
    return baseFilters.map((filter) => {
      if (filter.id === "federation" && federations) {
        return {
          ...filter,
          options: [
            { value: "all", label: t("analytics.allFederations") },

            ...federations.map((f: { id: string; name: string }) => ({
              value: f.id,
              label: f.name,
            })),
          ],
        };
      }
      if (filter.id === "apex") {
        const isMinistry = role === "ministry";
        const apexOptions = isMinistry ? ministryApexes : apexes;
        const disabled = isMinistry && filterValues.federationId === "all";

        return {
          ...filter,
          disabled,
          options: [
            { value: "all", label: t("analytics.allApexes") },
            ...(apexOptions?.map((a: components["schemas"]["ApexResponse"]) => ({
              value: a.id,
              label: a.name,
            })) || []),
          ],
        };
      }
      if (filter.id === "cooperative" && overview?.cooperatives) {
        // Cooperative dropdown is always enabled when any data is loaded
        return {
          ...filter,
          disabled: false,
          options: [
            { value: "all", label: t("analytics.allCooperatives") },
            ...overview.cooperatives.map((c) => ({
              value: c.cooperative_id,
              label: c.name,
            })),
          ],
        };
      }
      return filter;
    });
  }, [
    role,
    overview,
    federations,
    apexes,
    ministryApexes,
    filterValues.federationId,
    filterValues.apexId,
  ]);

  if (!role) return null;

  const pageLoading =
    role !== "cooperative" &&
    (overviewLoading || federationsLoading || apexesLoading || ministryApexesLoading);

  if (pageLoading) {
    return (
      <AppShell
        title={replaceOrgTerms(titleByRole[role])}
        subtitle={replaceOrgTerms(subtitleByRole[role])}
      >
        <div className="space-y-6">
          <Skeleton className="h-6 w-24" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <PanelSkeleton />
            <PanelSkeleton />
          </div>
          <TableSkeleton rows={5} columns={4} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={replaceOrgTerms(titleByRole[role])}
      subtitle={replaceOrgTerms(subtitleByRole[role])}
    >
      <div className="space-y-6">
        {/* Role badge */}
        <div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${roleBadge[role].color}`}
          >
            {replaceOrgTerms(roleBadge[role].label)}
          </span>
        </div>

        <AnalyticsFilterBar
          filters={role === "cooperative" ? [] : filters}
          filterValues={filterValues}
          periods={periods}
          onFilterChange={handleFilterChange}
          onClear={handleClear}
        />

        {/* Tab Selection (only for supervisor roles when no individual cooperative is selected) */}
        {role !== "cooperative" && filterValues.cooperativeId === "all" && (
          <AnalyticsTabs active={activeTab} onChange={setActiveTab} />
        )}

        {/* Role-specific dashboard OR Cooperative deep-dive OR Tab content */}
        {filterValues.cooperativeId !== "all" ? (
          <CooperativeAnalyticsView filterValues={effectiveFilters} />
        ) : role !== "cooperative" && activeTab !== "dashboard" ? (
          <>
            {activeTab === "ranking" && (
              <CooperativeRanking reportingYear={selection.year} filterParams={filterParams} />
            )}
            {activeTab === "portfolio" && (
              <PortfolioClassification reportingYear={selection.year} filterParams={filterParams} />
            )}
            {activeTab === "income" && (
              <ComparativeIncomeStatement
                reportingYear={selection.year}
                filterParams={filterParams}
              />
            )}
            {activeTab === "indicators" && (
              <FinancialIndicators reportingYear={selection.year} filterParams={filterParams} />
            )}
          </>
        ) : (
          <>
            {role === "ministry" && <MinistryAnalyticsView filterValues={effectiveFilters} />}
            {role === "federation" && <FederationAnalyticsView filterValues={effectiveFilters} />}
            {role === "apex" && <ApexAnalyticsView filterValues={effectiveFilters} />}
            {role === "cooperative" && <CooperativeAnalyticsView filterValues={effectiveFilters} />}
          </>
        )}
      </div>
    </AppShell>
  );
};
