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
import { tr } from "@/pages/shared/print/tpl/i18n";

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
        note: tr("common.on_prior_year", {
          arrow: change.tone === "down" ? "▼" : "▲",
          change: change.text.replace(/^[+-]/, ""),
        }),
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
      title: tr("cons.tiles.membership_inclusion"),
      tiles: [
        {
          label: tr("cons.tiles.members"),
          value: integer(members),
          ...withChange(priorMembers === null ? null : changeOf(members, priorMembers)),
        },
        {
          label: tr("cons.tiles.active_members"),
          value: integer(active),
          note: tr("cons.tiles.of_members", { share: share(active, members) }),
        },
        {
          label: tr("cons.tiles.inactive_members"),
          value: integer(Math.max(members - active, 0)),
          note: tr("cons.tiles.of_members", {
            share: share(Math.max(members - active, 0), members),
          }),
          down: true,
        },
        {
          label: tr("cons.tiles.active_borrowers"),
          value: integer(borrowers),
          ...withChange(priorBorrowers === null ? null : changeOf(borrowers, priorBorrowers)),
        },
        {
          label: tr("cons.tiles.women_borrowers"),
          value: integer(women),
          note: tr("cons.tiles.of_borrowers", { share: share(women, borrowers) }),
        },
        {
          label: tr("cons.tiles.youth_borrowers"),
          value: integer(youth),
          note: tr("cons.tiles.of_borrowers", { share: share(youth, borrowers) }),
        },
        {
          label: tr("cons.tiles.rural_borrowers"),
          value: integer(rural),
          note: tr("cons.tiles.of_borrowers", { share: share(rural, borrowers) }),
        },
      ],
    },
    {
      title: tr("cons.tiles.deposits_lending"),
      tiles: [
        {
          label: tr("cons.tiles.member_deposits"),
          value: money(a.now.deposits),
          ...withChange(a.changes.deposits),
        },
        {
          label: tr("cons.tiles.gross_loans"),
          value: money(a.now.loans),
          ...withChange(a.changes.loans),
        },
        {
          label: tr("cons.tiles.average_loan"),
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
      title: tr("cons.tiles.par_title", { label: last.label }),
      tiles: [
        {
          label: tr("cons.tiles.overdue_31_60"),
          value: money(d31to60),
          note: share(d31to60, last.loans),
        },
        {
          label: tr("cons.tiles.overdue_61_90"),
          value: money(d61to90),
          note: share(d61to90, last.loans),
        },
        {
          label: tr("cons.tiles.over_90"),
          value: money(nonPerforming),
          note: share(nonPerforming, last.loans),
          down: true,
        },
        {
          label: tr("cons.tiles.value_at_risk"),
          value: money(atRisk),
          note: tr("cons.tiles.par30_share", { share: share(atRisk, last.loans) }),
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
  return rest > 0 ? [...head, { label: tr("common.other"), value: rest }] : head;
};
