import type { CoopAnalysis } from "@/pages/shared/print/coop/analysis";
import { recommendationsOf } from "@/pages/shared/print/coop/text";
import { chunk } from "@/pages/shared/print/consolidated/stats";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { EndOfReport, SignOff } from "@/pages/shared/print/tpl/TplParts";
import { tr } from "@/pages/shared/print/tpl/i18n";

const PRIORITY_CLASS = { High: "h", Medium: "m", Standard: "l" } as const;

export const findingsPage = (a: CoopAnalysis, no: string): PageSpec => ({
  toc: { no, title: tr("coop.findings.title") },
  render: () => {
    const recs = recommendationsOf(a);
    return (
      <>
        <Sec no={no} title={tr("coop.findings.title")} sub={tr("common.action_plan")} />
        <p>{tr("coop.findings.intro", { name: a.props.coopName })}</p>
        <table className="tbl recs">
          <thead>
            <tr>
              <th />
              <th>{tr("common.recommendation")}</th>
              <th style={{ width: "20mm" }}>{tr("common.priority")}</th>
              <th style={{ width: "28mm" }}>{tr("common.timeline")}</th>
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
                  <span className={`prio ${PRIORITY_CLASS[rec.priority]}`}>
                    {tr(`common.priorities.${rec.priority}`)}
                  </span>
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
    toc: index === 0 ? { no, title: tr("coop.annex.a_toc") } : undefined,
    render: () => (
      <>
        <Sec
          no={index === 0 ? no : undefined}
          title={tr("coop.annex.a_title")}
          sub={
            parts.length > 1
              ? tr("common.annex_part_of", { part: index + 1, parts: parts.length })
              : tr("common.annex")
          }
        />
        {index === 0 && (
          <p>{a.validation.length > 0 ? tr("coop.annex.a_intro") : tr("coop.annex.a_none")}</p>
        )}
        {rows.length > 0 && (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "12mm" }}>{tr("common.ref")}</th>
                <th style={{ width: "28mm" }}>{tr("common.item")}</th>
                <th style={{ width: "36mm" }}>{tr("common.system_value")}</th>
                <th style={{ width: "26mm" }}>{tr("coop.annex.used_in_report")}</th>
                <th>{tr("common.observation")}</th>
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
  toc: { no, title: tr("coop.annex.b_toc") },
  render: () => (
    <>
      <Sec no={no} title={tr("coop.annex.b_title")} sub={tr("common.annex")} />
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: "48mm" }}>{tr("common.indicator")}</th>
            <th>{tr("common.definition")}</th>
            <th className="num" style={{ width: "22mm" }}>
              {tr("common.benchmark")}
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
            <td>{tr("coop.annex.penetration")}</td>
            <td>{tr("coop.annex.penetration_def")}</td>
            <td className="num">—</td>
          </tr>
        </tbody>
      </table>
      <p className="src">{tr("common.pearls_source")}</p>
      <EndOfReport />
    </>
  ),
});
