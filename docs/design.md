# Design Document: CoopData IAM Integration

> **CRITICAL INSTRUCTION FOR ANY DEVELOPER OR AI**
> This is the source of truth for the IAM (Identity & Access Management) integration epic.
> All implementation must follow this document and the referenced `RBAC_AND_AUTH_SYSTEM.md`.

## 1. Project Name & One-Line Description

**Project Name:** CoopData IAM Integration
**Tagline:** Keycloak authentication and role-based authorization for the CoopData cooperative assessment platform.

## 2. Target Users & Roles

- **Ministry** — Platform super-admin. Full control over federations, apexes, cooperatives, users, and system settings.
- **Federation** — Federation administrator. Manages apexes within their federation, invites/manages members, creates assessments.
- **Apex** — Apex administrator. Manages cooperatives within their apex, adds/removes members, creates and manages assessments.
- **Cooperative** — Cooperative user. Answers assessments and views submissions; may have `assigned_dimensions` restricting which dimensions they see.

## 3. Core User Stories (MVP)

```
As a Ministry admin, I want to log in via Keycloak and see only ministry-level routes so that I can manage federations.
As a Federation admin, I want to log in and be scoped to my organization so that I can only see my apexes.
As an Apex admin, I want to log in and be scoped to my group so that I can only see my cooperatives.
As a Cooperative user, I want to log in and see only my assigned assessments so that I can complete them.
As any user, I want my session to persist across page reloads using stored tokens so that I don't have to re-login constantly.
As any user, I want to be redirected to the correct dashboard based on my role after login.
As any user, I want to be redirected to an unauthorized page if I try to access a route I don't have access to.
```

## 4. Full App Flow (Mermaid)

```mermaid
flowchart TD
    Start([User visits app]) --> AuthCheck{Keycloak session?}
    AuthCheck -->|Yes| ParseClaims[Parse JWT claims → UserProfile]
    AuthCheck -->|No| Login[Redirect to Keycloak login]
    Login --> KeycloakAuth[Keycloak authenticates user]
    KeycloakAuth --> Callback[Redirect back with auth code]
    Callback --> TokenExchange[Exchange code for tokens via PKCE]
    TokenExchange --> StoreTokens[Store tokens in IndexedDB + memory]
    StoreTokens --> ParseClaims
    ParseClaims --> RouteGuard{ProtectedRoute checks roles}
    RouteGuard -->|ministry| MinistryDash[/ministry/dashboard]
    RouteGuard -->|federation| FedDash[/federation/dashboard]
    RouteGuard -->|apex| ApexDash[/apex/dashboard]
    RouteGuard -->|cooperative| CoopDash[/cooperative/dashboard]
    RouteGuard -->|No role match| Unauthorized[/unauthorized]
    MinistryDash --> Logout[Logout → Keycloak logout]
    FedDash --> Logout
    ApexDash --> Logout
    CoopDash --> Logout
    Logout --> Start
    style Start fill:#e1f5fe
    style Logout fill:#ffebee
    style Unauthorized fill:#fff3e0
```

## 5. Complete Routes & Pages Table

| Route | Page Component | Description | Access | Notes |
|-------|---------------|-------------|--------|-------|
| `/login` | LoginPage | Keycloak redirect target | Public | Redirects to Keycloak |
| `/unauthorized` | UnauthorizedPage | Access denied | Public | Shows role requirements |
| `/onboarding` | OnboardingPage | First-time setup | ministry, federation, apex, cooperative | |
| `/ministry/dashboard` | MinistryDashboard | Ministry overview | ministry | |
| `/ministry/federations` | FederationListPage | List federations | ministry | |
| `/ministry/federations/new` | FederationCreatePage | Create federation | ministry | |
| `/ministry/federations/:id` | FederationDetailPage | View federation | ministry | |
| `/ministry/federations/:id/edit` | FederationEditPage | Edit federation | ministry | |
| `/federation/dashboard` | FederationDashboard | Federation overview | federation | |
| `/federation/apexes` | ApexListPage | List apexes | federation | |
| `/federation/apexes/new` | ApexCreatePage | Create apex | federation | |
| `/federation/apexes/:id` | ApexDetailPage | View apex | federation | |
| `/apex/dashboard` | ApexDashboard | Apex overview | apex | |
| `/apex/cooperatives` | CooperativeListPage | List cooperatives | apex | |
| `/apex/cooperatives/new` | CooperativeCreatePage | Create cooperative | apex | |
| `/apex/cooperatives/:id` | CooperativeDetailPage | View cooperative | apex, cooperative | |
| `/cooperative/dashboard` | CooperativeDashboard | Cooperative overview | cooperative, apex | |
| `/cooperative/assessments` | AssessmentListPage | List assessments | cooperative, apex | |

## 6. Data Models (TypeScript interfaces)

```typescript
// Auth types
type Role = "ministry" | "federation" | "apex" | "cooperative";

interface UserProfile {
  sub: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  roles: string[];
  realm_access?: { roles: string[] };
  organization?: Record<string, { id: string }>;
  organization_name?: string;
  organization_id?: string;
  cooperation?: string[];
  assigned_dimensions?: string[];
  is_member_of?: boolean;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  expiresAt?: number;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
  hasRole: (...roles: Role[]) => boolean;
}
```

## 7. API Endpoints (Backend contract)

Already defined in `docs/RBAC_AND_AUTH_SYSTEM.md` Appendix A. Key endpoints:

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/v1/ministry/federations` | Create federation | ministry |
| GET | `/api/v1/ministry/federations` | List federations | ministry |
| GET | `/api/v1/federation/apexes` | List apexes (scoped) | federation |
| POST | `/api/v1/federation/apexes` | Create apex | federation |
| GET | `/api/v1/apex/cooperatives` | List cooperatives (scoped) | apex |
| POST | `/api/v1/apex/cooperatives` | Create cooperative | apex |
| GET | `/api/v1/me` | Get current user | JWT |

## 8. Tech Stack & Libraries (final decision)

- **Framework:** React + Vite (TanStack Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** TanStack Query + React Context (Auth)
- **Auth:** Keycloak (keycloak-js) + idb-keyval for token persistence
- **Data Fetching:** OpenAPI-generated client + TanStack Query hooks
- **Forms & Validation:** React Hook Form + Zod
- **i18n:** Not yet (future)
- **Deployment:** Docker

## 9. Non-Functional Requirements

- Mobile responsive: Yes
- Offline support: Yes (IndexedDB token cache + sync queue)
- Dark mode: Yes (via shadcn/ui theme)
- Accessibility (a11y) level: WCAG AA

## 10. Open Questions / Decisions Needed

- [x] Keycloak realm name: `coopdata`
- [x] Keycloak client ID: `coopdata-frontend`
- [x] Auth flow: Authorization Code + PKCE
- [x] Token storage: IndexedDB via idb-keyval (not localStorage)
- [x] Backend middleware: `require_role_layer()` already wired in `create_app()`
- [x] Handler-level scope enforcement: Use `Claims` methods + `ScopeEnforcement`
- [ ] Invitation pending detection: Implement `InvitationPendingDialog` for `is_member_of === false`
- [ ] Onboarding flow: Define what happens on first login per role

---

**Reference:** Full architecture details in `docs/RBAC_AND_AUTH_SYSTEM.md`