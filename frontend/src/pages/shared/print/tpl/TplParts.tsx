import type { ReactNode } from "react";

export type StatusTone = "ok" | "warn" | "bad" | "na";

const STATUS_TEXT: Record<StatusTone, string> = {
  ok: "Meets",
  warn: "Watch",
  bad: "Breach",
  na: "Unverified",
};

export function Pill({ tone, children }: { tone: StatusTone; children?: ReactNode }) {
  return <span className={`st ${tone}`}>{children ?? STATUS_TEXT[tone]}</span>;
}

/** Footnote reference that points to an item in Annex A. */
export function Fn({ id }: { id: string }) {
  return <sup className="fn">{id}</sup>;
}

export interface KpiItem {
  label: string;
  value: string;
  /** Second line: a change or a benchmark. */
  note?: string;
  down?: boolean;
}

export function Kpis({ items }: { items: KpiItem[] }) {
  return (
    <div className="kpis">
      {items.map((item) => (
        <div className="kpi" key={item.label}>
          <span>{item.label}</span>
          <b>{item.value}</b>
          {item.note && <em className={item.down ? "dn" : undefined}>{item.note}</em>}
        </div>
      ))}
    </div>
  );
}

interface OpinionProps {
  label: string;
  verdict: string;
  children: ReactNode;
}

/** The "Overall supervisory view" call-out. */
export function Opinion({ label, verdict, children }: OpinionProps) {
  return (
    <div className="opinion keep">
      <div className="lbl">{label}</div>
      <div className="verdict">{verdict}</div>
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  );
}

export function FindList({ items, red = false }: { items: string[]; red?: boolean }) {
  return (
    <ul className="find">
      {items.map((item) => (
        <li key={item} className={red ? "r" : undefined}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="note keep">
      <b>{title}</b> {children}
    </div>
  );
}

export function Figure({ caption, children }: { caption: ReactNode; children: ReactNode }) {
  return (
    <figure>
      {children}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function SignOff() {
  return (
    <>
      <h3>Approval</h3>
      <div className="sign">
        {["Prepared by", "Reviewed by", "Approved by"].map((role) => (
          <div key={role}>
            <div className="box" />
            {role}
            <span>Name, designation &amp; date</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function EndOfReport() {
  return <div className="eor">END OF REPORT</div>;
}

export const STATUS_LEGEND: { tone: StatusTone; meaning: string }[] = [
  { tone: "ok", meaning: "Indicator is within the prudential benchmark." },
  {
    tone: "warn",
    meaning:
      "Indicator is close to, or marginally outside, the benchmark; monitor in the next review.",
  },
  { tone: "bad", meaning: "Indicator is outside the benchmark and requires corrective action." },
  {
    tone: "na",
    meaning: "Submitted data is inconsistent or incomplete; indicator cannot be relied upon.",
  },
];
