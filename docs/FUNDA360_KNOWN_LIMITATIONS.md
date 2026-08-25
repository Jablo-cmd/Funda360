# Funda360 — Known Limitations

Honest, audit-verified limitations as of the pilot release. None of these are blockers — Funda360 is pilot ready — but pilot users and coordinators should know about them upfront rather than discover them mid-pilot.

Each item is labeled:

- **Pilot limitation** — a real gap in what the product currently does. Worth knowing before you rely on it for that purpose.
- **Technical debt** — a known, non-visible weak spot in the code that doesn't currently cause a problem but should be addressed before a wider rollout.
- **Local-development behavior** — only occurs in this local test environment, not expected in the pilot's actual hosted deployment.

---

## Pilot limitations

- **No parent or guardian self-service login.** Guardians can be linked to a learner's record by staff, and the underlying "My Children" self-service view exists in the code — but there is currently no way, anywhere in the product, to actually create a parent/guardian login account. Guardian access is not available for this pilot.
- **No student/learner self-service login.** Learners have no way to sign in and see their own information. All learner data is viewed and managed by staff.
- **Guardian linking on a learner's profile will show an empty search.** Because no guardian accounts can be created (above), the "Add guardian" search on a learner's profile has no candidates to find in a fresh pilot school. Don't rely on this during a live demonstration.
- **No fee, billing, or payment functionality.** Nothing in Funda360 handles school fees or payments.
- **No timetable.** Attendance is one status per learner per class per day — there is no period/subject timetable underneath it.
- **No homework or exam-scheduling workflow distinct from the general gradebook.** "Assignment" and "Examination" exist only as types within the general Assessments feature (tests, assignments, exams, projects, quizzes all use the same mark-entry workflow) — there's no separate homework-distribution or exam-scheduling feature.
- **No report card generation.** Assessment marks can be entered and reported on, but there is no printable/PDF report card.
- **No messaging, notifications, or announcements.** There is no way to message a parent, notify a teacher, or post a school announcement from within Funda360.
- **Only three roles are assignable directly from Users & Roles** (School Administrator, Principal, Teacher). Other staff roles (HR Manager, Admissions Officer, Medical Officer, Department Head, Receptionist, Accountant, Librarian) must first exist as an Employee record and are then provisioned a login from that employee's profile. A handful of role names that exist in the system (e.g. Finance Manager, Transport Coordinator, Sports Coordinator, Vice Principal, Auditor) currently have no way to be assigned to anyone and carry no real permissions — treat them as not available for this pilot.
- **No transport, library, discipline/behaviour, payroll, or leave-management features.** Transport is limited to two free-text fields on a learner's record; none of the others exist at all.

## Architecture decisions

- **Every Funda360 staff member is a school-bound identity, and every email address is globally unique across the whole platform — both by design, not limitation.** A profile belongs to exactly one school for its entire life; there is no such thing as one account with access to two schools, and there never will be under this model. If someone leaves School A and later joins School B, they get a **new, independent profile** at School B with its **own, different email address** — not their old one reused, transferred, or merged. Concretely:
  - `profiles.email` is a global (not per-school) unique index, and `admin_create_user()`/`provision_employee_login()` both check the same global uniqueness against `auth.users.email` before creating any login. Attempting to reuse an email that already exists anywhere on the platform — at the same school, a different school, or a deactivated former profile — is rejected outright (`email_taken`), for every actor who can create a user, not merely a platform admin.
  - There is no code path, anywhere, that attaches an *existing* profile to a different school. Every user-creation route (`admin_create_user`, `provision_employee_login`) always creates a brand-new `auth.users` + `profiles` row; neither has any "link this existing account" branch. A receiving school's administrator cannot even *see* another school's existing profile to attach it in the first place — every profile search in the product (the Users directory, guardian-candidate search, teacher-candidate search) is tenant-scoped both in the client query and by RLS underneath it, so a School B admin searching by a School A person's exact known email gets zero rows back.
  - `profiles.tenant_id` can only ever be set once, at creation — no RPC or RLS policy permits changing an existing profile's `tenant_id`, and a direct attempt is blocked even for a platform admin (`20260803140000_prevent_direct_tenant_change.sql`).
  - Leaving a school is a deactivation, never a delete: the old profile's `status` flips to `inactive`, and everything it ever created or touched (attendance, assessments, employee records, and so on) stays exactly where it is, associated with that school, forever — deactivation never cascades to a single other row.
  - There is no tenant-switcher for ordinary staff, and there never will be one under this model — Principal, Teacher, HR Manager, and every other school-level role are permanently single-tenant. The `switchTenant()` capability in `TenantProvider.tsx` is unrelated to this: it lets a platform/super-admin resolve which school's data to view for support purposes, is gated entirely separately from ordinary users, and has no UI calling it in this pilot.

  In practice this means a person moving between schools needs a distinct email at each one — normally already true, since schools issue their own work email addresses. Verified end to end (deactivation revokes access immediately, historical data survives, two independent identities share zero cross-tenant visibility, a receiving school cannot see or reuse a departing person's existing profile or email) by `supabase/rls-tests/tests/status_aware_authorization.test.sql` and `e2e/identity-lifecycle.spec.ts`.
- **Deactivation is enforced at the database layer, not just hidden in the UI.** A deactivated (or suspended) user's role and school assignment may still be sitting in an unexpired browser session, but every tenant-scoped and platform-admin authorization check re-verifies the user's live `profiles.status` on every single request (via `current_tenant_id()`/`is_platform_admin()`) — so access is revoked the moment `status` changes, not merely at next login.

## Technical debt

- **`AssessmentReportPage.tsx` has a known class-name-resolution race condition,** the same pattern that was found and fixed on the Attendance Report. It has not caused a visible defect in verification, but should be fixed with the same approach before a wider rollout.

## Local-development behavior

- **Occasional slow background requests on the My Profile page, in local development only.** That page loads several pieces of information at once (your employee record, linked learners, teaching assignments, and their supporting class/subject data); in this local test environment, a couple of those requests can occasionally take a few seconds longer than usual to finish. The page itself always displays correctly and immediately regardless — this delay is invisible to what you see on screen, and traced to the local test server's connection handling. It is not expected to occur on the pilot's actual hosted environment.
- **Dense report tables require horizontal scrolling on narrow phone screens.** On a phone, wide tables (like Attendance by Class, with several columns) scroll sideways within their own box rather than shrinking to fit — the same behavior every table in Funda360 already uses. Swipe the table left/right to see the remaining columns.
