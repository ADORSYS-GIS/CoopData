export const MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

const YEAR_END = [12];

const MONTHS_BY_PERIOD_TYPE: Record<string, readonly number[]> = {
  YEARLY: YEAR_END,
  SEMI_ANNUAL: [6, 12],
  QUARTERLY: [3, 6, 9, 12],
  MONTHLY: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

/**
 * The period ends a comparison can be read at. Cooperatives that all reported
 * the year with one frequency offer that frequency's period ends; a mix of
 * frequencies (or none known) falls back to the year end, the one date every
 * cooperative can answer for.
 */
export const periodEndMonths = (
  periodTypes: ReadonlyArray<string | null | undefined>,
): readonly number[] => {
  const types = new Set(periodTypes.filter((type): type is string => !!type));
  if (types.size !== 1) return YEAR_END;
  const [type] = types;
  return MONTHS_BY_PERIOD_TYPE[type.toUpperCase()] ?? YEAR_END;
};
