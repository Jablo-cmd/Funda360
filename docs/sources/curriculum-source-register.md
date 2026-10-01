# Funda360 Curriculum Source Register

Official South African curriculum sources used by the Curriculum Engine.

## Grade 4 Mathematics

### 1. CAPS — policy authority
Mathematics Grades 4–6, Curriculum and Assessment Policy Statement (CAPS), Intermediate Phase

Official DBE source:
https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20IP%20%20MATHEMATICS%20GR%204-6%20web.pdf

Purpose:
- curriculum policy and content scope
- concepts and skills
- clarification/teaching guidance
- topic structure
- suggested duration

### 2. 2026 Annual Teaching Plan — current sequencing authority
2026 Annual Teaching Plans: English Mathematics: Grade 4

Official DBE source:
https://www.education.gov.za/Portals/0/Documents/Recovery%20plan%20page/2026%20ATPs/2026_ATP_Mathematics_Grade%204.pdf?ver=2026-01-20-202040-057

(An earlier version of this register wrote the file name with a space instead of the underscore before "Grade". The underscore form is the one the DBE index lists and the one the pack's source record uses. Neither spelling has been opened: see the evidence ladder below.)

Purpose:
- current 2026 term/week sequencing
- topic allocation
- hours
- concepts and skills
- formal assessment tasks
- prerequisite skills

### 3. DBE Intermediate Phase curriculum index
https://www.education.gov.za/Curriculum/CurriculumAssessmentPolicyStatements(CAPS)/CAPSIntermediate.aspx

Purpose:
- official subject-document discovery
- authority check for current DBE-hosted CAPS material

### 4. DBE 2026 Intermediate Phase ATP index
https://www.education.gov.za/Curriculum/NationalCurriculumStatementsGradesR-12/2023ATPsIP.aspx

Purpose:
- official current ATP discovery
- current Grade 4–6 content-subject plans

## Funda360 source precedence

For curriculum generation and verification use:

1. Current DBE policy/CAPS for authoritative curriculum requirements.
2. Current DBE ATP for the applicable year's sequencing, timing and formal assessment structure.
3. DBE LTSM/workbooks and other official support material as supporting teaching references.
4. Funda360-authored content as implementation material.
5. AI-generated content as draft material only until human review.

## What "verified" means: five separate things

The word "verified" used to cover several different facts. They are now recorded separately, and each one needs the one before it. None of them is implied by another, and none is implied by a document merely being listed.

| Step | Question it answers | Recorded as | Who | Today (CAPS Mathematics Gr 4-6, 2026 Grade 4 ATP) |
| --- | --- | --- | --- | --- |
| 1. Indexed | Was a document with this title seen at this URL (for example in the DBE's own index)? | `indexed_on` | anyone, platform admin in the app | **Yes** (2026-10-01, from search-index observation only) |
| 2. Retrieved | Were the actual bytes downloaded and hashed? | `checksum_sha256` and `retrieved_on` | whoever runs `verify-dbe-sources.sh` | **No.** The build environment cannot reach `education.gov.za`; no checksum exists. |
| 3. Identity verified | Did a person confirm the downloaded file is the authoritative current edition? | `status = verified` (needs step 2) | a platform administrator | **No** |
| 4. Content reviewed | Did a person read the document itself (sections, edition)? | `content_reviewed_*` (needs step 3) | a curriculum specialist | **No** |
| 5. Curriculum verified | Does a specific Funda360 objective, lesson, resource or question match the source? | `content_source_references.check_result` and `content_verifications` | a curriculum specialist who is **not** the author | **No** (every unit is `pending`) |

Steps 1-4 describe a *source*. Step 5 describes a *unit of Funda360 content* and is checked one unit at a time: a source can be fully reviewed while every lesson that cites it is still unverified.

Separate again is the **content lifecycle** of a unit: Draft, Review, Approved, Published, Retired. A unit that is `approved` is not thereby `verified`, and a `verified` unit is not thereby published. Content Studio shows the three as three different rows so they cannot be confused.

The database enforces the order: retrieval evidence can only be recorded from the `RECORD` line printed by `docs/sources/verify-dbe-sources.sh` (the server parses it, requires a retrieved PDF with an HTTP success and a requested address that is registered for the source, and dates it itself: a checksum cannot be typed in or supplied at registration); identity cannot be verified without a checksum; a document cannot be reviewed before identity is verified; a recorded checksum cannot be replaced except through the explicit, audited correction workflow, which clears retrieval, identity and document review so they are redone. Identity, document and licence reviews are recorded decisions (reviewer, date, decision, notes, findings) kept in an append-only history. See `supabase/migrations/20261003090000_source_evidence_ladder.sql`, `supabase/migrations/20261004090000_curriculum_review_workflow.sql` and, for the exact definition of each status, [`../verification/review-workflow.md`](../verification/review-workflow.md).

Everything is done in Content Studio, Sources. A source description holds: title, publisher, jurisdiction, subject, grade or phase, kind of document, canonical and other addresses, edition or year, ISBN, licence statement and notes.

## Source identity check (CAPS Mathematics Grades 4-6)

**Result: NOT ESTABLISHED. No checksum was recorded and none was invented.**

Two different DBE URLs were documented for the CAPS Mathematics Grades 4-6 document:

| | URL | Where documented |
| --- | --- | --- |
| A (working reference) | `https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20IP%20%20MATHEMATICS%20GR%204-6%20web.pdf` | this register, the gap analysis |
| B | `https://www.education.gov.za/LinkClick.aspx?fileticket=dr7zg3CFCr8%3D&forcedownload=true&mid=1568&portalid=0&tabid=572` | `grade4-mathematics-2026-source.md`, the earlier content pack |

What was done and what was found:

- **Download attempted** for both and for the ATP. Every request was refused by the build environment's egress policy (HTTP 403 on the proxy tunnel for `education.gov.za`). The policy was not worked around. So no bytes were obtained, no SHA-256 can be computed, and byte-identity cannot be tested here.
- **Search restricted to `education.gov.za`** shows, for this document: URL A (also with a `?ver=2015-01-27-161430-553` cache-buster, which is the same path) titled `CAPS IP MATHEMATICS GR 4-6 web.pdf`; a third location, `https://www.education.gov.za/Portals/0/Documents/Policies/CAPS/MATHEMATICS%20Intermediate.pdf`; and a `LinkClick.aspx?fileticket=TOpWmT9Dm6U%3D` link titled "1". **URL B (`fileticket=dr7zg3CFCr8%3D`) did not appear**, so it is unconfirmed that it resolves to this document at all. These are search-index observations, not checks of content.
- For the ATP, the index lists `https://www.education.gov.za/Portals/0/Documents/Recovery%20plan%20page/2026%20ATPs/2026_ATP_Mathematics_Grade%204.pdf` (with and without `?ver=2026-01-20-202040-057`), titled `2026 ANNUAL TEACHING PLANS: ENGLISH MATHEMATICS: GRADE 4 (TERM 1)`.

Decision for this implementation: URL A is the **working reference** because it is the DBE's own indexed location for this title and is the one used by the register and the gap analysis. That is not a finding that A and B are the same file. **Flagged for human review.**

How to settle it (about two minutes, on a machine that can reach the DBE site). Then paste each printed `RECORD` line into Content Studio, Sources, "Record the download":

```
docs/sources/verify-dbe-sources.sh \
  "<URL A>" "<URL B>" "https://www.education.gov.za/Portals/0/Documents/Policies/CAPS/MATHEMATICS%20Intermediate.pdf" "<ATP URL>"
```

If the checksums are equal: record one canonical URL, list the others as aliases, record the SHA-256, page count, title and ISBN here, and in the source registry (Content Studio, Sources). If they differ: do not merge them. Record the difference and ask a curriculum specialist which edition applies. Mark a source "verified" only after that.

## Current Grade 4 Mathematics status

Sources located and recorded. Two sources are registered in the app (`curriculum_sources`) at the first step only: **indexed**. Not retrieved, no checksum, identity not verified, content not reviewed.

- The earlier draft pack (`ZA-CAPS-G4-MATH-SLICE`) is kept as history and marked superseded. It is incomplete against the 2026 ATP and places Common Fractions in Term 1.
- The reconciled draft pack (`ZA-G4-MATH-2026-T1`) represents the recorded 2026 Term 1 scope. See [`caps/grade4-mathematics-term1-gap-analysis.md`](caps/grade4-mathematics-term1-gap-analysis.md) and [`caps/grade4-mathematics-2026-term1-mapping.md`](caps/grade4-mathematics-2026-term1-mapping.md).
- It is **DRAFT and NOT VERIFIED**. Nothing is approved or published. Do not describe it as CAPS aligned. The accurate wording is: "Mapped to the DBE 2026 Grade 4 Mathematics ATP, Term 1, by Funda360, awaiting specialist verification."

## Copyright/provenance

Funda360 should store source metadata, links, concise paraphrases and mappings rather than reproducing entire government documents.

Where official source files are needed operationally, preserve the original source URL and retrieval metadata and use only material permitted for the intended use.
