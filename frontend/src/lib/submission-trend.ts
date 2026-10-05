export type TrendGranularity = "day" | "week" | "month" | "year";

export interface TrendPoint {
  label: string;
  count: number;
}

interface DatedRecord {
  submitted_at?: string | null;
  created_at?: string | null;
}

const DAYS = 30;
const WEEKS = 12;
const MONTHS = 12;
const YEARS = 5;

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

const startOfWeek = (d: Date): Date => {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
};

interface Bucket {
  key: string;
  label: string;
  count: number;
}

const buildBuckets = (granularity: TrendGranularity, now: Date): Bucket[] => {
  const buckets: Bucket[] = [];
  if (granularity === "day") {
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      buckets.push({
        key: dayKey(d),
        label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        count: 0,
      });
    }
  } else if (granularity === "week") {
    const current = startOfWeek(now);
    for (let i = WEEKS - 1; i >= 0; i--) {
      const d = new Date(current.getFullYear(), current.getMonth(), current.getDate() - i * 7);
      buckets.push({
        key: dayKey(d),
        label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        count: 0,
      });
    }
  } else if (granularity === "month") {
    for (let i = MONTHS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: monthKey(d),
        label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        count: 0,
      });
    }
  } else {
    for (let i = YEARS - 1; i >= 0; i--) {
      const year = now.getFullYear() - i;
      buckets.push({ key: String(year), label: String(year), count: 0 });
    }
  }
  return buckets;
};

const keyFor = (granularity: TrendGranularity, d: Date): string => {
  if (granularity === "day") return dayKey(d);
  if (granularity === "week") return dayKey(startOfWeek(d));
  if (granularity === "month") return monthKey(d);
  return String(d.getFullYear());
};

export function buildSubmissionTrend(
  submissions: DatedRecord[],
  granularity: TrendGranularity = "month",
  now: Date = new Date(),
): TrendPoint[] {
  const buckets = buildBuckets(granularity, now);
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const sub of submissions) {
    const raw = sub.submitted_at ?? sub.created_at;
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const bucket = byKey.get(keyFor(granularity, d));
    if (bucket) bucket.count += 1;
  }

  return buckets.map(({ label, count }) => ({ label, count }));
}
