# Funda360 — Domain Status Tracker

**This file is the authoritative roadmap and source of truth for the remaining Funda360 development sequence.**

Funda360 is completed **one full domain at a time**:

> **ONE DOMAIN → COMPLETE → VERIFY → DOCUMENT → COMMIT → CLOSE → NEXT DOMAIN**

No artificial sprints or milestones inside a domain. A domain is implemented completely, verified, documented, committed, and marked `CLOSED` before the next begins. This is a **one-domain-per-development-session** strategy — do not chain multiple major domains in a single session.

Statuses: `QUEUED` · `IN_PROGRESS` · `BLOCKED` · `CLOSED`

Last updated: 2026-09-04 — Domain 2 (Report Cards) CLOSED.

---

## Continuation rule

When a session begins with **"Continue Funda360"**:

1. Read this file (`docs/DOMAIN_STATUS.md`).
2. Find the first domain whose status is not `CLOSED` (top of the queue wins).
3. Inspect the current repository state (migrations, `src/features/`, routes, tests) for that domain — reuse/extend what exists; never duplicate.
4. Resume/implement that domain. Do **not** ask which domain is next.
5. Do **not** reopen a `CLOSED` domain unless a demonstrable security or dependency defect is found there.
6. When the domain is genuinely complete (see "Definition of complete"), run full verification.
7. Fix every verification failure, then re-run verification.
8. Update this tracker (status → `CLOSED`, record commits / migrations / verification results / deferred items).
9. Inspect `git status`, ensure the working tree contains only that domain's changes, commit the domain.
10. Identify the next `QUEUED` domain and **stop** — do not start it until the next explicit session.

Only implement one domain per session unless explicitly told otherwise in that session.

---

## Definition of complete

A domain is **not** complete because tables exist, a page renders, routes resolve, forms submit, mock data works, or TypeScript compiles.

A domain is complete only when the entire functional chain is implemented and verified:

**Database → schema → constraints → indexes → tenant isolation → RLS → authorization → RPC / business rules → services → hooks → UI → routes → role permissions → workflows → validation → error handling → auditability → tests → E2E → production build → documentation.**

---

## Security requirements (per domain, not deferred to the end)

Every new tenant-scoped table/domain must:

- `ENABLE` **and** `FORCE ROW LEVEL SECURITY`
- have explicit, fail-closed policies (default-deny; no policy = no access)
- enforce tenant isolation (`current_tenant_id()` / school_id), verified by FK-doesn't-respect-RLS validate triggers where a row references another tenant-scoped row
- enforce role/permission boundaries mirroring `src/features/rbac/constants/rolePermissions.ts`
- route privileged state transitions and immutable/locked state through `SECURITY DEFINER` RPCs only (no client-writable status columns)
- pin `search_path` on `SECURITY DEFINER` functions; `revoke execute … from public` **and** `from authenticated` for internal-only functions
- protect secrets (Edge Function env only — never DB rows, frontend, logs, or git)
- write an `audit_log` row for every sensitive/privileged action
- ship RLS/authorization tests covering **authorized success and unauthorized failure**, plus concurrency tests where a check reads-then-writes shared state

---

## Reuse mandate

Before creating new schema or code, inspect the existing implementation and **extend it**. Reuse:

`schools`/tenancy · `profiles` · RBAC + `Permission` union · `academic_years` · `terms` · `grades`/`classes` · `subjects` · `class_teacher_assignments` · `learners` · `learner_enrollments` · `guardians`/`learner_guardians` · `attendance_records` · `assessments`/`assessment_results` · `behaviour_incidents` · `employees`/HR · fees/finance ledger · `learner_documents` + storage buckets · `audit_log` + `write_audit_log()` · `notifications` + `create_notification()` · client-side jsPDF infrastructure · security helpers (`current_tenant_id`, `is_platform_admin`, `is_learner_guardian`, `can_view_academic`, `can_manage_academic`, `can_manage_assessment`, `can_view_behaviour`, …).

Prefer extending an existing domain over a competing parallel structure.

---

## No fake functionality

No fake APIs / integrations / mock production workflows / hardcoded production data / placeholder business logic / fake payment or government success / TODOs presented as complete / dead buttons / visual-only pages / client-side-only security / silently swallowed errors.

If an external dependency (API credentials, merchant account, government access, provider approval, external config) is required: implement everything that genuinely can be, document the **exact** dependency, and never fabricate credentials or claim an integration is live. (Precedent: the Finance payment-gateway architecture — complete adapters + webhook verification + tests, activated only when real provider secrets are supplied. See `docs/PAYMENT_GATEWAY.md`.)

---

## Testing standard

Per domain, as applicable: unit / calculation / integration / database / RLS / authorization / concurrency / Edge Function / E2E tests, plus `tsc -b --noEmit`, `eslint .`, `vite build`. Tests must exercise real business behaviour, and cover both authorized-success and unauthorized-failure paths.

**Verification commands:**

```
npx tsc -b --noEmit
npx eslint .
npx vitest run
supabase/rls-tests/run.sh            # Docker; spins its own throwaway Postgres
npm run build                        # tsc + vite build
npx playwright test                  # network-mocked; CI retries:1
cd supabase/functions && deno check <entrypoints> && deno lint && deno test   # only if the domain adds Edge Functions
```

---

## Git discipline

Before closing a domain: inspect `git status`; ensure no unrelated changes; verify migrations, tests, build, docs, and this tracker are updated; commit the domain on its own branch with a `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer. Working tree must be clean when a domain is closed. **Never rewrite or disturb the closed Finance commits.**

---

## Domain queue

Repo state assessed 2026-09-03. "Repo state" describes what already exists so the domain **extends** rather than duplicates it.

| #  | Domain | Status | Repo state / notes |
| -- | ------ | ------ | ------------------ |
| 1  | **Finance** | **CLOSED** | Complete. See the Finance record below. Do not reopen. |
| 2  | **Report Cards** | **CLOSED** | 2026-09-04. See the Domain 2 record below. Grading scales, templates, the `report_cards` entity, the Draft→Teacher Review→HOD Review→Approved→Published→Archived workflow, locking, versioning/reissue, weighted aggregation, attendance + conduct snapshots, individual + bulk PDF, publication-gated guardian/learner visibility. The old ad-hoc `buildReportCardData()` transcript on the learner Results tab is left in place (a lightweight "academic results" export, distinct from a governed report card). |
| 3  | **Admissions** | **QUEUED** | Partial: an internal staff Kanban ("Admissions Pipeline", `/admissions`, `useAdmissionsPipeline`) that moves a `learners.status` through `prospective → applied → accepted → enrolled`. **Missing:** parent-facing application portal (start/save/resume/submit, document upload), a real `applications` entity with the full status set (Draft/Submitted/Under Review/Incomplete/Interview/Assessment/Waitlisted/Accepted/Rejected/Withdrawn/Enrolled), configurable document requirements, admissions dashboard, and conversion (application → learner + guardian + enrolment + user accounts, no duplicates). Reconcile the existing pipeline into the new model — do not run two. |
| 4  | **Communication & Notifications** | **QUEUED** | Partial: `announcements` (school_owner/principal → staff/guardians/everyone) + in-app `notifications` (inbox, unread badge, real producers: guardian invitations, attendance alerts, fee reminders, document expiry) both exist with migrations. **Missing:** two-way threaded messaging / conversations (parent↔school, teacher↔parent, staff↔staff), read status + attachments + unread counts + search + archive, per-user notification preferences, email/SMS/WhatsApp delivery architecture (in-app only today), and additional automated triggers (report published, behaviour incident, application status change, event). |
| 5  | **Homework / Learning** | **QUEUED** | None. `assessment_type` includes `assignment`/`examination` but there is no homework-distribution / submission / return workflow distinct from the gradebook. Build assignments (class+subject+due+instructions+attachments+links+rubric), learner submission/resubmission, teacher review/mark/return/missing-tracking, statuses (Assigned/Submitted/Late/Returned/Reviewed), parent visibility. Reuse `assessments` linkage where a homework is also gradebook-scored; reuse storage + `class_teacher_assignments`. |
| 6  | **Teacher Workspace** | **QUEUED** | None (the "My Classes" nav item points at `/my-profile`). Build a unified teacher dashboard: today's timetable, classes, attendance status, upcoming assessments, homework, messages, notifications, learner alerts, outstanding marking, events; quick actions (take attendance, enter marks, create assignment, message parents, record behaviour, view learner). Pure composition over existing domains — **depends on 2, 4, 5, 16** for full content; a first pass can ship over timetable/attendance/assessments/behaviour and be extended. |
| 7  | **Parent Portal Completion** | **QUEUED** | Substantially done: `src/features/parentPortal/` — multi-child dashboard, per-child Attendance / Timetable / Academics / Fees / Behaviour / Documents / Consent tabs, Announcements, Notifications, and the new family Fees page (`/parent/fees`, invoices + receipts + Pay-now + statements). **Remaining:** messaging (dep 4), events (dep 16), report cards (dep 2), homework (dep 5), applications (dep 3). Final consolidation pass **after** its dependency domains close. |
| 8  | **Learner Portal** | **QUEUED** | None — no learner self-service login (`KNOWN_LIMITATIONS.md`). Groundwork exists: `learners.profile_id`, a disposable learner fixture, `learner` role in the union. Build a role-scoped learner experience (dashboard, timetable, subjects, assignments, results, attendance, documents, events, announcements, notifications) — **no admin surface**. Reuse the guardian-portal patterns and RLS shape (`learners.profile_id = auth.uid()`). Depends on 2, 5, 16 for full content. |
| 9  | **Transport** | **QUEUED** | None (two free-text fields on a learner record only). Build vehicles, drivers, routes, stops, learner assignments, schedules, transport fees (into the existing fee ledger — `fee_category` already has `transport`), transport attendance, pickup/dropoff records, parent notifications. Architecture to allow future GPS. |
| 10 | **Boarding / Hostel** | **QUEUED** | None. Groundwork: `learners.boarding_type` (`day_scholar`/`boarder`), `learner_enrollments.house` (free text). Build hostels/houses/rooms/beds/allocations, boarding attendance, house masters, boarding incidents (reuse `behaviour_incidents` where possible), check-in/out, leave permissions, boarding fees (fee ledger — `fee_category.boarding`). |
| 11 | **Library** | **QUEUED** | None. Build catalogue (books/ISBN/authors/publishers/categories), copies/locations, borrowing/returns/renewals/reservations, overdue tracking, lost/damaged, fines (fee ledger), learner borrowing history. |
| 12 | **Sports / Extracurricular** | **QUEUED** | None. Build sports/activities, teams, players, coaches, fixtures, competitions, venues, results, attendance, participation history, awards. Learners in multiple activities. Reuse `profiles` for coaches, `learners` for players. |
| 13 | **Assets / Inventory** | **QUEUED** | None. Build asset register, categories, asset/serial numbers, purchase info, supplier, location, assigned user, condition, maintenance, warranty, disposal, transfer, audit history. Barcode/QR architecture. Shares the supplier concept with 14. |
| 14 | **Procurement** | **QUEUED** | None. Build suppliers + contacts, purchase requests, approval workflow, quotations, purchase orders, goods received, supplier invoices, procurement history. Role-based approvals. Supplier-invoice payments may touch the finance ledger (money-out) — coordinate, do not fork it. |
| 15 | **SGB / Governance** | **QUEUED** | None. Build SGB members/roles/terms, meetings + attendance, agendas, minutes, resolutions, policies, governance documents (reuse storage), training, committee structures, decisions. Stricter access controls. |
| 16 | **Events** | **QUEUED** | None (timetable is period scheduling, not events). Build events (academic/sports/parent-meeting/staff-meeting/trip/exam), school calendar, holidays, event participants, notifications; integrate with dashboard, calendar, and the parent/teacher/learner portals. Blocks full completion of 6, 7, 8. |
| 17 | **SA-SAMS / CEMIS Interoperability** | **QUEUED** | Partial: generic learner CSV import (`src/features/learners/utils/csvImport.ts`, `e2e/learner-import.spec.ts`) and bank-statement CSV import exist as patterns; `schools.emis_number` exists. **Missing:** a dedicated interoperability layer — controlled import/export/validation/mapping/reconciliation for learners/guardians/staff/schools/grades/classes/subjects/attendance/assessments, with CSV + Excel, validation & error reports, duplicate detection, import/export history, mapping configuration. No undocumented government APIs — design so an official integration drops in later. |
| 18 | **Advanced Analytics** | **QUEUED** | Partial: `src/features/reports/` (learner / employee / academic / assessment / attendance reports, CSV export) + Finance Overview + dashboard KPIs. **Missing:** the fuller cross-domain analytical reports in the spec (class/subject/grade performance analysis, absence trends, revenue/ageing/method breakdowns, HR expiring-documents, admissions acceptance-rate/grade-demand, discipline trends) and Excel export. Best done after the domains that produce the data (2, 3, 5, 9–16). |
| 19 | **Automation / Notification Hardening** | **QUEUED** | Partial: `pg_cron`-ready workers exist (fee-overdue reminders/escalation, attendance alerts, document-expiry alerts) — triggered manually today, documented as cron-ready; `rate_limit_events` table exists. **Missing:** actual scheduled execution wiring, an email-delivery worker (the `notifications.email_status = 'not_sent'` hand-off point), SMS/WhatsApp provider adapters, and the automated triggers from domains 2–16. |
| 20 | **Final Security / POPIA / Production Hardening** | **QUEUED** | Partial but strong foundation: `consent_management`, `audit_log` (tamper-resistant, tenant-aware), `rate_limiting`, function-security-hardening migrations, the RLS harness, FORCE-RLS everywhere, `docs/product/FUNDA360-POPIA-READINESS-BRIEF.md`. **Missing:** operational POPIA workflows (data-access / DSAR export, correction, retention policies, deletion/anonymisation), a full cross-domain security review pass, and production deployment/runbook finalisation. **Must be last** — it reviews every prior domain. |

---

## Closed domains

### Domain 2 — Report Cards — `CLOSED` (2026-09-04)

**Do not reopen** unless a later domain exposes a genuine security or dependency defect.

- **Branch:** `feat/report-cards`
- **Migrations:** `20260904090000_grading_scales.sql`, `20260904100000_report_cards.sql` (additive: `create table` / `create type` / one `add column if not exists` — `assessments.weight`, the extension the assessments migration itself named).
- **Scope delivered:** reusable grading scales + non-overlapping achievement bands + `resolve_achievement()`; configurable report-card templates (section toggles, optional HOD-review step, grading scale); the `report_cards` + `report_card_subjects` entity; per-assessment weighting; `assessments.weight`-weighted subject aggregation + subject-weighted overall; term-range attendance + conduct snapshots; the **Draft → Teacher Review → HOD Review → Approved → Published → Archived** workflow (13 SECURITY-DEFINER RPCs, role-derived authority, no client-writable state); approval/publication locking; versioning + `reissue` (archive old, new v+1 draft); one-live-card partial unique index; bulk generate-for-class + bulk publish + one multi-page bulk PDF; individual client-side PDF; per-guardian `report_card_published` notification; staff routes `/report-cards`, `/report-cards/:id`, `/academic/grading-scales`, `/academic/report-templates`; learner-profile **Report cards** tab; Parent Portal child-profile **Report cards** tab (published only + PDF).
- **RBAC:** new permissions `reportcard.view` / `reportcard.manage` / `reportcard.approve` wired into `ROLE_PERMISSIONS`; SQL helpers `can_view_report_cards()` / `can_manage_report_card()` mirror them. `department_head` gained `reportcard.view` + `reportcard.manage` for the HOD-review step.
- **Verification (2026-09-04):** `tsc -b --noEmit` PASS · `eslint .` PASS · `vitest` **214** PASS (11 new) · RLS harness **556** PASS (39 new) · `vite build` PASS · report-card E2E **4/4** + fees/parent-portal/assessments regression **32/32** serial (`--workers=1`).
- **Security notes:** all 6 new tenant-scoped tables `ENABLE` + `FORCE ROW LEVEL SECURITY`, fail-closed; `report_cards` / `report_card_subjects` have **no** client INSERT/UPDATE/DELETE policy (workflow RPCs only) + `report_cards_protect` trigger backstop; guardian & learner see `status = 'published'` for their own child/record **only** (RLS-tested, incl. cross-learner and cross-tenant); locked-card edits raise `report_card_locked` (RLS-tested); reissue concurrency-safe via the one-live-card index; every transition writes `audit_log`. FK-doesn't-respect-RLS closed by `*_validate_tenant` triggers on every new table.
- **Docs:** `docs/REPORT_CARDS.md`.
- **Deferred (non-blocking):** WYSIWYG template designer (templates are toggles + notes); cross-term / year-end aggregate cards (each card is one term); emailing the PDF to guardians (in-app `report_card_published` is the hand-off; email delivery is Domain 19).

---

### Domain 1 — Finance — `CLOSED` (2026-09-03)

**Do not reopen, refactor, expand, or modify Finance** unless a later domain exposes a genuine security vulnerability or dependency defect in it.

- **Branch:** `feat/finance-invoicing-payments`
- **Commits:** `f33ccdb` (domain), `2bf9e1a` (acceptance-gate hardening)
- **Migrations:** `20260903090000_fees_invoicing.sql`, `20260903100000_payment_gateway.sql`, `20260903110000_finance_gate_hardening.sql` (all additive: `add column if not exists` / `create table` / `create type` / `create or replace function`)
- **Scope delivered:** numbered invoices (draft → issue → void, line items, VAT config, PDF, guardian-visible once issued); payment allocation (`allocate_fee_payment`, concurrency-safe); numbered receipts (`issue_fee_receipt`, idempotent); per-learner + per-family account statements with 5-bucket debtor ageing; client-side invoice/receipt/statement PDFs; provider-agnostic online payment gateway (`payment_gateway_configs` / `payment_intents` / `payment_webhook_events`, `create_payment_intent`, `settle_payment_intent`) with Edge Functions `payments-initiate` / `payments-webhook` and adapters for **PayFast, Ozow, Yoco, Peach, Netcash** (real signature/hash/decrypt verification); per-school billing settings; staff routes `/fees/invoices`, `/fees/settings`; parent routes `/parent/fees`, `/parent/payment-return`.
- **Verification (2026-09-03):** `tsc -b --noEmit` PASS · `eslint .` PASS · `vitest` 203 PASS · RLS harness **517** PASS · `vite build` PASS · `deno check` / `deno lint` / `deno test` (7) PASS · Finance E2E **21/21** serial (`--workers=1`).
- **Security gate: 12/12 PASS** — additive & reversible; no unsafe direct client mutation of protected financial state (RPC-only tables + trigger-locked invoice state); FORCE RLS + fail-closed on all 7 new tables; guardians see only their own children's **issued** financial records; drafts / gateway config / webhook events / secrets invisible to guardians; payment allocation atomic & impossible to over-allocate under concurrency (verified with a real two-session interleave); invoice/receipt numbering not client-manipulable (`revoke … from authenticated`); webhook processing idempotent under duplicate & concurrent delivery; provider secrets only in Edge Function env (never DB/frontend/logs/git); PDFs contain only data the requester is authorized to access; Finance E2E passes in serial; pre-existing Playwright flakes documented, not worked around. Full gate detail in `docs/FUNDA360_KNOWN_LIMITATIONS.md`.
- **Docs:** `docs/FINANCE.md`, `docs/PAYMENT_GATEWAY.md`, `docs/FUNDA360_KNOWN_LIMITATIONS.md` (gate + deferred items), `.env.example` (Edge secret names).
- **Deferred (non-blocking, do not remove from `KNOWN_LIMITATIONS.md`):**
  - recurring billing automation (a scheduler that auto-generates monthly/termly charges — today a payment plan is several charges with different due dates)
  - advanced finance-dashboard breakdowns / series (grade-level, payment-method, daily/monthly/term — collection rate, outstanding, arrears, ageing and the debtor list already exist)
  - dedicated fee-category enum values beyond `tuition / transport / boarding / uniform / activity / other` (other fee types use `other` + a description)
- **Production activation dependency:** live online payments require the two Edge Functions deployed **and** the chosen provider's secret keys supplied via `supabase secrets set …` (see `docs/PAYMENT_GATEWAY.md`). Until then the app cleanly reports "online payment unavailable" and staff record payments manually.

---

## Supporting documents (historical / reference — not the roadmap)

`docs/product/FUNDA360-TOP-TIER-KANBAN.md`, `docs/product/FUNDA360-GAP-ANALYSIS.md`, `docs/product/FUNDA360-CURRENT-STATE.md`, `docs/product/FUNDA360-DEFINITION-OF-DONE.md` predate this tracker. Where they disagree with `DOMAIN_STATUS.md`, **this file wins.**
