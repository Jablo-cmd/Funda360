# Funda360 — Reconciled Documentation

**Current as of:** 2026-09-24  
**Source of truth:** `docs/FUNDA360_CURRENT_STATE_2026-09-24.md`

> Reconciled against current code, migrations, routes, RBAC/RLS and tests. Historical requirements are not treated as current capability.

## Pilot deployment checklist
- Hosted Supabase project identified and accessible.
- Production environment variables target the intended project.
- Migrations applied and verified.
- Auth redirects/domain configured.
- Tenant, school, academic year and reference data prepared.
- Staff, guardian and learner accounts have correct roles.
- RLS/tenant-isolation smoke tests pass.
- Core pilot workflows accepted by representative users.
- Backups/recovery posture confirmed.
- External providers configured only if included in scope.
- Import/migration validated.
- Support and escalation contacts documented.

Local verification does not automatically certify the hosted deployment.