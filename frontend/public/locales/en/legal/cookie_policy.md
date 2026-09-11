# Cookie & Storage Policy

**Effective Date:** September 10, 2026  
**Version:** 1.0  

CoopData utilizes cookies, local storage, and IndexedDB technology to ensure secure authentication, platform responsiveness, and offline operational functionality.

---

## 1. What Are Cookies & Storage Technologies?
Cookies and browser storage mechanisms (such as `localStorage` and `IndexedDB`) are small text or data files stored on your local browser when you access CoopData.

## 2. Categories of Storage Used
We use the following types of browser storage:

### A. Strictly Necessary Cookies & Tokens
- **Session & Auth Tokens (JWT):** Secure HTTP-only cookies and local session state used to maintain user authentication and security state.
- **CSRF Tokens:** Security tokens used to prevent cross-site request forgery attacks.

### B. Offline & Cache Storage (IndexedDB / PWA)
- **Offline Data Cache:** Stores draft submissions, offline questionnaire responses, and static UI assets locally using IndexedDB to enable full offline-first functionality.

### C. Functional Preferences
- **Theme & Language:** Preferences for dark mode / light mode and selected language (English, French, etc.) saved in `localStorage`.

## 3. Third-Party Analytics & Tracking
CoopData **does not** use intrusive third-party advertising cookies, cross-site trackers, or behavioral profiling technology.

## 4. Managing Cookies & Storage
You can clear your browser storage at any time through your browser settings. Please note that clearing authentication tokens will log you out, and clearing IndexedDB storage will clear un-synced offline draft submissions.
