export const DISPLAY_CURRENCY = "USD";

export type ExchangeRates = Record<string, number>;

export const toUsd = (value: number, currency: string, rates: ExchangeRates): number => {
  if (currency === DISPLAY_CURRENCY) return value;
  const rate = rates[currency];
  return rate && rate > 0 ? value / rate : value;
};

export const formatUsd = (value: number, fractionDigits = 2): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: DISPLAY_CURRENCY,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);

export const formatNative = (value: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
};
