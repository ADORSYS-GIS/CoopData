import type { ReactNode } from "react";

import { Pill, STATUS_LEGEND } from "@/pages/shared/print/tpl/TplParts";
import { Sec } from "@/pages/shared/print/tpl/TplPage";

interface CoverProps {
  kicker: string;
  /** Title lines; each is put on its own line. */
  title: string[];
  entity: string;
  entityNote: string;
  badge: string;
  meta: { label: string; value: ReactNode }[];
  footLeft: string;
  footRight: string;
}

export function TplCover({
  kicker,
  title,
  entity,
  entityNote,
  badge,
  meta,
  footLeft,
  footRight,
}: CoverProps) {
  return (
    <section className="cover">
      <div className="band">
        <i />
      </div>
      <div className="frame" />
      <img className="logo" src="/coopdatalogo.png" alt="Coop Data" />
      <div className="class">{badge}</div>
      <div className="title">
        <div className="kicker">{kicker}</div>
        <h1>
          {title.map((line, index) => (
            <span key={line}>
              {index > 0 && <br />}
              {line}
            </span>
          ))}
        </h1>
        <div className="rule" />
        <div className="entity">
          {entity}
          <small>{entityNote}</small>
        </div>
      </div>
      <div className="meta">
        {meta.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <b>{item.value}</b>
          </div>
        ))}
      </div>
      <div className="foot">
        <span>{footLeft}</span>
        <span>{footRight}</span>
      </div>
    </section>
  );
}

export interface TocEntry {
  no: string;
  title: string;
  page: number;
}

interface FrontMatterProps {
  particulars: [string, string, string, string][];
  toc: TocEntry[];
  basis: string;
  basisTitle?: string;
}

/** Document Control, Contents, Basis of preparation and Status legend. */
export function FrontMatter({
  particulars,
  toc,
  basis,
  basisTitle = "Basis of preparation",
}: FrontMatterProps) {
  return (
    <>
      <Sec title="Document Control" sub="Report particulars" />
      <table className="kv">
        <tbody>
          {particulars.map(([k1, v1, k2, v2]) => (
            <tr key={k1}>
              <td className="k">{k1}</td>
              <td className="v">{v1}</td>
              <td className="k">{k2}</td>
              <td className="v">{v2}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Contents</h3>
      <table className="toc">
        <tbody>
          {toc.map((entry) => (
            <tr key={entry.no}>
              <td className="n">{entry.no}</td>
              <td>{entry.title}</td>
              <td className="p">{entry.page}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{basisTitle}</h3>
      <p>{basis}</p>

      <h3>Status legend</h3>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: "26mm" }}>Status</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {STATUS_LEGEND.map((row) => (
            <tr key={row.tone}>
              <td>
                <Pill tone={row.tone} />
              </td>
              <td>{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
