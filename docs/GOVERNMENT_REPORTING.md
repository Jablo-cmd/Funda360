# Government reporting and the District Dashboard

Funda360 can give education department officials (province, district or circuit level) structured information about the schools in their area, and give school leaders the same reports for their own school. It works alongside SA-SAMS and other department systems. It does not replace them, and none of its reports is an official government return format.

## What exists

| Piece | Where |
| --- | --- |
| Province → District → Circuit hierarchy | `education_areas` (migration `20261009091000_government_reporting.sql`) |
| School → area link | `schools.education_area_id` (district or circuit). The old free-text `schools.province` / `schools.district` columns are kept and were used once to seed the hierarchy. |
| Official role | `education_official` (`20261009090000_education_official_role.sql`). No school tenant. Two-factor authentication is required (banner) like other privileged roles. |
| Official access | `education_official_assignments`: one row per official per area. Access covers the area and everything under it. `can_view_learner_detail` is a separate grant. |
| Reports and dashboard data | `get_reporting_scope()`, `get_government_report(filters)`, `get_school_report(school_id, filters)`, `get_class_learner_report(class_id, filters)` |
| Export audit | `record_government_report_export(report, format, filters)` |
| Administration | `upsert_education_area`, `set_school_education_area`, `provision_education_official`, `grant_education_official_access`, `revoke_education_official_access` (platform administrators only, all audited) |
| UI | `/district` (dashboard), `/district/schools/:id` (school drill-down), `/district/schools/:id/classes/:id` (learners), `/reports/government` (reports), `/district/areas` (administration) |

## Who sees what

The database works out the caller's schools on every call (`reporting_school_ids()`):

| Caller | Schools | Learner names |
| --- | --- | --- |
| Platform administrator | All | Yes |
| Education official | Schools linked to their assigned areas and the areas beneath them | Only with `can_view_learner_detail` on an assignment covering the school |
| School owner or principal | Their own school | Yes, their own school |
| Anyone else | None (the functions raise `insufficient_privilege`) | No |

Rules that hold whatever the request contains:

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
- End-to-end: `e2e/district-dashboard.spec.ts`.

## Known limits

- No official DBE/provincial return layouts are implemented. The report catalogue (`src/features/government/utils/reportDefinitions.ts`) is where an official layout would be added once its specification is available.
- No import from or export to SA-SAMS; schools still report through their existing systems.
- Figures are computed live. This is fast at current data volumes; a district with hundreds of schools may need pre-aggregated reporting tables.
- `schools.province` / `schools.district` text is kept for display and is not kept in sync with `education_area_id`.
