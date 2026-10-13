import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const auth = vi.hoisted(() => ({ restoreOnlineSession: vi.fn() }));
vi.mock("./authService", () => auth);

import { keepRestoringSession, RESTORE_RETRY_DELAYS_MS } from "./sessionRestore";

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
}

describe("keepRestoringSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries while Keycloak is unreachable, then reports the session restored", async () => {
    auth.restoreOnlineSession
      .mockResolvedValueOnce("unreachable")
      .mockResolvedValueOnce("unreachable")
      .mockResolvedValueOnce("restored");
    const onSettled = vi.fn();

    keepRestoringSession(onSettled);
    await vi.advanceTimersByTimeAsync(RESTORE_RETRY_DELAYS_MS[0] + RESTORE_RETRY_DELAYS_MS[1]);

    expect(auth.restoreOnlineSession).toHaveBeenCalledTimes(3);
    expect(onSettled).toHaveBeenCalledExactlyOnceWith("restored");
  });

  it("reports an ended session at once, without retrying", async () => {
    auth.restoreOnlineSession.mockResolvedValue("ended");
    const onSettled = vi.fn();

    keepRestoringSession(onSettled);
    await vi.advanceTimersByTimeAsync(RESTORE_RETRY_DELAYS_MS[0] * 3);

    expect(auth.restoreOnlineSession).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledExactlyOnceWith("ended");
  });

  it("stops retrying when the browser goes offline again", async () => {
    auth.restoreOnlineSession.mockImplementation(async () => {
      setOnline(false);
      return "unreachable";
    });
    const onSettled = vi.fn();

    keepRestoringSession(onSettled);
    await vi.advanceTimersByTimeAsync(RESTORE_RETRY_DELAYS_MS[0] * 3);

    expect(auth.restoreOnlineSession).toHaveBeenCalledTimes(1);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("stops retrying once cancelled", async () => {
    auth.restoreOnlineSession.mockResolvedValue("unreachable");
    const onSettled = vi.fn();

    const cancel = keepRestoringSession(onSettled);
    await vi.advanceTimersByTimeAsync(0);
    cancel();
    await vi.advanceTimersByTimeAsync(RESTORE_RETRY_DELAYS_MS[0] * 3);

    expect(auth.restoreOnlineSession).toHaveBeenCalledTimes(1);
  });
});
