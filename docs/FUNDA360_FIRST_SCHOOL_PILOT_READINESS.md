# Funda360 First School Pilot Readiness

**Status:** In progress  
**Branch:** pilot-hardening  
**Date:** 18 September 2026

## Objective

Prepare Funda360 for its first real-school pilot without weakening the existing multi-tenant security model or presenting unfinished capabilities as production functionality.

## Gate 1 — Platform identity & ownership

- [x] Funda360 repository confirmed as `Jablo-cmd/Funda360`
- [x] Main branch confirmed
- [x] Pilot-hardening branch created
- [x] Auris platform ownership baseline documented
- [x] School-data control boundary documented
- [ ] Final commercial/IP terms approved for the pilot

## Gate 2 — Authentication

- [x] Supabase authentication architecture present
- [x] Protected application routes present
- [x] MFA handling present in application
- [ ] Production email/SMTP verified
- [ ] Guardian activation verified end-to-end
- [ ] Password recovery verified in production
- [ ] Temporary-password provisioning replaced or formally controlled for production

## Gate 3 — Multi-tenancy & authorization

- [x] Tenant provider exists
- [x] Tenant switching restricted to platform-level roles
- [x] PostgreSQL RLS present
- [x] FORCE RLS present on core tenant tables inspected
- [x] Direct tenant_id modification protection present
- [x] Direct role modification protection present
- [ ] Full cross-tenant regression suite executed against the production schema
- [ ] All pilot roles verified against real-school workflows

## Gate 4 — School onboarding

- [ ] Create pilot school
- [ ] Create school owner
- [ ] Create principal
- [ ] Create teachers
- [ ] Create finance/HR users where required
- [ ] Create guardians
- [ ] Create learners
- [ ] Establish guardian/learner relationships
- [ ] Verify school-specific dashboard/navigation
- [ ] Verify account suspension/reactivation

## Gate 5 — Privacy & security

- [x] POPIA engineering baseline documented
- [ ] Final public privacy notice approved
- [ ] Pilot data-processing terms approved
- [ ] Information Officer/privacy responsibility confirmed
- [ ] External service/subprocessor inventory completed
- [ ] Incident/breach process confirmed
- [ ] Retention/deletion schedule confirmed
- [ ] Backup and restore procedure tested

## Gate 6 — Product quality

- [ ] No unfinished or misleading pilot UI
- [ ] No fake statistics or unsupported claims
- [ ] No irrelevant role navigation
- [ ] Mobile flows tested
- [ ] School onboarding tested from a clean account
- [ ] Guardian journey tested
- [ ] Teacher journey tested
- [ ] Finance journey tested where applicable
- [ ] Principal journey tested

## Gate 7 — Engineering verification

- [ ] TypeScript check
- [ ] ESLint
- [ ] Unit tests
- [ ] RLS/security tests
- [ ] E2E tests
- [ ] Production build
- [ ] Deployment verification
- [ ] Error monitoring/logging verification

## Gate 8 — Pilot launch

A pilot may proceed only after the critical security, authentication, privacy, data-isolation and onboarding gates are signed off.

### Pilot acceptance record

**School:** ______________________________

**Pilot owner:** ___________________________

**Auris technical owner:** __________________

**Start date:** ____________________________

**Approved environment:** __________________

**Data-processing terms approved:** Yes / No

**Privacy notice approved:** Yes / No

**Security gate passed:** Yes / No

**Production verification passed:** Yes / No

**Launch approval:** _______________________

**Date:** _________________________________
