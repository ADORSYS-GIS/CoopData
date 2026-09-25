import type { Analysis } from "@/pages/shared/print/cons/analysis";
import { RATIO_META } from "@/pages/shared/print/cons/analysis";
import { recommendationsOf, validationOf } from "@/pages/shared/print/cons/text";
import { chunk } from "@/pages/shared/print/consolidated/stats";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { EndOfReport, SignOff } from "@/pages/shared/print/tpl/TplParts";

const PRIORITY_CLASS = { High: "h", Medium: "m", Standard: "l" } as const;

export const findingsPage = (a: Analysis, no: string): PageSpec => ({
  toc: { no, title: "Supervisory Findings & Recommendations" },
  render: () => {
    const recs = recommendationsOf(a);
    const authority =
      a.input.tier === "Ministry"
        ? "the Ministry"
        : a.input.tier === "Federation"
          ? "the federation"
          : "the apex organisation";
    return (
      <>
        <Sec no={no} title="Supervisory Findings & Recommendations" sub="Action plan" />
        <p>
          The following actions are recommended to {authority} and the supervised entities. Progress
          should be reviewed at the next supervisory meeting.
        </p>
        <table className="tbl recs">
          <thead>
            <tr>
              <th />
              <th>Recommendation</th>
              <th style={{ width: "20mm" }}>Priority</th>
              <th style={{ width: "30mm" }}>Owner</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((rec, index) => (
              <tr key={rec.lead + index}>
                <td>{index + 1}</td>
                <td>
                  <b>{rec.lead}</b> {rec.text}
                </td>
                <td>
                  <span className={`prio ${PRIORITY_CLASS[rec.priority]}`}>{rec.priority}</span>
                </td>
                <td>{rec.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <SignOff />
      </>
    );
  },
});

const ROWS_PER_ANNEX_PAGE = 9;

export const annexAPages = (a: Analysis, no: string): PageSpec[] => {
  const items = validationOf(a);
  const pages = chunk(items, ROWS_PER_ANNEX_PAGE);
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
            {items.length > 0
              ? "The following items were identified when reconciling the system-generated figures with the submitted returns. Items are disclosed here so that the figures in the body of this report can be read with care."
              : "No inconsistency was identified when the system-generated figures were checked against the submitted returns."}
          </p>
        )}
        {rows.length > 0 && (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "12mm" }}>Ref.</th>
                <th style={{ width: "30mm" }}>Item</th>
                <th style={{ width: "34mm" }}>System value</th>
                <th style={{ width: "28mm" }}>In this report</th>
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

const EXTRA_DEFINITIONS: [string, string, string][] = [
  ["Operational self-sufficiency", "Total income divided by total expenses.", "≥ 110%"],
  ["Liquid funds ratio", "Cash and short-term investments divided by total assets.", "≥ 15%"],
  ["Net loans / total assets", "Net loan portfolio divided by total assets.", "70–80%"],
  ["Deposits / total assets", "Member savings and deposits divided by total assets.", "70–80%"],
  [
    "Savings / credit penetration",
    "Members holding a savings account (or an active loan) as a share of total members.",
    "—",
  ],
  [
    "Filing rate",
    "Cooperatives with an approved return divided by cooperatives required to file.",
    "100%",
  ],
  [
    "Average vs aggregate",
    "An average is the simple mean of each cooperative's ratio; an aggregate is the ratio of the summed figures. Averages give small cooperatives equal weight.",
    "—",
  ],
];

export const annexBPage = (no: string): PageSpec => ({
  toc: { no, title: "Annex B — Indicator Definitions & Benchmarks" },
  render: () => (
    <>
      <Sec no={no} title="Indicator Definitions & Benchmarks" sub="Annex" />
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: "44mm" }}>Indicator</th>
            <th>Definition</th>
            <th className="num" style={{ width: "22mm" }}>
              Benchmark
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.values(RATIO_META).map((meta) => (
            <tr key={meta.label}>
              <td>{meta.label}</td>
              <td>{meta.formula}.</td>
              <td className="num">{meta.bench}</td>
            </tr>
          ))}
          {EXTRA_DEFINITIONS.map(([name, definition, bench]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{definition}</td>
              <td className="num">{bench}</td>
            </tr>
          ))}
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
