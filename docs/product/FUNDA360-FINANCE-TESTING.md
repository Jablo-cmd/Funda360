<title>Funda360 — Finance Testing</title>

# Funda360 — Finance Testing

## Unit tests — `src/features/fees/utils/calculations.test.ts`

22 tests (was 13 before this session). Covers:
- `deriveFeeStatus`: outstanding/paid/partially_paid/overdue precedence, credit-balance handling, zero-charge edge case — all pre-existing, unchanged.
- **New**: an adjustment reduces the balance exactly like a payment would; a fully-refunded payment correctly falls back to `outstanding` (not `partially_paid`, since net paid is now zero); a *pending* refund does **not** yet reduce net paid (status stays `partially_paid`) — this is the single most important business-logic distinction in the refund model and has a dedicated test.
- `calculateNetPaid`: equals total payments with no refunds; subtracts only `completed` refunds; ignores `rejected` refunds entirely.
- `buildFeeSummary`: totals, clamped-at-zero balance, most-recent-payment selection — pre-existing; extended with adjustment/refund total assertions.

Run: `npm run test` (full suite, 126/126 passing, all files).

## RLS/trigger tests — `supabase/rls-tests/tests/fees_adjustments_and_refunds.test.sql`

10 checks, run inside a disposable `postgres:16-alpine` Docker container via `supabase/rls-tests/run.sh` (independent of `supabase start`). See [FUNDA360-FINANCE-SECURITY.md](FUNDA360-FINANCE-SECURITY.md) for the full list of what's verified — the highlights specific to correctness rather than authorization:

- A refund exceeding the payment's remaining refundable balance is rejected by the database trigger.
- A refund landing exactly on the remaining refundable balance succeeds (boundary case, not just the failure case).
- An adjustment's optional `charge_id` must belong to the *same learner* it's being applied to, not merely the same school (a charge belonging to a different learner in the same tenant is correctly rejected).

**Status: executed and verified.** `supabase/rls-tests/run.sh` was run against a fresh disposable `postgres:16-alpine` container (26 test files, all 32 migrations applied in order, all 14 fixture files loaded): **ALL 313 TESTS PASSED**, 0 failures — including this file's 10 checks. This closes the one gap the Finance Release Gate previously withheld a full PASS for.

## E2E — `e2e/fees.spec.ts`

3 new Playwright tests, network-mocked (never touches a live Supabase project, consistent with every other spec in `e2e/`):

1. A `finance_manager` opens a learner's Financial tab and sees the correct outstanding balance (1000 charged − 400 paid = 600), computed the same way the unit tests verify.
2. A `finance_manager` adds a discount through the UI and the visible balance updates correctly (1000 − 100 discount − 400 paid = 500) — an actual end-to-end exercise of the new `FeeAdjustmentFormModal` → `feeService.createAdjustment` → re-fetch → re-render path, not just the calculation in isolation.
3. A role without `learner.view_financial` (`teacher`) never sees the Financial tab at all.

**Verified this session**: all 3 pass individually and as part of the full suite. Full regression run: **132/134 e2e tests passing**. The 2 failures (`reset-password.spec.ts`, one `school-profile.spec.ts` logo-upload test) are unrelated to Finance, were confirmed to pass when re-run in isolation, and are consistent with parallel-worker flakiness under the full 134-test run rather than a regression introduced by this session's changes.

## What is not covered, honestly

- No load/performance test against a realistic multi-hundred-learner dataset — the demo seed being built alongside this work (`supabase/seed.sql`) is the first fixture that makes this possible; not exercised this session.
- No test for the fee-structure catalogue's RLS specifically (it reuses `can_view_learner_financial`/`can_manage_learner_financial`, already covered by the pre-existing `fees.test.sql` for the table itself, but no *new* test was added when the frontend wiring was built this session — the RLS policies themselves were not changed, so this is a coverage gap, not a known defect).
- No mutation testing, no visual regression testing — consistent with the rest of the product, not a Finance-specific gap.
