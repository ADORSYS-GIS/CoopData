export interface LandingStat {
  readonly labelKey: string;
  readonly value: number;
  readonly decimals: number;
  readonly prefix?: string;
  readonly suffix?: string;
}

export const LANDING_STATS: readonly LandingStat[] = [
  { labelKey: "landing.hero.statRegCoops", value: 653, decimals: 0 },
  { labelKey: "landing.hero.statActiveMembers", value: 82600, decimals: 0 },
  {
    labelKey: "landing.hero.statCombinedAssets",
    value: 3.6,
    decimals: 1,
    prefix: "SZL ",
    suffix: "B",
  },
];

export const LANDING_SECTIONS = [
  { id: "sectors", labelKey: "landing.sectors.badge" },
  { id: "capabilities", labelKey: "landing.capabilities.badge" },
  { id: "faq", labelKey: "landing.faq.badge" },
] as const;

export const LANDING_FOOTER_SECTIONS = [
  { id: "mission", labelKey: "landing.mission.badge" },
  { id: "how-it-works", labelKey: "landing.howItWorks.badge" },
  { id: "sectors", labelKey: "landing.sectors.badge" },
  { id: "capabilities", labelKey: "landing.capabilities.badge" },
  { id: "announcements", labelKey: "landing.announcements.badge" },
  { id: "faq", labelKey: "landing.faq.badge" },
] as const;
