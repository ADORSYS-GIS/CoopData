import { createContext, useContext, useMemo, type ReactNode } from "react";
import i18n from "i18next";
import { useTranslation } from "react-i18next";
import { useOrganizationLabels } from "@/hooks/settings/useOrganizationLabels";

export interface OrganizationLabelTranslation {
  label?: string;
  short_label?: string;
  plural_label?: string;
  description?: string;
}

export interface OrganizationLabelItem {
  key: string;
  label: string;
  short_label: string;
  plural_label: string;
  description?: string | null;
  icon: string;
  translations?: Record<string, OrganizationLabelTranslation> | unknown;
  created_at?: string;
  updated_at?: string;
}

export interface OrganizationLabelsContextValue {
  labels: OrganizationLabelItem[];
  isLoading: boolean;
  getLabel: (
    key: string,
    type: "label" | "short_label" | "plural_label",
    fallback?: string,
  ) => string;
  t: (
    key: string,
    optionsOrDefault?: Record<string, unknown> | string,
    options?: Record<string, unknown>,
  ) => string;
  replaceOrgTerms: (text: string) => string;

  fedLabel: string;
  fedPlural: string;
  fedShort: string;

  apexLabel: string;
  apexPlural: string;
  apexShort: string;

  coopLabel: string;
  coopPlural: string;
  coopShort: string;

  ministryLabel: string;
  ministryPlural: string;
  ministryShort: string;
}

const OrganizationLabelsContext = createContext<OrganizationLabelsContextValue | null>(null);

const DEFAULT_LABELS: Record<string, { label: string; short_label: string; plural_label: string }> =
  {
    ministry: { label: "Ministry", short_label: "Min", plural_label: "Ministries" },
    federation: { label: "Federation", short_label: "Fed", plural_label: "Federations" },
    apex: { label: "Apex", short_label: "Apex", plural_label: "Apexes" },
    cooperative: { label: "Cooperative", short_label: "Coop", plural_label: "Cooperatives" },
  };

export function OrganizationLabelsProvider({ children }: { children: ReactNode }) {
  const { data: labels, isLoading } = useOrganizationLabels();
  const { t: baseT } = useTranslation();

  const getLabel = useMemo(() => {
    return (
      key: string,
      type: "label" | "short_label" | "plural_label",
      fallback?: string,
    ): string => {
      const currentLang = i18n.language || "en";
      const item = labels?.find((l) => l.key === key);

      if (!item) {
        return DEFAULT_LABELS[key]?.[type] || fallback || key;
      }

      // 1. Try to read from translations map in the current language
      if (item.translations && typeof item.translations === "object") {
        const langOverrides = (item.translations as Record<string, Record<string, string>>)[
          currentLang
        ];
        if (langOverrides && typeof langOverrides === "object") {
          const val = langOverrides[type];
          if (val && typeof val === "string" && val.trim().length > 0) {
            return val;
          }
        }
      }

      // 2. Fall back to standard columns (which hold the default values)
      const val = item[type];
      if (val && typeof val === "string" && val.trim().length > 0) {
        return val;
      }

      // 3. Fall back to static defaults
      return DEFAULT_LABELS[key]?.[type] || fallback || key;
    };
  }, [labels]);

  const fedLabel = getLabel("federation", "label", "Federation");
  const fedPlural = getLabel("federation", "plural_label", "Federations");
  const fedShort = getLabel("federation", "short_label", "Fed");

  const apexLabel = getLabel("apex", "label", "Apex");
  const apexPlural = getLabel("apex", "plural_label", "Apexes");
  const apexShort = getLabel("apex", "short_label", "Apex");

  const coopLabel = getLabel("cooperative", "label", "Cooperative");
  const coopPlural = getLabel("cooperative", "plural_label", "Cooperatives");
  const coopShort = getLabel("cooperative", "short_label", "Coop");

  const ministryLabel = getLabel("ministry", "label", "Ministry");
  const ministryPlural = getLabel("ministry", "plural_label", "Ministries");
  const ministryShort = getLabel("ministry", "short_label", "Min");

  const replaceOrgTerms = useMemo(() => {
    return (text: string): string => {
      if (!text || typeof text !== "string") return text;

      let res = text;

      // 1. Plurals
      if (fedPlural !== "Federations") {
        res = res.replace(/\bFederations\b/g, fedPlural);
        res = res.replace(/\bfederations\b/g, fedPlural.toLowerCase());
      }
      if (apexPlural !== "Apexes") {
        res = res.replace(/\bApexes\b/g, apexPlural);
        res = res.replace(/\bapexes\b/g, apexPlural.toLowerCase());
      }
      if (coopPlural !== "Cooperatives") {
        res = res.replace(/\bCooperatives\b/g, coopPlural);
        res = res.replace(/\bcooperatives\b/g, coopPlural.toLowerCase());
      }
      if (ministryPlural !== "Ministries") {
        res = res.replace(/\bMinistries\b/g, ministryPlural);
        res = res.replace(/\bministries\b/g, ministryPlural.toLowerCase());
      }

      // 2. Singulars
      if (fedLabel !== "Federation") {
        res = res.replace(/\bFederation\b/g, fedLabel);
        res = res.replace(/\bfederation\b/g, fedLabel.toLowerCase());
      }
      if (apexLabel !== "Apex") {
        res = res.replace(/\bApex\b/g, apexLabel);
        res = res.replace(/\bapex\b/g, apexLabel.toLowerCase());
      }
      if (coopLabel !== "Cooperative") {
        res = res.replace(/\bCooperative\b/g, coopLabel);
        res = res.replace(/\bcooperative\b/g, coopLabel.toLowerCase());
      }
      if (ministryLabel !== "Ministry") {
        res = res.replace(/\bMinistry\b/g, ministryLabel);
        res = res.replace(/\bministry\b/g, ministryLabel.toLowerCase());
      }

      return res;
    };
  }, [
    fedLabel,
    fedPlural,
    apexLabel,
    apexPlural,
    coopLabel,
    coopPlural,
    ministryLabel,
    ministryPlural,
  ]);

  const t = useMemo(() => {
    return (
      key: string,
      optionsOrDefault?: Record<string, unknown> | string,
      options?: Record<string, unknown>,
    ): string => {
      const translation = baseT(key, optionsOrDefault as never, options as never);
      return replaceOrgTerms(String(translation));
    };
  }, [baseT, replaceOrgTerms]);

  const value = useMemo(
    () => ({
      labels: labels || [],
      isLoading,
      getLabel,
      t,
      replaceOrgTerms,
      fedLabel,
      fedPlural,
      fedShort,
      apexLabel,
      apexPlural,
      apexShort,
      coopLabel,
      coopPlural,
      coopShort,
      ministryLabel,
      ministryPlural,
      ministryShort,
    }),
    [
      labels,
      isLoading,
      getLabel,
      t,
      replaceOrgTerms,
      fedLabel,
      fedPlural,
      fedShort,
      apexLabel,
      apexPlural,
      apexShort,
      coopLabel,
      coopPlural,
      coopShort,
      ministryLabel,
      ministryPlural,
      ministryShort,
    ],
  );

  return (
    <OrganizationLabelsContext.Provider value={value}>
      {children}
    </OrganizationLabelsContext.Provider>
  );
}

export function useOrganizationLabelsContext() {
  const context = useContext(OrganizationLabelsContext);
  if (!context) {
    throw new Error(
      "useOrganizationLabelsContext must be used within an OrganizationLabelsProvider",
    );
  }
  return context;
}
