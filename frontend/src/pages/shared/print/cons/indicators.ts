import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import type { Analysis } from "@/pages/shared/print/cons/analysis";
import {
  changeOf,
  integer,
  money,
  percent,
  type Change,
} from "@/pages/shared/print/consolidated/stats";
import type { DonutSlice } from "@/pages/shared/print/tpl/TplTrend";
import type { TrendRow } from "@/pages/shared/print/tpl/trend";

export interface Tile {
  label: string;
  value: string;
  note?: string;
  down?: boolean;
}

export interface TileGroup {
  title: string;
  tiles: Tile[];
}

type NfField =
  | "total_members"
  | "active_members"
  | "active_borrowers"
  | "women_borrowers"
  | "youth_borrowers"
  | "rural_borrowers";

const sumNf = (coops: readonly CoopKpiRow[], field: NfField): number =>
  coops
    .filter((coop) => coop.non_financial?.has_data)
    .reduce((total, coop) => total + (coop.non_financial[field] ?? 0), 0);

const share = (part: number, whole: number): string =>
  whole > 0 ? percent((part / whole) * 100) : "—";

const withChange = (change: Change | null): Pick<Tile, "note" | "down"> =>
  change
    ? {
        note: `${change.tone === "down" ? "▼" : "▲"} ${change.text.replace(/^[+-]/, "")} on prior year`,
        down: change.tone === "down",
      }
    : {};

/** Headline counts and amounts for the indicator page, each with its change on the prior year. */
export const tileGroupsOf = (a: Analysis, trend: readonly TrendRow[]): TileGroup[] => {
  const { filed, prior } = a;
  const members = sumNf(filed, "total_members");
  const active = sumNf(filed, "active_members");
  const borrowers = sumNf(filed, "active_borrowers");
  const women = sumNf(filed, "women_borrowers");
  const youth = sumNf(filed, "youth_borrowers");
  const rural = sumNf(filed, "rural_borrowers");
  const priorMembers = prior ? sumNf(prior, "total_members") : null;
  const priorActive = prior ? sumNf(prior, "active_members") : null;
  const priorBorrowers = prior ? sumNf(prior, "active_borrowers") : null;
  const averageLoan = borrowers > 0 ? a.now.loans / borrowers : null;
  const priorAverage =
    a.before && priorBorrowers && priorBorrowers > 0 ? a.before.loans / priorBorrowers : null;

  const groups: TileGroup[] = [
    {
      title: "Membership and inclusion",
      tiles: [
        {
          label: "Members",
          value: integer(members),
          ...withChange(priorMembers === null ? null : changeOf(members, priorMembers)),
        },
        {
          label: "Active members",
          value: integer(active),
          note: `${share(active, members)} of members`,
        },
        {
          label: "Inactive members",
          value: integer(Math.max(members - active, 0)),
          note: `${share(Math.max(members - active, 0), members)} of members`,
          down: true,
        },
        {
          label: "Active borrowers",
          value: integer(borrowers),
          ...withChange(priorBorrowers === null ? null : changeOf(borrowers, priorBorrowers)),
        },
        {
          label: "Women borrowers",
          value: integer(women),
          note: `${share(women, borrowers)} of borrowers`,
        },
        {
          label: "Youth borrowers",
          value: integer(youth),
          note: `${share(youth, borrowers)} of borrowers`,
        },
        {
          label: "Rural borrowers",
          value: integer(rural),
          note: `${share(rural, borrowers)} of borrowers`,
        },
      ],
    },
    {
      title: "Deposits and lending",
      tiles: [
        {
          label: "Member deposits",
          value: money(a.now.deposits),
          ...withChange(a.changes.deposits),
        },
        { label: "Gross loans", value: money(a.now.loans), ...withChange(a.changes.loans) },
        {
          label: "Average loan balance",
          value: averageLoan === null ? "—" : money(averageLoan),
          ...withChange(
            averageLoan !== null && priorAverage !== null
              ? changeOf(averageLoan, priorAverage)
              : null,
          ),
        },
      ],
    },
  ];

  const last = trend[trend.length - 1];
  if (last && last.loans > 0) {
    const { d31to60, d61to90, nonPerforming } = last.overdue;
    const atRisk = d31to60 + d61to90 + nonPerforming;
    groups.push({
      title: `Portfolio at risk, ${last.label} (USD)`,
      tiles: [
        { label: "Overdue 31–60 days", value: money(d31to60), note: share(d31to60, last.loans) },
        { label: "Overdue 61–90 days", value: money(d61to90), note: share(d61to90, last.loans) },
        {
          label: "Over 90 days",
          value: money(nonPerforming),
          note: share(nonPerforming, last.loans),
          down: true,
        },
        {
          label: "Value at risk (>30 days)",
          value: money(atRisk),
          note: `PAR >30 days ${share(atRisk, last.loans)}`,
          down: atRisk > 0,
        },
      ],
    });
  }
  return groups;
};

/** Largest `top` items as slices, the rest folded into "Other". Zero and negative values are dropped. */
export const shareSlices = (
  items: readonly { name: string; value: number }[],
  top = 6,
): DonutSlice[] => {
  const sorted = items.filter((item) => item.value > 0).sort((x, y) => y.value - x.value);
  const head = sorted.slice(0, top).map((item) => ({ label: item.name, value: item.value }));
  const rest = sorted.slice(top).reduce((total, item) => total + item.value, 0);
  return rest > 0 ? [...head, { label: "Other", value: rest }] : head;
};
