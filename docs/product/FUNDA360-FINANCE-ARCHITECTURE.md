<title>Funda360 — Finance Architecture</title>

# Funda360 — Finance Architecture

## Layered design

```text
                    FUNDA360 FINANCE
                           │
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
   FEE STRUCTURES    LEARNER LEDGER      ADJUSTMENTS
   (catalogue,        (charges, from     (discount/bursary/
    now UI-wired)      structure or       scholarship/waiver
                        ad-hoc)            — new this session)
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ↓
                  DERIVED BALANCE
              (calculations.ts, one
               place this math lives)
                           │
             ┌─────────────┼─────────────┐
             ↓                           ↓
         PAYMENTS                    REFUNDS
      (cash/eft/card/                (new this session —
       debit_order/cheque)            against a specific
             │                        payment, DB-capped)
             ↓
     PAYMENT GATEWAY ABSTRACTION
     (designed this session — see below)
             │
        ┌────┴────┐
        ↓         ↓
    MANUAL/EFT   LIVE PROVIDER
   (implemented) (blocked — needs
                  real credentials)
             ↓
       SCHOOL-WIDE REPORTING
   (FinanceOverviewPage — collection
    rate, ageing, status mix)
```

## Why the ledger model, not an allocation/invoice model

The original fees migration made a deliberate choice: charges and payments are independent rows; balance is `sum(charges) - sum(payments)` computed at query time, never stored. This session's adjustments and refunds extend the exact same pattern — `outstandingBalance = max(0, totalCharged - totalAdjustments - netPaid)`. This was preserved, not replaced, because:

1. **It isn't broken.** Every operation the product needs (balance, status, history, ageing) falls out of a simple aggregation over a handful of rows per learner. Real school scale (hundreds of learners, a handful of charges/payments/adjustments/refunds each per year) makes this trivially fast — no pre-aggregation or materialized view is warranted.
2. **Fewer invariants to protect.** An allocation model (which payment satisfies which specific charge) needs its own consistency rules and its own way to go wrong (partial allocations, re-allocation on a voided charge). The ledger model has none of that — every number is a pure function of the currently-active rows.
3. **The refund design proves the model scales to a new requirement without rework.** Refunds needed exactly one new invariant (can't refund more than was paid, net of prior refunds) — implemented as a single trigger, no schema change to the existing tables, no migration of existing data.

## Payment gateway abstraction (this session's design, sandbox-ready)

The brief required a provider-agnostic abstraction and explicitly forbade inventing credentials. What exists after this session:

- **Recording surface**: `learner_fee_payments.method` already models `cash | eft | card | debit_order | cheque | other` — any gateway's outcome lands in the same table, the same way a manually-recorded EFT does today. This is the actual integration contract a live gateway needs to satisfy: **produce a payment row with a method, amount, reference, and date** — nothing about the ledger/reporting/refund logic needs to know or care whether that row came from a human typing an EFT reference or a webhook confirming a card charge.
- **What a live integration would add**, without changing anything above: a `payment_gateway_transactions`-style table (provider, provider_reference, status, raw payload, idempotency key) that a webhook handler writes to, plus a trigger or service call that inserts the corresponding `learner_fee_payments` row on confirmed success — mirroring exactly how `learner_fee_refunds` already inserts against an existing payment. This is a genuinely additive migration when a provider is chosen; nothing built this session would need to change.
- **Idempotency**: the natural key for a webhook is the provider's own transaction/event id — a unique constraint on that column, plus "insert, ON CONFLICT DO NOTHING" at the payment-row level, is the same idempotency pattern already used throughout this schema (e.g. `guardian_invitations_one_pending_per_guardian`).
- **What's blocked**: choosing a provider (PayFast is the common SA schools default; Stripe/Peach are alternatives), obtaining real merchant/sandbox credentials, and a business decision on whose settlement account funds land in. None of these are engineering decisions this session can make.

## RBAC — unchanged, reused

No new role, no new permission function. `learner_fee_adjustments`/`learner_fee_refunds` are gated by the exact same `can_view_learner_financial()`/`can_manage_learner_financial()` pair every other fees table already uses:

| Role | View | Manage |
|---|---|---|
| `school_owner` | ✅ | ✅ |
| `principal` | ✅ (duty-of-care) | ❌ |
| `finance_manager` | ✅ | ✅ |
| `accountant` | ✅ | ✅ |
| everyone else | ❌ | ❌ |
| platform admin | ✅ (any tenant) | ✅ (any tenant) |
| guardian of the learner | ✅ (own child only, read-only) | ❌ |

## Monetary representation — current state and residual risk

The database stores every amount as `numeric(12,2)` — exact decimal, no floating-point risk server-side. The frontend (`calculations.ts`, all UI components) uses plain JavaScript `number` for display and pre-submission math. This is a documented, low-but-nonzero risk: JS floating-point arithmetic on two-decimal values can occasionally produce a value like `0.30000000000000004` for sums involving many small charges. At realistic school-fee magnitudes (hundreds to thousands of Rand, few line items per learner per year) this has not been observed to produce a visible display bug, and the *authoritative* numbers (what's actually stored) are always the database's exact decimal values — the frontend never writes a computed total back to the database, only individual charge/payment/adjustment/refund amounts a human entered. **Recommendation, not yet implemented**: adopt a decimal-safe arithmetic library (e.g. `decimal.js`) in `calculations.ts` if/when the product moves to displaying aggregated totals across many more line items than today's per-learner scale, or before wiring a live payment gateway where a one-cent display discrepancy would be user-visible and reputationally costly.
