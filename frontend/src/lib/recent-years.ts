/**
 * The current year followed by the previous ones, newest first, as strings for a
 * year picker. Built from the clock so the list rolls forward every January.
 */
export const recentYears = (count: number, now: Date = new Date()): string[] => {
  const current = now.getFullYear();
  return Array.from({ length: Math.max(count, 0) }, (_, i) => String(current - i));
};
