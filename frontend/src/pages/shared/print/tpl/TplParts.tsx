import type { ReactNode } from "react";

import { tr } from "@/pages/shared/print/tpl/i18n";

export type StatusTone = "ok" | "warn" | "bad" | "na";

export function Pill({ tone, children }: { tone: StatusTone; children?: ReactNode }) {
  return <span className={`st ${tone}`}>{children ?? tr(`status.${tone}`)}</span>;
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
      <h3>{tr("signoff.approval")}</h3>
      <div className="sign">
        {[tr("signoff.prepared_by"), tr("signoff.reviewed_by"), tr("signoff.approved_by")].map(
          (role) => (
            <div key={role}>
              <div className="box" />
              {role}
              <span>{tr("signoff.name_designation_date")}</span>
            </div>
          ),
        )}
      </div>
    </>
  );
}

export function EndOfReport() {
  return <div className="eor">{tr("end_of_report")}</div>;
}

const LEGEND_TONES: readonly StatusTone[] = ["ok", "warn", "bad", "na"];

export const statusLegend = (): { tone: StatusTone; meaning: string }[] =>
  LEGEND_TONES.map((tone) => ({ tone, meaning: tr(`legend.${tone}`) }));
