import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOfflineQuery } from "./useOfflineQuery";
import * as offlineCache from "@/services/shared/offlineCache";
import * as authService from "@/services/shared/authService";

vi.mock("@/services/shared/offlineCache", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock("@/services/shared/authService", () => ({
  getUserProfile: vi.fn(() => ({ id: "user-123" })),
  isOfflineModeActive: vi.fn(() => false),
}));

vi.mock("i18next", () => ({
  default: { t: vi.fn((key: string) => key) },
}));

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useOfflineQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches data online and caches it", async () => {
    const mockData = { id: "1", name: "Test" };
    const queryFn = vi.fn().mockResolvedValue(mockData);
    vi.mocked(offlineCache.cacheSet).mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useOfflineQuery({
          queryKey: ["test"],
          queryFn,
          cacheTable: "submissions",
          cacheKey: "test:1",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(queryFn).toHaveBeenCalled();
    expect(offlineCache.cacheSet).toHaveBeenCalledWith(
      "submissions",
      "test:1",
      "user-123",
      mockData,
    );
  });

  it("returns cached data when offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    const mockData = { id: "1", name: "Cached" };
    vi.mocked(offlineCache.cacheGet).mockResolvedValue(mockData);

    const { result } = renderHook(
      () =>
        useOfflineQuery({
          queryKey: ["test"],
          queryFn: vi.fn().mockResolvedValue({ id: "fresh" }),
          cacheTable: "submissions",
          cacheKey: "test:1",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it("falls back to cache when API fails", async () => {
    const mockData = { id: "1", name: "Fallback" };
    vi.mocked(offlineCache.cacheGet).mockResolvedValue(mockData);

    const { result } = renderHook(
      () =>
        useOfflineQuery({
          queryKey: ["test"],
          queryFn: vi.fn().mockRejectedValue(new Error("Network error")),
          cacheTable: "submissions",
          cacheKey: "test:1",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it("returns default fallback (empty array) when offline with no cache", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    vi.mocked(offlineCache.cacheGet).mockResolvedValue(null);

    const { result } = renderHook(
      () =>
        useOfflineQuery({
          queryKey: ["test"],
          queryFn: vi.fn().mockResolvedValue({ id: "fresh" }),
          cacheTable: "submissions",
          cacheKey: "test:list",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("returns default fallback (empty object) when offline with no cache for non-list keys", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    vi.mocked(offlineCache.cacheGet).mockResolvedValue(null);

    const { result } = renderHook(
      () =>
        useOfflineQuery({
          queryKey: ["test"],
          queryFn: vi.fn().mockResolvedValue({ id: "fresh" }),
          cacheTable: "submissions",
          cacheKey: "test:single",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({});
  });

  it("uses custom fallbackData when provided", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    vi.mocked(offlineCache.cacheGet).mockResolvedValue(null);

    const { result } = renderHook(
      () =>
        useOfflineQuery({
          queryKey: ["test"],
          queryFn: vi.fn().mockResolvedValue({ id: "fresh" }),
          cacheTable: "submissions",
          cacheKey: "test:1",
          fallbackData: { custom: "fallback" },
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ custom: "fallback" });
  });

  it("does not cache null or undefined responses", async () => {
    const queryFn = vi.fn().mockResolvedValue(null);
    vi.mocked(offlineCache.cacheSet).mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useOfflineQuery({
          queryKey: ["test"],
          queryFn,
          cacheTable: "submissions",
          cacheKey: "test:1",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(offlineCache.cacheSet).not.toHaveBeenCalled();
  });

  it("respects offline mode flag from auth service", async () => {
    vi.mocked(authService.isOfflineModeActive).mockReturnValue(true);
    const mockData = { id: "1", name: "Offline Mode" };
    vi.mocked(offlineCache.cacheGet).mockResolvedValue(mockData);

    const { result } = renderHook(
      () =>
        useOfflineQuery({
          queryKey: ["test"],
          queryFn: vi.fn().mockResolvedValue({ id: "fresh" }),
          cacheTable: "submissions",
          cacheKey: "test:1",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it("sets networkMode to offlineFirst", async () => {
    const { result } = renderHook(
      () =>
        useOfflineQuery({
          queryKey: ["test"],
          queryFn: vi.fn().mockResolvedValue({ id: "1" }),
          cacheTable: "submissions",
          cacheKey: "test:1",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isFetchedAfterMount).toBe(true);
  });

  it("does not retry when offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    vi.mocked(offlineCache.cacheGet).mockResolvedValue(null);

    const queryFn = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(
      () =>
        useOfflineQuery({
          queryKey: ["test"],
          queryFn,
          cacheTable: "submissions",
          cacheKey: "test:1",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryFn).not.toHaveBeenCalled();
  });
});
