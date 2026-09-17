import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useSubmitManualFinancialStatement,
  useSubmitManualMembers,
  useDeleteManualFinancialStatement,
  useDeleteManualNonFinancialData,
} from "./useManualEntry";
import { apiClient } from "@/openapi-client";
import * as syncQueueService from "@/services/shared/syncQueueService";

vi.mock("@/openapi-client", () => ({
  apiClient: {
    POST: vi.fn(),
    DELETE: vi.fn(),
  },
}));

vi.mock("@/services/shared/syncQueueService", () => ({
  runMutation: vi.fn(async (_url, _method, config) => {
    return await config.online();
  }),
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

describe("useManualEntry Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useSubmitManualFinancialStatement", () => {
    it("submits manual financial statement", async () => {
      const mockResponse = { id: "fs-1" };
      vi.mocked(apiClient.POST).mockResolvedValueOnce({
        data: mockResponse,
        error: undefined,
      } as unknown as Response);

      const { result } = renderHook(() => useSubmitManualFinancialStatement("sub-1"), {
        wrapper: createWrapper(),
      });
      result.current.mutate({ cash: 1000 } as unknown as Response);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.POST).toHaveBeenCalledWith(
        "/api/v1/cooperative/submissions/{id}/manual-financial-statement",
        expect.any(Object),
      );
    });

    it("handles error", async () => {
      vi.mocked(apiClient.POST).mockResolvedValueOnce({
        data: undefined,
        error: { message: "Validation error" },
      } as unknown as Response);

      const { result } = renderHook(() => useSubmitManualFinancialStatement("sub-1"), {
        wrapper: createWrapper(),
      });
      result.current.mutate({ cash: 1000 } as unknown as Response);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Validation error");
    });
  });

  describe("useSubmitManualMembers", () => {
    it("submits manual members", async () => {
      vi.mocked(apiClient.POST).mockResolvedValueOnce({
        data: undefined,
        error: undefined,
      } as unknown as Response);

      const { result } = renderHook(() => useSubmitManualMembers("sub-1"), {
        wrapper: createWrapper(),
      });
      result.current.mutate({ total_members: 50 } as unknown as Response);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiClient.POST).toHaveBeenCalledWith(
        "/api/v1/cooperative/submissions/{id}/manual-members",
        expect.any(Object),
      );
    });
  });

  describe("useDeleteManualFinancialStatement", () => {
    it("deletes statement", async () => {
      vi.mocked(apiClient.DELETE).mockResolvedValueOnce({
        error: undefined,
      } as unknown as Response);

      const { result } = renderHook(() => useDeleteManualFinancialStatement("sub-1"), {
        wrapper: createWrapper(),
      });
      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiClient.DELETE).toHaveBeenCalledWith(
        "/api/v1/cooperative/submissions/{id}/financial-statement",
        expect.any(Object),
      );
    });
  });

  describe("useDeleteManualNonFinancialData", () => {
    it("deletes non-financial data", async () => {
      vi.mocked(apiClient.DELETE).mockResolvedValueOnce({
        error: undefined,
      } as unknown as Response);

      const { result } = renderHook(() => useDeleteManualNonFinancialData("sub-1"), {
        wrapper: createWrapper(),
      });
      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiClient.DELETE).toHaveBeenCalledWith(
        "/api/v1/cooperative/submissions/{id}/non-financial",
        expect.any(Object),
      );
    });
  });
});
