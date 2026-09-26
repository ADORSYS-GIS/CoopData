import type { Statement, StatementLine } from "@/pages/shared/print/coop/data";
import type { DonutSlice } from "@/pages/shared/print/tpl/TplTrend";

const sumRange = (lines: readonly StatementLine[], from: number, to: number): number =>
  lines
    .filter((line) => line.code >= from && line.code <= to)
    .reduce((total, line) => total + (line.current ?? 0), 0);

/** How the balance sheet is made up: what the assets are and what funds them. */
export const compositionOf = (
  statement: Statement,
): { assets: DonutSlice[]; funding: DonutSlice[] } => {
  const { assets, liabilities, equity } = statement;
  const grossLoans = sumRange(assets, 1201, 1205);
  const provisions = Math.abs(sumRange(assets, 1251, 1252));
  return {
    assets: [
      { label: "Liquid assets", value: sumRange(assets, 1101, 1104) },
      { label: "Net loans", value: grossLoans - provisions },
      { label: "Other assets", value: sumRange(assets, 1301, 1306) },
    ],
    funding: [
      { label: "Member savings & deposits", value: sumRange(liabilities, 2101, 2103) },
      { label: "Borrowings", value: sumRange(liabilities, 2201, 2202) },
      { label: "Other liabilities", value: sumRange(liabilities, 2301, 2303) },
      { label: "Member equity", value: sumRange(equity, 3101, 3399) },
    ],
  };
};

/** Loan book split by days overdue, from the ledger lines 1201 to 1205. */
export const arrearsAgeOf = (statement: Statement): DonutSlice[] => [
  { label: "Performing", value: sumRange(statement.assets, 1201, 1201) },
  { label: "1–30 days", value: sumRange(statement.assets, 1202, 1202) },
  { label: "31–60 days", value: sumRange(statement.assets, 1203, 1203) },
  { label: "61–90 days", value: sumRange(statement.assets, 1204, 1204) },
  { label: "Over 90 days", value: sumRange(statement.assets, 1205, 1205) },
];
