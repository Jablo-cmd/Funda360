# Curriculum Engine — architecture and data-model proposal

Status: **implemented (foundation + Grade 4 Mathematics vertical slice), not merged to `main`.**
Migrations: `20261001090000_curriculum_engine.sql`, `20261001100000_curriculum_engine_rpcs.sql`.
Content pack (data, not a migration): `supabase/content/grade4-mathematics-term1.sql`.

## 1. What already exists (inspection findings)

Searched every migration, service, page and test for curriculum, objective, lesson, topic, resource, mastery and
progress concepts. **Nothing equivalent exists**, so nothing is duplicated. ("lesson" appears only in the timetable and
fees migrations as plain wording.)

Reused as-is (no schema change):

| Existing | Used for |
|---|---|
| `schools`, `profiles`, `current_tenant_id()`, `is_platform_admin()` | tenancy and identity (no second auth or tenant model) |
| `grades`, `subjects`, `classes`, `terms`, `academic_years` (all **school-scoped**, free-text names) | the school's own structure; bridged to the national curriculum by mapping tables |
| `class_teacher_assignments` | "which teacher teaches which class / subject" — the teacher-scope check for every teaching RPC |
| `learners`, `learner_enrollments` | rosters; progress is keyed on `learners` |
| `academic_interventions` | linked (nullable FK) from learning recommendations; never duplicated |
| `assessments`, `assessment_results` (gradebook), `assignments` (homework) | **left untouched.** Learning assignments and quick checks are separate tables so the marks/report-card pipeline cannot be affected |
| `can_view_academic`, `can_manage_academic`, `my_taught_learner_ids()`, `my_self_learner_ids()`, `my_guardian_learner_ids()` | authorization building blocks |
| `write_audit_log`, `set_updated_at` | audit + timestamps |
| `rls_optimize_policies()` | re-run at the end of the migration so the new policies get InitPlans |

## 2. Conflicts found and how they are avoided

1. **School `grades` / `subjects` are not the national structure** (no phase, no code, no version, editable per school).
   They are not altered. `school_grade_curriculum_map` and `school_subject_curriculum_map` (school-scoped) link them to a
   curriculum version's grade and subject. A school can therefore keep its own names.
2. **Global vs tenant data.** Curriculum master data and teaching content are platform-owned (no `school_id`).
   Everything a school or learner creates carries `school_id` and is tenant-isolated.
3. **Existing status/protect pattern.** Status columns are RPC-only (trigger `content_protect`), the same pattern as
   `assignments_protect`.
4. **No new enum value on an existing type** (avoids the "enum value used in the same transaction" problem seen earlier).

## 3. Data model

### 3.1 Global, versioned curriculum (platform-owned)

```
curriculum_versions ─┬─ curriculum_phases ── curriculum_grades ──┐
                     ├─ curriculum_subjects ─────────────────────┤
                     │                     curriculum_grade_subjects   (valid Phase→Grade→Subject pairs)
                     │                               └─ curriculum_terms
                     │                                     └─ curriculum_topics
                     │                                           └─ curriculum_subtopics
                     │                                     curriculum_objectives (topic [+subtopic])
                     │                                           └─ curriculum_skills
```

* Every hierarchy table carries `version_id`, and every parent link is a **composite foreign key**
  `(parent_id, version_id)`, so a row can never point at a parent from a different curriculum version. No triggers needed.
* `curriculum_grade_subjects` is the only place a subject is attached to a grade, so subjects are never a hard-coded
  universal list and differ by phase and grade.
* Stable human-readable `code` per row (`G4.MATH.T1.NUM.01`), unique per version, so content can be re-loaded idempotently
  and historical records stay readable.
* Objectives store **Funda360's own paraphrase** plus `source_reference` (a pointer to the official document section).
  The curriculum PDF text is never copied into tables. `curriculum_versions` records `source`, `source_reference` and
  `license_notes`.

### 3.2 Versioning and lifecycle

`content_status`: `draft → review → approved → published → retired`.

* A version can be superseded (`supersedes_version_id`); retiring keeps every row readable so learner history still makes sense.
* **Ordinary users (teachers, parents, learners) can read only `published` and `retired`** curriculum and content.
  `draft`, `review` and `approved` are visible to platform administrators only ("approved" means signed off and waiting for release).
  This is stricter than "approved/published", so it satisfies it.
* Content units (lessons, resources, assessments) carry `lineage_id` + `version_number` + `previous_version_id`, so
  "create a new version" never overwrites a published one.
* Status changes go through `content_transition()` only (platform administrators), recorded in `content_review_events`
  and the audit log. Allowed path: `draft→review→approved→published→retired`, plus `review→draft` (changes requested).
  **No skipping**, so AI drafts cannot be published silently.
* Publishing a lesson requires: at least one mapped objective, all from the same curriculum version, the version already published,
  and a **low-resource path** (at least one resource that needs no projector, no connectivity and no learner device).

### 3.3 Lessons and the Teacher Toolkit (global)

* `lessons` → `lesson_objectives` (many objectives per lesson). Fields include duration, difficulty, language, teacher notes,
  learner instructions, ordering, `accessibility` (jsonb) and the `curriculum_version_id` it was written against.
* `teaching_resources` are **separate, reusable pieces**, not one lesson blob. `stage` is one of
  `explain, show, try, practise, check, support, challenge, print`; `resource_kind` names the concrete type
  (teacher explanation, simplified explanation, worked example, diagram, animation, video, classroom/group/practical activity,
  exercise, quick assessment, remediation, extension, printable worksheet, …). Linked to lessons (`lesson_resources`) and
  directly to objectives (`resource_objectives`).
* Differentiation: `difficulty` = `foundational | standard | advanced`; `delivery_formats` =
  visual / text / interactive / practical / teacher-led / printable / video-audio. No claims about "learning styles".
* Offline and low-resource: `connectivity_need` (`none | low | online`), `device_need`
  (`none | teacher_device | shared_device | learner_device`), `projector_required` (default **false**), `printable`,
  `cacheable`, `size_kb`. Bodies are small structured JSON (`body`), so they can be cached and synced later.
  Video/media is optional (`media_path`).
* `learning_activities` (learner-facing tasks inside a lesson, with grouping) and `learning_assessments`
  (+ `assessment_objectives`, `assessment_questions`). **Answer keys live in `assessment_question_keys`**, readable only by
  staff, so a learner's client can never read them.
* AI: `origin` (`authored | ai_draft`) and `ai_disclosure` mark provenance. AI output enters as `draft` and can only reach
  learners through the same human-reviewed lifecycle. **No AI runs in this change.**

### 3.4 Tenant-scoped tables (school data)

| Table | Purpose |
|---|---|
| `school_curriculum_adoptions` | which published curriculum version a school follows |
| `school_grade_curriculum_map`, `school_subject_curriculum_map` | bridge school grades/subjects to the curriculum |
| `class_topic_plans` | the class's current topic ("what am I teaching?") |
| `class_learning_assignments` | lessons / activities / quick checks assigned to a class |
| `learning_attempts` | evidence: a learner's attempt and score |
| `learner_objective_progress` | `not_started / in_progress / completed / needs_support / mastered`, **derived from attempts only** |
| `learner_lesson_progress` | lesson completion |
| `learning_recommendations` | remediation / extension / reassess suggestions, derived from recorded evidence, optional link to `academic_interventions` |

All are RPC-written (no client INSERT/UPDATE policies), all carry `school_id`, and reads are scoped to the teacher's own
learners, the learner, their guardians, or academic managers.

### 3.5 Rules for progress (no fake predictions)

Deterministic and documented in `derive_learner_progress()`:

* `needs_support`: latest score below the assessment's support threshold (default 50%), or two consecutive scores below 60%.
* `mastered`: latest **two** completed attempts at or above the mastery threshold (default 80%).
* `completed`: at least one completed attempt and neither of the above.
* `in_progress`: attempts exist but none completed. `not_started`: no evidence.

## 4. Security

* RLS enabled and **forced** on every new table; no DELETE policy anywhere (retire, never delete).
* Global content is read-only for everyone except platform administrators; ordinary users see only `published`/`retired`.
* Tenant tables: `school_id` match plus role/relationship scope; cross-school reads return nothing.
* Teaching RPCs check the caller teaches the class (via `class_teacher_assignments`) or manages academics, and that the
  curriculum content is published and adopted by that school.
* New `SECURITY DEFINER` functions pin `search_path`, revoke from `public` and `anon`, grant to `authenticated` only when the client calls them.

## 5. Files added or modified

Added: two migrations; `supabase/content/grade4-mathematics-term1.sql`; RLS tests
`supabase/rls-tests/tests/curriculum_engine.test.sql` (+ fixture); `src/features/learning/**`;
`e2e/learning.spec.ts`; this document.
Modified: `src/lib/database.types.ts`, `src/app/AppRoutes.tsx`, `src/features/rbac/**` (permissions, navigation),
`src/lib/pageTitles.ts`, `CLAUDE.md`, `e2e/responsive-layout.spec.ts`.
No existing table, policy or function is altered.

## 6. Out of scope for this slice (by design)

Full national content, other grades/subjects/languages, school-authored content (`owner_school_id` can be added
additively), media upload + storage bucket, AI generation, adaptive sequencing, offline sync client (resources are already
shaped for it), a Content Studio UI (the backend lifecycle is in place).
