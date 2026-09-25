import { describe, expect, it } from "vitest";

import { rankPerformers } from "@/lib/leaderboard";

const values = (rows: number[]) => rankPerformers(rows, (v) => v);

describe("rankPerformers", () => {
  it("puts the highest value first among top performers", () => {
    const { top } = values([-1.65, -0.38, 0.36, 0]);

    expect(top).toEqual([0.36, 0]);
  });

  it("puts the lowest value first in the watch list", () => {
    const { bottom } = values([-1.65, -0.38, 0.36, 0]);

    expect(bottom).toEqual([-1.65, -0.38]);
  });

  it("never lists the same row on both sides", () => {
    const { top, bottom } = values([5, 4, 3, 2, 1, 0, -1]);

    expect(top.filter((v) => bottom.includes(v))).toEqual([]);
  });

  it("caps each side at five rows", () => {
    const { top, bottom } = values(Array.from({ length: 30 }, (_, i) => i));

    expect(top).toHaveLength(5);
    expect(bottom).toHaveLength(5);
  });

  it("treats a single row as a top performer only", () => {
    const { top, bottom } = values([3]);

    expect(top).toEqual([3]);
    expect(bottom).toEqual([]);
  });

  it("reverses the order when lower is better", () => {
    const { top } = rankPerformers([1, 2, 3, 4], (v) => v, false);

    expect(top).toEqual([1, 2]);
  });
});
