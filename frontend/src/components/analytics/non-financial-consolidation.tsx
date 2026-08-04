import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  useIndicatorCatalog,
  useConsolidateIndicator,
} from "@/hooks/submissions/useNonFinancialIndicators";
import { Card, StatCard } from "@/components/app-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Landmark, Users, BarChart3, HelpCircle, Globe, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export const NonFinancialConsolidation: React.FC = () => {
  const { t } = useTranslation();
  const { data: catalog, isLoading: isLoadingCatalog } = useIndicatorCatalog();
  const [selectedIndicator, setSelectedIndicator] = useState<string>("");

  const {
    data: metrics,
    isLoading: isLoadingMetrics,
    isError,
  } = useConsolidateIndicator(selectedIndicator);

  const handleIndicatorChange = (value: string) => {
    setSelectedIndicator(value);
  };

  if (isLoadingCatalog) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t("analytics.loadingCatalog")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card
        title={t("analytics.nfConsolidation")}
        subtitle={t("analytics.nfConsolidationSubtitle")}
      >
        <div className="max-w-md mt-4">
          <Select value={selectedIndicator} onValueChange={handleIndicatorChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("analytics.selectIndicator")} />
            </SelectTrigger>
            <SelectContent>
              {catalog && catalog.length > 0 ? (
                catalog.map((item) => (
                  <SelectItem key={item.id} value={item.indicator_name}>
                    {item.display_name} ({item.data_type})
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  {t("analytics.noIndicatorsInCatalog")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {!selectedIndicator && (
        <div className="text-center py-16 border rounded-2xl bg-muted/20 border-dashed">
          <HelpCircle className="mx-auto h-10 w-10 text-muted-foreground/60 mb-3" />
          <h3 className="text-sm font-semibold">{t("analytics.noIndicatorSelected")}</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            {t("analytics.chooseIndicatorHint")}
          </p>
        </div>
      )}

      {selectedIndicator && isLoadingMetrics && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
          {t("analytics.consolidatingMetrics")}
        </div>
      )}

      {selectedIndicator && !isLoadingMetrics && isError && (
        <div className="text-center py-16 border rounded-2xl bg-destructive/5 border-destructive/20 text-destructive">
          <p className="text-sm font-semibold">{t("analytics.failedToConsolidate")}</p>
          <p className="text-xs mt-1">{t("analytics.consolidateErrorHint")}</p>
        </div>
      )}

      {selectedIndicator && !isLoadingMetrics && metrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              icon={BarChart3}
              label={t("analytics.consolidatedTotalSum")}
              value={metrics.total_sum.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
              subtitle={t("analytics.sumOfNumericInputs")}
              tone="primary"
            />
            <StatCard
              icon={Landmark}
              label={t("analytics.consolidatedAverage")}
              value={metrics.average.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
              subtitle={t("analytics.averageAcrossCoops")}
              tone="success"
            />
            <StatCard
              icon={Users}
              label={t("analytics.reportingCoops")}
              value={metrics.count.toString()}
              subtitle={t("analytics.countSubmittedForms")}
              tone="accent"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card
              title={t("analytics.breakdownByRegion")}
              subtitle={t("analytics.breakdownByRegionSubtitle")}
            >
              {metrics.by_region.length > 0 ? (
                <div className="h-80 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.by_region}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="region" stroke="currentColor" opacity={0.6} />
                      <YAxis stroke="currentColor" opacity={0.6} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="total_sum"
                        name={t("analytics.totalSum")}
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="average"
                        name={t("analytics.average")}
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-60 text-muted-foreground">
                  <Globe className="h-8 w-8 opacity-40 mb-2" />
                  <p className="text-xs">{t("analytics.noRegionalData")}</p>
                </div>
              )}
            </Card>

            <Card
              title={t("analytics.breakdownByCoopType")}
              subtitle={t("analytics.breakdownByCoopTypeSubtitle")}
            >
              {metrics.by_coop_type.length > 0 ? (
                <div className="h-80 mt-4 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.by_coop_type}
                        dataKey="total_sum"
                        nameKey="coop_type"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {metrics.by_coop_type.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-60 text-muted-foreground">
                  <Shield className="h-8 w-8 opacity-40 mb-2" />
                  <p className="text-xs">{t("analytics.noCoopTypeData")}</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
