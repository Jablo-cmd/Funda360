# AI-assisted curriculum authoring

Status: implemented on branch `ccr-3b8a9155-845trs`, **not applied to production**.
Migrations: `20261002090000_ai_authoring.sql`, `20261002100000_recommendation_evidence_wording.sql`.
Builds on `docs/proposals/curriculum-engine.md`. Nothing here replaces that design: AI draws on the same tables, lifecycle and RLS.

## The rule this phase enforces

AI is a drafting assistant inside the existing governance, never a source of truth.

```
registered source ─┐
approved objective ─┴─> generation request ─> structured draft (origin ai_draft, status draft)
   ─> validation findings ─> human review (source references, verification)
   ─> approval by someone other than the requester ─> publication ─> teacher delivery
```

Nothing in the generator can approve, publish, retire, verify or edit published content.

## Where the model runs, and what it can touch

`supabase/functions/curriculum-ai-draft` is **not** a service-role function. It forwards the signed-in administrator's own JWT, so every
database call is authorised and attributed as that person:

| Step | Who/what | Check |
| --- | --- | --- |
| `ai_begin_generation` | RPC as the administrator | platform admin only; version not retired; topic belongs to version; every objective belongs to the topic **and is approved/published**; 20 requests/hour |
| `ai_generation_context` | RPC | prompt text comes from the database for that request (grade, subject, topic, objectives), never from client input; only the requester can read it |
| model call | provider module | returns text only; no database access; errors reduced to a code, bodies never stored or shown |
| schema check | `_shared/curriculum/schema.ts` | strict, never repairs; whitelisted blocks only; no unknown keys (so a model cannot smuggle `status`) |
| `ai_ingest_draft` | RPC | same limits re-checked in SQL (`ai_payload_problems`), then rows are created as `ai_draft` / `draft`, created by the requester |

If anything fails, the request is recorded as `rejected_output` or `failed` with short reasons and **nothing is written**.
The model identifier is configuration (`CURRICULUM_AI_MODEL`, no default) and the key is a secret (`ANTHROPIC_API_KEY`). Neither is in the repo.

## Data model (all new tables: RLS forced, platform administrators only, no client write policy, every write via RPC)

- `curriculum_sources`: registry of documents (title, publisher, licence, edition, checksum, `status` registered/verified/retired, where `verified` means *identity* verified and needs a recorded checksum and download date; plus `indexed_on` and `content_reviewed_*` for the other two steps of the source evidence ladder). Metadata only; documents are never copied in.
- `content_source_references`: which part (`locator`) of which source a unit rests on, and a reviewer's check (`matches` / `partial` / `does_not_match`).
- `content_verifications`: `unverified < source_backed < reviewed < verified`, with the content fingerprint it applies to.
- `ai_generation_requests` / `ai_generation_outputs`: requester, version, topic, objectives, provider, model, prompt version, schema version, accepted payload hash, rejection reasons, and which units came out of it.
- `content_validation_runs` / `content_validation_findings`: findings with severity (error/warning/note), category and where; warnings can be acknowledged with a reason, errors cannot.

No duplicate curriculum entities were created: lessons, resources and assessments already carried `origin` and `ai_disclosure`.

## Provenance: "where did this come from, who approved it?"

`content_provenance(entity, id)` (platform admins) returns origin, creator, the generation request (model, prompt version, requester, objectives),
source references and their checks, effective verification (stale after any edit), the latest validation outcome, the review trail and the approver.
Teachers see only the unit and its plain-language `ai_disclosure`; generation metadata, validation, sources and review notes stay internal.

## Lifecycle gates (triggers, so they hold for every path that changes a status)

For AI-origin units (`ai_content_gate`), approval **and** publication require:

1. a passing validation run (no error findings) for the content exactly as it reads now (fingerprint match);
2. every warning acknowledged by a reviewer;
3. verification of at least `reviewed`, set by a person other than the requester, against the same fingerprint (any edit after review resets it);
4. plus the existing rules: approver is not the requester; the curriculum version is published; lessons need a projector-free, data-free path.

`content_origin_lock` stops AI content being relabelled as authored. Published content stays immutable. Authored content is unaffected.
`content_transition` itself was not redefined.

## Verification levels, in plain words

These levels describe a unit of *content* checked against sources. They are not the status of a source and not the lifecycle (draft, review, approved, published, retired). The five steps for a *source* (indexed, retrieved, identity verified, content reviewed) and how they differ from curriculum verification are in `docs/sources/curriculum-source-register.md`; Content Studio shows them as separate rows.

| Level | Meaning | Never means |
| --- | --- | --- |
| unverified | nothing links it to a source | |
| source_backed | has a reference, not yet checked | |
| reviewed | a person other than the requester checked every reference and none contradicts | CAPS-aligned |
| verified | every reference matches a **verified** source | |

The interface and the AI disclosure never state curriculum alignment. The prompt forbids the model from mentioning CAPS/DBE or what a curriculum "requires",
and validation reports such text as an error for AI-origin content.

## Validation rules (ruleset 1)

Reports findings; never edits.

- Structure: objectives present and approved; toolkit has explain, practise/try, check and support (challenge/print noted); activities linked to the lesson's own resources; body blocks inside the whitelist; teacher notes; duration.
- Delivery: at least one resource usable with no projector, no connectivity and no learner device; projector/device conflicts; offline media; heavy bodies; whole-class activity needing a device per learner.
- Assessment: questions exist, every question has a key of the right type, multiple-choice answers are among 2 to 6 options, objective mapping, duplicates, difficulty spread.
- Safety/quality: links, emails/phone numbers, injection markers, placeholders, age-sensitive words (warning), unsupported factual claims (warning), official-curriculum claims (error, AI only), duplicate titles, missing alt text/transcripts.

## Evidence vs recommendation

`learning_recommendations.reason` now states only what was recorded (latest result, number of attempts, or that the latest two met mastery). The previous wording claimed "below the support threshold" even when a learner was flagged by the "two results under 60%" rule.
The teacher interface shows **Evidence:** and **Suggestion:** as separate statements. No prediction and no confidence score exists anywhere.

## Curriculum review workflow (20261004090000)

A curriculum version in the review workflow (`review_workflow = true`, the default for new versions) cannot be approved, published or drafted against by AI until `curriculum_review_compute()` says its review is complete: sources identity verified, documents reviewed and licences decided; every objective verified and every lesson, resource, practice check and question accepted, each at its current content; the formal assessment recorded and verified; every open question resolved with evidence or deferred (a deferred question that affects scope still blocks); no open finding. `ai_begin_generation` checks this in addition to every earlier rule, so a finding raised after approval closes drafting again. See `docs/verification/review-workflow.md`.

## Source material: identified, not yet registered or verified

The official sources are now identified in `docs/sources/` (added by the project owner on this branch): the DBE CAPS Mathematics Grades 4-6
policy statement (© 2011, ISBN 978-1-4315-0491-6; Grade 4 Term 1 begins at printed page 35), the 2026 Grade 4 Mathematics Annual Teaching Plan,
and a source register with a precedence order (current CAPS, then current ATP, then official support material, then Funda360 content, then AI drafts).
`docs/sources/caps/grade4-mathematics-term1-gap-analysis.md` records that the existing Term 1 pack is **incomplete against the 2026 ATP**
(for example rounding, number sentences, the properties of operations, multiplication, odd/even numbers, financial and measurement contexts)
and that it places Common Fractions in Term 1, which the ATP places later. Its conclusion stands: the pack must be reconciled before approval.

What is still open, and is deliberately not done by code:

1. The sources are registered in the pack data at the first step only (indexed, no checksum, not retrieved, identity not verified, content not reviewed) and none is marked verified. Registering them (title, publisher, licence, checksum) and verifying them is a person's step in the Content Studio.
2. The CAPS PDF is given under two different DBE URLs in `docs/sources/caps/grade4-mathematics-2026-source.md` (and the content pack) and in `docs/sources/curriculum-source-register.md`. Confirm they are the same document, and record a checksum when registering it.
3. Funda360's licence/permission position for using these documents as a reference is a legal decision still to be confirmed.
4. A corrected Term 1 structure now exists as the draft pack `ZA-G4-MATH-2026-T1` (see `docs/sources/caps/grade4-mathematics-2026-term1-mapping.md`). It has to be checked and **approved** before AI can draft against it: `ai_begin_generation` refuses objectives that are not approved, and a test pins that refusal. That is the intended behaviour.

Until then `supabase/content/grade4-mathematics-term1.sql` stays a draft, and no unit can be `reviewed` or `verified` against an authoritative source.

## Not built here

Content Studio authoring editor (create/edit units by hand), media upload, bulk generation, scheduled regeneration, multi-language generation review, learner/guardian views.
