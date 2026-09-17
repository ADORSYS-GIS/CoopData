import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useNfStatistics } from "./useNfStatistics";
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
  getUserProfile: vi.fn(() => ({ id: "user-123", role: "cooperative" })),
  isOfflineModeActive: vi.fn(() => false),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useNfStatistics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches data successfully", async () => {
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: { mock: true },
      error: undefined,
    } as any);

    const { result } = renderHook(() => useNfStatistics(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it("handles error", async () => {
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: undefined,
      error: { message: "Failed to fetch" },
    } as any);

    const { result } = renderHook(() => useNfStatistics(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
