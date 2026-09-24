# Funda360 — Reconciled Documentation

**Documentation status:** Current as of 2026-09-24  
**Repository:** Jablo-cmd/Funda360  
**Source of truth:** `docs/FUNDA360_CURRENT_STATE_2026-09-24.md`

> This document was reconciled against the current repository rather than against historical requirements or generated specifications. Implemented capability, partial capability, external configuration, and planned capability are kept separate. A feature is not described as live merely because a route, migration, adapter, or design exists.

## Current platform baseline

Funda360 is an enterprise-oriented, multi-tenant school-management SaaS platform built with React 18/TypeScript/Vite/Tailwind and Supabase Auth/PostgreSQL/RLS/Storage, using PostgREST/client-direct access plus SECURITY DEFINER RPCs where appropriate. The repository currently records 67 SQL migrations, 56 RLS regression-test files, 43 Playwright E2E specs and 26 unit-test files, with Docker-based RLS verification and CI tooling.

Implemented/current domains include authentication and account lifecycle, multi-tenancy, RBAC, school administration, academic structure, timetable, teaching assignments, assessments/gradebook, report cards, learner/SIS, guardians and portals, admissions, attendance, homework, finance ledger and reconciliation workflows, employee/HR/leave, behaviour, safeguarding, consent, messaging/announcements, notifications, reporting/CSV exports, documents/storage and audit/security controls.

The platform is production-oriented, but the repository does **not** establish that every enterprise capability is production-certified. Payment-provider activation, government interoperability, native mobile, enterprise BI, full payroll, transport, boarding, library, sports, assets, procurement, SGB governance, independent security certification and other roadmap items remain separate from shipped functionality unless explicitly evidenced in code/configuration.

## Documentation rule

For future updates use this order of evidence:

**CODE → DATABASE/MIGRATIONS → ROUTES → RBAC/RLS → TESTS → DOCUMENTATION**

When a requirement differs from implementation, document the implementation as current and the requirement as planned/target state.

## Project context & handover — current

This handover supersedes historical sprint narratives as the operational orientation document.

### Where the project stands
The repository contains a substantial multi-tenant school-management platform with secure database enforcement, academic/SIS capability, portals, admissions, finance, HR/leave, communication, homework, attendance, behaviour, safeguarding and consent.

### Engineering anchors
- `src/features/` contains the domain implementations.
- `supabase/migrations/` defines the schema evolution.
- `supabase/rls-tests/` contains database security regression tests.
- `e2e/` contains Playwright coverage.
- `docs/FUNDA360_CURRENT_STATE_2026-09-24.md` is the current-state register.

### Handover rule
Do not resume an old sprint plan simply because it appears in historical documentation. Inspect current code, migrations and tests first, then update the roadmap.