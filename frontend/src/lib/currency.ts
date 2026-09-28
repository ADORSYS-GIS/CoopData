/**
 * Currency display for the platform. Per product decision, nothing is
 * converted onto a comparison currency anymore — every amount is shown in
 * the currency the cooperative reported, which is always SZL today.
 */
export const NATIVE_CURRENCY = "SZL";

export type ExchangeRates = Record<string, number>;

/** No longer converts: returns `value` unchanged. Kept so callers built around it did not all need rewriting. */
export const toSzl = (value: number, _currency: string, _rates: ExchangeRates): number => value;

/** Intl inserts a non-breaking space (U+00A0) before a 3-letter currency code; normalized to a regular space so the string matches what it visually looks like. */
const normalizeCurrencySpacing = (formatted: string): string => formatted.replace(/\u00A0/g, " ");

export const formatSzl = (value: number, fractionDigits = 2): string =>
  normalizeCurrencySpacing(
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: NATIVE_CURRENCY,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value),
  );

export const formatNative = (value: number, currency: string): string => {
  try {
    return normalizeCurrencySpacing(
      new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value),
    );
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
};

/** Kept for the reconciliation/audit view; the API never returns one anymore since nothing is converted. */
export interface RateUsed {
  currency_code: string;
  rate_to_zar: number;
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

/** Dead in practice (the API never sends a RateUsed anymore); kept for type safety. */
export const describeRate = (rate: RateUsed): string => {
  const parts: string[] = [];
  if (rate.effective_date) parts.push(`set on ${formatRateDate(rate.effective_date)}`);
  if (rate.source) parts.push(`source: ${rate.source}`);
  parts.push(rate.frozen ? "frozen at approval" : "current rate, not yet frozen");
  return `1 ${rate.currency_code} = ${rate.rate_to_zar} ${rate.currency_code} (${parts.join("; ")})`;
};
