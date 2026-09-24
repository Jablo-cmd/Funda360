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

## Finance — current state

Finance is a working ledger-oriented domain covering fee charges, payments, adjustments, refunds, allocations, discounts/waivers/bursary-style adjustments, statements, ageing/collection views, finance KPIs, bank CSV import and human-confirmed reconciliation.

Money calculations use decimal-safe arithmetic and derived balances rather than trusting stored totals. Financial history is preserved through controlled status/void patterns rather than destructive deletion where applicable.

### Integration status
Payment gateway architecture exists, but a live provider must not be represented as active without real credentials/configuration and successful end-to-end verification.

### Remaining depth
Full accounting/GL, broader automated reconciliation, provider activation and enterprise finance workflows remain expansion areas.