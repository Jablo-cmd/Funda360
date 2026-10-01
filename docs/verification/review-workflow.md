# Curriculum review workflow: what the system considers what

**Status of the Grade 4 Mathematics Term 1 pack (`ZA-G4-MATH-2026-T1`): DRAFT, NOT VERIFIED, NOT APPROVED, NOT PUBLISHED.** Nothing in this document, and nothing in the software, changes that. Only people, using the screens below, can.

Screens: **Content Studio → Sources** (the source register and its evidence steps) and **Content Studio → Curriculum review → `/content-studio/curriculum-review/<version code>`** (one workspace per curriculum version in the workflow). Both are for platform administrators (permission `content.manage`); the database re-checks the caller on every action (`is_platform_admin()`), so hiding a button is never the protection. Teachers cannot read any of this data, including answer keys.

## Exactly what each word means

| Word | What the system records, and the rule that protects it |
| --- | --- |
| **Indexed** | `indexed_on`. A document with this title was seen at the registered location. Proves existence at a place; nothing else. |
| **Source retrieved** | `checksum_sha256`, `retrieved_on`, size, content type, final URL, redirects, and the verbatim `RECORD` line. Created only by `record_source_retrieval()` from the output of `docs/sources/verify-dbe-sources.sh`: the server parses the line, requires state `retrieved`, an HTTP 2xx status, a PDF checksum of 64 lowercase hexadecimal characters, an https final URL, and a requested URL that is registered for this source; it dates the retrieval itself. A client can no longer hand over a checksum (registration refuses one, and the older `record_source_evidence('retrieved')` is closed). The database cannot prove the bytes are the file at that URL: that is why the line is kept, so a second person can re-run the script and compare. |
| **Source identity verified** | `status = 'verified'`, with who and when, set only by `record_source_review(kind => 'identity', decision => 'verified')`, and only when bytes are recorded. A person confirmed the retrieved file is the intended authoritative edition. Other identity decisions (`not_verified`, `needs_information`) are kept in the history and change nothing. |
| **Document reviewed** | `content_reviewed_*`, set only by `record_source_review(kind => 'document', decision => 'reviewed')` after identity is verified. A person read the document. `issues_found` is recorded with its findings and does not count. |
| **Licence reviewed** | `licence_status` (`permitted` / `restricted` / `not_permitted`) with reviewer and note. `not_permitted` blocks completion. |
| **Curriculum verified** | A decision `verified` in `curriculum_reviews` on one objective (or the formal assessment), made against a named source whose identity is verified, with the section and the page or reference. Lessons, resources, practice checks and questions get `accepted`. A decision only counts while the unit still reads exactly as it did when the decision was made (content fingerprint); a changed unit goes back to pending. This is separate from the source steps: a source can be fully reviewed while every unit stays pending. |
| **Objective approved** | The objectives of a version mirror the version's lifecycle: they become `approved` when the **version** is approved. There is no separate "approve objective" action. For a version in the workflow, approval needs a complete review (below). |
| **Content approved** | A lesson, resource or practice check moves to `approved` through `content_transition`. In the workflow it needs a current `accepted` review (a practice check also needs all its questions accepted). A different person than its author must do it. |
| **Published** | `published` through `content_transition`, only from `approved`, only after the version is published. Published content is immutable. |

None of these implies another. In particular: reviewed is not approved, approved is not published, a deferred question is not a verified one, and an indexed source is not a verified source.

## The completion rule (one definition, in the database)

`curriculum_review_compute(version)` is the only definition of "review complete". It reads the database and returns the counts, the list of reasons it is not complete, and an overall label. The dashboard, the approval gate and the AI gate all call it. It is complete only when:

- every source cited by the version's units has its identity verified, its document reviewed, and a licence decision that is not `not_permitted` or `unreviewed`;
- every objective is `verified`, every lesson, every resource, every practice check and every question is `accepted`, each at its current content;
- the formal assessment details are recorded from a verified source and the formal assessment is `verified`;
- every open question is `resolved` with evidence or `deferred`, and **no deferred question that affects scope remains** (only question Q4, weeks and hours, does not);
- no review finding is open.

Anything else is a blocker, and the dashboard lists each blocker in words.

## Separation of duties

The workflow is: draft → source review → curriculum review → approval → content review → approval by a different person → publication.

- The author of a unit or version cannot verify/accept it, and cannot approve it (`record_curriculum_review`, `review_workflow_version_gate`, `review_workflow_content_gate`).
- AI-assisted content keeps its own rule: the requester cannot review or approve it, and it needs a passing validation run, acknowledged warnings and a reviewed verification by someone else (unchanged).
- A version that is approved, published or retired takes no more review decisions or answers; a reviewer can still raise a finding, and a new open finding closes AI drafting again.

## AI drafting stays closed

`ai_begin_generation` refuses a version in the workflow until its objectives are approved (which needs the complete review) and again whenever the review stops being complete (for example a new finding). It also refuses superseded and retired versions. No test or code path makes a model call; the Edge Function needs `ANTHROPIC_API_KEY` and `CURRICULUM_AI_MODEL`, neither of which is set in this repository.

## Versions outside the workflow

`curriculum_versions.review_workflow` is `true` for every version created from now on and `false` for versions that existed when the migration ran (legacy). It can be switched on (`require_curriculum_review`) and, through the API, never off. A legacy version keeps the older lifecycle rules only. The Grade 4 Term 1 pack is in the workflow.

## Audit trail

Every action writes `audit_log` (user, time, entity, previous and new state, decision, notes, source reference) through the existing `write_audit_log`: source registration, retrieval, each review and each correction; each curriculum decision; findings raised and closed; open questions; formal assessment details; the switch into the workflow. Decisions, findings history and source reviews are also append-only tables (an update or delete is refused). A correction of recorded source evidence (`correct_source_evidence`) clears retrieval, identity verification and document review for that source, keeps the old values in the history, and requires a reason.

## What this does not do

It does not read the DBE documents, supply page numbers, answer the open questions, enter formal assessment details, or decide anything a curriculum specialist must decide. Where evidence is missing the screens say so and the action stays unavailable. See the checklist: [`grade4-mathematics-term1-checklist.md`](grade4-mathematics-term1-checklist.md).
