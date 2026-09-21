/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useSubmissionFlags,
  useApexApprove,
  useApexReturn,
  useFederationApprove,
  useFederationReturn,
  useMinistryApprove,
  useMinistryReject,
} from "./useReviewSubmissions";
import { apiClient } from "@/openapi-client";
import { cacheSet, cacheGet } from "@/services/shared/offlineCache";
import * as syncQueueService from "@/services/shared/syncQueueService";

vi.mock("@/openapi-client", () => ({
  apiClient: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}));

vi.mock("@/services/shared/offlineCache", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock("@/services/shared/authService", () => ({
  getUserProfile: vi.fn(() => ({ id: "user-123", role: "apex" })),
  isOfflineModeActive: vi.fn(() => false),
}));

vi.mock("@/services/shared/syncQueueService", () => ({
  runMutation: vi.fn(async (_url, _method, config) => {
    return await config.online();
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useReviewSubmissions Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useSubmissionFlags", () => {
    it("fetches submission flags successfully", async () => {
      const mockData = [{ id: "flag-1", severity: "high" }];
      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: mockData,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useSubmissionFlags("sub-1"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });

    it("handles error", async () => {
      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: undefined,
        error: { message: "Not found" },
      } as any);

      const { result } = renderHook(() => useSubmissionFlags("sub-1"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useApexApprove", () => {
    it("approves submission", async () => {
      const mockResponse = { id: "sub-1", status: "in_review" };
      vi.mocked(apiClient.POST).mockResolvedValueOnce({
        data: mockResponse,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useApexApprove(), { wrapper: createWrapper() });
      result.current.mutate({ id: "sub-1", comment: "Looks good" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.POST).toHaveBeenCalledWith(
        "/api/v1/apex/submissions/{id}/approve",
        expect.any(Object),
      );
      expect(cacheSet).toHaveBeenCalled(); // via updateCachedSubmissionStatus
    });
  });

  describe("useMinistryReject", () => {
    it("rejects submission", async () => {
      const mockResponse = { id: "sub-1", status: "rejected" };
      vi.mocked(apiClient.POST).mockResolvedValueOnce({
        data: mockResponse,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useMinistryReject(), { wrapper: createWrapper() });
      result.current.mutate({ id: "sub-1", comment: "Needs work" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.POST).toHaveBeenCalledWith(
        "/api/v1/ministry/submissions/{id}/reject",
        expect.any(Object),
      );
    });
  });
});
