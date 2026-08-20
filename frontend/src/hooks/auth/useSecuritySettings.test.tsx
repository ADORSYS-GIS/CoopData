import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/openapi-client", () => ({
  apiClient: {
    GET: vi.fn(),
    POST: vi.fn(),
    DELETE: vi.fn(),
  },
}));

import { apiClient } from "@/openapi-client";
import {
  useSecuritySettings,
  useMfaSetup,
  useDisableMfa,
  useEnableMfa,
  useResetMfa,
} from "@/hooks/auth/useSecuritySettings";

const mockedGet = vi.mocked(apiClient.GET);
const mockedPost = vi.mocked(apiClient.POST);
const mockedDelete = vi.mocked(apiClient.DELETE);

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

describe("useMfaSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should POST the setup endpoint and mark MFA as enabled", async () => {
    mockedPost.mockResolvedValue(okResult({ mfa_enabled: true }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMfaSetup(), { wrapper });

    let response;
    await act(async () => {
      response = await result.current.mutateAsync();
    });

    expect(mockedPost).toHaveBeenCalledWith("/api/v1/me/security/mfa/setup");
    expect(response).toEqual({ mfa_enabled: true });
  });

  it("should surface the backend error when setup fails", async () => {
    mockedPost.mockResolvedValue(errResult("MFA is already enabled") as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMfaSetup(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow("MFA is already enabled");
  });
});

describe("useDisableMfa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should DELETE the MFA credential and return the updated settings", async () => {
    mockedDelete.mockResolvedValue(okResult({ mfa_enabled: false }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useDisableMfa(), { wrapper });

    let response;
    await act(async () => {
      response = await result.current.mutateAsync({ password: "test-password", otp: "123456" });
    });

    expect(mockedDelete).toHaveBeenCalledWith("/api/v1/me/security/mfa", {
      body: { password: "test-password", otp: "123456" },
    });
    expect(response).toEqual({ mfa_enabled: false });
  });

  it("should surface the backend error when disabling MFA fails", async () => {
    mockedDelete.mockResolvedValue(errResult("Invalid OTP code") as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useDisableMfa(), { wrapper });

    await expect(
      result.current.mutateAsync({ password: "test-password", otp: "123456" }),
    ).rejects.toThrow("Invalid OTP code");
  });
});

describe("useEnableMfa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should POST the enable endpoint and return MFA as enabled with credential preserved", async () => {
    mockedPost.mockResolvedValue(okResult({ mfa_enabled: true, mfa_configured: true }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useEnableMfa(), { wrapper });

    let response;
    await act(async () => {
      response = await result.current.mutateAsync({ password: "test-password", otp: "123456" });
    });

    expect(mockedPost).toHaveBeenCalledWith("/api/v1/me/security/mfa/enable", {
      body: { password: "test-password", otp: "123456" },
    });
    expect(response).toEqual({ mfa_enabled: true, mfa_configured: true });
  });

  it("should surface the backend error when re-enabling MFA fails", async () => {
    mockedPost.mockResolvedValue(errResult("Invalid OTP code") as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useEnableMfa(), { wrapper });

    await expect(
      result.current.mutateAsync({ password: "test-password", otp: "123456" }),
    ).rejects.toThrow("Invalid OTP code");
  });
});

describe("useResetMfa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should POST the reset endpoint and return MFA enabled with credential cleared", async () => {
    mockedPost.mockResolvedValue(okResult({ mfa_enabled: true, mfa_configured: false }) as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useResetMfa(), { wrapper });

    let response;
    await act(async () => {
      response = await result.current.mutateAsync({ password: "test-password", otp: "123456" });
    });

    expect(mockedPost).toHaveBeenCalledWith("/api/v1/me/security/mfa/reset", {
      body: { password: "test-password", otp: "123456" },
    });
    expect(response).toEqual({ mfa_enabled: true, mfa_configured: false });
  });

  it("should surface the backend error when resetting MFA fails", async () => {
    mockedPost.mockResolvedValue(errResult("Invalid OTP code") as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useResetMfa(), { wrapper });

    await expect(
      result.current.mutateAsync({ password: "test-password", otp: "123456" }),
    ).rejects.toThrow("Invalid OTP code");
  });
});
