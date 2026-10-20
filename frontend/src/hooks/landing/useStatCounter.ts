import { useRef } from "react";
import { useTranslation } from "react-i18next";

import type { LandingStat } from "@/constants/landing";
import { useCountUp } from "@/hooks/landing/useCountUp";
import { useInView } from "@/hooks/landing/useInView";

/** Counts a landing figure up once it scrolls into view; returns the live text and the final text. */
export const useStatCounter = <T extends Element>(stat: LandingStat) => {
  const { i18n } = useTranslation();
  const ref = useRef<T>(null);
  const current = useCountUp(stat.value, useInView(ref));
  const format = new Intl.NumberFormat(i18n.resolvedLanguage ?? "en", {
    minimumFractionDigits: stat.decimals,
    maximumFractionDigits: stat.decimals,
  }).format;
  const withAffixes = (n: number) => `${stat.prefix ?? ""}${format(n)}${stat.suffix ?? ""}`;

  return { ref, display: withAffixes(current), finalText: withAffixes(stat.value) };
};
