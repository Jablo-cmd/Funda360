<title>Funda360 — Finance Module</title>

# Funda360 — Finance Module: Before / After

## 1. Finance before this session

A single, working, ledger-style domain (`20260823120000_fees_domain.sql`): `fee_structures` (a catalogue table defined but **never queried by the frontend**), `learner_fee_charges`, `learner_fee_payments`. RLS via `can_view_learner_financial()`/`can_manage_learner_financial()` (school_owner/principal view, school_owner/finance_manager/accountant manage — principal is view-only, a duty-of-care pattern already established elsewhere). Frontend: `feeService.ts` (get/create/void charges and payments), `calculations.ts` (derives `totalCharged`/`totalPaid`/`outstandingBalance`/`status` by aggregation, never stored), and one UI surface — `LearnerFinancialSection`, a tab inside the Learner 360 profile. No standalone Fees page, no school-wide report, no discounts/bursaries/scholarships, no refunds, zero e2e coverage. Fully covered by `supabase/rls-tests/tests/fees.test.sql` for what existed.

## 2. Finance after this session

Built **additively** — the existing charges/payments ledger is untouched and still the foundation; nothing was rewritten.

### New database (migration `20260828090000_fees_adjustments_and_refunds.sql`)
- `learner_fee_adjustments` — discount/bursary/scholarship/waiver, fixed-amount or percentage-derived, optionally scoped to one charge or general to the account. `amount` is always the authoritative rand figure; `percentage` is retained for display/audit only.
- `learner_fee_refunds` — a refund against a specific prior payment, status `pending`/`completed`/`rejected`. **Database-enforced** (not merely client-validated): a trigger computes the payment's remaining refundable balance (payment amount minus already-active pending/completed refunds) and rejects any refund that would exceed it.
- Both tables reuse `can_view_learner_financial()`/`can_manage_learner_financial()` verbatim — no new permission function, no new role. Both get a Parent Portal read policy mirroring the existing `learner_fee_charges_select_for_guardians` pattern exactly, so guardians can see why their balance is lower (discounts) and whether an overpayment was returned (refunds).

### Calculations (`calculations.ts`, extended not replaced)
`LearnerFeeSummary` now carries `totalAdjustments`, `totalRefunded`, `netPaid` (payments minus *completed* refunds only — a pending refund request must not silently reduce recorded payment history before money has actually moved), and `outstandingBalance = max(0, totalCharged - totalAdjustments - netPaid)`. `deriveFeeStatus` updated to match. 15 new/updated unit tests.

### Fee-structure catalogue — closed the "defined but unused" gap
- `feeService.getFeeStructures/createFeeStructure/archiveFeeStructure` (new).
- **FeeStructuresPage** (`/fees/structures`) — a real management UI for the catalogue (name, category, amount, optional grade scoping), gated by `learner.manage_financial`.
- `FeeChargeFormModal` gained an optional "use a fee structure template" picker that pre-fills description/category/amount and stamps `fee_structure_id` on the resulting charge — manual entry still works exactly as before.

### New UI capability on the existing Fees tab
`LearnerFinancialSection` gained: a compact running-balance summary (total charged / net paid / adjustments / outstanding, visible without leaving the tab), an Adjustments table with add/void, a Refund action on each payment row (opens `RefundFormModal`, pre-filled to that payment, amount capped by the database), and a Refunds table showing status.

### School-wide Finance Overview (new — was Learner-360-tab-only before)
**FinanceOverviewPage** (`/fees`) — total billed, discounts, net collected, outstanding, overdue, a collection-rate percentage, a status-mix breakdown (paid/partially paid/outstanding/overdue learner counts), and a 4-bucket ageing breakdown (current/31-60/61-90/90+ days), for the active academic year. Computed from the same raw ledger rows the per-learner view uses (`feeService.getSchoolFinanceOverview`) — there is no separate stored aggregate that could drift out of sync with the per-learner numbers.

### Navigation
New "Fees" sidebar entry (Operations section, `learner.view_financial`-gated), new `WalletIcon`, both new routes registered in `AppRoutes.tsx`.

### Testing
- **Unit**: `calculations.test.ts` extended to 22 tests (was 13) covering adjustments, refunds, pending-vs-completed-refund status logic.
- **RLS**: new `supabase/rls-tests/tests/fees_adjustments_and_refunds.test.sql` (10 checks) — role gating (finance_manager/accountant manage, principal view-only, teacher blocked), the refund-exceeds-balance rejection (both the failing case and the exactly-at-the-limit success case), cross-tenant isolation, guardian read access, no-hard-delete.
- **E2E**: new `e2e/fees.spec.ts` (3 tests, network-mocked, consistent with every other e2e spec) — correct balance calculation, add-a-discount flow reducing the visible balance, and permission gating.
- Full regression run after these changes: **132/134 e2e passing** (the 2 failures — `reset-password.spec.ts`, `school-profile.spec.ts` logo upload — are unrelated to Finance and pass individually; confirmed flaky under full-suite parallel load, not a regression), **126/126 unit tests**, lint/typecheck/build all clean.

## 3. What was deliberately NOT built this session, and why

- **Live payment gateway** (PayFast/Stripe/Peach/etc.) — needs real merchant credentials and a business decision on provider/settlement account. See [FUNDA360-FINANCE-ARCHITECTURE.md](FUNDA360-FINANCE-ARCHITECTURE.md) for the abstraction design that's ready to receive one.
- **Budgets/expenses/suppliers** — a genuinely different domain (school operating costs, not fee collection). Building it now risks turning Finance into a general ledger/mini-ERP, which the brief itself warned against ("we are NOT building Sage/Xero/SAP"). Left as a scoped P2 gap, not a shortcut.
- **Bank reconciliation** — needs a real bank-feed or manual-statement-import decision that wasn't made this session.
- **Invoice documents / PDF receipts** — the ledger model (row-per-charge, row-per-payment) was preserved deliberately (it's not broken); a formatted, numbered invoice/receipt PDF is a presentation-layer addition on top of it, not attempted this pass.

See [FUNDA360-FINANCE-RELEASE-GATE.md](FUNDA360-FINANCE-RELEASE-GATE.md) for the full pass/fail against every criterion the brief specified.
