import type { ReactNode } from "react";

import "@/pages/shared/print/tpl/tpl.css";

export interface RunningFrame {
  /** Running header, left. */
  headLeft: string;
  /** Running header, right. */
  headRight: string;
  /** Running footer, left. */
  footLeft: string;
  /** Running footer, centre. */
  footMid: string;
}

interface TplPageProps {
  frame: RunningFrame;
  page: number;
  pages: number;
  children: ReactNode;
}

/** One A4 page with the template's running header and footer. */
export function TplPage({ frame, page, pages, children }: TplPageProps) {
  return (
    <section className="page">
      <div className="run-top">
        <span>{frame.headLeft}</span>
        <span>{frame.headRight}</span>
      </div>
      <div className="body">{children}</div>
      <div className="run-bot">
        <span>{frame.footLeft}</span>
        <span>{frame.footMid}</span>
        <span>
          Page {page} of {pages}
        </span>
      </div>
    </section>
  );
}

interface SecProps {
  no?: string;
  title: string;
  sub?: string;
}

/** Section heading: red number, serif title and a right-aligned tag. */
export function Sec({ no, title, sub }: SecProps) {
  return (
    <div className="sec">
      {no && <span className="no">{no}</span>}
      <h2>{title}</h2>
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}
