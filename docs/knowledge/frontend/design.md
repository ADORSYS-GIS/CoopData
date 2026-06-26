# Design Document: DGRV Gap Assessment Tool (i18n Feature)

> **CRITICAL INSTRUCTION FOR ANY DEVELOPER OR AI**  
> You **MUST** fill this entire document with the user/client before writing a single line of code.

## 1. Project Name & One-Line Description

**Project Name:** DGRV Gap Assessment Tool
**Tagline (max 12 words):** A tool to assess Gaps, now supporting multiple languages.

## 2. Target Users & Roles

- Assessors
- Managers
- Admins

## 3. Core User Stories (MVP only)

```
As a User, I want to use the application in English, German, French, Portuguese, siSwati, or Zulu, so that I can understand the content natively.
As a User, I want my language preference to be saved, so that I don't have to select it every time I visit.
```

## 4. Full App Flow (Mermaid)

_(Standard application flow with translated UI)_

## 5. Complete Routes & Pages Table

N/A for language switcher addition, applies globally.

## 6. Data Models (TypeScript interfaces)

N/A

## 7. API Endpoints (Backend contract)

N/A

## 8. Tech Stack & Libraries (final decision)

- **i18n**: i18next, react-i18next, i18next-browser-languagedetector
- **Languages**: English (en), German (de), French (fr), Portuguese (pt), siSwati (ss), Zulu (zu)

## 9. Non-Functional Requirements

- Language selection must persist in localStorage.
- Fallback language is English.

## 10. Open Questions / Decisions Needed

- Are there specific baseline translations needed beyond common actions?

## 11. Word Export Feature

**Goal**: Allow users to download assessment results in `.docx` format with visual parity to the PDF.
**Tech Approach**: Backend generation using `docx-rs`.

- Reuse `headless_chrome` to capture chart images.
- Mirror CSS layout and colors in OpenXML tables.
- Endpoint: `/api/reports/assessment/:id/word`
