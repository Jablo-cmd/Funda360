<title>Funda360 — Finance Security</title>

# Funda360 — Finance Security

## RLS / RBAC verification

Every finance table (`fee_structures`, `learner_fee_charges`, `learner_fee_payments`, and this session's `learner_fee_adjustments`/`learner_fee_refunds`) has RLS **enabled and forced** — including for the table owner, meaning even a bug that ran queries as the owning role could not bypass it. No DELETE policy exists on any of the five tables; a mistaken entry is voided (`active = false`), never removed, preserving the full financial history unconditionally.

Verified by `supabase/rls-tests/tests/fees.test.sql` (pre-existing, 9 checks) and this session's `fees_adjustments_and_refunds.test.sql` (new, 10 checks):

- ✅ `finance_manager`/`accountant` can create and view records for their own school.
- ✅ `principal` can view (duty-of-care) but cannot insert/manage — a direct INSERT attempt is rejected by RLS, not merely hidden in the UI.
- ✅ A `teacher` (no financial permission) sees zero rows.
- ✅ **Cross-tenant**: School B's `finance_manager` cannot see School A's records, and a direct INSERT attempt referencing School A's learner/payment is rejected by the `*_validate_tenant()` trigger even though the role itself would otherwise qualify — this is the FK-doesn't-respect-RLS gap this codebase's migrations repeatedly close, verified again for the two new tables.
- ✅ A platform admin sees records across every tenant.
- ✅ The learner's own guardian can see their child's adjustments/refunds (Parent Portal visibility); nothing tests or implies a guardian can see another guardian's.
- ✅ Hard delete is impossible for any authenticated caller, including the row's own creator.

## New for this session: refund amount cannot exceed the refundable balance

This is enforced **in the database** (`learner_fee_refunds_validate_tenant()` trigger), not only client-side:

```sql
select coalesce(sum(amount), 0) into v_already_refunded
  from public.learner_fee_refunds
  where payment_id = new.payment_id and active and status in ('pending', 'completed') and id is distinct from new.id;

if new.status in ('pending', 'completed') and new.amount > (v_payment.amount - v_already_refunded) then
  raise exception 'insufficient_privilege: refund amount % exceeds the refundable balance %', ...;
end if;
```

Verified by two explicit test cases: a refund request 100 above the remaining balance is rejected; a refund request exactly at the remaining balance succeeds. A client-side bug, a forged request, or a second concurrent refund attempt cannot double-refund a payment — the check runs on every INSERT/UPDATE regardless of caller.

## IDOR / cross-tenant attack surface — explicitly tested

Every write path checked in this session validates that every foreign key it accepts (`learner_id`, `academic_year_id`, `charge_id`, `payment_id`) actually belongs to the same `school_id` as the row being written — closing the specific gap where a caller with legitimate `can_manage_learner_financial()` for their own tenant supplies a *guessed or leaked* UUID belonging to a different tenant. This is the same defense-in-depth pattern (SECURITY DEFINER trigger reading a table the caller's own RLS wouldn't let them see) already used by every other domain in this schema, applied consistently to the two new tables.

## What was NOT tested or built this session (honest gaps)

- **Privilege escalation via role change mid-session**: not specifically re-tested for the new tables, though the underlying mechanism (`current_tenant_id()`/`is_platform_admin()` re-checking live `profiles.status`/role on every request, not session-cached) is the same one `status_aware_authorization.test.sql` already verifies for the rest of the schema — no new risk was introduced, but no new dedicated test was written either.
- **Payment gateway webhook security** (signature verification, replay protection): not applicable — no live gateway exists yet (see architecture doc). The design is ready to receive these controls when a real provider is chosen.
- **Rate limiting on refund/adjustment creation**: relies entirely on Supabase's platform-level defaults, same as every other write path in this product — no finance-specific rate limiting was added or evaluated as more urgent than the platform-wide gap already recorded in [FUNDA360-GAP-ANALYSIS.md](FUNDA360-GAP-ANALYSIS.md).
- **Audit log**: created_by/updated_by (who, when) exist on every new row via the same trigger every other table uses; a queryable, cross-domain audit trail (the kind a POPIA/financial-audit review would expect) does not exist yet anywhere in the product, Finance included — tracked as a P0 platform gap, not something scoped to Finance alone.
