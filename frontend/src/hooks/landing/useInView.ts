import { useEffect, useState, type RefObject } from "react";

/** Becomes true the first time the element enters the viewport, then stays true. */
export const useInView = (ref: RefObject<Element | null>, threshold = 0.4): boolean => {
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold, inView]);

  return inView;
};
