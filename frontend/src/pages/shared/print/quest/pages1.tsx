import { narrativeText } from "@/lib/questionnaire-report";
import { womenSharePct } from "@/lib/basic-dashboard";
import { IndicatorTable } from "@/pages/shared/print/quest/IndicatorTable";
import {
  changeNote,
  isDown,
  par30Limit,
  pct,
  type QuestAnalysis,
} from "@/pages/shared/print/quest/data";
import { checksOf, concernsOf, strengthsOf, verdictOf } from "@/pages/shared/print/quest/text";
import { grouped, short, tr } from "@/pages/shared/print/tpl/i18n";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure, FindList, Kpis, Opinion, Pill } from "@/pages/shared/print/tpl/TplParts";
import { BarChart, Donut } from "@/pages/shared/print/tpl/TplTrend";
import { INDICATOR_KEYS } from "@/types/basic-dashboard";

const SUMMARY: readonly string[] = [
  "active_members_pct",
  "women_members_pct",
  "savings_account_penetration_pct",
  "par_gt_30_pct",
  "delinquent_loan_account_rate_pct",
  "agm_attendance_pct",
  "total_operating_margin_pct",
  "monetary_reserve_coverage_pct",
];

export const executivePage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: tr("common.executive_summary") },
  render: () => {
    const { verdict, body } = verdictOf(a);
    const checks = checksOf(a);
    const narrative = narrativeText(a.props.narratives, "executive_summary");
    const rows = [
      {
        label: tr("quest.kpi.par_gt_30_pct"),
        key: "par_gt_30_pct",
        limit: tr("common.max_limit", { value: par30Limit() }),
        tone: checks.par30,
      },
    ];
    return (
      <>
        <Sec no={no} title={tr("common.executive_summary")} sub={a.period} />
        <Opinion label={tr("common.overall_view")} verdict={verdict}>
          {narrative ?? body}
        </Opinion>
        <Kpis
          items={SUMMARY.map((key) => ({
            label: tr(`quest.kpi.${key}`),
            value: a.text(key),
            note: changeNote(a.ind(key)),
            down: isDown(a.ind(key)),
          }))}
        />
        <h3>{tr("quest.supervisory_limits")}</h3>
        <table className="tbl compact">
          <thead>
            <tr>
              <th>{tr("quest.measure")}</th>
              <th className="num">{tr("quest.reported")}</th>
              <th className="num">{tr("common.limit")}</th>
              <th>{tr("quest.result")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="num">{a.text(row.key)}</td>
                <td className="num">{row.limit}</td>
                <td>
                  <Pill tone={row.tone} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="two">
          <div>
            <h3>{tr("common.strengths")}</h3>
            <FindList items={strengthsOf(a).length ? strengthsOf(a) : [tr("common.no_strength")]} />
          </div>
          <div>
            <h3>{tr("quest.concerns")}</h3>
            <FindList
              red
              items={concernsOf(a).length ? concernsOf(a) : [tr("common.no_concern")]}
            />
          </div>
        </div>
      </>
    );
  },
});

export const membershipPage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: tr("quest.membership.title") },
  render: () => {
    const d = a.props.dashboard.demographics;
    const narrative = narrativeText(a.props.narratives, "membership_governance");
    const age = [
      { label: "18–25", value: d.age.age_18_25 },
      { label: "26–35", value: d.age.age_26_35 },
      { label: "36–60", value: d.age.age_36_60 },
      { label: tr("quest.membership.age_over_60"), value: d.age.age_61_plus },
    ];
    const groups = [
      [tr("quest.membership.row_registered"), d.registered],
      [tr("quest.membership.row_active"), d.active],
      [tr("quest.membership.row_board"), d.board],
      [tr("quest.membership.row_executive"), d.executive],
      [tr("quest.membership.row_credit"), d.credit_committee],
    ] as const;
    return (
      <>
        <Sec no={no} title={tr("quest.membership.title")} sub={a.period} />
        <p>
          {tr("quest.membership.summary", {
            members: grouped(d.registered.male + d.registered.female),
            active: a.text("active_members_pct"),
            women: a.text("women_members_pct"),
            youth: a.text("youth_members_pct"),
          })}
        </p>
        {narrative && (
          <div className="opinion keep">
            <div className="lbl">{tr("quest.membership.insights")}</div>
            <p style={{ margin: 0 }}>{narrative}</p>
          </div>
        )}
        {(d.registered.male + d.registered.female > 0 || age.some((band) => band.value > 0)) && (
          <div className="two">
            <Figure
              caption={
                <>
                  <b>{tr("quest.figure", { id: "M1" })}</b> {tr("quest.membership.fig_m1")}
                </>
              }
            >
              <Donut
                slices={[
                  { label: tr("common.women"), value: d.registered.female },
                  { label: tr("common.men"), value: d.registered.male },
                ]}
                format={grouped}
              />
            </Figure>
            <Figure
              caption={
                <>
                  <b>{tr("quest.figure", { id: "M2" })}</b> {tr("quest.membership.fig_m2")}
                </>
              }
            >
              <BarChart
                labels={age.map((b) => b.label)}
                values={age.map((b) => b.value)}
                unit={tr("quest.membership.members_unit")}
                format={(v) => short(Math.round(v), 0)}
              />
            </Figure>
          </div>
        )}
        <h3>{tr("quest.membership.gender_governance")}</h3>
        <table className="tbl compact">
          <thead>
            <tr>
              <th />
              <th className="num">{tr("common.men")}</th>
              <th className="num">{tr("common.women")}</th>
              <th className="num">{tr("quest.membership.women_share")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([label, counts]) => {
              const share = womenSharePct(counts);
              return (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">{grouped(counts.male)}</td>
                  <td className="num">{grouped(counts.female)}</td>
                  <td className="num">{share === null ? "—" : pct(share)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <h3>{tr("quest.membership.indicators")}</h3>
        <IndicatorTable a={a} keys={[...INDICATOR_KEYS.membership, ...INDICATOR_KEYS.governance]} />
        {INDICATOR_KEYS.training.some((key) => a.num(key) !== null) && (
          <>
            <h3>{tr("quest.membership.training")}</h3>
            <IndicatorTable a={a} keys={INDICATOR_KEYS.training} />
          </>
        )}
      </>
    );
  },
});
