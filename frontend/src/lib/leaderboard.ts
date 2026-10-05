export interface RankedSplit<T> {
  top: T[];
  bottom: T[];
}

const MAX_PER_SIDE = 5;

/**
 * Best and worst performers for one KPI. Best comes first in `top`, worst first
 * in `bottom`. The two lists never share a row: with fewer than ten rows the
 * list is split in half, and a single row is only ever a top performer.
 */
export const rankPerformers = <T>(
  rows: readonly T[],
  valueOf: (row: T) => number,
  higherIsBetter = true,
): RankedSplit<T> => {
  const direction = higherIsBetter ? -1 : 1;
  const sorted = [...rows].sort((a, b) => direction * (valueOf(a) - valueOf(b)));
  const topCount = Math.min(MAX_PER_SIDE, Math.ceil(sorted.length / 2));
  const bottomCount = Math.min(MAX_PER_SIDE, sorted.length - topCount);

  return {
    top: sorted.slice(0, topCount),
    bottom: sorted.slice(sorted.length - bottomCount).reverse(),
  };
};
