import { useEffect, useState } from "react";

import { prefersReducedMotion } from "@/lib/motion";

const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Animates from 0 to `target` once `start` is true; jumps straight to `target` under reduced motion. */
export const useCountUp = (target: number, start: boolean, durationMs = 1800): number => {
  const [reduced] = useState(prefersReducedMotion);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start || reduced) return;
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      setValue(target * easeOutExpo(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // rAF is paused in hidden or throttled tabs; never leave the figure stuck at 0.
    const settle = window.setTimeout(() => setValue(target), durationMs + 150);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [target, start, durationMs, reduced]);

  return reduced ? target : value;
};
