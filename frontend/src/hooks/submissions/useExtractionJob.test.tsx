/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useExtractionJob } from "./useExtractionJob";
import { apiClient } from "@/openapi-client";
import { cacheSet } from "@/services/shared/offlineCache";

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

describe("useExtractionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });

  it("fetches extraction job and updates cache", async () => {
    const mockJob = { id: "job-1", status: "processing" };
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: mockJob,
      error: undefined,
      response: { status: 200 } as Response,
    } as any);

    const { result } = renderHook(() => useExtractionJob("job-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockJob);
    expect(apiClient.GET).toHaveBeenCalledWith(
      "/api/v1/cooperative/extraction-jobs/{id}",
      expect.objectContaining({ params: { path: { id: "job-1" } } }),
    );
    expect(cacheSet).toHaveBeenCalled();
  });

  it("handles API error", async () => {
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: undefined,
      error: { message: "Not found" },
      response: { status: 404 } as Response,
    } as any);

    const { result } = renderHook(() => useExtractionJob("job-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("is disabled when jobId is null", () => {
    const { result } = renderHook(() => useExtractionJob(null), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(apiClient.GET).not.toHaveBeenCalled();
  });
});
