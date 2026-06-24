import type { MemberShares, Reserves, RetainedEarnings } from "@/lib/financial-data";
import { DollarSign, Calculator } from "lucide-react";

interface EquitySectionProps {
  memberShares: MemberShares;
  reserves: Reserves;
  retainedEarnings: RetainedEarnings;
  onChange: (
    section: "memberShares" | "reserves" | "retainedEarnings",
    field: string,
    value: number,
  ) => void;
  totals: {
    totalMemberShares: number;
    totalReserves: number;
    totalRetainedEarnings: number;
    totalEquity: number;
  };
}

export function EquitySection({
  memberShares,
  reserves,
  retainedEarnings,
  onChange,
  totals,
}: EquitySectionProps) {
  const formatNumber = (n: number) => n.toLocaleString();

  const handleNumberInput = (
    section: "memberShares" | "reserves" | "retainedEarnings",
    field: string,
    value: string,
  ) => {
    const numValue = parseFloat(value.replace(/,/g, "")) || 0;
    onChange(section, field, numValue);
  };

  return (
    <div className="space-y-6">
      {/* Member Shares */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-accent/10 text-accent grid place-items-center text-xs font-bold">
            3100
          </span>
          Member Shares
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Permanent Share Capital (3101)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(memberShares.permanentShareCapital)}
                onChange={(e) =>
                  handleNumberInput("memberShares", "permanentShareCapital", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Withdrawable Shares (3102)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(memberShares.withdrawableShares)}
                onChange={(e) =>
                  handleNumberInput("memberShares", "withdrawableShares", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <Calculator className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Total Member Shares:</span>
          <span className="font-bold text-foreground">
            ${formatNumber(totals.totalMemberShares)}
          </span>
        </div>
      </div>

      {/* Reserves */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-info/10 text-info grid place-items-center text-xs font-bold">
            3200
          </span>
          Reserves
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Statutory Reserve (3201)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(reserves.statutoryReserve)}
                onChange={(e) => handleNumberInput("reserves", "statutoryReserve", e.target.value)}
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              General Reserve (3202)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(reserves.generalReserve)}
                onChange={(e) => handleNumberInput("reserves", "generalReserve", e.target.value)}
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Risk Capital Adequacy Reserve (3203)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(reserves.riskCapitalAdequacyReserve)}
                onChange={(e) =>
                  handleNumberInput("reserves", "riskCapitalAdequacyReserve", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <span className="text-muted-foreground">Total Reserves:</span>
          <span className="font-bold text-foreground">${formatNumber(totals.totalReserves)}</span>
        </div>
      </div>

      {/* Retained Earnings */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-success/10 text-success grid place-items-center text-xs font-bold">
            3300
          </span>
          Retained Earnings
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Accumulated Surplus (3301)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(retainedEarnings.accumulatedSurplus)}
                onChange={(e) =>
                  handleNumberInput("retainedEarnings", "accumulatedSurplus", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Current Year Surplus (3302)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(retainedEarnings.currentYearSurplus)}
                onChange={(e) =>
                  handleNumberInput("retainedEarnings", "currentYearSurplus", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <span className="text-muted-foreground">Total Retained Earnings:</span>
          <span className="font-bold text-foreground">
            ${formatNumber(totals.totalRetainedEarnings)}
          </span>
        </div>
      </div>

      {/* Total Equity */}
      <div className="flex items-center justify-between gap-2 p-4 rounded-xl bg-success/5 border border-success/20">
        <div className="flex items-center gap-2">
          <span className="size-8 rounded-lg bg-success text-success-foreground grid place-items-center text-sm font-bold">
            3999
          </span>
          <span className="font-semibold text-foreground">TOTAL EQUITY</span>
        </div>
        <span className="text-xl font-bold text-foreground">
          ${formatNumber(totals.totalEquity)}
        </span>
      </div>
    </div>
  );
}
