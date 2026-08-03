# Funda360 — Session Handover

Written to survive a context reset. Read this fully before doing anything else.
Delete this file once Sprint 2 Milestone 1 is committed (it's a scratch handover note, not permanent project documentation — permanent specs live in `docs/`).

## Where we are

**Sprint 1 is complete and committed** (5 milestones, each its own commit on `main`):
1. Login page (React+TS+Vite+Tailwind, no auth wiring)
2. Enterprise Supabase Authentication (session persistence, AuthContext, protected/public routes, password reset, email verification)
3. Multi-Tenant Architecture + RBAC Foundation (RLS, `profiles`/`schools`, role hierarchy, permission matrix)
4. School Administration Core (`/school/profile` page, `schools` write access)
5. User & Role Management (`/users`, `/users/:id`, admin-create-user, role assignment) — commit `59886c3 feat(users): implement enterprise user and role management`

**Now starting: Sprint 2 — Milestone 1: Academic Structure.** The full brief the user gave is reproduced verbatim at the bottom of this document. Nothing has been implemented yet for this milestone — I was still in the *research/context-gathering* phase (reading existing conventions) when the reset happened. **No files for this milestone have been created or edited yet.**

Working tree note: `git status` at last check showed some uncommitted/untracked items from *before* this session started (`src/features/profile/services/profileService.ts`, `src/lib/database.types.ts`, `src/types/profile.types.ts` modified; `src/components/ui/Modal.tsx`, `src/features/users/`, the M5 migration untracked) — these are actually the Milestone 5 work and **should already be committed** as of `59886c3`. Run `git status` and `git log --oneline -6` first to confirm the repo state matches this document before assuming anything.

## Mandatory architectural conventions (do not deviate)

Confirmed by reading the actual source — not assumptions:

### Feature module shape
`src/features/<name>/{components,context,hooks,pages,schemas,services,types,utils}` — see `src/features/users/` and `src/features/school/` as the two reference implementations. Academic should mirror `school`'s Provider/Context/hook pattern (`SchoolProvider.tsx`, `schoolContext.ts`, `useSchool.ts`) for `AcademicProvider`.

### Database types (`src/lib/database.types.ts`)
- Hand-maintained mirror of what `supabase gen types typescript` would produce.
- **Row/Insert/Update MUST be `type` aliases, never `interface`** — postgrest-js's generic inference silently degrades to `any`/`never` with `interface` (verified in Milestone 3, documented in the file's header comment). This is the single most important gotcha to not re-break.
- Add new tables to the `Database.public.Tables` map; add new RPCs to `Database.public.Functions` with typed `Args`/`Returns` — see `admin_create_user`/`admin_update_user_role` for the pattern `.rpc<FnName, Fn>()` needs.

### RBAC (`src/features/rbac/`)
- `Permission` is a closed union in `types/permission.types.ts` — currently: `school.view | school.manage | tenant.switch | profile.view_own | profile.update_own | profile.view_any | profile.manage_any`. **Sprint 2 M1 will need new permissions**, something like `academic.view` / `academic.manage` (brief says: School Administrator = full access, Principal = manage, Teacher = read-only, others = none — this maps cleanly to a view/manage split, matching the existing `school.view`/`school.manage` pattern).
- `ROLE_PERMISSIONS` (`constants/rolePermissions.ts`) is a `Record<UserRole, readonly Permission[]>` — every one of the 24 roles must get an entry (even if empty array) when the `Permission` union grows, or TS will error.
- `ROLE_RANK` (`constants/roleHierarchy.ts`) + `isAtLeast()` — approximate seniority ordering, reuse for any "can manage this specific record" checks (mirrors what `userPermissions.ts` does with `canManageUser`).
- `hasPermission(role, permission)` in `utils/permissionHelpers.ts` is the actual gate everywhere — client-side convenience only, **not the real security boundary** (RLS/SQL functions are).
- Export additions through `src/features/rbac/index.ts`.

### RLS / SQL pattern (see all 5 existing migrations in `supabase/migrations/`)
- `current_tenant_id()` (SECURITY DEFINER, resolves caller's tenant from `profiles`) — reuse this for every new tenant-scoped table's policies, don't re-derive.
- `is_platform_admin()` — reads JWT `app_metadata.role` directly, bypasses tenant scoping.
- Tenant-scoped tables get `enable row level security` **and** `force row level security` (the latter is easy to forget and defeats the purpose if omitted for the table owner).
- Every write-permission SQL function (e.g. `can_manage_school(target_school_id)`) has a comment cross-referencing the exact TS permission it mirrors, with an explicit "keep in sync manually" note — do the same for `can_manage_academic_structure(school_id)` or equivalent.
- `set_updated_at()` trigger function already exists (created in the first migration) — reuse it for `updated_at` maintenance on every new table, don't redefine it.
- **Column-level `GRANT` alone does not block a column write** in real Supabase — `authenticated` gets blanket table grants by default. If any column needs write-protection beyond RLS row-scoping (not obviously needed for academic structure, but keep in mind for "only one active academic year" enforcement), a `BEFORE UPDATE` trigger checking a transaction-local `set_config` flag is the real mechanism (see `prevent_direct_role_change()` in the M5 migration for the exact pattern).
- **"Only one active academic year per school"** — implement as a partial unique index: `create unique index academic_years_one_active_per_school on public.academic_years (school_id) where is_active;` — this is the idiomatic Postgres way and avoids trigger complexity. `setActiveAcademicYear()` service call should flip the old active row to false and the new one to true in a single RPC (SECURITY DEFINER, wrapped in one transaction) so the partial unique index is never transiently violated — a plain two-step client-side update would race/violate the constraint. Model this RPC after `admin_update_user_role`.

### Testing pattern
- Docker-based Postgres harness (postgres:16-alpine + hand-rolled `auth` schema stub) was used to verify every migration's RLS/trigger/RPC behavior in Milestones 3–5 before writing any app code against it — re-use this harness approach for the academic tables (one active year per school, tenant isolation, permission gating) rather than trusting untested SQL.
- Playwright e2e: **full network mocking**, no real backend — see `e2e/utils/mockAuth.ts` (`seedAuthenticatedSession`, `installAuthMocks`, `fulfillJson`) and `e2e/utils/mockData.ts` (`installDataMocks`, `installUsersListMock`, `installRpcMock`). Extend `mockData.ts` with academic-table builders/mocks rather than duplicating the pattern in the new spec file.
- **Known CORS gotcha**: `Content-Range` is not browser-safelisted — any paginated-list mock needs `'access-control-expose-headers': 'content-range'` in the mocked response headers or supabase-js silently can't read the count back. Already documented in `mockData.ts`; remember it if Academic Years/Classes/Subjects get paginated list views.
- List-query mocks are detected via `url.searchParams.has('limit') || url.searchParams.has('offset')`, **not** a `Range` header — this postgrest-js version doesn't send one.

### Route guards
`src/routes/RequirePermission.tsx` — generic `<Route element={<RequirePermission permission="x.y" />}>` wrapper, redirects to `/dashboard` if `hasPermission` fails. Reuse directly for `/academic/*` routes; no new guard component needed.

### Sidebar nav
`src/components/layout/DashboardSidebar.tsx` conditionally includes nav items via `hasPermission(user?.role ?? null, permission)` spread into the `navItems` array (see how `Users` was added). "Students"/"Teachers"/"Reports"/"Settings" are currently inert placeholder items with a "Soon" badge — Academic doesn't have a placeholder yet, will need a new real entry (or possibly repurpose "Students"? — brief doesn't say, use judgment, probably add a new "Academic" item since it's grades/classes/subjects/years, distinct from a future "Students" roster feature).

### UI primitives already available — reuse, don't rebuild
`src/components/ui/Modal.tsx` (accessible dialog: focus trap, Escape, backdrop, portal), `Button`, `TextField`, icons in `src/components/ui/icons.tsx` (add new ones there, don't inline SVGs).

### Tooling gotcha
The `Write` tool's PreToolUse hook has intermittently timed out on larger files in this session (happened 3-4 times across Milestones 3-5). If `Write` times out repeatedly on a file, fall back to `Bash` with a heredoc (`cat > file << 'EOF' ... EOF`), which worked reliably every time it was tried.

## Suggested execution order for Sprint 2 Milestone 1

1. Design the migration (`supabase/migrations/<timestamp>_academic_structure.sql`): 5 tables (`academic_years`, `terms`, `grades`, `classes`, `subjects`), enums if useful, indexes, RLS policies (reuse `current_tenant_id()`/`is_platform_admin()`), the one-active-year partial unique index, a `set_active_academic_year(p_academic_year_id)` SECURITY DEFINER RPC, `can_manage_academic_structure(target_school_id)` SQL function mirroring the new `academic.manage` permission, triggers for `updated_at` (reuse `set_updated_at()`).
2. Verify the migration in the Docker harness (extend the existing harness scripts/pattern from M3-M5) before writing any TS against it.
3. Extend `Permission` union + `ROLE_PERMISSIONS` (all 24 roles) with `academic.view`/`academic.manage`.
4. Extend `database.types.ts` with the 5 new Row/Insert/Update types + the new RPC signature(s).
5. Build `src/features/academic/` — types, services (typed CRUD per entity + `setActiveAcademicYear`), `AcademicProvider`/`academicContext`/`useAcademic` (current year, years list, loading, refresh), Zod schemas (dates, required fields, capacity, name uniqueness where sensible), components, the 5 pages + an `/academic` index/landing page.
6. Wire routing (`AppRoutes.tsx`, wrapped in `RequirePermission permission="academic.view"`) and sidebar nav.
7. `e2e/academic.spec.ts` covering the 7 checklist items from the brief; extend `mockData.ts` with academic builders/mocks.
8. Quality gate: `npm run lint`, `npm run test`, `npm run build`, grep for TODO/FIXME, run Playwright at least twice.
9. Commit exactly as instructed: `git add .` then `git commit -m "feat(academic): implement Sprint 2 Milestone 1 - academic structure"`.
10. Deliver the Final Delivery Report the brief asks for (files created/modified, migrations, security summary, test summary, architectural decisions, Sprint 2 M2 recommendations).

## The exact brief (verbatim, for reference)

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
