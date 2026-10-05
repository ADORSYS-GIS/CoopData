import type {
  KpiItemResponse,
  LineItemResponse,
  SubmissionLineItemsResponse,
} from "@/hooks/submissions/useCooperativeKpis";

export type Side = "current" | "prior";

/** Codes that are subtotals of other codes; the statements list only their leaf accounts. */
const PARENT_CODES = new Set([
  1100, 1200, 1250, 1300, 2100, 2200, 2300, 3100, 3200, 3300, 4100, 4200, 5100, 5200, 5300,
]);
const TOTAL_CODES = new Set([1999, 2999, 3999, 4999, 5999, 6999]);

const isFlow = (code: number): boolean => code >= 4000;

const listOf = (data: SubmissionLineItemsResponse, side: Side): LineItemResponse[] =>
  (side === "current" ? data.current_year : data.prior_year) ?? [];

/**
 * Value of one account. Balances take the latest month reported (an annual
 * statement stores everything at month 0); income and expense lines are summed
 * over the months reported.
 */
export const accountValue = (
  data: SubmissionLineItemsResponse,
  code: number,
  side: Side,
): number | undefined => {
  const rows = listOf(data, side).filter(
    (row) => row.account_code === code && row.value !== undefined,
  );
  if (rows.length === 0) return undefined;
  const monthly = rows.filter((row) => (row.month ?? 0) > 0);
  if (monthly.length === 0) return rows[0]?.value;
  if (isFlow(code)) return monthly.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const latest = Math.max(...monthly.map((row) => row.month ?? 0));
  return monthly.find((row) => row.month === latest)?.value;
};

export interface StatementLine {
  code: number;
  name: string;
  current: number | undefined;
  prior: number | undefined;
}

const namesOf = (data: SubmissionLineItemsResponse): Map<number, string> => {
  const names = new Map<number, string>();
  for (const row of [...(data.current_year ?? []), ...(data.prior_year ?? [])]) {
    if (row.account_code !== undefined && !names.has(row.account_code)) {
      names.set(row.account_code, row.account_name);
    }
  }
  return names;
};

const titleCase = (text: string): string =>
  text.charAt(0) +
  text
    .slice(1)
    .toLowerCase()
    .replace(/\bsacco\b/g, "SACCO");

/** Leaf accounts of one statement section, in code order, that carry a figure in either year. */
export const leafLines = (
  data: SubmissionLineItemsResponse,
  from: number,
  to: number,
): StatementLine[] => {
  const names = namesOf(data);
  return [...names.keys()]
    .filter(
      (code) => code >= from && code <= to && !PARENT_CODES.has(code) && !TOTAL_CODES.has(code),
    )
    .sort((a, b) => a - b)
    .map((code) => ({
      code,
      name: titleCase(names.get(code) ?? String(code)),
      current: accountValue(data, code, "current"),
      prior: accountValue(data, code, "prior"),
    }))
    .filter((line) => (line.current ?? 0) !== 0 || (line.prior ?? 0) !== 0);
};

export const sumLines = (lines: readonly StatementLine[], side: Side): number =>
  lines.reduce((total, line) => total + ((side === "current" ? line.current : line.prior) ?? 0), 0);

export interface Statement {
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  income: StatementLine[];
  expenses: StatementLine[];
  /** Reported totals, falling back to the sum of the lines when the total account is missing. */
  totals: Record<
    "assets" | "liabilities" | "equity" | "income" | "expenses" | "surplus",
    { current: number; prior: number }
  >;
  /** Totals exactly as reported in the return (undefined when not reported). */
  reported: Record<
    "assets" | "liabilities" | "equity" | "income" | "expenses" | "surplus",
    { current?: number; prior?: number }
  >;
}

export const buildStatement = (data: SubmissionLineItemsResponse): Statement => {
  const assets = leafLines(data, 1000, 1998);
  const liabilities = leafLines(data, 2000, 2998);
  const equity = leafLines(data, 3000, 3998);
  const income = leafLines(data, 4000, 4998);
  const expenses = leafLines(data, 5000, 5998);

  const reported = {
    assets: {
      current: accountValue(data, 1999, "current"),
      prior: accountValue(data, 1999, "prior"),
    },
    liabilities: {
      current: accountValue(data, 2999, "current"),
      prior: accountValue(data, 2999, "prior"),
    },
    equity: {
      current: accountValue(data, 3999, "current"),
      prior: accountValue(data, 3999, "prior"),
    },
    income: {
      current: accountValue(data, 4999, "current"),
      prior: accountValue(data, 4999, "prior"),
    },
    expenses: {
      current: accountValue(data, 5999, "current"),
      prior: accountValue(data, 5999, "prior"),
    },
    surplus: {
      current: accountValue(data, 6999, "current"),
      prior: accountValue(data, 6999, "prior"),
    },
  };

  const pick = (key: keyof typeof reported, lines: readonly StatementLine[], side: Side): number =>
    reported[key][side] ?? sumLines(lines, side);

  const totals = {
    assets: { current: pick("assets", assets, "current"), prior: pick("assets", assets, "prior") },
    liabilities: {
      current: pick("liabilities", liabilities, "current"),
      prior: pick("liabilities", liabilities, "prior"),
    },
    equity: { current: pick("equity", equity, "current"), prior: pick("equity", equity, "prior") },
    income: { current: pick("income", income, "current"), prior: pick("income", income, "prior") },
    expenses: {
      current: pick("expenses", expenses, "current"),
      prior: pick("expenses", expenses, "prior"),
    },
    surplus: {
      current:
        reported.surplus.current ??
        pick("income", income, "current") - Math.abs(pick("expenses", expenses, "current")),
      prior:
        reported.surplus.prior ??
        pick("income", income, "prior") - Math.abs(pick("expenses", expenses, "prior")),
    },
  };

  return { assets, liabilities, equity, income, expenses, totals, reported };
};

export const kpiOf = (
  kpis: readonly KpiItemResponse[] | undefined,
  name: string,
): KpiItemResponse | undefined => kpis?.find((kpi) => kpi.name.toLowerCase() === name);

export const changePct = (current: number, prior: number | undefined): number | null =>
  prior ? ((current - prior) / Math.abs(prior)) * 100 : null;

export const fmtInt = (value: number | undefined | null): string =>
  value === undefined || value === null || Number.isNaN(value)
    ? "—"
    : value < 0
      ? `(${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })})`
      : value.toLocaleString("en-US", { maximumFractionDigits: 0 });

export const fmtPct = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined || Number.isNaN(value) ? "—" : `${value.toFixed(digits)}%`;

export const fmtChange = (value: number | null): string =>
  value === null ? "—" : value < 0 ? `(${Math.abs(value).toFixed(1)}%)` : `${value.toFixed(1)}%`;

export const fmtMillions = (value: number | undefined): string =>
  value === undefined || Number.isNaN(value) ? "—" : `${(value / 1_000_000).toFixed(1)} m`;
