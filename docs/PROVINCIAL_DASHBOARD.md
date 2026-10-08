# Provincial Dashboard

The Provincial Dashboard (`/province`) gives a provincial education official, or a platform administrator, one province at a time: headline figures, a district comparison, trends, province-wide data quality and a drill-down to districts, schools, classes and learners.

It is built on the Government Reporting layer (`docs/GOVERNMENT_REPORTING.md`) and uses exactly the same calculations. It is a Funda360 report, not an official government return, and it does not rank districts.

## Implemented

| Piece | Where |
| --- | --- |
| Dataset | `get_provincial_report(province_id, filters)` in `20261010090000_provincial_dashboard_and_government_api.sql`. It calls `get_government_report()` for the province and adds the district comparison, the intervention trend and the extra data-quality checks. |
| Provinces the caller may open | `get_provincial_scope()` |
| Export audit | `record_provincial_report_export(province_id, report, format, filters)` |
| Page | `src/features/government/pages/ProvincialDashboardPage.tsx`; helpers in `utils/provincial.ts` |
| Route guard | `government.view` and `RequirePrivilegedMfa` (UX only; the database decides) |

### Who can open a province

Province-level access is checked in the database on every call (`reporting_province_access()`):

| Caller | Provincial dashboard |
| --- | --- |
| Platform administrator with an MFA session | Any province |
| Education official with an active assignment **on the province itself** | That province |
| Official assigned to a district, circuit or school in the province | Refused (`insufficient_privilege`); they use the District Dashboard |
| Government API client scoped to the province | That province (`/v1/reports/provinces/{id}`) |
| School owner, principal, teacher, guardian, learner, anonymous | Refused |

A district official who types `/province?province_id=…` gets no provinces and no data, because `get_provincial_scope()` returns an empty list and `get_provincial_report()` raises.

Filters only narrow the province. A `district_id`, `circuit_id` or `school_id` outside the province is refused. A `province_id` in the filters is ignored, so the province cannot be switched through a filter. Officials and platform administrators need an MFA (aal2) session.

### Content

- **KPIs:** schools, learners enrolled (and on registers), educators and staff, classes, attendance rate, average mark (pass rate in the hint), schools requiring attention, districts requiring attention, learners requiring intervention, open interventions (open + in progress), overdue interventions, and data-quality issues.
- **District comparison:** schools, learners, educators, attendance rate, average mark, intervention workload (overdue in brackets), schools requiring attention, data-quality issues and the reasons a district is flagged.
  - Order: needing attention first (default), name, attendance, average mark, intervention workload, data quality or learners.
  - The page states that the order is a viewing choice, not a ranking.
  - Districts with no linked schools or no attendance and marks are labelled "No linked schools" or "No sufficient data".
  - On phones the districts are shown as cards; from `sm` they are a scrollable table.
- **Trends:** weekly attendance, monthly average mark and monthly interventions opened/resolved. A trend needs at least two periods; otherwise "No sufficient data" is shown. Nothing is interpolated.
- **Data quality:** issue counts across the province and a collapsible list of schools with their issues. Platform administrators also see how many schools on the platform are not linked to any area (they cannot appear under a province).
- **Drill-down:**
  - district → District Dashboard filtered to that district;
  - school → `/district/schools/:id`;
  - class → learners on the existing pages.
  - Learner names still require a learner-detail grant covering the school, and every learner-level view is audited.
- **Exports:** district comparison and data quality, each as CSV, Excel-compatible CSV or PDF, through the existing export code (formula-injection guard, disclaimer line). Each export is first recorded by `record_provincial_report_export`, which repeats the province checks; if recording fails no file is produced.

### Definitions

These definitions are the same as the District Dashboard (see `docs/GOVERNMENT_REPORTING.md`).

- **District rates** are pooled over every record in the district (from the `areas` block of `get_government_report`), never averages of school averages.
- **District requires attention:** at least one school requires attention, OR the district's attendance is below the attendance threshold, OR its average mark is below the performance threshold, OR an intervention is overdue.
- **Districts requiring attention:** the number of such districts.
- **Data-quality issues:** the number of issue types found per school, summed. The issue types are the per-school checks of the government report, plus two provincial checks:
  - `not_linked_to_circuit`: the school is linked to a district that has circuits, instead of to one of the circuits.
  - `incomplete_learner_records`: learners on the register with no gender recorded.
- **Missing province or district:** this is the `not_linked_to_area` check. A school linked to a district or circuit always has a province and a district.
- **Intervention trend:** interventions created, and interventions resolved, per month inside each school's reporting period.

### Filters

Province, district, circuit, school, academic year, term, start and end date, and grade, using the shared filter bar. A **subject** filter is not supported by the reporting layer; the subject breakdown is on Government Reports.

## Performance (synthetic data, local only)

Test data:

- 1 province, 4 districts and 20 schools;
- 6,004 learners;
- 240,000 attendance records and 30,000 assessment results.

Postgres 16 in Docker, a platform administrator with MFA, warm runs:

| Query | Time |
| --- | --- |
| District report, 5 schools (existing) | 0.34–0.35 s |
| Whole province through `get_government_report` | 0.73 s |
| `get_provincial_report` (province) | 0.81–0.89 s |
| `get_provincial_report`, term 1 | 0.87 s |
| School drill-down | 27 ms |

The provincial report adds about 0.1 s to the government report it wraps. **No production timing exists yet:** the migrations are not applied in production, and production holds only demo data.

## Administration

1. **Education Areas** (`/district/areas`): create the province, its districts and circuits.
2. Link each real school to its district or circuit. Existing records are demo data; do not link them as government schools.
3. Create an official account. Grant access to the **province** for provincial officials, to a district or circuit for district or circuit officials, or to a **single school**. Tick learner-level detail only where the official's mandate requires learner names.
4. The official signs in, enrols TOTP under My Profile and opens **Provincial Dashboard**.

## Tests

- **Database:** `supabase/rls-tests/tests/zzz_provincial_and_api.test.sql` (prefixes `prov:` and `api:`; 117 checks). The provincial checks cover:
  - isolation: province A cannot read province B; district, circuit and school officials cannot escalate; anonymous callers are refused;
  - filter manipulation, revocation, deactivation and MFA;
  - figures equal to the District Dashboard;
  - data quality, the intervention trend, export audit and school-level grants.
- **Unit:** `src/features/government/utils/provincial.test.ts`.
- **End-to-end:** `e2e/provincial-dashboard.spec.ts`. It covers:
  - KPIs, comparison ordering, "No sufficient data", drill-down and filters;
  - the province-checked export path, no access for district officials, and MFA;
  - no sideways scroll at 320 and 375 px;
  - axe WCAG 2.1 A/AA with 0 violations.

## Future requirements (not implemented)

- An official provincial return layout: an external specification is required before implementation.
- Pre-aggregated reporting tables, if provinces with hundreds of schools make live calculation too slow. This needs measurement on real volumes first.
- A subject filter in the reporting layer.
