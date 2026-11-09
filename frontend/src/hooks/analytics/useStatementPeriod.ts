import { useMemo, useState } from "react";

import type { CooperativeStatementGrid } from "@/hooks/analytics/useComparativeStatements";
import { periodEndMonths } from "@/lib/statement-periods";

/**
 * The period ends offered for the cooperatives on screen and the one chosen.
 * A choice the current cooperatives cannot answer for moves to the latest one.
 */
export const useStatementPeriod = (
  grids: readonly CooperativeStatementGrid[] | undefined,
  selectedCoopIds: readonly string[],
) => {
  const [chosen, setChosen] = useState<string>("12");

  const months = useMemo(() => {
    const inScope = (grids ?? []).filter(
      (grid) => selectedCoopIds.length === 0 || selectedCoopIds.includes(grid.cooperative_id),
    );
    return periodEndMonths(inScope.map((grid) => grid.period_type));
  }, [grids, selectedCoopIds]);

  const selectedMonth = months.includes(Number(chosen))
    ? chosen
    : String(months[months.length - 1]);

  return { months, selectedMonth, setSelectedMonth: setChosen };
};
