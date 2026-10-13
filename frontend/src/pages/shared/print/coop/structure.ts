import type { Statement, StatementLine } from "@/pages/shared/print/coop/data";
import type { DonutSlice } from "@/pages/shared/print/tpl/TplTrend";
import { tr } from "@/pages/shared/print/tpl/i18n";

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
      { label: tr("coop.structure.liquid_assets"), value: sumRange(assets, 1101, 1104) },
      { label: tr("coop.structure.net_loans"), value: grossLoans - provisions },
      { label: tr("coop.structure.other_assets"), value: sumRange(assets, 1301, 1306) },
    ],
    funding: [
      {
        label: tr("coop.structure.member_savings_deposits"),
        value: sumRange(liabilities, 2101, 2103),
      },
      { label: tr("coop.structure.borrowings"), value: sumRange(liabilities, 2201, 2202) },
      { label: tr("coop.structure.other_liabilities"), value: sumRange(liabilities, 2301, 2303) },
      { label: tr("coop.structure.member_equity"), value: sumRange(equity, 3101, 3399) },
    ],
  };
};

/** Loan book split by days overdue, from the ledger lines 1201 to 1205. */
export const arrearsAgeOf = (statement: Statement): DonutSlice[] => [
  { label: tr("coop.structure.performing"), value: sumRange(statement.assets, 1201, 1201) },
  { label: tr("coop.structure.days_1_30"), value: sumRange(statement.assets, 1202, 1202) },
  { label: tr("coop.structure.days_31_60"), value: sumRange(statement.assets, 1203, 1203) },
  { label: tr("coop.structure.days_61_90"), value: sumRange(statement.assets, 1204, 1204) },
  { label: tr("coop.structure.over_90"), value: sumRange(statement.assets, 1205, 1205) },
];
