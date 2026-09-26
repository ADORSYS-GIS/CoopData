import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";

interface PeerIndicator {
  key: string;
  label: string;
  /** True when a lower value is the better result. */
  lowerIsBetter: boolean;
}

export const PEER_INDICATORS: readonly PeerIndicator[] = [
  { key: "par30", label: "PAR >30 days (%)", lowerIsBetter: true },
  { key: "capital_adequacy_ratio", label: "Capital adequacy (%)", lowerIsBetter: false },
  { key: "roa", label: "Return on assets (%)", lowerIsBetter: false },
  { key: "roe", label: "Return on equity (%)", lowerIsBetter: false },
  { key: "operating_expense_ratio", label: "Operating expense ratio (%)", lowerIsBetter: true },
  { key: "liquid_funds_ratio", label: "Liquid assets / total assets (%)", lowerIsBetter: false },
];

export interface Rank {
  position: number;
  of: number;
}

export interface PeerRow {
  key: string;
  label: string;
  current: number | null;
  apexAverage: number | null;
  nationalAverage: number | null;
  apexRank: Rank | null;
  nationalRank: Rank | null;
}

export interface PeerComparison {
  rows: PeerRow[];
  apexCount: number;
  nationalCount: number;
}

const valueOf = (coop: CoopKpiRow, key: string): number | null =>
  coop.has_data && coop.kpis?.[key] ? coop.kpis[key].value : null;

const average = (values: readonly number[]): number | null =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const rankOf = (
  own: number | null,
  group: readonly number[],
  lowerIsBetter: boolean,
): Rank | null => {
  if (own === null || group.length < 2) return null;
  const ahead = group.filter((value) => (lowerIsBetter ? value < own : value > own)).length;
  return { position: ahead + 1, of: group.length };
};

/**
 * Compares one cooperative with the cooperatives of its apex and with all
 * cooperatives that filed for the year. The cooperative itself is part of both
 * groups. Returns null when there is nobody to compare with.
 */
export const compareWithPeers = (
  cooperativeId: string,
  apexId: string | null | undefined,
  peers: readonly CoopKpiRow[] | undefined,
): PeerComparison | null => {
  const filed = (peers ?? []).filter((coop) => coop.has_data);
  const own = filed.find((coop) => coop.cooperative_id === cooperativeId);
  if (!own || filed.length < 2) return null;
  const sameApex = apexId ? filed.filter((coop) => coop.apex_id === apexId) : [];

  const rows = PEER_INDICATORS.map((indicator): PeerRow => {
    const current = valueOf(own, indicator.key);
    const nationalValues = filed
      .map((coop) => valueOf(coop, indicator.key))
      .filter((value): value is number => value !== null);
    const apexValues = sameApex
      .map((coop) => valueOf(coop, indicator.key))
      .filter((value): value is number => value !== null);
    return {
      key: indicator.key,
      label: indicator.label,
      current,
      apexAverage: apexValues.length > 1 ? average(apexValues) : null,
      nationalAverage: average(nationalValues),
      apexRank: rankOf(current, apexValues, indicator.lowerIsBetter),
      nationalRank: rankOf(current, nationalValues, indicator.lowerIsBetter),
    };
  });
  return { rows, apexCount: sameApex.length, nationalCount: filed.length };
};
