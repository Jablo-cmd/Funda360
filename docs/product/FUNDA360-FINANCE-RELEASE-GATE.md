# Funda360 — Reconciled Product Documentation

**Current as of:** 2026-09-24  
**Authoritative register:** `docs/FUNDA360_CURRENT_STATE_2026-09-24.md`

> Reconciled against current code, migrations, routes, RBAC/RLS and tests. Historical claims and aspirational designs are not current-state evidence.

## Finance release gate
Before enabling finance for a school, verify schema/migrations, RLS, role permissions, charge/payment/adjustment/refund integrity, statements, reconciliation and auditability. For online payments, additionally verify provider credentials, webhooks, idempotency, refunds and end-to-end settlement/reconciliation in the hosted environment.

A local test pass is necessary evidence but not production certification.