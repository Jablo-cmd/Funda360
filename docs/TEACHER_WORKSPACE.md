# Teacher Workspace

Domain 6. **No migration** — this is pure composition over existing
domains. A single page, `/my-classes` (the sidebar "My Classes" item, which
previously pointed at `/my-profile`), that aggregates a teacher's day.

## What it shows

| Card | Source |
| ---- | ------ |
| Today's lessons | `timetable_entries` where `teacher_profile_id = auth.uid()`, `day_of_week` = today, `status = 'published'`, sorted by start time; the in-progress lesson is highlighted (`currentOrNextLesson`). |
| Attendance | For each class the teacher is assigned to (`class_teacher_assignments`), whether an `attendance_records` row exists for today. Classes with no register are flagged. |
| Homework to mark | The teacher's own published `assignments`, each with a count of `assignment_submissions` in `submitted` / `late`. |
| Upcoming assessments | `assessments` for the teacher's classes, `assessment_date` from today, next 10. |
| My classes | `class_teacher_assignments` (class + subject). |
| Inbox | Unread conversation count (`useUnreadConversationCount`, Domain 4) + unread notification count (`useNotifications`). |

Quick actions link to Take attendance, Enter marks, Create homework,
Message parents, View learners.

## Authorization

The route is gated on `academic.view` (every teacher-variant role holds it,
as do academic managers). Every underlying query is already RLS-scoped —
`class_teacher_assignments` / `timetable_entries` to the teacher's own
rows, `assessments` / `assignments` via `can_view_academic` and the
domain's own policies. There is no server component and no new permission.

## Composition boundary

This is the "first pass" the tracker calls for — timetable / attendance /
assessments / homework / messages / notifications. It is designed to be
extended:

- **Events (Domain 16)** — a "Today's events" card slots in when events exist.
- **Learner alerts** — `learnerAlerts.ts` already computes per-learner attendance/behaviour flags; a "learners needing attention" card can aggregate them across the teacher's classes once a cross-class query exists.
- **Behaviour** — a "record behaviour" quick action currently routes to `/learners`; a dedicated incident-capture entry point can replace it.

## Verification

`tsc` · `eslint` · `vitest` **240** (7 new — `workspaceSummary.test.ts`) · RLS harness **623** (unchanged — no SQL) · `vite build` · `teacher-workspace.spec.ts` E2E 1/1 + `my-profile` regression 6/6.
