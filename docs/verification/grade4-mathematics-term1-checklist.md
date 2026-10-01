# Verification checklist: Grade 4 Mathematics Term 1 (`ZA-G4-MATH-2026-T1`)

**Current status: DRAFT, NOT VERIFIED, NOT APPROVED, NOT PUBLISHED.** Implemented is not verified. Having the content in the database, passing the validator, or passing automated tests means the pack is internally consistent. It is not evidence that the pack matches CAPS or the 2026 ATP. Only the steps below, done by people, change that.

How to use it: work top to bottom, in the screens named in each section. Most rows are recorded in Funda360 itself (it keeps who, when and what), so this sheet is for the human trail: initial and date each row you complete, with the document, edition and page you used. Leave a row empty if you could not do it. Nobody ticks a row for someone else. What each status means is defined in [`review-workflow.md`](review-workflow.md).

**Roles.** The *author* wrote or generated the unit. The *verifier* is a curriculum specialist who compares it with the source. The *approver* moves it through Approved and Published in Content Studio. **The approver and the verifier must not be the author of the unit they approve or verify** (the database refuses an author approving their own AI content; for human-authored content this checklist asks the same).

## A. The source documents (Content Studio → Sources)

| # | Step | Where | Done by / date | Notes |
| --- | --- | --- | --- | --- |
| A1 | Run `docs/sources/verify-dbe-sources.sh <CAPS URL A> <CAPS URL B> <third CAPS location> <ATP URL>` from a machine that can reach `education.gov.za`. Keep the full output. | terminal | | |
| A2 | Result for CAPS: identical / different / inaccessible. If different, decide which edition applies and write it down. | Open question Q8 | | |
| A3 | Register any source that is missing (title, publisher, jurisdiction, subject, grade/phase, kind, canonical and other addresses, edition, ISBN, licence statement, notes). | Sources → Register a source | | |
| A4 | **Record the download** for each file: paste its `RECORD` line from step A1. Funda360 reads the checksum, size and address, and dates it. | Sources → Record the download | | |
| A5 | **Identity decision**: this is the intended authoritative edition (title page, publisher, year), with notes. | Sources → Identity review | | |
| A6 | **Document review**: what you read (sections and edition). Choose "Issues found" if the document disagrees with the project record, and describe it. | Sources → Document review | | |
| A7 | **Licence review**: permitted / restricted / not permitted, with notes. Use of DBE documents as reference material is a decision for the project owner. | Sources → Licence review | | |
| A8 | If the wrong file was hashed: **Correct recorded evidence** (needs a reason). Steps A4 to A6 are then redone. | Sources → Correct recorded evidence | | |

## B. Scope: is the objective list right? (Curriculum review → Objectives and Open questions)

| # | Step | Where | Done by / date | Notes |
| --- | --- | --- | --- | --- |
| B1 | Open the 2026 ATP Term 1. Compare it with `docs/sources/caps/grade4-mathematics-2026-atp.md` line by line. Record any difference as a finding. | Findings, or Q9 | | |
| B2 | For each of the 27 objectives choose **Verify** (source, section, page or reference, notes), **Request correction** or **Reject**. The machine-readable table `grade4-mathematics-2026-term1-objectives.csv` can be filled in alongside. | Objectives | | |
| B3 | Answer each of the nine open questions: **Resolved** (answer, source, section, page, explanation) or **Deferred** (reason). A deferred question that affects scope still blocks verification. | Open questions | | |
| B4 | Confirm that Common Fractions belongs to a later term, and which (not a Term 1 question; record it in Q9 or a finding). | Findings | | |
| B5 | Confirm weeks and hours per topic (Q4: pacing only). | Open questions | | |

## C. Teaching content (Lessons, Resources)

For every lesson (17) and its resources (112) and activities (34): read it against CAPS Grade 4 Term 1 requirements, concepts, skills and clarification notes. Choose **Accept**, **Needs correction** or **Reject** (notes required for the last two). **Flag an issue** to record a finding without a decision. The review never edits the content: the author fixes it and the reviewer re-reads it.

| # | Check | Done by / date | Notes |
| --- | --- | --- | --- |
| C1 | Mathematically correct; no misconception taught. | | |
| C2 | Right grade level and range (nothing beyond what Term 1 asks, nothing missing). | | |
| C3 | Strategies keep conceptual understanding (the ATP asks for this). | | |
| C4 | Language is clear for Grade 4 learners; South African contexts are appropriate. | | |
| C5 | Low-resource delivery is realistic: chalkboard, paper, bottle tops. | | |
| C6 | Each unit carries only objectives it actually teaches. | | |

## D. Assessment (Practice checks, Questions, Formal assessment)

| # | Check | Where | Done by / date | Notes |
| --- | --- | --- | --- | --- |
| D1 | Each of the 60 questions: correct key, one defensible answer, appropriate difficulty, marks reasonable. | Questions | | |
| D2 | Multiple-choice distractors are plausible and none is also correct. | Questions | | |
| D3 | Short-answer marking notes are enough for a teacher to mark consistently. | Questions | | |
| D4 | The six practice checks are labelled as Funda360 practice, not DBE tasks; accept or reject each. | Practice checks | | |
| D5 | FA.01: **Record official details** (name, type, scope, duration, timing, marks and weighting only if the source states them, instructions, source, section, page, notes). Not before the source is verified. Then **Review** the formal assessment. | Formal assessment | | |

## E. Completion, approval and publication

| # | Step | Where | Done by / date | Notes |
| --- | --- | --- | --- | --- |
| E1 | Close or dismiss every open finding, with a note on how it was dealt with. | Findings | | |
| E2 | The Summary says **REVIEW COMPLETE — NOT APPROVED** and lists no blockers. | Summary | | |
| E3 | Move the version to review, then approve it. **The approver is a different person from the author and from anyone who must not approve their own work.** Approval is refused while any blocker remains. | Content Studio review queue | | |
| E4 | Accept lessons, resources and practice checks one by one, then approve each (again not by their author). | Review queue | | |
| E5 | Publish only what you intend teachers to see. Published content is immutable. | Review queue | | |

## F. Before any AI drafting

| # | Step | Done by / date | Notes |
| --- | --- | --- | --- |
| F1 | The review is complete and the version approved (E3). AI drafting is refused until then, and again if a new finding reopens the review. | | |
| F2 | Provider account, `ANTHROPIC_API_KEY` and `CURRICULUM_AI_MODEL` set by the platform owner as Edge Function secrets, never in the repository. | | |
| F3 | A real test of the provider with a few objectives and a human reading the output, in staging. (Not done: no provider call has ever been made for this pack.) | | |
| F4 | Legal/licence decision on using DBE documents as model inputs. | | |

## Sign-off

| Role | Name | Date | Signature |
| --- | --- | --- | --- |
| Curriculum specialist (verifier) | | | |
| Approver (not the author) | | | |

Until every row that applies is complete and signed, the pack stays: **DRAFT, NOT VERIFIED, NOT APPROVED, NOT PUBLISHED.**
