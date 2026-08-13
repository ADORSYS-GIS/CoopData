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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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

  const [filterValues, setFilterValues] = useState<AnalyticsFilterValues>({
    ...defaultFilterValues,
    year: String(new Date().getFullYear()),
  });

  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), 0, 1),
    to: new Date(),
  });

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "ranking" | "portfolio" | "income" | "indicators"
  >("dashboard");

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
    setFilterValues({
      year: String(new Date().getFullYear()),
      region: "all",
      sector: "all",
      federationId: "all",
      apexId: "all",
      cooperativeId: "all",
    });
  }, []);

  // Build API params from current filter state
  const filterParams = React.useMemo(
    () => ({
      reportingYear: Number(filterValues.year),
      cooperativeId: filterValues.cooperativeId !== "all" ? filterValues.cooperativeId : undefined,
      apexId: filterValues.apexId !== "all" ? filterValues.apexId : undefined,
      federationId: filterValues.federationId !== "all" ? filterValues.federationId : undefined,
      region: filterValues.region !== "all" ? filterValues.region : undefined,
      sector: filterValues.sector !== "all" ? filterValues.sector : undefined,
    }),
    [filterValues],
  );

  // Fetch cooperatives list scoped to current filters (for cooperative dropdown + tabs)
  const { data: overview } = useNationalOverview(
    filterParams,
    role !== "cooperative" && role !== undefined,
  );

  const { data: federations } = useFederations(role === "ministry");
  // federation role: use federation endpoint; ministry/superadmin: use ministry endpoint
  const { data: apexes } = useApexes(role === "federation");
  const { data: ministryApexes } = useMinistryApexes(
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

        {/* Tab Selection (only for supervisor roles when no individual cooperative is selected) */}
        {role !== "cooperative" && filterValues.cooperativeId === "all" && (
          <div className="flex border-b border-border space-x-6">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all ${
                activeTab === "dashboard"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("analytics.tab.consolidatedDashboard")}
            </button>
            <button
              onClick={() => setActiveTab("ranking")}
              className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all ${
                activeTab === "ranking"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("analytics.tab.cooperativeRankings")}
            </button>
            <button
              onClick={() => setActiveTab("portfolio")}
              className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all ${
                activeTab === "portfolio"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("analytics.tab.portfolioClassification")}
            </button>
            <button
              onClick={() => setActiveTab("income")}
              className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all ${
                activeTab === "income"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("analytics.tab.incomeStatement")}
            </button>
            <button
              onClick={() => setActiveTab("indicators")}
              className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all ${
                activeTab === "indicators"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("analytics.tab.financialIndicators")}
            </button>
          </div>
        )}

        {/* Role-specific dashboard OR Cooperative deep-dive OR Tab content */}
        {filterValues.cooperativeId !== "all" ? (
          <CooperativeAnalyticsView filterValues={filterValues} />
        ) : role !== "cooperative" && activeTab !== "dashboard" ? (
          <>
            {activeTab === "ranking" && (
              <CooperativeRanking
                reportingYear={Number(filterValues.year)}
                filterParams={filterParams}
              />
            )}
            {activeTab === "portfolio" && (
              <PortfolioClassification
                reportingYear={Number(filterValues.year)}
                filterParams={filterParams}
              />
            )}
            {activeTab === "income" && (
              <ComparativeIncomeStatement
                reportingYear={Number(filterValues.year)}
                filterParams={filterParams}
              />
            )}
            {activeTab === "indicators" && (
              <FinancialIndicators
                reportingYear={Number(filterValues.year)}
                filterParams={filterParams}
              />
            )}
          </>
        ) : (
          <>
            {role === "ministry" && (
              <MinistryAnalyticsView
                filterValues={filterValues}
                onFilterChange={handleFilterChange}
              />
            )}
            {role === "federation" && (
              <FederationAnalyticsView
                filterValues={filterValues}
                onFilterChange={handleFilterChange}
              />
            )}
            {role === "apex" && (
              <ApexAnalyticsView filterValues={filterValues} onFilterChange={handleFilterChange} />
            )}
            {role === "cooperative" && <CooperativeAnalyticsView filterValues={filterValues} />}
          </>
        )}
      </div>
    </AppShell>
  );
};
