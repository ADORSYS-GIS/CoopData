import type { Analysis, RatioRow } from "@/pages/shared/print/cons/analysis";
import { integer, money, percent, sumMembers } from "@/pages/shared/print/consolidated/stats";
import { listText, percentText, tr } from "@/pages/shared/print/tpl/i18n";

const AREA_KEYS = new Set([
  "par30",
  "capital_adequacy_ratio",
  "roa",
  "roe",
  "operating_expense_ratio",
  "loan_loss_coverage",
]);

const unique = <T>(items: T[]): T[] => [...new Set(items)];

const breaches = (ratios: RatioRow[]): RatioRow[] => ratios.filter((r) => r.tone === "bad");

const areaList = (rows: RatioRow[]): string =>
  listText(
    unique(
      rows.map((r) => (AREA_KEYS.has(r.key) ? tr(`cons.areas.${r.key}`) : r.label.toLowerCase())),
    ),
  );

export const verdictOf = (a: Analysis): { verdict: string; body: string } => {
  const { filing, ratios, changes, now } = a;
  if (filing.filed === 0) {
    return {
      verdict: tr("cons.text.none_filed_verdict"),
      body: tr("cons.text.none_filed_body", { total: filing.total }),
    };
  }
  const filingText =
    filing.rate >= 100
      ? tr("cons.text.filing_full")
      : filing.rate >= 75
        ? tr("cons.text.filing_good")
        : tr("cons.text.filing_low");
  const growth = changes.assets
    ? changes.assets.tone === "up"
      ? tr("cons.text.growth_up")
      : tr("cons.text.growth_down")
    : tr("cons.text.growth_none");
  const reported = ratios.filter((r) => r.avgNow !== null);
  const bad = breaches(reported);
  const tail =
    bad.length > 0 ? tr("cons.text.breaches", { areas: areaList(bad) }) : tr("cons.text.all_met");
  const body =
    tr("cons.text.filed", {
      filed: filing.filed,
      total: filing.total,
      rate: percentText(filing.rate, 0),
    }) +
    (changes.assets
      ? tr("cons.text.assets_change", { value: money(now.assets), change: changes.assets.text })
      : tr("cons.text.assets", { value: money(now.assets) })) +
    tr("cons.text.members", { value: integer(now.members) }) +
    (bad.length > 0
      ? tr("cons.text.ratios_out", { count: bad.length, total: reported.length })
      : tr("cons.text.ratios_in")) +
    tr("cons.text.averages_note");
  return { verdict: tr("cons.text.verdict", { filing: filingText, growth, tail }), body };
};

export const strengthsOf = (a: Analysis): string[] => {
  const out: string[] = [];
  const { filing, changes, ratios, now } = a;
  if (filing.total > 0 && filing.rate >= 90)
    out.push(
      tr("cons.text.strength_filed", {
        filed: filing.filed,
        total: filing.total,
        rate: percentText(filing.rate, 0),
      }),
    );
  if (changes.assets?.tone === "up")
    out.push(
      tr("cons.text.strength_assets", { change: changes.assets.text, value: money(now.assets) }),
    );
  if (changes.loans?.tone === "up")
    out.push(
      tr("cons.text.strength_loans", { change: changes.loans.text, value: money(now.loans) }),
    );
  if (changes.deposits?.tone === "up")
    out.push(
      tr("cons.text.strength_deposits", {
        change: changes.deposits.text,
        value: money(now.deposits),
      }),
    );
  if (changes.members?.tone === "up")
    out.push(
      tr("cons.text.strength_members", {
        change: changes.members.text,
        value: integer(now.members),
      }),
    );
  for (const row of ratios.filter((r) => r.tone === "ok")) {
    out.push(
      tr("cons.text.strength_ratio", {
        label: row.label,
        value: percent(row.avgNow),
        bench: row.bench,
      }),
    );
  }
  return out.slice(0, 5);
};

export const concernsOf = (a: Analysis): string[] => {
  const out: string[] = [];
  const { filing, changes, ratios, now } = a;
  for (const row of breaches(ratios)) {
    out.push(
      tr("cons.text.concern_ratio", {
        label: row.label,
        value: percent(row.avgNow),
        bench: row.bench,
      }),
    );
  }
  if (filing.notFiled > 0) out.push(tr("cons.text.concern_not_filed", { count: filing.notFiled }));
  if (changes.equity?.tone === "down")
    out.push(
      tr("cons.text.concern_equity", {
        change: changes.equity.text.replace("-", ""),
        value: money(now.equity),
      }),
    );
  if (changes.surplus?.tone === "down")
    out.push(
      tr("cons.text.concern_surplus", {
        change: changes.surplus.text.replace("-", ""),
        value: money(now.surplus),
      }),
    );
  if (now.surplus < 0)
    out.push(tr("cons.text.concern_loss", { value: money(Math.abs(now.surplus)) }));
  const unreported = ratios.filter((r) => r.avgNow === null).length;
  if (unreported > 0) out.push(tr("cons.text.concern_unreported", { count: unreported }));
  return out.slice(0, 5);
};

export type Priority = "High" | "Medium" | "Standard";

export interface Recommendation {
  lead: string;
  text: string;
  priority: Priority;
  owner: string;
}

const ACTION_KEYS = new Set(AREA_KEYS);

export const recommendationsOf = (a: Analysis): Recommendation[] => {
  const tier = a.input.tier;
  const owner = tr(`cons.owners.${tier}`);
  const out: Recommendation[] = breaches(a.ratios).map((row) => ({
    lead: ACTION_KEYS.has(row.key) ? tr(`cons.actions.${row.key}.lead`) : row.label,
    text: ACTION_KEYS.has(row.key)
      ? tr(`cons.actions.${row.key}.text`)
      : tr("cons.actions.generic", { label: row.label.toLowerCase(), bench: row.bench }),
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
      lead: tr("cons.actions.reporting_lead"),
      text: tr("cons.actions.reporting", { count: a.filing.notFiled }),
      priority: "Medium",
      owner: tr(tier === "Apex" ? "cons.owners.Apex" : "cons.owners.Federation"),
    });
  }
  out.push({
    lead: tr("cons.actions.inclusion_lead"),
    text: tr(tier === "Apex" ? "cons.actions.inclusion_apex" : "cons.actions.inclusion"),
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
      item: tr("cons.validation.test_entities"),
      system: names,
      used: tests.some((c) => c.has_data)
        ? tr("cons.validation.included")
        : tr("cons.validation.not_filed"),
      note: tr("cons.validation.test_note"),
    });
  }
  const same =
    a.filed.length > 1 &&
    a.filed.every(
      (c) => c.kpis?.par30 && c.kpis?.npl_ratio && c.kpis.par30.value === c.kpis.npl_ratio.value,
    );
  if (same) {
    add({
      item: tr("cons.validation.par_npl"),
      system: tr("cons.validation.identical"),
      used: tr("cons.validation.as_submitted"),
      note: tr("cons.validation.par_npl_note"),
    });
  }
  const zeroAssets = a.filed.filter((c) => !(c.kpis?.total_assets?.value > 0));
  if (zeroAssets.length > 0) {
    add({
      item: tr("cons.validation.no_assets"),
      system: tr("cons.validation.no_assets_count", { count: zeroAssets.length }),
      used: tr("cons.validation.ratios_not_reported"),
      note: tr("cons.validation.no_assets_note"),
    });
  }
  const members = sumMembers(a.filed);
  if (a.filed.length > 0 && members === 0) {
    add({
      item: tr("cons.validation.membership"),
      system: tr("cons.validation.zero_members"),
      used: tr("cons.validation.not_reported"),
      note: tr("cons.validation.membership_note"),
    });
  }
  return items;
};
