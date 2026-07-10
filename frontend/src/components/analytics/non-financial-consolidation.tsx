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

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export const NonFinancialConsolidation: React.FC = () => {
  const { data: catalog, isLoading: isLoadingCatalog } = useIndicatorCatalog();
  const [selectedIndicator, setSelectedIndicator] = useState<string>("");

  const { data: metrics, isLoading: isLoadingMetrics, isError } = useConsolidateIndicator(
    selectedIndicator
  );

  const handleIndicatorChange = (value: string) => {
    setSelectedIndicator(value);
  };

  if (isLoadingCatalog) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading indicator catalog...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Indicator Selection Card */}
      <Card
        title="Non-Financial Indicator Consolidation"
        subtitle="Select a dynamic non-financial indicator to view aggregated reports and charts across all cooperatives"
      >
        <div className="max-w-md mt-4">
          <Select value={selectedIndicator} onValueChange={handleIndicatorChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an indicator..." />
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
                  No indicators defined in catalog
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {!selectedIndicator && (
        <div className="text-center py-16 border rounded-2xl bg-muted/20 border-dashed">
          <HelpCircle className="mx-auto h-10 w-10 text-muted-foreground/60 mb-3" />
          <h3 className="text-sm font-semibold">No Indicator Selected</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            Please choose an indicator from the dropdown above to consolidation-consolidate and visualize data.
          </p>
        </div>
      )}

      {selectedIndicator && isLoadingMetrics && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
          Consolidating metrics from databases...
        </div>
      )}

      {selectedIndicator && !isLoadingMetrics && isError && (
        <div className="text-center py-16 border rounded-2xl bg-destructive/5 border-destructive/20 text-destructive">
          <p className="text-sm font-semibold">Failed to consolidate data</p>
          <p className="text-xs mt-1">
            Please verify the indicator has submitted records or database connection is stable.
          </p>
        </div>
      )}

      {selectedIndicator && !isLoadingMetrics && metrics && (
        <div className="space-y-6">
          {/* Aggregated KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              icon={BarChart3}
              label="Consolidated Total Sum"
              value={metrics.total_sum.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
              subtitle="Sum of numeric inputs"
              tone="primary"
            />
            <StatCard
              icon={Landmark}
              label="Consolidated Average"
              value={metrics.average.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
              subtitle="Average value across coops"
              tone="success"
            />
            <StatCard
              icon={Users}
              label="Reporting Cooperatives"
              value={metrics.count.toString()}
              subtitle="Count of submitted forms"
              tone="accent"
            />
          </div>

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Region Breakdown Chart */}
            <Card
              title="Breakdown by Region"
              subtitle="Total sum and averages aggregated by cooperative regions"
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
                      <Bar dataKey="total_sum" name="Total Sum" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="average" name="Average" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-60 text-muted-foreground">
                  <Globe className="h-8 w-8 opacity-40 mb-2" />
                  <p className="text-xs">No regional breakdown data available.</p>
                </div>
              )}
            </Card>

            {/* Cooperative Type Breakdown Chart */}
            <Card
              title="Breakdown by Cooperative Type"
              subtitle="Aggregated values classified by institution type"
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
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {metrics.by_coop_type.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
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
                  <p className="text-xs">No cooperative type breakdown data available.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
