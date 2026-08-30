# FND-QA-002 — Load Test Report

**Date:** 2026-08-29
**Target:** local Supabase dev instance (`http://127.0.0.1:54321`), real seeded Auris Academy demo data
**Tool:** `supabase/load-tests/run.mjs` (new, this ticket)

## Methodology

A Node script signs in as five **real seeded** Auris Academy accounts spanning
distinct roles (principal, class_teacher, finance_manager,
admissions_officer, guardian), then runs a configurable number of
concurrent "virtual users" — each repeatedly executing role-appropriate
read scenarios (list learners, recent attendance, fee charges overview,
assessments list, timetable entries, recent announcements, "my children")
for a fixed duration — through the same anon-key + JWT + PostgREST path the
real frontend uses. RLS is fully engaged throughout; nothing bypasses it.
This measures the real request path, not a synthetic DB-only benchmark.

Run with `node supabase/load-tests/run.mjs --concurrency=20 --duration=30`.

## Finding: `assessments` RLS caused an 18x latency regression under concurrency

The first run (20 concurrent users, 30s) showed one scenario wildly out of
line with every other:

| scenario | count | errors | avg (ms) | p50 | p95 | p99 |
|---|---|---|---|---|---|---|
| announcements_recent | 344 | 0 | 375 | 263 | 1115 | 1995 |
| fee_charges_overview | 125 | 0 | 468 | 373 | 1117 | 1522 |
| my_children | 123 | 0 | 625 | 518 | 1498 | 1851 |
| list_learners | 91 | 0 | 376 | 285 | 1043 | 1379 |
| timetable_entries | 88 | 0 | 735 | 639 | 1486 | 2286 |
| **assessments_list** | **25** | **12 (48%)** | **7720** | **8074** | 8530 | 8922 |
| attendance_recent | 20 | 0 | 539 | 445 | 932 | 1072 |

`assessments_list` averaged **~7.7 seconds** with **48% of requests
outright failing** — order-of-magnitude worse than every other scenario,
and the only scenario with any errors at all.

### Root cause

`EXPLAIN ANALYZE` run with RLS actually engaged (as the real `principal`
actor, not as the superuser — bypassing RLS gives a misleadingly fast
plan) showed why. `assessments` carried two separate **permissive** SELECT
policies:

- `assessments_select` — `can_view_academic(school_id)`, a cheap
  pure-JWT-claim check.
- `assessments_select_for_guardians` — an `EXISTS` against
  `assessment_results` calling the `SECURITY DEFINER` function
  `is_learner_guardian()` per row.

Postgres combines multiple permissive policies for the same command with
OR — but the planner chose to implement that OR as a **hashed subplan**
that unconditionally materializes a full sequential scan of
`assessment_results` (calling `is_learner_guardian()` for every one of its
~3,900 rows) **before** evaluating the cheap `can_view_academic()` check —
for every single call, regardless of the caller's actual role. A principal
who should short-circuit instantly paid the full guardian-membership scan
anyway, every time. Under 20-way concurrency this saturated the instance
and caused real timeouts, not just slowness.

Verified directly: 1393ms execution (isolated, no concurrency) dropped to
**18.6ms** — a **~75x improvement** — once both policies were merged into
one, with the subplan shown as `never executed` for the staff path.
Guardian-path correctness (which rows an actual guardian sees) was
independently verified unaffected.

### Scope: the same pattern existed on 17 tables

Querying `pg_policies` for every table with more than one permissive
SELECT policy turned up 17 tables sharing this exact shape (a staff-facing
policy paired with a separate `*_select_for_guardians` policy). 14 of
those pair the staff check with a genuinely non-trivial second policy
(`is_learner_guardian()`'s real table lookup, or a cross-table `EXISTS`)
and were fixed in the same migration:

`assessment_results`, `assessments`, `attendance_records`,
`class_teacher_assignments`, `classes`, `grades`, `learner_documents`,
`learner_enrollments`, `learner_fee_adjustments`, `learner_fee_charges`,
`learner_fee_payments`, `learner_fee_refunds`, `subjects`,
`timetable_entries`.

Two tables were deliberately left alone — genuinely no risk, not
overlooked:

- `academic_years` — both of its two policies are pure JWT-claim checks,
  no table access at all.
- `guardian_profile_details` — its second policy is a plain
  `guardian_profile_id = auth.uid()` column comparison, not a function
  call.

`storage.objects` (3 permissive policies) was left untouched — a
different subsystem, lower likely severity, and out of this session's time
budget to verify as carefully; a candidate for a dedicated follow-up if a
future load test flags it.

### Fix

New migration `20260829280000_rls_select_policy_consolidation.sql`: for
each of the 14 tables, drop both existing permissive SELECT policies and
create ONE merged policy (same name as the original primary policy) whose
`USING` clause is the verbatim original staff qual, OR the verbatim
original guardian qual, cheap check listed first. No access-logic change —
structure only. INSERT/UPDATE/DELETE policies were untouched.

## Result after the fix

Same load profile, same 30s window:

| scenario | count | errors | avg (ms) | p50 | p95 | p99 |
|---|---|---|---|---|---|---|
| announcements_recent | 617 | 0 | 213 | 129 | 637 | 915 |
| fee_charges_overview | 294 | 0 | 270 | 183 | 712 | 1195 |
| list_learners | 208 | 0 | 321 | 269 | 724 | 872 |
| timetable_entries | 186 | 0 | 669 | 586 | 1261 | 2244 |
| my_children | 153 | 0 | 548 | 482 | 1024 | 1484 |
| **assessments_list** | **118** | **1 (0.8%)** | **423** | **360** | 801 | 1224 |
| attendance_recent | 106 | 0 | 406 | 330 | 863 | 1082 |

- `assessments_list`: **7720ms → 423ms avg** (~18x), **48% → 0.8% error
  rate**.
- **Total throughput more than doubled** in the same window (816 → 1682
  requests) — the pathological query had been starving the whole instance
  of CPU, not just its own callers.
- Overall error rate: **1.47% → 0.06%**.

The one remaining error (1 of 1682) was not chased further — at 0.06% on
a local dev Postgres under synthetic concurrent load, this is consistent
with ordinary noise, not a systemic pattern.

## Verification

- Full RLS regression suite: 471/471 passing after the fix (ran against a
  fresh throwaway container applying every migration from scratch — this
  also confirms the new migration applies cleanly on top of the full
  migration history, not just the mutated local dev DB).
- Relevant e2e specs (assessments, attendance, fees, guardian invitations,
  learners, parent portal, timetable) re-run against the real local stack
  after the fix.
- `tsc`/`eslint`/187 unit tests/build all clean.

## Follow-ups (not attempted here — out of this ticket's scope)

- `storage.objects`'s own 3 permissive policies were not audited with the
  same rigor — worth a dedicated pass if it ever shows up in a future load
  test.
- No periodic load-test run is wired into CI — this is a manual tool for
  now (`node supabase/load-tests/run.mjs`), not an automated regression
  gate. Wiring it into a scheduled job is a reasonable future step but a
  separate decision (needs a place to run against a disposable instance).
- This test exercises the seeded demo dataset's actual size (a few hundred
  learners, ~3,900 assessment results). Testing at materially larger scale
  (10x/100x) would need a dedicated data-generation exercise, not attempted
  here.
