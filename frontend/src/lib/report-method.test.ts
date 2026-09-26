import { describe, expect, it } from "vitest";

import { countByMethod, methodsWithData, resolveMethod } from "@/lib/report-method";

const subs = (...methods: string[]) => methods.map((submission_method) => ({ submission_method }));

describe("countByMethod", () => {
  it("counts questionnaire returns apart from every other method", () => {
    const counts = countByMethod(subs("questionnaire", "upload", "manual_grid", "questionnaire"));

    expect(counts).toEqual({ standard: 2, questionnaire: 2 });
  });
});

describe("methodsWithData", () => {
  it("lists only the methods that have submissions", () => {
    expect(methodsWithData({ standard: 0, questionnaire: 3 })).toEqual(["questionnaire"]);
    expect(methodsWithData({ standard: 2, questionnaire: 3 })).toEqual([
      "standard",
      "questionnaire",
    ]);
    expect(methodsWithData({ standard: 0, questionnaire: 0 })).toEqual([]);
  });
});

describe("resolveMethod", () => {
  it("defaults to the only method that has data", () => {
    expect(resolveMethod("", ["questionnaire"])).toBe("questionnaire");
  });

  it("asks the user to choose when both methods have data", () => {
    expect(resolveMethod("", ["standard", "questionnaire"])).toBe("");
  });

  it("keeps the user's choice when both methods have data", () => {
    expect(resolveMethod("questionnaire", ["standard", "questionnaire"])).toBe("questionnaire");
  });

  it("ignores a stale choice that no longer has data", () => {
    expect(resolveMethod("questionnaire", ["standard"])).toBe("standard");
  });

  it("returns nothing when there is no data", () => {
    expect(resolveMethod("", [])).toBe("");
  });
});
