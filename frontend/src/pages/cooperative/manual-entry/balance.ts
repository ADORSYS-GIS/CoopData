/** Reads one account's amount for the period being computed. */
export type AccountReader = (code: number) => number;

const sum = (read: AccountReader, codes: readonly number[]) =>
  codes.reduce((total, code) => total + read(code), 0);

/**
 * Loan loss provisions (1251–1252), as a positive amount. Cooperatives type them
 * either as positive figures (the grid presents them that way) or as negatives,
 * so the sign is ignored, as the backend does.
 */
export const loanLossAllowance = (read: AccountReader) => Math.abs(read(1251) + read(1252));

export const liquidAssets = (read: AccountReader) => sum(read, [1101, 1102, 1103, 1104]);

export const grossLoanPortfolio = (read: AccountReader) =>
  sum(read, [1201, 1202, 1203, 1204, 1205]);

export const netLoanPortfolio = (read: AccountReader) =>
  grossLoanPortfolio(read) - loanLossAllowance(read);

/** Other assets (1300): accumulated depreciation (1304) reduces them, whatever its sign. */
export const otherAssets = (read: AccountReader) =>
  sum(read, [1301, 1302, 1303, 1305]) - Math.abs(read(1304));

/** Total assets (1999) = liquid assets + net loan portfolio + other assets. */
export const totalAssets = (read: AccountReader) =>
  liquidAssets(read) + netLoanPortfolio(read) + otherAssets(read);

export interface PeriodTotals {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalIncome: number;
  totalExpenses: number;
}

const LIABILITY_CODES = [2101, 2102, 2103, 2201, 2202, 2301, 2302, 2303] as const;
const EQUITY_CODES = [3101, 3102, 3201, 3202, 3203, 3301, 3302] as const;
const INCOME_CODES = [4101, 4102, 4201] as const;
const EXPENSE_CODES = [5101, 5102, 5201, 5202, 5203, 5204, 5301] as const;

/**
 * Totals of the period being entered. The balance sheet is the snapshot of the
 * period's last column; income and expenses add up every column. A yearly return
 * has a single "Annual Total" column (month 0).
 */
export function periodTotals(
  data: Record<number, Record<number, number>>,
  months: readonly number[],
): PeriodTotals {
  const at = (m: number) => (code: number) => data[code]?.[m] || 0;
  const snapshot = at(months[months.length - 1] ?? 0);
  const flow = (codes: readonly number[]) =>
    months.reduce((total, m) => total + sum(at(m), codes), 0);
  return {
    totalAssets: totalAssets(snapshot),
    totalLiabilities: sum(snapshot, LIABILITY_CODES),
    totalEquity: sum(snapshot, EQUITY_CODES),
    totalIncome: flow(INCOME_CODES),
    totalExpenses: flow(EXPENSE_CODES),
  };
}
