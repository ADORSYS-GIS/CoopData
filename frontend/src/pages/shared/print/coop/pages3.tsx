import type { CoopAnalysis } from "@/pages/shared/print/coop/analysis";
import { fmtInt, fmtMillions, fmtPct, kpiOf } from "@/pages/shared/print/coop/data";
import { recommendationsOf } from "@/pages/shared/print/coop/text";
import { ShareBars } from "@/pages/shared/print/tpl/TplCharts";
import type { PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { Sec } from "@/pages/shared/print/tpl/TplPage";
import { Fn, Figure, FindList, Note } from "@/pages/shared/print/tpl/TplParts";

const ARREARS = /arrear|overdue|delinq|non-?perf|npl/i;

export const loanQualityPage = (a: CoopAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Loan Portfolio Quality & Credit Risk" },
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

    return (
      <>
        <Sec no={no} title="Loan Portfolio Quality & Credit Risk" sub="As at 31 December" />
        <p>
          {count > 0
            ? `The loan register records ${fmtInt(count)} loans with a balance of ${fmtInt(balance)}, of which ${fmtInt(inArrears)} (${fmtPct(count > 0 ? (inArrears / count) * 100 : null)}) are in arrears. `
            : "No loan register was submitted for this period. "}
          {gross !== undefined
            ? `The general ledger reports a gross loan portfolio of ${fmtMillions(gross)}.`
            : ""}
        </p>
        {a.props.narratives?.portfolio_quality && (
          <div className="opinion keep">
            <div className="lbl">Portfolio quality</div>
            <p style={{ margin: 0 }}>{a.props.narratives.portfolio_quality}</p>
          </div>
        )}
        <div className="two">
          <div>
            <h3 style={{ marginTop: 0 }}>Portfolio-at-risk (general ledger)</h3>
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>Indicator</th>
                  <th className="num">FY {a.year}</th>
                  <th className="num">Limit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gross loan portfolio</td>
                  <td className="num">{fmtMillions(gross)}</td>
                  <td className="num">—</td>
                </tr>
                <tr>
                  <td>
                    PAR &gt;30 days{a.footnote("par30") && <Fn id={a.footnote("par30") ?? ""} />}
                  </td>
                  <td className="num">{fmtPct(par30?.current ?? null)}</td>
                  <td className="num">≤ 5%</td>
                </tr>
                <tr>
                  <td>PAR &gt;90 days</td>
                  <td className="num">{fmtPct(par90?.current ?? null)}</td>
                  <td className="num">≤ 2%</td>
                </tr>
                <tr>
                  <td>Loan-loss provisions</td>
                  <td className="num">{fmtInt(provisions)}</td>
                  <td className="num">—</td>
                </tr>
                <tr>
                  <td>Loan-loss coverage</td>
                  <td className="num">{fmtPct(coverage?.current ?? null)}</td>
                  <td className="num">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>Loan register (member level)</h3>
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>Indicator</th>
                  <th className="num">FY {a.year}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Loans outstanding</td>
                  <td className="num">{fmtInt(count)}</td>
                </tr>
                <tr>
                  <td>Performing / in arrears</td>
                  <td className="num">
                    {fmtInt(count - inArrears)} / {fmtInt(inArrears)}
                  </td>
                </tr>
                <tr>
                  <td>Arrears rate (by number)</td>
                  <td className="num">{fmtPct(count > 0 ? (inArrears / count) * 100 : null)}</td>
                </tr>
                <tr>
                  <td>Register balance outstanding</td>
                  <td className="num">{fmtInt(balance)}</td>
                </tr>
                <tr>
                  <td>Average loan size</td>
                  <td className="num">{count > 0 ? fmtInt(balance / count) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {categories.length > 0 && (
          <>
            <h3>Loan register by category</h3>
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="num">Loans</th>
                  <th className="num">Balance</th>
                  <th className="num">Share of balance</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.category}>
                    <td>{c.category}</td>
                    <td className="num">{fmtInt(c.count)}</td>
                    <td className="num">{fmtInt(c.balance)}</td>
                    <td className="num">
                      {fmtPct(balance > 0 ? (c.balance / balance) * 100 : null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {conflict && (
          <Note title="Supervisory concern.">
            The general ledger reports no loans overdue more than 30 days, yet {fmtInt(inArrears)}{" "}
            loans are recorded in arrears in the loan register. Until an arrears analysis is
            submitted, asset quality is rated <b>Unverified</b>.
          </Note>
        )}
        <h3>Required actions</h3>
        <FindList red items={actions.map((r) => `${r.lead} ${r.text}`)} />
      </>
    );
  },
});

export const membershipPage = (a: CoopAnalysis, no: string): PageSpec => ({
  toc: { no, title: "Membership, Governance & Inclusion" },
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
    const rows = [
      ...(male + female > 0
        ? [
            {
              label: "Gender",
              segments: [
                { label: "Male", value: male },
                { label: "Female", value: female },
              ],
            },
          ]
        : []),
      ...(youth > 0 && total > 0
        ? [
            {
              label: "Age",
              segments: [
                { label: "Youth 18–35", value: youth },
                { label: "Others", value: Math.max(total - youth, 0) },
              ],
            },
          ]
        : []),
      ...(active + inactive > 0
        ? [
            {
              label: "Status",
              segments: [
                { label: "Active", value: active },
                { label: "Inactive", value: inactive },
              ],
            },
          ]
        : []),
    ];

    return (
      <>
        <Sec no={no} title="Membership, Governance & Inclusion" sub="As at 31 December" />
        <p>
          {total > 0
            ? `The cooperative has ${fmtInt(total)} members, of whom ${fmtPct(total > 0 ? (active / total) * 100 : null)} are active. Women are ${fmtPct(male + female > 0 ? (female / (male + female)) * 100 : null)} of members and youth ${fmtPct(total > 0 ? (youth / total) * 100 : null)}.`
            : "No membership figures were submitted for this period."}
        </p>
        {a.props.narratives?.non_financial && (
          <div className="opinion keep">
            <div className="lbl">Membership insights</div>
            <p style={{ margin: 0 }}>{a.props.narratives.non_financial}</p>
          </div>
        )}
        {rows.length > 0 && (
          <Figure
            caption={
              <>
                <b>Figure 3.</b> Membership profile by gender, age and status (share of members).
              </>
            }
          >
            <ShareBars rows={rows} />
          </Figure>
        )}
        <div className="two">
          <div>
            <h3 style={{ marginTop: 0 }}>Membership</h3>
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>Indicator</th>
                  <th className="num">Number</th>
                  <th className="num">Share</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Total members
                    {a.footnote("members") && <Fn id={a.footnote("members") ?? ""} />}
                  </td>
                  <td className="num">{fmtInt(total)}</td>
                  <td className="num">{total > 0 ? "100.0%" : "—"}</td>
                </tr>
                <tr>
                  <td>Active / inactive</td>
                  <td className="num">
                    {fmtInt(active)} / {fmtInt(inactive)}
                  </td>
                  <td className="num">{fmtPct(total > 0 ? (active / total) * 100 : null)}</td>
                </tr>
                <tr>
                  <td>Women</td>
                  <td className="num">{fmtInt(female)}</td>
                  <td className="num">
                    {fmtPct(male + female > 0 ? (female / (male + female)) * 100 : null)}
                  </td>
                </tr>
                <tr>
                  <td>Youth (18–35)</td>
                  <td className="num">{fmtInt(youth)}</td>
                  <td className="num">{fmtPct(total > 0 ? (youth / total) * 100 : null)}</td>
                </tr>
                <tr>
                  <td>AGM attendance</td>
                  <td className="num">{fmtInt(agm)}</td>
                  <td className="num">{fmtPct(active > 0 ? (agm / active) * 100 : null)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>Savings &amp; deposit products</h3>
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">FY {a.year}</th>
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
                  <td>Total member deposits</td>
                  <td className="num">{fmtInt(deposits)}</td>
                </tr>
                <tr>
                  <td>Average per member</td>
                  <td className="num">{total > 0 ? fmtInt(deposits / total) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="src">
          Governance measures (women and youth in leadership, committee composition) were not part
          of this return. {a.footnote("members") && <Fn id={a.footnote("members") ?? ""} />}
        </p>
      </>
    );
  },
});
