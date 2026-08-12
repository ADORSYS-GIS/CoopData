import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/openapi-client", () => ({
  apiClient: {
    GET: vi.fn(),
    PUT: vi.fn(),
  },
}));

import { apiClient } from "@/openapi-client";
import { useSecuritySettings, useUpdateMfa } from "@/hooks/auth/useSecuritySettings";

const mockedGet = vi.mocked(apiClient.GET);
const mockedPut = vi.mocked(apiClient.PUT);

function okResult(body: unknown) {
  return { data: body, error: undefined };
}

function errResult(message: string) {
  return { data: undefined, error: { message } };
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

describe("useSecuritySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch and return the MFA status", async () => {
    mockedGet.mockResolvedValue(okResult({ mfa_enabled: true }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSecuritySettings(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ mfa_enabled: true }));
    expect(mockedGet).toHaveBeenCalledWith("/api/v1/me/security");
  });

  it("should throw a readable error when the fetch fails", async () => {
    mockedGet.mockResolvedValue(errResult("Failed to load security settings") as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSecuritySettings(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe("useUpdateMfa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should PUT the new MFA state and return the updated settings", async () => {
    mockedPut.mockResolvedValue(okResult({ mfa_enabled: true }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateMfa(), { wrapper });

    let response;
    await act(async () => {
      response = await result.current.mutateAsync(true);
    });

    expect(mockedPut).toHaveBeenCalledWith("/api/v1/me/security/mfa", {
      body: { enabled: true },
    });
    expect(response).toEqual({ mfa_enabled: true });
  });

  it("should surface the backend message on failure", async () => {
    mockedPut.mockResolvedValue(errResult("Keycloak unavailable") as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateMfa(), { wrapper });

    await expect(result.current.mutateAsync(false)).rejects.toThrow("Keycloak unavailable");
  });
});
