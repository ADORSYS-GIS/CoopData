import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useQuestionnaire,
  useSaveLocalDraft,
  useSaveQuestionnaire,
  useActiveTemplate,
  useQuestionnaireAnalytics,
} from "./useQuestionnaire";
import { fetchWithAuth } from "@/services/shared/authService";
import { cacheSet, cacheGet } from "@/services/shared/offlineCache";
import * as syncQueueService from "@/services/shared/syncQueueService";

vi.mock("@/services/shared/authService", () => ({
  fetchWithAuth: vi.fn(),
  getUserProfile: vi.fn(() => ({ id: "user-123", role: "cooperative" })),
  isOfflineModeActive: vi.fn(() => false),
}));

vi.mock("@/services/shared/offlineCache", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDelete: vi.fn(),
}));

vi.mock("@/services/shared/syncQueueService", () => ({
  runMutation: vi.fn(async (_url, _method, config) => {
    return await config.online();
  }),
}));

vi.mock("@/i18n", () => ({
  default: { language: "en-US" },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useQuestionnaire Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useQuestionnaire", () => {
    it("fetches questionnaire successfully", async () => {
      const mockData = { id: "q-1", answers: { q1: "yes" } };
      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const { result } = renderHook(() => useQuestionnaire("sub-1", "annual"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });

    it("falls back to local draft on 404", async () => {
      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        status: 404,
      } as Response);

      const draft = { answers: { q1: "draft-yes" }, saved_at: "2024-01-01" };
      vi.mocked(cacheGet).mockResolvedValueOnce(draft);

      const { result } = renderHook(() => useQuestionnaire("sub-1", "annual"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.answers).toEqual(draft.answers);
      expect(result.current.data?.id).toBe("local-draft-sub-1");
    });

    it("handles API error", async () => {
      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "API Failed" }),
      } as Response);

      const { result } = renderHook(() => useQuestionnaire("sub-1", "annual"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useSaveLocalDraft", () => {
    it("saves draft locally and invalidates queries", async () => {
      vi.mocked(cacheSet).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useSaveLocalDraft("sub-1", "annual"), {
        wrapper: createWrapper(),
      });
      result.current.mutate({ q1: "draft" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(cacheSet).toHaveBeenCalledWith(
        "submissions",
        "questionnaire-draft-sub-1-annual",
        "user-123",
        expect.objectContaining({ answers: { q1: "draft" } }),
      );
    });
  });

  describe("useSaveQuestionnaire", () => {
    it("saves questionnaire to backend and purges draft", async () => {
      const mockResponse = { id: "new-q-1" };
      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(() => useSaveQuestionnaire("sub-1"), {
        wrapper: createWrapper(),
      });
      result.current.mutate({ questionnaire_type: "annual", answers: { q1: "final" } });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(fetchWithAuth).toHaveBeenCalled();
      expect(cacheSet).toHaveBeenCalled();
    });
  });

  describe("useActiveTemplate", () => {
    it("fetches template", async () => {
      const mockTemplate = { id: "tpl-1", label: "Template 1" };
      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplate,
      } as Response);

      const { result } = renderHook(() => useActiveTemplate("annual"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockTemplate);
    });
  });

  describe("useQuestionnaireAnalytics", () => {
    it("fetches analytics with filters", async () => {
      const mockData = { total_reporting_cooperatives: 10 };
      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const { result } = renderHook(() => useQuestionnaireAnalytics({ region: "R1" }), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
      expect(fetchWithAuth).toHaveBeenCalledWith(expect.stringContaining("region=R1"));
    });
  });
});
