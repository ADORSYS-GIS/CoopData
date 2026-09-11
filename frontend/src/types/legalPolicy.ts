// frontend/src/types/legalPolicy.ts
export interface LegalPolicy {
  id: string;
  policy_id: string;
  slug: string;
  title_en: string;
  title_fr: string;
  content_en: string;
  content_fr: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface LegalPolicyCreateInput {
  slug: string;
  title_en: string;
  title_fr: string;
  content_en: string;
  content_fr: string;
}

export interface LegalPolicyUpdateInput {
  title_en?: string;
  title_fr?: string;
  content_en?: string;
  content_fr?: string;
}
