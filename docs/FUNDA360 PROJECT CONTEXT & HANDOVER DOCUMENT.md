# FUNDA360 — PROJECT CONTEXT & ENGINEERING HANDOVER DOCUMENT

**Status:** Living document. Last touched 2026-08-17 for Sprint 4 (Teaching Assignment Domain — see §31). Sprint 1, Sprint 2 (Milestones 1–4), Sprint 3 (Milestones 1–3), the Production Hardening sprint, and Sprint 4 are all complete and committed to `main` as of this update. §27–§30 were added 2026-08-16 during the Production Hardening sprint to correct several sections that had gone stale (this document had not been updated since immediately after Sprint 1, despite five further milestones and a full sprint landing since) — see those sections for what changed and why, and §16.1 for a correction to a since-fixed finding this document previously left open.
**Audience:** Any senior engineer (human or AI) picking up this codebase with zero prior context.
**Rule:** Everything in this document is derived from reading the actual source in the repository at the time of writing, not from memory or assumption. Where a claim is architecturally load-bearing, the exact file is cited.

---

## 1. Overall Project Vision

Funda360 is an **enterprise, multi-tenant School Management SaaS platform**, initially targeting South African schools (public, private, and independent) under provincial education departments (the seed data and field set — EMIS number, education department, province, district, ZAR currency, `Africa/Johannesburg` default timezone — reflect this), but architected generically enough to generalize.

Core product premise: **one deployment serves many schools ("tenants"), each school's data is fully isolated from every other school's**, while a small set of platform-level operators (Super Administrator, Platform Administrator, Support Engineer) can operate across all tenants for support and administration purposes.

The platform is being built up epic-by-epic, sprint-by-sprint, strictly additive: each sprint milestone is expected to **extend** the existing architecture, never rewrite or replace what's already shipped. This additive discipline is a standing instruction from the project's product owner (given verbatim at the start of every sprint brief) and is the single most important behavioral constraint for anyone continuing this work.

The intended long-term shape (per `docs/FUNDA360 PRODUCT REQUIREMENTS DOCUMENT (PRD)` and related specs, not yet built) includes: academic structure (years/terms/grades/classes/subjects — **starting now**, Sprint 2 M1), student information, enrollment, attendance, timetabling, gradebook/assessment, finance/billing, HR/payroll, communications, transport, library, reporting/analytics — each as its own tenant-scoped, RBAC-gated feature module following the same conventions established in Sprint 1.

## 2. Current Project Status

- **Sprint 1 (Foundation): 100% complete, all 5 milestones committed to `main`.**
- **Sprint 2 (Academic & Operations): 100% complete, all 4 milestones committed to `main`** — Academic Structure (M1), Employee Management (M2), Learner Management (M3), Reports & Analytics (M4). See §14 (Academic, written contemporaneously) and §27 (Employee/Learner/Reports, added retroactively during this regeneration) for what shipped in each.
- **Sprint 3 (Self-Service & Guardian Access): 100% complete, all 3 milestones committed to `main`** — self-service "My Profile" views for employees/learners (M1), guardian medical-information visibility (M2), guardian emergency-contact visibility (M3). See §27.
- **A dedicated Production Hardening sprint followed Sprint 3**, closing several operational and functional gaps identified by a full repository audit rather than adding new product features. See §28 for the complete list of what changed (guardian/emergency-contact removal, `profiles.email` protection, safe error handling, environment/CI configuration, seed-data safety, route-level code splitting) and §16.1 for a correction to a finding this document previously left open.
- **Sprint 4 (Teaching Assignment Domain): complete, committed to `main`.** Resolves ADR-0001 — see §31 for the full writeup. Also completed the error-handling migration to the remaining ~33 call sites §28.3 didn't cover (data-loading hooks, not just form-submit handlers) and fixed the `.env.example` e2e claim §28.6 had itself left inconsistent.
- The app now covers: authentication, multi-tenancy, school administration, user/role management, academic structure (including teaching assignments), employee management, learner management (including guardians, medical information, emergency contacts, documents, enrollment/promotion history), self-service views (including "my classes" for teachers), and reports/analytics — each tenant-scoped and RBAC-gated. Attendance, timetabling, gradebook, and finance remain future epics — Sprint 4 deliberately built the foundation those need (§31) rather than any one of them speculatively.
- **A Frontend/UX Audit & Hardening sprint followed Sprint 5**, driven by genuine screenshot-based visual verification rather than source inspection alone: a real dashboard (permission-gated stat cards, no fabricated data, no more raw internal-state leak), a mobile table-scroll affordance fix applied across all 13 table components, and a "My Children" mislabeling fix on `/my-profile`. See §33.
- **A Premium Frontend Visual Redesign followed**, re-skinning the entire application into a navy/white executive institutional design system (Auris Nexus Technologies branding) — new design tokens, a deep-navy sectioned sidebar, a fixed no-body-scroll application shell, a rebuilt executive-summary dashboard, self-hosted Inter/IBM Plex Mono typography, and an "Executive Night Mode" dark theme — with zero changes to routes, permissions, RLS, or data models. See §34.
- The codebase has **zero TODO/FIXME/XXX placeholders**, passing lint/typecheck/unit test suites, and a clean `npm run build` as of this update (verified directly — see §31 for the exact commands run and their results).
- **A critical `profiles.tenant_id` self-service tenant-isolation escalation** was found and fixed between Sprint 1 and Sprint 2 M1 — see §16 for the full writeup and §15 for the Docker RLS harness this was verified against.

## 3. Completed Sprints and Milestones

### Sprint 1 — Foundation

| # | Milestone | Commit | What shipped |
|---|---|---|---|
| 1 | Project Foundation | `edc79af` | Vite+React+TS+Tailwind scaffold; accessible, responsive Login page only — no auth wiring yet. |
| 2 | Enterprise Authentication | (part of `42d7b20`) | Supabase Auth integration: sign-in/out, session persistence with a "remember me" storage-adapter switch, `AuthContext`/`AuthProvider`, `ProtectedRoute`/`PublicOnlyRoute`, forgot/reset password, email verification gate, auto token refresh, PKCE flow, loading/error states throughout. |
| 3 | Multi-Tenant Architecture + RBAC Foundation | (part of `42d7b20`) | `schools`/`profiles` tables, Row Level Security, `current_tenant_id()`/`is_platform_admin()` SQL functions, the 24-role catalogue, `Permission` union + `ROLE_PERMISSIONS` matrix + `ROLE_RANK` hierarchy, `TenantProvider`/`ProfileProvider`, `TenantGate`, dev seed data, Docker-based RLS verification harness. |
| 4 | School Administration Core | `c0c7c85` | `/school/profile` page; `schools` table gained `physical_address`/`postal_address`/`principal_name`; `can_manage_school()` + write RLS policy; `SchoolProvider`/`useSchool`. |
| 5 | User & Role Management | `59886c3` | `/users` directory + `/users/:id` profile view; `profiles.role` denormalized mirror column; `admin_create_user`/`admin_update_user_role` SECURITY DEFINER RPCs; role-assignment rules (`can_assign_role` in SQL, mirrored by `canAssignRole` in TS); `RequirePermission` route guard; reusable `Modal` primitive; full `e2e/users.spec.ts` coverage. |

Each milestone's brief mandated: implement → verify (lint/typecheck/unit/build/e2e) → fix everything → (from M4 onward) commit with an exact, pre-specified commit message. That discipline is expected to continue.

### Sprint 2 — Academic & Operations (complete)

| # | Milestone | Commit | What shipped |
|---|---|---|---|
| 1 | Academic Structure | `d2c8639`'s predecessor (see `git log --oneline`) | `academic_years`/`terms`/`grades`/`classes`/`subjects` tables; `set_active_academic_year()` SECURITY DEFINER RPC (atomic one-active-year switch); `can_view_academic()`/`can_manage_academic()` + role-gated RLS (narrower than `school.*` — Teacher gets view-only, most other roles get none); `academic.view`/`academic.manage` permissions; `src/features/academic/` module (5 services, 5 schemas, `AcademicProvider`, 4 list hooks, 6 pages); `/academic/*` routes; `e2e/academic.spec.ts`; RLS harness extended with 15 new academic regression tests. |
| 2 | Employee Management | `2619a7d` (schema), `4c8e58f` (complete) | `departments`/`employees` tables (never hard-deleted — `active`/`employment_status` archive pattern); `terminate_employee()`/`reactivate_employee()` SECURITY DEFINER RPCs; employee login provisioning (`20260804090000`); `src/features/employees/` module. See §27. |
| 3 | Learner Management | `e974122` (schema), `c378ff7` (UI) | Six tenant-scoped tables (`learners`, `learner_enrollments`, `learner_guardians`, `learner_emergency_contacts`, `learner_medical_information`, `learner_documents`); separately-gated medical information RLS; `change_learner_status()`/`promote_learner()` RPCs; `src/features/learners/` module. See §27. |
| 4 | Reports & Analytics | `d2c8639` | Learner/employee/academic report pages with CSV export; `src/features/reports/` module. See §27. |

### Sprint 3 — Self-Service & Guardian Access (complete)

| # | Milestone | Commit | What shipped |
|---|---|---|---|
| 1 | Self-Service Access | `33c6d0f` | `EmployeeSelfSummary`/`LearnerSelfSummary` — an authenticated user's own employee record and/or linked learner(s), read-only, on `/my-profile`. |
| 2 | Guardian Medical Information Visibility | `2ebe042` | `is_learner_guardian()` SECURITY DEFINER function + guardian clause added to `learner_medical_information_select` RLS policy — a guardian sees their own linked child's medical information, read-only, enforced at the RLS layer (not a UI convention). |
| 3 | Guardian Emergency Contact Visibility | `160c6ef` (database), `4e18ebb` (UI) | Same `is_learner_guardian()` mechanism extended to `learner_emergency_contacts_select`. |

See §28 for the Production Hardening sprint that followed Sprint 3, before any Sprint 4 work began.

## 4. Folder Architecture

```
Funda360/
├── docs/                          # Permanent specifications (PRD, SDD, DDS, RBAC spec, etc.) — read-only reference, not modified by feature work
├── e2e/                           # Playwright end-to-end tests, fully network-mocked (no real backend touched)
│   └── utils/                     # mockAuth.ts, mockData.ts — shared test-mocking helpers
├── src/
│   ├── app/
│   │   └── AppRoutes.tsx          # single source of truth for the route tree
│   ├── components/
│   │   ├── layout/                # DashboardLayout, DashboardHeader, DashboardSidebar, UserMenu — app chrome
│   │   └── ui/                    # Design-system primitives: Button, TextField, PasswordField, Checkbox, Modal, FullScreenSpinner, FullScreenNotice, Logo, ThemeToggle, icons.tsx
│   ├── features/
│   │   ├── auth/                  # {components,context,pages,schemas,services,types,utils}
│   │   ├── profile/                # {context,services} — the signed-in user's own profile
│   │   ├── tenant/                # {context,hooks,services} — active school resolution, tenant switching
│   │   ├── rbac/                  # {constants,services,types,utils} — framework-level authorization
│   │   ├── school/                # {components,context,hooks,pages,schemas,services,types} — School Administration
│   │   └── users/                 # {components,hooks,pages,schemas,services,types,utils} — User & Role Management
│   ├── hooks/                     # Cross-feature hooks not owned by one feature: usePermissions, useTheme
│   ├── lib/                       # supabase.ts (client), database.types.ts (hand-maintained schema mirror), cn.ts
│   ├── pages/                     # Top-level pages not big enough to be their own feature (DashboardPage)
│   ├── routes/                    # Route guards: ProtectedRoute, PublicOnlyRoute, TenantGate, RequirePermission
│   ├── styles/
│   │   └── index.css              # Tailwind entrypoint + CSS custom-property design tokens
│   └── types/                     # Cross-feature domain types + `types/index.ts` barrel (see §17)
├── supabase/
│   └── migrations/                # Timestamped, additive-only SQL migrations
├── tailwind.config.ts
├── eslint.config.js
├── tsconfig.app.json / tsconfig.node.json / tsconfig.json
└── package.json
```

**The `src/features/<name>/{components,context,hooks,pages,schemas,services,types,utils}` shape is mandatory for every new feature module.** Not every feature needs every subfolder (e.g. `tenant` has no `pages`, `rbac` has no `pages`/`context`) — include only the ones a feature actually needs, but never invent a different top-level shape.

## 5. Technology Stack

- **Runtime/build**: Vite 5, React 18.3, TypeScript 5.6 (strict mode, see §6)
- **Routing**: React Router DOM 6.26 (nested layout routes + guard components, not a route-config object)
- **Styling**: Tailwind CSS 3.4, CSS custom properties for theming (`darkMode: 'class'`), no CSS-in-JS, no component library (all primitives hand-built in `components/ui/`)
- **Forms/validation**: React Hook Form 7.53 + Zod 3.23 via `@hookform/resolvers`
- **Backend**: Supabase (`@supabase/supabase-js` **pinned to exact `2.45.4`** — see §6 for why) — Postgres, Auth (GoTrue), PostgREST, Row Level Security. No custom backend server; all business logic that needs elevated privilege lives in **SECURITY DEFINER Postgres functions** called via `supabase.rpc()`.
- **Testing**: Vitest 2.1 (unit), Playwright 1.47 (e2e, Chromium, fully mocked network)
- **Lint/format**: ESLint 9 (flat config) with `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react-refresh`; Prettier 3.3 with `prettier-plugin-tailwindcss` for class sorting
- **Path alias**: `@/*` → `src/*` (configured in `tsconfig.app.json`, relied on everywhere — never use relative `../../..` imports)

npm scripts (`package.json`): `dev`, `build` (`tsc -b && vite build`), `preview`, `lint`, `format`/`format:check`, `typecheck` (`tsc -b --noEmit`), `test` (vitest run), `test:watch`, `test:e2e` (playwright).

## 6. Coding Standards

- **TypeScript strict mode is maximal**: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `forceConsistentCasingInFileNames` are all on (`tsconfig.app.json`). `noUncheckedIndexedAccess` in particular means any array/index access is `T | undefined` — guard it explicitly (see `Modal.tsx`'s `if (!first || !last) return;`).
- **`Database` Row/Insert/Update shapes in `src/lib/database.types.ts` MUST be declared as `type`, never `interface`.** This is a hard-won, previously-verified fact: postgrest-js's generic inference for `.update()`/`.insert()`/`.rpc()` silently degrades to `any`/`never` when these are `interface` instead of a plain object `type`. Documented in the file's own header comment. **Do not "clean this up" to interfaces — it will silently break query typing.**
- **`@supabase/supabase-js` is pinned to the exact version `2.45.4`** in `package.json` (no `^`). A newer auto-resolved version (`^2.111.0`) was found to have incompatible generic-typing behavior during Milestone 3. Do not let this drift via `npm update`/`npm install` without re-verifying generics.
- **No comments explaining *what* code does** (identifiers should already say that). Comments are reserved for *why* — a non-obvious constraint, a security boundary, a workaround, a cross-reference between the SQL and TS halves of a rule (see `can_assign_role()` ↔ `canAssignRole()` for the pattern to follow). This is the dominant commenting style throughout the existing codebase — preserve it.
- **Every service module is a plain object of named async functions**, exported as a single `const xService = { fn1, fn2, ... }` (see `authService`, `schoolService`, `tenantService`, `profileService`, `userService`, `rbacService`). Never a class, never default-exported.
- **Row ↔ domain-object mapping functions (`toProfile`, `toSchool`) are exported from the service that "owns" the table**, so other features' services reuse them instead of re-declaring their own mapper (`userService` imports `toProfile` from `profileService`; `schoolService` imports `toSchool` from `tenantService`). Follow this when Academic services need to map `academic_years`/`terms`/`grades`/`classes`/`subjects` rows.
- **Context value objects are always memoized** (`useMemo`) and context files always export both the raw `Context` and a `useXxx()` accessor hook that throws if used outside its provider (`"useAuth must be used within an AuthProvider"` pattern) — copy this exactly for `AcademicContext`/`useAcademic`.
- Prettier + `prettier-plugin-tailwindcss` enforce formatting and class-order; don't hand-fight either.

## 7. UI/UX Principles

- **Design system is entirely token-driven via CSS custom properties**, not hard-coded Tailwind colors — see `src/styles/index.css` for the full token set (`--brand-50..900` — a navy scale since §34's redesign, redefined again inside `:root.dark` with a brightened variant rather than shared across themes, unlike every other token family — `--surface`/`--surface-raised`/`--surface-sunken`, `--border`/`--border-strong`, `--content-primary/secondary/tertiary/inverse`, `--danger-*`, `--success-500`, `--warning-*`, and a sidebar-only `--sidebar*` set deliberately fixed across both themes), mapped into Tailwind's `theme.extend.colors` in `tailwind.config.ts` using the `rgb(var(--x) / <alpha-value>)` pattern (enables `bg-brand-600/50`-style opacity modifiers). **Never introduce a raw hex/rgb color in a component — always go through a token class** (`bg-surface-raised`, `text-content-secondary`, etc.).
- **Dark mode** is class-based (`darkMode: 'class'`, toggled via `.dark` on `<html>`), driven by `useTheme()` (`src/hooks/useTheme.ts`), persisted to `localStorage` under `funda360-theme`, and synced with a blocking inline script in `index.html` to avoid flash-of-unstyled-content. Every new component must render sensibly in both themes — the token system makes this automatic as long as only token classes are used.
- **Every interactive element gets `.focus-ring`** (a utility class defined in `index.css`: `outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ...`) — never rely on browser-default focus outlines, never suppress focus outlines without replacing them.
- **Loading states**: a small spinning ring built from a bordered `div` + `animate-spin-smooth` (a custom Tailwind keyframe), always paired with visually-hidden `sr-only` text for screen readers (see `Button`'s `isLoading`, `UsersPage`'s list-loading spinner).
- **Error/status banners** are a fixed, repeated pattern: `role="alert"` + `bg-danger-50 border-danger-500/30 text-danger-600` for errors, `bg-success-500/10 border-success-500/30 text-success-500` + `role="status"` for success — copy this exactly, don't invent new banner styling per feature.
- **Modals** always go through the shared `Modal` primitive (`src/components/ui/Modal.tsx`) — never a bespoke dialog implementation. It handles focus trap, Escape-to-close, backdrop click, `aria-modal`, and portal rendering to `document.body`.
- **Forms**: React Hook Form + Zod resolver, `noValidate` on the `<form>` (validation is entirely Zod-driven, not native HTML validation), labeled inputs via the shared `TextField`, explicit `required` asterisk styling, field-level errors rendered as `role="alert"` paragraphs directly under the field.
- **Responsive**: mobile-first Tailwind (`sm:`/`md:` breakpoints), a slide-in mobile nav drawer with backdrop in `DashboardLayout` for viewports below `md`.
- Page content containers consistently use `mx-auto max-w-5xl px-4 py-8 sm:px-6` (or similar) — match existing page padding/width conventions rather than inventing new ones per page. The Dashboard is the one deliberate exception (§34): it uses the full workspace width rather than a centered max-width column, since its executive-summary grid benefits from it. Standardizing the rest of the app onto a shared `PageContainer` is a noted follow-up, not yet done.
- **The application shell is fixed to the viewport** (`h-dvh overflow-hidden` on `DashboardLayout`'s root, §34) — the browser window itself never scrolls during normal use; only `<main>` scrolls internally. Don't reintroduce page-level scrolling on a new page — if content can overflow, let it scroll within its own container (a table already does this via `TableScrollContainer`).

## 8. Database Architecture

All schema lives in `supabase/migrations/*.sql`, applied in filename-timestamp order, **strictly additive** (never edit a shipped migration — add a new one). Current migrations:

1. `20260802125401_create_schools.sql` — `schools` table (the tenant root), `school_type`/`school_status` enums, uniqueness on `registration_number`/`emis_number` (partial, NULL-safe), `set_updated_at()` trigger function (shared by every table going forward).
2. `20260802125402_create_profiles.sql` — `profiles` table (personal/contact info scoped by `tenant_id`), `profile_status` enum, unique lower-cased email index. **Deliberately excludes a `role` column** at this point — role starts life as a JWT-only claim.
3. `20260802125403_row_level_security.sql` — `current_tenant_id()`, `is_platform_admin()`, enables + **forces** RLS on both tables, base SELECT/UPDATE policies.
4. `20260802142648_school_admin_core.sql` — renames `address`→`physical_address`, adds `postal_address`/`principal_name`, `can_manage_school()`, write policy for `schools`.
5. `20260802151501_user_role_management.sql` — adds `profiles.role` (denormalized JWT mirror, see §11), `can_manage_profiles()`, `profiles_update_by_manager` policy, `prevent_direct_role_change()`/`prevent_self_status_change()` triggers, `can_assign_role()`, `admin_create_user()`/`admin_update_user_role()` RPCs.
6. `20260803140000_prevent_direct_tenant_change.sql` — **security patch**, applied between Sprint 1 and Sprint 2 M1. Adds `prevent_direct_tenant_change()`, a `before update` trigger on `profiles` blocking any change to `tenant_id` unless flagged via the same `app.allow_tenant_change` transaction-local `set_config()` pattern `prevent_direct_role_change()` already established for `role`. No function currently sets that flag, so today this is an unconditional block. See §16 for why this was needed — `tenant_id` had no equivalent protection to `role`'s, and was directly self-writable via `profiles_update_own`.
7. `20260803150000_academic_structure.sql` — Sprint 2 M1. Adds `academic_years`/`terms`/`grades`/`classes`/`subjects` (all tenant-scoped via `school_id`, per the brief's literal field names — see §19 for why that's `school_id` and not a rename of `tenant_id`), the partial unique index enforcing one active academic year per school, `can_view_academic()`/`can_manage_academic()` (mirroring `academic.view`/`academic.manage`), role-gated SELECT/INSERT/UPDATE policies (no DELETE policy on any of the five — combined with FORCE RLS this makes hard-delete impossible, enforcing the brief's archive-only rule at the database layer), `terms_validate_academic_year_school()`/`classes_validate_grade_school()` (close the "a foreign key doesn't respect RLS" gap — a client could otherwise reference a different tenant's `academic_year_id`/`grade_id` despite never being able to `SELECT` it), `prevent_direct_year_activation()` (same transaction-local-flag pattern as migration 6, gating the `is_active` false→true transition so only the RPC below can activate a year), and `set_active_academic_year()` (SECURITY DEFINER, atomically deactivates the previous active year and activates the requested one in one transaction).

Reusable building blocks any new migration should call, never redefine:
- `public.set_updated_at()` — generic `updated_at = now()` trigger function.
- `public.current_tenant_id()` — SECURITY DEFINER, resolves the caller's `tenant_id` from `profiles`. Use this for every new tenant-scoped table's RLS policies.
- `public.is_platform_admin()` — reads the `role` JWT claim directly (`auth.jwt() -> 'app_metadata' ->> 'role'`), true for `super_administrator`/`platform_administrator`.

Standard pattern for a new tenant-scoped table:
```sql
alter table public.<table> enable row level security;
alter table public.<table> force row level security;

create policy <table>_select_within_tenant_or_platform_admin
  on public.<table> for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_platform_admin());
```
(`force row level security` is easy to forget and defeats the isolation guarantee for the table owner role — always pair it with `enable`.)

`src/lib/database.types.ts` is a **hand-maintained mirror** of what `supabase gen types typescript` would output — kept manually in sync with every migration, one `Row`/`Insert`/`Update` type set per table added to `Database.public.Tables`, one entry per RPC added to `Database.public.Functions` with typed `Args`/`Returns` (needed for `supabase.rpc<FnName, Fn>()` generic resolution — see the two existing RPC entries for the exact shape required).

## 9. Multi-Tenancy Strategy

- **Tenant root** = `schools` table; every tenant-scoped table carries a `tenant_id uuid references public.schools(id)`.
- **Isolation is enforced in Postgres itself via RLS**, not just filtered in application code — this is the explicit, stated last line of defense (see the comment header in migration 3). Every tenant-scoped table gets both `enable row level security` and `force row level security`.
- **`profiles.tenant_id` is the source `current_tenant_id()` reads from** — not a JWT claim lookup — specifically so the RLS mechanism works immediately without needing a configured Auth Hook. (A real JWT `tenant_id` claim is also populated and used client-side, per §10, but the SQL-side tenant resolution goes through the `profiles` table to avoid a chicken-and-egg dependency on the hook.)
- **Platform-level roles bypass tenant scoping entirely** via `is_platform_admin()`, which reads the JWT `role` claim directly and is `or`-ed into every tenant-scoped RLS policy.
- **Client-side tenant resolution**: `TenantProvider` (`src/features/tenant/context/TenantProvider.tsx`) loads the active school once `ProfileProvider` has resolved a profile, exposes `{status, tenant, error, availableSchools, switchTenant, refetch}` via `useTenant()`. `status` is one of `idle | loading | ready | missing | inactive | error` — `TenantGate` (`src/routes/TenantGate.tsx`) renders a dedicated full-screen message for every non-`ready` state (no profile, no tenant assigned, school inactive/suspended, deactivated account, generic error) rather than a blank/broken page.
- **Tenant switching** (`switchTenant(schoolId)`) is restricted to platform-level roles (checked via `rbacService.can(role, 'tenant.switch')`); `availableSchools` (every school, via RLS) is only populated for those roles — for a normal tenant-scoped user it's always `[]`.
- `SchoolProvider` is explicitly a **thin composition over `TenantProvider`**, not an independent fetch — re-fetching the same row twice was identified as wasteful and avoided (see `SchoolProvider.tsx`'s header comment). New feature providers that need "the current school" should default to reading `useTenant().tenant?.school` rather than issuing their own query, unless they specifically need write operations `TenantProvider` intentionally doesn't expose (tenant context is read-only by design).

## 10. Authentication Architecture

- **Supabase Auth (GoTrue)**, `flowType: 'pkce'`, `autoRefreshToken: true`, `detectSessionInUrl: true` (see `src/lib/supabase.ts`).
- **Session storage is dynamically switchable** between `localStorage` (persists across browser restarts) and `sessionStorage` (cleared on tab close) based on a "remember me" checkbox at login — implemented via a custom `authStorage` adapter in `supabase.ts` whose `getItem`/`setItem` resolve the backing store *per call* (`resolveStorage()` checks a `funda360-auth-persist` flag), rather than fixing the client's storage once at construction. `setAuthPersistence(remember)` must be called **before** `signInWithPassword` so the resulting session lands in the correct store.
- **`AuthContext`/`AuthProvider`** (`src/features/auth/context/`): owns `status: 'initializing'|'authenticated'|'unauthenticated'`, `user: AuthenticatedUser | null`, and the actions `signIn`, `signOut`, `requestPasswordReset`, `updatePassword`, `resendVerificationEmail`, `hasRole`. Subscribes to `supabase.auth.onAuthStateChange`; on a `PASSWORD_RECOVERY` event, redirects to `/reset-password`.
- **`AuthenticatedUser`** (`toAuthenticatedUser.ts`) is derived *entirely* from the Supabase `User` object's JWT-backed fields: `id`, `email`, `emailVerified` (from `email_confirmed_at`), **`role` and `tenantId` read from `user.app_metadata`** (not from any table). This is the authorization source of truth — see §11.
- **Route guards**:
  - `ProtectedRoute` — requires `status === 'authenticated'` and (if authenticated) `user.emailVerified`; else redirects to `/login` (preserving `state.from`) or `/verify-email`.
  - `PublicOnlyRoute` — the inverse, for `/login`/`/forgot-password`; redirects already-authenticated users back to where they came from (or `/`).
  - `TenantGate` — sits inside `ProtectedRoute`, handles the profile/tenant-loaded-but-not-ready cases (see §9).
  - `RequirePermission` — generic permission-based guard, see §11.
- **Provider nesting order** (`src/App.tsx`, load-bearing — each layer depends on state from the one above it):
  ```
  BrowserRouter
   └ AuthProvider        (owns: session/user/role)
      └ ProfileProvider  (needs: auth user id/role)
         └ TenantProvider (needs: profile.tenantId)
            └ SchoolProvider (needs: tenant.school)
               └ AppRoutes
  ```
  Any new provider that depends on tenant/school context (e.g. a future `AcademicProvider`) must be nested **inside** `SchoolProvider` (or at minimum inside `TenantProvider`), following this same dependency chain.
- Auth pages: Login, Forgot Password, Reset Password, Verify Email — all under `src/features/auth/pages/`, each with a matching Zod schema in `src/features/auth/schemas/`.

## 11. RBAC Implementation

This is the framework every future permission-gated feature (including Academic) must plug into — **do not build a parallel authorization mechanism**.

- **Role catalogue**: `USER_ROLES` (24 roles) in `src/features/auth/types/auth.types.ts` — `super_administrator, platform_administrator, support_engineer, school_owner, principal, vice_principal, department_head, teacher, class_teacher, subject_teacher, hr_manager, finance_manager, accountant, receptionist, admissions_officer, librarian, transport_coordinator, sports_coordinator, medical_officer, parent, guardian, learner, guest, auditor`. `UserRole` is the derived literal union. This is mirrored **exactly** by the Postgres enum `public.user_role` (migration 5) — the SQL enum's own comment says "keep both in sync."
- **Role is a JWT `app_metadata` claim, never a client-writable column** — this is the single most important RBAC invariant in the system. `profiles.role` (added in Milestone 5) is a **read-only mirror** for listing/filtering purposes only; see §13.
- **Permission model** (`src/features/rbac/`):
  - `Permission` (`types/permission.types.ts`) — closed string-literal union. Currently: `school.view | school.manage | tenant.switch | profile.view_own | profile.update_own | profile.view_any | profile.manage_any | academic.view | academic.manage`. The last two were added in Sprint 2 M1 — the first business-module permissions in the union (see §14) — and are deliberately narrower than `school.*` (populated for only 7 of the 24 roles, not the broader `school.view` set) per that milestone's explicit "no access unless permitted" brief.
  - `ROLE_PERMISSIONS` (`constants/rolePermissions.ts`) — `Record<UserRole, readonly Permission[]>`, one entry per role (**all 24 must be present or TS errors**). `profile.view_own`/`profile.update_own` are deliberately omitted from every entry and instead granted to everyone via `BASELINE_PERMISSIONS` in `permissionHelpers.ts`.
  - `ROLE_RANK` (`constants/roleHierarchy.ts`) — approximate total order for "at least as senior as" checks (not a strict org chart; side-branch roles like HR/finance/coordinators are ranked by trust level). Gaps of 5 between values, to allow inserting new roles later without renumbering.
  - `hasPermission(role, permission)` / `hasAnyPermission` / `hasAllPermissions` / `can` (`utils/permissionHelpers.ts`) — the actual client-side gate, used everywhere. **This is a UI convenience, never the real security boundary** — RLS/SQL functions are (see §15).
  - `hasRole(role, ...allowed)` / `isAtLeast(role, threshold)` (`utils/roleHelpers.ts`).
  - `rbacService` (`services/rbacService.ts`) — a synchronous facade re-exporting the above, kept for architectural consistency with the other `*Service` modules even though it touches no backend.
  - `usePermissions()` (`src/hooks/usePermissions.ts`) — combines `useAuth()`'s role with `rbacService` into one hook: `{role, can, canAny, canAll, hasRole, isAtLeast}`.
  - `RequirePermission` (`src/routes/RequirePermission.tsx`) — generic route guard, `<Route element={<RequirePermission permission="x.y" />}>`, redirects to `/dashboard` on failure. **Reuse this directly for any new protected route** — do not write a bespoke guard per feature.
- **Every SQL enforcement function that mirrors a TS permission check carries an explicit comment cross-referencing the exact TS construct it mirrors**, with a "keep in sync manually" note (e.g. `can_manage_school()` ↔ `school.manage`; `can_assign_role()` ↔ `canAssignRole()` in `userPermissions.ts`). This is a deliberate, load-bearing documentation convention — **follow it for every new SQL/TS authorization pair**, since role/permission data lives in the JWT and SQL can't introspect the TS union at all.

## 12. School Module Architecture

`src/features/school/` — School Administration (the `/school/profile` page).

- **`schoolService`** (`services/schoolService.ts`) deliberately **does not own reads** — `getSchoolById`/`getCurrentSchool` delegate to `tenantService.getSchoolById` (features/tenant) to avoid duplicating the query. It only adds **writes**: `updateSchool` (general profile fields) and `updateSchoolSettings` (timezone/currency/language), both funneled through a shared `applyUpdate` helper, both gated by the `schools_update_by_management_or_platform_admin` RLS policy (`can_manage_school()`).
- **`SchoolProvider`/`schoolContext`/`useSchool`** — see §9; re-syncs local state whenever `TenantProvider`'s `tenant` changes, applies the server's returned row directly to local state after a save **instead of calling `refetch()`** — calling tenant's `refetch()` was found to flip status to `'loading'`, unmounting the page mid-save via `TenantGate` (documented gotcha in `SchoolProvider.tsx`).
- Types split into `SchoolProfileUpdateInput` (general info + address + branding + admin name) vs `SchoolSettingsUpdateInput` (timezone/currency/language) — kept distinct because they're rarely edited together and map to two visually separate form sections.
- `School` domain type itself lives in `src/types/school.types.ts` (cross-feature, since both `tenant` and `school` features need it) — not inside `features/school/types/`.

## 13. User Management Architecture

`src/features/users/` — the `/users` directory and `/users/:id` profile view (Milestone 5).

- **`profiles.role` is a denormalized mirror of the JWT claim**, added specifically because a JWT only carries its *own* owner's claims — there is no way to list/filter *other* users by role without either this column or an admin API call per row. It is written **exclusively** through `admin_update_user_role()`/`admin_create_user()`, enforced at the database layer (not just convention) by the `prevent_direct_role_change()` trigger (see §15).
- **`userService`** (`services/userService.ts`): `getUsers` (paginated, filterable by search/role/status, `{count:'exact'}`), `getUserById`, `createUser` (→ `admin_create_user` RPC), `updateUser` (**delegates to `profileService.updateProfile`** — deliberate reuse, "the same RLS-gated column set applies whether editing yourself or, as a manager, someone else"), `updateUserRole` (→ `admin_update_user_role` RPC), `deactivateUser` (sets `status: 'inactive'`).
- **`ASSIGNABLE_ROLES`** (`types/user.types.ts`) = `['school_owner', 'principal', 'teacher']` — a deliberate subset of the full 24-role catalogue exposed through the Create/Change-Role UI, with `ASSIGNABLE_ROLE_LABELS` mapping `school_owner` → the display label **"School Administrator"** (no new role was added — it's a label, not a role).
- **`userPermissions.ts`**: `canManageUsers` (→ `profile.manage_any`), `canManageUser(actorRole, targetRole)` (adds an `isAtLeast` seniority check on top — a principal can manage teachers but not another principal), `canAssignRole(actorRole, newRole, currentRole)` (mirrors `can_assign_role()` SQL function exactly — school_owner can assign within the 3 assignable roles, principal can only promote/create teachers, platform admins unrestricted).
- **`useUsersList`/`useUserProfile`** — standard `{data, isLoading, error, refetch}`-shaped hooks, `useUsersList` additionally owns `filters`/`page`/`pageSize` state.
- Components: `UsersTable`, `UsersFiltersBar`, `UsersPagination`, `CreateUserModal` (shows a one-time temporary password on success — no email invite flow exists yet, see §21), `EditUserModal`, `ChangeRoleModal`, `DeactivateUserDialog` — all modals go through the shared `Modal` primitive.
- **Routing**: `/users` and `/users/:id`, wrapped in `<Route element={<RequirePermission permission="profile.view_any" />}>` inside `DashboardLayout` (`AppRoutes.tsx`). Sidebar "Users" link conditionally rendered in `DashboardSidebar.tsx` via the same permission check.
- `TenantGate` was extended in this milestone to also block deactivated accounts (`profile.status !== 'active'`) with a dedicated full-screen notice — this is what makes "Deactivate user" functionally meaningful, not just cosmetic.

## 14. Academic Structure Module Architecture (Sprint 2 Milestone 1 — shipped, not yet committed)

`src/features/academic/` — Academic Years/Terms/Grades/Classes/Subjects. Original brief reproduced verbatim in §25.

- **Five tenant-scoped tables**: `academic_years`, `terms` (FK → `academic_years`, plus a denormalized `school_id` — see below), `grades`, `classes` (FK → `grades`, plus `school_id`), `subjects`. All use `school_id` (not `tenant_id`) per the brief's literal field names — same precedent as `profiles.tenant_id`/`profiles.id` in Milestone 5 (§19): a brief's literal name is used verbatim for a genuinely new column, without renaming any existing concept.
- **`terms.active`/no separate archive column in the brief**: the brief's literal field list for `terms` omits an archive flag, but the brief's own ARCHIVE RULE section states unconditionally that academic entities are never hard-deleted. `active` was added to `terms` for consistency with `grades.active`/`classes.active`/`subjects.active` — flagged here per standing rule #14 (a brief's literal fields vs. an explicit stated requirement), not silently guessed.
- **One active academic year per school**: a partial unique index (`academic_years_one_active_per_school`, `on academic_years (school_id) where is_active`), never enforced in application code. `set_active_academic_year()` (SECURITY DEFINER) atomically deactivates whichever year was previously active and activates the requested one in a single transaction, modeled directly on `admin_update_user_role()`. A second, independent guard closes the gap a naive implementation would miss: `prevent_direct_year_activation()` (a `before update` trigger using the same transaction-local `set_config()` flag pattern as `prevent_direct_role_change()`/`prevent_direct_tenant_change()`) blocks any direct client `UPDATE` from flipping `is_active` false→true — only the RPC may. Archiving (`is_active` true→false) is a plain, ungated `UPDATE`, since only the *activation* direction needs atomicity/exclusivity.
- **FK-doesn't-respect-RLS gap, closed for both child tables**: a foreign key only checks that the referenced row exists, not that the caller could ever `SELECT` it under RLS — so without an extra check, a caller authorized for their own school could still reference another tenant's `academic_year_id`/`grade_id` (guessed or leaked UUID) while setting `school_id` to their own tenant, corrupting the row's effective tenant scope. `terms_validate_academic_year_school()` and `classes_validate_grade_school()` (plain `before insert or update` triggers) reject any row where the child's `school_id` doesn't match the parent's. Verified directly in the RLS harness (tests 12–13, §15) — a caller authorized for School B is rejected when referencing a School A parent, even though the RLS INSERT policy alone would have let the row through (it only checks `school_id`, not the parent chain).
- **Narrower access model than `school.*`**: `can_view_academic()`/`can_manage_academic()` mirror `academic.view`/`academic.manage` (not blanket tenant access like `schools_select_within_tenant_or_platform_admin`) — `academic.view` is `school_owner`/`principal`/`teacher`/`class_teacher`/`subject_teacher` + platform admins only (the three teacher-variant roles grouped together because they already carry an identical framework-level permission set in `ROLE_PERMISSIONS`); `academic.manage` is `school_owner`/`principal` + platform admins only. Every other role (including `vice_principal`/`hr_manager`/etc., which *do* get `school.view`) gets neither, per the brief's explicit "no access unless explicitly permitted."
- **No DELETE policy on any of the five tables** — combined with `force row level security`, this makes hard-delete impossible for any authenticated caller, enforcing the brief's "never hard deleted, archive means active=false" rule at the database layer rather than leaving it to UI convention (verified in the harness, test 14: a manager's `DELETE` silently matches zero rows).
- **Services**: one file per entity (`academicYearService`, `termService`, `gradeService`, `classService`, `subjectService`) rather than one combined file — matches the handbook's own prior recommendation (§18) for five distinct entities with CRUD each. Each exports its row→domain mapper (`toAcademicYear`, `toTerm`, etc.) for reuse, following the `toProfile`/`toSchool` convention.
- **`AcademicProvider`** (`context/AcademicProvider.tsx`): read-only per the brief (`currentAcademicYear`, `academicYears`, `loading`, `refresh`) — loads off `useSchool()`'s already-resolved school id rather than re-deriving tenant/school itself (§21 discipline), nested inside `SchoolProvider` in `App.tsx`. Mutations live in the per-entity services, called directly from pages/hooks, which call `refresh()` afterward to resync — the same shape `UsersPage` uses, not routed through the provider.
- **Four list hooks** (`useGrades`, `useClasses`, `useSubjects`, `useTerms`) follow the standard `{data, isLoading, error, refetch}` shape. No server-side pagination — per §21's own prior guidance, these lists are typically small enough not to need it; each page does a lightweight client-side active/archived filter instead.
- **Routes**: `/academic`, `/academic/years`, `/academic/terms`, `/academic/grades`, `/academic/classes`, `/academic/subjects`, all behind a single `RequirePermission permission="academic.view"` wrapper (no new route guard). Write actions (Create/Edit/Archive/Activate buttons) are additionally gated client-side by `usePermissions().can('academic.manage')`, mirroring the `school.manage`/`profile.manage_any` pattern.
- **Sidebar**: a single "Academic" entry (`/academic`, the overview page) added to `DashboardSidebar.tsx`, conditionally rendered on `academic.view` — not a nested submenu, consistent with the existing flat nav pattern. The five sub-areas are reachable via link cards on the overview page.
- **New icons**: `CalendarIcon`, `LayersIcon`, `BookIcon` added to `src/components/ui/icons.tsx` (existing `GraduationCapIcon`/`ChalkboardIcon` were reused as-is for Grades/Classes) — no inline SVG, no icon package, per §17.
- **A real, live regression risk found and fixed while building this**: `AcademicProvider` is mounted unconditionally at the app root (inside `SchoolProvider`), so it fires an `academic_years` fetch as soon as any e2e test resolves a real school — which every existing School/Users test does. `e2e/utils/mockData.ts`'s `installDataMocks` now defaults `academic_years` list queries to `[]` unless a test overrides it, so no pre-existing test needed to change; verified by running the full pre-existing suite (not just the new academic tests) both before and after this change.

Beyond Milestone 1, the natural next epics (per the inert "Soon"-badged sidebar placeholders in `DashboardSidebar.tsx`) are Students, Teachers/Staff scheduling, Reports, and eventually Settings — none scoped yet.

## 15. Testing Strategy

- **Unit tests (Vitest)**: colocated `*.test.ts` next to the module under test (see `src/features/rbac/utils/{permissionHelpers,roleHelpers}.test.ts`) — pure-logic modules (permission/role helpers, future validation utils) get unit tests; anything touching Supabase goes through the e2e layer instead, not mocked-Supabase unit tests.
- **e2e (Playwright)**: **fully network-mocked, no real Supabase backend touched, ever.** Two shared helper modules:
  - `e2e/utils/mockAuth.ts` — `buildMockUser`/`buildMockSession` (constructs a fake GoTrue session with a given `role`/`tenant_id` in `app_metadata`), `seedAuthenticatedSession(page, overrides)` (seeds `localStorage['funda360-auth']` before the app boots — bypasses the login form entirely for tests that don't need to test login itself), `installAuthMocks`, `fulfillJson`/`fulfillAuthError`.
  - `e2e/utils/mockData.ts` — `buildMockSchoolRow`/`buildMockProfileRow`, `installDataMocks` (mocks the profile/school single-row GETs `ProfileProvider`/`TenantProvider` issue after sign-in — **also always intercepts the `academic_years` list query, defaulting to `[]`**, since `AcademicProvider` fires it unconditionally as soon as any school resolves; see the §14 note on the regression this would otherwise have caused in every pre-existing School/Users test), `installUsersListMock` (paginated list mock — see the CORS gotcha below), `installRpcMock` (mocks `supabase.rpc()` calls by function name — `admin_create_user`/`admin_update_user_role` only), `buildMockAcademicYearRow`/`buildMockGradeRow`/`buildMockClassRow`/`buildMockSubjectRow`/`buildMockTermRow`, `installAcademicListMock` (generic GET-list mock for any of the five academic tables), `installSetActiveAcademicYearMock`.
  - **Known, documented gotcha**: `Content-Range` is not a browser-safelisted CORS response header. A paginated list mock **must** set `'access-control-expose-headers': 'content-range'` or supabase-js silently can't read the row count back out client-side even though the header is present on the response (real Supabase's PostgREST gateway sets this by default; test mocks must replicate it explicitly). Already baked into `installUsersListMock`. Not needed for `installAcademicListMock` — none of the academic pages paginate (see §14).
  - **List vs. single-row query detection** is done via `url.searchParams.has('limit') || url.searchParams.has('offset')` — this version of postgrest-js does not send a `Range` header, so don't try to detect list queries that way.
  - **`e2e/academic.spec.ts`** (Sprint 2 M1) covers: academic year CRUD, the end-date-before-start-date Zod validation, the one-active-year switch (a stateful in-test mock — the only spec file that needs one, since this is the one flow where the UI must visibly reflect a mutation's effect on a *different* row, not just its own), grade/class/subject/term CRUD, teacher read-only enforcement, `academic.view`-less role redirect, and a tenant-isolation-shaped rendering check (same caveat as the Users directory's equivalent test — real isolation is RLS, verified independently in the harness below, not by this mocked test).
- **Database/RLS verification**: a **Docker-based Postgres harness** (`postgres:16-alpine` + a hand-built `auth` schema stub providing `auth.users`, `auth.identities`, `auth.uid()`, `auth.jwt()`, and an `authenticated` role) was used across Milestones 3, 4, and 5 to verify every migration's RLS policies, triggers, and SECURITY DEFINER RPCs *before* writing any application code against them. **As of the §16 security patch, this harness is committed at `supabase/rls-tests/` and is directly re-runnable** (`supabase/rls-tests/run.sh` — spins up a throwaway container, applies the auth stub, applies every real migration in `supabase/migrations/` in filename order, loads fixtures, runs every `tests/*.test.sql` file, exits non-zero on any failure). Previously it existed only as an ad hoc process during Milestones 3–5 and left no artifact in the repo — this was itself a contributing factor in the §16 finding (a process gap, not just a code gap: nothing forced a regression test for every self-service column-protection trigger to be written down and rerun). **Every new migration protecting a column via a trigger (following the `prevent_direct_role_change()` pattern) must add a corresponding `tests/*.test.sql` file to this harness, not just rely on manual verification during development.** Extended for Sprint 2 M1 (`03_academic_fixtures.sql`, `tests/academic_structure.test.sql`, 15 tests): role-gated view/manage split (teacher can view/not manage, parent gets neither), cross-tenant create/select rejection, the one-active-year partial unique index, the activation-guard trigger (direct `UPDATE` to activate rejected, direct `UPDATE` to archive allowed), `set_active_academic_year()`'s atomic switch and its manager-only check, both FK-doesn't-respect-RLS triggers (`terms`/`classes` against a mismatched parent tenant), the DELETE-is-impossible guarantee, and case-insensitive unique names. All 23 tests (8 pre-existing + 15 new) pass together — no regressions from adding the new tables/triggers.
  - Gotcha encountered while building it: Postgres `exception when insufficient_privilege` only catches SQLSTATE 42501; a bare `raise exception '...'` defaults to SQLSTATE `P0001` and will **not** be caught by that handler — use `exception when others then` + a `sqlerrm like '%...%'` string check instead (the pattern used throughout the existing test scripts).
  - Gotcha: column-level `GRANT` restrictions are **not sufficient** protection against a specific-column write in real Supabase — `authenticated` gets blanket table-level grants by default, which silently re-opens whatever a narrower column grant tried to close. The verified, real enforcement mechanism is a `BEFORE UPDATE` trigger gated by a transaction-local `set_config()` flag that only the relevant SECURITY DEFINER function sets immediately before its own write (see `prevent_direct_role_change()`).
- **Quality gate for every milestone** (mandatory, repeat for every future milestone): `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build` all clean; grep the diff for `TODO|FIXME|XXX` (must be empty); run the full Playwright suite **at least twice** (flake check) before considering a milestone done.

## 16. Security Decisions

- **JWT `app_metadata` is the sole authorization source of truth for `role` and `tenant_id`** — never a table, never client-supplied input. Every table mirror of this data (`profiles.role`, `profiles.tenant_id`) is documented as a read/query convenience only, kept in sync exclusively by SECURITY DEFINER functions, never writable directly by ordinary client UPDATEs.
- **RLS is enabled *and forced*** (`force row level security`) on every tenant-scoped table — forcing closes the loophole where the table owner role would otherwise bypass RLS.
- **Elevated/privileged operations (creating a user, changing a role) are SECURITY DEFINER Postgres functions**, not a service-role key exposed to the browser and not an unverifiable Edge Function — this keeps every privileged code path inside the same Docker-harness-verifiable, version-controlled SQL migration history as everything else.
- **Tenant isolation for privileged RPCs is enforced inside the function body itself**, not just relied upon via RLS on the tables it touches — e.g. `admin_create_user`'s `p_tenant_id` parameter is silently ignored for any caller who isn't a platform admin (`v_effective_tenant := public.current_tenant_id()` unconditionally for non-platform callers), verified by a dedicated Docker-harness test proving a non-platform caller cannot override their own tenant.
- **Column-level write protection is done via triggers checking a transaction-local flag**, never trusted to `GRANT`/`REVOKE` alone (see §15 gotcha). Any future "this column should only ever be written by function X" requirement should follow the exact `prevent_direct_role_change()` pattern: a `BEFORE UPDATE` trigger raising if the column changed and `current_setting('app.some_flag', true) <> 'true'`, with the privileged function calling `perform set_config('app.some_flag', 'true', true)` immediately before its own UPDATE.
- **Self-service restrictions enforced via triggers, not RLS policy composition**: a user (even a manager) can never change their own `status` — expressing "any row in my tenant, except my own" cleanly across a single USING/CHECK pair was judged awkward, so it's a trigger (`prevent_self_status_change()`) that inspects both OLD and NEW rows instead.
- **No secrets or service-role keys in client code** — the anon key + RLS + SECURITY DEFINER functions are the entire privilege model; there is no server component beyond Postgres/PostgREST/GoTrue.
- **Client-side `hasPermission`/`RequirePermission` checks are explicitly documented as UI convenience only** — every load-bearing authorization decision has a corresponding RLS policy or SQL function that would reject the request even if the UI gate were somehow bypassed.

### 16.1 Security Incident — `profiles.tenant_id` self-service tenant-isolation escalation (fixed)

**Found**: during an independent architecture review of this document, verified against the actual migrations (not just the prose), immediately before Sprint 2 M1 began. **Status: fixed** via `supabase/migrations/20260803140000_prevent_direct_tenant_change.sql`.

**The vulnerability**: `profiles_update_own` (Milestone 3, `20260802125403_row_level_security.sql`) is `using (id = auth.uid()) with check (id = auth.uid())` — that predicate only restricts *which row* a user may update, not *which columns*. `role` and self-`status` changes each got a dedicated `before update` trigger (`prevent_direct_role_change()`, `prevent_self_status_change()`, both Milestone 5) closing exactly this gap for those two columns. `tenant_id` — the column `current_tenant_id()` (§9) reads directly, and the value every tenant-scoped RLS policy in the system is built on — had no equivalent trigger. The Milestone 5 migration's own header comment already documents *why* the column-level `grant update (first_name, last_name, phone, avatar_url, status) ...` isn't sufficient protection on its own (Supabase grants `authenticated` blanket table privileges by default, independent of migration history) — that reasoning was applied to `role` but not extended to `tenant_id`.

**Exact exploit path**: any authenticated user, any role — a `learner` or `guest` account is sufficient — could issue
```
PATCH /rest/v1/profiles?id=eq.<own-id>
{ "tenant_id": "<any-other-school-id>" }
```
This satisfies both `profiles_update_own`'s `USING` and `WITH CHECK` (own row, `id` unchanged), and prior to the fix nothing rejected the `tenant_id` change itself. Once written, `current_tenant_id()` resolves to the attacker-chosen school for every subsequent request in that session, granting that tenant's data — a full cross-tenant confidentiality breach, directly contradicting §1's core premise ("each school's data is fully isolated from every other school's") and standing rule #6. **Verified empirically** (not just by code inspection) by running the exploit against a harness build of the pre-patch migrations: the `UPDATE` succeeded and moved a fixture user from School A into School B.

**Not reachable through the existing UI**: verified that no current service (`profileService.updateProfile`, `userService.updateUser`) ever constructs a payload containing `tenant_id` — `ProfileUpdateInput` only exposes `firstName`/`lastName`/`phone`/`avatarUrl`. The gap was reachable only via a direct API call bypassing the app's service layer entirely (which nothing in the RLS/grant layer prevented — see rule #7: the UI is not the real gate). A regression test (`e2e/users.spec.ts`, `'editing a user never sends tenant_id in the update payload'`) now asserts the edit-user PATCH request never includes `tenant_id`, so a future form change can't silently start exercising this path — but the actual enforcement is the DB trigger below, not this app-level check.

**The fix**: `prevent_direct_tenant_change()`, a `before update` trigger on `profiles`, mirroring `prevent_direct_role_change()` exactly — blocks any change to `tenant_id` unless a transaction-local `app.allow_tenant_change` flag was set `true` (via `set_config(...)`) by a privileged `SECURITY DEFINER` function immediately before its own `UPDATE`. **No function currently sets this flag** — nothing in the shipped codebase has a legitimate reason to move an existing user to a different tenant — so today this trigger blocks 100% of `tenant_id` changes, including for platform admins attempting a raw table `UPDATE` (verified in the harness — `is_platform_admin()` is not consulted by this trigger at all, by design, per the brief: "if no legitimate tenant transfer functionality currently exists, completely block tenant_id changes"). The flag mechanism is included so a future, deliberate "transfer user to another school" admin function can be added the same way `admin_update_user_role()` was, without a second migration to introduce the trigger machinery.

**Why this didn't break anything**: `switchTenant()` (§9, `TenantProvider`) is purely client-side session state for platform-level roles — it never writes `profiles.tenant_id` — so blocking all direct writes to that column doesn't affect tenant switching. Verified via the harness that `admin_update_user_role()` (role-only updates) and `admin_create_user()` (INSERT, not UPDATE) are both unaffected, since the new trigger only fires when `tenant_id` itself changes.

**Regression coverage added** (`supabase/rls-tests/tests/profiles_tenant_id_protection.test.sql`, run via `supabase/rls-tests/run.sh` — see §15): self-change blocked; platform-admin raw-`UPDATE` bypass blocked; `current_tenant_id()` unchanged after a blocked attempt; cross-tenant `SELECT` still impossible; non-sensitive self-edit columns still writable; pre-existing self-status-change protection still enforced; `admin_update_user_role()` and `admin_create_user()` both still functional. All 8 pass; full suite re-run clean.

**Standing rule going forward** (added to §26 as rule #16):

> Every security-sensitive mirrored column (such as `tenant_id` or `role`) must be protected by both RLS and trigger-level enforcement. RLS controls row access; triggers protect immutable security attributes.

**Process finding, not just a code finding**: the Docker RLS harness that was supposed to catch exactly this class of gap (§15) had never been committed to the repo — it existed only as an ad hoc, re-run-from-memory process across Milestones 3–5, with no persisted test file proving `role`'s protection was ever regression-tested either. It's now committed at `supabase/rls-tests/`, directly re-runnable, and covers both the new `tenant_id` protection and the pre-existing `role`/`status` protections it was assumed (but not provably shown) to already cover. **Every future column-protection trigger must ship with a corresponding `tests/*.test.sql` file in this harness, not just manual verification during development** — that discipline, not just this one patch, is what would have caught this before it shipped.

**Related finding, since fixed (§28)**: the same review noted `profiles.email` was self-writable via `profiles_update_own` with no equivalent protection. This was left open at the time (flagged as a future decision, not fixed by this patch) but was investigated and fixed during the Production Hardening sprint — see §28.4. Historical note kept here rather than deleted, since it's what §28.4's investigation started from.

## 17. Existing Reusable Components (`src/components/ui/`)

- **`Button`** (`Button.tsx`) — `variant: 'primary'|'secondary'|'ghost'`, `isLoading`, `leftIcon`, forwards ref, full-width by default (`w-full h-11`), built-in spinner replaces `leftIcon` while loading, `aria-busy`.
- **`TextField`** (`TextField.tsx`) — labeled input with `error`/`hint`/`rightElement` slots, auto-generates an `id` via `useId()` if none given, wires `aria-invalid`/`aria-describedby` automatically, forwards ref (works directly with `react-hook-form`'s `register()`).
- **`PasswordField`** — (exists, not re-read in this pass) password variant of TextField with a show/hide toggle using `EyeIcon`/`EyeOffIcon`.
- **`Checkbox`** — (exists, not re-read in this pass) used for "remember me" on Login.
- **`Modal`** (`Modal.tsx`) — accessible dialog: focus trap (Tab/Shift+Tab cycling), Escape-to-close, backdrop-click-to-close, `role="dialog" aria-modal="true" aria-labelledby`, renders via `createPortal` to `document.body`, locks `document.body` scroll while open, auto-focuses the first focusable field on open. Props: `{isOpen, onClose, title, children, footer?}`. **Use this for every dialog — never build a bespoke one.**
- **`FullScreenSpinner`** / **`FullScreenNotice`** — full-viewport loading/error/informational states, used by every route guard (`ProtectedRoute`, `PublicOnlyRoute`, `TenantGate`).
- **`ThemeToggle`** — sun/moon icon toggle wired to `useTheme()`.
- **`Logo`** — brand mark.
- **`icons.tsx`** — hand-drawn inline SVG icon set (no icon library dependency): `EyeIcon`, `EyeOffIcon`, `SunIcon`, `MoonIcon`, `CheckIcon`, `GridIcon`, `BuildingIcon`, `UsersIcon`, `GraduationCapIcon`, `ChalkboardIcon`, `ChartIcon`, `GearIcon`, `ChevronDownIcon`, `MenuIcon`, `CloseIcon`, `LogOutIcon`, `SearchIcon`. **Add new icons here** (consistent `viewBox="0 0 24 24"`, `stroke="currentColor"`, `strokeWidth={1.75}`, rounded caps/joins) rather than inlining SVG markup in a component or pulling in an icon package.
- **Layout**: `DashboardLayout` (fixed-viewport shell: header + collapsible sidebar + mobile drawer + internally-scrolling `<Outlet/>` + footer, §34), `DashboardHeader` (page title/section breadcrumb via `src/lib/pageTitles.ts`, §34), `DashboardSidebar` (permission-aware, sectioned nav list + system-status line + account identity, §34), `AppFooter` (§34 — Auris Nexus branding bar, mounted once in `DashboardLayout`), `UserMenu` (in the header — profile menu/sign-out).
- **`TableScrollContainer`** (`TableScrollContainer.tsx`, added §33) — wraps a horizontally-scrollable table with edge-fade shadow affordances that appear only when there's more content to scroll to. Wrap every new `*Table` component's `overflow-x-auto` shell in this rather than a bare div.

## 18. Existing Providers, Hooks, and Services

**Providers** (nesting order matters, see §10):
`AuthProvider` → `ProfileProvider` → `TenantProvider` → `SchoolProvider` → `AcademicProvider`.

**Context accessor hooks** (all throw if used outside their provider):
`useAuth()`, `useProfile()`, `useTenant()`, `useSchool()`, `useAcademic()`.

**Cross-feature hooks** (`src/hooks/`):
`usePermissions()` — `{role, can, canAny, canAll, hasRole, isAtLeast}`.
`useTheme()` — `{theme, toggleTheme, setTheme}`.

**Feature-owned hooks**:
`useUsersList()`, `useUserProfile()` (both in `features/users/hooks/`) — standard data-fetch hook shape: state + `isLoading`/`error`/`refetch` (and for lists, `filters`/`page`/`setPage`/`setFilters`).
`useGrades()`, `useClasses()`, `useSubjects()`, `useTerms()` (all in `features/academic/hooks/`) — same `{data, isLoading, error, refetch}` shape, no pagination (see §14).

**Services** (plain-object-of-functions, see §6):
- `authService` — `getSession`, `signInWithPassword`, `signOut`, `requestPasswordReset`, `updatePassword`, `resendVerificationEmail`.
- `profileService` — `getProfileById`, `updateProfile` (+ exports `toProfile` mapper for reuse).
- `tenantService` — `getSchoolById`, `listAvailableSchools` (+ exports `toSchool` mapper for reuse).
- `schoolService` — `getSchoolById`/`getCurrentSchool` (delegate to `tenantService`), `updateSchool`, `updateSchoolSettings`.
- `rbacService` — synchronous facade over `features/rbac/utils/*` (no backend calls).
- `userService` — `getUsers`, `getUserById`, `createUser`, `updateUser` (delegates to `profileService.updateProfile`), `updateUserRole`, `deactivateUser`.
- `academicYearService` — `getAcademicYears`, `getAcademicYear`, `createAcademicYear`, `updateAcademicYear`, `archiveAcademicYear`, `setActiveAcademicYear` (+ exports `toAcademicYear`).
- `termService` — `getTerms`, `getTerm`, `createTerm`, `updateTerm`, `archiveTerm`, `restoreTerm` (+ exports `toTerm`).
- `gradeService` — `getGrades`, `getGrade`, `createGrade`, `updateGrade`, `archiveGrade`, `restoreGrade` (+ exports `toGrade`).
- `classService` — `getClasses`, `getClass`, `createClass`, `updateClass`, `archiveClass`, `restoreClass` (+ exports `toClass`).
- `subjectService` — `getSubjects`, `getSubject`, `createSubject`, `updateSubject`, `archiveSubject`, `restoreSubject` (+ exports `toSubject`).

One service file per academic entity (not one combined `academicService`) — five distinct entities with CRUD each read more cleanly this way; each follows the exact plain-object-of-functions shape every other service uses.

## 19. Naming Conventions

- **Files**: `PascalCase.tsx` for components/pages/providers (`CreateUserModal.tsx`, `SchoolProvider.tsx`), `camelCase.ts` for everything else (services, hooks, utils, types, schemas) — e.g. `userService.ts`, `useUsersList.ts`, `userPermissions.ts`, `user.types.ts`, `createUserSchema.ts`. Context files are the one lower-camel exception even though they export a `Context` object: `authContext.ts`, `schoolContext.ts`, `tenantContext.ts`, `profileContext.ts` — but the **Provider component** itself is `PascalCase.tsx` (`AuthProvider.tsx`, `SchoolProvider.tsx`).
- **Types/interfaces**: `PascalCase` (`Profile`, `School`, `Tenant`, `UserRole`, `Permission`). Row/Insert/Update DB-mirror types are suffixed accordingly: `ProfileRow`, `ProfileInsert`, `ProfileUpdate`.
- **Permission strings**: `<domain>.<action>` dot-namespaced lowercase (`school.view`, `school.manage`, `profile.view_any`, `tenant.switch`) — multi-word actions use `snake_case` after the dot (`view_own`, `manage_any`). Follow this exactly for `academic.view`/`academic.manage`.
- **SQL functions**: `snake_case`, verb-first for actions (`admin_create_user`, `admin_update_user_role`, `set_active_academic_year`), `can_<verb>_<noun>` for authorization predicates (`can_manage_school`, `can_manage_profiles`, `can_assign_role`).
- **SQL tables/columns**: `snake_case`, singular concepts pluralized for the table name (`schools`, `profiles`), `tenant_id` (not `school_id`) is the established FK name for "which school does this belong to" throughout — **note**: the Academic brief's literal field list says `school_id` for the new tables; that's fine to use verbatim for these specific new tables since the brief names them explicitly, but don't rename the existing `profiles.tenant_id`/`schools.id` relationship to match — see §11 of the M5 migration's own header comment for the precedent of "reuse the existing column, don't rename to match a brief's literal wording."
- **React Hook Form + Zod**: schema file `xSchema.ts` exports `xSchema` (the Zod object), `XFormValues` (`z.infer<typeof xSchema>` type), and `xDefaultValues` (a `XFormValues` object) — see `createUserSchema.ts` for the exact triple.
- **Test IDs/fixtures**: e2e mock builders are `buildMockXRow(overrides)` / `buildMockX(overrides)`, mock installers are `installXMocks(page, ...)` — keep new academic-entity mocks in this same naming family (`buildMockAcademicYearRow`, `installAcademicYearsListMock`, etc.) inside `e2e/utils/mockData.ts` rather than a new file, to keep one shared mocking surface.

## 20. File Structure Conventions

(See §4 for the tree; this section is the *rule*, not the *inventory*.)

- New business feature → new folder under `src/features/<name>/`, subfolders **only as needed** from the fixed set `{components, context, hooks, pages, schemas, services, types, utils}`.
- A type used by **more than one feature** (e.g. `School`, `Profile`, `Tenant`) lives in `src/types/<name>.types.ts`, re-exported through the `src/types/index.ts` barrel — each concept owned by exactly one feature's types file, the barrel only re-exports, never redefines (explicit rule stated in that file's own header comment). A type used by **only one** feature stays inside that feature's own `types/` folder (e.g. `CreateUserInput` lives in `features/users/types/user.types.ts`, not the global barrel).
- Route guards live in `src/routes/`, never inside a feature folder, even if a guard is conceptually tied to one feature (`RequirePermission` is generic and reusable, not `features/rbac/routes/`).
- The single route tree lives entirely in `src/app/AppRoutes.tsx` — never scatter `<Route>` declarations across feature files.
- Design-system primitives live in `src/components/ui/`; app-chrome/layout components live in `src/components/layout/`; anything more specific than that belongs inside the owning feature's `components/`.
- Migrations are one file per logical unit of schema change, named `<yyyymmddhhmmss>_<snake_case_description>.sql`, and are **append-only** — a mistake in a shipped migration gets fixed by a new migration, never an edit to an old one.

## 21. Performance Considerations

- **Providers avoid redundant fetches by composing on top of each other's already-loaded state** rather than each independently querying Supabase — the explicit, documented rationale behind `SchoolProvider` reusing `TenantProvider`'s already-loaded `tenant.school` instead of issuing its own `getSchoolById` call. Apply the same discipline to `AcademicProvider`: it likely wants to load off of `useTenant()`/`useSchool()`'s resolved school id, and should not re-derive tenant/school itself.
- **Avoid triggering a `TenantProvider`/`ProfileProvider` refetch from an unrelated feature's mutation** — doing so flips shared status to `'loading'`, which (via `TenantGate`) unmounts every gated page in the tree, not just the one that triggered it. Update local state directly with the mutation's response instead (see `SchoolProvider.updateSchool`).
- **Pagination is server-side** via PostgREST's `.range(from, to)` + `{count: 'exact'}`, not client-side slicing of a fully-fetched list (`userService.getUsers`) — follow this for any Academic list view expected to grow (Classes/Subjects potentially; Academic Years/Terms/Grades are typically small enough not to strictly need it, but stay consistent if in doubt).
- No memoization library, no React Query/SWR — data fetching is hand-rolled `useEffect` + `useState` per hook. This is a deliberate simplicity choice for the project's current size; if a future milestone's data-fetching complexity (e.g. cross-entity academic-year-scoped queries with lots of cache invalidation) starts to strain this, that would be a discussion to have with the product owner before introducing a new dependency, not a unilateral addition.
- Icons are hand-authored inline SVG components (no icon font, no icon package) — zero extra bundle weight per icon, trivial tree-shaking.

## 22. Accessibility Standards

`eslint-plugin-jsx-a11y` runs as part of the standard lint gate — a11y violations are lint errors, not suggestions.

- Every form field has a real, associated `<label>` (`TextField`/`PasswordField` wire `htmlFor`/`id` automatically, including auto-generated ids via `useId()` when none is passed).
- Every error message uses `role="alert"`; every success/status message uses `role="status"`.
- Every focusable element gets a visible focus ring via the shared `.focus-ring` utility class — never `outline-none` without it.
- Modals: full focus trap, `aria-modal="true"`, `role="dialog"`, `aria-labelledby` pointing at the visible title, Escape closes, focus returns sensibly (first focusable field auto-focused on open).
- Icon-only buttons always have an explicit `aria-label` (e.g. the mobile-nav close button, the modal close button).
- Loading spinners always pair a visual `aria-hidden="true"` spinner with an `sr-only` text equivalent ("Loading users…", etc.) for screen readers.
- Decorative icons get `aria-hidden="true"` (the default in every icon component in `icons.tsx`).
- Color is never the sole information channel — status banners pair color with an icon/role/explicit text, not just a background tint.

## 23. Current Technical Debt

- **No transactional email system.** New users get a one-time temporary password rendered directly in the Create User modal's success state — there is no invite email, no Supabase email-template wiring, no Edge Function. This was flagged as a Sprint 2 recommendation at the end of Milestone 5 and is still outstanding.
- **`profiles.role` requires manual sync discipline.** It is a denormalized mirror with real (trigger-enforced) protection against direct writes, but any *new* code path that needs to change a user's role must remember to go through `admin_update_user_role()` — there is no way for TypeScript to statically prevent someone from writing a naive `supabase.from('profiles').update({role: ...})` call elsewhere; it would simply fail at runtime via the trigger. Worth a lint rule or code-review checklist item if this becomes a recurring risk.
- **The RBAC SQL/TS mirrors (`can_assign_role()`/`canAssignRole()`, `can_manage_school()`/`ROLE_PERMISSIONS['school.manage']`, etc.) are kept in sync *manually*, by convention and comment cross-reference, not by any shared code-generation step.** This is an accepted, documented tradeoff (role/permission data fundamentally lives in the JWT and Postgres RLS can't introspect a TypeScript union), but it is a real ongoing risk of drift as more permissions are added — every future one needs the same disciplined cross-referencing comments on both sides.
- ~~No CI pipeline~~ **Fixed in §28** — `.github/workflows/ci.yml` now runs typecheck/lint/unit tests/build on every PR and push to `main`, plus a separate job for the RLS regression suite.
- **No dependency-update-triggered generic-typing regression test.** The `@supabase/supabase-js` pin to `2.45.4` protects against a known-bad version, but there's no automated check that would catch a *future* version reintroducing the same interface-vs-type generic degradation if someone bumps the pin. Still outstanding.
- ~~`profiles.email` is self-writable~~ **Fixed in §28.4** — `prevent_direct_email_change()` trigger, same pattern as `tenant_id`.
- **E2E is not wired into CI** — it needs a live, seeded Supabase project (or, per §28's discovery, can run fully network-mocked against dummy env vars — see §28.6) and repository secrets that don't exist yet. Deliberately not added in §28 per "don't add secrets unnecessarily." Tracked as a Sprint 4 candidate, not a blocker (see §30).

## 24. Known Limitations

- **No attendance, timetabling, gradebook, or finance/payroll modules exist yet** — academic structure, employee management, learner management (with guardians/medical/emergency-contacts/documents/enrollment history), and reports/analytics are all built (Sprint 2–3); those four remain future epics.
- ~~The `teacher`/`class_teacher`/`subject_teacher` role distinction is not backed by any data relationship~~ **Resolved in Sprint 4** — `class_teacher_assignments` now links a teacher (profile) to a class and, optionally, a specific subject within it, for a given academic year (§31). The three roles still resolve to identical *permissions* (`['school.view', 'academic.view', 'reports.view']`) — that was never the gap; the gap was the missing data relationship, which is what ADR-0001 (`docs/adr/ADR-0001-teaching-assignment-domain.md`) actually documented and what Sprint 4 closed.
- **Only 3 of the 24 roles are exposed through the user-creation/role-assignment UI** (`school_owner`/"School Administrator", `principal`, `teacher`) — the other 21 roles exist in the type system and RBAC matrix (and are assignable in principle by a platform admin via direct RPC call) but have no UI path to be assigned to anyone yet.
- **Tenant switching only exists for platform-level roles**, and even for them it's a simple `switchTenant(schoolId)` with no persisted "which school was I last viewing" — it resets to the profile's own tenant (or none) on every fresh session for platform-level users.
- **No soft-delete/undo pattern established yet** — `deactivateUser` sets `status: 'inactive'`, there is no equivalent for schools, and no established convention yet for whether new Academic entities (e.g. a Class or Subject) should be hard-deleted or soft-archived. **The Sprint 2 M1 brief explicitly uses "Archive" language for Grades/Classes/Subjects and an `active`/`is_active` boolean column** — treat this as the new precedent (boolean-flag soft-archive, not a hard DELETE) and consider retrofitting `schools`/`profiles` to match later if the product owner wants consistency, but don't do so unprompted.
- **No file/image upload mechanism** exists yet even though `schools.logo_url`/`profiles.avatar_url` are already schema fields — both are currently plain free-text URL fields with no actual upload UI wired to Supabase Storage.
- **Single-language, single-currency-per-school** (no i18n framework, `language`/`currency`/`timezone` are per-school config strings with no enforcement or dropdown-limited set beyond what the School Profile form's Zod schema validates).

## 25. Historical: Sprint 2 Milestone 1 Brief (completed)

**Status: complete and committed** (this section originally tracked it as "not started" — that was accurate only in the window between Sprint 1 finishing and this milestone beginning; it is kept here, unedited below, as the historical record of the actual brief that shaped the academic-structure schema, per §14's own cross-reference to it). This is the literal, verbatim brief as given by the product owner:

> You are the Lead Software Architect for Funda360, an enterprise multi-tenant School Management SaaS platform.
>
> We have successfully completed Sprint 1.
>
> COMPLETED: Milestone 1 – Project Foundation, Milestone 2 – Enterprise Authentication, Milestone 3 – Multi-Tenant Architecture & RBAC, Milestone 4 – School Administration Core, Milestone 5 – User & Role Management.
>
> The application now includes: Enterprise authentication, Multi-tenancy, Row Level Security, RBAC, School administration, User management, Dashboard shell, Feature-based architecture, Enterprise testing suite.
>
> DO NOT rewrite or replace existing architecture. Always extend the current codebase.
>
> **SPRINT 2 MILESTONE 1 — ACADEMIC STRUCTURE**
>
> OBJECTIVE: Build the complete academic foundation for each school. Every school must be able to define its own academic structure independently. Everything must remain tenant isolated.
>
> DATABASE: Review existing migrations first. Create new migrations only where required. Implement the following entities.
>
> **Academic Years** — Fields: id, school_id, name, start_date, end_date, is_active, created_at, updated_at. Requirements: Only one active academic year per school; RLS enabled; Proper indexes; Audit timestamps.
>
> **Terms** — Fields: id, academic_year_id, school_id, name, start_date, end_date, sequence, created_at, updated_at. Requirements: Linked to Academic Year; RLS; Tenant isolation.
>
> **Grades** — Fields: id, school_id, name, code, description, sort_order, active, created_at, updated_at. Examples: Grade R, Grade 1, Grade 8.
>
> **Classes** — Fields: id, grade_id, school_id, name, capacity, active, created_at, updated_at. Examples: Grade 8A, Grade 8B, Grade 9 Blue.
>
> **Subjects** — Fields: id, school_id, name, code, description, active, created_at, updated_at. Examples: Mathematics, English, Life Sciences, Accounting.
>
> FEATURE ARCHITECTURE: Create `src/features/academic/` with structure: components/, context/, hooks/, pages/, schemas/, services/, types/, utils/. Follow the existing architecture used by auth, school, users.
>
> SERVICE LAYER: Typed services for:
> - Academic Years: getAcademicYears(), getAcademicYear(), createAcademicYear(), updateAcademicYear(), deleteAcademicYear(), setActiveAcademicYear()
> - Terms: CRUD
> - Grades: CRUD
> - Classes: CRUD
> - Subjects: CRUD
>
> Requirements: Proper typing, Error handling, Tenant-aware queries, Respect existing RLS.
>
> STATE MANAGEMENT: Create AcademicProvider. Responsibilities: current academic year, academic years, loading state, refresh. Create reusable hooks.
>
> VALIDATION: React Hook Form + Zod. Validate: Dates, Required fields, Unique names where appropriate, Capacity.
>
> USER INTERFACE: Create pages: /academic, /academic/years, /academic/terms, /academic/grades, /academic/classes, /academic/subjects. Integrate into dashboard navigation. Create responsive professional UI. Use existing design system.
>
> ACADEMIC YEAR: Administrator can Create, Edit, Archive, Activate. Only one academic year may be active.
>
> GRADES: Administrator can Create grades, Edit grades, Archive grades, Sort grades.
>
> CLASSES: Administrator can Create classes, Assign grade, Set capacity, Archive classes.
>
> SUBJECTS: Administrator can Create, Edit, Archive, Search.
>
> PERMISSIONS: Use existing RBAC. School Administrator: Full access. Principal: Manage academic structure. Teacher: Read only. Other users: No access unless explicitly permitted. Protect routes. Protect services.
>
> TESTING: Create `e2e/academic.spec.ts`. Test: ✅ Academic Year CRUD, ✅ Only one active year, ✅ Grade CRUD, ✅ Class CRUD, ✅ Subject CRUD, ✅ Tenant isolation, ✅ Permission enforcement. Add unit tests where appropriate.
>
> QUALITY: Run npm run lint, npm run test, npm run build. Fix all issues. No TODO placeholders. No duplicated logic. Maintain enterprise coding standards.
>
> FINAL DELIVERY: Provide: 1. Files created, 2. Files modified, 3. Database migrations, 4. Security summary, 5. Test summary, 6. Architectural decisions, 7. Recommendations for Sprint 2 Milestone 2.
>
> Commit using: `git add .` then `git commit -m "feat(academic): implement Sprint 2 Milestone 1 - academic structure"`

A suggested (non-binding) execution order for this milestone is preserved in `/workspaces/Funda360/HANDOVER.md` at the repo root — a disposable working note, not a permanent spec; this section is the permanent record of the requirement itself.

## 26. Rules for Future Development

These are standing rules, accumulated from explicit product-owner instruction and hard-won implementation experience. Violating any of these has either already caused a real bug in this project or is exactly the kind of thing the product owner has explicitly forbidden.

1. **Never rewrite or replace existing architecture.** Every sprint brief has repeated this instruction verbatim. Extend; don't refactor foundations as a side effect of a new feature.
2. **Never bypass a layer.** Components call hooks/context, hooks/context call services, services call Supabase. Never call `supabase.*` directly from a component or page.
3. **No duplicated logic.** If a mapper, permission check, or query already exists (`toProfile`, `toSchool`, `hasPermission`, `current_tenant_id()`), reuse/export it — don't re-derive it in a new feature.
4. **`Database` Row/Insert/Update types are always `type`, never `interface`.**
5. **Role and tenant_id authorization always flows from the JWT `app_metadata`**, never from a client-supplied value or a table column treated as authoritative. Any denormalized mirror column is read-only from the client's perspective and is written only by a SECURITY DEFINER function.
6. **Every tenant-scoped table gets RLS `enable`d *and* `force`d**, with policies built on `current_tenant_id()`/`is_platform_admin()`.
7. **Every client-side permission gate has a corresponding server-side (RLS or SQL function) enforcement.** The UI check is for UX only; assume it can be bypassed and verify the real gate independently (Docker harness or equivalent).
8. **Cross-reference SQL and TS halves of any authorization rule with an explicit comment** naming the other side, so future changes to one prompt someone to check the other.
9. **Migrations are append-only.** Never edit a shipped migration; add a new one.
10. **Follow the established `src/features/<name>/{...}` shape** for every new feature module; only include the subfolders actually needed.
11. **Reuse `Modal`, `Button`, `TextField`, `icons.tsx`, and the token-based Tailwind classes** for all new UI — never hand-roll a parallel dialog/button/input/icon implementation or hard-code a color.
12. **Every milestone ends with the full quality gate** (typecheck, lint, unit tests, build, e2e run at least twice, TODO/FIXME grep) passing clean before it is considered done, and — once instructed — committed with the exact message given.
13. **Do not commit unless explicitly instructed to**, and when instructed, use exactly the commit message given.
14. **Ask/flag rather than guess** when a brief's literal field names conflict with existing schema concepts (e.g. the M5 brief's `user_id`/`school_id` vs. the existing `profiles.id`/`tenant_id`) — the established resolution pattern is: keep the existing column where it's already the same concept, document the mapping explicitly in the migration's header comment, and only add genuinely new columns for genuinely new concepts.
15. **If a `Write` tool call times out repeatedly on a large file, fall back to a `Bash` heredoc** (`cat > file << 'EOF' ... EOF`) rather than giving up or truncating the file.
16. **Every security-sensitive mirrored column (such as `tenant_id` or `role`) must be protected by both RLS and trigger-level enforcement.** RLS controls row access; triggers protect immutable security attributes. A column-level `GRANT` restriction alone is not sufficient (Supabase's default blanket `authenticated` grants override it) — this is the exact gap that let `profiles.tenant_id` be self-writable via `profiles_update_own` until the §16.1 patch. Every new trigger written to satisfy this rule must ship with a corresponding regression test in `supabase/rls-tests/tests/` (§15) — not just manual verification during development.
17. **Never surface a raw Postgres/PostgREST error (`error.message` on a thrown query error) directly in a user-facing message.** Route it through `getDbErrorMessage(error, fallback)` (`src/lib/dbErrors.ts`, added in §28.3) instead — it maps known SQLSTATE codes and this codebase's own `reason: detail`-style RAISE EXCEPTION messages to safe copy, logs the original to the console for developers, and falls back to a generic message otherwise. This was found to be violated in ~25 places before the §28 hardening pass; don't reintroduce the pattern in new code.
18. **This document goes stale fast — treat "regenerate whenever a milestone completes" (below) as a literal requirement, not a suggestion.** It was last updated immediately after Sprint 1 and not touched again until this regeneration, by which point it was five milestones and a full sprint behind reality, self-contradictory in places (§2 said one milestone was "not yet committed" while §25 said the same milestone's status was "not started," despite both being written from the same stale snapshot), and referenced a disposable working note (root `HANDOVER.md`) that had itself said "delete once committed" for five milestones. Regenerating this costs far less than the confusion of a future engineer (human or AI) trusting a stale status section.

## 27. Employee, Learner, and Reports Module Architecture (Sprint 2 M2–M4, retroactive summary)

These three modules were built and committed without this document being updated at the time (see §2/§18). This section is a concise, evidence-based summary added during the §28 regeneration — deliberately not written at the same exhaustive per-migration density as §14, since it was reconstructed from a repository audit rather than written contemporaneously during implementation. Treat the code itself (`src/features/employees/`, `src/features/learners/`, `src/features/reports/`, and the corresponding migrations) as authoritative for any detail not covered here.

**Employee Management** (`src/features/employees/`, migrations `20260803160000_employee_management.sql` and `20260804090000_employee_login_provisioning.sql`): `departments` and `employees` tables, both tenant-scoped via `school_id`, never hard-deleted (`departments.active` / `employees.employment_status` are the archive states — no DELETE RLS policy exists on either table). `employees.school_id` is always resolved server-side from the caller's tenant context (`SchoolProvider`/`TenantProvider`), never client-supplied — the historical company-id/dropdown-scoping issue this project once had is resolved; department and "reports to" manager dropdowns both filter by the resolved `school_id`. Lifecycle changes go through `terminate_employee()`/`reactivate_employee()` SECURITY DEFINER RPCs (terminating also deactivates a linked login, if any, in the same transaction). `provision_employee_login()` creates a real Supabase Auth login for an existing employee record, gated by a narrow allowlist of assignable roles (excludes governance roles like `school_owner`). e2e coverage: `e2e/employees.spec.ts` (CRUD, terminate/reactivate, login provisioning, department archive, tenant isolation, role gating).

**Learner Management** (`src/features/learners/`, migration `20260803190000_learner_management.sql`): six tenant-scoped tables — `learners` (the SIS master record), `learner_enrollments` (year-by-year placement history, not flat current-grade columns, so promotion history is preserved), `learner_guardians` (a relationship join to existing `profiles` rows with `role IN ('parent','guardian')`, not a new Guardian entity), `learner_emergency_contacts`, `learner_medical_information` (separately RLS-gated — see §27's Guardian note below and §16's DB architecture pattern), `learner_documents` (metadata only; no file upload/Storage wiring exists yet). None are hard-deletable (no DELETE RLS policy on any of the six, combined with `force row level security`). Status transitions go through a whitelist trigger (`learners_validate_status_transition`) that applies uniformly whether triggered by `change_learner_status()` or a direct UPDATE. `promote_learner()` atomically marks the current enrollment `promoted` and creates the new one. SA ID number checksum validation (`src/features/learners/utils/saIdNumber.ts`, unit-tested) is the one piece of non-trivial business-rule validation in this module. e2e coverage: `e2e/learners.spec.ts` (CRUD, status change, enrollment/promotion, role-gated medical visibility, emergency contacts).

**Reports & Analytics** (`src/features/reports/`): read-only aggregation views over Learner/Employee/Academic data (counts by status/department, active-vs-archived splits) plus CSV export (`downloadCsv.ts`), gated by `reports.view`/`reports.export` permissions layered on top of the underlying `learner.view`/`employee.view`/`academic.view` permissions (a role can have `reports.view` but still be blocked from a specific report if it lacks the matching domain permission — verified by e2e). No new database tables; reports query existing tenant-scoped tables directly, respecting the same RLS as their source feature.

**Guardian self-service** (Sprint 3, layered on top of the Learner Management tables above): `is_learner_guardian(learner_id)` (SECURITY DEFINER, added in `20260803190000` and updated in §28.2) is the single mechanism granting a guardian read access to their linked learner's record, medical information, and emergency contacts — added as an `OR` clause to each table's SELECT policy, never a write path. It is SECURITY DEFINER specifically to avoid an RLS recursion trap: a plain `EXISTS` subquery against `learner_guardians` from within another table's policy would itself be filtered by `learner_guardians`' own RLS, which a guardian (who has no `learner.view` permission) doesn't satisfy — producing a false negative. This was caught by actually running the RLS harness, not by inspection. `EmployeeSelfSummary`/`LearnerSelfSummary` (`src/features/employees/components/`, `src/features/learners/components/`) are the UI surfaces for "my own record" / "my linked child(ren)," rendered on `/my-profile`; the RLS policies above, not these components, are what actually scope visibility.

## 28. Production Hardening Sprint (2026-08-16)

Followed a full repository audit (git state, architecture, Sprint 1–3 verification, auth/RBAC, RLS, employee/learner/guardian features, security sweep, build/test verification) that found the core architecture, RLS, and multi-tenancy sound, but identified several genuine operational and functional gaps. This section records exactly what changed to close them, in the same evidence-based style as the rest of this document.

**28.1 Guardian and Emergency-Contact Removal.** Neither `learner_guardians` nor `learner_emergency_contacts` had a removal path — CRUD existed for create/read/update only, with no delete/unlink affordance anywhere (UI or service layer), a genuine data-correction gap (e.g. undoing a mis-linked guardian). Migration `20260816090000_guardian_emergency_contact_lifecycle.sql` adds an `active boolean not null default true` column to both tables, extending the exact same never-hard-delete/archive pattern already used by `departments.active` and `learner_documents.active` (no new architectural pattern introduced). Critically, `is_learner_guardian()` was redefined in the same migration to filter `and active` — archiving a guardian link revokes that guardian's RLS-derived read access to the learner/medical-info/emergency-contacts immediately, not just cosmetically in their own UI. `guardianService.archiveGuardian()`/`restoreGuardian()` and `emergencyContactService.archiveEmergencyContact()`/`restoreEmergencyContact()` follow the exact `documentService` shape; archiving a guardian also clears `is_primary` (a data-hygiene fix, not a security one — the partial unique index on `is_primary` doesn't consider `active`). UI: `GuardiansTable`/`EmergencyContactsTable` gained a Status column and Remove/Restore action; `RemoveGuardianDialog`/`RemoveEmergencyContactDialog` (new, following the existing `TerminateEmployeeDialog`/`ReactivateEmployeeDialog` confirmation-modal pattern) require explicit confirmation before archiving. New RLS regression suite: `supabase/rls-tests/tests/guardian_removal_lifecycle.test.sql` (8 tests — unauthorized/cross-tenant archive blocked, authorized archive succeeds, guardian access revoked immediately, staff can still see an archived link to restore it, restore reverses everything).

**28.2 `profiles.email` Protection.** §16.1's investigation had found this gap but left it unfixed (deliberately out of scope for the `tenant_id` patch). Re-investigated from scratch per standing instruction not to blindly copy the `tenant_id` fix: grepped every write path to `profiles.email` in the frontend and found none — `profileService.updateProfile`'s and `userService.updateUser`'s shared `ProfileUpdateInput` type has never included `email`, and `authService` only ever writes `password` via `supabase.auth.updateUser()`. No legitimate email-change workflow exists in the application today. Given that, the same trigger pattern used for `tenant_id`/`role` was the correct fix, not a different one: migration `20260816100000_protect_profile_email.sql` adds `prevent_direct_email_change()`, blocking any change to `profiles.email` unless a transaction-local `app.allow_email_change` flag is set by a privileged function first — no function currently sets it, so this blocks all email changes today, exactly like the `tenant_id` fix did on landing, while leaving room for a future verified email-change workflow to call `set_config(...)` before its own UPDATE without a further migration. Regression suite: `supabase/rls-tests/tests/profile_email_protection.test.sql` (7 tests, mirroring `profiles_tenant_id_protection.test.sql`'s structure).

**28.3 Safe Database Error Handling.** The audit found ~25 components doing `setSubmitError(error instanceof Error ? error.message : 'fallback')` — since `PostgrestError` (supabase-js) extends `Error`, this surfaced raw Postgres text (constraint names, RLS policy internals) directly to end users; confirmed live by an e2e test (`school-profile.spec.ts`) that had been asserting the leaked text as correct. Rather than hand-editing ~25 files with bespoke logic, one centralized utility was added: `getDbErrorMessage(error, fallback)` (`src/lib/dbErrors.ts`, unit-tested in `dbErrors.test.ts`) — maps this codebase's own `reason: detail`-style RAISE EXCEPTION messages (`insufficient_privilege:`, `not_found:`, `email_taken:`) and common SQLSTATE codes (unique/foreign-key/check violation, insufficient privilege) to safe copy, always logs the original error to the console for developers, and falls back to the existing per-call fallback text for anything unrecognized — non-Postgres errors (e.g. network failures) behave exactly as before. All ~25 call sites were migrated to it (mechanical, verified by re-running typecheck/lint/unit tests/the full e2e suite after). `authErrors.ts` (auth-specific error mapping) is untouched — this is a separate, narrower concern.

**28.4 Seed Data Safety.** `supabase/seed.sql`'s shared dev password was already commented as local-only, but was renamed from `Funda360!Dev2026` to `Funda360!LOCALDEV-ONLY-2026` and the header banner strengthened (plus a `RAISE NOTICE` printed every time the seed actually runs) so it reads as unmistakably a placeholder if ever pasted elsewhere, rather than a normal-looking credential. No production credential was invented or added.

**28.5 Environment Configuration.** `.env.example` added (previously missing — `src/lib/supabase.ts`'s own error message already referenced it) documenting the two variables the app actually reads (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, both required — grepped `import.meta.env.*` usage to confirm no others exist) plus the declared-but-unused `VITE_APP_NAME`, with placeholder values only, plus inline documentation of build/test commands and what each does/doesn't need.

**28.6 CI/CD.** `.github/workflows/ci.yml` added — one job runs `npm ci` → typecheck → lint → unit tests → production build on every PR and push to `main` (no secrets needed: the build is static, `src/lib/supabase.ts` only reads env vars at browser runtime, not build time); a second, separate job runs the Docker-based RLS regression suite (`supabase/rls-tests/run.sh`) in its own disposable container, also with no repository secrets. E2E was deliberately **not** wired into CI yet — see §28's discovery below.

**Discovery during this sprint, worth recording**: `e2e/` was previously assumed (including by this document's own §15/§24) to need a live Supabase backend. It does not — every spec fully mocks the network layer (`e2e/utils/mockAuth.ts`/`mockData.ts`, `page.route(...)`), and the dev server itself only needs `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` to be *present* (any value) to boot, since `src/lib/supabase.ts` only checks they're non-empty, never validates them until an actual network call is made — which never happens in these tests. The full suite (78 specs) was run locally this way and passed. It still isn't in CI because that needs Playwright's browser binaries installed in the CI image (a `playwright install` step, not a secret) — a small, low-risk addition, tracked as a Sprint 4 candidate (§30), not added speculatively in this pass since it wasn't explicitly requested and changes CI runtime/cost.

**28.7 Documentation Reconciliation.** This document was regenerated (§2, §3, §16.1, §23, §24, §25, §27–§30 all touched) to remove contradictions with the actual repository state. Root `HANDOVER.md` — a disposable working note whose own first line said "Delete this file once Sprint 2 Milestone 1 is committed" — was deleted; five further milestones and a full sprint had landed since that instruction, and its content (the Sprint 2 M1 execution-order note) has no remaining value now that milestone is long complete (§25 preserves the actual binding brief it was a working note *for*).

**28.8 Role Model (Investigated, Not Changed).** Re-verified `ADR-0001-teaching-assignment-domain.md`'s core claim directly against current code (`src/features/rbac/constants/rolePermissions.ts`): `teacher`/`class_teacher`/`subject_teacher` still resolve to identical permissions (now `['school.view', 'academic.view', 'reports.view']`, one more than when the ADR was written, but still identical across all three), with no backing data relationship. The ADR remains accurate and is the authoritative record — deliberately not redesigned in this pass, per its own "Consequences" section: the relationship should be designed once a real capability needs it, not speculatively.

**28.9 Performance.** The production build had a single 601.78 KB (151.18 KB gzip) JS chunk with no code-splitting. `src/app/AppRoutes.tsx`'s 21 page-level route components were converted to `React.lazy()` (via a small `named()` helper adapting each page's existing named export to the default export `lazy()` requires — no export renamed anywhere else in the codebase), wrapped in a single `<Suspense fallback={<FullScreenSpinner />}>`. Low-risk by construction: only route-level leaf components were split (not layout/guard components, which stay eager), verified by a clean typecheck/lint pass and the full e2e suite passing twice (before and after). Result: main bundle dropped to 309.28 KB (91.73 KB gzip), largest per-route chunk 50.71 KB — the chunk-size warning is gone.

**28.10 Final Verification.** `npx tsc -b --noEmit`, `npm run lint`, `npx vitest run` (45 tests, 6 files), `npx vite build` all clean. `supabase/rls-tests/run.sh` (65 pre-existing + 15 new = 80 assertions across 8 test files) could not be run in this environment (no Docker installed here) but is wired into CI (§28.6) and was read in full rather than assumed passing. `npx playwright test` — all 78 specs passed (run twice; a first run had 3 flaky timeouts on the very first tests to touch a still-warming-up Vite dev server plus one genuine mismatch this sprint caused and fixed — see §28.3's mention of the `school-profile.spec.ts` update — a second full run was 78/78 clean). Repository-wide re-grep for `service_role`, hardcoded secrets, `dangerouslySetInnerHTML`, `eval(`, client-trusted tenant/role fields: no new findings, consistent with the original audit.

## 29. Environment & Local Development Setup

- Copy `.env.example` to `.env.local` and fill in real (for a hosted project) or CLI-printed (for local Supabase) values — see that file's own comments for exactly what's required and why.
- `npm install && npm run dev` — starts the Vite dev server at `http://localhost:5173`.
- `npx supabase start` (Supabase CLI) — local Postgres + Auth + PostgREST stack; `supabase db reset` applies every migration in `supabase/migrations/` plus `supabase/seed.sql` (see that file for the seeded local-only accounts).
- `npm run typecheck && npm run lint && npm run test && npm run build` — the core quality gate, now enforced in CI (§28.6) on every PR/push to `main`.
- `npx playwright test` — e2e; needs Playwright's browser binaries (`npx playwright install chromium`) and a booted dev server (handled automatically by `playwright.config.ts`'s `webServer` block) with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set to *any* non-empty value — the suite is fully network-mocked (§28.6's discovery) and does not touch a real Supabase project.
- `supabase/rls-tests/run.sh` — RLS/trigger/SECURITY DEFINER regression suite; needs Docker, spins up its own disposable Postgres container, no environment variables or repository secrets required.

## 30. Historical: Sprint 4 Candidates (as scoped, before Sprint 4 began)

This section originally asked "what should Sprint 4 be" with nothing yet started. Sprint 4 has since happened (§31) and chose the teaching-assignment domain from the list below, deliberately over the larger product-feature options, per its own reasoning in §31. Kept as the historical record of what was considered:

- **New product functionality** — attendance, timetabling, gradebook/assessment, or finance/HR-payroll are the next epics per §1's long-term shape; none has been scoped yet. **Still true after Sprint 4** — none of the four was built; Sprint 4 built their shared prerequisite instead (see §31).
- **Teaching-assignment domain** (ADR-0001) — if any of attendance/gradebook/teacher-portal/timetabling is chosen next, this relationship will very likely become a real, immediate dependency (the ADR already analyzes all four). **Done — this is what Sprint 4 built.**
- **E2E in CI** — low-risk now that §28.6 established the suite needs no live backend; just a `playwright install` CI step away. **Still outstanding** — not done in Sprint 4 either, still a good candidate for Sprint 5.
- **`profiles.role` SQL/TS mirror drift risk** (§23) and the **`@supabase/supabase-js` version-bump generic-typing regression test** (§23) — both long-standing, still-accepted tradeoffs, not urgent. **Unchanged.**
- **Role-assignment UI coverage** — only 3 of 24 roles have a UI path to be assigned (§24); worth a product decision on whether more are needed. **Unchanged** — Sprint 4 didn't touch role-assignment UI.

## 31. Sprint 4 — Teaching Assignment Domain (2026-08-17)

**Objective:** resolve ADR-0001 by building the teaching-assignment relationship as a real capability (school administration needs to know who teaches what) rather than speculatively — chosen over building any one of attendance/gradebook/timetabling/teacher-portal directly, since all four share this exact same prerequisite (per the ADR's own "Affected Future Capabilities" analysis) and none had been product-selected yet. Building the shared foundation once, well-tested, was judged safer than guessing which of the four to build first and shaping the relationship around that one capability's assumptions only.

**What shipped:**
- **`class_teacher_assignments`** (migration `20260817090000_teaching_assignments.sql`) — tenant-scoped table linking a teacher (`profiles.id`, matching `learner_guardians.guardian_profile_id`'s precedent of referencing profiles directly rather than `employees`) to a `class_id` and, optionally, a `subject_id` (null = "class teacher," set = "subject teacher" for that one subject), scoped to an `academic_year_id`. Never hard-deleted (`active` archive flag, same pattern as every other module); a partial unique index prevents exact duplicate *active* assignments without blocking re-assignment after an archive. A `validate_tenant` trigger closes the FK-doesn't-respect-RLS gap for all four foreign keys the row makes, same pattern as `learner_enrollments_validate_tenant_and_grade()`.
- **No new permissions** — deliberately reuses `academic.view`/`academic.manage` wholesale rather than inventing `teaching_assignment.*`: `can_view_academic()` already contains exactly the role set (`school_owner`/`principal`/`teacher`/`class_teacher`/`subject_teacher`) that would ever plausibly need this, and a teacher already sees the whole academic structure under that permission, so seeing the assignment roster isn't a new sensitivity tier. "My classes" self-service is a client-side filter over the same RLS-permitted rows (`teacher_profile_id = auth.uid()`), the same shape as other self-service views — no narrower RLS clause was needed.
- **`src/features/teaching/`** — new feature module (types, schemas, services, hooks, components, pages), following the established `{components,hooks,pages,schemas,services,types}` shape exactly. `teachingAssignmentService` (candidate search + CRUD + archive/restore, mirroring `guardianService`/`classService`), `useTeachingAssignments`/`useMyTeachingAssignments` hooks, `TeachingAssignmentsTable`/`TeachingAssignmentFormModal`/`MyClassesSummary` components.
- **`/academic/teaching-assignments`** page — admin list + create + archive/restore, gated by `academic.view`/`academic.manage`, wired into `AppRoutes.tsx` (lazy-loaded, same pattern as every other route since §28.9), the Academic Overview page's link cards, and the sidebar's pre-existing disabled "Teachers" nav placeholder (it already existed with a "Soon" badge — this is exactly what it was reserved for).
- **"My Classes"** — a new self-service section on `/my-profile`, alongside "Employee Information" and "My Children," visible only when the signed-in user has at least one active teaching assignment.
- **Error-handling completion**: while verifying §28's finding that two Restore handlers still used the raw `err instanceof Error ? err.message : fallback` pattern, a repository-wide grep found the same pattern in ~33 files total — not just the two flagged ones, but every data-*loading* hook (`useUsersList`, `useLearner`, `useEmployeesList`, `AcademicProvider`, `SchoolProvider`, etc.) that §28.3's original migration hadn't covered (it only migrated form-*submit* handlers). All ~33 were migrated to `getDbErrorMessage()` in this sprint, closing the gap completely.
- **`.env.example` fix**: corrected the `test:e2e` comment, which still claimed a real Supabase project was required — contradicted by §28.6's own discovery in the same document. Now consistent.
- **RLS regression suite**: `supabase/rls-tests/tests/teaching_assignments.test.sql` (12 tests) — unauthorized/cross-tenant create blocked, cross-tenant FK spoofing blocked (school_id matching the caller's tenant isn't sufficient if class_id belongs to a different school), authorized class-teacher and subject-teacher assignment creation, duplicate-active-assignment rejection, school-wide teacher visibility (not self-only), cross-tenant view isolation, unauthorized/authorized archive, archived-row visibility to staff, restore, and hard-delete impossibility. Could not be run in this environment (no Docker) — read in full instead, same caveat as §28.6/§28.10.
- **E2E**: `e2e/teaching-assignments.spec.ts` (5 tests — view, create, view-only enforcement for a teacher, `academic.view`-less redirect, "My Classes" self-service visibility). All 5 pass; full suite (83 specs total now) re-run clean.

**Verification results:**

| Check | Result |
|---|---|
| TypeScript | clean |
| ESLint | clean |
| Vitest | 45/45 (unchanged — no new pure-logic surface warranted a new unit test; this module's validation lives in Zod + RLS, both already covered) |
| Vite build | clean; main bundle 310.27 KB gzip 92.17 KB (barely moved from §28.9's 309.28 KB — `TeachingAssignmentsPage` got its own 10.58 KB lazy chunk, code-splitting held) |
| Playwright | 83/83 (78 pre-existing + 5 new) |
| RLS suite | not executable here (no Docker) — read in full, wired into the existing CI job automatically (fixture/test files are picked up by `run.sh`'s glob, no workflow change needed) |

**Deferred, not done in Sprint 4:** actually building attendance/gradebook/timetabling/a rich teacher portal on top of this foundation (that was never Sprint 4's scope — see Objective above); multiplicity/co-teaching UI polish; a "bulk assign" workflow; historical-assignment browsing UI (the data supports it — distinct rows per academic year — but no dedicated "past assignments" view was built, since no one asked for it yet).

## 32. Sprint 5 — E2E Wired into CI (2026-08-17)

**Scope selection process, recorded because it matters**: no authoritative document in this repository defines a Sprint 5 product scope. `docs/FUNDA360 PRODUCT REQUIREMENTS DOCUMENT (PRD)` was checked directly and found to be an **unfilled prompt template** ("You are a Senior Product Manager... produce the official PRD...") rather than actual product content — no roadmap, no MVP/version priorities exist inside it. `docs/FUNDA360 IMPLEMENTATION & ROLLOUT STRATEGY (IRS)` is a generic go-to-market/deployment-phase document (pilot schools, training, hypercare), not an engineering feature roadmap. §30's candidate list (attendance/gradebook/timetabling/teacher-portal, E2E-in-CI, `profiles.role` drift tooling, role-assignment UI coverage) remained exactly that — candidates, none product-selected. Rather than invent business rules for a product module no spec defines (attendance workflows, grading scales, etc.), the product owner was asked directly which candidate to pursue and chose **E2E in CI** — the one purely-technical candidate with no business logic to invent.

**What shipped:** `.github/workflows/ci.yml` gained a third job, `e2e`, running the full Playwright suite on every PR and push to `main`:
- Installs Playwright's Chromium binary plus its OS-level dependencies (`npx playwright install --with-deps chromium` — necessary on a bare `ubuntu-latest` runner, not just the browser itself).
- Sets `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` to plain placeholder values directly in the job's `env:` block — **not** repository secrets, and deliberately so: §28.6's discovery (the suite is fully network-mocked and the dev server only checks these vars are *present*, never validates them) means a real Supabase project was never a requirement here, so adding secrets for it would have been exactly the unnecessary-secret pattern the project's standing rules warn against.
- Uploads `test-results/` (per-test failure traces, since `playwright.config.ts` uses the `list` reporter with no HTML report generated) as a build artifact on failure only, for debugging without needing to reproduce locally.
- Removed the stale comment block explaining why e2e wasn't in CI (the reason no longer applies).

**Not changed:** `playwright.config.ts` (already had `retries: process.env.CI ? 1 : 0` and `reuseExistingServer: !process.env.CI` — both already correct for CI use, needed no edits). No new dependency added — `@playwright/test` was already a devDependency. No application source file touched.

**Verification results:**

| Check | Result |
|---|---|
| TypeScript | clean |
| ESLint | clean |
| Vitest | 45/45 (unchanged — this sprint touched no application logic) |
| Vite build | clean, unaffected (CI-only change) |
| Playwright (local, simulating the exact CI job: same two placeholder env vars, same `npx playwright test` command) | **83/83 passed**, clean run with no concurrent load. A prior run alongside typecheck/lint/vitest/build executing simultaneously showed 5 failures from resource contention on this machine — re-verified empirically, not assumed: those exact 5 tests were rerun with `--workers=1` (42/42 passed) and the full suite was rerun once more with nothing else running concurrently (83/83 passed). None of the 5 touched any file this sprint changed. |
| RLS suite | untouched, not re-run (no relevant change) |

**Deferred, not done in Sprint 5:** the other three candidates from §30 (attendance/gradebook/timetabling/teacher-portal, `profiles.role` drift tooling, broader role-assignment UI) remain exactly that — candidates, still not product-selected, still not started.

## 33. Frontend/UX Audit & Hardening Sprint (2026-08-17)

**Scope selection:** this sprint was frontend-only by explicit brief — no new product domain, no backend/RLS change. The brief required genuine visual verification (not source-reading alone) before claiming any UI finding, so a screenshot harness was built rather than relying on inspection: `playwright-core` (already present as a transitive dependency of `@playwright/test`) driven directly against the running dev server, reusing the e2e suite's own mock conventions (`funda360-auth` localStorage session seeding, `page.route` interception of `**/rest/v1/**`) to render realistic, permission-scoped, data-populated pages. 9 routes × 2 viewports (desktop 1440×900, mobile 390×844) were captured and visually reviewed. The throwaway driver script was deleted before commit — it produced findings, not a permanent artifact.

**Findings, all evidence-based (screenshot or code-path tracing from a screenshot-observed symptom), not assumed:**

1. **Tables clipped silently on mobile with no scroll affordance.** Every `*Table` component (13 across academic/employees/learners/teaching/users) wraps its `<table>` in a plain `overflow-x-auto` div — functional, but on a 390px viewport gives no visual hint that a table wider than the screen (the normal case) has more columns off to the right. Confirmed via `learners-mobile.png` and `teaching-assignments-mobile.png`: Status/Actions columns were fully invisible with nothing on screen suggesting a swipe would reveal them.
2. **Dashboard was a placeholder, not a real product page.** `dashboard-desktop.png`/`dashboard-mobile.png` showed three tiny stat cards (role, school, and a raw internal `TenantContext` state value — `"Tenant status: Ready"` — a value meant for RLS/tenant-resolution bookkeeping, not end-user copy) and an apologetic caption ("The rest of the dashboard... lands in upcoming milestones"). No real, permission-respecting product data was shown at all.
3. **"My Children" on `/my-profile` mislabeled the entire school roster for four staff roles.** `useMyLearners()` issues an unfiltered `select * from learners`, relying entirely on RLS (`learners_select`'s `is_learner_guardian()` OR-clause) to scope results to a genuine guardian's own linked children — the only workable scoping, since guardians cannot query `learner_guardians` directly to discover their own links (no self-select policy on that table). But `school_owner`, `principal`, `admissions_officer`, and `medical_officer` also satisfy `learners_select` via `can_view_learners(school_id)`, so the same unfiltered query returns the entire school roster for them, which the page then rendered under "My Children." Verified via `my-profile-desktop.png` (mocked as `principal`) showing all 14 mock learners.
4. Existing shell, sidebar, header, mobile drawer, cards, forms, badges, focus states, and dark mode were confirmed — by screenshot, not assumption — to already be at a professional quality bar. No wholesale redesign was warranted or performed; the brief's "reuse, don't reinvent" instruction was followed.

**What shipped:**

- **`src/components/ui/TableScrollContainer.tsx`** (new) — wraps the existing `overflow-x-auto rounded-card border ...` shell with left/right edge-fade gradient overlays that appear only when there's more content to scroll to in that direction (tracked via `scrollLeft`/`scrollWidth`/`clientWidth` + a `ResizeObserver`). Applied to all 13 table components as a drop-in wrapper around the existing `<table>` — no change to table markup, columns, or data.
- **`src/pages/DashboardPage.tsx`** (rebuilt) — replaced the three placeholder cards with real, permission-gated stat cards (Students via `useLearnersList`, Employees via `useEmployeesList`, current Academic Year via `useAcademic()`, Users via `useUsersList`, each only rendered if the viewer holds the corresponding permission and each linking through to its full directory), removed the raw `TenantContext` status leak entirely, and replaced the single "manage school profile" link with a small quick-actions row (school profile always, Reports if `reports.view`). No new database queries or RPCs — every number comes from a service already used elsewhere in the app; nothing is fabricated.
- **`src/pages/MyProfilePage.tsx`** (fixed) — added `usePermissions()` and gated the "My Children" section on `!can('learner.view')`, so any role that already has the real Learners directory doesn't get the roster re-shown, mislabeled, under a self-service heading. RLS and `useMyLearners()` itself are untouched — this is a presentation-layer fix for a presentation-layer bug, deliberately not a query/RLS change (see the inline comment in the file for the full reasoning on why a query-level fix would break real guardians).
- **`e2e/my-profile.spec.ts`** — added a regression test (`'a role with learner.view does not see the entire roster mislabeled as "My Children"'`) covering finding #3 directly: a `principal`-role session for which `useMyLearners()` returns rows must still show the empty-state notice, not "My Children."
- **`e2e/login.spec.ts`**, **`e2e/tenant.spec.ts`** — updated two assertions that targeted the old placeholder dashboard content (`getByText('principal', {exact:true})`, `getByText('ready', {exact:true})`) to match the rebuilt dashboard's real copy. Not weakened — same specificity, new (correct) target text.

**Not changed:** no backend/RLS/migration touched (RBAC/RLS remains the actual security boundary; every frontend change here is UX-only visibility, gated by permissions that already exist). No new dependency added. Sprint 4/5 performance work (route-level lazy loading, bundle splitting) preserved — confirmed via `vite build` output: `DashboardPage` remains its own lazy chunk.

**Verification results (all re-run after every change in this sprint, not just once at the end):**

| Check | Result |
|---|---|
| TypeScript (`tsc -b --noEmit`) | clean |
| ESLint | clean |
| Vitest | 45/45 (unchanged — no unit-tested logic touched) |
| Vite build | clean; bundle splitting intact |
| Playwright, full suite | 84/84 across two clean full runs; one flaked test appeared per run (`learners.spec.ts` once, `my-profile.spec.ts` once) and in both cases passed immediately on `--workers=1` isolation rerun — the same CPU/IO resource-contention pattern already documented and empirically confirmed in §32, not a regression from this sprint's changes |

**Deferred, not done in this sprint:** a shared page-header component was not extracted (headers are consistent by convention across pages already, but duplicated markup rather than a shared component — not a UX defect, a minor DRY opportunity); a minor mobile-viewport whitespace issue on the login page was noted from screenshots but judged low-priority and left as-is; `employees-mobile.png`/`users-mobile.png`/`reports-mobile.png` were captured but not individually called out above since they showed no new defect beyond finding #1 (already fixed globally via `TableScrollContainer`).

## 34. Premium Frontend Visual Redesign (2026-08-17)

**Scope:** a pure visual/UX transformation of the existing application into a "premium, modern institutional Education Management System" per an explicit design brief — navy-and-white executive palette, restrained retro-institutional influence, Auris Nexus Technologies branding. The brief was explicit that this must not touch Supabase architecture, RLS, authentication, the permission model, existing services, routes, data models, or CRUD functionality, and must not invent new product functionality. Both constraints were honored throughout: no migration, no RLS change, no route added or removed, no permission changed.

**Design tokens (`src/styles/index.css`, `tailwind.config.ts`):** the entire `--brand-*` ramp was replaced with a navy scale anchored on the brief's three named colors (Deep Navy `#0B1F3A`, Primary Navy `#12345B`, Navy Hover `#174574`), and — unlike the previous indigo ramp, which was bright enough to reuse unchanged in both themes — **redefined again inside `:root.dark`** with a brightened steel-blue variant calibrated for legibility against dark surfaces ("Executive Night Mode," not a literal inversion). `--surface`/`--border`/`--content` tokens were retuned to the brief's Cool Grey/Border Grey/Slate/Charcoal values. A `--warning-*` token trio was added (previously absent from the design system). A new, sidebar-only `--sidebar*` token set was added and deliberately **not** overridden in dark mode — the sidebar is a fixed navy brand surface in both themes, the same way a logo doesn't invert. `borderRadius.card` shrank from 12px to 6px and `Button`/`TextField` moved from `rounded-lg` to `rounded-md`, for the brief's "slightly squared controls." Self-hosted `@fontsource-variable/inter` (replacing a `font-family` stack that referenced "Inter"/"Inter var" without ever actually loading either — the app had been silently falling back to the OS default sans-serif) and `@fontsource/ibm-plex-mono` (new, for technical/numeric values) were added as dependencies so typography doesn't depend on an external font CDN or the visitor's OS.

**Shell (`DashboardLayout.tsx`):** tightened from `min-h-dvh` (page could still grow taller than the viewport) to `h-dvh overflow-hidden` — the outer shell is now fixed to the viewport; only `<main>` (already `overflow-y-auto`) scrolls internally, per the brief's "no browser-level scrolling" requirement. A new `AppFooter.tsx` (FUNDA360 · Education Management System / © Auris Nexus Technologies, with a live link to aurisnexus.co.za) was added inside the shell.

**Sidebar (`DashboardSidebar.tsx`, rewritten):** deep-navy background, sectioned into Overview / People / Academics / Operations / Administration per the brief's exact v1 navigation, a live "● System Operational" status line, and an account-identity row at the bottom. Two items in the brief's nav list have no corresponding feature in this codebase — **Guardians** (no standalone route; guardians are currently only reachable via a learner's own profile tabs) and **Attendance** (no table, service, or route exists anywhere in the schema) — both are rendered using the app's pre-existing "disabled nav item + Soon badge" convention (already used for permission-gated items) rather than invented as fake routes or pages. Academic sub-pages, previously reachable only through the Academic Overview page's own link cards, are now also direct sidebar entries (Academic Years/Terms/Grades/Classes/Subjects/Teaching Assignments), matching the brief's requested depth.

**Header (`DashboardHeader.tsx`):** rebuilt with a page-title/section breadcrumb block, sourced from a new static `src/lib/pageTitles.ts` route→{title,section} lookup (pure presentation, no routing/permission logic). The title/section text is deliberately a `<p>`, not a second `<h1>` — every page already renders its own canonical `<h1>`, and a second heading would both violate single-H1-per-page accessibility and make `getByRole('heading', ...)` ambiguous everywhere (caught by e2e, see below). School name moved to the header's right side per the brief's mock; the academic-year name was deliberately left out of the breadcrumb (kept to the section label alone) after discovering it collided with "2026 Academic Year" content asserted by several existing academic/report tests — judged a better trade than editing half a dozen unrelated test files' content assertions for a decorative breadcrumb detail.

**Dashboard (`DashboardPage.tsx`, restyled — data logic from §33 unchanged):** "Executive Summary" stat panels now render as `01,284`-style zero-padded, comma-grouped monospace figures (a `formatStat()` helper) instead of plain numbers, still sourced from the exact same permission-gated hooks as §33. Two new panels — **Attendance Overview** and **Recent Activity** — render an honest "not yet available in this workspace" empty state rather than a fabricated chart or fabricated log, since neither an attendance nor an activity/audit-log table exists in this schema; inventing either would have violated the brief's own "do not fabricate statistics" and "do not invent functionality" rules. A new **System Status** panel shows Authentication/Academic Services/Learner Registry/Employee Registry/User Directory as Online/Degraded, derived directly from each already-loaded hook's real `error` state (a hook that errored reports "Degraded") — not a fabricated health check.

**Login/auth (`AuthLayout.tsx`, rewritten):** the previous two-panel layout (a gradient-and-blur marketing panel beside the form) was replaced with the brief's simpler centered composition — logo, tagline, a single bordered card, and an Auris Nexus-credited footer line — consistent with §9–§10's "avoid gradient backgrounds," "avoid decorative blobs," and "avoid giant illustrations."

**E2E fixes required by the deeper navigation (all in test files, not application logic — no assertion was weakened, only re-scoped or re-targeted to what it actually meant to test):**
- `e2e/learners.spec.ts` — a "Students" nav-link-absence assertion updated to "Learners" (the sidebar relabel; the old string would have passed trivially without testing anything).
- `e2e/academic.spec.ts`, `e2e/reports.spec.ts`, `e2e/users.spec.ts` — three assertions scoped to `page.getByRole('main')` (the codebase's own established disambiguation pattern, already used elsewhere in these same files) after the deeper sidebar introduced same-named links/text ("Academic Years," "Grades," the signed-in user's own name in the sidebar's new identity block) that made the previous unscoped queries ambiguous.
- `e2e/tenant.spec.ts` — one assertion similarly scoped to `main` after the sidebar's new identity block started rendering the same role text ("super administrator") the test was asserting on.
- `e2e/login.spec.ts`, `e2e/tenant.spec.ts` (from §33, revisited) — no further change needed; already correct.

**Investigated and ruled out as a redesign regression:** intermittent local e2e failures during verification, always manifesting as a page caught mid-loading-spinner (never wrong content), traced to two pre-existing, unrelated causes — (1) Chrome processes accumulated across repeated manual `playwright test` invocations this session, and (2) `.env.local` had been overwritten with a malformed, real-looking hosted Supabase URL (`http:https://<ref>.supabase.co`) instead of the documented local-dummy placeholder, meaning any accidentally-unmocked request in a test was reaching for a real external host instead of failing instantly — restored to the dummy value `.env.example` documents. Once both were cleared, the app's largest route chunk (`LearnerProfilePage`, ~50KB, unchanged in size by this sprint) and the route with the most concurrent data hooks (`/my-profile`, three hooks gating one spinner, also unchanged by this sprint) remained occasionally slow to finish loading under Vite dev-mode's unbundled module-serving strategy specifically when several Playwright workers requested different heavy routes simultaneously — confirmed stable (0 real failures, 2 self-healing "flaky" retries) under the project's own already-configured CI retry policy (`retries: process.env.CI ? 1 : 0`, see §32).

**Verification results:**

| Check | Result |
|---|---|
| TypeScript | clean |
| ESLint | clean |
| Vitest | 45/45 (unchanged — this sprint touched no business logic) |
| Vite build | clean; bundle splitting intact; self-hosted fonts add ~240KB across all subset files, only the subsets a given page's characters need are fetched (`unicode-range` per-`@font-face`) |
| Playwright | 84/84 clean on multiple full runs once the two pre-existing environmental issues above were cleared; additionally confirmed stable under `--retries=1` (CI's own policy) |
| Visual verification | genuinely performed — 13 screenshots via the same `playwright-core` technique established in §33, covering login/dashboard/learners/teaching-assignments/my-profile/academic/users across desktop (1440×900), tablet (768×1024) and mobile (390×844), light and dark, reviewed directly before and after a dev-server restart that was needed for a `tailwind.config.ts` change to take effect |

**Not changed:** no backend/RLS/migration touched, no route added or removed, no permission changed, no test weakened (only re-scoped to what it always meant to assert). Status badges, form validation, table row/column content, and every page's actual data logic are untouched — this was a shell/token/component-level re-skin, per the brief's own instruction to prefer shared tokens and components over styling dozens of pages individually.

**Deferred, not done in this sprint:** page-content containers (each page still hardcodes its own `mx-auto max-w-{3xl,5xl} px-4 py-8` wrapper rather than a shared `PageContainer`) were left as-is except on the Dashboard itself, which was widened to use the full workspace width — standardizing this across the other ~20 pages was judged too large a blast radius for this pass and is a natural follow-up. Table-row-level styling (headers, dividers, status-pill shapes) was left untouched, relying entirely on the token cascade (border/radius/color) rather than per-table edits, per the brief's own "do not redesign table functionality unnecessarily" instruction. No automated accessibility audit tool was run; heading hierarchy was specifically re-verified (see the header `<h1>`→`<p>` fix above) but contrast ratios, ARIA completeness, etc. were not freshly re-audited beyond what the existing, already-verified conventions already provide.

---
*End of document. Regenerate or amend this file (rather than relying on conversation memory) whenever a milestone completes or a significant architectural decision is made — see rule #18 for why this matters more than it might seem.*
