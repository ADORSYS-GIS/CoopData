import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNetworkStatus } from "./useNetworkStatus";

const mockGetPendingCount = vi.hoisted(() => vi.fn<() => Promise<number>>().mockResolvedValue(0));
const mockFlushSyncQueue = vi.hoisted(() =>
  vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
);
const mockIsOfflineModeActive = vi.hoisted(() => vi.fn<() => boolean>().mockReturnValue(false));

vi.mock("../../services/shared/syncQueueService", () => ({
  getPendingCount: mockGetPendingCount,
  flushSyncQueue: mockFlushSyncQueue,
}));

vi.mock("../../services/shared/authService", () => ({
  isOfflineModeActive: mockIsOfflineModeActive,
}));

describe("useNetworkStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns isOnline true when navigator is online", () => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.isOnline).toBe(true);
  });

  it("returns isOnline false when navigator is offline", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.isOnline).toBe(false);
  });

  it("returns isOnline false when offline mode is active", () => {
    mockIsOfflineModeActive.mockReturnValue(true);

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.isOnline).toBe(false);
  });

  it("sets wasOffline true after coming back online", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.isOnline).toBe(false);

    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    act(() => {
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.wasOffline).toBe(true);
  });

  it("resets wasOffline after 5 seconds", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    act(() => {
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(5100);
    });

    expect(result.current.wasOffline).toBe(false);
  });

  it("tracks pending sync count", async () => {
    mockGetPendingCount.mockResolvedValue(5);

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    await vi.waitFor(() => {
      expect(result.current.pendingSyncCount).toBe(5);
    });
  });

  it("initializes with pending count from sync queue", async () => {
    mockGetPendingCount.mockResolvedValue(3);

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    await vi.waitFor(() => {
      expect(result.current.pendingSyncCount).toBe(3);
    });
  });

  it("flushes sync queue when coming online", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });

    renderHook(() => useNetworkStatus());

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    act(() => {
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(100);
    });

    expect(mockFlushSyncQueue).toHaveBeenCalled();
  });
});
