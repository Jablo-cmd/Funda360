# Funda360 — Reconciled Documentation

**Documentation status:** Current as of 2026-09-24  
**Repository:** Jablo-cmd/Funda360  
**Source of truth:** `docs/FUNDA360_CURRENT_STATE_2026-09-24.md`

> This document was reconciled against the current repository rather than against historical requirements or generated specifications. Implemented capability, partial capability, external configuration, and planned capability are kept separate. A feature is not described as live merely because a route, migration, adapter, or design exists.

## Current platform baseline

Funda360 is an enterprise-oriented, multi-tenant school-management SaaS platform built with React 18/TypeScript/Vite/Tailwind and Supabase Auth/PostgreSQL/RLS/Storage, using PostgREST/client-direct access plus SECURITY DEFINER RPCs where appropriate. The repository currently records 67 SQL migrations, 56 RLS regression-test files, 43 Playwright E2E specs and 26 unit-test files, with Docker-based RLS verification and CI tooling.

Implemented/current domains include authentication and account lifecycle, multi-tenancy, RBAC, school administration, academic structure, timetable, teaching assignments, assessments/gradebook, report cards, learner/SIS, guardians and portals, admissions, attendance, homework, finance ledger and reconciliation workflows, employee/HR/leave, behaviour, safeguarding, consent, messaging/announcements, notifications, reporting/CSV exports, documents/storage and audit/security controls.

The platform is production-oriented, but the repository does **not** establish that every enterprise capability is production-certified. Payment-provider activation, government interoperability, native mobile, enterprise BI, full payroll, transport, boarding, library, sports, assets, procurement, SGB governance, independent security certification and other roadmap items remain separate from shipped functionality unless explicitly evidenced in code/configuration.

## Documentation rule

For future updates use this order of evidence:

**CODE → DATABASE/MIGRATIONS → ROUTES → RBAC/RLS → TESTS → DOCUMENTATION**

When a requirement differs from implementation, document the implementation as current and the requirement as planned/target state.

## Admissions — current state

Admissions supports configurable applications/requirements, workflow and detail views, public intake, resume capability, conversion into learner + guardian + enrolment records, duplicate safeguards and a narrow SECURITY DEFINER RPC for controlled guardian-status operations.

Public intake is exposed through `/apply` and the `admissions-public` edge function.

### Boundary
Admissions is implemented as an operational intake workflow. Advanced CRM, marketing automation, application-fee payments and broad external admissions integrations are not assumed unless separately evidenced.
## Abuse controls on the public endpoint (audit P1-6, 2026-09-30)

`admissions-public` is unauthenticated, so it defends itself:

- **Per-IP rate limits for every action** (`_shared/admissions/guards.ts` → `RATE_LIMITS`). For example, `start` allows 10 per hour and `resume` 10 per 15 minutes.
  - Events are stored in `rate_limit_events` under a salted SHA-256 of the IP, never the raw address. Set the salt with `ADMISSIONS_RATE_LIMIT_SALT` (it falls back to a server secret).
  - Exceeding a limit returns HTTP 429, which the UI shows as a friendly message.
  - If the limiter itself fails, it fails open and logs, so admissions stay available.
- **Per-email limit:** at most 5 new applications per applicant email per hour.
- **Resume needs the learner's date of birth** as well as email and reference; reference numbers are sequential, so those two alone are guessable.
  - A mismatch looks exactly like "not found".
  - The response carries only status, reference and the learner's first name. The full application is no longer returned.
- **Documents:** PDF, PNG or JPEG only, at most 10 MB. This is checked before a signed upload URL is issued, again at registration, and by the bucket's own limits.
- **Document paths:** a document can only be registered at a path inside its own application's folder (`<school>/<application>/<file>`), so an applicant cannot attach another applicant's file.
