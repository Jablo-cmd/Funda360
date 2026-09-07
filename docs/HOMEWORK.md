# Homework / Learning

Domain 5. Migration: `supabase/migrations/20260908090000_homework.sql`.

A homework-distribution / submission / return workflow **distinct from the
gradebook**. `assessment_type` already has an `assignment` value, but
`assessments` models a gradable *event* (one row, N marks) — no per-learner
submission, no due-date + late tracking, no return-for-redo, no hand-in
files. This domain adds that.

## Tables

| Table | Purpose |
| ----- | ------- |
| `assignments` | One piece of homework for a class + subject. `status` `draft` → `published` → `closed`. Optional `due_at`, `max_points`, `rubric` (jsonb `[{criterion, points}]`), `allow_resubmission`, and `assessment_id` (link to a gradebook assessment). `status` / `published_at` / `closed_at` are RPC-only (`assignments_protect`). |
| `assignment_resources` | Teacher-attached links / files (private `assignment-files` bucket). |
| `assignment_submissions` | One row per (assignment, learner), created `assigned` by `publish_assignment()` for every enrolled learner. `status`: `assigned` → `submitted` \| `late` → `returned` (redo) \| `reviewed` (final); `excused`. All state RPC-only (`assignment_submissions_protect` — writes require `app.allow_submission_write`). |
| `assignment_submission_files` | Learner-attached hand-ins. |

## Lifecycle

```
create_assignment (draft)
   │  publish_assignment  ──→ one 'assigned' submission per actively-enrolled learner
   │                          + guardians notified (assignment_published)
   ▼
submit_assignment(assignment, learner, text)   ──→ submitted | late  (is_late from due_at)
   │   (by the learner themselves — learners.profile_id = auth.uid(), Domain 8 —
   │    OR by a guardian on their behalf — is_learner_guardian — OR by staff)
   ▼
mark_assignment_submission(sub, points?, feedback?, finalise)
   │   finalise=true  → reviewed   (final)
   │   finalise=false → returned   (learner may resubmit if allow_resubmission)
   │   + guardians notified (assignment_reviewed / assignment_returned)
   │   + if assignment.assessment_id set and a mark was given → upsert assessment_results
   ▼
close_assignment  (published → closed)
excuse_assignment_submission  →  excused
```

"Missing" is derived, not stored: `status = 'assigned' AND due_at < now()`.

## Authorization

- **Staff:** `can_manage_homework(school_id, class_id)` — mirrors `assessment.manage`, per-class via `class_teacher_assignments` for teacher-variant roles, broad for `can_manage_academic` roles. Deliberately duplicated from `can_manage_assessment()` rather than called across domains (same "duplicated logic, not duplicated risk" reasoning that function documents). Staff view uses `can_view_academic(school_id)`.
- **Guardian / learner:** sees a **published** assignment, its resources and its own submission only if their linked learner has a submission row for it — `is_learner_guardian(learner_id)` / `is_learner_self(learner_id)` (the new `is_learner_self` helper is also Domain 8 groundwork). Same shape as `assessments_select_for_guardians`.
- **No new `Permission`** — staff reach it under `assessment.view` / `assessment.manage` (the sidebar "Homework" item and the `/homework` routes are gated on `assessment.view`); the guardian view is RLS-only.

## RLS

All four tables `ENABLE` + `FORCE ROW LEVEL SECURITY`, fail-closed.
`assignment_submissions` / `assignment_submission_files` are SELECT-only for
`authenticated`; `assignments` has manager INSERT/UPDATE (status still
trigger-guarded); `assignment_resources` has manager INSERT/UPDATE.
`*_validate_tenant` triggers close FK-doesn't-respect-RLS. The
`assignment-files` bucket read policy resolves the object path to a
registered resource / submission file and checks the guardian/learner
relationship; write pins the tenant path (the `register_*` RPCs hold the
real authorization).

## UI

- Staff: `/homework` (list + create-draft modal), `/homework/:id` (publish/close, the class submission grid with roll-up counts, inline marking).
- Guardian: `/parent/homework` (their children's assignments), `/parent/homework/:assignmentId` (instructions, status/mark/feedback, submit / resubmit).

## Verification

`tsc` · `eslint` · `vitest` **233** (8 new — `homeworkDisplay.test.ts`) · RLS harness **623** (18 new — `homework.test.sql`) · `vite build` · `homework.spec.ts` E2E 2/2 + assessments/academic/parent-portal/command-palette regression 32/32 serial.

## Deferred (non-blocking)

Rubric-scored marking UI (the `rubric` / `rubric_scores` columns exist; marking is a single points field today), file hand-in UI (the bucket + `register_submission_file` RPC exist), a cross-class "to mark" teacher queue (Domain 6 — Teacher Workspace composes it), and learner-self submission UX (Domain 8 — the RPC already accepts it).
