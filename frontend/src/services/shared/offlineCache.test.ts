import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock authService
vi.mock("./authService", () => ({
  isOfflineModeActive: vi.fn().mockReturnValue(false),
  getUserProfile: vi.fn().mockReturnValue({ id: "user-123" }),
}));

// Mock offlineDb
const mockSubmissionsStore: any[] = [];
const mockAnalyticsStore: any[] = [];
vi.mock("./offlineDb", () => {
  const tables = [
    {
      name: "submissions",
      count: vi.fn(async () => mockSubmissionsStore.length),
      put: vi.fn(async (item: any) => {
        const idx = mockSubmissionsStore.findIndex((x) => x.id === item.id);
        if (idx !== -1) mockSubmissionsStore[idx] = item;
        else mockSubmissionsStore.push(item);
      }),
      delete: vi.fn(async (key: string) => {
        const idx = mockSubmissionsStore.findIndex((x) => x.id === key);
        if (idx !== -1) mockSubmissionsStore.splice(idx, 1);
      }),
      clear: vi.fn(async () => {
        mockSubmissionsStore.length = 0;
      }),
      where: vi.fn((field) => ({
        equals: vi.fn((val) => {
          const getFiltered = () => mockSubmissionsStore.filter((x) => x[field] === val);
          const makeCollectionMock = (filteredList: any[]): any => ({
            first: vi.fn(async () => filteredList[0]),
            toArray: vi.fn(async () => filteredList),
            count: vi.fn(async () => filteredList.length),
            delete: vi.fn(async () => {
              filteredList.forEach((item) => {
                const idx = mockSubmissionsStore.indexOf(item);
                if (idx !== -1) mockSubmissionsStore.splice(idx, 1);
              });
            }),
            modify: vi.fn(async (changes: any) => {
              filteredList.forEach((x) => {
                Object.assign(x, changes);
              });
            }),
            and: vi.fn((pred: any) => {
              const nextList = filteredList.filter(pred);
              return makeCollectionMock(nextList);
            }),
          });
          return makeCollectionMock(getFiltered());
        }),
        startsWith: vi.fn((val) => ({
          first: vi.fn(async () => {
            return mockSubmissionsStore.find((x) => String(x[field]).startsWith(val));
          }),
        })),
      })),
      orderBy: vi.fn((field) => ({
        limit: vi.fn((num) => ({
          toArray: vi.fn(async () => {
            return [...mockSubmissionsStore]
              .sort((a, b) => a[field] - b[field])
              .slice(0, num);
          }),
        })),
      })),
      bulkDelete: vi.fn(async (keys: string[]) => {
        keys.forEach((key) => {
          const idx = mockSubmissionsStore.findIndex((x) => x.id === key);
          if (idx !== -1) mockSubmissionsStore.splice(idx, 1);
        });
      }),
    },
    {
      name: "analytics",
      count: vi.fn(async () => mockAnalyticsStore.length),
      put: vi.fn(async (item: any) => {
        const idx = mockAnalyticsStore.findIndex((x) => x.key === item.key);
        if (idx !== -1) mockAnalyticsStore[idx] = item;
        else mockAnalyticsStore.push(item);
      }),
      delete: vi.fn(async (key: string) => {
        const idx = mockAnalyticsStore.findIndex((x) => x.key === key);
        if (idx !== -1) mockAnalyticsStore.splice(idx, 1);
      }),
      clear: vi.fn(async () => {
        mockAnalyticsStore.length = 0;
      }),
      where: vi.fn((field) => ({
        equals: vi.fn((val) => {
          const getFiltered = () => mockAnalyticsStore.filter((x) => x[field] === val);
          const makeCollectionMock = (filteredList: any[]): any => ({
            first: vi.fn(async () => filteredList[0]),
            toArray: vi.fn(async () => filteredList),
            count: vi.fn(async () => filteredList.length),
            delete: vi.fn(async () => {
              filteredList.forEach((item) => {
                const idx = mockAnalyticsStore.indexOf(item);
                if (idx !== -1) mockAnalyticsStore.splice(idx, 1);
              });
            }),
            modify: vi.fn(async (changes: any) => {
              filteredList.forEach((x) => {
                Object.assign(x, changes);
              });
            }),
            and: vi.fn((pred: any) => {
              const nextList = filteredList.filter(pred);
              return makeCollectionMock(nextList);
            }),
          });
          return makeCollectionMock(getFiltered());
        }),
        startsWith: vi.fn((val) => ({
          first: vi.fn(async () => {
            return mockAnalyticsStore.find((x) => String(x[field]).startsWith(val));
          }),
        })),
      })),
      orderBy: vi.fn((field) => ({
        limit: vi.fn((num) => ({
          toArray: vi.fn(async () => {
            return [...mockAnalyticsStore]
              .sort((a, b) => a[field] - b[field])
              .slice(0, num);
          }),
        })),
      })),
      bulkDelete: vi.fn(async (keys: string[]) => {
        keys.forEach((key) => {
          const idx = mockAnalyticsStore.findIndex((x) => x.key === key);
          if (idx !== -1) mockAnalyticsStore.splice(idx, 1);
        });
      }),
    },
  ];

  const db: any = { tables };
  tables.forEach((t) => {
    db[t.name] = t;
  });

  return {
    offlineDb: db,
    CACHE_TTL_MS: {
      submissions: 7 * 24 * 60 * 60 * 1000,
      analytics: 60 * 60 * 1000,
    },
  };
});

import { cacheGet, cacheSet, cacheDelete, cacheClearForUser } from "./offlineCache";
import { isOfflineModeActive } from "./authService";

describe("offlineCache", () => {
  beforeEach(() => {
    mockSubmissionsStore.length = 0;
    mockAnalyticsStore.length = 0;
    vi.mocked(isOfflineModeActive).mockReturnValue(false);
  });

  it("should set and get cache values successfully", async () => {
    await cacheSet("submissions", "sub-1", "user-123", { name: "Coop A" });
    const val = await cacheGet<any>("submissions", "sub-1", "user-123");
    expect(val).toEqual({ name: "Coop A" });
  });

  it("should return null on cache miss and NOT return unrelated entities", async () => {
    await cacheSet("submissions", "sub-1", "user-123", { name: "Coop A" });
    const val = await cacheGet<any>("submissions", "sub-2", "user-123");
    expect(val).toBeNull(); // Cache fallback wrong entity (P2) is resolved!
  });

  it("should delete cache entries", async () => {
    await cacheSet("submissions", "sub-1", "user-123", { name: "Coop A" });
    await cacheDelete("submissions", "sub-1");
    const val = await cacheGet<any>("submissions", "sub-1", "user-123");
    expect(val).toBeNull();
  });

  it("should clear cache for a specific user", async () => {
    await cacheSet("submissions", "sub-1", "user-123", { name: "Coop A" });
    await cacheSet("submissions", "sub-2", "user-456", { name: "Coop B" });

    await cacheClearForUser("submissions", "user-123");

    const val1 = await cacheGet<any>("submissions", "sub-1", "user-123");
    expect(val1).toBeNull();
  });
});
