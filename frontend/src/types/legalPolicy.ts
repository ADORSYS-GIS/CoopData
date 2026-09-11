// frontend/src/types/legalPolicy.ts
export interface LegalPolicy {
  id: string;
  policy_id: string;
  slug: string;
  title_en: string;
  title_fr: string;
  title_pt: string;
  title_ss: string;
  content_en: string;
  content_fr: string;
  content_pt: string;
  content_ss: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface LegalPolicyCreateInput {
  slug: string;
  title_en: string;
  title_fr: string;
  title_pt: string;
  title_ss: string;
  content_en: string;
  content_fr: string;
  content_pt: string;
  content_ss: string;
}

export interface LegalPolicyUpdateInput {
  title_en?: string;
  title_fr?: string;
  title_pt?: string;
  title_ss?: string;
  content_en?: string;
  content_fr?: string;
  content_pt?: string;
  content_ss?: string;
}

export type LegalLang = "en" | "fr" | "pt" | "ss";
