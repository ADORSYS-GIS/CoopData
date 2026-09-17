import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/openapi-client", () => ({
  apiClient: {
    POST: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { apiClient } from "@/openapi-client";
import { useVerifyIdentity } from "@/hooks/auth/useVerifyIdentity";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockedPost = vi.mocked(apiClient.POST);

function mockSuccess(body: unknown, status = 200) {
  return {
    data: body,
    error: undefined,
    response: { status } as Response,
  };
}

function mockError(body: unknown, status: 401 | 400 | 500 = 401) {
  return {
    data: undefined,
    error: body,
    response: { status } as Response,
  };
}

describe("useVerifyIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPost.mockResolvedValue(
      mockSuccess({
        verification_token: "test-token-123",
        requires_otp: false,
      }),
    );
  });

  it("should return ok=true with verification_token on success", async () => {
    const { result } = renderHook(() => useVerifyIdentity());

    let response;
    await act(async () => {
      response = await result.current.verifyIdentity({ password: "mypassword" });
    });

    expect(response!.ok).toBe(true);
    expect(response!.verification_token).toBe("test-token-123");
    expect(response!.requires_otp).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it("should pass OTP in the request body when provided", async () => {
    const { result } = renderHook(() => useVerifyIdentity());

    await act(async () => {
      await result.current.verifyIdentity({ password: "pass", otp: "123456" });
    });

    const callArg = (mockedPost.mock.calls[0] as unknown as [string, { body: unknown }])[1];
    expect(callArg?.body).toMatchObject({ password: "pass", otp: "123456" });
  });

  it("should not include OTP in body when not provided", async () => {
    const { result } = renderHook(() => useVerifyIdentity());

    await act(async () => {
      await result.current.verifyIdentity({ password: "pass" });
    });

    const callArg = (mockedPost.mock.calls[0] as unknown as [string, { body: unknown }])[1];
    expect(callArg?.body).toMatchObject({ password: "pass" });
    expect(callArg?.body).not.toHaveProperty("otp");
  });

  it("should return ok=false on HTTP error", async () => {
    mockedPost.mockResolvedValue(mockError({ message: "Invalid credentials" }, 401));

    const { result } = renderHook(() => useVerifyIdentity());

    let response;
    await act(async () => {
      response = await result.current.verifyIdentity({ password: "wrong" });
    });

    expect(response!.ok).toBe(false);
    expect(response!.message).toBe("Invalid credentials");
  });

  it("should return ok=false on network error", async () => {
    mockedPost.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useVerifyIdentity());

    let response;
    await act(async () => {
      response = await result.current.verifyIdentity({ password: "pass" });
    });

    expect(response!.ok).toBe(false);
    expect(response!.message).toBe("Network failure");
  });

  it("should handle OTP challenge response (requires_otp without token)", async () => {
    mockedPost.mockResolvedValue(mockSuccess({ verification_token: "", requires_otp: true }));

    const { result } = renderHook(() => useVerifyIdentity());

    let response;
    await act(async () => {
      response = await result.current.verifyIdentity({ password: "pass" });
    });

    expect(response!.ok).toBe(false);
    expect(response!.requires_otp).toBe(true);
  });

  it("should handle error without message field", async () => {
    mockedPost.mockResolvedValue(mockError({ error: "unauthorized" }, 401));

    const { result } = renderHook(() => useVerifyIdentity());

    let response;
    await act(async () => {
      response = await result.current.verifyIdentity({ password: "pass" });
    });

    expect(response!.ok).toBe(false);
    expect(response!.message).toBe("unauthorized");
  });

  it("should handle malformed error response with status code", async () => {
    mockedPost.mockResolvedValue(mockError({}, 500));

    const { result } = renderHook(() => useVerifyIdentity());

    let response;
    await act(async () => {
      response = await result.current.verifyIdentity({ password: "pass" });
    });

    expect(response!.ok).toBe(false);
    expect(response!.message).toContain("500");
  });

  it("should set isPending during the call and reset after", async () => {
    let resolvePost: (v: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });
    mockedPost.mockReturnValue(pendingPromise);

    const { result } = renderHook(() => useVerifyIdentity());

    act(() => {
      result.current.verifyIdentity({ password: "pass" });
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await act(async () => {
      resolvePost!(
        mockSuccess({
          verification_token: "tk",
          requires_otp: false,
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });
});
