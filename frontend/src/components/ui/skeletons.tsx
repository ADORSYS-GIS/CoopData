import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** A row of stat-card placeholders (used on dashboards). */
export function StatCardsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/** A table with a header row and several skeleton body rows. */
export function TableSkeleton({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      <div
        className="grid gap-4 border-b border-border p-4"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-3/4" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4 border-b border-border/60 p-4 last:border-0"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A large chart/panel placeholder. */
export function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

/** A full-page loading layout with header, stat cards, and panels. */
export function PageSkeleton({
  titleWidth = "w-48",
  showStats = true,
  children,
}: {
  titleWidth?: string;
  showStats?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className={cn("h-7", titleWidth)} />
        <Skeleton className="h-9 w-28" />
      </div>
      {showStats && <StatCardsSkeleton />}
      {children ?? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <PanelSkeleton />
            <PanelSkeleton />
          </div>
          <TableSkeleton />
        </>
      )}
    </div>
  );
}
