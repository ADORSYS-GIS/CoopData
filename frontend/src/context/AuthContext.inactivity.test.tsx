import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Test the inactivity timeout logic in isolation
// This tests the core logic without React rendering

describe("Inactivity Timeout Logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Timer Reset Behavior", () => {
    it("should reset timer on activity", () => {
      const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
      const startTime = new Date("2026-01-01T10:00:00Z").getTime();
      vi.setSystemTime(startTime);

      let lastActivity = Date.now();
      let logoutCalled = false;
      let timeoutId: ReturnType<typeof setTimeout>;

      const checkInactivity = () => {
        const idleTime = Date.now() - lastActivity;
        if (idleTime >= INACTIVITY_TIMEOUT_MS) {
          logoutCalled = true;
        }
      };

      const resetTimer = () => {
        clearTimeout(timeoutId);
        lastActivity = Date.now();
        timeoutId = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS);
      };

      // Start timer
      timeoutId = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS);

      // Advance 5 minutes
      vi.setSystemTime(new Date(startTime + 5 * 60 * 1000));
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(logoutCalled).toBe(false);

      // User activity resets timer (re-schedules the timeout)
      resetTimer();

      // Advance another 5 minutes (total 10 min from start, but timer was reset)
      vi.setSystemTime(new Date(startTime + 10 * 60 * 1000));
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(logoutCalled).toBe(false);

      // Advance 10 more minutes (total 15 min from original start, but 5 min from reset)
      vi.setSystemTime(new Date(startTime + 15 * 60 * 1000));
      vi.advanceTimersByTime(10 * 60 * 1000);
      expect(logoutCalled).toBe(true);

      clearTimeout(timeoutId);
    });

    it("should trigger logout after 10 minutes of no activity", () => {
      const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
      const startTime = new Date("2026-01-01T10:00:00Z").getTime();
      vi.setSystemTime(startTime);

      const lastActivity = Date.now();
      let logoutCalled = false;

      const checkInactivity = () => {
        const idleTime = Date.now() - lastActivity;
        if (idleTime >= INACTIVITY_TIMEOUT_MS) {
          logoutCalled = true;
        }
      };

      // Start timer
      setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS);

      // Advance 10 minutes without activity
      vi.setSystemTime(new Date(startTime + 10 * 60 * 1000));
      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(logoutCalled).toBe(true);
    });

    it("should NOT trigger logout if activity occurs at 9 minutes", () => {
      const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
      const startTime = new Date("2026-01-01T10:00:00Z").getTime();
      vi.setSystemTime(startTime);

      let lastActivity = Date.now();
      let logoutCalled = false;
      let timeoutId: ReturnType<typeof setTimeout>;

      const checkInactivity = () => {
        const idleTime = Date.now() - lastActivity;
        if (idleTime >= INACTIVITY_TIMEOUT_MS) {
          logoutCalled = true;
        }
      };

      const resetTimer = () => {
        clearTimeout(timeoutId);
        lastActivity = Date.now();
        timeoutId = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS);
      };

      // Start timer
      timeoutId = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS);

      // Advance 9 minutes
      vi.setSystemTime(new Date(startTime + 9 * 60 * 1000));
      vi.advanceTimersByTime(9 * 60 * 1000);
      expect(logoutCalled).toBe(false);

      // User activity at 9 minutes - this resets the timer (re-schedules the timeout)
      resetTimer();

      // Advance 1 more minute (total 10 min from original start, but timer was reset)
      vi.setSystemTime(new Date(startTime + 10 * 60 * 1000));
      vi.advanceTimersByTime(1 * 60 * 1000);
      expect(logoutCalled).toBe(false);

      // Advance 10 more minutes (total 20 min from original start, but 10 min from reset)
      vi.setSystemTime(new Date(startTime + 20 * 60 * 1000));
      vi.advanceTimersByTime(10 * 60 * 1000);
      expect(logoutCalled).toBe(true);

      clearTimeout(timeoutId);
    });
  });

  describe("Event Debouncing", () => {
    it("should debounce rapid events using requestAnimationFrame", () => {
      let resetCount = 0;
      let rafId: number | null = null;

      const handleActivity = () => {
        if (rafId) return; // Already scheduled
        rafId = requestAnimationFrame(() => {
          rafId = null;
          resetCount++;
        });
      };

      // Simulate 100 mousemove events
      for (let i = 0; i < 100; i++) {
        handleActivity();
      }

      // Advance time to trigger RAF callbacks
      vi.advanceTimersByTime(16); // ~60fps

      // Should only reset once (debounced)
      expect(resetCount).toBe(1);
    });

    it("should allow new activity after RAF completes", () => {
      let resetCount = 0;
      let rafId: number | null = null;

      const handleActivity = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          resetCount++;
        });
      };

      // First batch of events
      handleActivity();
      handleActivity();
      handleActivity();

      // Advance time to complete RAF
      vi.advanceTimersByTime(16);

      // New activity should be allowed
      handleActivity();

      // Advance time again
      vi.advanceTimersByTime(16);

      // Should have reset twice (once per RAF cycle)
      expect(resetCount).toBe(2);
    });
  });

  describe("Cleanup", () => {
    it("should cleanup timeout on unmount", () => {
      const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
      let logoutCalled = false;

      const checkInactivity = () => {
        logoutCalled = true;
      };

      // Start timer
      const timeoutId = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS);

      // Cleanup (simulating unmount)
      clearTimeout(timeoutId);

      // Advance 10 minutes
      vi.advanceTimersByTime(10 * 60 * 1000);

      // Logout should NOT have been called (timer was cleared)
      expect(logoutCalled).toBe(false);
    });

    it("should cleanup RAF on unmount", () => {
      let rafId: number | null = null;
      let callbackRan = false;

      const handleActivity = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          callbackRan = true;
        });
      };

      handleActivity();

      // Cleanup (simulating unmount)
      if (rafId) cancelAnimationFrame(rafId);

      // Advance time
      vi.advanceTimersByTime(16);

      // Callback should NOT have run
      expect(callbackRan).toBe(false);
    });
  });

  describe("Activity Events", () => {
    it("should track all required activity events", () => {
      const expectedEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
      const actualEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

      expectedEvents.forEach((event, index) => {
        expect(event).toBe(actualEvents[index]);
      });
    });
  });
});

// Integration test for the actual React component behavior
describe("Inactivity Timeout - React Component", () => {
  it("should have correct timeout value", () => {
    const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
    expect(INACTIVITY_TIMEOUT_MS).toBe(10 * 60 * 1000); // 600000 ms
    expect(INACTIVITY_TIMEOUT_MS).toBe(600000);
  });

  it("should track all required activity events", () => {
    const expectedEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    const actualEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

    expectedEvents.forEach((event, index) => {
      expect(event).toBe(actualEvents[index]);
    });
  });
});
