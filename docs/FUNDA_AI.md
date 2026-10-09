# Funda AI

Status (2026-10-09): code complete on branch `claude/funda360-audit-0foiq8` (PR #9, **open, not merged**). Hardened against two reviews on 2026-10-09 and tested locally and on a real local Supabase stack.

- **Not deployed and not verified in production.** Production has no AI tables and no `funda-ai` function, and no model provider key is configured.
- Every feature is off by default.
- No real model has been called, so answer quality is unmeasured.

Release gates: `docs/FUNDA_AI_PILOT_READINESS.md`. Evaluation: `docs/FUNDA_AI_EVALUATION.md`. This document describes only what exists in the code.

## 1. What a user can do

Staff with an enabled role at a school with Funda AI enabled see a **Funda AI** button in the dashboard header. Read-only lookups:

| Tool                             | Reads                                                                     | Roles (tool level)                                                 | RLS that decides the rows    |
| -------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------- |
| `find_learners`                  | `learners` (name, learner number, status only)                            | school_owner, principal, vice_principal, department_head, teachers | `can_view_learners`          |
| `get_learner_attendance_summary` | `attendance_records`, rate = (present + late) / (present + late + absent) | school_owner, principal, teacher, class_teacher, subject_teacher   | `can_view_academic`          |
| `get_learner_assessment_summary` | `assessment_results` + active `assessments`, unweighted averages          | same as attendance                                                 | `can_view_academic`          |
| `get_learner_fee_summary`        | the four `learner_fee_*` ledgers, `active = true`, same formula as the UI | school_owner, principal, finance_manager                           | `can_view_learner_financial` |
| `get_reporting_summary`          | `get_government_report()` (own school for school leaders)                 | school_owner, principal                                            | `reporting_school_ids()`     |

There are **no write tools** and no safeguarding or medical lookups. Parents, learners, officials and platform administrators are not in the seeded feature's roles.

### Pilot scope: teachers (no permission changed)

Funda360's existing `can_view_academic` (`20260803150000_academic_structure.sql:250`) lets `teacher`, `class_teacher` and `subject_teacher` read attendance and results for **every learner in their school**. Funda AI does not widen this, but makes such lookups faster.

**Recommended pilot:** school_owner and principal only:

```
ai_admin_update_feature('copilot', '{"allowed_roles": ["school_owner", "principal"]}')
```

Add teachers only after class-scoped tools exist (filtered by `teaching_assignments` / `class_teacher_assignments`). Whether to narrow the teacher rule itself is a separate Funda360 permission decision.

## 2. Request lifecycle

```
browser (user JWT) ── supabase.functions.invoke('funda-ai')        JWT verified by the platform
  1. ai_authorize_request()      as the user. Per-user, then per-school advisory locks; flag, role, school
                                 feature list, message + history sizes, rate limits, budget pre-check.
                                 Returns only allowed / reason / request_id.
  2. ai_start_request()          service role, single use, within 2 minutes. Re-checks both budgets including
                                 requests in flight, reserves request_token_reservation, returns principal + policy.
  3. safety                      text normalised (NFKC, invisible characters removed).
                                 Safeguarding: every turn screened -> fixed guidance, no model call.
                                 Medical (user turns) -> notice, no model call.
                                 SA ID numbers redacted in every turn.
  4. prompt + route              code-only prompt school_copilot v3; model route from configuration.
  5. model <-> tool loop         one deadline (default 110 s) for all turns and retries; each turn's output
                                 capped by what is left of the reservation; at most 5 turns and 8 tool calls;
                                 at most 1 gateway retry for transient errors; tools run as the user (RLS).
  6. answer checks               JSON schema; evidence verified at the exact cited field; numbers in the answer,
                                 notes and claims checked (section 6).
  7. ai_complete_request()       service role. Settles actual tokens, or keeps the reservation when usage is
                                 unknown. Records outcome and flags; no content.
  pg_cron: ai_recover_stale_requests() every minute; ai_purge_expired() daily at 02:20 UTC.
```

## 3. Authentication and authorisation boundaries

**The gateway never reads data as itself.** Every lookup uses a supabase-js client carrying the caller's JWT, so RLS decides. The role comes from the JWT and the school from `current_tenant_id()` (active profile, MFA-aware), never from request fields.

| Caller                         | Can                                                                               | Cannot                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Signed-in user (`authenticated`) | `ai_authorize_request`, `ai_my_features`, `ai_submit_feedback` (own), read own AI rows | start, complete or record requests; read other users' rows; read policy |
| School leaders                 | read own school's AI settings; `ai_usage_summary` for own school                  | other schools                                                                |
| Platform admin, **aal2**       | `ai_admin_update_feature`, `ai_admin_set_school` (audited); read all AI rows and usage | anything at aal1 (no AI rows, policy or platform usage)                  |
| `service_role` (Edge Function) | `ai_start_request`, `ai_record_tool_call`, `ai_complete_request`, `ai_store_exchange`, `ai_recover_stale_requests`, `ai_purge_expired` | (the key never reaches the browser) |
| `anon`                         | nothing                                                                           |                                                                              |

Additional rules:

- All `ai_*` SECURITY DEFINER functions pin `search_path = public`. Internal helpers (`ai_lock`, `ai_month_start`) are not executable by users.
- RLS is forced on every AI table.
- Stored conversations (off by default) are owner-only; platform admins cannot read them.

## 4. Rate limits and budgets

- **Rate limits:** per user per minute and per day, and per school per day. They are counted from `ai_requests` under the per-user and per-school advisory locks. Measured on the real stack: 50 parallel requests against a limit of 2 admit exactly 2, through the gateway and through direct RPC calls.
- **Budgets (tokens per month):** none can be NULL or unlimited.
  - per school: `school_monthly_token_budget` (default 3,000,000) or the school's own override;
  - per user: `user_monthly_token_budget` (default 500,000).
  - Months follow **Africa/Johannesburg** (`ai_month_start()`).
- **Reservation:** each request reserves `request_token_reservation` tokens (default 120,000). A CHECK requires it to be at least `max_output_tokens`.
  - Both budgets are checked including in-flight reservations. Measured: 50 parallel requests against a budget that fits 5 run exactly 5.
  - Each model turn's output is capped by what is left of the reservation. The loop stops (`reservation_exhausted`) when less than min(1,024, max output) tokens are left.
  - **Actual usage can still exceed the reservation by at most one turn's input tokens**, because input size is only known after a call. The budget can be overshot by that amount per in-flight request.
- **Settlement:** completion charges actual tokens. When usage is unknown (deadline, abort, crash, or a failed attempt that may have been billed) the charge is at least the reservation, marked `usage_estimated`.
  - Requests never started (for example, direct RPC calls that never reached the gateway) are charged nothing.
  - The SDK does not retry. The gateway retries once and accounts for it.
- **Blocked attempts** are recorded up to 20 per user per minute.

## 5. Safeguarding and sensitive data

- **Normalisation:** all user-supplied text is NFKC-normalised with invisible format characters removed before screening, redaction and sending. Full-width digits, zero-width spaces and similar tricks do not pass the checks.
- **Safeguarding:**
  - Every turn is screened, including a copy with separators inside words removed ("sui-cidal").
  - A safeguarding signal in **any** turn, user or assistant (assistant turns come from the client), ends the request with fixed guidance: the school's designated safeguarding lead (DSL), SAPS 10111, Childline 116. **No model call** is made.
- **Medical:** blocked by default (`medical_content_policy`) on user turns, recorded as `policy_blocked`. The model's own replies ("I cannot diagnose") do not trigger it.
- **ID numbers:** 13-digit South African ID numbers in any format (spaces, hyphens, dots, no separator, full-width) are replaced with `[ID number removed]`. Passport numbers, phone numbers and e-mail addresses are **not** redacted.
- **Limits of pattern screening (measured):**
  - 18/18 core disclosures caught; 0/18 false alarms on ordinary school language.
  - **0/8 indirect disclosures caught** (`docs/FUNDA_AI_EVALUATION.md`).
  - It misses indirect wording, other languages and new phrasings. **It is not child protection.** People are: the pilot is restricted to school leaders, and staff are told to follow the school's safeguarding procedure.
- **What is stored:** `ai_requests` and logs hold no question or answer text. Stored conversations (off) would hold the redacted text.

## 6. Evidence and its limits

Each evidence item cites `source_tool_call` and `source_field`. It is verified only if its value equals the value at that exact field.

Every number shown to the user is checked against the verified figures. That covers the answer, limitations, follow-up questions, declined actions, evidence claims, and evidence periods (which may only describe time, e.g. "last 90 days").

| Figure                                                                         | Treatment                                                                     |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Digits, rand amounts, percentages, full-width digits                          | checked                                                                       |
| Written numbers ("twenty-five", "two hundred", "fifty percent")               | checked                                                                       |
| Dates, years in date context ("in 2026", "February 2026", "2025-2026"), labels ("Grade 10", "Term 3"), ordinals | ignored                       |
| Numbers inside names that exist in the tool data ("Test 1", learner numbers)   | ignored                                                                       |
| Bare numbers such as "2050" or "1987 learners"                                 | checked                                                                       |
| Numbers that only repeat the user's question                                   | shown, listed as unchecked, confidence "low"                                  |
| Any other unchecked number in the answer                                       | answer **withheld**                                                           |
| Any other unchecked number in a note                                           | that note is removed                                                          |
| Any other unchecked number in a claim or period                                | that evidence is rejected                                                     |

- **Confidence:** "high" requires at least one verified figure and nothing rejected, unsupported or user-only.
- **Not checked:** the meaning of sentences (a verified figure can be described wrongly), "one", fractions and vague quantities ("half", "most").
- **Rounding:** rounded figures ("87%" for 86.7) are treated as unsupported, which withholds otherwise-correct answers. The prompt tells the model to copy figures exactly.

## 7. Timeouts, accounting and recovery

- **Request deadline:** `FUNDA_AI_DEADLINE_MS`, default 110,000, clamped to 5,000-140,000. Hosted functions stop at 150 s on the Free plan.
  - The deadline's abort signal stops the provider call.
  - No new turn starts with less than 3 s left.
  - A timeout returns 504 `ai_timeout`, settled with usage unknown.
- **Recovery sweep:** `ai_recover_stale_requests()` runs every minute.
  - A request started more than 5 minutes ago that never reported back becomes `failed` / `stale_request`, with its reservation charged and `usage_estimated`.
  - A request authorised more than 2 minutes ago and never started becomes `failed` / `never_started`, with nothing charged.
  - Late completions cannot reopen a swept request.
  - Registration is idempotent (`cron.schedule` by name; verified by re-running it).

## 8. Retention and scheduling

`ai_purge_expired()` runs daily at 02:20 UTC (`funda-ai-retention`). It deletes:

- expired conversations;
- feedback older than `feedback_retention_days` (default 180);
- request rows older than `audit_retention_days` (default 365) with their tool calls and feedback.

It never deletes rows from the current budget month, or open requests.

Both jobs run as the cron owner and need no JWT. Production has pg_cron 1.6.4 (read-only check, 2026-10-09). Retention periods are defaults awaiting a POPIA decision.

## 9. Configuration and secrets

| Variable                                                         | Required  | Meaning                                                                                                   |
| ---------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                                              | to answer | Edge Function secret. Without it every request returns **503 `ai_provider_not_configured`**; no fake answers. |
| `FUNDA_AI_MODEL_ROUTES`                                          | no        | JSON routes per tier (default `claude-opus-5-5`; effort low, medium or high; refusal fallback on)           |
| `FUNDA_AI_PRICING`                                               | no        | prices per model for cost estimates; none built in                                                        |
| `FUNDA_AI_DEADLINE_MS`                                           | no        | request deadline (above)                                                                                  |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | yes       | provided by the platform                                                                                  |

- Never set `ANTHROPIC_BASE_URL` in production.
- **Server-side refusal fallback** is enabled: a refused request may be re-run by Anthropic on its recommended fallback model. `ai_requests.model` records which model answered. Whether a refused-then-retried request is billed twice is not visible to the gateway.

## 10. Safe testing

- Use the local stacks only:
  - RLS suite: `supabase/rls-tests/run.sh`;
  - real stack: `supabase/stack-tests/funda-ai.mjs`, with a **mock** model API via `ANTHROPIC_BASE_URL` and the synthetic fixtures.
- Never point a test at production, never use real learner data, never commit keys.
- Real-model evaluation is opt-in and guarded (`docs/FUNDA_AI_EVALUATION.md`).

## 11. Monitoring and incident escalation

**Watch:**

- `funda_ai.request` log lines: status, error code, `usage_unknown`, safety flags;
- `ai_usage_summary`, daily: charged tokens, estimated-usage requests, policy and safety blocks;
- `ai_feedback` rows rated "problem";
- `ai_requests` stuck in `authorized` (should be zero after 5 minutes).

**Kill switches, immediate:**

- `ai_admin_update_feature('copilot', '{"enabled": false}')`;
- per school: `ai_admin_set_school(<school>, false)`;
- remove `ANTHROPIC_API_KEY` to force 503.

**Escalation:**

- a suspected data exposure goes to the platform owner, who switches the feature off and follows the POPIA breach procedure;
- a safeguarding concern raised through Funda AI goes to the school's DSL; Funda AI never handles it;
- a wrong or harmful answer is collected from feedback and reviewed before re-enabling.

## 12. Architected, not operational

Not yet built:

- RAG / embeddings (pgvector not installed; needs its own review);
- stored conversations (off);
- a human-approval workflow (label only);
- an admin screen;
- streaming responses;
- class-scoped teacher tools;
- server-side conversation history (the client still sends history).

## 13. Tests

The latest run is recorded in `CLAUDE.md` ("Last green run") and in the PR description.

| Suite                                                                                     | Covers                                                                                                     |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `supabase/rls-tests/tests/zzzz_funda_ai.test.sql`, `zzzzz_funda_ai_hardening.test.sql`     | gate, limits, reservations, sweep, retention, admin, aal2 reads, per-tool RLS isolation                    |
| `supabase/functions/_shared/ai/ai.test.ts`, `eval/eval.test.ts` (Deno)                    | safety, normalisation, evidence, confidence, deadline, retries, reservation caps; deterministic evaluation |
| `supabase/stack-tests/funda-ai.mjs` (real GoTrue + PostgREST + function code, mock model) | isolation, 50-request races, history disclosures, redaction, medical, deadline, killed function + sweep    |
| `src/features/ai/utils/aiResponse.test.ts`, `e2e/funda-ai.spec.ts`                        | UI parsing, history trimming, rendering, 320px + axe                                                       |
