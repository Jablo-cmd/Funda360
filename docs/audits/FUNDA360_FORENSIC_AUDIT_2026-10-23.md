# Funda360 forensic audit, 2026-10-23

Scope: the whole platform as of `main` = `3d30df5` (PR #9 merged 2026-10-23 10:26 UTC). This covers:

- the code: frontend, Edge Functions, migrations and CI;
- the hosted Supabase project `rzkybmkzhpwovpvrjkxk`, examined **read-only** (SQL `select`s, advisors, migration and function lists);
- GitHub Actions history.

Nothing was changed in production. Every figure below was measured on 2026-10-23 unless marked otherwise.

## 0. Verdict in one paragraph

The database is in good shape. All 84 migrations are applied. All 137 public tables have RLS forced. All 277 SECURITY DEFINER functions pin `search_path`, and none can be executed by `anon`. No account still uses the leaked demo password. **The release pipeline, however, is broken**: the PR #9 merge never reached the website or the Edge Functions because the CI `SUPABASE_ACCESS_TOKEN` secret is rejected (`Invalid access token`). As a result:

- production runs **today's database** with **the pre-PR #9 frontend**;
- the payment and notification functions are the **2026-09-09** build, so the P1-5 settlement binding fix is **not live**;
- `government-api` and `funda-ai` are not deployed at all.

The code review found one forgeable payment path (Netcash), one way to block a genuine payment from settling (webhook dedupe poisoning), and a rate-limit bypass on public admissions. All three are latent today: no school has a payment gateway configured and there are no admissions yet. The platform is still a demo estate: 703 of 704 accounts are `*.funda360.dev`, there are 0 verified MFA factors, there are no backups (Free plan), and leaked-password protection is off.

## 1. Severity summary

| ID    | Severity                         | Finding                                                                                                                       | Live exposure today                                    |
| ----- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| D-1   | **Critical (ops)**               | CI deploy blocked: `SUPABASE_ACCESS_TOKEN` invalid; functions and frontend not deployed since the merge                       | Yes                                                    |
| D-2   | High (ops)                       | Database migrated by a second, undocumented path; frontend and functions now lag the schema                                   | Yes                                                    |
| D-3   | High (ops)                       | Payment and notification functions are the 2026-09-09 build, uploaded from a workstation path (`file:///Projects/Funda360/…`) | Yes (binding fix missing; payments not configured)     |
| S-1   | **High** (latent)                | Netcash webhook "signature" is the service key, and that key is sent to every payer's browser, so any payer can forge "paid"  | No (0 gateway configs)                                 |
| S-2   | Medium (latent)                  | Webhook dedupe row is written before signature verification, so a forged event can pre-empt and block the genuine one         | No                                                     |
| S-3   | Medium                           | Admissions rate limits keyed on the first `X-Forwarded-For` hop (client-controlled), and the limiter fails open               | Endpoint is live (v8); no admissions data yet          |
| S-4   | Medium                           | 0 verified MFA factors; platform owner and `super.admin@funda360.dev` (super_administrator, demo domain) have none            | Yes                                                    |
| S-5   | Medium                           | Runtime dependency advisories: DOMPurify (critical, via jsPDF), `@supabase/auth-js` 2.65, `react-router` 6.30 open redirect   | Partly (see §5)                                        |
| S-6   | Medium                           | Leaked-password protection off (advisor WARN)                                                                                 | Yes                                                    |
| S-7   | Low                              | No Content-Security-Policy; sessions in `localStorage`                                                                        | Yes                                                    |
| S-8   | Low                              | `create_payment_intent` stores caller-supplied `return_url`/`cancel_url` unvalidated                                          | No                                                     |
| S-9   | Low                              | `anon` holds ALL table privileges (incl. `TRUNCATE`) on about 130 tables (Supabase default; RLS is the only barrier)          | Not exploitable via PostgREST                          |
| S-10  | Low                              | 32 SECURITY INVOKER functions without a pinned `search_path` (advisor WARN)                                                   | No                                                     |
| S-11  | Low                              | Yoco webhook timestamp not checked (replay window); mitigated by event-id dedupe                                              | No                                                     |
| O-1   | High (business)                  | No backups (Free plan); no restore rehearsed                                                                                  | Yes                                                    |
| O-2   | Medium                           | External notifications never sent: nothing schedules `notifications-dispatch`; links are relative paths                       | Yes                                                    |
| O-3   | Medium                           | Funda AI `copilot.allowed_roles` includes all teacher roles, against the documented pilot recommendation                     | No (feature disabled)                                  |
| Q-1   | Low                              | 228 unindexed foreign keys, 137 unused indexes, 19 multiple permissive policies                                               | Performance only                                       |
| Q-2   | Low                              | Repo hygiene: `auth-users.sql` (empty auth-schema dump) at repo root; two stale open PRs (#1, #6)                             | No                                                     |

## 2. Release and deployment forensics

### D-1 CI deploy blocked by an invalid Supabase access token

- CI run 218 on `main` (https://github.com/Jablo-cmd/Funda360/actions/runs/39939167373) ran 4 attempts between 10:26 and 11:05 UTC. Quality, Deno, RLS and Playwright are green on every attempt.
- The `Apply database migrations to production` job fails at `supabase link`:
  `Unexpected error retrieving remote project status: {"message":"Invalid access token"}`.
- Consequently `Deploy Edge Functions to production` and `Deploy to GitHub Pages` were **skipped** on all 4 attempts. Re-running cannot help until the secret is replaced.
- **Fix (owner, about 5 minutes):**
  1. Create a new token at https://supabase.com/dashboard/account/tokens.
  2. Replace `SUPABASE_ACCESS_TOKEN` in GitHub → Settings → Environments → `github-pages` (and any repo-level copy).
  3. Confirm `SUPABASE_DB_PASSWORD` is current.
  4. Click "Re-run failed jobs".

  If the token has an expiry date, record it in a calendar: an expired token is the likely cause.

### D-2 A second, undocumented migration path

- `list_migrations` shows all 84 versions applied, including the 7 new ones (`20261009090000`…`096000`).
- `ai_features.updated_at` is `2026-10-23 10:27:41 UTC`, **one minute after the merge** and 11 minutes *before* CI's `migrate` job ran (and failed). Something other than CI therefore applied the migrations. The most likely candidate is the Supabase GitHub integration (branching / auto-deploy on `main`), or a manual `db push`.
- Risk: two deployers race each other, and CI's "migrate before deploy" ordering guarantee no longer holds. The DB is now **ahead** of the frontend, which is the inverse of the 2026-09-29 P0-2 drift but the same class of problem.
- **Action:** decide on one deployer. If the Supabase GitHub integration is on, either disable its migration step or remove CI's `migrate` job, and document the choice in `docs/FUNDA360_PRODUCTION_RUNBOOK.md`.

### D-3 Edge Functions in production

| Function                 | Prod version | Last deployed (UTC)                          | Source path in bundle                      | Matches `main`?                                     |
| ------------------------ | ------------ | -------------------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `admissions-public`      | 8            | 2026-10-08                                   | `/tmp/user_fn_…` (API upload)              | Yes (P1-6 guards)                                   |
| `payments-initiate`      | 5            | 2026-09-09                                   | `file:///Projects/Funda360/…` (a workstation) | **No**                                              |
| `payments-webhook`       | 5            | 2026-09-09                                   | `file:///Projects/Funda360/…`              | **No: P1-5 settlement binding missing**             |
| `notifications-dispatch` | 5            | 2026-09-09                                   | `file:///Projects/Funda360/…`              | **No: P2 row claiming missing**                     |
| `government-api`         | n/a          | never                                        | n/a                                        | **Missing**                                         |
| `funda-ai`               | n/a          | never                                        | n/a                                        | **Missing** (UI launcher hides itself; feature off) |

The frontend served by GitHub Pages is the last build deployed **before** the merge. The new `/district`, `/province`, `/reports/government` routes and the Funda AI launcher are therefore not live, even though their database objects are. (The live site could not be fetched from the audit sandbox because the proxy blocks it; this conclusion rests on the skipped Pages job.)

## 3. Production database: measured state

| Check                                           | Result                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Project                                         | ACTIVE_HEALTHY, Postgres 17.6.1.155, eu-central-1, created 2026-08-02                                                  |
| Migrations                                      | 84/84 applied, no gaps                                                                                                 |
| Public tables                                   | 137, RLS enabled 137, **forced 137**                                                                                   |
| Policies                                        | 273                                                                                                                    |
| SECURITY DEFINER functions                      | 277; 0 without pinned `search_path`; **0 executable by `anon`**; 194 executable by `authenticated` (intended RPC surface) |
| Tables with RLS but no policy                   | `admission_counters`, `fee_document_counters`, `rate_limit_events` (intended: definer-only access)                      |
| `profiles` self-update                          | `profiles_update_own` + triggers block role, tenant, email and own-status changes; role in JWT = `profiles.role` for all 704 users (0 mismatches) |
| Custom access-token hook                        | None; role comes from `app_metadata` (service-role writable only)                                                     |
| Storage                                         | 5 buckets, all **private**, each with size and MIME limits                                                             |
| pg_cron                                         | `fee-overdue-reminders-daily`, `document-expiry-alerts-daily`, `funda-ai-recover-stale` (every minute), `funda-ai-retention`; all runs in the last 7 days succeeded; the duplicate `funda360-*` jobs are gone |
| Extensions                                      | plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault, pg_cron                                              |
| Auth users                                      | 704: 703 `*.funda360.dev` demo + 1 real (platform owner)                                                               |
| Leaked demo password `Funda360!DEMO-ONLY-2026`  | **0** accounts still use it (checked with `crypt()` against every hash)                                                |
| Verified MFA factors                            | **0**                                                                                                                  |
| Privileged accounts                             | platform owner (last sign-in 2026-10-13); `super.admin@funda360.dev` super_administrator (last sign-in 2026-09-19)      |
| Sign-ins in the last 30 days                    | 4 users; 5 live sessions                                                                                               |
| Data volume                                     | 6 schools, 375 learners, 492 fee payments, 141 audit rows                                                              |
| Payment gateway configs                         | **0** (online payments not enabled anywhere); 1 webhook event ever                                                     |
| Admissions                                      | 0 applications                                                                                                         |
| Government                                      | 0 education areas, 0 API clients                                                                                       |
| Funda AI                                        | `copilot.enabled = false`, 0 AI requests, no school settings                                                           |
| Notification deliveries                         | 0 rows                                                                                                                 |

### Supabase advisors (full output read)

| Advisor                                               | Level | Count | Assessment                                                                                                                                                       |
| ----------------------------------------------------- | ----- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth_leaked_password_protection`                     | WARN  | 1     | S-6. Dashboard toggle.                                                                                                                                           |
| `authenticated_security_definer_function_executable`  | WARN  | 194   | By design (authorisation-in-DB RPCs). Each function checks its own caller; the RLS suite covers them.                                                            |
| `function_search_path_mutable`                        | WARN  | 32    | S-10. All SECURITY INVOKER (`jwt_role`, `can_*`, `is_*`, `rls_optimize_*`, timetable triggers). `rls_optimize_*` are not executable by `authenticated`. Low risk; pin anyway. |
| `rls_enabled_no_policy`                               | INFO  | 3     | Intended.                                                                                                                                                        |
| `unindexed_foreign_keys`                              | INFO  | 228   | Q-1. Mostly `created_by`/`updated_by`. Add indexes on FKs used in joins or deletes, not all of them.                                                             |
| `unused_index`                                        | INFO  | 137   | Q-1. Demo traffic is too small to judge; revisit after a real term.                                                                                              |
| `multiple_permissive_policies`                        | WARN  | 19    | Q-1. `*_select` + `*_select_for_self` pairs. Performance only.                                                                                                   |

## 4. Security findings in detail

### S-1 (High, latent) Netcash payments can be forged by the payer

- `_shared/providers/netcash.ts` treats `M1 == service key` as the webhook "signature".
- `buildRedirect` puts `M1: serviceKey` into the redirect form. `payments-initiate` returns that form to the browser, and `PayInvoiceButton.tsx:49-51` renders it as a hidden HTML form. **Every guardian who starts a Netcash payment can read the service key in DevTools.**
- With it they can POST `p2=<their own intent reference>&M1=<key>&TransactionAccepted=true&Amount=<intent amount>&RequestTrace=<anything>` to `payments-webhook?provider=netcash&mode=live`. Every check passes:
  - "signature": the key matches;
  - binding: same provider and mode, school's own config;
  - amount: the payer knows it.

  `settle_payment_intent` then books a real payment and allocates it to the invoice, **without any money moving**.
- Exposure: none today (0 gateway configs), but this is the first thing that would bite when a school enables Netcash.
- **Fix:** never settle Netcash on the callback alone. On each notify, confirm the transaction server-side with Netcash (their transaction-status / retrieval API, using a credential that never leaves the server). Until that exists, remove `netcash` from `ADAPTERS` or refuse it in `create_payment_intent`. Add a Deno test that a callback carrying only the browser-visible fields cannot settle.

### S-2 (Medium, latent) Webhook dedupe poisoning

- `settle_payment_intent` inserts into `payment_webhook_events … on conflict (provider, provider_event_id) do nothing` **before** checking `p_signature_valid`.
- `payments-webhook` is public, so anyone can submit an *invalid* callback carrying a `provider_event_id` that the genuine provider will use later. The genuine callback then returns `duplicate_ignored`, and the intent never settles.
- The event id is predictable for the payer in at least one case: Ozow returns `TransactionId` to the payer's browser on the success redirect, which can arrive before the server notify.
- Unauthenticated callers can also grow `payment_webhook_events` without limit (no rate limit on this endpoint).
- **Fix:** dedupe only verified events. For example, make the unique index partial (`where signature_valid`), or insert unverified callbacks into a separate log keyed by a random id. Consider a per-IP limit on the webhook.

### S-3 (Medium) Admissions rate limits can be bypassed

- `_shared/admissions/guards.ts` `clientIp()` takes the **first** `X-Forwarded-For` entry. Proxies append the real address on the right, so the first entry is whatever the client sent. Rotating that header gives a fresh bucket for every request.
- This defeats every per-IP limit: `resume` (10 per 15 min, the date-of-birth guess limit), `start`, `upload-url` and `register-doc`.
- The limiter also fails open on any DB error.
- Residual protection on `resume`:
  - newer references carry a 6-character random suffix;
  - email + reference + exact date of birth must all match.

  References issued before `20260930121000` are sequential, but production has 0 applications, so none of those exist.
- **Fix:**
  - use the right-most `X-Forwarded-For` hop added by the platform (or the platform's own client-IP header), verified against Supabase's documented header;
  - add a per-reference attempt counter for `resume` that does not depend on IP;
  - fail closed for `resume` and `start`.

### S-4 (Medium) No MFA anywhere

0 verified factors. Government reporting, the platform-admin AI reads and the audit-log `ai_%` rows already require `aal2`, so those features are unusable until an authenticator is enrolled. `super.admin@funda360.dev` is a demo-domain identity holding the highest school-level role in production. Disable or delete it (after backup) unless it is a real operator account, and enrol MFA on the platform owner.

### S-5 (Medium) Dependencies

`npm audit` reports 21 issues (3 critical, 9 high, 7 moderate, 2 low). The ones that matter at runtime:

| Package                                    | In bundle?                                                         | Issue                                                                                               | Fix                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `dompurify` 3.4.14 (via `jspdf` 4.2.1)     | Yes (`purify.es-*.js`, 29 kB)                                      | 5 advisories (IN_PLACE / SAFE_FOR_TEMPLATES bypasses), rated critical                               | `npm audit fix` (non-breaking). Funda360 itself never calls DOMPurify and only feeds jsPDF its own text, so practical risk is low. |
| `@supabase/supabase-js` 2.45.4 → `auth-js` 2.65.0 | Yes                                                       | GHSA-8r88-6cj9-9fh5 insecure path routing from malformed input                                      | Upgrade supabase-js (pinned exactly at 2.45.4; current 2.118). Test the auth flows.                                       |
| `react-router-dom` 6.30.6                  | Yes                                                                | Open redirect via backslash in `<Link>`/`navigate` (fix only in v7)                                 | All navigation targets are internal constants or router state, so not reachable today. Plan the v7 upgrade.               |

Dev-only (CI and local dev): `vitest` 2 / `tinypool` (critical prototype-pollution RCE), `vite` 5 / `esbuild` dev-server CORS, `braces`, `brace-expansion`, `js-yaml`, `source-map-js`, `postcss-selector-parser`. Run `npm audit fix` for the non-breaking ones; schedule vitest 2→5 and vite 5→6+.

### S-6 Leaked-password protection is off

This is a dashboard toggle: Auth → Providers → Email → "Prevent use of leaked passwords".

### S-7 No CSP; tokens in localStorage

GitHub Pages cannot send headers. Add a `<meta http-equiv="Content-Security-Policy">` with:

- `default-src 'self'`;
- `connect-src` for the Supabase project and the error-report URL;
- `img-src 'self' data: blob: https://<ref>.supabase.co`;
- `script-src 'self' 'sha256-…'` for the inline theme script in `index.html`;
- `object-src 'none'`.

`frame-ancestors` is ignored in a meta tag, so clickjacking protection needs a different host (for example Cloudflare in front of Pages). The XSS surface is currently small: there is no `dangerouslySetInnerHTML`, no `innerHTML`, and no user-controlled `href` apart from `mailto:`. CSP is defence in depth for a session stored in `localStorage`.

### S-8 Unvalidated return URLs

`create_payment_intent(p_return_url, p_cancel_url)` stores any string. `payments-initiate` appends `?intent=<id>`, which produces a broken URL if the stored one already has a `?`. The payer only redirects themselves, so this is low risk. Validate against the app origin in the RPC.

### S-9 `anon` table privileges

Every public table grants `anon` (and `authenticated`) SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER, which is the Supabase default. Forced RLS stops the four DML verbs. `TRUNCATE` is not subject to RLS, but PostgREST cannot issue it. For defence in depth, revoke `TRUNCATE, TRIGGER, REFERENCES` from `anon, authenticated` on all public tables, and revoke everything from `anon` on tables with no anon policy (all of them).

### S-11 Yoco replay window

`webhook-timestamp` is signed but never compared to the current time. The event-id dedupe stops exact replays, so this is low risk. Reject timestamps more than 5 minutes old.

### What was checked and found sound

- **PayFast:** MD5 signature plus server-side `validate` call; live mode refuses to run without a passphrase.
- **Ozow:** SHA-512 hash.
- **Peach:** AES-GCM decryption is the authentication.
- **Amount:** re-checked in SQL.
- **Allocation:** capped at the invoice's outstanding amount.
- **Payment references:** UUID-random.
- **`payments-initiate`:** loads the intent with the caller's JWT, so RLS scopes it.
- **`notifications-dispatch`:** constant-time shared secret; compare-and-set claim with lease.
- **`government-api` adapter:**
  - bearer token only, never accepted in the query string;
  - 1 MB body cap;
  - repeated query keys refused;
  - no raw DB errors returned;
  - all authorisation sits in `gov_api_request()`, which only the service role can execute.
- **Profile escalation:** role, tenant and email changes need a transaction-local flag that only definer RPCs set. PostgREST callers cannot set arbitrary GUCs.
- **Git history (120 commits):** no Supabase service keys, `sbp_` tokens, Anthropic keys, private keys or AWS keys. The only real credential ever committed is the demo password, which is rotated and verified unused.

## 5. Code quality and test evidence

| Gate                                        | Result (this audit)                                                        | CI on `3d30df5`  |
| ------------------------------------------- | -------------------------------------------------------------------------- | ---------------- |
| `npm ci`                                    | OK (448 packages)                                                          | OK               |
| Typecheck (`tsc -b`, includes e2e)          | pass                                                                       | pass             |
| ESLint                                      | pass, 0 warnings                                                           | pass             |
| Unit tests (vitest)                         | **335/335**, 34 files                                                      | pass             |
| Production build                            | pass; largest chunks: `index` 421 kB (121 kB gz), jsPDF 390 kB (lazy), html2canvas 201 kB (lazy) | pass |
| Deno check, lint, test (`_shared/`)         | not re-run locally                                                         | pass             |
| RLS / SECURITY DEFINER suite (70 test files) | not re-run locally (Docker)                                                | pass             |
| Playwright (about 375 tests)                | not re-run locally                                                         | pass (4m55s)     |

Size: about 69,700 lines of TypeScript/TSX in `src` (649 files), 23,800 lines of SQL in 84 migrations, 7,400 lines of Deno in Edge Functions, 49 Playwright specs.

## 6. Operations and business-readiness

- **O-1 Backups:** the organisation is on the Free plan, which has no point-in-time recovery and keeps no daily backups the owner can restore. This blocks onboarding any real school.
- **O-2 Notifications:** `notification_deliveries` has 0 rows and no cron job or scheduler calls `notifications-dispatch`, so email, SMS and WhatsApp delivery is not operating. In-app notifications work. When it is switched on, `link_path` is appended as a bare path (`/fees/...`); build an absolute URL from the app origin.
- **Email/Auth:** `docs/EMAIL_AND_LOGIN_SETUP.md` items (Site URL, SMTP) remain unverified. The last account was created 2026-09-23, so no auth email has been exercised since the fix.
- **O-3 Funda AI:** disabled and undeployed, so no risk today. Before enabling, set `allowed_roles` to `{school_owner,principal}` as `docs/FUNDA_AI.md` §1 recommends; the current default includes five teacher roles. The release gates in `docs/FUNDA_AI_PILOT_READINESS.md` still read NOT READY, and blind safeguarding recall was 28/40 and 21/45.
- **Demo estate:** 702 demo accounts and 375 demo learners sit in the production project. Decide: wipe after backup, or start real schools in a clean project.
- **Repo hygiene:**
  - `auth-users.sql` at the repo root is an empty `pg_dump` of the auth schema (no rows). Delete it, and add `*.dump`/`auth-users.sql` to `.gitignore`, so that a populated dump is never committed to this **public** repo.
  - PRs #1 and #6 have been open since before the current architecture; close them.
  - GitHub warns that `actions/checkout@v4` and `setup-node@v4` target Node 20, which is deprecated on runners.
- **Branch protection:** a push to `main` deploys to production. Require the CI checks and one review.

## 7. Prioritised action list

| #   | Who   | Action                                                                                                                         | Effort                     |
| --- | ----- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| 1   | Owner | Replace `SUPABASE_ACCESS_TOKEN` (and check `SUPABASE_DB_PASSWORD`), re-run run 39939167373; confirm all six functions and Pages deploy | 10 min                     |
| 2   | Owner | Decide the single migration deployer (Supabase GitHub integration vs CI) and disable the other                                 | 15 min                     |
| 3   | Owner | Upgrade to Pro, enable PITR/backups, rehearse one restore                                                                      | 1 h                        |
| 4   | Owner | Enrol TOTP for the platform owner; disable or remove `super.admin@funda360.dev`; turn on leaked-password protection           | 20 min                     |
| 5   | Dev   | S-1: disable Netcash until server-side verification exists                                                                     | 1 h (disable) / 1 day (fix) |
| 6   | Dev   | S-2: dedupe only verified webhook events                                                                                       | 2 h + RLS test             |
| 7   | Dev   | S-3: trusted client IP, per-reference resume counter, fail closed                                                              | 3 h + Deno tests           |
| 8   | Dev   | S-5: `npm audit fix`; upgrade supabase-js; plan vitest/vite/react-router majors                                                | 0.5–2 days                 |
| 9   | Dev   | S-7 CSP meta tag; S-8 return-URL validation; S-9 revoke TRUNCATE/TRIGGER/REFERENCES; S-10 pin search_path; S-11 Yoco timestamp | 1 day                      |
| 10  | Dev   | O-2 schedule `notifications-dispatch` (pg_cron + `net.http_post` with the dispatch secret) once a provider is chosen; absolute links | 0.5 day                    |
| 11  | Owner | Funda AI: restrict `allowed_roles` before any enablement; keep disabled until the readiness gates pass                         | n/a                        |
| 12  | Dev   | Remove `auth-users.sql`; close PRs #1 and #6; bump actions to Node 24 versions; branch protection on `main`                    | 30 min                     |

## 8. Method and limits

- **Production:** read-only SQL through the Supabase management connector (catalog queries, row counts, `crypt()` comparison for the leaked password), plus `get_advisors` (security and performance; both outputs read in full), `list_migrations`, `list_edge_functions` and `get_project`. No writes.
- **GitHub:** workflow runs, jobs and logs for run 218; PR list.
- **Code:** full read of every Edge Function entrypoint, the payment adapters, binding, admissions guards and the government API adapter; targeted reads of `settle_payment_intent`, `create_payment_intent`, the profile-protection triggers, the Supabase client, routing and redirect handling; a repository-wide search for HTML injection and untrusted links; a secret scan of the full git history.
- **Not done in this pass:**
  - a line-by-line re-review of all 84 migrations and of the Funda AI gateway (both covered by the 2026-10-08/09 audits and by CI suites that pass on this commit);
  - local re-runs of the RLS, Deno and Playwright suites (CI ran them green on the same commit);
  - fetching the live site (the sandbox proxy blocks it);
  - Supabase Auth dashboard settings other than what the advisors expose (SMTP, Site URL, TOTP enablement).
