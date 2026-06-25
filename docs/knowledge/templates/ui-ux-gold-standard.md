# Frontend UI/UX Gold Standard (Tag This File for Visual/UX Tasks)

> Treat this as the **design system prompt**. Anytime UI/UX is requested, apply these rules before implementing. Aim for "premium SaaS" polish: clean, confident, and intuitive.

## 1) Experience North Star

- **Feel**: Professional, calm, decisive. Zero clutter, strong information hierarchy.
- **First impression**: Clear headline, concise subcopy, primary action visible above the fold.
- **Trust signals**: Consistent spacing, predictable patterns, crisp typography, accessible contrast.

## 2) Layout & Spacing

- **Grid**: 12-column responsive; max width ~1200–1320px on desktop, generous gutters.
- **Spacing scale**: 4/8/12/16/20/24/32/48px. Default section padding: 24–32px desktop, 16–20px mobile.
- **Containers**: Use cards/surfaces to group related info; avoid floating elements without anchors.
- **Density**: Default comfortable density; provide a compact mode for data-heavy views.

## 3) Navigation Patterns

- **Primary nav**: Sticky topbar or left sidebar with clear active state; avoid double scroll bars.
- **Breadcrumbs**: Show path on detail pages and deep flows.
- **Global search**: Prominent entry point on data-heavy screens.
- **Responsive**: Collapse nav to hamburger/drawer on mobile; retain search and primary action.

## 4) Typography

- **Font**: Inter (or system fallback). Use optical sizing if available.
- **Hierarchy**:
  - H1: 28–32px, semibold/bold; H2: 22–24px; H3: 18–20px; body: 14–16px.
  - Muted text: `text-muted-foreground` for secondary copy; never reduce contrast below WCAG AA.
- **Line length**: 60–80 chars for reading sections; limit paragraph width.

## 5) Color & Theming

- **Palette**: Neutral base (white/off-white or slate) + 1 primary accent + 1 semantic set (success/warn/error/info).
- **Contrast**: Buttons/links meet AA; text on colored backgrounds >= 4.5:1.
- **States**: Hover is a subtle tint/raise; focus uses visible outline (`focus-visible:ring`); active slightly compresses.
- **Dark mode (if enabled)**: Preserve contrast, avoid pure black; use `bg-gray-900`+soft surfaces.

## 6) Components (Rules of Thumb)

- **Buttons**: Use semantic variants (`primary`, `secondary`, `ghost`, `destructive`). Size: 36–44px height. Include icons only when they clarify meaning. Never rely on color alone.
- **Inputs**: Label always visible; helper text for context; inline validation with clear messaging. Large click targets, 12–16px padding.
- **Cards/Panels**: `rounded-lg/xl`, subtle border + shadow-sm; optional hover `shadow-md`. Keep headings + description + action row consistent.
- **Tables**: Sticky header, zebra or subtle row separators; affordances for sort/filter; inline status badges; empty + loading states; pagination or virtual scroll for big data.
- **Forms**: Group logically, chunk long flows with steps; show required marks; disable submit while saving, show progress.
- **Modals/Drawers**: Use sparingly. Trap focus, support ESC/overlay close (unless destructive).
- **Charts**: Minimal gridlines, clear legends, tooltips, accessible colors. Provide number + trend badges.
- **Badges/Chips**: Semantic colors with clear text labels; keep rounded and compact.

## 7) Feedback & States

- **Micro-interactions**: `transition-all duration-150/200`; avoid excessive motion.
- **Hover/Focus**: Always defined for interactive elements.
- **Loading**: Prefer skeletons/shimmers for data containers; spinners only for small inline actions.
- **Empty states**: Friendly icon/illustration + one-line explanation + primary action.
- **Errors**: Clear message, hint to resolve, retry action; inline field errors near fields; page-level alerts for blocking issues.
- **Success**: Subtle toast + inline confirmation; avoid modal unless necessary.

## 8) Accessibility & Internationalization

- WCAG AA minimum; keyboard-first (tab order, focus rings, skip links). ARIA labels for icons/inputs.
- Sufficient hit targets (44px square minimum for touch).
- Support RTL if needed; avoid baked-in directional icons without consideration.
- Content is readable at 125% scaling; avoid text embedded in images.

## 9) Motion & Feel

- **Timing**: 150–250ms for UI transitions, 300–450ms for page/section transitions.
- **Easing**: Use `ease-out` for entrances, `ease-in` for exits, `ease-in-out` for shared transitions.
- **Scope**: Animate position/opacity/scale subtly; avoid animating layout that causes jumps without reserving space.

## 10) States & Data Quality

- **Resilience**: Design for slow networks, partial data, offline (if applicable).
- **Undo/Retry**: Prefer non-destructive actions with undo; destructive asks confirmation.
- **Autosave cues**: Show "Saving…" → "Saved" chips; avoid silent failures.

## 11) Content & Tone

- Copy is concise, action-led, and confident. Avoid jargon. Use sentence case for labels, Title Case for primary nav if consistent with brand.
- Helper text is specific: what, why, and how to fix.

## 12) Page Templates (Quick Prompts)

- **Dashboard**: Hero summary row (KPIs with icons + trends) → key chart → top tasks/list → recent activity. Primary action in hero.
- **List/CRUD**: Header with title + filters/search + primary action; table with sorting/badges; bulk actions; empty/loading/error states; pagination.
- **Detail**: Title + status badge + primary action; metadata summary; tabs/sections; activity log; related items.
- **Form**: Progressive disclosure; inline validation; summary of errors at top if many; sticky footer with actions on long forms.

## 13) Good Practice Checklist (run before shipping)

- Hierarchy obvious at first glance; primary action unmistakable.
- All interactive states defined (hover/focus/active/disabled/loading).
- Empty/loading/error/success states present for each data view.
- Responsive at sm/md/lg/xl with sensible reflow; no horizontal scroll on mobile.
- Contrast passes AA; icon-only controls have labels/tooltips.
- Animations respect reduced-motion preferences.

## 14) Implementation Defaults (shadcn/ui + Tailwind friendly)

- Use semantic tokens: `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, `bg-muted`, `bg-accent`.
- Apply `rounded-lg/xl`, `shadow-sm`, `transition-all duration-200`, `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- Use `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for cards; `gap-4/6`.
- Prefer `Button`, `Input`, `Textarea`, `Select`, `Skeleton`, `Alert`, `Badge`, `Tabs`, `Tooltip`, `Popover`, `Dialog`, `Drawer` components over raw HTML.

## 15) Page + Components Rule (VERY IMPORTANT)

- When a **page file** is tagged with this template, you must also:
  - Inspect all components that the page **imports or renders**.
  - Apply the same UI/UX improvements to those components (layout, spacing, states, accessibility, motion).
  - Refactor shared components (like `Card`, `Table`, `Form` pieces) so improvements are centralized and reused.
- Never optimize a page visually while leaving its child components in an older, inconsistent style.

## 16) Error & Alert Patterns

- **Inline field errors**: Red text + icon; message explains fix.
- **Page/banner alerts**: Descriptive title + actionable copy + CTA (retry/contact). Distinct backgrounds with sufficient contrast.
- **Destructive flows**: Confirmation with summary of impact; require explicit acknowledgment for irreversible actions.

## 17) Performance Guardrails

- Avoid heavy box-shadows/blur on large lists; prefer border separators.
- Use virtualization for tables/lists > 100 rows.
- Debounce search/filter inputs; optimistic UI where sensible with rollback on failure.
- Lazy-load non-critical media and routes; prefetch likely next routes on hover.

## 18) Tagline for LLM (copy/paste when prompting)

> “Design a premium, minimal, accessible UI with generous whitespace, decisive hierarchy, soft cards, vivid primary accent, defined hover/focus/active states, resilient empty/loading/error handling, responsive grid, subtle motion (200ms), and confident, concise copy. Use shadcn/ui + Tailwind tokens and semantic variants for buttons/inputs. Provide skeletons, toasts, and confirmation flows; ensure WCAG AA contrast and keyboard support.”
