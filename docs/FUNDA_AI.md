# Funda AI

Status (2026-10-09): code complete on branch `claude/funda360-audit-0foiq8` (PR #9, **open, not merged**). It was hardened against three reviews on 2026-10-09, the last being the staging remediation (`20261009096000`), and tested locally and on a real local Supabase stack. No staging environment exists yet (`docs/STAGING.md`).

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
| School leaders                 | read own school's AI settings; `ai_usage_summary` for own school                  | other schools (a platform admin is never treated as a school leader here)    |
| Platform admin, **aal2**       | `ai_admin_update_feature`, `ai_admin_set_school` (audited); read all AI rows, usage and AI audit history | anything at aal1 (no AI rows, policy, platform usage or `ai_%` audit rows) |
| `service_role` (Edge Function) | `ai_start_request`, `ai_record_tool_call`, `ai_complete_request`, `ai_store_exchange`, `ai_recover_stale_requests`, `ai_purge_expired` | (the key never reaches the browser) |
| `anon`                         | nothing                                                                           |                                                                              |

Additional rules:

- All `ai_*` SECURITY DEFINER functions pin `search_path = public`. Internal helpers (`ai_lock`, `ai_month_start`) are not executable by users.
- RLS is forced on every AI table.
- Stored conversations (off by default) are owner-only; platform admins cannot read them.

## 4. Rate limits and budgets

- **Rate limits:** per user per minute and per day, and per school per day. They are counted from `ai_requests` under the per-user and per-school advisory locks. Measured on the real stack: 50 parallel requests against a limit of 2 admit exactly 2, through the gateway and through direct RPC calls.
  - **Pending cap** (`20261009096000`): at most 2 authorised-but-unstarted requests per user (`too_many_pending`).
  - Requests that never reached the gateway (`never_started`) do not count towards the **school's** daily quota. So a few users calling the policy RPC directly cannot use up AI for the whole school; they still count towards the caller's own limits.
- **Budgets (tokens per month):** none can be NULL or unlimited.
  - per school: `school_monthly_token_budget` (default 3,000,000) or the school's own override;
  - per user: `user_monthly_token_budget` (default 500,000).
  - Months follow **Africa/Johannesburg** (`ai_month_start()`).
- **Reservation:** each request reserves `request_token_reservation` tokens (default 120,000). A CHECK requires it to be at least `max_output_tokens`. Both budgets are checked including in-flight reservations. Measured: 50 parallel requests against a budget that fits 5 start exactly 5.
- **Inside a request:** before each model call the gateway **estimates that call's input** (prompt, tool schemas, output schema and conversation at 2 characters per token, and never less than the previous call's reported input plus output plus what was added since). It counts that estimate against the reservation and caps the call's output by what is left. The loop stops with `reservation_exhausted` when less than min(1,024, max output) tokens would be left. A reservation smaller than the prompt is refused before any model call.
- **Settlement** (`ai_complete_request`): only a **started** request can be settled, so its reservation was taken. The charge is the reported tokens **plus** `p_unseen_tokens`: the gateway's estimate (estimated input plus maximum output) for each failed attempt that may have been billed without reporting usage, such as a timeout or provider error before a retry. When the final call's usage is unknown, the charge is at least the reservation. Estimated charges are marked `usage_estimated`.
- **Refusal fallback:** with the provider's server-side fallback, top-level `usage` covers only the attempt that answered. The adapter sums `usage.iterations` (every attempt, the refused one included) when present.
- **How far a request can exceed its reservation** (not a hard ceiling):
  - Only through estimation error. 2 characters per token over-estimates English (about 4) and JSON. Text that tokenises below 2 characters per token is under-estimated: some non-Latin scripts, unusual Unicode, identifier-heavy tool results.
  - Plausible worst case for one request: the first call's user text (at most 16,000 characters: message plus history) under-estimated by about half, so about 8,000 tokens. Then roughly a sixth of the tool-result characters added later (at most 8 tool calls).
  - In total about 10-15% of a 120,000-token reservation, so **about 135,000 tokens charged at most**, plus unseen attempts, which are charged as estimates.
  - Across requests, the budget can be overshot by at most that per-request error times the number in flight. In-flight requests are limited per user by the pending cap and the per-minute limit, and per school by the daily limit.
- **Blocked attempts** are recorded up to 20 per user per minute.

## 5. Safeguarding and sensitive data

- **Normalisation:** all user-supplied text is NFKC-normalised with invisible format characters removed before screening, redaction and sending.
- **Screening views** (`safety.ts`, all derived from the same text; a match in any of them counts):
  - lower case, with look-alike Cyrillic and Greek letters folded, accents removed and whitespace (including line breaks) collapsed;
  - leetspeak undone inside words ("su1c1de", "r@ped");
  - spaced-out and punctuated letters joined ("s u i c i d e", "S.U.I.C.I.D.E");
  - a letters-only copy for a short list of unambiguous fragments.
- **Cross-turn:** the user turns are also screened **joined together**, so a disclosure split across messages ("he says he wants to" / "die") is caught. Assistant turns are screened for safeguarding only.
- **Coverage:** English direct disclosures (self-harm, sexual and physical abuse, neglect, grooming and exploitation, threats and weapons). There is a first set for Afrikaans, isiZulu, isiXhosa, Sesotho, Setswana, Sepedi, Xitsonga and Tshivenda; **these lines have not been reviewed by native speakers.**
- A safeguarding signal in any turn ends the request with fixed guidance: the school's designated safeguarding lead (DSL), SAPS 10111, Childline 116. **No model call** is made.
- **Measured, independently** (`docs/FUNDA_AI_EVALUATION.md` section 2). Two blind corpora were written by a separate agent that never saw the patterns. Each was run once before any change made in response:

  | First run on unseen text     | Blind corpus 1 | Blind corpus 2 |
  | ---------------------------- | -------------- | -------------- |
  | Direct disclosures caught    | 28/40          | 21/45          |
  | Adversarial variants caught  | 22/25          | 18/25          |
  | Multilingual caught          | 12/25          | 16/30          |
  | Split across turns caught    | 6/10           | 8/12           |
  | Indirect caught              | 2/15           | 1/15           |
  | Benign false positives       | 0/50           | 1/60           |

  On unseen phrasing, **about half of direct disclosures and most indirect ones were missed.** The patterns were extended after each run (both corpora now pass in CI as regression sets), but that does not make the next unseen phrasing safe.
- **Conclusion: pattern screening is a backstop, not abuse detection.** Child protection rests on people:
  - the pilot is limited to school leaders;
  - each pilot school has a designated safeguarding lead;
  - staff are told Funda AI is not a reporting channel.

  A model-based classifier is a separate, unapproved proposal (section 12).
- **Educational content** (Life Orientation lessons, literature) about suicide or abuse can be blocked: the conservative failure.
- **Medical:** blocked by default (`medical_content_policy`) on user turns, recorded as `policy_blocked`. The model's own replies ("I cannot diagnose") do not trigger it.
- **ID numbers:** 13-digit South African ID numbers in any format (spaces, hyphens, dots, no separator, full-width) are replaced with `[ID number removed]`. Passport numbers, phone numbers and e-mail addresses are **not** redacted.
- **What is stored:** `ai_requests` and logs hold no question or answer text. Stored conversations (off) would hold the redacted text.

## 6. Evidence and its limits

This is **number checking, not fact-checking** (header of `evidence.ts`).

Each evidence item cites `source_tool_call` and `source_field`. It is verified only if its value equals the value at that exact field, and its claim names what the field measures. A rejected item's claim and value are **not shown or stored**.

Numbers in the answer, limitations, follow-up questions, declined actions, evidence claims and evidence periods:

| Kind                                                                                | Rule                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Figures: digits in any script, rand amounts, percentages, ordinals, number words ("forty-two", "a hundred", "a dozen", "half") | Must equal a verified evidence value **and** be bound to it: the sentence names the field's metric, the list row it came from (e.g. the subject), no other learner, and no period outside the cited output's period |
| References: dates, "Month YYYY", years in context, "Grade 10", "Term 2"             | Must appear in the retrieved data (a date or period in a tool output, a label in a returned name) or in the user's question. "17 may fail" and "grade 45%" are figures, not references              |
| Names in "X was/is/has/scored..." not found in the data or the question             | Treated as unsupported (a statement about someone Funda AI did not look up)                                                                                                                          |
| Numbers inside names that exist in the tool data ("Test 1", learner numbers)        | Ignored                                                                                                                                                                                              |
| Numbers that only repeat the user's question                                        | Shown, listed as unchecked, confidence "low" (also in notes). Never accepted inside an evidence claim                                                                                               |
| Anything else unsupported                                                           | Answer **withheld**; a note is removed; an evidence item is rejected                                                                                                                                  |

- **Confidence:** "high" requires at least one verified figure and nothing rejected, unsupported, user-only or dropped. Predictions and judgements ("will likely fail", "at risk") cap it at "medium".
- **Fail-safe by design:**
  - rounding ("87%" for 86.7), converting (0.85 → 85%) and summing figures withhold the answer;
  - so do dates the tool did not return.
  - Prompt v4 tells the model to copy figures and dates exactly, and to name the metric, row and learner beside each figure.
- **Not checked:**
  - non-numeric statements without a name pattern ("is struggling");
  - wording and reasoning;
  - Roman numerals, "twice", "most", "a few".
- **Tests:** `eval/evidence_adversarial.test.ts` (14 cases through the real gateway: wrong meaning, wrong row, wrong learner, wrong period, conflicting periods, ranges, rounding, scripts and words, smuggled labels and ordinals, unknown people, borrowed user figures, wrong tool or field).

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
- server-side conversation history (the client still sends history);
- a **model-based safeguarding classifier**. This is a proposal only, and it needs:
  - its own privacy review (it would send text to a provider);
  - an evaluation against an independent corpus written by a designated safeguarding lead (DSL) and native speakers, with false-negative and false-positive rates reported separately;
  - human review of every escalation.

  Until it exists, safeguarding relies on people (section 5).

## 13. Tests

The latest run is recorded in `CLAUDE.md` ("Last green run") and in the PR description.

| Suite                                                                                     | Covers                                                                                                     |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `supabase/rls-tests/tests/zzzz_funda_ai.test.sql`, `zzzzz_funda_ai_hardening.test.sql`, `zzzzzz_funda_ai_remediation.test.sql` | gate, limits, pending cap, school quota, reservations, settlement of started requests only, unseen-token charges, sweep, retention, admin, aal2 reads (AI tables, settings, audit history), per-tool RLS isolation |
| `supabase/functions/_shared/ai/ai.test.ts`, `eval/eval.test.ts`, `eval/evidence_adversarial.test.ts` (Deno) | safety, normalisation, evidence, confidence, deadline, retries, input estimate and reservation, iteration usage; safeguarding corpus thresholds and blind regression floors; adversarial evidence through the gateway |
| `supabase/stack-tests/funda-ai.mjs` (real GoTrue + PostgREST + function code, mock model) | isolation, 50-request races, history disclosures, redaction, medical, deadline, killed function + sweep    |
| `src/features/ai/utils/aiResponse.test.ts`, `e2e/funda-ai.spec.ts`                        | UI parsing, history trimming, rendering, 320px + axe                                                       |
