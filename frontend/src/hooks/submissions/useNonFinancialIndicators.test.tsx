import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useIndicatorCatalog,
  useSubmissionEntries,
  useSaveSubmissionEntries,
  useCreateCatalogItem,
  useDeleteCatalogItem,
  useConsolidateIndicator,
} from "./useNonFinancialIndicators";
import { apiClient } from "@/openapi-client";
import { cacheSet, cacheGet } from "@/services/shared/offlineCache";
import * as syncQueueService from "@/services/shared/syncQueueService";

vi.mock("@/openapi-client", () => ({
  apiClient: {
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
    DELETE: vi.fn(),
  },
}));

vi.mock("@/services/shared/offlineCache", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock("@/services/shared/authService", () => ({
  getUserProfile: vi.fn(() => ({ id: "user-123", role: "ministry" })),
  isOfflineModeActive: vi.fn(() => false),
}));

vi.mock("@/i18n", () => ({
  default: { language: "en-US" },
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

describe("useNonFinancialIndicators Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useIndicatorCatalog", () => {
    it("fetches indicator catalog", async () => {
      const mockData = [{ name: "Indicator 1" }];
      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: mockData,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useIndicatorCatalog(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });

    it("handles error", async () => {
      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: undefined,
        error: { message: "Server error" },
      } as any);

      const { result } = renderHook(() => useIndicatorCatalog(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useSubmissionEntries", () => {
    it("fetches submission entries", async () => {
      const mockData = [{ value: 10 }];
      vi.mocked(apiClient.GET).mockResolvedValueOnce({
        data: mockData,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useSubmissionEntries("sub-1"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe("useSaveSubmissionEntries", () => {
    it("saves submission entries", async () => {
      const mockResponse = [{ value: 10 }];
      vi.mocked(apiClient.POST).mockResolvedValueOnce({
        data: mockResponse,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useSaveSubmissionEntries("sub-1"), {
        wrapper: createWrapper(),
      });
      result.current.mutate([{ indicator_name: "test", value: "10", comment: null }]);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.POST).toHaveBeenCalledWith(
        "/api/v1/cooperative/submissions/{id}/non-financial-indicators",
        expect.any(Object),
      );
    });
  });

  describe("useCreateCatalogItem", () => {
    it("creates catalog item", async () => {
      const mockResponse = { name: "test" };
      vi.mocked(apiClient.POST).mockResolvedValueOnce({
        data: mockResponse,
        error: undefined,
      } as any);

      const { result } = renderHook(() => useCreateCatalogItem(), { wrapper: createWrapper() });
      result.current.mutate({ name: "test", type: "number", target: "cooperative" } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });
});
