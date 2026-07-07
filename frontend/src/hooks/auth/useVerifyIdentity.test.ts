import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/shared/authService", () => ({
  getAccessToken: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { getAccessToken } from "@/services/shared/authService";
import { useVerifyIdentity } from "@/hooks/auth/useVerifyIdentity";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockedGetAccessToken = vi.mocked(getAccessToken);

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("useVerifyIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAccessToken.mockResolvedValue("fake-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          verification_token: "test-token-123",
          requires_otp: false,
        }),
      ),
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
    const fetchMock = vi.mocked(fetch);
    const { result } = renderHook(() => useVerifyIdentity());

    await act(async () => {
      await result.current.verifyIdentity({ password: "pass", otp: "123456" });
    });

    const callBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(callBody.password).toBe("pass");
    expect(callBody.otp).toBe("123456");
  });

  it("should not include OTP in body when not provided", async () => {
    const fetchMock = vi.mocked(fetch);
    const { result } = renderHook(() => useVerifyIdentity());

    await act(async () => {
      await result.current.verifyIdentity({ password: "pass" });
    });

    const callBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(callBody.password).toBe("pass");
    expect(callBody.otp).toBeUndefined();
  });

  it("should send Authorization header with access token", async () => {
    const fetchMock = vi.mocked(fetch);
    const { result } = renderHook(() => useVerifyIdentity());

    await act(async () => {
      await result.current.verifyIdentity({ password: "pass" });
    });

    const headers = fetchMock.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer fake-token");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("should return ok=false when not authenticated", async () => {
    mockedGetAccessToken.mockRejectedValue(new Error("no token"));

    const { result } = renderHook(() => useVerifyIdentity());

    let response;
    await act(async () => {
      response = await result.current.verifyIdentity({ password: "pass" });
    });

    expect(response!.ok).toBe(false);
    expect(response!.message).toContain("Not authenticated");
  });

  it("should return ok=false on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockFetchResponse({ message: "Invalid credentials" }, false, 401)),
    );

    const { result } = renderHook(() => useVerifyIdentity());

    let response;
    await act(async () => {
      response = await result.current.verifyIdentity({ password: "wrong" });
    });

    expect(response!.ok).toBe(false);
    expect(response!.message).toBe("Invalid credentials");
  });

  it("should return ok=false on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));

    const { result } = renderHook(() => useVerifyIdentity());

    let response;
    await act(async () => {
      response = await result.current.verifyIdentity({ password: "pass" });
    });

    expect(response!.ok).toBe(false);
    expect(response!.message).toBe("Network failure");
  });

  it("should handle malformed JSON response gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new Error("bad json")),
      } as unknown as Response),
    );

    const { result } = renderHook(() => useVerifyIdentity());

    let response;
    await act(async () => {
      response = await result.current.verifyIdentity({ password: "pass" });
    });

    expect(response!.ok).toBe(false);
    expect(response!.message).toContain("500");
  });

  it("should set isPending during the call and reset after", async () => {
    let resolveFetch: (v: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pendingPromise));

    const { result } = renderHook(() => useVerifyIdentity());

    act(() => {
      result.current.verifyIdentity({ password: "pass" });
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await act(async () => {
      resolveFetch!(
        mockFetchResponse({
          verification_token: "tk",
          requires_otp: false,
        }) as Response,
      );
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });
});
