import type { CoopAnalysis } from "@/pages/shared/print/coop/analysis";
import { fmtInt, fmtMillions, fmtPct, kpiOf } from "@/pages/shared/print/coop/data";
import { recommendationsOf } from "@/pages/shared/print/coop/text";
import { arrearsAgeOf } from "@/pages/shared/print/coop/structure";
import { ShareBars } from "@/pages/shared/print/tpl/TplCharts";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Fn, Figure, FindList, Note } from "@/pages/shared/print/tpl/TplParts";
import { BarChart, Donut } from "@/pages/shared/print/tpl/TplTrend";
import { percentText, short, tr } from "@/pages/shared/print/tpl/i18n";

const ARREARS = /arrear|overdue|delinq|non-?perf|npl/i;

export const loanQualityPage = (a: CoopAnalysis, no: string): PageSpec => ({
  toc: { no, title: tr("coop.loans.title") },
  render: () => {
    const kpis = a.props.kpisData.kpis;
    const categories = a.props.portfolioData.categories;
    const gross = kpiOf(kpis, "gross_loan_portfolio")?.value;
    const coverage = a.scorecard.find((r) => r.key === "loan_loss_coverage");
    const par30 = a.scorecard.find((r) => r.key === "par30");
    const par90 = a.scorecard.find((r) => r.key === "par90");
    const provisions = a.statement.assets
      .filter((l) => l.code >= 1250 && l.code <= 1299)
      .reduce((s, l) => s + Math.abs(l.current ?? 0), 0);
    const count = categories.reduce((s, c) => s + c.count, 0);
    const balance = categories.reduce((s, c) => s + c.balance, 0);
    const inArrears = categories
      .filter((c) => ARREARS.test(c.category))
      .reduce((s, c) => s + c.count, 0);
    const conflict = (par30?.current ?? 0) === 0 && inArrears > 0;
    const actions = recommendationsOf(a).slice(0, 4);
    const ageing = arrearsAgeOf(a.statement);
    const hasAgeing = ageing.some((slice) => slice.value > 0);

    return (
      <>
        <Sec no={no} title={tr("coop.loans.title")} sub={tr("common.as_at_31_december")} />
        <p>
          {count > 0
            ? tr("coop.loans.register", {
                loans: fmtInt(count),
                balance: fmtInt(balance),
                arrears: fmtInt(inArrears),
                share: fmtPct(count > 0 ? (inArrears / count) * 100 : null),
              })
            : tr("coop.loans.no_register")}
          {gross !== undefined ? tr("coop.loans.ledger", { value: fmtMillions(gross) }) : ""}
        </p>
        {a.props.narratives?.portfolio_quality && (
          <div className="opinion keep">
            <div className="lbl">{tr("coop.loans.portfolio_quality")}</div>
            <p style={{ margin: 0 }}>{a.props.narratives.portfolio_quality}</p>
          </div>
        )}
        <div className="two">
          <div>
            <h3 style={{ marginTop: 0 }}>{tr("coop.loans.par_gl")}</h3>
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>{tr("common.indicator")}</th>
                  <th className="num">{tr("common.fy", { year: a.year })}</th>
                  <th className="num">{tr("common.limit")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{tr("coop.loans.gross_loan_portfolio")}</td>
                  <td className="num">{fmtMillions(gross)}</td>
                  <td className="num">—</td>
                </tr>
                <tr>
                  <td>
                    {tr("coop.loans.par30")}
                    {a.footnote("par30") && <Fn id={a.footnote("par30") ?? ""} />}
                  </td>
                  <td className="num">{fmtPct(par30?.current ?? null)}</td>
                  <td className="num">≤ {percentText(5, 0)}</td>
                </tr>
                <tr>
                  <td>{tr("coop.loans.par90")}</td>
                  <td className="num">{fmtPct(par90?.current ?? null)}</td>
                  <td className="num">≤ {percentText(2, 0)}</td>
                </tr>
                <tr>
                  <td>{tr("coop.loans.provisions")}</td>
                  <td className="num">{fmtInt(provisions)}</td>
                  <td className="num">—</td>
                </tr>
                <tr>
                  <td>{tr("coop.loans.coverage")}</td>
                  <td className="num">{fmtPct(coverage?.current ?? null)}</td>
                  <td className="num">{percentText(100, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>{tr("coop.loans.register_title")}</h3>
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>{tr("common.indicator")}</th>
                  <th className="num">{tr("common.fy", { year: a.year })}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{tr("coop.loans.outstanding")}</td>
                  <td className="num">{fmtInt(count)}</td>
                </tr>
                <tr>
                  <td>{tr("coop.loans.performing_arrears")}</td>
                  <td className="num">
                    {fmtInt(count - inArrears)} / {fmtInt(inArrears)}
                  </td>
                </tr>
                <tr>
                  <td>{tr("coop.loans.arrears_rate")}</td>
                  <td className="num">{fmtPct(count > 0 ? (inArrears / count) * 100 : null)}</td>
                </tr>
                <tr>
                  <td>{tr("coop.loans.register_balance")}</td>
                  <td className="num">{fmtInt(balance)}</td>
                </tr>
                <tr>
                  <td>{tr("coop.loans.average_size")}</td>
                  <td className="num">{count > 0 ? fmtInt(balance / count) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {(hasAgeing || categories.length > 0) && (
          <div className="two">
            {hasAgeing ? (
              <Figure
                caption={
                  <>
                    <b>{tr("coop.loans.fig_l1")}</b> {tr("coop.loans.fig_l1_caption")}
                  </>
                }
              >
                <Donut slices={ageing} format={fmtInt} />
              </Figure>
            ) : (
              <div />
            )}
            {categories.length > 0 && (
              <div>
                <h3 style={{ marginTop: 0 }}>{tr("coop.loans.by_category")}</h3>
                <table className="tbl compact">
                  <thead>
                    <tr>
                      <th>{tr("coop.loans.category")}</th>
                      <th className="num">{tr("coop.loans.loans")}</th>
                      <th className="num">{tr("coop.loans.balance")}</th>
                      <th className="num">{tr("coop.loans.share_balance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.category}>
                        <td>
                          {tr(`coop.loans.categories.${c.category}`, {
                            defaultValue: c.category,
                          })}
                        </td>
                        <td className="num">{fmtInt(c.count)}</td>
                        <td className="num">{fmtInt(c.balance)}</td>
                        <td className="num">
                          {fmtPct(balance > 0 ? (c.balance / balance) * 100 : null)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {conflict && (
          <Note title={tr("coop.loans.concern_title")}>
            {tr("coop.loans.concern", { loans: fmtInt(inArrears) })}{" "}
            <b>{tr("coop.loans.unverified")}</b>.
          </Note>
        )}
        <h3>{tr("coop.loans.required_actions")}</h3>
        <FindList red items={actions.map((r) => `${r.lead} ${r.text}`)} />
      </>
    );
  },
});

export const membershipPage = (a: CoopAnalysis, no: string): PageSpec => ({
  toc: { no, title: tr("coop.membership.title") },
  render: () => {
    const m = a.props.membershipData;
    const male = m.male_members ?? 0;
    const female = m.female_members ?? 0;
    const active = m.active_members ?? 0;
    const inactive = m.inactive_members ?? 0;
    const youth = m.youth_members ?? 0;
    const total = active + inactive || male + female;
    const agm = m.agm_attendance ?? 0;
    const savingsLines = a.statement.liabilities.filter((l) => l.code >= 2100 && l.code <= 2199);
    const deposits = savingsLines.reduce((s, l) => s + (l.current ?? 0), 0);
    const bands = a.props.nfStats?.membership;
    const ageBands = bands
      ? [
          { label: tr("coop.membership.under_18"), value: bands.under_18 },
          { label: "18–35", value: bands.age_18_35 },
          { label: "36–50", value: bands.age_36_50 },
          { label: tr("coop.membership.over_50"), value: bands.over_50 },
        ]
      : [];
    const hasAgeBands = ageBands.some((band) => band.value > 0);
    const rows = [
      ...(male + female > 0
        ? [
            {
              label: tr("common.gender"),
              segments: [
                { label: tr("common.male"), value: male },
                { label: tr("common.female"), value: female },
              ],
            },
          ]
        : []),
      ...(youth > 0 && total > 0
        ? [
            {
              label: tr("common.age"),
              segments: [
                { label: tr("coop.membership.youth_18_35"), value: youth },
                { label: tr("common.others"), value: Math.max(total - youth, 0) },
              ],
            },
          ]
        : []),
      ...(active + inactive > 0
        ? [
            {
              label: tr("common.status"),
              segments: [
                { label: tr("common.active"), value: active },
                { label: tr("common.inactive"), value: inactive },
              ],
            },
          ]
        : []),
    ];

    return (
      <>
        <Sec no={no} title={tr("coop.membership.title")} sub={tr("common.as_at_31_december")} />
        <p>
          {total > 0
            ? tr("coop.membership.summary", {
                name: a.props.coopName,
                total: fmtInt(total),
                active: fmtPct(total > 0 ? (active / total) * 100 : null),
                women: fmtPct(male + female > 0 ? (female / (male + female)) * 100 : null),
                youth: fmtPct(total > 0 ? (youth / total) * 100 : null),
              })
            : tr("coop.membership.none")}
        </p>
        {a.props.narratives?.non_financial && (
          <div className="opinion keep">
            <div className="lbl">{tr("coop.membership.insights")}</div>
            <p style={{ margin: 0 }}>{a.props.narratives.non_financial}</p>
          </div>
        )}
        {hasAgeBands && male + female > 0 ? (
          <div className="two">
            <Figure
              caption={
                <>
                  <b>{tr("coop.membership.fig_m1")}</b> {tr("coop.membership.fig_m1_caption")}
                </>
              }
            >
              <Donut
                slices={[
                  { label: tr("common.women"), value: female },
                  { label: tr("common.men"), value: male },
                ]}
                format={fmtInt}
              />
            </Figure>
            <Figure
              caption={
                <>
                  <b>{tr("coop.membership.fig_m2")}</b> {tr("coop.membership.fig_m2_caption")}
                </>
              }
            >
              <BarChart
                unit={tr("coop.membership.members_unit")}
                format={(value) => short(Math.round(value), 0)}
                labels={ageBands.map((band) => band.label)}
                values={ageBands.map((band) => band.value)}
              />
            </Figure>
          </div>
        ) : (
          rows.length > 0 && (
            <Figure
              caption={
                <>
                  <b>{tr("coop.membership.fig_3")}</b> {tr("coop.membership.fig_3_caption")}
                </>
              }
            >
              <ShareBars rows={rows} />
            </Figure>
          )
        )}
        <div className="two">
          <div>
            <h3 style={{ marginTop: 0 }}>{tr("coop.membership.membership")}</h3>
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>{tr("common.indicator")}</th>
                  <th className="num">{tr("common.number")}</th>
                  <th className="num">{tr("common.share")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    {tr("coop.membership.total_members")}
                    {a.footnote("members") && <Fn id={a.footnote("members") ?? ""} />}
                  </td>
                  <td className="num">{fmtInt(total)}</td>
                  <td className="num">{total > 0 ? fmtPct(100) : "—"}</td>
                </tr>
                <tr>
                  <td>{tr("coop.membership.active_inactive")}</td>
                  <td className="num">
                    {fmtInt(active)} / {fmtInt(inactive)}
                  </td>
                  <td className="num">{fmtPct(total > 0 ? (active / total) * 100 : null)}</td>
                </tr>
                <tr>
                  <td>{tr("common.women")}</td>
                  <td className="num">{fmtInt(female)}</td>
                  <td className="num">
                    {fmtPct(male + female > 0 ? (female / (male + female)) * 100 : null)}
                  </td>
                </tr>
                <tr>
                  <td>{tr("coop.membership.youth")}</td>
                  <td className="num">{fmtInt(youth)}</td>
                  <td className="num">{fmtPct(total > 0 ? (youth / total) * 100 : null)}</td>
                </tr>
                <tr>
                  <td>{tr("coop.membership.agm")}</td>
                  <td className="num">{fmtInt(agm)}</td>
                  <td className="num">{fmtPct(active > 0 ? (agm / active) * 100 : null)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>{tr("coop.membership.savings_products")}</h3>
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>{tr("coop.membership.product")}</th>
                  <th className="num">{tr("common.fy", { year: a.year })}</th>
                </tr>
              </thead>
              <tbody>
                {savingsLines.map((l) => (
                  <tr key={l.code}>
                    <td>{l.name}</td>
                    <td className="num">{fmtInt(l.current)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>{tr("coop.membership.total_deposits")}</td>
                  <td className="num">{fmtInt(deposits)}</td>
                </tr>
                <tr>
                  <td>{tr("coop.membership.average_per_member")}</td>
                  <td className="num">{total > 0 ? fmtInt(deposits / total) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="src">
          {tr("coop.membership.governance_note")}{" "}
          {a.footnote("members") && <Fn id={a.footnote("members") ?? ""} />}
        </p>
      </>
    );
  },
});
