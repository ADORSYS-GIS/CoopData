/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock authService
vi.mock("./authService", () => ({
  isOfflineModeActive: vi.fn().mockReturnValue(false),
  getAccessToken: vi.fn().mockResolvedValue("fake-jwt-token"),
  getUserProfile: vi.fn().mockReturnValue({ id: "user-123" }),
}));

vi.mock("@/services/shared/authService", () => ({
  isOfflineModeActive: vi.fn().mockReturnValue(false),
  getAccessToken: vi.fn().mockResolvedValue("fake-jwt-token"),
  getUserProfile: vi.fn().mockReturnValue({ id: "user-123" }),
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
    delete: vi.fn(async (id: number) => {
      const idx = mockSyncQueueStore.findIndex((x) => x.id === id);
      if (idx !== -1) mockSyncQueueStore.splice(idx, 1);
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

import { getUserProfile } from "./authService";
import {
  dismissItem,
  enqueue,
  flushSyncQueue,
  getFailedItems,
  retryItem,
  runMutation,
} from "./syncQueueService";
import { OfflineActionError } from "./networkGuard";

const mockedGetUserProfile = vi.mocked(getUserProfile);

const globalFetch = global.fetch;

describe("syncQueueService", () => {
  beforeEach(() => {
    mockedGetUserProfile.mockReturnValue({ id: "user-123" } as any);
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

  it("should scope runMutation items to the current user ID", async () => {
    await runMutation("/api/v1/cooperatives", "POST", {
      body: { name: "Coop A" },
      optimisticData: { name: "Coop A" },
      online: async () => ({ name: "Coop A" }),
    });

    expect(mockSyncQueueStore.length).toBe(1);
    expect(mockSyncQueueStore[0].userId).toBe("user-123");
  });

  it("drops an online save the server refused instead of retrying it later", async () => {
    await expect(
      runMutation("/api/v1/cooperatives", "POST", {
        body: { name: "Coop A" },
        optimisticData: { name: "Coop A" },
        online: async () => {
          throw new Error("Validation failed");
        },
      }),
    ).rejects.toThrow("Validation failed");

    expect(mockSyncQueueStore.length).toBe(0);
  });

  it("keeps an online save queued when the network drops and carries on as offline", async () => {
    const result = await runMutation("/api/v1/cooperatives", "POST", {
      body: { name: "Coop A" },
      optimisticData: { name: "Coop A (local)" },
      online: async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    expect(result).toEqual({ name: "Coop A (local)" });
    expect(mockSyncQueueStore[0].status).toBe("pending");
    expect(mockSyncQueueStore[0].nextAttemptAt).toBeGreaterThan(Date.now());
  });

  it("should block offline delete on runMutation immediately", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    await expect(
      runMutation("/api/v1/cooperatives/coop-1", "DELETE", {
        optimisticData: undefined,
        online: async () => {},
      }),
    ).rejects.toBeInstanceOf(OfflineActionError);

    expect(mockSyncQueueStore.length).toBe(0);
  });

  it("should refuse online-only actions offline instead of queueing them", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const online = vi.fn();

    await expect(
      runMutation("/api/v1/apex/submissions/{id}/approve", "POST", {
        pathParams: { id: "sub-1" },
        online,
        requiresConnection: true,
      }),
    ).rejects.toBeInstanceOf(OfflineActionError);

    expect(mockSyncQueueStore.length).toBe(0);
    expect(online).not.toHaveBeenCalled();
  });

  it("reports an 'already exists' conflict as failed with the server's message, not done", async () => {
    await enqueue({
      endpoint: "/api/v1/cooperative/submissions",
      method: "POST",
      userId: "user-123",
      body: { reporting_year: 2023 },
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      text: async () =>
        JSON.stringify({ error: "conflict", message: "A submission already exists for 2023" }),
    } as any);

    await flushSyncQueue();

    expect(mockSyncQueueStore[0]).toMatchObject({
      status: "failed",
      lastError: "A submission already exists for 2023",
      lastStatus: 409,
    });
  });

  it("keeps a server error pending for retry and records its status", async () => {
    await enqueue({ endpoint: "/api/v1/x", method: "POST", userId: "user-123" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "",
    } as any);

    await flushSyncQueue();

    expect(mockSyncQueueStore[0]).toMatchObject({
      status: "pending",
      retryCount: 1,
      lastError: "HTTP 503",
      lastStatus: 503,
    });
  });

  it("marks a refusal that won't change on retry as failed immediately", async () => {
    await enqueue({ endpoint: "/api/v1/x/{id}", method: "PUT", userId: "user-123" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "",
    } as any);

    await flushSyncQueue();

    expect(mockSyncQueueStore[0]).toMatchObject({ status: "failed", lastStatus: 404 });
  });

  it("skips items still waiting for their next retry", async () => {
    await enqueue({ endpoint: "/api/v1/x", method: "POST", userId: "user-123" });
    mockSyncQueueStore[0].nextAttemptAt = Date.now() + 60_000;
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await flushSyncQueue();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives up after the last scheduled retry", async () => {
    await enqueue({ endpoint: "/api/v1/x", method: "POST", userId: "user-123" });
    mockSyncQueueStore[0].retryCount = 6;
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await flushSyncQueue();

    expect(mockSyncQueueStore[0]).toMatchObject({ status: "failed", retryCount: 7 });
    expect(mockSyncQueueStore[0].lastStatus).toBeUndefined();
  });

  it("lists only the current user's failed items, which can be retried or dismissed", async () => {
    await enqueue({ endpoint: "/api/v1/a", method: "POST", userId: "user-123" });
    await enqueue({ endpoint: "/api/v1/b", method: "POST", userId: "someone-else" });
    mockSyncQueueStore.forEach((item) => (item.status = "failed"));

    const failed = await getFailedItems();
    expect(failed.map((i) => i.endpoint)).toEqual(["/api/v1/a"]);

    await retryItem(failed[0].id!);
    expect(mockSyncQueueStore[0]).toMatchObject({ status: "pending", retryCount: 0 });

    await dismissItem(mockSyncQueueStore[1].id!);
    expect(mockSyncQueueStore.map((i) => i.endpoint)).toEqual(["/api/v1/a"]);
  });
});
