interface MetricBoxProps {
  label: string;
  /** Formatted value; a dash is shown when absent. */
  value?: string;
  /** Colour for the value (e.g. a KPI status); defaults to the normal text colour. */
  valueClassName?: string;
  /** Small line under the value, such as a benchmark or "not enough data". */
  footnote?: string;
}

/** One figure on the cooperative dashboard. Every box uses this, so they all look the same. */
export function MetricBox({
  label,
  value,
  valueClassName = "text-foreground",
  footnote,
}: MetricBoxProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 hover:shadow-sm transition-shadow">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p
        className={`font-heading text-lg font-bold num ${
          value === undefined ? "text-muted-foreground" : valueClassName
        }`}
      >
        {value ?? "—"}
      </p>
      {footnote && <p className="text-[10px] text-muted-foreground mt-1">{footnote}</p>}
    </div>
  );
}
