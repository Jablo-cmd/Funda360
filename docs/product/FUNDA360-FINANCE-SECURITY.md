# Funda360 — Reconciled Product Documentation

**Current as of:** 2026-09-24  
**Authoritative register:** `docs/FUNDA360_CURRENT_STATE_2026-09-24.md`

> Reconciled against current code, migrations, routes, RBAC/RLS and tests. Historical claims and aspirational designs are not current-state evidence.

## Finance security
Finance data is protected through PostgreSQL RLS/forced RLS and role-aware policies. Financial history is preserved through controlled lifecycle/status patterns rather than casual destructive deletion. Regression tests cover finance security and integrity.

Production security still depends on correct hosted configuration, secrets management, provider controls and operational access reviews.