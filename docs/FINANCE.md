# Funda360 — Financial Management

Describes the **actual implementation** of the finance domain:
`supabase/migrations/20260823120000_fees_domain.sql`,
`…20260828090000_fees_adjustments_and_refunds.sql`,
`…20260829290000_bank_reconciliation.sql`,
`…20260903090000_fees_invoicing.sql`, `…20260903100000_payment_gateway.sql`,
`…20260903110000_finance_gate_hardening.sql` (concurrency locks on
allocation/settlement + `revoke … from authenticated` on the internal
numbering/cron functions), and `src/features/fees`.

## Ledger model

There is **one money-of-record**: independent rows against a learner's
account, with the balance/status **derived by aggregation at query time**,
never stored.

| Row type | Table | Effect on balance |
|---|---|---|
| Charge | `learner_fee_charges` | increases owed |
| Payment | `learner_fee_payments` | decreases owed |
| Adjustment (discount / bursary / scholarship / waiver) | `learner_fee_adjustments` | decreases owed; carries reason + authoring user + audit |
| Refund (`completed` only) | `learner_fee_refunds` | re-increases owed; capped at the payment's remaining refundable balance |

The arithmetic lives in exactly one place: `src/features/fees/utils/calculations.ts`
(per-learner and school-wide) and `…/utils/statement.ts` (running-balance
statement + debtor ageing). Decimal-safe via `src/lib/money.ts` (integer cents).

Nothing is ever hard-deleted — every table has `active = false` as the only
removal path, enforced by *no `DELETE` policy* + `FORCE ROW LEVEL SECURITY`.

## Invoices (documentary layer, added 2026-09-03)

An **invoice** is a numbered, dated, lockable *grouping* of charges that
already exist as ledger rows (`learner_fee_charges.invoice_id`). It does not
introduce a second money-of-record.

- **Draft** — created with its line-item charges; freely editable.
- **Issue** (`issue_fee_invoice` RPC) — assigns a gap-free per-school number
  (`schools.invoice_number_prefix`), snapshots `subtotal` / `vat_amount` /
  `total` from the active charges, sets issue/due dates, and raises an
  in-app notification for each guardian. The charges are now frozen — a
  direct edit is blocked by trigger.
- **Void** (`void_fee_invoice` RPC, reason required) — deactivates the
  line-item charges (they leave the balance), removes any allocations, keeps
  the invoice + number permanently.

VAT defaults to **0** (`schools.vat_rate`) — SA school fees are largely
VAT-exempt; the field exists for the minority of taxable supplies.

### Payment allocation

`learner_fee_payment_allocations` optionally attributes portions of a payment
to specific invoices (`allocate_fee_payment` RPC — replaces the whole
allocation set for a payment atomically, enforcing *per-invoice ≤ invoice
total* and *total ≤ payment amount*). Unallocated payment amount is simply
an account credit. An invoice's presentation status (`paid` / `partially_paid`
/ `overdue` / `issued`) is derived from its allocations + due date.

## Receipts

`fee_receipts` — one numbered acknowledgement per payment
(`issue_fee_receipt` RPC, idempotent). PDF generated client-side
(`generateFeeDocumentPdf.ts`, dynamic `jspdf` import).

## Statements

`invoiceService.getLearnerStatement` / `getFamilyStatement` build an
`AccountStatement` (chronological entries + running balance + 5-bucket
debtor ageing) from the same ledger rows. PDF client-side.

## Bank reconciliation

`bank_reconciliation_imports` / `bank_statement_lines` — a finance user
uploads a bank-statement CSV; each line is confirmed against an
unreconciled `learner_fee_payments` row (never auto-committed). Matching
flips `learner_fee_payments.reconciled_at` atomically via
`reconcile_bank_statement_line` — direct writes to either side are blocked.

## Online payments

See **[PAYMENT_GATEWAY.md](./PAYMENT_GATEWAY.md)**.

## RBAC

| Permission | Roles | Grants |
|---|---|---|
| `learner.view_financial` | `school_owner`, `principal` (duty-of-care, view-only), `finance_manager`, `accountant`, platform admins | see charges/payments/adjustments/refunds/invoices/receipts, Finance Overview, invoice register, statements |
| `learner.manage_financial` | `school_owner`, `finance_manager`, `accountant`, platform admins | create/void charges, record payments, adjustments, refunds, invoices, allocations, receipts, payment-provider config, billing settings |

Guardians have **no** finance permission but get row-level `SELECT` on their
own linked child's charges, payments, adjustments, refunds, **issued**
invoices, allocations, and receipts — plus the ability to start an online
payment for that child.

Routes: `/fees` (overview), `/fees/invoices` (register), `/fees/reconciliation`,
`/fees/structures`, `/fees/settings` (billing + provider config, manage-tier);
`/parent/fees`, `/parent/payment-return` (guardians).

## Tests

- Unit: `src/features/fees/utils/*.test.ts` (calculations, statement, bank import).
- RLS: `supabase/rls-tests/tests/fees*.test.sql`, `payment_gateway.test.sql`, `bank_reconciliation.test.sql`, `fee_overdue_reminders.test.sql`.
- Edge (Deno): `supabase/functions/_shared/providers/providers.test.ts`.
- E2E: `e2e/fees.spec.ts`.
