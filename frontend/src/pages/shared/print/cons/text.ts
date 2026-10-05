import type { Analysis, RatioRow } from "@/pages/shared/print/cons/analysis";
import { integer, money, percent, sumMembers } from "@/pages/shared/print/consolidated/stats";

const AREA: Record<string, string> = {
  par30: "asset quality",
  capital_adequacy_ratio: "capital",
  roa: "earnings",
  roe: "earnings",
  operating_expense_ratio: "efficiency",
  loan_loss_coverage: "provisioning",
};

const OWNER_BY_TIER = {
  Apex: "Cooperatives",
  Federation: "Apexes",
  Ministry: "Ministry supervisors",
} as const;

const unique = <T>(items: T[]): T[] => [...new Set(items)];

const breaches = (ratios: RatioRow[]): RatioRow[] => ratios.filter((r) => r.tone === "bad");

const areaList = (rows: RatioRow[]): string => {
  const names = unique(rows.map((r) => AREA[r.key] ?? r.label.toLowerCase()));
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

export const verdictOf = (a: Analysis): { verdict: string; body: string } => {
  const { filing, ratios, changes, now } = a;
  if (filing.filed === 0) {
    return {
      verdict: "No returns have been filed for this period.",
      body: `None of the ${filing.total} cooperatives in scope has an approved return, so no consolidated figure can be reported.`,
    };
  }
  const filingText =
    filing.rate >= 100
      ? "Full filing compliance"
      : filing.rate >= 75
        ? "Good filing compliance"
        : "Low filing compliance";
  const growth = changes.assets
    ? changes.assets.tone === "up"
      ? "balance-sheet growth"
      : "a shrinking balance sheet"
    : "no prior-year comparison";
  const bad = breaches(ratios.filter((r) => r.avgNow !== null));
  const tail =
    bad.length > 0
      ? `, but the sector breaches the benchmarks for ${areaList(bad)}`
      : ", and the prudential benchmarks are met";
  const body =
    `${filing.filed} of ${filing.total} cooperatives (${filing.rate.toFixed(0)}%) filed. ` +
    `Total assets stand at ${money(now.assets)}${changes.assets ? ` (${changes.assets.text} on the prior year)` : ""} ` +
    `and members number ${integer(now.members)}. ` +
    (bad.length > 0
      ? `${bad.length} of ${ratios.filter((r) => r.avgNow !== null).length} reported average ratios are outside the prudential benchmark. `
      : "All reported average ratios are within the prudential benchmark. ") +
    "Ratios are simple averages of the cooperatives' ratios; aggregate ratios are shown beside them in Section 2.";
  return { verdict: `${filingText} and ${growth}${tail}.`, body };
};

export const strengthsOf = (a: Analysis): string[] => {
  const out: string[] = [];
  const { filing, changes, ratios, now } = a;
  if (filing.total > 0 && filing.rate >= 90)
    out.push(`${filing.filed} of ${filing.total} cooperatives filed (${filing.rate.toFixed(0)}%).`);
  if (changes.assets?.tone === "up")
    out.push(`Total assets grew ${changes.assets.text} to ${money(now.assets)}.`);
  if (changes.loans?.tone === "up")
    out.push(`The gross loan portfolio grew ${changes.loans.text} to ${money(now.loans)}.`);
  if (changes.deposits?.tone === "up")
    out.push(`Member deposits rose ${changes.deposits.text} to ${money(now.deposits)}.`);
  if (changes.members?.tone === "up")
    out.push(`Membership grew ${changes.members.text} to ${integer(now.members)} members.`);
  for (const row of ratios.filter((r) => r.tone === "ok")) {
    out.push(`${row.label} averages ${percent(row.avgNow)}, within the benchmark (${row.bench}).`);
  }
  return out.slice(0, 5);
};

export const concernsOf = (a: Analysis): string[] => {
  const out: string[] = [];
  const { filing, changes, ratios, now } = a;
  for (const row of breaches(ratios)) {
    out.push(`${row.label} averages ${percent(row.avgNow)} against a benchmark of ${row.bench}.`);
  }
  if (filing.notFiled > 0)
    out.push(
      `${filing.notFiled} cooperative${filing.notFiled === 1 ? "" : "s"} did not file and ${filing.notFiled === 1 ? "is" : "are"} excluded from every total.`,
    );
  if (changes.equity?.tone === "down")
    out.push(`Total equity fell ${changes.equity.text.replace("-", "")} to ${money(now.equity)}.`);
  if (changes.surplus?.tone === "down")
    out.push(`Net surplus fell ${changes.surplus.text.replace("-", "")} to ${money(now.surplus)}.`);
  if (now.surplus < 0)
    out.push(`The combined result is a loss of ${money(Math.abs(now.surplus))}.`);
  const unreported = ratios.filter((r) => r.avgNow === null).length;
  if (unreported > 0)
    out.push(
      `${unreported} indicator${unreported === 1 ? " has" : "s have"} no reported figure and cannot be assessed.`,
    );
  return out.slice(0, 5);
};

export interface Recommendation {
  lead: string;
  text: string;
  priority: "High" | "Medium" | "Standard";
  owner: string;
}

const ACTION: Record<string, [string, string]> = {
  par30: [
    "Portfolio quality.",
    "Require remedial plans for cooperatives above 5% PAR >30 days and report progress at the next review.",
  ],
  capital_adequacy_ratio: [
    "Capital restoration.",
    "Require capital-building plans from cooperatives below the 10% capital-to-assets minimum, with quarterly reporting.",
  ],
  roa: [
    "Profitability.",
    "Review lending rates and cost structures so that return on assets moves towards 3%.",
  ],
  roe: [
    "Returns to members.",
    "Review surplus allocation and cost structures so that return on equity moves towards 8%.",
  ],
  operating_expense_ratio: [
    "Efficiency.",
    "Ask cooperatives above the 5% operating-expense benchmark for cost-reduction plans.",
  ],
  loan_loss_coverage: [
    "Provisioning.",
    "Establish loan-loss provisions in line with prudential standards (general 1–2%; specific 100% for loans >90 days).",
  ],
};

export const recommendationsOf = (a: Analysis): Recommendation[] => {
  const owner = OWNER_BY_TIER[a.input.tier];
  const out: Recommendation[] = breaches(a.ratios).map((row) => ({
    lead: ACTION[row.key]?.[0] ?? row.label,
    text: ACTION[row.key]?.[1] ?? `Bring ${row.label.toLowerCase()} within ${row.bench}.`,
    priority:
      row.key === "par30" ||
      row.key === "capital_adequacy_ratio" ||
      row.key === "loan_loss_coverage"
        ? "High"
        : "Medium",
    owner,
  }));
  if (a.filing.notFiled > 0) {
    out.push({
      lead: "Complete reporting.",
      text: `Require the ${a.filing.notFiled} cooperative${a.filing.notFiled === 1 ? "" : "s"} that did not file to submit an approved return.`,
      priority: "Medium",
      owner: a.input.tier === "Apex" ? "Cooperatives" : "Apexes",
    });
  }
  out.push({
    lead: "Inclusion.",
    text:
      "Set targets for credit to women, young people and rural members and report progress by " +
      (a.input.tier === "Apex" ? "cooperative." : "apex."),
    priority: "Standard",
    owner,
  });
  return out;
};

export interface ValidationItem {
  ref: string;
  item: string;
  system: string;
  used: string;
  note: string;
}

const TEST_NAME = /\btest\b|demo|sample/i;

export const validationOf = (a: Analysis): ValidationItem[] => {
  const items: ValidationItem[] = [];
  const add = (item: Omit<ValidationItem, "ref">) =>
    items.push({ ...item, ref: `A${items.length + 1}` });

  const tests = a.coops.filter((c) => TEST_NAME.test(c.name) || TEST_NAME.test(c.apex_name ?? ""));
  if (tests.length > 0) {
    const names = tests
      .slice(0, 3)
      .map((c) => `"${c.name}"`)
      .join(", ");
    add({
      item: "Test entities",
      system: names,
      used: tests.some((c) => c.has_data) ? "Included" : "Not filed",
      note: "Names suggest test records. If they are not real cooperatives, their figures overstate the totals and averages and they should be removed before the report is relied upon.",
    });
  }
  const same =
    a.filed.length > 1 &&
    a.filed.every(
      (c) => c.kpis?.par30 && c.kpis?.npl_ratio && c.kpis.par30.value === c.kpis.npl_ratio.value,
    );
  if (same) {
    add({
      item: "PAR >30 and NPL ratio",
      system: "Identical for every cooperative",
      used: "Reported as submitted",
      note: "The two ratios measure different overdue ranges and are not normally equal. The arrears bucket mapping should be checked.",
    });
  }
  const zeroAssets = a.filed.filter((c) => !(c.kpis?.total_assets?.value > 0));
  if (zeroAssets.length > 0) {
    add({
      item: "Filed without total assets",
      system: `${zeroAssets.length} cooperative${zeroAssets.length === 1 ? "" : "s"}`,
      used: "Ratios not reported",
      note: "The return is marked filed but has no total assets, so ratios cannot be computed for these cooperatives.",
    });
  }
  const members = sumMembers(a.filed);
  if (a.filed.length > 0 && members === 0) {
    add({
      item: "Membership",
      system: "0 members",
      used: "Not reported",
      note: "No membership figures were submitted, so per-member measures are not shown.",
    });
  }
  return items;
};
