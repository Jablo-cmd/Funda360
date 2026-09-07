# Learner Portal

Domain 8. Migration: `supabase/migrations/20260910090000_learner_portal.sql`.

A role-scoped, **read-only**, self-service experience for a learner signing
in as themselves. Mirrors the Parent Portal exactly — no new identity
table, no new auth flow, no duplicated relationship.

## Provisioning

`provision_learner_login(learner_id, email, phone?)` — `SECURITY DEFINER`,
gated by `can_manage_learners()`. Creates `auth.users` + `auth.identities`
+ a `profiles` row (role `learner`) and links `learners.profile_id`.
Returns a one-time temporary password (same shape as
`provision_employee_login()`). Rejects if the learner already has a linked
login or the email is registered. Writes `audit_log`. Surfaced as a
"Provision login" button on the staff learner profile page (hidden once
`profile_id` is set).

## Access — `is_learner_self(learner_id)`

`is_learner_self` (`learners.profile_id = auth.uid()`, added in the
Homework domain) is the learner-themselves counterpart of
`is_learner_guardian`. This migration adds one additive `SELECT`-only
policy per table, the exact `parent_portal_v1` pattern:

| Category | Tables | Clause |
| -------- | ------ | ------ |
| Reference data | `grades`, `classes`, `subjects`, `class_teacher_assignments`, `timetable_entries` | `can_view_academic_reference_as_learner(school_id)` (tenant + role, not per-row — non-sensitive catalogue data) |
| Personal | `learner_enrollments`, `attendance_records`, `assessment_results`, `learner_documents` (+ storage) | `is_learner_self(learner_id)` |
| Personal (no learner_id) | `assessments` | `EXISTS` a result for a self learner |

Homework (`assignments` / `assignment_submissions`) and Report Cards
(`report_cards_select_learner`) already carried `is_learner_self` /
`profile_id = auth.uid()` clauses from their own domains — untouched here.

**Behaviour and medical are deliberately not exposed** — same reasoning
`parent_portal_v1` documents for guardians (no per-row visibility tier).
The learner's own `learners` row was already visible via
`learners_select`'s `profile_id = auth.uid()` clause.

## Announcements fix

The `all_staff` audience test was `role not in ('parent','guardian')`,
which a `learner` role wrongly matched. Both the `announcements_select`
policy and the `announcements_notify_recipients()` fan-out are re-declared
to also exclude `'learner'`, and a learner recipient's `link_path` now
routes to `/learner/announcements`.

## UI

`/learner/*` under `RequireLearnerRole` + `LearnerLayout` (mirrors
`ParentLayout`, its own `LearnerNav`). Pages: dashboard, timetable, homework
(view + submit / resubmit), results, report cards, attendance, documents,
announcements, notifications, profile. Timetable / results / attendance /
documents / report-cards reuse the Parent Portal's `Child*` components
directly via `useMyLearnerRecord`. A learner landing on `/dashboard` is
redirected to `/learner/dashboard` (`RedirectGuardiansToParentPortal`
extended). No messaging (deferred — not in the Domain 8 scope list), no
events (Domain 16).

## Verification

`tsc` · `eslint` · `vitest` **240** (unchanged) · RLS harness **640** (13 new — `learner_portal.test.sql`) · `vite build` · `learner-portal.spec.ts` E2E 3/3 + parent-portal / learners / login regression 28/28 serial.

## Deferred (non-blocking)

Learner ↔ staff messaging (Domain 4's `send_message` would need a
`/learner/messages` route + link routing for the `learner` role), a
"Today's events" surface (Domain 16), and a learner-facing subjects
catalogue page (reference data is visible; no dedicated page).
