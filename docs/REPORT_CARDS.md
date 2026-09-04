# Report Cards

Domain 2 of the `DOMAIN_STATUS.md` sequence. Turns the existing gradebook
(`assessments` / `assessment_results`) plus attendance and behaviour into a
governed, versioned report-card document with a full editorial workflow.

Migrations: `20260904090000_grading_scales.sql`,
`20260904100000_report_cards.sql`. Feature code: `src/features/reportCards/`.

## What it reuses (no duplication)

| Concept | Source |
| --- | --- |
| Subject marks | `assessments` + `assessment_results` — unchanged. One additive column, `assessments.weight` (default 1), is the per-assessment weighting the assessments migration itself named as the extension path. |
| Enrolment (grade/class for the term) | `learner_enrollments` |
| Who writes a subject / class-teacher comment | `class_teacher_assignments` (subject teacher / class teacher) |
| Attendance summary | `attendance_records`, tallied over the term's date range |
| Conduct summary | `behaviour_incidents` (active), tallied over the term's date range |
| Audit / notifications | `write_audit_log()` / `create_notification()` |

## New tables

- **`grading_scales`** + **`grading_scale_bands`** — a reusable per-school
  percentage → achievement mapping (e.g. CAPS 7-point). Bands may not
  overlap (`grading_scale_bands_validate`). `resolve_achievement(scale, pct)`
  is the single lookup. `grading_scale_bands` is the one deletable config
  table in the schema (a band is a spreadsheet row, not a record); the
  scale itself is archive-only.
- **`report_card_templates`** — configurable layout: which sections appear
  (attendance / conduct / subject comments / class-teacher / principal /
  promotion), whether an HOD-review step is required, and the grading
  scale. Archive-only.
- **`report_card_batches`** — create-only audit record of one bulk
  generation.
- **`report_cards`** — one learner × one term × one template × one version.
  Every column is written only by the workflow RPCs (no client
  INSERT/UPDATE/DELETE policy + `report_cards_protect` trigger). Aggregate
  columns (`overall_*`, `attendance_*`, `conduct_*`) are a snapshot
  recomputed while the card is still editable, then frozen at approval.
- **`report_card_subjects`** — one subject line per card: snapshot of
  subject name, teacher, the `assessments.weight`-weighted mean of
  `(mark / max_mark)`, the resolved achievement code/label, the teacher
  comment, and the assessment count.

## Workflow

```
draft ──submit──▶ teacher_review ──review(HOD)──▶ hod_review ──approve──▶ approved ──publish──▶ published ──archive──▶ archived
                        │  ▲                            │                    │  ▲                       ▲
                        │  └── review(return) ──────────┘                    │  └── unapprove ─────────┘
                        └────────────────────────────────────────────── reissue (published/archived → new v+1 draft) ─┘
```

| Transition | RPC | Who (DB-enforced) |
| --- | --- | --- |
| generate / recalculate / edit subject comment / submit | `generate_report_card`, `generate_report_cards_for_class`, `recalculate_report_card`, `set_report_card_subject_comment`, `submit_report_card` | `can_manage_academic()` **or** an active `class_teacher_assignments` row for the caller on that class |
| class-teacher comment | `set_report_card_comment(…, 'class_teacher_comment', …)` | class teacher of the class, or academic manager |
| principal comment | `set_report_card_comment(…, 'principal_comment', …)` | academic manager (principal / school owner / platform) |
| HOD review (advance or return) | `review_report_card` | `department_head` role, or academic manager |
| approve / unapprove / publish / archive / reissue / set promotion / publish batch | `approve_report_card`, `unapprove_report_card`, `publish_report_card`, `archive_report_card`, `reissue_report_card`, `set_report_card_promotion`, `publish_report_card_batch` | academic manager only |

- **Locking.** Once `status ∈ {approved, published, archived}` the card and
  its subject rows are immutable — recalculation, comment edits and
  promotion changes all raise `report_card_locked`. The only way to change
  a published card is `reissue_report_card()`, which archives the old
  version (setting `superseded_by`) and creates a new `draft` at
  `version + 1`, copying the comments.
- **One live card.** A partial unique index
  (`report_cards_one_live_per_learner_term_template`,
  `where status <> 'archived'`) guarantees at most one non-archived card
  per learner / term / template. Re-generating raises `already_exists`.
- `approve_report_card` rejects if the template `requires_hod_review` and
  the card has not passed through `hod_review`.
- Publishing raises an in-app `report_card_published` notification for
  every guardian of the learner.

## Visibility (RLS)

| Reader | Sees |
| --- | --- |
| Staff with `reportcard.view` (`can_view_report_cards()` — school_owner / principal / vice_principal / department_head / teacher variants / platform admin) | every status, for the workflow UI + staff preview |
| Guardian (`is_learner_guardian`) | **only `status = 'published'`** for their own linked child |
| Learner (`learners.profile_id = auth.uid()`) | **only `status = 'published'`** for their own record |

`report_card_templates` / `grading_scales` / `grading_scale_bands` /
`report_card_batches` are staff-only (`can_view_report_cards()` /
`can_view_academic()`). A guardian never reads the scale table — the
achievement codes are already resolved into the published snapshot, so the
guardian PDF is built from the card alone.

## RBAC additions

New `Permission` values, wired into `ROLE_PERMISSIONS`:

- `reportcard.view` — teacher / class_teacher / subject_teacher /
  department_head / vice_principal / principal / school_owner / platform +
  super admin.
- `reportcard.manage` — the above minus vice_principal (generate,
  recalculate, comments, submit, HOD review).
- `reportcard.approve` — principal / school_owner / platform + super admin
  (approve, publish, archive, reissue, promotion).

`can_view_report_cards()` / `can_manage_report_card()` mirror these in SQL
and must be kept in sync manually (same convention as every other
`can_*` helper).

## UI

- `/report-cards` — filter by term + class; generate for a class; bulk
  "Download N as PDF" (one multi-page document) and bulk "Publish approved".
- `/report-cards/:id` — the workflow page: overall / attendance / conduct
  snapshot, per-subject rows with inline comment editing, class-teacher /
  principal / conduct comments, promotion selector, the status-aware
  workflow bar, version history, individual PDF, and a "staff preview"
  banner while unpublished.
- `/academic/grading-scales`, `/academic/report-templates` — configuration.
- Learner profile → **Report cards** tab (staff, links to the workflow page).
- Parent Portal → child profile → **Report cards** tab (published only,
  with a PDF download).

## PDF

Client-side (jsPDF + jspdf-autotable, dynamically imported — same bundle
reasoning as the other PDF utilities). `generateReportCardDocument()` for
one card, `generateReportCardBundle()` for many in one file. The renderer
reads only the display booleans + the already-resolved snapshot, so a
guardian (no template access) gets a complete card via `FULL_DISPLAY_CONFIG`.

## Tests

- **Unit** (`src/features/reportCards/utils/reportCardCalc.test.ts`, 11) —
  weighted subject mean, null-not-zero for no marks, divide-by-zero guard,
  two-decimal rounding, subject-weighted overall with null exclusion, band
  resolution on the rounded value, attendance rate.
- **RLS** (`supabase/rls-tests/tests/grading_scales.test.sql` +
  `report_cards.test.sql`) — scale creation authz, band non-overlap,
  `resolve_achievement`, weighted aggregation (65.00 → band B), attendance
  + conduct snapshot, unassigned-teacher / cross-tenant rejection,
  duplicate-live rejection, the full submit → approve (locked) → publish
  path, locked-edit rejection, guardian sees published-only, HOD-required
  approval gating + `department_head` advance, learner-self published-only,
  reissue (v2 draft, old archived + superseded, one live), no direct
  client UPDATE/DELETE.
- **E2E** (`e2e/report-cards.spec.ts`, 4) — generate-for-class,
  approve + publish from the detail page, guardian published-only with PDF,
  and a role without `reportcard.view` cannot reach the page.

## Not in scope (deferred, non-blocking)

- A rich WYSIWYG template designer — templates are section toggles + notes,
  not free-form layout.
- Cross-term / year-end aggregate report cards — each card is one term.
- Emailing the PDF to guardians — the `report_card_published` in-app
  notification is the hand-off point, same as every other notification
  (email delivery is Domain 19).
