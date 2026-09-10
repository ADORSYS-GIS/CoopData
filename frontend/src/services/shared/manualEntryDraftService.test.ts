/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDraftsStore: any[] = [];

vi.mock("./offlineDb", () => {
  const draftsTable = {
    name: "drafts",
    put: vi.fn(async (item: any) => {
      const idx = mockDraftsStore.findIndex((x) => x.key === item.key);
      if (idx !== -1) mockDraftsStore[idx] = item;
      else mockDraftsStore.push(item);
    }),
    get: vi.fn(async (key: string) => mockDraftsStore.find((x) => x.key === key)),
    delete: vi.fn(async (key: string) => {
      const idx = mockDraftsStore.findIndex((x) => x.key === key);
      if (idx !== -1) mockDraftsStore.splice(idx, 1);
    }),
  };
  return {
    offlineDb: { drafts: draftsTable },
  };
});

import {
  saveManualEntryDraft,
  loadManualEntryDraft,
  clearManualEntryDraft,
  hasManualEntryDraft,
} from "./manualEntryDraftService";

describe("manualEntryDraftService", () => {
  beforeEach(() => {
    mockDraftsStore.length = 0;
    vi.clearAllMocks();
  });

  it("saves and loads a draft for a submission/mode", async () => {
    const data = { financialData: { 1101: { 1: 100 } }, currency: "SZL" };
    await saveManualEntryDraft("sub-1", "financial", data);

    const loaded = await loadManualEntryDraft<any>("sub-1", "financial");
    expect(loaded).toEqual(data);
  });

  it("returns null when no draft exists", async () => {
    const loaded = await loadManualEntryDraft("sub-1", "non_financial");
    expect(loaded).toBeNull();
  });

  it("scopes drafts by submission and mode", async () => {
    await saveManualEntryDraft("sub-1", "financial", { a: 1 });
    await saveManualEntryDraft("sub-2", "financial", { a: 2 });
    await saveManualEntryDraft("sub-1", "non_financial", { b: 3 });

    expect(await loadManualEntryDraft("sub-1", "financial")).toEqual({ a: 1 });
    expect(await loadManualEntryDraft("sub-2", "financial")).toEqual({ a: 2 });
    expect(await loadManualEntryDraft("sub-1", "non_financial")).toEqual({ b: 3 });
  });

  it("clears a draft", async () => {
    await saveManualEntryDraft("sub-1", "financial", { a: 1 });
    expect(await hasManualEntryDraft("sub-1", "financial")).toBe(true);

    await clearManualEntryDraft("sub-1", "financial");
    expect(await hasManualEntryDraft("sub-1", "financial")).toBe(false);
    expect(await loadManualEntryDraft("sub-1", "financial")).toBeNull();
  });

  it("overwrites an existing draft on re-save", async () => {
    await saveManualEntryDraft("sub-1", "financial", { v: 1 });
    await saveManualEntryDraft("sub-1", "financial", { v: 2 });
    expect(await loadManualEntryDraft("sub-1", "financial")).toEqual({ v: 2 });
    expect(mockDraftsStore).toHaveLength(1);
  });
});
