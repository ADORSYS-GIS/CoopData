import type { UserProfile } from "@/types/auth";

export interface ServerProfileNames {
  organization_name?: string | null;
  apex_name?: string | null;
  cooperation_name?: string | null;
}

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * The login token only carries the original names of a user's organization
 * and groups, so a later rename never reaches it. The server resolves the
 * current names; this merges them over the token-derived profile.
 */
export function mergeServerNames(profile: UserProfile, names: ServerProfileNames): UserProfile {
  const organizationName = clean(names.organization_name);
  const apexName = clean(names.apex_name);
  const cooperationName = clean(names.cooperation_name);

  const next: UserProfile = { ...profile };

  if (organizationName) {
    next.organizationName = organizationName;
    if (profile.role === "federation") next.region = organizationName;
  }
  if (profile.role === "apex" && apexName) {
    next.cooperationName = apexName;
  } else if (profile.role === "cooperative" && cooperationName) {
    next.cooperationName = cooperationName;
  }
  return next;
}
