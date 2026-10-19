export interface LoanQualityShares {
  performing: number;
  watchList: number;
  nonPerforming: number;
}

/**
 * Splits the loan portfolio into performing / watch list (overdue 30–90 days) /
 * non-performing (over 90 days) shares, from PAR 30 and PAR 90 in percent.
 * Shares stay within 0–100% even if reported overdue amounts exceed the loans.
 * Without PAR 30 there is no loan data: returns null rather than "100% performing".
 */
export function loanQualityShares(
  par30: number | undefined,
  par90: number | undefined,
): LoanQualityShares | null {
  if (par30 === undefined) return null;
  const over30 = Math.min(100, Math.max(0, par30));
  const over90 = Math.min(over30, Math.max(0, par90 ?? 0));
  return {
    performing: 100 - over30,
    watchList: over30 - over90,
    nonPerforming: over90,
  };
}
