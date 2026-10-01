import type { Analysis } from "@/pages/shared/print/cons/analysis";
import { RATIO_KEYS, ratioMeta } from "@/pages/shared/print/cons/analysis";
import { recommendationsOf, validationOf } from "@/pages/shared/print/cons/text";
import { chunk } from "@/pages/shared/print/consolidated/stats";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { EndOfReport, SignOff } from "@/pages/shared/print/tpl/TplParts";
import { localizePercent, tr } from "@/pages/shared/print/tpl/i18n";

const PRIORITY_CLASS = { High: "h", Medium: "m", Standard: "l" } as const;

export const findingsPage = (a: Analysis, no: string): PageSpec => ({
  toc: { no, title: tr("coop.findings.title") },
  render: () => {
    const recs = recommendationsOf(a);
    const authority = tr(`cons.findings.authority.${a.input.tier}`);
    return (
      <>
        <Sec no={no} title={tr("coop.findings.title")} sub={tr("common.action_plan")} />
        <p>{tr("cons.findings.intro", { authority })}</p>
        <table className="tbl recs">
          <thead>
            <tr>
              <th />
              <th>{tr("common.recommendation")}</th>
              <th style={{ width: "20mm" }}>{tr("common.priority")}</th>
              <th style={{ width: "30mm" }}>{tr("common.owner")}</th>
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
                  <span className={`prio ${PRIORITY_CLASS[rec.priority]}`}>
                    {tr(`common.priorities.${rec.priority}`)}
                  </span>
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
          <p>{items.length > 0 ? tr("cons.annex.a_intro") : tr("cons.annex.a_none")}</p>
        )}
        {rows.length > 0 && (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "12mm" }}>{tr("common.ref")}</th>
                <th style={{ width: "30mm" }}>{tr("common.item")}</th>
                <th style={{ width: "34mm" }}>{tr("common.system_value")}</th>
                <th style={{ width: "28mm" }}>{tr("cons.annex.in_this_report")}</th>
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

/** Definitions beyond the headline ratios: key under `cons.annex.extra` and benchmark. */
const EXTRA_DEFINITIONS: [string, string][] = [
  ["oss", "≥ 110%"],
  ["liquid", "≥ 15%"],
  ["nlp", "70–80%"],
  ["deposits", "70–80%"],
  ["penetration", "—"],
  ["filing", "100%"],
  ["average", "—"],
];

export const annexBPage = (no: string): PageSpec => ({
  toc: { no, title: tr("coop.annex.b_toc") },
  render: () => (
    <>
      <Sec no={no} title={tr("coop.annex.b_title")} sub={tr("common.annex")} />
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: "44mm" }}>{tr("common.indicator")}</th>
            <th>{tr("common.definition")}</th>
            <th className="num" style={{ width: "22mm" }}>
              {tr("common.benchmark")}
            </th>
          </tr>
        </thead>
        <tbody>
          {RATIO_KEYS.map(ratioMeta).map((meta) => (
            <tr key={meta.label}>
              <td>{meta.label}</td>
              <td>{meta.formula}.</td>
              <td className="num">{meta.bench}</td>
            </tr>
          ))}
          {EXTRA_DEFINITIONS.map(([key, bench]) => (
            <tr key={key}>
              <td>{tr(`cons.annex.extra.${key}.name`)}</td>
              <td>{tr(`cons.annex.extra.${key}.definition`)}</td>
              <td className="num">{localizePercent(bench)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="src">{tr("common.pearls_source")}</p>
      <EndOfReport />
    </>
  ),
});
