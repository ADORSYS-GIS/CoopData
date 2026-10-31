/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMambuStatus, useMambuSyncs, useStartMambuSync } from "./useMambu";
import { apiClient } from "@/openapi-client";

vi.mock("@/openapi-client", () => ({
  apiClient: {
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
    DELETE: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useMambu hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads whether Mambu is configured", async () => {
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: { configured: true },
      error: undefined,
    } as any);
    const { result } = renderHook(() => useMambuStatus(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.configured).toBe(true);
    expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/ministry/mambu/status");
  });

  it("surfaces the API error message", async () => {
    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: undefined,
      error: { error: "Forbidden" },
    } as any);
    const { result } = renderHook(() => useMambuSyncs(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Forbidden");
  });

  it("shows the readable message instead of the error code", async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: undefined,
      error: { error: "bad_request", message: "No SACCO is linked yet." },
    } as any);
    const { result } = renderHook(() => useStartMambuSync(), { wrapper: createWrapper() });
    result.current.mutate({ year: 2026, month: 9 });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No SACCO is linked yet.");
  });

  it("starts a sync with the chosen month", async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: { id: "run-1", status: "running" },
      error: undefined,
    } as any);
    const { result } = renderHook(() => useStartMambuSync(), { wrapper: createWrapper() });
    result.current.mutate({ year: 2026, month: 9 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.POST).toHaveBeenCalledWith("/api/v1/ministry/mambu/syncs", {
      body: { year: 2026, month: 9 },
    });
  });

  it("fails the mutation when the API refuses", async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: undefined,
      error: { error: "A Mambu sync is already running." },
    } as any);
    const { result } = renderHook(() => useStartMambuSync(), { wrapper: createWrapper() });
    result.current.mutate({ year: 2026, month: 9 });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("already running");
  });
});
