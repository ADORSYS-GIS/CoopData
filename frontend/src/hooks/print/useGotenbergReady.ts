import { useEffect } from "react";

/**
 * Signals Gotenberg's headless Chromium that the print page is fully rendered.
 *
 * Fires `window.isReady = true` once `ready` flips true — after a double
 * requestAnimationFrame (guarantees at least one painted frame) plus a short
 * settle delay for Recharts layout. This is deterministic ("a frame painted"),
 * unlike the hardcoded setTimeout delays it replaces. Gotenberg polls the page
 * with `waitForExpression: window.isReady === true`.
 */
export const useGotenbergReady = (ready: boolean, settleDelayMs = 150): void => {
  useEffect(() => {
    if (!ready) return undefined;

    let frame1 = 0;
    let frame2 = 0;
    const timer = setTimeout(() => {
      frame1 = requestAnimationFrame(() => {
        frame2 = requestAnimationFrame(() => {
          (window as unknown as { isReady: boolean }).isReady = true;
        });
      });
    }, settleDelayMs);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [ready, settleDelayMs]);
};
