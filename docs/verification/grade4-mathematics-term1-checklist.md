# Verification checklist: Grade 4 Mathematics Term 1 (`ZA-G4-MATH-2026-T1`)

**Current status: DRAFT, NOT VERIFIED, NOT APPROVED, NOT PUBLISHED.** Implemented is not verified. Having the content in the database, passing the validator, or passing automated tests means the pack is internally consistent. It is not evidence that the pack matches CAPS or the 2026 ATP. Only the steps below, done by people, change that.

How to use it: work top to bottom. Initial and date each row you complete, with the document, edition and page you used. Leave a row empty if you could not do it. Nobody ticks a row for someone else.

**Roles.** The *author* wrote or generated the unit. The *verifier* is a curriculum specialist who compares it with the source. The *approver* moves it through Approved and Published in Content Studio. **The approver and the verifier must not be the author of the unit they approve or verify** (the database refuses an author approving their own AI content; for human-authored content this checklist asks the same).

## A. The source documents (before anything else)

| # | Step | Done by / date | Notes |
| --- | --- | --- | --- |
| A1 | Run `docs/sources/verify-dbe-sources.sh <CAPS URL A> <CAPS URL B> <third CAPS location> <ATP URL>` from a machine that can reach `education.gov.za`. Keep the full output. | | |
| A2 | Result for CAPS: identical / different / inaccessible. If different, decide which edition applies and write it down. | | |
| A3 | In Content Studio, Sources: **Record the download** (SHA-256 and date) for each file you actually downloaded. | | |
| A4 | **Confirm identity**: the file is the authoritative current edition (title page, publisher, year). | | |
| A5 | **Record document review** (what sections you read, which edition). | | |

## B. Scope: is the objective list right?

| # | Step | Done by / date | Notes |
| --- | --- | --- | --- |
| B1 | Open the 2026 ATP Term 1. Compare it with `docs/sources/caps/grade4-mathematics-2026-atp.md` line by line. Record any difference. | | |
| B2 | Fill in `source_page` for each of the 27 rows of `grade4-mathematics-2026-term1-objectives.csv` and set `verification_status` only for the rows you checked. | | |
| B3 | Answer each open question in `grade4-mathematics-2026-term1-open-questions.md` (9 questions). Record the answer, document and page. | | |
| B4 | Confirm that Common Fractions belongs to a later term, and which. | | |
| B5 | Confirm week and hour allocations per topic (none are stored today). | | |

## C. Teaching content

For every lesson (17) and its resources (112) and activities (34): read it against CAPS Grade 4 Term 1 requirements, concepts, skills and clarification notes.

| # | Check | Done by / date | Notes |
| --- | --- | --- | --- |
| C1 | Mathematically correct; no misconception taught. | | |
| C2 | Right grade level and range (nothing beyond what Term 1 asks, nothing missing). | | |
| C3 | Strategies keep conceptual understanding (the ATP asks for this). | | |
| C4 | Language is clear for Grade 4 learners; South African contexts are appropriate. | | |
| C5 | Low-resource delivery is realistic: chalkboard, paper, bottle tops. | | |
| C6 | Each unit carries only objectives it actually teaches. | | |

## D. Assessment

| # | Check | Done by / date | Notes |
| --- | --- | --- | --- |
| D1 | Each of the 60 questions: correct key, one defensible answer, appropriate difficulty, marks reasonable. | | |
| D2 | Multiple-choice distractors are plausible and none is also correct. | | |
| D3 | Short-answer marking notes are enough for a teacher to mark consistently. | | |
| D4 | The six practice checks are labelled as Funda360 practice, not DBE tasks. | | |
| D5 | FA.01: enter the official task details (marks, weighting, rubric, questions, duration) from the document, using `grade4-mathematics-2026-term1-formal-assessment-details.md`. Not before. | | |

## E. Verification and approval in Content Studio

| # | Step | Done by / date | Notes |
| --- | --- | --- | --- |
| E1 | For each unit, set the source-reference **check result** (verified / rejected) only after you compared the unit with the cited page. | | |
| E2 | Set the unit's **curriculum verification** level. `verified` needs a source that is itself identity-verified. | | |
| E3 | Run validation; acknowledge each warning with a reason. | | |
| E4 | Approve objectives first (nothing else, including AI drafting, can proceed until they are approved). | | |
| E5 | The approver is a different person from the author. | | |
| E6 | Publish only the units you intend teachers to see. Published content is immutable. | | |

## F. Before any AI drafting

| # | Step | Done by / date | Notes |
| --- | --- | --- | --- |
| F1 | Objectives approved (E4). | | |
| F2 | Provider account, `ANTHROPIC_API_KEY` and `CURRICULUM_AI_MODEL` set by the platform owner as Edge Function secrets, never in the repository. | | |
| F3 | A real test of the provider with a few objectives and a human reading the output. (Not done: no provider call has ever been made for this pack.) | | |
| F4 | Legal/licence decision on using DBE documents as model inputs. | | |

## Sign-off

| Role | Name | Date | Signature |
| --- | --- | --- | --- |
| Curriculum specialist (verifier) | | | |
| Approver (not the author) | | | |

Until every row that applies is complete and signed, the pack stays: **DRAFT, NOT VERIFIED, NOT APPROVED, NOT PUBLISHED.**
