# Funda360 — Production Deployment & Operations Runbook

Concrete, repeatable procedure for standing up and operating a Funda360 pilot on a
**hosted** environment. Written to be followed by a competent developer with no
undocumented knowledge.

> Companion docs, all still current: `FUNDA360_PILOT_DEPLOYMENT_CHECKLIST.md`
> (tick-list), `PAYMENT_GATEWAY.md`, `NOTIFICATIONS_DELIVERY.md`, `ADMISSIONS.md`
> (per-feature Edge Function detail), `FUNDA360_KNOWN_LIMITATIONS.md`.

At the time of writing **no hosted environment exists** — `.env.local` points at the
local Docker stack (`localhost:54321`) and no Supabase project is linked. Every step
below is therefore a first-time setup.

---

## 1. Prerequisites

| Need | Notes |
| --- | --- |
| Supabase account + **one hosted project** | Region: `af-south-1` (Cape Town) if available, else `eu-west-*`. Note the **project ref**. |
| Supabase **paid tier** (Pro or above) | Required for Point-in-Time Recovery and log retention > 1 day. Free tier = daily backup only, 7-day retention, no PITR — acceptable only for a throwaway pilot. |
| Supabase CLI ≥ 1.200 | `npm i -g supabase` or scoop/brew. Not currently installed on the dev box. |
| Deno ≥ 2.x | For Edge Function type-check/deploy. |
| Node 20 + npm | Matches CI. |
| GitHub repo admin | `github.com/Jablo-cmd/Funda360` — to set the `github-pages` environment secrets. |
| A real domain or the default `*.github.io` Pages URL | Auth Site URL must match exactly. |
| SMTP mailbox | `smtp.hmailplus.com:587` (HostAfrica, `onboarding@aurisnexus.co.za`) is already the intended sender — you need the **mailbox user + password**. |
| Payment provider account(s) | Only if the pilot collects card/EFT payments online. Otherwise skip §5.4 / §6 payments. |

---

## 2. Environment variables

### 2.1 Browser bundle (`VITE_` — safe to expose, but still set via CI secrets)

| Variable | Where it is set | Value |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | GitHub → repo → Settings → Environments → `github-pages` → secrets | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | same | hosted project → Settings → API → **anon public** key |
| `VITE_APP_NAME` | optional, CI env or `.env` | `Funda360` |

`ci.yml`'s `deploy` job **fails hard** if either secret is missing — good.
**Never** put the `service_role` key in any `VITE_` variable or `.env` committed anywhere.

### 2.2 Edge Function secrets (server-only — `supabase secrets set`)

See §5. `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the
platform — do not set them yourself.

### 2.3 Local build hygiene

A `npm run build` on a developer machine embeds whatever `.env.local` holds — today that
is `localhost:54321` and the local demo anon key. **Never deploy a locally-produced
`dist/`.** Production artifacts come only from CI (§8).

---

## 3. Supabase migration procedure

64 migrations in `supabase/migrations/`, timestamp-ordered, all additive
(`create table` / `create type` / `add column if not exists` / `create or replace
function`) per the domain records in `docs/DOMAIN_STATUS.md`.

```bash
supabase login                       # opens browser, stores a CLI token
supabase link --project-ref <ref>    # writes supabase/.temp/project-ref
supabase db push                     # applies every pending migration in order
```

Verify afterwards:

```bash
supabase migration list              # local vs remote — every row must show both ticks
```

Spot-check in the SQL editor:

```sql
-- table + RLS + FORCE status for the tenant-scoped tables
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relkind='r' and relnamespace='public'::regnamespace
order by relname;

-- policy count (should be > 200)
select count(*) from pg_policies where schemaname='public';

-- key RPCs exist
select proname from pg_proc
where proname in ('current_tenant_id','is_platform_admin','allocate_fee_payment',
                  'convert_admission_application','provision_learner_login',
                  'create_notification','send_message');
```

**Do not** run `supabase db reset` against a hosted project — it drops all data.
`supabase/seed.sql` is **local-only** (demo accounts) and must never touch production.

### 3.1 Schema drift

Local schema = the 64 migrations. There is currently no production schema to compare
against. After the first `db push`, drift is detected by `supabase db diff --linked`
(should print nothing). If it prints anything, someone changed production by hand —
capture it as a new migration, review, commit.

---

## 4. Edge Function deployment

Four functions in `supabase/functions/`. Deploy only the ones the pilot uses.

```bash
cd supabase/functions
deno check payments-initiate/index.ts payments-webhook/index.ts \
           admissions-public/index.ts notifications-dispatch/index.ts
deno lint

# Public intake form — no JWT (applicants are anonymous)
supabase functions deploy admissions-public --no-verify-jwt

# Notification delivery worker — JWT off, gated by its own shared-secret header
supabase functions deploy notifications-dispatch --no-verify-jwt

# Payments — only if collecting online payments
supabase functions deploy payments-initiate
supabase functions deploy payments-webhook --no-verify-jwt
```

Verify:

```bash
supabase functions list                       # version + status per function
curl -i https://<ref>.functions.supabase.co/admissions-public   # expect 400/405, NOT 404
```

`notifications-dispatch` must be **scheduled** to actually drain the outbox — add a
`pg_cron` job or an external cron hitting it every 1–5 min with the
`x-dispatch-secret` header (see `NOTIFICATIONS_DELIVERY.md`).

---

## 5. Secret configuration

`supabase secrets set NAME=value` (never echoed, never committed). Set only what the
pilot needs.

| Secret | Function | Required when |
| --- | --- | --- |
| `NOTIFICATIONS_DISPATCH_SECRET` | notifications-dispatch | any external notification delivery |
| `RESEND_API_KEY`, `RESEND_FROM` | notifications-dispatch | email delivery of in-app notifications |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` | notifications-dispatch | SMS |
| `TWILIO_WHATSAPP_FROM` | notifications-dispatch | WhatsApp |
| `PAYFAST_PASSPHRASE` / `OZOW_*` / `YOCO_*` / `PEACH_*` / `NETCASH_PAYNOW_SERVICE_KEY` | payments-* | that provider is used |

Audit: `supabase secrets list` → shows names + digests, never values.

---

## 6. Auth configuration (hosted project → Authentication → URL Configuration)

| Setting | Value |
| --- | --- |
| **Site URL** | `https://funda360.aurisnexus.co.za` |
| **Redirect URLs** | `https://funda360.aurisnexus.co.za/reset-password`, `.../activate-account`, `.../verify-email`, `.../parent/payment-return` |
| Email confirmations | The app sets `enable_confirmations = false` (config.toml) and drives activation through the recovery-email flow — mirror that on the hosted project. |
| JWT expiry | default 3600s is fine; refresh is handled client-side. |

The app reads `window.location.origin` for its own redirect targets, so as long as Site
URL / Redirect URLs match the real origin, links resolve correctly.

---

## 7. SMTP configuration (hosted project → Authentication → Emails → SMTP Settings)

The default Supabase mailer is rate-limited (~3–4/hour) and unsuitable for onboarding
guardians. Configure custom SMTP:

| Field | Value |
| --- | --- |
| Host | `smtp.hmailplus.com` |
| Port | `587` (STARTTLS) |
| Username | the real mailbox address (not the `onboarding@` alias) |
| Password | mailbox password |
| Sender email | `onboarding@aurisnexus.co.za` |
| Sender name | `Funda360` |

Optionally upload the branded template from `supabase/templates/recovery.html` to
Authentication → Emails → *Reset Password* / *Confirm signup*.

**Test after saving:** trigger "Forgot password?" from the production login page with a
real inbox → the email must arrive, and its link must point at the production Site URL,
never `localhost`.

---

## 8. Production build & deployment

- **Live URL:** `https://funda360.aurisnexus.co.za/` — a custom domain on GitHub Pages,
  served at the **root** of that domain. `https://jablo-cmd.github.io/Funda360/` is only a
  legacy fallback that `301`s to the custom domain; do not treat it as an entry point.
- **Pipeline:** `.github/workflows/ci.yml` → `deploy` job (push to `main`, `needs: quality`).
  It verifies the `github-pages` environment secrets `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` are present and shaped like a hosted URL, builds with them,
  copies `dist/index.html` → `dist/404.html` (SPA deep-link fallback), and deploys `dist/`.
- **Base path:** default `/` — correct for the custom domain at root. Do **not** set a
  Vite `base` / router `basename` unless the deploy ever moves to a sub-path.
  `public/CNAME` (`funda360.aurisnexus.co.za`) ships in every build so the custom domain
  is never dropped by a deploy.

To deploy:

```bash
git checkout main && git pull
# github-pages environment secrets must be set (§2.1)
git push origin main
```

Confirm after the run:

```bash
curl -s https://funda360.aurisnexus.co.za/ | grep -o 'src="[^"]*"'          # -> /assets/index-<hash>.js
curl -s -o /dev/null -w '%{http_code}\n' \
     "https://funda360.aurisnexus.co.za$(curl -s https://funda360.aurisnexus.co.za/ | grep -oE '/assets/index-[^\"]+\.js' | head -1)"   # -> 200
curl -s https://funda360.aurisnexus.co.za/assets/index-*.js | grep -c 'localhost:54321\|service_role'   # -> 0
```

Then open the URL and confirm the login form renders and a deep link (e.g.
`/login`) survives a hard refresh.

> `.github/wodeploy-pages.yml` (stray, mis-named, never ran, no secret injection) was
> removed on 2026-09-09.

---

## 9. Smoke testing (against the deployed URL, signed in as a seeded pilot admin)

| # | Check |
| --- | --- |
| 1 | Login succeeds; refresh keeps the session; logout; a protected route now redirects to `/login`. |
| 2 | `/school/profile` loads and saves an edit. |
| 3 | `/users` — create a Teacher; temp password shown once. |
| 4 | `/academic/years` → create year + term; `/academic/grades` + `/academic/classes` + `/academic/subjects`. |
| 5 | `/employees` — create an employee; provision a login. |
| 6 | `/learners` — create a learner; add an enrolment; add + link a guardian; send the guardian invitation → **email arrives**. |
| 7 | `/attendance` — mark a register, reload, values persisted; `/reports/attendance` reflects it. |
| 8 | `/academic/assessments` — create an assessment, enter marks, reload persisted; `/reports/assessments`. |
| 9 | Dashboard for each role (principal / teacher / finance / admissions) shows real data, no broken cards, **no `localhost` links**, no dead actions. |
| 10 | Sign in as the guardian (from step 6) → Parent Portal shows the child. |

---

## 10. Rollback procedure

| Layer | Rollback |
| --- | --- |
| **Frontend** | Re-run the previous green `deploy` workflow (Actions → previous run → *Re-run jobs*), or `git revert <bad commit>` and push. Pages redeploys in ~1–2 min. |
| **Database** | Migrations are additive, so a "bad" migration rarely needs undoing — prefer a forward-fix migration. For genuine corruption: **PITR restore** (§11) to a timestamp before the change. There is no `down` migration set. |
| **Edge Function** | `supabase functions deploy <name>` from the previous git tag/commit. |
| **Secret** | `supabase secrets set` the prior value (keep them in a password manager, not here). |

Never `supabase db reset` or drop tables on production as a "rollback".

---

## 11. Backup & recovery procedure

| Item | Where | Action |
| --- | --- | --- |
| Automated daily backups | Project → Database → Backups | Confirm enabled (on by default). Note retention (7 days free / longer on paid). |
| **PITR** | Project → Database → Point in Time Recovery | Paid tier only. Enable it. Confirm the recovery window (e.g. 7 days). |
| Retention policy | — | Document the actual number shown; a pilot should have ≥ 7 days. |
| **Recovery drill (safe)** | — | Do **not** restore over production. Instead: (a) create a scratch project, (b) `supabase db dump --linked -f dump.sql` from production, (c) restore into the scratch project, (d) confirm row counts for `learners` / `attendance_records` / `assessment_results` / `audit_log` match. Record the date of the last successful drill. |
| Pre-change manual snapshot | Project → Backups → *Create backup* (paid) or `supabase db dump` | Take one immediately before any migration deploy. |

Current status: **unverified** — no project exists yet.

---

## 12. Incident investigation ("Funda360 is broken")

Look here, in order:

1. **Is the site up?** Open the Pages URL. Check repo → Actions for a failed `deploy`.
2. **Supabase project health** — Project → Reports (API errors, DB CPU/connections).
3. **Postgres logs** — Project → Logs → Postgres. RLS denials, constraint violations,
   function errors surface here.
4. **Auth logs** — Project → Logs → Auth. Login failures, SMTP send failures, rate limits.
5. **Edge Function logs** — Project → Edge Functions → *(function)* → Logs. Payment webhook
   failures, notification-dispatch errors.
6. **API/PostgREST logs** — Project → Logs → API. 400/403/500 from the browser.
7. **In-app audit trail** — `select * from audit_log order by created_at desc limit 100;`
   — every privileged action (invoices, transitions, provisioning, deactivation) is here.
8. **Browser console / network tab** on the user's session — client-side errors, the exact
   failing request + status.

There is **no external error-tracking service** (Sentry etc.) wired in — see the
Production Readiness Report. Supabase Logs is the current source of truth and retains
1 day (free) / 7+ days (paid).

---

## 13. Post-deployment verification

- [ ] `supabase migration list` — every migration applied remotely.
- [ ] `supabase db diff --linked` — empty (no drift).
- [ ] `supabase functions list` — every needed function `ACTIVE`, version matches `git rev-parse HEAD`.
- [ ] `supabase secrets list` — every secret from §5 present.
- [ ] Auth Site URL + Redirect URLs match the live origin.
- [ ] Custom SMTP saved; a real password-reset email received with a production link.
- [ ] `dist` served by Pages contains **no** `localhost` (`curl -s <url>/assets/*.js | grep localhost` → nothing).
- [ ] Smoke tests §9 all pass on the live URL.
- [ ] Journeys A–E (see `FUNDA360_PILOT_SETUP_CHECKLIST.md`) executed end-to-end on the live URL.
- [ ] Daily backups confirmed; PITR enabled; recovery drill dated.
- [ ] A named pilot support contact + escalation path recorded.
