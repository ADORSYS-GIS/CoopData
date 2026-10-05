/**
 * The published legal documents a user can accept. `type` is what the consent API
 * records, `slug` identifies the document in the legal centre.
 *
 * - `required`: must be accepted to use the Platform (Terms, Privacy Policy).
 * - `consent`: optional permission the user may give or not (data use).
 * - `acknowledge`: optional acknowledgement that the user has read the document.
 *
 * The Cookie Policy is not listed: cookie choices are a browser preference made in
 * the cookie banner, because CoopData only uses essential cookies.
 */
export const LEGAL_DOCUMENTS = [
  { type: "TERMS_OF_SERVICE", slug: "terms", titleKey: "legal.termsOfService", kind: "required" },
  { type: "PRIVACY_POLICY", slug: "privacy", titleKey: "legal.privacyPolicy", kind: "required" },
  { type: "DATA_USE_CONSENT", slug: "data-use", titleKey: "legal.dataUse", kind: "consent" },
  {
    type: "ACCEPTABLE_USE",
    slug: "acceptable-use",
    titleKey: "legal.acceptableUse",
    kind: "acknowledge",
  },
  {
    type: "SECURITY_PROTECTION",
    slug: "security",
    titleKey: "legal.securityProtection",
    kind: "acknowledge",
  },
  {
    type: "DATA_RETENTION",
    slug: "data-retention",
    titleKey: "legal.dataRetention",
    kind: "acknowledge",
  },
  {
    type: "DATA_PROCESSING_GOVERNANCE",
    slug: "data-processing",
    titleKey: "legal.dataProcessing",
    kind: "acknowledge",
  },
] as const;

export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];
export type LegalDocumentType = LegalDocument["type"] | "COOKIE_POLICY";

/** Translation key of a document type's title, for consent history rows. */
export const legalDocumentTitleKey = (type: string): string =>
  LEGAL_DOCUMENTS.find((d) => d.type === type)?.titleKey ??
  (type === "COOKIE_POLICY" ? "legal.cookiePolicy" : type);
