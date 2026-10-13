import { narrativeText } from "@/lib/questionnaire-report";
import { womenSharePct } from "@/lib/basic-dashboard";
import { IndicatorTable } from "@/pages/shared/print/quest/IndicatorTable";
import {
  PAR30_LIMIT,
  changeNote,
  isDown,
  type QuestAnalysis,
} from "@/pages/shared/print/quest/data";
import { checksOf, concernsOf, strengthsOf, verdictOf } from "@/pages/shared/print/quest/text";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Figure, FindList, Kpis, Opinion, Pill } from "@/pages/shared/print/tpl/TplParts";
import { BarChart, Donut } from "@/pages/shared/print/tpl/TplTrend";
import { INDICATOR_KEYS } from "@/types/basic-dashboard";

const SUMMARY: readonly [string, string][] = [
  ["active_members_pct", "Active members"],
  ["women_members_pct", "Women members"],
  ["savings_account_penetration_pct", "Savings account penetration"],
  ["par_gt_30_pct", "PAR over 30 days"],
  ["delinquent_loan_account_rate_pct", "Delinquent loan accounts"],
  ["agm_attendance_pct", "AGM participation"],
  ["total_operating_margin_pct", "Total operating margin"],
  ["monetary_reserve_coverage_pct", "Monetary reserve coverage"],
];

export const executivePage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Executive Summary" },
  render: () => {
    const { verdict, body } = verdictOf(a);
    const checks = checksOf(a);
    const narrative = narrativeText(a.props.narratives, "executive_summary");
    const rows = [
      {
        label: "PAR over 30 days",
        key: "par_gt_30_pct",
        limit: `max ${PAR30_LIMIT}%`,
        tone: checks.par30,
      },
    ];
    return (
      <>
        <Sec no={no} title="Executive Summary" sub={a.period} />
        <Opinion label="Overall supervisory view" verdict={verdict}>
          {narrative ?? body}
        </Opinion>
        <Kpis
          items={SUMMARY.map(([key, label]) => ({
            label,
            value: a.text(key),
            note: changeNote(a.ind(key)),
            down: isDown(a.ind(key)),
          }))}
        />
        <h3>Supervisory limits</h3>
        <table className="tbl compact">
          <thead>
            <tr>
              <th>Measure</th>
              <th className="num">Reported</th>
              <th className="num">Limit</th>
              <th>Result</th>
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
            <h3>Strengths</h3>
            <FindList
              items={
                strengthsOf(a).length ? strengthsOf(a) : ["No indicator is within its benchmark."]
              }
            />
          </div>
          <div>
            <h3>Concerns</h3>
            <FindList
              red
              items={concernsOf(a).length ? concernsOf(a) : ["No concern identified."]}
            />
          </div>
        </div>
      </>
    );
  },
});

export const membershipPage = (a: QuestAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Membership, Governance & Inclusion" },
  render: () => {
    const d = a.props.dashboard.demographics;
    const narrative = narrativeText(a.props.narratives, "membership_governance");
    const age = [
      { label: "18–25", value: d.age.age_18_25 },
      { label: "26–35", value: d.age.age_26_35 },
      { label: "36–60", value: d.age.age_36_60 },
      { label: "Over 60", value: d.age.age_61_plus },
    ];
    const groups = [
      ["Registered members", d.registered],
      ["Active members", d.active],
      ["Board", d.board],
      ["Executive", d.executive],
      ["Credit committee", d.credit_committee],
    ] as const;
    return (
      <>
        <Sec no={no} title="Membership, Governance & Inclusion" sub={a.period} />
        <p>
          {(d.registered.male + d.registered.female).toLocaleString("en-US")} members are
          registered, of whom {a.text("active_members_pct")} are active. Women are{" "}
          {a.text("women_members_pct")} of members and youth {a.text("youth_members_pct")}.
        </p>
        {narrative && (
          <div className="opinion keep">
            <div className="lbl">Membership insights</div>
            <p style={{ margin: 0 }}>{narrative}</p>
          </div>
        )}
        {(d.registered.male + d.registered.female > 0 || age.some((band) => band.value > 0)) && (
          <div className="two">
            <Figure
              caption={
                <>
                  <b>Figure M1.</b> Registered members by gender.
                </>
              }
            >
              <Donut
                slices={[
                  { label: "Women", value: d.registered.female },
                  { label: "Men", value: d.registered.male },
                ]}
                format={(v) => v.toLocaleString("en-US")}
              />
            </Figure>
            <Figure
              caption={
                <>
                  <b>Figure M2.</b> Registered members by age band.
                </>
              }
            >
              <BarChart
                labels={age.map((b) => b.label)}
                values={age.map((b) => b.value)}
                unit="members"
                format={(v) => String(Math.round(v))}
              />
            </Figure>
          </div>
        )}
        <h3>Gender and governance</h3>
        <table className="tbl compact">
          <thead>
            <tr>
              <th />
              <th className="num">Men</th>
              <th className="num">Women</th>
              <th className="num">Women share</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([label, counts]) => {
              const share = womenSharePct(counts);
              return (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">{counts.male.toLocaleString("en-US")}</td>
                  <td className="num">{counts.female.toLocaleString("en-US")}</td>
                  <td className="num">{share === null ? "—" : `${share.toFixed(1)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <h3>Membership indicators</h3>
        <IndicatorTable a={a} keys={[...INDICATOR_KEYS.membership, ...INDICATOR_KEYS.governance]} />
        {INDICATOR_KEYS.training.some((key) => a.num(key) !== null) && (
          <>
            <h3>Training coverage</h3>
            <IndicatorTable a={a} keys={INDICATOR_KEYS.training} />
          </>
        )}
      </>
    );
  },
});
