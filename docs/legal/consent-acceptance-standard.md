# Consent & Legal Acceptance Management Standard

> Internal standard (not published to users). Source: `sources/policies/09 Consent and
> Acceptance Management Standard.docx`. It defines what the Platform must record when a
> user accepts a legal document or gives an optional consent; see
> `docs/features/legal-consent-management.md` for how this is implemented.

**Version 1.0 | Proposed effective date:** 1 October 2026

## 1. Purpose

This standard defines what CoopData should record when a user accepts legal terms or gives an optional consent. It is intended to create an auditable record without treating every interaction as “consent” when another legal basis applies.

## 2. Separate acceptance from consent

Terms of Service acceptance is a contractual/legal acceptance event. Privacy notices acknowledge information provided to the user. Optional processing permissions, such as aggregated reporting consent, should be captured as separate consent events where consent is the applicable legal basis. These should not be bundled into one mandatory checkbox.

## 3. Minimum acceptance record

- Document name and type.
- Document version.
- Effective date.
- User/account identifier.
- Organization identifier.
- Date and time with timezone.
- Acceptance/consent status.
- Interface or method used.
- Where feasible, relevant IP/device/security evidence.
- Withdrawal date/time where applicable.
- Record of the exact version shown or a reliable reference to it.

## 4. Recommended UI

- **Mandatory:** “I have read and agree to the CoopData Terms of Service.”
- **Mandatory acknowledgement:** “I acknowledge that I have read the CoopData Privacy Policy.”
- **Optional:** “I agree to the use of eligible data for aggregated/de-identified sector reporting as described in the Data Use, Aggregation & Consent Notice.”
- Optional communications consent should be separate from operational notices.

## 5. Withdrawal and changes

The system should make it possible to record withdrawal of optional consent without deleting the historical consent record needed for accountability. Withdrawal should affect future processing based on that consent, subject to legal and operational limitations.

## 6. Version control

When a material legal document changes, the Platform should preserve prior versions and, where required, prompt users to review and accept the new version before continued use.
