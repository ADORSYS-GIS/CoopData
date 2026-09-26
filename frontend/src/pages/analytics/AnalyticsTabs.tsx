import { useTranslation } from "react-i18next";

export type AnalyticsTab = "dashboard" | "ranking" | "portfolio" | "income" | "indicators";

const TABS: { id: AnalyticsTab; labelKey: string }[] = [
  { id: "dashboard", labelKey: "analytics.tab.consolidatedDashboard" },
  { id: "ranking", labelKey: "analytics.tab.cooperativeRankings" },
  { id: "portfolio", labelKey: "analytics.tab.portfolioClassification" },
  { id: "income", labelKey: "analytics.tab.incomeStatement" },
  { id: "indicators", labelKey: "analytics.tab.financialIndicators" },
];

interface AnalyticsTabsProps {
  active: AnalyticsTab;
  onChange: (tab: AnalyticsTab) => void;
}

export function AnalyticsTabs({ active, onChange }: AnalyticsTabsProps) {
  const { t } = useTranslation();

  return (
    <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-border">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold tracking-wide transition-all ${
            active === tab.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );
}
