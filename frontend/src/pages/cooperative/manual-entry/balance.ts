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
