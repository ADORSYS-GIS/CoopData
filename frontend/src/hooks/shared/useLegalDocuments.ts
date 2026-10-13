// frontend/src/hooks/shared/useLegalDocuments.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/openapi-client";
import type { LegalPolicy } from "@/types/legalPolicy";

const FALLBACK_POLICIES: Record<
  string,
  { title_en: string; title_fr: string; title_pt: string; title_ss: string; file: string }
> = {
  privacy: {
    title_en: "Privacy Policy",
    title_fr: "Politique de confidentialité",
    title_pt: "Política de Privacidade",
    title_ss: "Inchubomgomo Yebumfihlo",
    file: "privacy.md",
  },
  terms: {
    title_en: "Terms of Service",
    title_fr: "Conditions d’utilisation",
    title_pt: "Termos de Serviço",
    title_ss: "Imigomo Yekusebentisa",
    file: "terms.md",
  },
  cookies: {
    title_en: "Cookie & Similar Technologies Policy",
    title_fr: "Politique relative aux cookies et technologies similaires",
    title_pt: "Política de Cookies e Tecnologias Semelhantes",
    title_ss: "Inchubomgomo Yemakhukhi Netindlela Letifanako",
    file: "cookies.md",
  },
  "acceptable-use": {
    title_en: "Acceptable Use Policy",
    title_fr: "Politique d’utilisation acceptable",
    title_pt: "Política de Utilização Aceitável",
    title_ss: "Inchubomgomo Yekusebentisa Lokwemukelekako",
    file: "acceptable_use.md",
  },
  security: {
    title_en: "Security & Data Protection Statement",
    title_fr: "Déclaration de sécurité et de protection des données",
    title_pt: "Declaração de Segurança e Proteção de Dados",
    title_ss: "Sitatimende Sekuvikeleka Nekuvikelwa Kwemininingwane",
    file: "security.md",
  },
  "data-retention": {
    title_en: "Data Retention & Erasure Schedule",
    title_fr: "Calendrier de conservation et d’effacement des données",
    title_pt: "Calendário de Conservação e Eliminação de Dados",
    title_ss: "Luhlelo Lwekugcinwa Nekucishwa Kwemininingwane",
    file: "data_retention.md",
  },
  "data-use": {
    title_en: "Data Use, Aggregation & Consent Notice",
    title_fr: "Avis sur l’utilisation et l’agrégation des données et le consentement",
    title_pt: "Aviso sobre Utilização, Agregação de Dados e Consentimento",
    title_ss: "Satiso Sekusetjentiswa Nekuhlanganiswa Kwemininingwane Nemvume",
    file: "data_use.md",
  },
  "data-processing": {
    title_en: "Data Processing Governance & Roles",
    title_fr: "Gouvernance et rôles en matière de traitement des données",
    title_pt: "Governação e Funções no Tratamento de Dados",
    title_ss: "Kuphatsa Nemisebenti Ekucubungulweni Kwemininingwane",
    file: "data_processing.md",
  },
};

export function useLegalDocuments() {
  const {
    data: policies = [],
    isLoading,
    error,
    refetch,
  } = useQuery<LegalPolicy[]>({
    queryKey: ["legal-policies"],
    queryFn: async () => {
      try {
        const { data, error: apiErr } = await apiClient.GET("/api/v1/legal/policies", {});
        if (!apiErr && Array.isArray(data) && data.length > 0) {
          return data as LegalPolicy[];
        }
      } catch {
        // Ignore API error and fallback
      }

      // Fallback: build synthetic items from local files
      const fallbacks: LegalPolicy[] = [];
      const now = new Date().toISOString();
      for (const [slug, info] of Object.entries(FALLBACK_POLICIES)) {
        fallbacks.push({
          id: `fallback-${slug}`,
          policy_id: `fallback-policy-${slug}`,
          slug,
          title_en: info.title_en,
          title_fr: info.title_fr,
          title_pt: info.title_pt,
          title_ss: info.title_ss,
          content_en: "",
          content_fr: "",
          content_pt: "",
          content_ss: "",
          version: 1,
          created_at: now,
          updated_at: now,
        });
      }
      return fallbacks;
    },
  });

  return {
    policies,
    isLoading,
    error,
    refetch,
  };
}
