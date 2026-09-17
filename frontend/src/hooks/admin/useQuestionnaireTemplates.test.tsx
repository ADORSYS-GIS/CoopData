import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useQuestionnaireTemplates } from "./useQuestionnaireTemplates";
import { apiClient } from "@/openapi-client";
import { cacheGet, cacheSet } from "@/services/shared/offlineCache";

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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useQuestionnaireTemplates", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });

  it("fetches data successfully", async () => {
    const { result } = renderHook(() => useQuestionnaireTemplates(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });
    expect(result.current.data).toBeDefined();
  });

  it("handles error", async () => {
    const { fetchWithAuth } = await import("@/services/shared/authService");
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: "Failed to fetch" }),
    } as any);

    const { result } = renderHook(() => useQuestionnaireTemplates(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
