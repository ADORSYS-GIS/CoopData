export interface GridLine {
  account_code?: number | null;
  value_usd: number;
  month: number;
}

export type AccountValues = Record<number, number>;

const FIRST_FLOW_CODE = 4000;

/**
 * Account values of one statement at a chosen month, in USD. Balance-sheet
 * accounts come from that month; income and expense accounts are summed from
 * January to that month. An annual statement (month 0 only) answers for any
 * month. A month the statement does not cover returns null, never zeros.
 * Passing null selects the latest month reported.
 */
export const accountValuesAt = (
  lines: readonly GridLine[],
  month: number | null,
): AccountValues | null => {
  const coded = lines.filter((line) => line.account_code);
  const monthly = coded.filter((line) => line.month > 0);
  const values: AccountValues = {};
  const add = (line: GridLine): void => {
    const code = line.account_code as number;
    values[code] = (values[code] ?? 0) + line.value_usd;
  };

  if (monthly.length === 0) {
    if (coded.length === 0) return null;
    coded.forEach(add);
    return values;
  }

  const target = month ?? Math.max(...monthly.map((line) => line.month));
  if (!monthly.some((line) => line.month === target)) return null;

  monthly.forEach((line) => {
    const code = line.account_code as number;
    if (code < FIRST_FLOW_CODE ? line.month === target : line.month <= target) add(line);
  });
  return values;
};

export const shareOf = (part: number, whole: number): number | null =>
  whole > 0 ? (part / whole) * 100 : null;

/** Loan loss provisions are stored negative; the amount is returned positive. */
export const provisionAmount = (values: AccountValues): number => Math.abs(values[1250] ?? 0);
