import { useAuth } from "@/context/AuthContext";
import { useMyCooperativeProfile } from "./useCooperatives";

/** Standard analytics pages and their questionnaire ("basic") counterparts. */
const PAGE_PAIRS: Record<string, string> = {
  "/app/analytics": "/app/basic-analytics",
  "/app/benchmarking": "/app/basic-benchmarking",
};
const STANDARD_PAGES = Object.keys(PAGE_PAIRS);
const BASIC_PAGES = Object.values(PAGE_PAIRS);

/**
 * Which analytics a cooperative gets: "basic" for questionnaire data, "standard" for
 * financial statements, "both" when its type allows either.
 */
export type AnalyticsTrack = "basic" | "standard" | "both";

/**
 * Mirrors the backend's submission-method rules (`period_rules`): basic-tier and
 * multipurpose cooperatives report through the questionnaire, SACCOs through upload
 * or manual entry, and cooperatives without a type are not restricted.
 */
export function analyticsTrack(profile: {
  tier?: string | null;
  institution_type?: string | null;
}): AnalyticsTrack {
  if (profile.tier === "basic" || profile.institution_type === "multipurpose") return "basic";
  if (profile.institution_type === "sacco") return "standard";
  return "both";
}

/** Whether `path` belongs in the navigation of a cooperative on `track` (unknown: hidden). */
export function isPageForTrack(path: string, track: AnalyticsTrack | undefined): boolean {
  const trackSpecific = STANDARD_PAGES.includes(path) || BASIC_PAGES.includes(path);
  if (!trackSpecific || track === "both") return true;
  if (track === undefined) return false;
  return track === "basic" ? BASIC_PAGES.includes(path) : STANDARD_PAGES.includes(path);
}

/** The page a cooperative on `track` should see instead of `path`, or null when `path` is fine. */
export function pageForTrack(path: string, track: AnalyticsTrack | undefined): string | null {
  if (track === undefined || isPageForTrack(path, track)) return null;
  if (track === "basic") return PAGE_PAIRS[path] ?? null;
  return Object.entries(PAGE_PAIRS).find(([, basic]) => basic === path)?.[0] ?? null;
}

/**
 * Analytics navigation for the signed-in user. Only cooperatives are filtered:
 * apex, federation and ministry users oversee cooperatives of every type.
 */
export function useAnalyticsTrackNav() {
  const { role } = useAuth();
  const isCooperative = role === "cooperative";
  const { data: profile } = useMyCooperativeProfile({ enabled: isCooperative });
  const track = isCooperative && profile ? analyticsTrack(profile) : undefined;

  return {
    isVisible: (path: string) => !isCooperative || isPageForTrack(path, track),
    redirectFor: (path: string) => (isCooperative ? pageForTrack(path, track) : null),
  };
}
