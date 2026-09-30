# Funda360 — working notes for Claude sessions

Multi-tenant South African school-management SaaS. React 18 + TypeScript + Vite + Tailwind frontend (GitHub Pages, `funda360.aurisnexus.co.za`), Supabase backend (Postgres + RLS, Auth, Storage, Edge Functions). Hosted project: `rzkybmkzhpwovpvrjkxk` ("Funda360", eu-central-1).

**Resume here after a context reset:** read this file, then `git log --oneline -15`, then the "Status" section below.

## Commands

| Check                        | Command                                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck                    | `npm run typecheck` (also type-checks `e2e/`)                                                                                                                                                                                                                                   |
| Lint                         | `npm run lint`                                                                                                                                                                                                                                                                  |
| Unit tests                   | `npm test` (vitest, no network)                                                                                                                                                                                                                                                 |
| Build                        | `VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`                                                                                                                                                                                                |
| RLS / SECURITY DEFINER suite | `supabase/rls-tests/run.sh` (needs Docker; start `dockerd &` in a fresh container)                                                                                                                                                                                              |
| E2E                          | `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=x npx playwright test`. Fully network-mocked. In this cloud sandbox the pinned Playwright browser build is missing: use a scratch config that sets `launchOptions.executablePath: '/opt/pw-browsers/chromium'` |
| Edge Functions               | `cd supabase/functions && deno check … && deno lint && deno test --allow-env --allow-net _shared/providers/providers.test.ts` (see `.github/workflows/ci.yml`)                                                                                                                  |

Prettier is **not** enforced: about 430 legacy files are unformatted. Format only the files you touch.

## Architecture rules (keep them)

- **Authorization lives in the database.** Every table has RLS **forced**. Writes to sensitive tables go through `SECURITY DEFINER` RPCs that call `write_audit_log`. Frontend guards (`RequirePermission`, `ROLE_PERMISSIONS`) are UX only.
- Tenant = `profiles.tenant_id` via `current_tenant_id()` (active profiles only). Role currently comes from `auth.jwt()->'app_metadata'->>'role'`. `operations_role_allowed()` reads `profiles.role` instead (a known inconsistency).
- New `SECURITY DEFINER` functions: pin `set search_path = public`, `revoke execute … from public, anon`, and grant to `authenticated` only when the client calls them. `alter default privileges in schema public revoke … from public` does **not** work (per-schema defaults cannot remove global ones). Revoke per function.
- A migration version must be unique: CI fails on duplicates.
- `src/lib/database.types.ts` is **hand-maintained**. Add new tables and RPCs there.
- RLS test style: `do $$ … call test_util.record(name, passed, detail) … $$`. **No subqueries inside CALL arguments** (compute into variables first). Impersonate with `set_config('request.jwt.claims', test_util.jwt_claims(uid, role, tenant), true)` + `set local role authenticated`.
- `supabase/seed.sql` generates a random password per run and aborts on databases with non-demo users. Never reintroduce a fixed password: the repo is **public**.

## Status (2026-09-30)

Done and pushed on branch `ccr-3b8a9155-845trs` (not yet merged to `main`):

1. Audit (`/tmp` scratchpad report). Critical fixes: seed password removed, duplicate migration renamed to `20260919090001`, `20260930090000_revoke_public_worker_execute`, CI `migrate` job + duplicate-version check.
2. Production: all 703 accounts that used the published demo password were rotated to random passwords and their sessions revoked (2026-09-30).
3. Compliance framework (POPIA/FERPA/COPPA/CIPA/GDPR): `20260930100000_compliance_framework.sql`, `src/features/compliance/`, `/compliance` Trust Center, `/parent/privacy`, `/learner/privacy`, `/trust`, consent onboarding gate. See `docs/COMPLIANCE.md`.
4. Mobile: `PageContainer` gets `w-full min-w-0`, so no sideways page scroll at 375px.

5. P1-7 error boundaries and client error reporting (`src/lib/errorReporting.ts`, `src/components/ui/ErrorBoundary.tsx`).
6. P1-5 payment settlement binding (`supabase/functions/_shared/providers/binding.ts`).
7. P1-6 admissions abuse controls (`supabase/functions/_shared/admissions/guards.ts`).
8. Notification dispatcher claims rows before sending.
9. P1-2 server-side MFA + P1-4 RLS performance: `20260930110000_rls_performance_and_mfa.sql`. Evidence: 239 policies rewritten, identical fingerprints over 1,984 identity x table pairs, 100k-row `count(*)` 10.8-29.6 s -> 15-38 ms. `rls_optimize_policies()` can be re-run after any migration that adds policies (the RLS suite fails if a policy is left unoptimised).
10. P2: `20260930120000_operations_roles.sql` (5 ops roles added to `user_role`), `20260930121000_staff_provisioning_and_references.sql` (owners/HR can provision finance, vice principal, class/subject teacher, coordinator, auditor and ops logins; admission references gain a random 6-char suffix).

Last green run (2026-09-30):

- typecheck, lint and build pass;
- 282 unit tests, RLS 759/759, Deno check/lint/test 20/20;
- Playwright 230/230 (0 retries).

Local Deno: `npm install deno@2` in a scratch dir (CI uses denoland/setup-deno).

## Remaining acceptance criteria

- [x] P1-7 root error boundary + client error monitoring
- [x] P1-5 payment settlement bound to the intent's provider, mode and merchant
- [x] P1-6 admissions endpoint: rate limiting, path validation, date-of-birth-gated PII-free resume
- [x] Edge Function deno check/lint/test run locally
- [x] P2: dispatch row claiming
- [x] P1-2 server-side MFA (verified factor + aal1 => no tenant)
- [x] P1-4 RLS performance
- [x] P2 dead operations roles
- [x] P2 school owners can provision finance_manager / vice_principal / class_teacher / subject_teacher logins
- [x] P2 unguessable admission references (existing references unchanged; resume still needs date of birth)

All code-side criteria are met. What remains is applying the migrations to production (below).

## Requires a human (cannot be done from the sandbox)

1. **Apply pending migrations to production.** The auto-mode classifier blocked applying them from the agent session. Either:
   - add GitHub `github-pages` environment secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_REF=rzkybmkzhpwovpvrjkxk`, then merge to `main` (the CI `migrate` job runs `supabase db push`); or
   - explicitly approve applying them in a session.

   Production currently lacks: `20260919090001`, `20260929090000`, `20260929100000`, `20260929120000`, `20260929170000`, `20260930090000`, `20260930100000`, `20260930110000`, `20260930120000`, `20260930121000` and anything newer.

2. **Password resets.** Anyone who relied on a demo account must be re-issued a password by the platform owner.
3. **Confirm the super-admin sessions.** Sessions from 41.116.x (Android) and 102.33.32.62 (Windows) were revoked; the owner should confirm those were theirs.
4. Enable leaked-password protection in Supabase Auth settings (dashboard only).
5. Migrations may be written (approved 2026-09-30). Applying them to production still needs item 1.
