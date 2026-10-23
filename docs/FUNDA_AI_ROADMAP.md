# Funda AI: product roadmap

Written 2026-10-09. Nothing in this document is built yet unless it says so. Phase 1 (`docs/FUNDA_AI.md`) is code complete and **not** in production; the release gates are in `docs/FUNDA_AI_PILOT_READINESS.md`.

The goal: an assistant that is useful to every person in a South African school (leaders, teachers, finance and admin staff, parents and learners), and that can absorb better models and new capabilities without a rewrite.

## 1. Principles that do not change

Every feature below keeps these properties. A feature that cannot keep them is not built.

1. **The database decides access.** The assistant reads with the caller's own JWT, so RLS limits it to what that person may already see. It never gets a wider view than its user.
2. **Read first, act only with a human.** Write actions are proposals. A person confirms them in the normal UI, which runs the usual audited RPC.
3. **Evidence, or no number.** Figures in answers must trace to a tool result (the evidence check). Generated content (lesson plans, letters) is labelled as a draft.
4. **Children first.** Safeguarding signals stop the model call and point to the designated safeguarding lead (DSL). Learner-facing features are a separate, stricter product (section 3.5).
5. **Per-school control.** Each feature is switched on per school, per role, with its own budget, retention and audit.
6. **Provider-neutral.** Models are reached through the provider interface (`_shared/ai/provider.ts`) and the model route table (`_shared/ai/routing.ts`), so a newer or cheaper model is a configuration change plus an evaluation run, not a code change.

## 2. Platform capabilities (build these first; every feature uses them)

| Capability                          | What it gives                                                                                                                         | Notes                                                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool registry by domain             | Tools grouped by module (academic, attendance, finance, communication, operations), each declaring its permission and data class      | Today: 5 tools in one file. New tools add a file and a registry entry; policy lists which tools each feature may use.                                                |
| Feature catalogue                   | Each feature = prompt version + allowed tools + roles + output schema + budget                                                        | Exists in the database (`ai_features`); needs an admin screen.                                                                                                       |
| Model routing and evaluation gate   | Route by task (fast/cheap for classification, strongest for analysis); a new model must pass the evaluation set before it is routed   | Route table exists; the evaluation set exists (`_shared/ai/eval/`). Add a "promote model" step that requires a passing run.                                          |
| Streaming responses                 | Answers appear as they are written                                                                                                    | Needs the evidence check to run on the final text before the answer is marked verified.                                                                             |
| Server-side conversations           | History stored per user, with the school's retention; the client stops sending history                                                | Tables exist (opt-in, off). Needs the retention decision (gate 3).                                                                                                   |
| Proposal / approval workflow        | The model drafts an action ("send this message to Grade 10 parents"); a person approves it in the UI                                  | Label exists only. Required before any write feature.                                                                                                                |
| School knowledge (retrieval)        | Answers from the school's own policies, code of conduct, calendar, CAPS documents                                                     | Needs pgvector, a storage review and per-school isolation tests. Documents only, never learner records in the index.                                                 |
| Multilingual output                 | Answers and parent drafts in English, isiZulu, isiXhosa, Afrikaans, Sesotho, Setswana and others                                       | Needs native-speaker review per language, and screening that works in each language (today it does not: section 5).                                                 |
| Usage, cost and quality dashboard   | Per-school usage, budget burn, blocked requests, feedback, evaluation scores                                                          | Data exists (`ai_requests`, `ai_feedback`, `ai_usage_summary`). Needs the admin screen and alerts.                                                                  |
| Classifier-based safeguarding       | A model-based check alongside the patterns                                                                                            | Patterns caught 0 of 8 indirect disclosures. Needs its own privacy review, because it also sends text to a provider.                                                 |

## 3. School features, by audience

Each feature lists its prerequisites. "Read-only" means it can ship as soon as its tools and evaluation exist.

### 3.1 School leaders (owner, principal, deputy)

- **School pulse** (read-only): weekly summary of attendance, assessments, fees and incidents, with trends and the learners who need attention. Uses existing reporting RPCs.
- **At-risk learners** (read-only): combine attendance, marks and behaviour into a list with the reason for each name. Must show the rule used, not a black-box score.
- **Ask the data** (Phase 1, built): questions about the school's own records with cited evidence.
- **Report and minutes drafting**: governing body reports, SGB minutes from notes, termly reports to the district. Needs the proposal workflow.
- **Policy Q&A**: "What does our code of conduct say about cell phones?" Needs school knowledge (retrieval).

### 3.2 Teachers

Prerequisite for all: **class-scoped access** (today `can_view_academic` shows every learner in the school; see `docs/FUNDA_AI.md` section 1).

- **My class overview** (read-only): attendance, marks and homework status for the teacher's own classes.
- **Lesson and assessment planning**: CAPS-aligned lesson plans, worksheets, rubrics and memos by grade, subject and term. Generated content, no learner data needed, so it can ship before class scoping.
- **Marking assistance**: suggested comments and rubric scores for a teacher to accept or change. Never a final mark without the teacher.
- **Report-card comments**: draft comments from a learner's actual marks and attendance, for the teacher to edit. Uses the existing report-card RPCs through the proposal workflow.
- **Differentiation**: the same lesson pitched at support, core and extension level.

### 3.3 Finance and administration

- **Fees overview** (read-only): outstanding balances, ageing, payment trends.
- **Parent payment reminders**: drafts, approved by a person, sent through the existing notification pipeline.
- **Admissions assistant**: summarise applications and missing documents for the admissions officer.

### 3.4 Parents and guardians

Separate product, own prompts, own evaluation:

- **Progress explained**: "How is my child doing?" answered from their own child's records only (RLS already limits guardians to linked learners).
- **School information**: calendar, fees, policies, in the parent's language.
- **Message helper**: draft a message to the teacher.

### 3.5 Learners

Highest risk; last to build. Requires its own POPIA/COPPA review, parental consent (the consent framework exists), age-appropriate design and a much stricter safeguarding path.

- **Study helper**: explains concepts and gives practice questions without doing assessed work for the learner.
- **Homework guidance**: hints, not answers.
- **Revision plans** before exams.

### 3.6 Districts and provinces

- **Reporting narrative**: plain-language summaries of the District and Provincial dashboards, built only on `reporting_school_ids()` scope and aggregate data, never learner names.

## 4. Order of delivery

1. **Pilot Phase 1** once the readiness gates are closed.
2. **Platform**: admin screen, usage dashboard and alerts, streaming, server-side conversations, the proposal workflow, and the model-promotion gate.
3. **Teacher tools without learner data**: lesson planning, worksheets and rubrics.
4. **Class-scoped teacher access**, then teacher tools with learner data: class overview, report-card comments, marking help.
5. **School knowledge** (retrieval) and multilingual output.
6. **Parent features.**
7. **Learner features**, only after a separate review.

Each step ships behind its feature flag, per school, with its own evaluation cases added to `_shared/ai/eval/` before release.

## 5. Known limits to solve along the way

- Safeguarding patterns miss indirect disclosures and non-English text.
- No automatic alerting on budget burn or blocked-request spikes.
- Answer quality with a real model has never been measured.
- Evidence checking covers figures and simple claims, not every factual statement.
