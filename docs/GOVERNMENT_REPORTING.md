# Government reporting and the District Dashboard

Funda360 can give education department officials (province, district or circuit level) structured information about the schools in their area, and give school leaders the same reports for their own school. It works alongside SA-SAMS and other department systems. It does not replace them, and none of its reports is an official government return format.

## What exists

| Piece | Where |
| --- | --- |
| Province → District → Circuit hierarchy | `education_areas` (migration `20261009091000_government_reporting.sql`) |
| School → area link | `schools.education_area_id` (district or circuit). The old free-text `schools.province` / `schools.district` columns are kept and were used once to seed the hierarchy. |
| Official role | `education_official` (`20261009090000_education_official_role.sql`). No school tenant. Two-factor authentication is mandatory and enforced by the database (see below). |
| Official access | `education_official_assignments`: one row per official per area. Access covers the area and everything under it. `can_view_learner_detail` is a separate grant. |
| Reports and dashboard data | `get_reporting_scope()`, `get_government_report(filters)`, `get_school_report(school_id, filters)`, `get_class_learner_report(class_id, filters)` |
| Export audit | `record_government_report_export(report, format, filters)` |
| Administration | `upsert_education_area`, `set_school_education_area`, `provision_education_official`, `grant_education_official_access`, `revoke_education_official_access` (platform administrators only, all audited) |
| UI | `/district` (dashboard), `/district/schools/:id` (school drill-down), `/district/schools/:id/classes/:id` (learners), `/reports/government` (reports), `/district/areas` (administration) |

## Two-factor authentication (mandatory for officials and platform administrators)

Education officials (`education_official`) and platform administrators (`platform_owner`, `super_administrator`, `platform_administrator`) must sign in with two-factor authentication before any government-reporting data is returned. School owners and principals reporting on their own school are not affected.

How it is enforced:

- Supabase Auth puts the session's assurance level in the JWT: `aal1` after a password sign-in, `aal2` only after a TOTP challenge has been completed in that session. `session_is_aal2()` reads that claim; the JWT is signed by Supabase Auth, so the client cannot set it.
- `reporting_require_mfa()` raises `mfa_required` for a privileged role on an `aal1` session. It runs first in `reporting_resolve_schools()` (every report, drill-down, learner list and export record), `get_reporting_scope()`, every area/official administration RPC and the `schools_protect_education_area` trigger.
- `is_education_official()` and `reporting_platform_admin()` (used by `reporting_school_ids()`, `reporting_visible_area_ids()`, `reporting_learner_detail_allowed()` and the `education_official_assignments` select policy) are false without `aal2`, so even a path that skipped the explicit check would resolve to no schools.
- The frontend guard `RequirePrivilegedMfa` (all `/district*` and `/reports/government` routes) shows the enrolment card when the user has no factor and sends them to the TOTP challenge when they have one. It is convenience only; the database refusal is the control.
- The requirement is scoped to government reporting. `is_platform_admin()` and all other platform administration are unchanged, so a platform administrator without MFA is not locked out of the rest of the platform.
- Lost authenticator: there are no recovery codes. A platform owner (or the Supabase project owner, for the platform owner's own account) removes the factor in the Supabase dashboard (Authentication → Users → the user → MFA factors) and the user enrols again.

## Who sees what

The database works out the caller's schools on every call (`reporting_school_ids()`):

| Caller | Schools | Learner names |
| --- | --- | --- |
| Platform administrator | All | Yes |
| Education official | Schools linked to their assigned areas and the areas beneath them | Only with `can_view_learner_detail` on an assignment covering the school |
| School owner or principal | Their own school | Yes, their own school |
| Anyone else | None (the functions raise `insufficient_privilege`) | No |

Rules that hold whatever the request contains:

- Officials and platform administrators need an `aal2` (two-factor) session; otherwise every reporting function raises `mfa_required`.

- A `school_id`, `district_id`, `province_id`, `circuit_id` or `class_id` outside the caller's scope raises `insufficient_privilege`. An unknown id gives the same answer as an out-of-scope one.
- Naming a broader area (an official's own province) never widens their scope; the result is the intersection.
- Officials read no school tables directly: RLS on `learners`, `attendance_records`, `assessment_results` and `schools` is keyed to a school tenant, which officials do not have.
- The official role is checked against both the JWT claim and `profiles.role`, so a stale or forged claim is not enough. Deactivated profiles and revoked assignments lose access immediately.
- Only platform administrators can move a school between areas (trigger `schools_protect_education_area`), because that decides which officials see it.
- Learner-level views and every export are written to `audit_log`.
- Grade, subject and class figures covering fewer than 5 learners are withheld unless the caller has learner-level access to every school in the group.

## How the figures are calculated

All figures are calculated at request time from the source tables. Nothing is stored twice.

- **Period.** `academic_year` (a year name) and `term` (a term number) resolve against each school's own calendar. `start_date` / `end_date` narrow it. With no year, the school's active year is used; with no year configured, the last 90 days. The period never runs past today.
- **Learners enrolled.** Learners with status `enrolled` or `active` and an `enrolled` enrolment in the period's academic year (and grade, when filtered). **Learners on register:** the same statuses, regardless of enrolment.
- **Educators.** Active or on-leave employees whose login role is a teaching role, or who hold an active teaching assignment. **Staff:** all active or on-leave employees.
- **Attendance rate.** (present + late) ÷ (present + late + absent), excused and unmarked days excluded, the same definition as `src/features/attendance/utils/calculations.ts`. Group rates are pooled over all records, never averages of averages.
- **Average mark.** Mean of every captured result as a percentage of its maximum mark. **Pass rate:** share of results at or above the performance threshold.
- **Learners requiring intervention.** Attendance below the attendance threshold, average below the performance threshold, or an unresolved academic intervention.
- **Schools requiring attention.** Low attendance, low performance, an overdue intervention, or any data-quality issue.
- **Thresholds.** Attendance 80% and performance 50% are Funda360 defaults passed as parameters. They are not official targets.
- **Data quality.** Missing EMIS number, school not linked to an area, no academic year for the period, requested term not configured, learners not enrolled in a class, classes with no attendance recorded, classes with no assessments, and assessments with fewer marks than enrolled learners.

## Exports

CSV, Excel-compatible CSV (UTF-8 byte-order mark and header lines) and PDF. They are built in the browser from data the caller already received, after the export has been recorded with `record_government_report_export`. Every export states that it is not an official government return format. Spreadsheet formula injection is neutralised as in every other Funda360 export.

## Setting up an area

1. A platform administrator opens **Education Areas** (`/district/areas`) and adds provinces, districts and circuits.
2. Each school is linked to its district or circuit.
3. **Create official account** creates an `education_official` login with a temporary password (shown once).
4. **Grant access** links the official to an area. Tick **Allow learner-level detail** only where the official's mandate requires learner names.

## Tests

- Database: `supabase/rls-tests/tests/zz_government_reporting.test.sql` (district, province and circuit isolation; role, account-state and forged-claim checks; drill-down and learner privacy; small-group suppression; calculations; term, year, date and grade filters; empty and incomplete data; direct table access; administration; export audit).
- Unit: `src/features/government/utils/government.test.ts`.
- Real Supabase stack: `supabase/stack-tests/government-reporting.mjs` (+ `fixtures.sql`) drives a real GoTrue + PostgREST stack with real sign-ins and a real TOTP enrolment/challenge, so the `aal` claim is the one Supabase Auth issues. 47 checks: anonymous refusal on every RPC, MFA gating, district/province isolation, URL/API/id manipulation, direct table reads, learner-detail grant, learner-view and export audit, export scope, owner/teacher/guardian refusal, revocation and deactivation on a live session. Run it against a disposable local stack only (it creates users with the service-role key).
- End-to-end: `e2e/district-dashboard.spec.ts` (including the enrolment page for officials and platform administrators without MFA, and the `mfa_required` message).

## Production deployment requirements

1. Merge the branch to `main`; CI's `migrate` job applies `20261008090000`, `20261009090000` and `20261009091000`.
2. In the Supabase dashboard confirm **Authentication → Multi-Factor → TOTP** is enabled (enroll and verify). Without it nobody can reach `aal2` and government reporting is unusable for officials and platform administrators.
3. The platform owner and super administrator enrol an authenticator (**My Profile → Two-factor authentication**) before using `/district`, `/reports/government` or `/district/areas`. At the 2026-10-08 check neither had a verified factor.
4. Link every school to its district or circuit, create officials, and grant each one only the area of their mandate (learner-level detail only where required).

## Production verification status (2026-10-08)

Checked read-only on the hosted project (`rzkybmkzhpwovpvrjkxk`) with SQL; nothing was written:

- 76 migrations applied; the three reporting/MFA migrations are **not** applied yet (they ship with the merge).
- Schema matches the schema the migrations were tested against: 125 tables (column fingerprint identical), 260 policies (names identical), enum values identical, RLS forced on every table, 298 functions identical after normalising Windows line endings in 26 of them. No name collides with an object the new migrations create.
- The migrations were rehearsed inside a rolled-back transaction on a copy of that schema: they apply cleanly, indexes are created, anon has no EXECUTE, no policy is left unoptimised, and a platform owner gets `mfa_required` at `aal1` and the report at `aal2`.
- Seeding from existing text will create 3 provinces and 3 districts and link 3 schools; Townsview Primary has a province but no district and must be linked by hand.
- Not verified from the sandbox: the hosted Auth MFA (TOTP) setting, and the new functions on the hosted database (not applied). After the merge, re-run the checks above and one real sign-in with TOTP.

## Known limits

- MFA is TOTP only (no SMS, WebAuthn or recovery codes). An `aal2` access token stays valid until it expires (one hour by default) even if the factor is removed meanwhile.
- The MFA requirement covers government reporting only. Other platform-administrator functions still accept an `aal1` session (unchanged behaviour); extending it platform-wide is a separate decision.

- No official DBE/provincial return layouts are implemented. The report catalogue (`src/features/government/utils/reportDefinitions.ts`) is where an official layout would be added once its specification is available.
- No import from or export to SA-SAMS; schools still report through their existing systems.
- Figures are computed live. This is fast at current data volumes; a district with hundreds of schools may need pre-aggregated reporting tables.
- `schools.province` / `schools.district` text is kept for display and is not kept in sync with `education_area_id`.
