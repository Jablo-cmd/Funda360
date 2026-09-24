# Funda360 — Reconciled Documentation

**Current as of:** 2026-09-24  
**Source of truth:** `docs/FUNDA360_CURRENT_STATE_2026-09-24.md`

> Reconciled against current code, migrations, routes, RBAC/RLS and tests. Historical requirements are not treated as current capability.

## Production runbook
### Before release
Confirm target Supabase project, environment variables, migrations, auth/domain settings, storage policies and any provider secrets. Run relevant typecheck, lint, unit, E2E and RLS checks.

### After release
Smoke-test authentication, role routing, tenant context, core academic workflows, portals and enabled integrations. Review logs and verify no cross-tenant access.

### Operational boundary
Repository CI/local tests are evidence of tested code, not automatic proof of hosted production readiness. Backups, monitoring, recovery and provider integrations must be verified in the target environment.