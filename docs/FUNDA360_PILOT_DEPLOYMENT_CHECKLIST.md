# Funda360 — Pilot Deployment Checklist

Everything already verified in this document was verified against a **local** development Supabase instance. Moving to an actual pilot requires a **hosted** Supabase project — re-verify every item below against that real deployment before go-live. Don't assume local verification transfers automatically.

## Environment

- [ ] **Production/hosted Supabase project configured** — a real Supabase project created (not the local Docker stack used during development).
- [ ] **Production environment variables configured** — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set to the hosted project's values (Project Settings → API), not `localhost`. See `.env.example` in the repository for the exact variable names Funda360 reads.
- [ ] **Production build tested** — `npm run build` succeeds and the built output (`dist/`) has been served and smoke-tested, not just the dev server.
- [ ] **Domain configured** — the pilot school reaches Funda360 at a real, stable web address.
- [ ] **HTTPS confirmed** — the production domain serves over HTTPS, not plain HTTP.
- [ ] **Authentication tested** — a real sign-in against the hosted Supabase project succeeds end-to-end (this cannot be assumed from local testing; the local `.env.local` points at a different, disposable Supabase instance).

## Data

- [ ] **Pilot school created** in the hosted project.
- [ ] **Users provisioned** — principal, teacher(s), and any other staff accounts created via Users & Roles or Employee login provisioning.
- [ ] **Roles verified** — each account reaches the dashboard/pages appropriate to its role.
- [ ] **Classes configured** for the school's actual academic structure.
- [ ] **Learners configured** — real learner records loaded (or a clear, agreed plan for who loads them and by when).
- [ ] **Teacher assignments verified** — each teacher's Attendance page shows exactly the class(es) they should see, no more.

## Security

- [ ] **RLS verified against the hosted project** — the same tenant/row-level-security policies that were verified locally are the ones actually running in the hosted database (i.e. all migrations under `supabase/migrations/` have been applied to it, in order).
- [ ] **Tenant isolation verified against the hosted project** — a second test account (or a second pilot school, if applicable) confirms it cannot see another school's data.
- [ ] **No `service_role` key exposed** — confirm the frontend build and its environment variables only ever contain the `anon` key, never the `service_role` key.
- [ ] **No secrets committed** — `.env.local` (or the hosted equivalent) is not tracked in version control; confirm this on the actual deployment pipeline, not just locally.
- [ ] **Password / reset process documented** — pilot users know how to use "Forgot password?", and whoever administers the pilot knows how to reset a user's password or reissue a login if needed.

## Testing (repeat against the hosted deployment — do not assume local results carry over)

- [ ] Principal login
- [ ] Teacher login
- [ ] Attendance — mark, save, edit without duplicating
- [ ] Reports — including the Attendance Report and its below-80% alert
- [ ] CSV export — a file genuinely downloads with correct data
- [ ] Mobile — a real phone, not just a resized desktop browser
- [ ] Logout — and confirm a protected page is inaccessible afterwards
- [ ] Refresh / deep-linking — reloading a page mid-session keeps you signed in; opening a link in a new tab behaves as expected (see the "Remember me" note in the [Pilot User Guide](FUNDA360_PILOT_USER_GUIDE.md#logging-in))

## Support

- [ ] **Pilot contact identified** — a named person the school can reach with questions or problems.
- [ ] **Bug-report process ready** — pilot users know where to find and how to submit the [Bug Report Template](FUNDA360_BUG_REPORT_TEMPLATE.md).
- [ ] **Feedback process ready** — pilot users know where to find and how to submit the [Feedback Form](FUNDA360_PILOT_FEEDBACK_FORM.md).
- [ ] **Backup/recovery process documented** — how and how often the hosted Supabase database is backed up, and who is responsible for restoring it if something goes wrong. (This is a hosted-environment operational concern, distinct from and in addition to the local development environment's own data safety.)

---

Once every item above is checked **against the hosted deployment**, Funda360 is ready to go live for the pilot school.
