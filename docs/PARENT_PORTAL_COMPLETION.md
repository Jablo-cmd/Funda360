# Parent Portal Completion

Domain 7 — the consolidation pass that wires the now-closed dependency
domains into the guardian experience. Migration:
`supabase/migrations/20260909090000_parent_portal_completion.sql` (one RPC).

## What was already done by the dependency domains

| Dep | Guardian surface it shipped |
| --- | -------------------------- |
| **2 Report Cards** | Child-profile **Report cards** tab (published only + PDF) — `LearnerReportCardsSection variant="family"`. |
| **4 Communication** | `/parent/messages` + `/parent/messages/:id`, `/parent/notifications/settings`, ParentNav "Messages". |
| **5 Homework** | `/parent/homework` + `/parent/homework/:assignmentId` (family-wide list + submit), ParentNav "Homework". |

## What Domain 7 adds

1. **Per-child Homework tab** — `ChildHomeworkTab` on the child profile page: that one child's assignments (RLS-scoped via `is_learner_guardian` + a submission row), read-only, each linking to the family homework detail page for submitting.
2. **Parent dashboard roll-ups** (`useParentPortalHome`):
   - **Homework to do** — outstanding assignments (`assigned` / `returned`) across all children, with an overdue count.
   - **Your applications** — the admission application(s) the guardian filed, via the new `get_my_admission_applications()` RPC.
3. **`get_my_admission_applications()`** — a narrow `SECURITY DEFINER` read. `admission_applications` RLS is staff-only by design (an application predates any account); this projects only applicant-safe columns (no `decision_reason` / `resume_token` / internal event trail), scoped by `lower(applicant_email) = the caller's own profile email`, and excludes drafts. `revoke … from public`, granted to `authenticated`.

## Not in scope (dependency not closed)

**Events (Domain 16)** — a "Upcoming events" card on the dashboard and a
child-profile Events tab are deferred until events exist.

## Verification

`tsc` · `eslint` · `vitest` **240** (unchanged — no new pure util) · RLS harness **627** (4 new — `parent_portal_completion.test.sql`) · `vite build` · `parent-portal-completion.spec.ts` E2E 1/1 + `parent-portal` regression 11/11 serial.
