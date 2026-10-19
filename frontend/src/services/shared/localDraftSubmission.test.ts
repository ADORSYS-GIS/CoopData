import { describe, it, expect, vi, beforeEach } from "vitest";
import { cacheLocalDraftSubmission } from "./localDraftSubmission";
import { cacheGet, cacheSet } from "./offlineCache";

vi.mock("./offlineCache", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

const LIST = { cacheTable: "submissions", cacheKey: "apex-list" } as const;

describe("cacheLocalDraftSubmission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("adds the draft to the top of the cached list", async () => {
    vi.mocked(cacheGet).mockResolvedValue([{ id: "existing" }]);

    await cacheLocalDraftSubmission({ id: "draft-1" }, LIST, "user-1");

    expect(cacheSet).toHaveBeenCalledWith("submissions", "apex-list", "user-1", [
      { id: "draft-1" },
      { id: "existing" },
    ]);
  });

  it("does not add the same draft twice", async () => {
    vi.mocked(cacheGet).mockResolvedValue([{ id: "draft-1" }]);

    await cacheLocalDraftSubmission({ id: "draft-1" }, LIST, "user-1");

    expect(cacheSet).not.toHaveBeenCalledWith(
      "submissions",
      "apex-list",
      expect.anything(),
      expect.anything(),
    );
  });

  it("caches the detail, an empty review history and pending sections", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);

    await cacheLocalDraftSubmission({ id: "draft-1" }, LIST, "user-1");

    expect(cacheSet).toHaveBeenCalledWith("submissions", "submission-draft-1", "user-1", {
      id: "draft-1",
    });
    expect(cacheSet).toHaveBeenCalledWith("submissions", "reviews-draft-1", "user-1", []);
    const sections = vi
      .mocked(cacheSet)
      .mock.calls.find(([, key]) => key === "sections-draft-1")?.[3] as { status: string }[];
    expect(sections).toHaveLength(6);
    expect(sections.every((s) => s.status === "pending")).toBe(true);
  });
});
