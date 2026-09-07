# Funda360 — Domain Status Tracker

**This file is the authoritative roadmap and source of truth for the remaining Funda360 development sequence.**

Funda360 is completed **one full domain at a time**:

> **ONE DOMAIN → COMPLETE → VERIFY → DOCUMENT → COMMIT → CLOSE → NEXT DOMAIN**

No artificial sprints or milestones inside a domain. A domain is implemented completely, verified, documented, committed, and marked `CLOSED` before the next begins. This is a **one-domain-per-development-session** strategy — do not chain multiple major domains in a single session.

Statuses: `QUEUED` · `IN_PROGRESS` · `BLOCKED` · `CLOSED`

Last updated: 2026-09-07 — Domain 6 (Teacher Workspace) CLOSED.

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
| 3  | **Admissions** | **CLOSED** | 2026-09-04. See the Domain 3 record below. `admission_applications` entity + full workflow + configurable document requirements + admissions dashboard + `convert_admission_application` (→ learner + guardian + enrolment, deduped) + a public intake form (`/apply`) served by the `admissions-public` Edge Function. The old learner-status Kanban is removed (enum unchanged). |
| 4  | **Communication & Notifications** | **CLOSED** | 2026-09-07. See the Domain 4 record below. Threaded messaging (`conversations` / `conversation_participants` / `messages` / `message_attachments`, direct + group, RPC-only writes, per-user read cursor / archive / mute, `can_message_profile` staff↔anyone / guardian↔staff-only), per-user `notification_preferences` (email/SMS/WhatsApp opt-in + per-type overrides + quiet hours; in-app always on), the multi-channel delivery outbox (`notification_deliveries` + `school_messaging_settings` + `enqueue_notification_deliveries` inside `create_notification` + the `notifications-dispatch` Edge Function with real Resend/Twilio adapters, activated only on provider secrets), and a new `behaviour_incident` guardian-notification producer. |
| 5  | **Homework / Learning** | **CLOSED** | 2026-09-07. See the Domain 5 record below. `assignments` (class+subject+due+instructions+rubric+resources) with a draft→published→closed lifecycle, `assignment_submissions` (one 'assigned' row per enrolled learner at publish, RPC-only state), submit / resubmit (learner-self, guardian-on-behalf, or staff), teacher mark/return/excuse with missing-tracking, gradebook (`assessment_results`) sync when linked to an `assessment_id`, guardian/learner visibility, guardian notifications. New `is_learner_self()` helper (Domain 8 groundwork). Reuses `class_teacher_assignments` / `assessments` / storage. |
| 6  | **Teacher Workspace** | **CLOSED** | 2026-09-07. See the Domain 6 record below. `/my-classes` (the "My Classes" nav item, was `/my-profile`) — a composed teacher dashboard: today's published lessons (in-progress highlighted), per-class register-taken status, homework awaiting marking, upcoming assessments, my classes, unread messages/notifications, quick actions. **No migration** — pure RLS-scoped composition. First pass per the tracker; extends for Events (16) + learner alerts. |
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

### Domain 6 — Teacher Workspace — `CLOSED` (2026-09-07)

**Do not reopen** unless a later domain exposes a genuine security or dependency defect.

- **Branch:** `feat/teacher-workspace`
- **Migration:** none — pure composition over existing domains.
- **Scope delivered:** `/my-classes` renders `TeacherWorkspacePage` (the sidebar "My Classes" item, previously pointing at `/my-profile`, now points here). Cards: **today's lessons** (`timetable_entries` where `teacher_profile_id = auth.uid()`, day = today, `status = published`; in-progress lesson highlighted via `currentOrNextLesson`), **attendance** (per assigned class, whether an `attendance_records` row exists for today), **homework to mark** (own published `assignments` + count of `submitted`/`late` submissions), **upcoming assessments** (next 10 for the teacher's classes), **my classes** (`class_teacher_assignments`), **inbox** (unread conversations + notifications). Quick actions → attendance / assessments / homework / messages / learners.
- **RBAC:** route gated on `academic.view` (all teacher-variant roles + academic managers). No new permission. Every query is already RLS-scoped.
- **Verification (2026-09-07):** `tsc -b --noEmit` PASS · `eslint .` PASS · `vitest` **240** PASS (7 new — `workspaceSummary.test.ts`) · RLS harness **623** PASS (unchanged — no SQL) · `vite build` PASS · `teacher-workspace.spec.ts` E2E **1/1** + `my-profile` regression **6/6**.
- **Security notes:** no server component; nothing new to secure. The page composes only data the signed-in user's existing RLS policies already return.
- **Docs:** `docs/TEACHER_WORKSPACE.md`.
- **Deferred (non-blocking):** a "Today's events" card (Domain 16), a cross-class "learners needing attention" aggregation of `learnerAlerts.ts`, and a dedicated behaviour-capture entry point (the quick action routes to `/learners` today).
- **Production activation:** none — ships with the frontend.

---

### Domain 5 — Homework / Learning — `CLOSED` (2026-09-07)

**Do not reopen** unless a later domain exposes a genuine security or dependency defect.

- **Branch:** `feat/homework`
- **Migration:** `20260908090000_homework.sql` (4 new tables, 2 enums, 1 private storage bucket + policies, 3 helper functions + 8 workflow RPCs; additive).
- **Scope delivered:** `assignments` (class + subject + optional due/points/rubric/`assessment_id` link; `draft` → `published` → `closed`, status RPC-only via `assignments_protect`), `assignment_resources` (teacher links/files), `assignment_submissions` (one `assigned` row per actively-enrolled learner at `publish_assignment()`, all state RPC-only via `assignment_submissions_protect` — `assigned` → `submitted`/`late` → `returned`/`reviewed`, plus `excused`), `assignment_submission_files` (learner hand-ins). RPCs: `create_assignment`, `publish_assignment` (fan-out + `assignment_published` notify to guardians), `close_assignment`, `submit_assignment` (learner-self `is_learner_self` / guardian-on-behalf `is_learner_guardian` / staff; auto `late` from `due_at`; resubmission gated by `allow_resubmission`), `mark_assignment_submission` (`finalise` → `reviewed`/`returned`; guardian notify; **upserts `assessment_results` when `assessment_id` is set** — gradebook reuse, not a parallel system), `excuse_assignment_submission`, `register_assignment_resource`, `register_submission_file`. "Missing" is derived (`assigned` + past `due_at`).
- **New helper:** `is_learner_self(uuid)` (`learners.profile_id = auth.uid()`) — Domain 8 groundwork, used now for guardian-on-behalf-free learner access. `can_manage_homework(school_id, class_id)` mirrors `can_manage_assessment` (deliberately duplicated, not cross-called).
- **RBAC:** no new permission. Staff reach `/homework` under `assessment.view` / `assessment.manage`; guardian/learner visibility is RLS-only (`is_learner_guardian` / `is_learner_self` + a submission row on a non-draft assignment — the `assessments_select_for_guardians` shape).
- **Verification (2026-09-07):** `tsc -b --noEmit` PASS · `eslint .` PASS · `vitest` **233** PASS (8 new — `homeworkDisplay.test.ts`) · RLS harness **623** PASS (18 new — `homework.test.sql`) · `vite build` PASS · `homework.spec.ts` E2E **2/2** + assessments/academic/parent-portal/command-palette regression **32/32** serial.
- **Security notes:** all 4 new tables `FORCE ROW LEVEL SECURITY`, fail-closed. Submission state is entirely RPC-mediated (no client write policy + protect trigger requiring `app.allow_submission_write`); assignment status likewise (`assignments_protect` + `app.allow_assignment_write`). `*_validate_tenant` triggers on every new table. `assignment-files` bucket read resolves the object path to a registered resource/submission-file and re-checks the guardian/learner relationship; every create/publish/close/submit/mark/excuse writes `audit_log`. Cross-tenant + unassigned-teacher + wrong-family-guardian rejections RLS-tested.
- **Docs:** `docs/HOMEWORK.md`.
- **Deferred (non-blocking):** rubric-scored marking UI (columns exist, single points field today), file hand-in UI (bucket + RPC exist), a cross-class teacher "to mark" queue (Domain 6), learner-self submission UX (Domain 8 — RPC already accepts it).
- **Production activation:** no new credentials. The `assignment-files` bucket is created by the migration.

---

### Domain 4 — Communication & Notifications — `CLOSED` (2026-09-07)

**Do not reopen** unless a later domain exposes a genuine security or dependency defect.

- **Branch:** `feat/communication`
- **Migration:** `20260907090000_communication.sql` (7 new tables, 3 enums, 1 private storage bucket + policies, ~15 functions; additive — `create_notification()` re-declared with its exact prior body + one `perform` call, same "extend the sole write path in place" move announcements made with `send_guardian_invitation`).
- **Scope delivered:**
  - **Threaded messaging** — `conversations` (`kind` direct/group, `subject`, denormalised `last_message_at`/`message_count`), `conversation_participants` (per-user `last_read_at` cursor + `archived` + `muted`), append-only `messages` (soft edit/delete with tombstone), `message_attachments` (private `message-attachments` bucket, path `<school_id>/<conversation_id>/<file>`). All writes via 8 SECURITY-DEFINER RPCs (`start_conversation` — reuses an existing direct pair, never duplicates; `send_message` — fans out a `message` notification to non-muted participants, role-routed link_path; `edit_message`/`delete_message` — sender only; `mark_conversation_read`; `set_conversation_flags`; `add_conversation_participants` — group + staff only; `register_message_attachment`). `can_message_profile()`: staff↔anyone in tenant, guardian↔staff only, no cross-tenant. **No new `Permission`** — messaging is open to every authenticated tenant member (like email); the gate is on the counterparty.
  - **Notification preferences** — `notification_preferences` (own-row RLS, upsert), email/SMS/WhatsApp opt-in, `type_overrides` jsonb (data model + `resolve_notification_channels()` honour it; UI exposes global toggles + quiet hours), quiet hours delay only external `scheduled_for`. Routes `/notifications/settings`, `/parent/notifications/settings`.
  - **Delivery architecture** — `notification_deliveries` outbox (pending → the documented drain query), `school_messaging_settings` per-school non-secret config (`/settings/messaging`, `school.manage`), `enqueue_notification_deliveries()` runs at the end of `create_notification()` so every existing + future producer gets multi-channel delivery. `supabase/functions/notifications-dispatch` — `x-dispatch-secret`-gated worker with real Resend (email) + Twilio (SMS/WhatsApp) adapters; a channel with no provider secret leaves its rows `pending` untouched. **No third-party credentials required to deploy the app**; delivery activates when secrets are set (`docs/NOTIFICATIONS_DELIVERY.md`).
  - **New producer** — `behaviour_incidents_notify_guardians()`: a `guardian_visible AND active` behaviour incident notifies the learner's active guardians once each; mirrors `get_guardian_visible_behaviour_incidents()`'s opt-in model; idempotent. (Report-published / invoice / payment / attendance-streak / fee-overdue / document-expiry producers already existed and are unchanged.)
- **RBAC:** no new permission. `school.manage` reused for `/settings/messaging` (same role set an ad-hoc `communication.manage` would need — the announcements precedent).
- **Verification (2026-09-07):** `tsc -b --noEmit` PASS · `eslint .` PASS · `vitest` **225** PASS (11 new — `conversationDisplay.test.ts`) · RLS harness **605** PASS (28 new — `communication.test.sql`) · `vite build` PASS · `messaging.spec.ts` E2E **3/3** + notifications/announcements/parent-portal regression **18/18** serial. `notifications-dispatch/index.ts` added to the CI `deno check` list (`deno` not installed on the local dev box; the `edge-functions` CI job runs it).
- **Security notes:** all 7 new tables `FORCE ROW LEVEL SECURITY`, fail-closed. `conversations` / `messages` / `message_attachments` are SELECT-only for `authenticated` (participant-scoped via `is_conversation_participant()`); `conversation_participants` UPDATE is own-row + `conversation_participants_protect` trigger pins it to cursor/archive/mute; `notification_deliveries` has no write policy at all (RPC + service_role only). `*_validate_tenant` triggers close FK-doesn't-respect-RLS on every new table. Provider secrets only in Edge Function env. `resolve_notification_channels` / `notification_delivery_schedule` / `enqueue_notification_deliveries` `revoke execute … from public`. Cross-tenant messaging isolation RLS-tested; guardian↔guardian block RLS-tested; every `start_conversation` / participant-add writes `audit_log`.
- **Docs:** `docs/COMMUNICATION.md`, `docs/NOTIFICATIONS_DELIVERY.md`.
- **Deferred (non-blocking):** message full-text search UI (the `messages_body_fts_idx` GIN index exists; the service filters client-side today); typing indicators / realtime (the app uses no Supabase Realtime anywhere yet — `useUnreadConversationCount` polls); `type_overrides` editing UI; per-school email templating; scheduled execution wiring for `notifications-dispatch` + a delivery dashboard + provider bounce webhooks (Domain 19); application-status-change and event notifications (applicants have no account — Domain 19 emails them; events are Domain 16).
- **Production activation:** the app deploys unchanged with **no new credentials**. External delivery: `supabase functions deploy notifications-dispatch` + `supabase secrets set NOTIFICATIONS_DISPATCH_SECRET / RESEND_API_KEY / TWILIO_*` + schedule it + enable channels per school. Until then everything is in-app and nothing falsely claims to have sent mail.

---

### Domain 3 — Admissions — `CLOSED` (2026-09-04)

**Do not reopen** unless a later domain exposes a genuine security or dependency defect.

- **Branch:** `feat/admissions`
- **Migration:** `20260905090000_admissions.sql` (5 new tables, 1 enum, 14 RPCs, a private storage bucket + policies; additive — no change to `learners.status` or its transitions).
- **Removed:** the learner-status Kanban (`useAdmissionsPipeline`, `AdmissionsPipelineBoard`, `AdmissionsPipelinePage`, `ADMISSIONS_PIPELINE_STAGES`/`ADMISSIONS_NEXT_STATUS`). `/admissions` now renders the application dashboard.
- **Scope delivered:** `admission_applications` + `admission_application_documents` + `admission_application_events` + `admission_document_requirements` + `admission_counters`; the `draft → submitted → under_review → {incomplete, interview_required, assessment_required, waitlisted} → accepted → enrolled` (+ rejected/withdrawn) workflow via 5 staff RPCs (`create` / `submit` / `transition` / `add_note` / `convert`); `convert_admission_application` — one transaction producing a `learners` row (minted `LRN-/ADM-` numbers), a de-duped `learner_guardians` link (reuse existing profile, else `admin_create_guardian`, optional `send_guardian_invitation`), and a `learner_enrollments` row; a public intake form at **`/apply?school=<id>`** + **`/apply/resume`** served by the **`admissions-public` Edge Function** (service-role; `public_*` RPCs granted to `service_role` only; no anon RLS anywhere); staff routes `/admissions`, `/admissions/:id`, `/admissions/requirements`; signed-URL document viewing + staff verification; per-application timeline + internal notes.
- **RBAC:** new `admission.view` (school_owner / principal / vice_principal / admissions_officer / receptionist / platform) and `admission.manage` (school_owner / principal / admissions_officer / platform); SQL helpers `can_view_admissions()` / `can_manage_admissions()` mirror them.
- **Verification (2026-09-04):** `tsc -b --noEmit` PASS · `eslint .` PASS · `vitest` 214 PASS · RLS harness **577** PASS (21 new) · `vite build` PASS · admissions E2E **4/4** + learners/parent-portal/report-cards/fees regression **37/37** serial. `admissions-public/index.ts` added to the CI `deno check` list (`deno` not installed on the local dev box; the `edge-functions` CI job runs it).
- **Security notes:** all 5 new tables `FORCE ROW LEVEL SECURITY`, fail-closed; `admission_applications` status/decision/reference/conversion columns trigger-guarded (`app.allow_admission_write`) so even a manager's direct `UPDATE` can't forge a decision (RLS-tested); `admission_application_events` write-only via RPC; `next_admission_reference` + all `public_*` RPCs `revoke … from public` **and** `from authenticated` / `service_role`-only (RLS-tested); private `admission-documents` bucket gated by `can_view/manage_admissions` on the path's school id; cross-tenant isolation RLS-tested; every transition + conversion writes `audit_log`.
- **Docs:** `docs/ADMISSIONS.md`.
- **Deferred (non-blocking):** emailing applicants (draft link / decision letters — Domain 19); configurable per-school application forms; CAPTCHA / rate-limiting on the public form (the Edge Function is the ready choke point); interview/assessment scheduling UI (columns + statuses exist, no calendar).
- **Production activation:** deploy `supabase functions deploy admissions-public --no-verify-jwt` — needs only the existing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, **no third-party credentials**. Each school shares its own `/apply?school=<id>` link.

---

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
