import { describe, expect, it } from "vitest";

import { generateMockFinancialGrid } from "./mockData";

describe("generateMockFinancialGrid", () => {
  it("fills the yearly Annual Total column with the year-end figures", () => {
    const grid = generateMockFinancialGrid();

    for (const months of Object.values(grid)) {
      expect(months[0]).toBeDefined();
      expect(months[0]).toBe(months[12]);
    }
  });
});
