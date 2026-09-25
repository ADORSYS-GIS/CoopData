import type { CoopAnalysis } from "@/pages/shared/print/coop/analysis";
import { recommendationsOf } from "@/pages/shared/print/coop/text";
import { chunk } from "@/pages/shared/print/consolidated/stats";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { EndOfReport, SignOff } from "@/pages/shared/print/tpl/TplParts";

const PRIORITY_CLASS = { High: "h", Medium: "m", Standard: "l" } as const;

export const findingsPage = (a: CoopAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Supervisory Findings & Recommendations" },
  render: () => {
    const recs = recommendationsOf(a);
    return (
      <>
        <Sec no={no} title="Supervisory Findings & Recommendations" sub="Action plan" />
        <p>
          The following actions are recommended to the Board and management of {a.props.coopName}.
          Progress should be reported with the next quarterly return.
        </p>
        <table className="tbl recs">
          <thead>
            <tr>
              <th />
              <th>Recommendation</th>
              <th style={{ width: "20mm" }}>Priority</th>
              <th style={{ width: "28mm" }}>Timeline</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((rec, index) => (
              <tr key={rec.lead}>
                <td>{index + 1}</td>
                <td>
                  <b>{rec.lead}</b> {rec.text}
                </td>
                <td>
                  <span className={`prio ${PRIORITY_CLASS[rec.priority]}`}>{rec.priority}</span>
                </td>
                <td>{rec.timeline}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <SignOff />
      </>
    );
  },
});

const ROWS_PER_PAGE = 8;

export const annexAPages = (a: CoopAnalysis, no: string): PageSpec[] => {
  const pages = chunk(a.validation, ROWS_PER_PAGE);
  const parts = pages.length > 0 ? pages : [[]];
  return parts.map((rows, index): PageSpec => ({
    toc: index === 0 ? { no, title: "Annex A — Data Validation & Corrections" } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title="Data Validation & Corrections"
          sub={parts.length > 1 ? `Annex · part ${index + 1} of ${parts.length}` : "Annex"}
        />
        {index === 0 && (
          <p>
            {a.validation.length > 0
              ? "The following items were identified when reconciling the system-generated figures with the submitted statements. Items marked with a reference in the body of the report are explained here."
              : "The system-generated figures were checked against the submitted statements and no inconsistency was identified."}
          </p>
        )}
        {rows.length > 0 && (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "12mm" }}>Ref.</th>
                <th style={{ width: "28mm" }}>Item</th>
                <th style={{ width: "36mm" }}>System value</th>
                <th style={{ width: "26mm" }}>Used in report</th>
                <th>Observation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ref}>
                  <td>
                    <b>{row.ref}</b>
                  </td>
                  <td>{row.item}</td>
                  <td>{row.system}</td>
                  <td>{row.used}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    ),
  }));
};

export const annexBPage = (a: CoopAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Annex B — Indicator Definitions & Benchmarks" },
  render: () => (
    <>
      <Sec no={no} title="Indicator Definitions & Benchmarks" sub="Annex" />
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: "48mm" }}>Indicator</th>
            <th>Definition</th>
            <th className="num" style={{ width: "22mm" }}>
              Benchmark
            </th>
          </tr>
        </thead>
        <tbody>
          {a.scorecard.map((row) => (
            <tr key={row.key}>
              <td>{row.label}</td>
              <td>{row.formula}.</td>
              <td className="num">{row.bench}</td>
            </tr>
          ))}
          <tr>
            <td>Savings / credit penetration</td>
            <td>
              Members holding a savings account (or an active loan) as a share of total members.
            </td>
            <td className="num">—</td>
          </tr>
        </tbody>
      </table>
      <p className="src">
        Benchmarks follow the WOCCU PEARLS monitoring system as configured on the Coop Data
        platform. Supervisory authorities may apply stricter national prudential limits.
      </p>
      <EndOfReport />
    </>
  ),
});
