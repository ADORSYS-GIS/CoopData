import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useCooperativeSubmissions,
  useCreateSubmission,
  useUpdateSubmissionMethod,
  useDeleteSubmission,
  useSubmission,
  DuplicateSubmissionError,
} from "./useSubmissions";
import { apiClient } from "@/openapi-client";
import { cacheSet, cacheGet, cacheDelete } from "@/services/shared/offlineCache";
import * as syncQueueService from "@/services/shared/syncQueueService";

vi.mock("@/openapi-client", () => ({
  apiClient: {
    GET: vi.fn(),
    POST: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
  },
}));

vi.mock("@/services/shared/offlineCache", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDelete: vi.fn(),
}));

vi.mock("@/services/shared/authService", () => ({
  getAccessToken: vi.fn(() => "mock-token"),
  getUserProfile: vi.fn(() => ({ id: "user-123", role: "cooperative" })),
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

describe("useSubmissions Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });

  describe("useCooperativeSubmissions", () => {
    it("fetches cooperative submissions successfully", async () => {
      const mockData = [{ id: "sub-1", reporting_year: 2024 }];
      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: mockData,
        error: undefined,
        response: { status: 200 } as Response,
      } as unknown as Response);

      const { result } = renderHook(() => useCooperativeSubmissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
      expect(apiClient.GET).toHaveBeenCalledWith("/api/v1/cooperative/submissions");
      expect(cacheSet).toHaveBeenCalled(); // via useOfflineQuery
    });

    it("handles API errors properly", async () => {
      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: undefined,
        error: { message: "Internal Error" },
        response: { status: 500 } as Response,
      } as unknown as Response);

      const { result } = renderHook(() => useCooperativeSubmissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useSubmission (Single)", () => {
    it("fetches a single submission by id", async () => {
      const mockData = { id: "sub-1", reporting_year: 2024 };
      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: mockData,
        error: undefined,
      } as unknown as Response);

      const { result } = renderHook(() => useSubmission("sub-1", "cooperative"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
      expect(apiClient.GET).toHaveBeenCalledWith(
        "/api/v1/cooperative/submissions/{id}",
        expect.any(Object),
      );
    });
  });

  describe("useCreateSubmission", () => {
    it("creates a submission successfully", async () => {
      const mockResponse = { id: "new-sub-1", reporting_year: 2025 };
      vi.mocked(apiClient.POST).mockResolvedValueOnce({
        data: mockResponse,
        error: undefined,
      } as unknown as Response);

      const { result } = renderHook(() => useCreateSubmission(), { wrapper: createWrapper() });

      result.current.mutate({ cooperative_id: "coop-1", reporting_year: 2025 } as unknown as Response);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.POST).toHaveBeenCalledWith(
        "/api/v1/cooperative/submissions",
        expect.any(Object),
      );
    });

    it("handles 409 duplicate submission error", async () => {
      vi.mocked(apiClient.POST).mockResolvedValueOnce({
        data: undefined,
        error: { message: "Duplicate", submission_id: "existing-sub-1" },
      } as unknown as Response);

      const { result } = renderHook(() => useCreateSubmission(), { wrapper: createWrapper() });
      result.current.mutate({ cooperative_id: "coop-1", reporting_year: 2025 } as unknown as Response);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(DuplicateSubmissionError);
      expect((result.current.error as DuplicateSubmissionError).submissionId).toBe(
        "existing-sub-1",
      );
    });
  });

  describe("useUpdateSubmissionMethod", () => {
    it("updates submission method and invalidates queries", async () => {
      const mockResponse = { id: "sub-1", submission_method: "upload" };
      vi.mocked(apiClient.PATCH).mockResolvedValueOnce({
        data: mockResponse,
        error: undefined,
      } as unknown as Response);
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useUpdateSubmissionMethod(), {
        wrapper: createWrapper(),
      });
      result.current.mutate({ id: "sub-1", submissionMethod: "upload" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.PATCH).toHaveBeenCalledWith(
        "/api/v1/cooperative/submissions/{id}/method",
        expect.any(Object),
      );
    });
  });

  describe("useDeleteSubmission", () => {
    it("deletes a submission and purges cache", async () => {
      vi.mocked(apiClient.DELETE).mockResolvedValueOnce({
        error: undefined,
      } as unknown as Response);

      const { result } = renderHook(() => useDeleteSubmission(), { wrapper: createWrapper() });
      result.current.mutate({ id: "sub-1", verificationToken: "1234" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiClient.DELETE).toHaveBeenCalledWith(
        "/api/v1/cooperative/submissions/{id}",
        expect.any(Object),
      );
      expect(cacheDelete).toHaveBeenCalledWith("submissions", "submission-sub-1");
    });
  });
});
