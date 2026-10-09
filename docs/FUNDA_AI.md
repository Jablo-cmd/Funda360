# Funda AI: Phase 1 foundation and pre-pilot hardening

Status (2026-10-09): code complete on branch `claude/funda360-audit-0foiq8`, hardened against the 2026-10-09 audit, and tested locally and on a real local Supabase stack. **Not deployed and not ready for a pilot**: the human privacy and deployment decisions in section 12 are still open.

Production has no AI tables, the `funda-ai` function is not deployed, and no model provider key is configured. Every feature is off by default. No real model has been called, so answer quality is unmeasured.

This document describes only what exists in the code. Section 10 lists what is designed for but not built.

## 1. What a user can do

Staff with an enabled role at a school with Funda AI enabled see a **Funda AI** button in the dashboard header. They ask about data they can already see. Funda AI may look up:

| Tool                             | Reads                                                                     | Roles (tool level)                                                 | RLS that decides the rows    |
| -------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------- |
| `find_learners`                  | `learners` (name, learner number, status only)                            | school_owner, principal, vice_principal, department_head, teachers | `can_view_learners`          |
| `get_learner_attendance_summary` | `attendance_records`, rate = (present + late) / (present + late + absent) | school_owner, principal, teacher, class_teacher, subject_teacher   | `can_view_academic`          |
| `get_learner_assessment_summary` | `assessment_results` + active `assessments`, unweighted averages          | same as attendance                                                 | `can_view_academic`          |
| `get_learner_fee_summary`        | the four `learner_fee_*` ledgers, `active = true`, same formula as the UI | school_owner, principal, finance_manager                           | `can_view_learner_financial` |
| `get_reporting_summary`          | `get_government_report()` (own school for school leaders)                 | school_owner, principal                                            | `reporting_school_ids()`     |

An answer shows:

- the text;
- **evidence**: each figure with its period, and whether it matched the exact field it cites ("Matches Funda360 data") or not ("Rejected");
- **limitations**;
- **confidence**;
- actions that need a person;
- which lookups ran or were refused;
- **Helpful / Not helpful / Report a problem** feedback.

If the answer text contains a number that is not a verified figure, the text is **withheld** and replaced by a notice (section 7).

Funda AI has **no write tools**. It cannot change marks, fees, admissions, discipline, safeguarding or government submissions.

Parents, learners, education officials and platform administrators are not in the seeded feature's roles, and no tool lists a family role.

### Teacher scope: recommended pilot policy (no permission changed)

Funda360's existing rule `can_view_academic` (`20260803150000_academic_structure.sql`) lets `teacher`, `class_teacher` and `subject_teacher` read attendance and assessment results for **every learner in their school**, not only their own classes. Funda AI does not widen this, but it makes school-wide lookups much faster.

Recommendation, for a human decision before the pilot:

1. Pilot with **school_owner and principal only**. At enablement, a platform admin sets `ai_admin_update_feature('copilot', '{"allowed_roles": ["school_owner", "principal"]}')`.
2. Before adding teachers, add class-scoped tools that filter by the teacher's `teaching_assignments` and `class_teacher_assignments` (Phase 2).
3. Decide separately whether the school-wide teacher rule itself should change. That is a change to Funda360's permissions, not to Funda AI, and is out of scope here.

## 2. Architecture

```
browser (user JWT)
  └─ supabase.functions.invoke('funda-ai')    JWT verified by the platform
       └─ handleFundaAi()                     supabase/functions/_shared/ai/gateway.ts
            1. ai_authorize_request()         as the user: flag, role, school, message + history sizes,
                                              rate limits, budget pre-check, under per-user/per-school locks
            2. ai_start_request()             service role: reserve budget, return policy (single use)
            3. safety screen                  EVERY turn; safeguarding -> guidance, medical -> notice,
                                              SA ID numbers redacted; no model call when stopped
            4. prompt registry + routing      code-only prompt (school_copilot v2), model from config
            5. model <-> tool loop            ONE deadline (default 110 s) for all turns and retries;
                                              ≤5 model turns, ≤8 tool calls; tools run as the user (RLS)
            6. output validation              JSON schema; field-level evidence; unsupported figures withhold
            7. ai_complete_request()          service role: settle actual usage (or keep the reservation
                                              when usage is unknown); no content
     pg_cron: ai_recover_stale_requests() every minute; ai_purge_expired() daily 02:20 UTC
```

**Authority stays in the database.** The gateway never holds a database credential for user data. The policy decision and every data read use a supabase-js client that carries the caller's JWT, so the existing RLS and SECURITY DEFINER checks apply exactly as on the user's own screens.

The service-role key is used only for `ai_start_request`, `ai_record_tool_call`, `ai_complete_request` and `ai_store_exchange`, which are executable by `service_role` alone.

## 3. Files

| Path                                                         | Purpose                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261011090000_funda_ai_foundation.sql` | Tables, policies, gate, usage/audit and admin RPCs, `copilot` seed (disabled)                     |
| `supabase/migrations/20261012090000_funda_ai_hardening.sql`  | Locks, reservations, start/settle/recover, budgets, admin fixes, retention, cron schedules        |
| `supabase/functions/funda-ai/index.ts`                       | Edge Function wiring (env, clients, deadline)                                                     |
| `supabase/functions/_shared/ai/gateway.ts`                   | Request handling, safety, loop, deadline, settlement                                              |
| `…/ai/evidence.ts`                                           | Field-level evidence, figure extraction, confidence rules                                         |
| `…/ai/provider.ts`, `…/ai/anthropic.ts`                      | Provider-neutral interface; Claude adapter (official SDK `@anthropic-ai/sdk@0.128.0`)             |
| `…/ai/routing.ts`, `…/ai/prompts.ts`                         | Model routes and pricing; versioned prompts and output schemas                                    |
| `…/ai/safety.ts`                                             | Screening, ID redaction, untrusted-data wrapper, safeguarding and medical notices                 |
| `…/ai/tools.ts`, `…/ai/data.ts`, `…/ai/schema.ts`            | Tool registry, read-only user-scoped data, JSON-schema validator                                  |
| `src/features/ai/`                                           | Launcher, panel, answer card, service, response parser                                            |

## 4. Database

Tables (RLS forced, `revoke all` from anon/authenticated, then narrow `select` grants):

- **`ai_features`**: per-feature flag and policy:
  - roles, tools, prompt, model tier;
  - `max_input_chars` (message) and `max_history_chars` (history; default 12,000);
  - output tokens;
  - rate limits per user per minute and day, and per school per day;
  - **`school_monthly_token_budget`** (required, default 3,000,000) and **`user_monthly_token_budget`** (default 500,000);
  - `request_token_reservation` (default 120,000);
  - `medical_content_policy` (`block` by default);
  - content storage and retention, audit retention, feedback retention (default 180 days), human-review flag.

  No budget can be NULL or unlimited.
- **`ai_school_settings`**: per-school switch, an **explicit** feature list (empty means none) and an optional budget override.
- **`ai_requests`**: one row per request, allowed or blocked. It records:
  - user, school, role, feature, status, block reason;
  - message and history sizes;
  - `started_at`, `reserved_tokens`, **`charged_tokens`** (what counts against budgets) and `usage_estimated`;
  - model, prompt version, tokens, estimated cost, safety flags, error code, duration.

  **No prompt or answer text.**
- **`ai_tool_calls`**: tool name and outcome only.
- **`ai_conversations` / `ai_messages`**: written only when `store_content = true` (default **false**). Owner-only.
- **`ai_feedback`**: rating and an optional comment.

Policy gate and budget (audit H1):

- `ai_authorize_request(feature, message_chars, client_request_id, history_chars)` takes a **per-user advisory lock, then a per-school lock** (always in that order) before counting. Parallel requests therefore see each other: 50 parallel requests against a limit of 2 admit exactly 2, both through the gateway and through direct RPC calls.
- It returns only `{allowed, reason?, request_id?}`; limits, tools and prompt ids are not disclosed (L1).
- Blocked attempts are recorded, but at most 20 per user per minute (L1).
- `ai_start_request(request_id)` (service role, single use, within 2 minutes) re-checks the school and user budgets **including in-flight reservations** under the same locks. It then reserves `request_token_reservation` tokens and returns the principal and policy. Measured: 50 parallel requests against a budget that fits 5 run exactly 5; the other 45 are refused `budget_exhausted`.
- `ai_complete_request(…, usage_unknown)` replaces the reservation with actual tokens. When a provider call was cut off (deadline, abort, crash), the provider may have billed tokens we never saw, so the charge stays at least the reservation and is marked `usage_estimated`.

Recovery and retention (H3, M5), scheduled with pg_cron (hosted Supabase has it; production runs pg_cron 1.6.4, checked read-only 2026-10-09):

- `ai_recover_stale_requests()` runs every minute (`funda-ai-recover-stale`):
  - a request started more than 5 minutes ago that never reported back becomes `failed` / `stale_request`, keeping its reservation charged (estimated);
  - a request authorised but never started for 2 minutes (e.g. a direct RPC call) becomes `failed` / `never_started`, with nothing charged.
- `ai_purge_expired()` runs daily at 02:20 UTC (`funda-ai-retention`). It deletes:
  - expired conversations;
  - feedback older than `feedback_retention_days`;
  - request rows older than `audit_retention_days`, with their tool calls and feedback. Rows still open are never purged.

Administration (M4): `ai_admin_update_feature` and `ai_admin_set_school` need a platform admin with an **aal2** session and are written to `audit_log`.

- `ai_admin_update_feature` rejects unknown fields and **null** values.
- `ai_admin_set_school(school, enabled, features, budget, clear_budget)`:
  - **keeps every setting that is not passed**, so disabling and re-enabling a school no longer wipes its feature list or budget;
  - starts a new row with no features;
  - rejects unknown features and non-positive budgets;
  - `clear_budget` falls back to the (finite) feature budget.

Other functions: `ai_my_features()` (launcher list), `ai_submit_feedback` (own requests), `ai_usage_summary`.

## 5. Model provider

One real adapter: Claude through the official Anthropic TypeScript SDK.

- **Model and effort:** the default route for every tier is `claude-opus-5-5`, with `output_config.effort` low, medium or high per tier.
- **Structured output:** answers use `output_config.format` (JSON schema), validated again locally.
- **Server-side refusal fallback is enabled** on the default routes (`fallbacks: "default"`). A refused request may be re-run on Anthropic's recommended fallback model. `ai_requests.model` records which model answered.
- **Deadline (H3):** one deadline covers the whole request (`FUNDA_AI_DEADLINE_MS`, default 110,000, clamped to 5,000-140,000; hosted Edge Functions stop at 150 s on the Free plan).
  - Each call's timeout is the smaller of the route timeout and the time left.
  - The deadline's abort signal also stops the SDK's retries.
  - No new model turn starts with less than 3 s left. A request that runs out returns **504 `ai_timeout`** and is settled with usage unknown.

| Variable                                                         | Required  | Meaning                                                                               |
| ---------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                                              | to answer | Without it every request returns **503 `ai_provider_not_configured`**. No fake answers. |
| `FUNDA_AI_MODEL_ROUTES`                                          | no        | JSON routes per tier; invalid JSON keeps the defaults and logs `funda_ai.config_error` |
| `FUNDA_AI_PRICING`                                               | no        | Prices per model for cost estimates; none built in                                    |
| `FUNDA_AI_DEADLINE_MS`                                           | no        | Request deadline (see above)                                                          |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | yes       | Provided by the platform                                                              |

Never set `ANTHROPIC_BASE_URL` in production; the SDK would send requests there.

## 6. Safety and prompt-injection defence

- **Every turn is screened (H2):** the new message **and every history turn** the client sends, user and assistant alike.
  - A safeguarding signal (self-harm, abuse, violence) in any turn ends the request with fixed guidance: the designated safeguarding lead, SAPS 10111, Childline 116. **No model call** is made (tested with disclosures placed in user and assistant history turns).
  - Patterns include common phrasings such as "her stepfather hits her", "beaten by his uncle", "bruises on her arms" and "scared to go home".
  - **Pattern screening will still miss some disclosures** (indirect wording, other languages, misspellings) and will flag some harmless text. It is a backstop, not a classifier.
- **ID numbers (M1):** 13-digit South African ID numbers (optionally spaced 6-4-3) in the message or history are replaced with `[ID number removed]` before anything is sent (`personal_identifier_redacted`). Passport numbers, phone numbers and e-mail addresses are **not** redacted.
- **Medical content (M1):** blocked by default (`medical_content_policy = 'block'`). The request ends with a fixed notice and no model call, recorded as `policy_blocked`. The term list is limited (e.g. ADHD, autism, depression, HIV, TB, medication, diagnosis).
- **SYSTEM** is the versioned prompt from code. Only four server-side variables are substituted, each flattened to one line and capped at 300 characters.
- **USER** text is always a user turn.
- **Client-supplied history** is the client's word: a user can write fake "assistant" turns. That can only mislead their own answer, because lookups are still limited by RLS.
- **TOOL OUTPUT** is JSON-encoded inside `{ trust: "untrusted_data", data: … }`. Injection-looking text adds `injection_in_tool_data`.
- **Audit flags:** injection, exfiltration and restricted-action patterns are flagged for audit only; they do not change access.

## 7. Evidence-first answers (M2)

Each evidence item must cite `source_tool_call` (the tool call id) **and** `source_field` (a path in that tool's output, e.g. `attendance_rate_percent` or `subjects[0].average_percent`). Prompt version 2 requires both.

- **Field check.** An item is verified only if its value, normalised ("R 1 150,20", "1,480", "78%"), **equals the value at that exact field**. A number that appears elsewhere in the output does not count: "attendance rate 1%" citing `attendance_rate_percent` when that field holds 20 is rejected, even though `late: 1` exists.
- **Rejection reasons:** `unknown_tool_call`, `invalid_field`, `unknown_field`, `value_mismatch`.
- **Unsupported figures in the answer text.** Every number in the text must be a verified evidence value or a number the user wrote. Dates, years, ordinals and labels such as "Grade 10" and "Term 3" are ignored. Any other number causes the text to be **withheld**: the user sees a notice and the list of unchecked figures, and the request records `answer_withheld`.
- **Confidence:**
  - "high" needs at least one verified figure and nothing rejected or unsupported;
  - lookups that returned data with nothing verified give "low";
  - with no data looked up, at most "medium".

This checks numbers, not wording. A sentence can still misdescribe a verified figure, and numbers written as words ("five") are not detected.

## 8. Follow-up questions (M3)

The message and the history have separate allowances: `max_input_chars` (4,000) for the message and `max_history_chars` (12,000) for the history.

The UI sends at most three prior question/answer pairs, each trimmed to 1,500 characters (at most 9,000 in total), and never replays withheld answers or notices. A follow-up after a long answer is accepted; oversized history is refused with 413 `input_too_large`.

## 9. Observability

One JSON log line per request (`funda_ai.request`): ids, feature, role, status, error code, model, prompt version, tokens, `usage_unknown`, duration and safety flags. Also `funda_ai.blocked`, `funda_ai.start_failed`, `funda_ai.route_fallback`, `funda_ai.audit_write_failed` and `funda_ai.config_error`.

Logs never contain question text, answers or data (tested). Usage per school and day: `ai_usage_summary`.

## 10. Architected, not operational

- **RAG / embeddings:** interface only. pgvector is not installed (available on the hosted project). Needs its own review of document permissions, ingestion, retention and retrieval isolation.
- **Stored conversations:** the schema, RPCs and retention exist; `store_content` is off.
- **Human approval:** `requires_human_approval` only labels answers; there is no approval workflow (there are no actions to approve).
- **Admin UI:** changes go through the audited RPCs; there is no screen yet.
- **Streaming:** not implemented.

## 11. Enabling it (after merge, after section 12)

1. Merge so CI applies both migrations, deploys `funda-ai` with JWT verification on, and pg_cron registers the two jobs.
2. Set `ANTHROPIC_API_KEY` as an Edge Function secret. Check the key without learner data.
3. A platform administrator with an aal2 session:
   - sets the pilot roles and budgets with `ai_admin_update_feature('copilot', …)`, then `{"enabled": true}`;
   - then, per pilot school: `ai_admin_set_school(<school>, true, array['copilot'], <budget>)`.

## 12. Open decisions (human)

- POPIA: lawful basis, the operator agreement and cross-border transfer to the model provider, and retention periods.
- The teacher-scope policy (section 1).
- Backups (the project is on the Free plan).
- MFA enrolment for the administrators who will configure Funda AI.
- An answer-quality evaluation on synthetic data before any real school.

## 13. Tests

| Suite                                                         | Checks (2026-10-09)                                                                                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/rls-tests/tests/zzzz_funda_ai.test.sql`             | 65: gate reasons, limits, budget, grants, per-tool RLS for cross-school / parent / learner / safeguarding, audit privileges              |
| `supabase/rls-tests/tests/zzzzz_funda_ai_hardening.test.sql`  | 40: locks taken, reservation and settlement, single-use start, budget including in-flight requests, sweep, retention, admin keep-existing, throttling |
| `supabase/functions/_shared/ai/ai.test.ts` (Deno)             | 50: schema, safety (all turns, redaction, medical), routing, prompts, tools, gateway loop, deadline, field-level evidence, confidence       |
| `supabase/stack-tests/funda-ai.mjs` (real GoTrue + PostgREST + Edge Function code, mock model API) | 68: the isolation checks plus 50-request races (rate limit and budget), history disclosures, redaction, medical, follow-ups, wrong-field evidence, deadline, killed function + sweep |
| `src/features/ai/utils/aiResponse.test.ts` (vitest)           | 9                                                                                                                                         |
| `e2e/funda-ai.spec.ts` (Playwright)                           | 7, including withheld answers, the policy notice and 320px + axe                                                                          |
