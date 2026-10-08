# Funda AI — Phase 1 foundation

Status (2026-10-08): code complete on branch `claude/funda360-audit-0foiq8`, tested locally and against a real local Supabase stack. **Not deployed.** Production has no AI tables, the `funda-ai` function is not deployed, and no model provider key is configured. Every feature is off by default.

This document describes only what exists in the code. Section 9 lists what is designed for but not built.

## 1. What a user can do

Staff with an enabled role at a school with Funda AI enabled see a **Funda AI** button in the dashboard header. They ask a question about data they can already see. Funda AI may look up:

| Tool                             | Reads                                                                       | Roles (tool level)                                                     | RLS that decides the rows      |
| -------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| `find_learners`                  | `learners` (name, learner number, status only)                              | school_owner, principal, vice_principal, department_head, teachers     | `can_view_learners`            |
| `get_learner_attendance_summary` | `attendance_records`, rate = (present + late) / (present + late + absent)   | school_owner, principal, teacher, class_teacher, subject_teacher       | `can_view_academic`            |
| `get_learner_assessment_summary` | `assessment_results` + active `assessments`, unweighted averages            | same as attendance                                                     | `can_view_academic`            |
| `get_learner_fee_summary`        | the four `learner_fee_*` ledgers, `active = true`, same formula as the UI   | school_owner, principal, finance_manager                               | `can_view_learner_financial`   |
| `get_reporting_summary`          | `get_government_report()` (own school for school leaders)                   | school_owner, principal                                                | `reporting_school_ids()`       |

The answer shows: the text, **evidence** (each figure, its period and whether it was found in the output of the lookup it cites), **limitations**, **confidence**, actions that need a person, which lookups ran or were refused, and **Helpful / Not helpful / Report a problem** feedback.

Funda AI has **no write tools**. It cannot change marks, fees, admissions, discipline, safeguarding or government submissions. The prompt tells it to list such requests under "declined actions".

There is no safeguarding tool. Messages that suggest a child may be at risk (self-harm, abuse, violence) are **never sent to the model**. The user gets fixed guidance: the school's designated safeguarding lead, SAPS 10111 and Childline 116.

Parents, learners, education officials and platform administrators are not in the seeded feature's roles, and no tool lists a family role. Phase 1 is for school staff only.

## 2. Architecture

```
browser (user JWT)
  └─ supabase.functions.invoke('funda-ai')   JWT verified by the platform
       └─ handleFundaAi()                    supabase/functions/_shared/ai/gateway.ts
            1. ai_authorize_request()        as the user: flag, role, school, size, rate, budget -> ai_requests row
            2. safety screen                 safeguarding -> fixed guidance, no model call
            3. prompt registry + routing     code-only prompt, model chosen from config
            4. model <-> tool loop           ≤5 model turns, ≤8 tool calls; tools run as the user via PostgREST (RLS)
            5. output validation             JSON schema; evidence checked against the cited tool output
            6. ai_complete_request()         service role: tokens, model, prompt version, flags, outcome (no content)
```

**Authority stays in the database.** The gateway never holds a database credential for user data. The policy decision and every data read use a supabase-js client that carries the caller's JWT, so the existing RLS and SECURITY DEFINER checks apply exactly as on the user's own screens. The service-role key is used only for three audit RPCs (`ai_record_tool_call`, `ai_complete_request`, `ai_store_exchange`), which are executable by `service_role` alone.

Inheritance: **user** (JWT, active profile) → **school** (`current_tenant_id()`, school enabled) → **role** (feature roles, tool roles) → **permission** (the RLS helper per table) → **data** (rows RLS returns).

## 3. Files

| Path                                                     | Purpose                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `supabase/migrations/20261011090000_funda_ai_foundation.sql` | Tables, policies, policy gate, usage/audit RPCs, admin RPCs, `copilot` seed (disabled) |
| `supabase/functions/funda-ai/index.ts`                   | Edge Function wiring (env, clients)                                                  |
| `supabase/functions/_shared/ai/gateway.ts`               | Request handling, loop, evidence check, audit                                        |
| `…/ai/provider.ts`, `…/ai/anthropic.ts`                  | Provider-neutral interface; Claude adapter (official SDK `@anthropic-ai/sdk@0.128.0`) |
| `…/ai/routing.ts`                                        | Tier → model routes, optional pricing                                                |
| `…/ai/prompts.ts`                                        | Versioned prompt registry and output schema                                          |
| `…/ai/safety.ts`                                         | Screening, untrusted-data wrapper, safeguarding guidance                             |
| `…/ai/tools.ts`, `…/ai/data.ts`                          | Tool registry and the read-only, user-scoped data interface                          |
| `…/ai/schema.ts`                                         | Dependency-free JSON-schema validator                                                |
| `src/features/ai/`                                       | Launcher, panel, answer card, service, response parser                               |

## 4. Database

Tables (RLS forced, `revoke all` from anon/authenticated, then narrow `select` grants):

- `ai_features`: per-feature flag and policy (roles, tools, prompt id, model tier, input size, output tokens, per-user per-minute/day and per-school per-day limits, monthly token budget, content storage and retention, audit retention, human-approval flag). Platform admins read it.
- `ai_school_settings`: per-school switch, optional feature subset and token budget. School leaders read their own school's row.
- `ai_requests`: one row per request (allowed or blocked) with user, school, role, feature, status, block reason, model, prompt id and version, tokens, estimated cost, tool-call count, safety flags, error code and duration. **No prompt or answer text.** Users read their own; platform admins read all.
- `ai_tool_calls`: tool name, status (ok, empty, denied, invalid_input, invalid_output, error), duration, row count and error code. No inputs or outputs.
- `ai_conversations` / `ai_messages`: written only when a feature has `store_content = true` (default **false**). Only the owner can read them; platform admins cannot. They expire after `content_retention_days`.
- `ai_feedback`: rating and an optional comment (at most 1,000 characters) on one's own request.

Functions:

- `ai_authorize_request(feature, input_chars, client_request_id)`, run as the user. Reasons, in order: `not_authenticated`, `profile_inactive`, `feature_disabled`, `role_not_allowed`, `school_context_required`, `school_not_enabled`, `input_too_large`, `rate_limited`, `budget_exhausted`. Rate limits and budgets are counted from `ai_requests`, so they hold across function instances.
- `ai_my_features()`: what the launcher may show.
- `ai_submit_feedback`: own requests only.
- `ai_usage_summary(from, to, school)`: platform admin, or school leaders for their own school.
- `ai_admin_update_feature`, `ai_admin_set_school`: platform admin with an **aal2** session; allowlisted fields; written to `audit_log`.
- Service role only: `ai_record_tool_call`, `ai_complete_request` (only updates rows still `authorized`), `ai_store_exchange` (no-op unless `store_content`; checks conversation ownership), `ai_purge_expired` (retention; not yet scheduled).

## 5. Model provider

One real adapter: Claude through the official Anthropic TypeScript SDK.

- The default route for every tier is `claude-opus-5-5`, with `output_config.effort` low, medium or high per tier and `thinking` left at the model default.
- Structured final answers use `output_config.format` (JSON schema). The schema is validated again locally.
- **Server-side refusal fallback is enabled** on the default routes (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). A request the primary model refuses may be re-run by the API on Anthropic's recommended fallback model. `ai_requests.model` records the model that actually answered. Set `refusalFallback: false` in `FUNDA_AI_MODEL_ROUTES` to turn it off.
- The SDK handles retries (twice) and per-route timeouts. Errors map to `ai_timeout` (504), `ai_busy` / `ai_unavailable` / `ai_provider_misconfigured` (503) or `ai_request_rejected` (502). A retryable failure on the first turn falls back to the next configured route.
- Prompt caching marks the system prompt as cacheable.

Configuration (Edge Function secrets):

| Variable                    | Required        | Meaning                                                                                           |
| --------------------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`         | to answer       | Without it every request returns **503 `ai_provider_not_configured`** (recorded as failed). No fake answers. |
| `FUNDA_AI_MODEL_ROUTES`     | no              | JSON `{ "simple"/"standard"/"complex": [route, …fallbacks] }`; invalid JSON keeps the defaults and logs `funda_ai.config_error` |
| `FUNDA_AI_PRICING`          | no              | JSON `{ "<model>": { "inputPerMillion": n, "outputPerMillion": n } }` in micro-units; no prices are built in, so cost is null until set |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | yes | Provided by the platform                                                                  |

Anthropic has no embeddings API. `embed()` throws `not_supported` (see section 9).

## 6. Prompt-injection defence

- **SYSTEM** is the versioned prompt from code (`school_copilot` v1). Only four declared variables (role, school context, date, tool names) are substituted. They are server values, flattened to one line and capped at 300 characters.
- **POLICY** is enforced outside the model: feature, role and tool allowlists, limits and RLS. Nothing the model says changes them.
- **USER** text is always a user turn and never part of the system prompt. History is at most three prior question/answer pairs, each capped at 4,000 characters, and must alternate.
- **TOOL OUTPUT** is JSON-encoded inside `{ trust: "untrusted_data", data: … }`, so text in school data (an assessment title, for example) cannot close the wrapper. Injection-looking text in tool data adds the `injection_in_tool_data` flag.
- Input patterns flag `prompt_injection_suspected`, `data_exfiltration_suspected`, `restricted_action_requested`, `personal_identifier_in_input` (13-digit IDs) and `medical_topic` for audit. The flags do not change access: a jailbroken model still only gets what RLS returns to this user.

## 7. Evidence-first answers

The model must cite each figure with the `tool_call_id` of the lookup it came from. The gateway normalises the value ("R 1 150,20", "1,480", "78%") and checks that it appears among the figures in that lookup's output. If any figure fails the check, it is shown as **Not verified**, a limitation is added and confidence is forced to **low**. This catches invented or misattributed figures in the evidence list. It cannot prove that every number in the prose answer is cited.

## 8. Observability

The function logs one JSON line per request (`funda_ai.request`): request id, feature, role, status, error code, provider, model, prompt version, tokens, duration and safety flags. It also logs `funda_ai.blocked`, `funda_ai.route_fallback`, `funda_ai.audit_write_failed` and `funda_ai.config_error`. Logs never contain question text, answers or data (tested). Usage per school and day: `ai_usage_summary`.

## 9. Architected, not operational

- **RAG / embeddings.** The `AiProvider.embed()` interface exists. No retrieval is implemented, and pgvector is **not** installed (available on the hosted project as `vector` 0.8.2, checked read-only 2026-10-08). Any retrieval must run the authorisation (RLS) query first and embed only rows the user may read.
- **Stored conversations.** The schema, RPCs and retention exist; `store_content` is off for the seeded feature and the UI keeps history in memory only.
- **Human approval.** `requires_human_approval` labels answers "Draft: needs review by a person" and is recorded. No approval workflow exists because there are no actions to approve.
- **Retention job.** `ai_purge_expired()` exists but is not scheduled.
- **Admin UI.** Features and school settings are changed through the audited RPCs; there is no screen yet.
- **Streaming** responses are not implemented.

## 10. Enabling it (after merge)

1. Merge so CI applies the migration and deploys `funda-ai` (JWT verification on).
2. Set `ANTHROPIC_API_KEY` as an Edge Function secret (Supabase dashboard). Optionally set `FUNDA_AI_PRICING`.
3. A platform administrator with an aal2 session: `ai_admin_update_feature('copilot', '{"enabled": true}')`, then `ai_admin_set_school(<school>, true)` per pilot school.
4. Decide on retention (`audit_retention_days`, and `store_content` only if POPIA review approves it) and the monthly token budget.

## 11. Tests

| Suite                                                      | Checks                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `supabase/rls-tests/tests/zzzz_funda_ai.test.sql`          | 62: policy gate reasons, limits, budget, grants, cross-school / parent / learner / safeguarding RLS for each tool's queries, audit RPC privileges |
| `supabase/functions/_shared/ai/ai.test.ts` (Deno)          | 31: schema, safety, routing, prompts, each tool's arithmetic and denials, gateway loop, limits, errors, evidence, no content in logs |
| `supabase/stack-tests/funda-ai.mjs` (real GoTrue + PostgREST + Edge Function code, mock model API) | 50: cross-school learner/attendance/assessment/fee lookups, government data, parent/learner/staff-safeguarding isolation, adapter request shape, audit without content, rate limit |
| `src/features/ai/utils/aiResponse.test.ts` (vitest)        | 6: response parsing, history minimisation, messages                                                            |
| `e2e/funda-ai.spec.ts` (Playwright)                        | 5: hidden when off, ask/evidence/feedback/report, safeguarding notice, error messages, 320px + axe              |

The model's answer quality has **not** been evaluated: no real model was called. Build an evaluation set from pilot questions before wider rollout.
