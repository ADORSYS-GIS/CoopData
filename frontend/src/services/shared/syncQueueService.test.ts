/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock authService
vi.mock("./authService", () => ({
  isOfflineModeActive: vi.fn().mockReturnValue(false),
  getAccessToken: vi.fn().mockResolvedValue("fake-jwt-token"),
}));

// Mock offlineDb
const mockSyncQueueStore: any[] = [];
vi.mock("./offlineDb", () => {
  const syncQueueTable = {
    name: "syncQueue",
    add: vi.fn(async (item: any) => {
      const id = mockSyncQueueStore.length + 1;
      const newItem = { id, ...item };
      mockSyncQueueStore.push(newItem);
      return id;
    }),
    update: vi.fn(async (id: number, changes: any) => {
      const idx = mockSyncQueueStore.findIndex((x) => x.id === id);
      if (idx !== -1) {
        mockSyncQueueStore[idx] = { ...mockSyncQueueStore[idx], ...changes };
      }
    }),
    first: vi.fn(async () => mockSyncQueueStore[0]),
    where: vi.fn((field) => ({
      equals: vi.fn((val) => {
        const getFiltered = () => mockSyncQueueStore.filter((x) => x[field] === val);
        const makeCollectionMock = (filteredList: any[]): any => ({
          first: vi.fn(async () => filteredList[0]),
          toArray: vi.fn(async () => filteredList),
          count: vi.fn(async () => filteredList.length),
          modify: vi.fn(async (changes: any) => {
            filteredList.forEach((x) => {
              Object.assign(x, changes);
            });
          }),
          delete: vi.fn(async () => {
            filteredList.forEach((item) => {
              const idx = mockSyncQueueStore.indexOf(item);
              if (idx !== -1) mockSyncQueueStore.splice(idx, 1);
            });
          }),
          and: vi.fn((filterFn: any) => {
            const nextList = filteredList.filter(filterFn);
            return makeCollectionMock(nextList);
          }),
        });
        return makeCollectionMock(getFiltered());
      }),
    })),
  };

  return {
    offlineDb: {
      syncQueue: syncQueueTable,
      tables: [syncQueueTable],
    },
  };
});

import { enqueue, flushSyncQueue } from "./syncQueueService";

const globalFetch = global.fetch;

describe("syncQueueService", () => {
  beforeEach(() => {
    mockSyncQueueStore.length = 0;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "OK",
    } as any);
  });

  afterEach(() => {
    global.fetch = globalFetch;
  });

  it("should enqueue a sync item successfully", async () => {
    const correlationId = await enqueue({
      endpoint: "/api/v1/cooperatives",
      method: "POST",
      body: { name: "Coop A" },
      userId: "user-123",
    });

    expect(correlationId).toBeDefined();
    expect(mockSyncQueueStore.length).toBe(1);
    expect(mockSyncQueueStore[0].endpoint).toBe("/api/v1/cooperatives");
    expect(mockSyncQueueStore[0].status).toBe("pending");
  });

  it("should replay verification token correctly in headers on flush", async () => {
    // 1. Enqueue item with verificationToken
    await enqueue({
      endpoint: "/api/v1/cooperatives/coop-1",
      method: "DELETE",
      userId: "user-123",
      verificationToken: "secret-token-123",
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "OK",
    } as any);
    global.fetch = mockFetch;

    // 2. Flush
    await flushSyncQueue();

    // 3. Verify fetch was called with the verification token header
    expect(mockFetch).toHaveBeenCalled();
    const fetchArgs = mockFetch.mock.calls[0];
    const headers = fetchArgs[1].headers;
    expect(headers["x-verification-token"]).toBe("secret-token-123");
    expect(mockSyncQueueStore[0].status).toBe("done");
  });
});
