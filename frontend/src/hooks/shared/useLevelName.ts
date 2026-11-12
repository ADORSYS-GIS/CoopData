import { useCallback } from "react";

import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";

const LEVEL_WORDS: Record<string, string> = {
  ministry: "Ministry",
  federation: "Federation",
  apex: "Apex",
  cooperative: "Cooperative",
};

export const useLevelName = () => {
  const { replaceOrgTerms } = useOrganizationLabelsContext();

  return useCallback(
    (level: string | null | undefined): string => {
      if (!level) return "";
      const word = LEVEL_WORDS[level.toLowerCase()];
      return word ? replaceOrgTerms(word) : level;
    },
    [replaceOrgTerms],
  );
};
