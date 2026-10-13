import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const auth = vi.hoisted(() => ({ getOfflineSessionExpiry: vi.fn<() => number | null>() }));
vi.mock("@/services/shared/authService", () => auth);

import { useSessionDeadline } from "./useSessionDeadline";

const DAY = 24 * 60 * 60 * 1000;

describe("useSessionDeadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not warn while the deadline is far away", () => {
    auth.getOfflineSessionExpiry.mockReturnValue(Date.now() + 10 * DAY);

    const { result } = renderHook(() => useSessionDeadline());

    expect(result.current.daysLeft).toBe(10);
    expect(result.current.warn).toBe(false);
  });

  it("warns in the last three days", () => {
    auth.getOfflineSessionExpiry.mockReturnValue(Date.now() + 2.5 * DAY);

    const { result } = renderHook(() => useSessionDeadline());

    expect(result.current.daysLeft).toBe(2);
    expect(result.current.warn).toBe(true);
  });

  it("calls onExpired once when the deadline passes while the app is open", () => {
    auth.getOfflineSessionExpiry.mockReturnValue(Date.now() + 90_000);
    const onExpired = vi.fn();
    renderHook(() => useSessionDeadline(onExpired));
    expect(onExpired).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });

    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there is no saved login", () => {
    auth.getOfflineSessionExpiry.mockReturnValue(null);
    const onExpired = vi.fn();

    const { result } = renderHook(() => useSessionDeadline(onExpired));

    expect(result.current).toEqual({ expiresAt: null, daysLeft: null, warn: false });
    expect(onExpired).not.toHaveBeenCalled();
  });
});
