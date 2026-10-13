import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { normalizeAppLang } from "@/lib/contentLocalization";

/**
 * Switches the app to the report language requested by the PDF renderer (`?lng=`)
 * and returns whether it is active. A print page renders its document only once
 * this is true, so no label is captured in the wrong language.
 */
export const usePrintLanguage = (lng?: string): boolean => {
  const { i18n } = useTranslation();
  const target = lng ? normalizeAppLang(lng) : undefined;
  const active = normalizeAppLang(i18n.resolvedLanguage ?? i18n.language);

  useEffect(() => {
    if (target && active !== target) {
      void i18n.changeLanguage(target);
    }
  }, [target, active, i18n]);

  return !target || active === target;
};
