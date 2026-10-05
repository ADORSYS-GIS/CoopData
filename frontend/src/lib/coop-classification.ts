export const COOP_TYPES = [
  "sacco",
  "multipurpose",
  "farm",
  "housing",
  "transport",
  "finance",
  "other",
] as const;

export const SECTOR_OPTIONS = [
  "finance",
  "agriculture",
  "housing",
  "transport",
  "manufacturing",
  "other",
] as const;

export type CoopType = (typeof COOP_TYPES)[number];
export type CoopSector = (typeof SECTOR_OPTIONS)[number];

const SECTORS_BY_TYPE: Record<CoopType, readonly CoopSector[]> = {
  sacco: ["finance"],
  finance: ["finance"],
  farm: ["agriculture"],
  housing: ["housing"],
  transport: ["transport"],
  multipurpose: ["other", "manufacturing"],
  other: ["other", "manufacturing"],
};

const DEFAULT_TYPE_BY_SECTOR: Record<CoopSector, CoopType> = {
  finance: "sacco",
  agriculture: "farm",
  housing: "housing",
  transport: "transport",
  manufacturing: "other",
  other: "other",
};

export const sectorForType = (type: string): CoopSector =>
  SECTORS_BY_TYPE[type as CoopType]?.[0] ?? "other";

export const isConsistent = (type: string, sector: string): boolean =>
  SECTORS_BY_TYPE[type as CoopType]?.includes(sector as CoopSector) ?? false;

export const typeForSector = (sector: string, currentType?: string): CoopType => {
  if (currentType && isConsistent(currentType, sector)) return currentType as CoopType;
  return DEFAULT_TYPE_BY_SECTOR[sector as CoopSector] ?? "other";
};
