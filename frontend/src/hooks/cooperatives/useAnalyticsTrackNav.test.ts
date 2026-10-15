import { describe, it, expect } from "vitest";
import { analyticsTrack, isPageForTrack, pageForTrack } from "./useAnalyticsTrackNav";

describe("analyticsTrack", () => {
  it("puts multipurpose cooperatives on the questionnaire (basic) analytics", () => {
    expect(analyticsTrack({ tier: "standard", institution_type: "multipurpose" })).toBe("basic");
  });

  it("puts SACCOs on the standard analytics", () => {
    expect(analyticsTrack({ tier: "standard", institution_type: "sacco" })).toBe("standard");
  });

  it("puts basic-tier cooperatives on the basic analytics whatever their type", () => {
    expect(analyticsTrack({ tier: "basic", institution_type: "sacco" })).toBe("basic");
  });

  it("keeps both for cooperatives without a type", () => {
    expect(analyticsTrack({ tier: "standard", institution_type: null })).toBe("both");
  });
});

describe("isPageForTrack", () => {
  it("shows a SACCO only the standard analytics pages", () => {
    expect(isPageForTrack("/app/analytics", "standard")).toBe(true);
    expect(isPageForTrack("/app/benchmarking", "standard")).toBe(true);
    expect(isPageForTrack("/app/basic-analytics", "standard")).toBe(false);
    expect(isPageForTrack("/app/basic-benchmarking", "standard")).toBe(false);
  });

  it("shows a multipurpose cooperative only the basic analytics pages", () => {
    expect(isPageForTrack("/app/basic-analytics", "basic")).toBe(true);
    expect(isPageForTrack("/app/basic-benchmarking", "basic")).toBe(true);
    expect(isPageForTrack("/app/analytics", "basic")).toBe(false);
    expect(isPageForTrack("/app/benchmarking", "basic")).toBe(false);
  });

  it("shows all four pages to a cooperative without a type", () => {
    expect(isPageForTrack("/app/analytics", "both")).toBe(true);
    expect(isPageForTrack("/app/basic-analytics", "both")).toBe(true);
  });

  it("hides the four pages while the profile is loading, never the others", () => {
    expect(isPageForTrack("/app/analytics", undefined)).toBe(false);
    expect(isPageForTrack("/app/basic-analytics", undefined)).toBe(false);
    expect(isPageForTrack("/app/submissions", undefined)).toBe(true);
  });
});

describe("pageForTrack", () => {
  it("sends each cooperative to its own version of the page", () => {
    expect(pageForTrack("/app/basic-analytics", "standard")).toBe("/app/analytics");
    expect(pageForTrack("/app/basic-benchmarking", "standard")).toBe("/app/benchmarking");
    expect(pageForTrack("/app/analytics", "basic")).toBe("/app/basic-analytics");
    expect(pageForTrack("/app/benchmarking", "basic")).toBe("/app/basic-benchmarking");
  });

  it("leaves the right page, other pages, 'both' and an unknown track alone", () => {
    expect(pageForTrack("/app/analytics", "standard")).toBeNull();
    expect(pageForTrack("/app/submissions", "basic")).toBeNull();
    expect(pageForTrack("/app/analytics", "both")).toBeNull();
    expect(pageForTrack("/app/basic-analytics", undefined)).toBeNull();
  });
});
