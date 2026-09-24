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

export interface RateUsed {
  currency_code: string;
  rate_to_usd: number;
  effective_date?: string | null;
  source?: string | null;
  frozen: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatRateDate = (iso: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
};

export const describeRate = (rate: RateUsed): string => {
  const parts: string[] = [];
  if (rate.effective_date) parts.push(`set on ${formatRateDate(rate.effective_date)}`);
  if (rate.source) parts.push(`source: ${rate.source}`);
  parts.push(rate.frozen ? "frozen at approval" : "current rate, not yet frozen");
  return `Converted at 1 USD = ${rate.rate_to_usd} ${rate.currency_code} (${parts.join("; ")})`;
};
