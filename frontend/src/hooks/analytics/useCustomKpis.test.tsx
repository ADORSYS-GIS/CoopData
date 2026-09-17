import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCustomKpis } from "./useCustomKpis";
import { apiClient } from "@/openapi-client";
import { cacheGet, cacheSet } from "@/services/shared/offlineCache";

vi.mock("@/openapi-client", () => ({
  apiClient: {
    GET: vi.fn(),
  },
}));

vi.mock("@/services/shared/offlineCache", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock("@/services/shared/authService", () => ({
  getAccessToken: vi.fn(() => Promise.resolve("mock-token")),
  getUserProfile: vi.fn(() => ({ id: "user-123", role: "cooperative" })),
  isOfflineModeActive: vi.fn(() => false),
  fetchWithAuth: vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{ mock: true }]),
    } as any),
  ),
}));

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ mock: true }),
  } as any),
);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCustomKpis", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });

  it("fetches data successfully", async () => {
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: { mock: true },
      error: undefined,
    } as any);

    const { result } = renderHook(() => useCustomKpis(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.kpis).toBeDefined();
  });

  it("handles error", async () => {
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: undefined,
      error: { message: "Failed to fetch" },
    } as any);

    const { result } = renderHook(() => useCustomKpis(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
