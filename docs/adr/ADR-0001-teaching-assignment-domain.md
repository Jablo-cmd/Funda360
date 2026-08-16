# ADR-0001: Teaching Assignment as a Cross-Cutting Architectural Domain

**Status:** Resolved — implemented in Sprint 4 (2026-08-17)
**Date:** 2026-08-04
**Prepared during:** Sprint 2, Milestone 4, Phase 0 dependency analysis
**Numbering convention established by this record:** `ADR-NNNN`, four digits, sequential, one file per decision under `docs/adr/`. No prior ADR numbering scheme existed in this repository before this one; this document is `ADR-0001` by definition, not by counting a pre-existing series.

> This ADR is not an implementation specification. It records an architectural discovery — what was found, why it matters, and what remains deliberately unresolved — so that future work references one authoritative source instead of rediscovering the same dependency independently, as already happened once during Milestone 4's own Phase 0 review. **Update, Sprint 4:** the relationship this ADR found missing now exists — `class_teacher_assignments` (migration `20260817090000_teaching_assignments.sql`), linking a teacher profile to a class and, optionally, a specific subject, scoped to an academic year. See `docs/FUNDA360 PROJECT CONTEXT & HANDOVER DOCUMENT.md` §31 for the full writeup. Everything below is preserved unedited as the historical record of the finding that motivated it — the "Deferred Decisions" section in particular records the exact questions Sprint 4 had to answer, and how.

---

## Status

**Resolved.** Implemented in Sprint 4 — see the update note above and handover document §31. The original "Proposed" text below is kept as the historical record of what this status meant *at the time this ADR was written*, before implementation.

> Original text: This status means exactly one thing: an architectural finding has been verified and recorded. It does **not** mean implementation has been approved, scheduled, or scoped. No table, column, RPC, or migration described anywhere in this document exists, and none is proposed by it. A separate, future decision — made by a product owner, then designed by a subsequent architecture pass — is required before this status could change.

---

## Context

As of this record, the repository has five committed, tenant-scoped domains, each independently verified:

- **Multi-tenancy and tenant isolation** — every domain table carries a `school_id` foreign key to `schools`, with Row Level Security both `ENABLE`d and `FORCE`d, without exception, across all fifteen tables in the schema.
- **RBAC** — a closed catalogue of 24 roles (`src/features/auth/types/auth.types.ts`) and 16 permissions (`src/features/rbac/types/permission.types.ts`), enforced identically at the client (`RequirePermission`) and database (`can_view_x()`/`can_manage_x()` function pairs) layers.
- **Academic Structure** (`20260803150000_academic_structure.sql`) — `academic_years`, `terms`, `grades`, `classes`, `subjects`. `classes` references `grades`; `terms` references `academic_years`. Neither `classes` nor `subjects` references any person.
- **Employee Management** (`20260803160000_employee_management.sql`, `20260804090000_employee_login_provisioning.sql`) — `departments`, `employees`. `employees` references `departments` and, via `reports_to_employee_id`, itself — an HR reporting hierarchy. It references nothing in Academic Structure.
- **Learner Management** (`20260803190000_learner_management.sql`) — `learners` and six related tables, including `learner_enrollments`, which links a learner to a `class_id`, `grade_id`, and `academic_year_id`.

Three roles in the 24-role catalogue are named `teacher`, `class_teacher`, and `subject_teacher` — distinct names that, on their face, anticipate a distinction between a teacher generally, a teacher responsible for a specific class, and a teacher responsible for a specific subject. Verified directly (`src/features/rbac/constants/rolePermissions.ts`): all three currently resolve to the identical permission grant, `['school.view', 'academic.view']`. The role catalogue names a distinction that no data relationship anywhere in the schema currently backs.

This gap was not the subject of a dedicated investigation. It was discovered as a byproduct of Sprint 2 Milestone 4's Phase 0 dependency analysis, while tracing what several independently-proposed future capabilities (teacher-scoped attendance, teacher-scoped gradebook, a richer teacher-facing view, a teacher-aware timetable) would each individually require. All four traced back to the same missing relationship.

---

## Problem Statement

**No relationship connecting a member of teaching staff to a specific class, subject, academic year, or term exists anywhere in the committed schema.**

This record documents the absence of that relationship. It does not propose one. No table, column, join structure, or inheritance model is suggested here — that is explicitly out of scope for this document, per its own charter, and remains a future decision.

---

## Evidence

Every item below was verified directly against the repository during this record's preparation, not carried forward from an earlier report.

- **Schema inspection, `employees` table** (`20260803160000_employee_management.sql`): columns are `id`, `school_id`, `profile_id`, `employee_number`, `first_name`, `last_name`, `work_email`, `work_phone`, `id_number`, `date_of_birth`, `department_id`, `job_title`, `employment_type`, `employment_status`, `hire_date`, `termination_date`, `reports_to_employee_id`, `emergency_contact_name`, `emergency_contact_phone`, plus audit columns. No column references `classes`, `subjects`, `grades`, `terms`, or `academic_years`.
- **Schema inspection, `classes` table** (`20260803150000_academic_structure.sql`): columns are `id`, `grade_id`, `school_id`, `name`, `capacity`, `active`, plus audit columns. No column references `employees` or `profiles`.
- **Schema inspection, `subjects` table** (same migration): columns are `id`, `school_id`, `name`, `code`, `description`, `active`, plus audit columns. No column references `employees` or `profiles`.
- **Schema inspection, `academic_years` and `terms` tables** (same migration): neither references `employees` or `profiles`.
- **Foreign keys, repository-wide search:** every `employee_id`/`teacher_id`-shaped reference in every migration is `employees.reports_to_employee_id` — a self-referencing HR org-chart column, unrelated to teaching responsibility. No migration anywhere defines a foreign key between the employee domain and the academic domain.
- **RLS policies:** `can_view_academic()`/`can_manage_academic()` (Academic Structure) and `can_view_employees()`/`can_manage_employees()` (Employee Management) each grant access at the whole-school level, gated by role only. Neither policy — nor any other policy in the schema — narrows access to a specific `class_id` or `subject_id` a given caller is responsible for.
- **Role catalogue naming, not backed by data:** `class_teacher` and `subject_teacher` exist as distinct roles (`src/features/auth/types/auth.types.ts`) and are named as if a class- or subject-specific responsibility exists, but resolve to identical permissions as plain `teacher` (`rolePermissions.ts`) with no supporting data relationship anywhere.
- **Frontend:** a repository-wide search for any teaching-assignment concept (`teaches`, `assigned class`, `assigned subject`, `my classes`) in `src/` returns no results. No hook, service, or component anywhere assumes or models this relationship.
- **Routes:** no route or page in `src/app/AppRoutes.tsx` scopes any view by "classes I teach" or an equivalent.

---

## Affected Future Capabilities

Every capability below was already named in the Milestone 4 Phase 0 dependency analysis before this ADR was written; none is introduced here for the first time. Readiness classifications use the taxonomy already established in that analysis.

| Capability | Why the dependency exists | Readiness without this relationship |
|---|---|---|
| **Attendance — teacher-scoped** ("my classes only") | Restricting which classes a teacher may mark attendance for requires knowing which classes are theirs | **Partially Ready** — every other dependency (`learners`, `learner_enrollments`, Academic Structure) is already committed; this is the sole missing piece |
| **Assessments / Gradebook — teacher-scoped** | Restricting which classes/subjects a teacher may grade requires the same knowledge | **Partially Ready** — identical situation |
| **Teacher Portal — rich variant** ("my classes" view) | A teacher-facing view of "my classes" requires knowing which classes are theirs | **Partially Ready** — a minimal portal (own profile, view-only academic structure) does not need this and is unaffected |
| **Timetabling — teacher-aware variant** | Knowing who teaches a given scheduled slot, and detecting one teacher double-booked across two slots, both require this relationship | **Partially Ready** — a minimal, no-teacher timetable (class × subject × period) does not need this and is unaffected |

No capability outside this set of four, already established elsewhere, is introduced by this record.

---

## Deferred Decisions

The following questions are architecturally real and currently unanswered. Recording them is this document's job; answering them is not.

- **Employee versus teacher abstraction.** Is "the person responsible for a class or subject" necessarily an `employees` row, or could it reference `profiles` directly? Employee Management's own architecture lock (`employees` "never mirrors, syncs, or otherwise duplicates identity fields into profiles") has direct implications for whichever answer is chosen, and was itself the subject of an explicit, recorded decision earlier in this project's history.
- **Class assignment shape.** Does an assignment relate a person to a class as a whole, independent of subject (a "class teacher" model), to a subject independent of class (a "subject teacher" model), or to a specific (class, subject) pair?
- **Subject assignment shape.** Can a single subject within a single class have more than one teacher of record (e.g., a co-taught class), or exactly one?
- **Multiplicity.** Can one teacher be assigned to many classes and/or subjects simultaneously? Nothing in the current schema constrains or informs this either way.
- **Temporal validity.** Does an assignment belong to a specific term, a specific academic year, or persist independently of both? `terms`/`academic_years` already model time-boundedness elsewhere in the schema (e.g., the one-active-year invariant); whether an assignment should follow that same pattern is undecided.
- **Historical assignments.** Should a past assignment (last year's class teacher) remain queryable after a new one is made, or is only the current assignment retained? No precedent for this choice exists elsewhere in the codebase — every other "current state" concept in this schema (`employment_status`, `learner.status`, academic year activation) either archives explicitly or is itself the subject of its own dedicated design.

---

## Consequences

**What becomes simpler once this relationship exists, whatever shape it takes:** four otherwise-independent future capabilities (teacher-scoped Attendance, teacher-scoped Assessments, a rich Teacher Portal, teacher-aware Timetabling) each currently carry the same open question as an implicit, unstated dependency. Resolving it once, deliberately, removes it from all four simultaneously rather than requiring it to be rediscovered — as it already was once — inside whichever of the four is built first.

**Why deferring the decision today is deliberate, not neglect:** none of the four affected capabilities has been selected for implementation. Designing this relationship now, ahead of a concrete requirement, risks shaping it around one capability's assumptions in ways that don't fit the others — exactly the "invent a requirement because it seems logical" failure mode this project's own standing engineering rules exist to prevent. The relationship should be designed once a real capability's actual needs are known, not speculatively.

---

## Alternatives Considered

**UNKNOWN.** No alternative design for this relationship — nor any prior attempt to model it — exists anywhere in the repository's history. There is no rejected migration, no superseded schema draft, and no discussion of a different approach recorded in any commit, comment, or document. This section cannot honestly contain more than that statement without inventing alternatives the repository does not support.

---

## Decision

The repository demonstrates that a shared architectural dependency exists. The implementation strategy is intentionally deferred until a future milestone requires it.

---

## Relationship to Sprint Planning

This ADR does **not**:

- choose Sprint 2 Milestone 4,
- recommend an implementation order among the capabilities listed above,
- approve implementation of any kind,
- alter the verdict of the Sprint 2 Milestone 4 Phase 0 Architecture & Implementation Contract, which remains **B — Additional Architectural Work Required**, unchanged by anything in this record.

It exists solely so that whichever future milestone first needs this relationship — and, per the Affected Future Capabilities section above, more than one plausibly will — starts from one authoritative, evidence-based record instead of re-deriving the same finding independently, which is precisely how this dependency was first surfaced.
