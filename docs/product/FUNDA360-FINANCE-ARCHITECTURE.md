# Funda360 — Reconciled Product Documentation

**Current as of:** 2026-09-24  
**Authoritative register:** `docs/FUNDA360_CURRENT_STATE_2026-09-24.md`

> Reconciled against current code, migrations, routes, RBAC/RLS and tests. Historical claims and aspirational designs are not current-state evidence.

## Finance architecture
Finance uses PostgreSQL/Supabase with tenant-scoped records and RLS, plus application services for charges/payments and controlled workflows. Current capabilities include charges, payments, adjustments, refunds, allocations, statements, ageing and bank-CSV reconciliation. Monetary calculations are decimal-safe.

Payment-provider activation is separate from the ledger and requires real credentials, webhook controls, reconciliation and hosted verification.