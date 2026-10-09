# Funda360 — working notes for Claude sessions

Multi-tenant South African school-management SaaS. React 18 + TypeScript + Vite + Tailwind frontend (GitHub Pages, `app.funda360.aurisnexus.co.za`), Supabase backend (Postgres + RLS, Auth, Storage, Edge Functions). Hosted project: `rzkybmkzhpwovpvrjkxk` ("Funda360", eu-central-1).

**Reporting rule (from the owner):** after completing a task, always give the report inside a single fenced code block (a copy block) so it can be copied in one go.

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

## UI rules (keep them)

- Mobile first: no page-level horizontal scroll at 320px; wide tables go inside `TableScrollContainer`.
- The scrolling page area is `<main>` (not the document), so audit `main.scrollWidth`, never only `documentElement`. Page roots need `w-full min-w-0` (use `PageContainer`); a hand-rolled `mx-auto max-w-*` container without them grows to its widest child (a long email) and pans the whole page sideways. `<main>` also clips `overflow-x` as a safety net, so the e2e guard checks content width, not scrolling. `PageHeader` stacks until `lg`.
- Icon controls are 44px (`h-11 w-11`) below `lg`; use the shared `Modal` and `MobileNavDrawer`, never hand-rolled overlays.
- Every form control needs a visible label or an `aria-label`; never placeholder-only.
- Red: use `text-danger-600` for text and `bg-danger-700` for solid fills under white text (never `bg-danger-600 text-white`: it fails contrast in dark mode).
- Charts are sized from their container (see `AttendanceTrendChart`), never a fixed-width `viewBox` scaled down.
- Links inside sentences stay underlined (global rule in `index.css`); opt out with `no-underline` only for button-styled links.

## Architecture rules (keep them)

- **Authorization lives in the database.** Every table has RLS **forced**. Writes to sensitive tables go through `SECURITY DEFINER` RPCs that call `write_audit_log`. Frontend guards (`RequirePermission`, `ROLE_PERMISSIONS`) are UX only.
- Tenant = `profiles.tenant_id` via `current_tenant_id()` (active profiles only). Role currently comes from `auth.jwt()->'app_metadata'->>'role'`. `operations_role_allowed()` reads `profiles.role` instead (a known inconsistency).
- New `SECURITY DEFINER` functions: pin `set search_path = public`, `revoke execute … from public, anon`, and grant to `authenticated` only when the client calls them. `alter default privileges in schema public revoke … from public` does **not** work (per-schema defaults cannot remove global ones). Revoke per function.
- A migration version must be unique: CI fails on duplicates.
- `src/lib/database.types.ts` is **hand-maintained**. Add new tables and RPCs there.
- Government reporting: never filter for security in the frontend; every reporting RPC must go through `reporting_resolve_schools()` / `reporting_school_ids()`. Officials have no tenant, so tenant-keyed RLS gives them nothing directly.
- RLS test style: `do $$ … call test_util.record(name, passed, detail) … $$`. **No subqueries inside CALL arguments** (compute into variables first). Impersonate with `set_config('request.jwt.claims', test_util.jwt_claims(uid, role, tenant), true)` + `set local role authenticated`.
- `supabase/seed.sql` generates a random password per run and aborts on databases with non-demo users. Never reintroduce a fixed password: the repo is **public**.

## Status (2026-10-08)

Items 1-12 are merged to `main` (PRs #7 and #8):

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

11. Launch-ready UI/UX pass (2026-09-30): shared `MobileNavDrawer` (dialog semantics, Escape, focus trap, closes on route change) used by all three shells; footer scrolls with content on phones; compact 2FA banner; headers reflow at 320-1024px (44px touch targets below `lg`, search reachable on phones, theme toggle moves into the account menu on phones); `formatStat` no longer zero-pads ("2", not "00,002"); 16px form fields on phones (stops iOS zoom); in-text links underlined; labelled every Transport/Operations control; `Modal` restores focus and no longer depends on `onClose` identity. Permanent guard: `e2e/responsive-layout.spec.ts` (overflow at 320/390/768/1280, drawer, dialogs). Evidence: 810 route x viewport layout measurements (90 routes, 9 viewports from 320x568 to 1920x1080) and 180 axe scans (WCAG 2.1 A/AA) with 0 violations; the only flagged "overlap" is the intentional show-password icon inside its field.

12. UI follow-up (2026-09-30): `AttendanceTrendChart` draws at its container's real pixel width (11px axis text at every width; it used to shrink to ~5px on phones) with y-axis labels, hover titles and a legend; `SchoolsTable` renders cards on phones (the switch action is no longer behind a sideways swipe) and a `TableScrollContainer` table from `sm`; dark-mode contrast: dark `--danger-600` is now the lighter text colour (6.3:1 on `--danger-50`, was 4.28:1) and solid red fills with white text use the new `danger-700` token; any `text-brand-600` is drawn as brand-300 in dark mode (base-layer rule), the logo wordmark has a dark variant, and `/trust` always renders light. Dark mode: 180 axe scans over all routes, 0 violations.

13. Audit 2026-10-08 (branch `claude/funda360-audit-0foiq8`): production checked read-only. All 76 migrations were applied (CI `migrate` works); 125/125 public tables have RLS forced; every RPC and table the frontend calls exists. Fixes: `20261008090000_anon_execute_and_duplicate_cron_cleanup` (no anon EXECUTE on any SECURITY DEFINER function, no caller EXECUTE on trigger functions, unschedules the duplicate `funda360-*` cron jobs that would fail daily without a JWT); CI `functions` job deploys all Edge Functions after `migrate`; deploy passes optional `vars.VITE_ERROR_REPORT_URL`; homework marking uses the shared `Modal`; 44px touch targets on invoice filters, message/timetable/operations tabs and teacher quick actions; the responsive guard now covers 10 guardian/learner routes. `admissions-public` (version 8, with the P1-6 guards) was deployed to production on 2026-10-08; the other three functions were still the 2026-09-09 build at that time.

14. Government reporting and District Dashboard (2026-10-08, same branch). `20261009090000_education_official_role` (new `education_official` role, no school tenant) and `20261009091000_government_reporting` (`education_areas` province/district/circuit hierarchy, created by platform admins only (no seeding from the demo schools' free text); `schools.education_area_id`, changeable by platform admins only; `education_official_assignments` with a separate learner-detail grant; `get_reporting_scope`, `get_government_report`, `get_school_report`, `get_class_learner_report`, `record_government_report_export` and audited admin RPCs). Scope is computed in the database (`reporting_school_ids()`): platform admins all schools, officials their areas, school owner/principal their own school. UI: `/district`, `/district/schools/:id`, `/district/schools/:id/classes/:id`, `/reports/government`, `/district/areas` (`src/features/government/`). Design and formulas: `docs/GOVERNMENT_REPORTING.md`. Performance (scratch DB, 20 schools / 6,000 learners / 240k attendance rows): full district report 0.7-0.9 s, school drill-down 30 ms. `reporting_learner_stats` must keep its LATERAL lookups; a CTE-join version took 54 s.

15. Privileged MFA hardening (2026-10-08, same branch): government reporting requires an `aal2` session for `education_official` and platform administrators (`session_is_aal2()`, `reporting_require_mfa()`, `reporting_platform_admin()`, all in `20261009091000`); `is_platform_admin()` elsewhere is unchanged. Frontend guard `RequirePrivilegedMfa`. Real-stack test `supabase/stack-tests/government-reporting.mjs` (GoTrue + PostgREST, real TOTP) 47/47. Load test unchanged by MFA (A/B in one session: 0.61-0.82 s with, 0.62-0.76 s without). Production checked read-only: schema fingerprint identical to the tested pre-PR schema; new migrations not applied yet.

16. Provincial Dashboard + Government Data & Integration API (2026-10-08, same branch). `20261009092000_provincial_dashboard_and_government_api`: school-level official assignments; `get_provincial_report` / `get_provincial_scope` / `record_provincial_report_export` (province-level access only: platform admin, official assigned to the province, or API client scoped to it); API clients (SHA-256 token hash, scope, permissions, learner grant, expiry, rate limit), append-only `government_api_requests`, `government_import_jobs` (validate -> preview -> admin commit) and `gov_api_request()` (service role only). Scope functions were extended with an `api` caller kind that only exists inside `gov_api_request()` (service-role JWT + transaction-local setting). Edge Function `government-api` (HTTP adapter). UI: `/province`, `/district/integrations`, school-level grants on `/district/areas`. Docs: `docs/PROVINCIAL_DASHBOARD.md`, `docs/GOVERNMENT_API.md`, `docs/api/government-api-v1.openapi.yaml`. New tables need `revoke all ... from anon, authenticated` first: Supabase default privileges grant everything, so column grants alone do nothing.

17. Funda AI Phase 1 foundation (2026-10-08, same branch). `20261009093000_funda_ai_foundation` (feature flags and policy, per-school switch, `ai_requests` usage/audit without content, `ai_tool_calls`, opt-in conversations, feedback; `ai_authorize_request()` policy gate run as the user; DB-counted rate limits and token budgets). Edge Function `funda-ai` (JWT verified): every tool reads through PostgREST with the caller's JWT, so RLS decides scope; service role only for the audit RPCs. Claude adapter via the official SDK (`claude-opus-5-5`, explicit effort, JSON-schema output, server-side refusal fallback enabled). Five read-only tools, code-only versioned prompt (`school_copilot` v1). Correction (audit 2026-10-09): as built, only the newest message was safeguarding-screened (history was not) and evidence matched a value anywhere in the cited output; both fixed in item 18. UI: header launcher (shown only when enabled) + panel in `src/features/ai/`. Without `ANTHROPIC_API_KEY` the gateway answers 503 `ai_provider_not_configured`. Docs: `docs/FUNDA_AI.md`. Real-stack test `supabase/stack-tests/funda-ai.mjs` (mock model API via `ANTHROPIC_BASE_URL`, after `fixtures.sql` + `funda-ai-fixtures.sql`) 50/50. No real model has been called; answer quality is unevaluated.

18. Funda AI pre-pilot hardening (2026-10-09, same branch; fixes the 2026-10-09 audit). `20261009094000_funda_ai_hardening`:
    - per-user then per-school advisory locks in `ai_authorize_request` (which now returns only allowed/reason/request_id);
    - budget reserved by `ai_start_request` (service role) and settled by `ai_complete_request` (the reservation is kept when usage is unknown);
    - `ai_recover_stale_requests` (pg_cron every minute) and `ai_purge_expired` (daily; also expires feedback);
    - separate message/history allowances; budgets never NULL (school 3M, user 500k);
    - `ai_admin_set_school` keeps unpassed settings; explicit school feature lists (empty = none);
    - blocked-attempt logging capped at 20 per user per minute.

    Gateway:
    - every history turn screened (a safeguarding signal in any turn means no model call);
    - SA ID numbers redacted; medical content blocked by default (`policy_blocked`);
    - one request deadline (`FUNDA_AI_DEADLINE_MS`, default 110 s) with an abort signal;
    - evidence must cite tool call AND field path (prompt v2); unverified numbers in the answer text withhold it; confidence capped by verified evidence.

    Real stack: 50 parallel requests vs a limit of 2 admit exactly 2 (was 11 of 20 before); 50 vs a 5-request budget run exactly 5; pg_cron was seen closing a stale request. Teacher-scope recommendation (pilot with owner/principal only) in `docs/FUNDA_AI.md` section 1; no permission changed.

19. Funda AI pre-merge audit (2026-10-09, same branch):
    - Migration renames: the three future-dated migrations (`20261010…`, `20261011…`, `20261012…`) were renamed to `20261009092000` / `093000` / `094000`, because `supabase db push` refuses local versions dated before the newest one already applied. None had been applied anywhere.
    - `20261009095000_funda_ai_pre_merge_fixes`: the budget month is the South African calendar month (`ai_month_start()`); CHECK that the reservation covers `max_output_tokens`; `ai_start_request` returns the reservation; the purge never deletes current-month rows; `ai_usage_summary` and platform-admin reads of the AI tables need `aal2`.
    - Gateway:
      - per-turn output is capped by the remaining reservation, and the loop stops with `reservation_exhausted`;
      - the SDK does not retry, and the gateway retries once itself, recording usage as unknown;
      - text is normalised (NFKC, invisible characters removed) before screening and redaction;
      - the evidence check covers number words, claims, periods and notes (prompt v3);
      - figures the user wrote themselves cap confidence at low.
    - Evaluation: `_shared/ai/eval/` (deterministic, in CI), `supabase/stack-tests/funda-ai-eval.mjs` (real provider, opt-in, synthetic only, never run). Pattern screening **caught 0 of 8** indirect safeguarding disclosures (`docs/FUNDA_AI_EVALUATION.md`).
    - Release gates: `docs/FUNDA_AI_PILOT_READINESS.md`. Verdict NOT READY.

Last green run (2026-10-09):

- typecheck, lint and build pass;
- 330 unit tests, RLS 1018/1018, real-stack 47/47 (reporting) + 34/34 (API) + 50/50 (Funda AI), Deno 62/62;
- Playwright 373/373 (0 retries; includes 5 Funda AI tests).

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

All code-side criteria are met. Merging to `main` applies new migrations (`migrate` job) and deploys Edge Functions (`functions` job, added 2026-10-08).

## Requires a human (cannot be done from the sandbox)

1. **Merge this branch to `main`** so CI applies `20261008090000` and deploys `payments-initiate`, `payments-webhook` and `notifications-dispatch` (production ran their 2026-09-09 build at the 2026-10-08 audit).
2. **Password resets.** Anyone who relied on a demo account must be re-issued a password by the platform owner.
3. **Confirm the super-admin sessions.** Sessions from 41.116.x (Android) and 102.33.32.62 (Windows) were revoked; the owner should confirm those were theirs.
4. Enable leaked-password protection in Supabase Auth settings (dashboard only). Still off at the 2026-10-08 audit.
5. **Email and login (2026-10-07):** production Site URL was `http://localhost:3000` and Auth used Supabase's built-in test mailer. Follow `docs/EMAIL_AND_LOGIN_SETUP.md` (Site URL, redirect URLs, HostAfrica SMTP, token-hash recovery template, email rate limit). The app accepts `?token_hash=…&type=…` links (`src/features/auth/utils/emailLink.ts`) so reset and guardian-activation links work on any device. At the 2026-10-08 audit no email had been sent since, so the fix is unproven.
6. **Backups.** The Supabase organisation is on the Free plan. Upgrade (Pro or above) and rehearse one restore before real schools use it.
7. **Demo data.** Production holds the demo tenants (702 `*.funda360.dev` accounts, 375 learners). Decide whether to delete them or move real schools to a clean project. Never delete without a backup.
8. **MFA.** No production account has a verified factor (platform owner and super-admin included). Enrol those accounts; the app only shows a banner.
9. **Error monitoring.** Set the GitHub variable `VITE_ERROR_REPORT_URL` (Sentry store endpoint or a log drain) in the `github-pages` environment.
10. **MFA for government reporting.** Confirm TOTP is enabled in hosted Auth (dashboard), then the platform owner and super-admin enrol an authenticator; until then they get `mfa_required` on `/district`, `/reports/government` and `/district/areas`.
11. **Government reporting set-up.** A platform administrator creates the areas, links each real school to its district or circuit and creates/grants officials under Education Areas (`/district/areas`). Nothing is seeded; the current schools are demo data and must not be onboarded as government schools.
12. **Government API.** Decide a retention period for `government_api_requests` (POPIA) before issuing production tokens; issue tokens only to named integration owners under `/district/integrations`.
13. **Funda AI.** After merge: set the `ANTHROPIC_API_KEY` Edge Function secret (check it without learner data). Decide POPIA lawful basis, operator agreement and cross-border transfer, retention and budgets, and the teacher-scope policy (recommended: pilot with school_owner/principal only, `docs/FUNDA_AI.md` section 1). Then a platform admin (aal2) enables `copilot` and pilot schools via `ai_admin_update_feature` / `ai_admin_set_school(school, true, array['copilot'], budget)`. Run an answer-quality evaluation on synthetic data before any real school. Confirm the `funda-ai-recover-stale` and `funda-ai-retention` pg_cron jobs exist after the migration. Every gate is tracked in `docs/FUNDA_AI_PILOT_READINESS.md`.
