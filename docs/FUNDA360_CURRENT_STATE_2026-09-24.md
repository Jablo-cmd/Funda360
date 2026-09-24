# Funda360 — Current Product & Engineering State

**Status:** Authoritative current-state snapshot  
**As-of:** 2026-09-24  
**Repository:** Jablo-cmd/Funda360  
**Default branch:** main  
**Latest verified commit:** `710b34fa9e7e0bf84116a994f1bf6e7fb8231b9d` — `fix: add realtime publication to RLS test harness`

> This document describes what is actually present in the repository as of the date above. It deliberately separates **implemented and verified capability** from **roadmap/planned capability**. Marketing claims must not be inferred from roadmap items.

## 1. Product Identity

Funda360 is an enterprise-oriented, multi-tenant school management SaaS platform developed by Auris Nexus Technologies.

**Primary architecture**
- React 18 + TypeScript + Vite
- Tailwind CSS
- Supabase Auth
- PostgreSQL
- Row Level Security (RLS)
- Supabase Storage
- PostgREST/client-direct data access
- SECURITY DEFINER RPCs for privileged state transitions
- GitHub Actions / repository CI
- Playwright E2E tests
- Vitest unit tests
- Docker-based PostgreSQL RLS regression harness

The application is designed around tenant isolation: school data is scoped to its school/tenant and authorization is enforced in the database as well as in the application.

## 2. Implemented Feature Surface

The repository currently contains these feature areas under `src/features/`:

`academic`, `admissions`, `announcements`, `assessments`, `attendance`, `auth`, `behaviour`, `consent`, `dashboard`, `employees`, `fees`, `guardians`, `homework`, `learnerPortal`, `learners`, `messaging`, `mfa`, `notifications`, `parentPortal`, `profile`, `rbac`, `reportCards`, `reports`, `safeguarding`, `school`, `search`, `teacherWorkspace`, `teaching`, `tenant`, `timetable`, `users`.

### 2.1 Platform foundation
**Implemented**
- Authentication and protected routing
- Email verification / password recovery / account activation
- MFA challenge flow
- Multi-tenant school model
- Platform-level tenant switching
- RBAC with a 24-role catalogue and permission matrix
- Permission-aware routes
- School administration
- User/profile management
- School onboarding wizard
- Route-level code splitting
- Executive dashboard shell and responsive UI
- Light/dark theme support

**Code**
- `src/features/auth/`
- `src/features/rbac/`
- `src/features/tenant/`
- `src/features/school/`
- `src/features/users/`
- `src/app/AppRoutes.tsx`
- `src/components/layout/`
- `src/components/ui/`

### 2.2 Academic management
**Implemented**
- Academic years
- Terms
- Grades
- Classes
- Subjects
- Teacher/class/subject assignments
- Active academic-year switching with protected server-side transition
- Timetables
- Timetable conflict detection
- Draft/published timetable lessons
- Teacher workspace / My Classes
- Assessments
- Assessment results / gradebook data
- Report-card grading scales
- Report-card templates
- Governed report-card workflow
- Individual and bulk report-card PDF generation
- Report-card publication controls
- Attendance and conduct snapshots in report cards

**Code**
- `src/features/academic/`
- `src/features/teaching/`
- `src/features/timetable/`
- `src/features/assessments/`
- `src/features/reportCards/`
- `src/features/teacherWorkspace/`

### 2.3 Learner / SIS
**Implemented**
- Learner registry
- Learner profiles
- Enrolment history
- Promotion/status lifecycle
- Guardians and learner-guardian relationships
- Emergency contacts
- Medical information with separate access controls
- Learner documents and storage
- Alumni view
- Learner CSV import
- Learner self-service portal
- Guardian/parent portal

**Code**
- `src/features/learners/`
- `src/features/guardians/`
- `src/features/learnerPortal/`
- `src/features/parentPortal/`

### 2.4 Admissions
**Implemented**
- Admission applications
- Configurable admission requirements
- Application workflow
- Application detail view
- Public application intake
- Resume application flow
- Conversion of an accepted application into learner + guardian + enrolment records
- Deduplication safeguards
- Guardian access to their own submitted application status through a narrow SECURITY DEFINER RPC

**Code**
- `src/features/admissions/`
- Public route: `/apply`
- Edge Function: `admissions-public`

### 2.5 Finance
**Implemented**
- Fee ledger
- Fee charges
- Payments
- Adjustments
- Refunds
- Allocations
- Discounts / waivers / bursary-style adjustments
- Statements
- Ageing / collection reporting
- Finance overview
- Bank-statement CSV import
- Human-confirmed bank reconciliation
- Decimal-safe monetary arithmetic
- Finance CSV reporting
- Payment-gateway architecture and go-live gating

**Important status**
The live payment gateway is **not claimed as active without real provider credentials/configuration**.

**Code**
- `src/features/fees/`
- `docs/FINANCE.md`
- `docs/PAYMENT_GATEWAY.md`

### 2.6 HR / employee management
**Implemented**
- Employee records
- Departments
- Employee lifecycle / termination / reactivation
- Employee login provisioning
- Staff attendance
- Leave requests
- Role-aware access to employee information

**Not yet equivalent to a full payroll/HR suite**
- Payroll processing remains outside the current completed core.

**Code**
- `src/features/employees/`

### 2.7 Attendance
**Implemented**
- Daily class attendance
- Present / absent / late states
- Class-scoped teacher recording
- Management-level recording
- Attendance reporting
- Dashboard attendance overview
- Attendance alerts and notification records

**Code**
- `src/features/attendance/`

### 2.8 Homework / learning
**Implemented**
- Assignments
- Draft → published → closed lifecycle
- Due dates and instructions
- Rubric/resources support
- Learner submissions
- Resubmission
- Teacher marking/return/excuse
- Missing/submission tracking
- Gradebook synchronisation where linked to an assessment
- Guardian and learner visibility
- Notifications

**Code**
- `src/features/homework/`

### 2.9 Parent and learner portals
**Parent/guardian portal implemented**
- Dashboard
- Children
- Child profiles
- Academic results
- Report cards
- Attendance
- Homework
- Documents
- Timetable
- Behaviour visibility where permitted
- Medical/emergency information where permitted
- Admission application status
- Notifications
- Messaging
- Consent management

**Learner portal implemented**
- Dashboard
- Timetable
- Homework and submissions
- Results
- Report cards
- Attendance
- Documents
- Announcements
- Notifications
- Profile

**Code**
- `src/features/parentPortal/`
- `src/features/learnerPortal/`

### 2.10 Communication and notifications
**Implemented**
- Conversations
- Direct and group messaging
- Participants
- Messages
- Attachments
- Read cursors
- Archive/mute
- Role-aware messaging permissions
- Notification preferences
- In-app notifications
- Announcements
- Notification delivery/outbox architecture
- Email/SMS/WhatsApp adapter architecture
- Provider activation gated on real secrets/configuration

**Code**
- `src/features/messaging/`
- `src/features/notifications/`
- `src/features/announcements/`

### 2.11 Behaviour, safeguarding and consent
**Implemented**
- Behaviour incidents
- Guardian-visible behaviour records where configured
- Safeguarding domain
- Consent records
- Guardian consent management for discretionary categories
- Audit trail for consent changes

**Code**
- `src/features/behaviour/`
- `src/features/safeguarding/`
- `src/features/consent/`

### 2.12 Reporting and analytics
**Implemented**
- Learner reports
- Employee reports
- Academic reports
- Assessment reports
- Attendance reports
- Finance overview KPIs
- Dashboard KPIs
- CSV exports
- Report-card PDFs

**Current limitation**
A broader cross-domain BI/analytics layer is still planned; existing reporting should not be described as a full enterprise BI product.

**Code**
- `src/features/reports/`
- `src/features/dashboard/`

## 3. Security Architecture — Current Reality

The current repository has a substantially developed database-security model.

**Implemented**
- PostgreSQL RLS
- FORCE RLS on tenant-scoped domains
- Tenant-aware helper functions
- Role/permission-aware policies
- Guardian self-scoping
- Learner self-scoping
- SECURITY DEFINER privileged RPCs
- Protected state transitions
- Function execute-privilege hardening
- Consent auditability
- Audit logging
- Database rate limiting for privileged account-provisioning operations
- Security-focused regression tests
- Realtime publication included in the RLS test harness

**Security principle**

> UI permissions are not the security boundary. PostgreSQL RLS and server-side authorization are.

**Important remaining work**
Operational POPIA/DSAR workflows, retention/deletion policy implementation, independent security testing/certification, and production operational controls remain separate from the application security foundation.

## 4. Database / Migration State

As of the repository's current `main` tree:
- **67 SQL migrations** under `supabase/migrations/`
- **56 RLS regression test files** under `supabase/rls-tests/tests/`
- Docker-based disposable PostgreSQL harness
- Full migration-history application is part of the RLS verification approach
- Current documented RLS verification reaches **484/484 passing** in the latest domain work recorded in the repository

The migration history is additive. Existing completed domains must be extended rather than duplicated or replaced.

## 5. Test / Quality Surface

Repository inventory as of 2026-09-24:
- **43 Playwright E2E spec files**
- **26 unit-test files** under `src/`
- **56 SQL RLS regression test files**
- TypeScript type-checking
- ESLint
- Vitest
- Vite production build
- Playwright E2E
- Dedicated database/RLS regression harness
- Load-test tooling under `supabase/load-tests/`

Recent documented reliability work includes:
- RLS policy consolidation after a real concurrency defect was discovered
- Pagination fixes preventing PostgREST 1000-row truncation in report aggregations
- Route-level code splitting
- Real local-Supabase smoke testing for privileged account provisioning
- Realtime publication added to the RLS harness

## 6. Current Production/Deployment Truth

Funda360 is **production-oriented but should not be described as fully production-certified**.

Do not claim:
- a live payment gateway unless provider credentials/configuration are actually activated
- live government integrations unless an official endpoint and credentials have been implemented and verified
- SOC 2 / ISO 27001 certification
- full mobile-native applications
- complete enterprise BI
- complete transport/boarding/library/procurement/operations modules
- automated production notification scheduling unless the external provider and scheduler are activated

The repository contains a production runbook and pilot checklists, but production certification is a separate gate.

## 7. Current Roadmap — Not Yet Completed

The following are roadmap capabilities, not current core capabilities:

1. Transport management
2. Boarding / hostel management
3. Library management
4. Sports / extracurricular management
5. Assets / inventory
6. Procurement
7. SGB / governance
8. Events / school calendar
9. Full SA-SAMS / CEMIS interoperability layer
10. Advanced cross-domain BI / analytics
11. Full scheduled notification automation
12. Expanded payment-provider activation
13. Mobile/PWA expansion beyond the current responsive web experience
14. Funda AI / school intelligence
15. Broader external API / integration platform
16. Final POPIA operational workflows
17. Independent security certification / production certification

These items should be implemented only after confirming that the capability does not already exist in the repository.

## 8. Strategic Product Position

Funda360 should currently be described as:

> **A growing, enterprise-oriented African school-management SaaS platform with a strong multi-tenant core, substantial SIS/academic/finance/HR/portal/communication capability, database-enforced tenant security, and a clear path toward AI, interoperability and broader school operations.**

It should **not** currently be described as a functional-equivalent replacement for mature global platforms such as PowerSchool across every product area.

The product direction is to reach that level of breadth and operational maturity while maintaining a stronger African/South African localisation strategy.

## 9. Authoritative Code Map

When verifying a capability, inspect the code in this order:

1. `src/features/<domain>/` — frontend domain implementation
2. `src/app/AppRoutes.tsx` — route exposure
3. `src/features/rbac/` — permissions
4. `supabase/migrations/` — database implementation
5. `supabase/rls-tests/tests/` — database authorization verification
6. `e2e/` — user-flow verification
7. `docs/` — implementation notes and operational documentation

**Rule:** Documentation must follow the code. If a document says a capability exists but the implementation cannot be found in the repository, the claim must be corrected.

## 10. Documentation Maintenance Rule

Every completed domain must update:
- this current-state register
- the domain-specific documentation
- `docs/DOMAIN_STATUS.md`
- relevant product/requirements documentation when the actual product scope changes
- tests/verification records

Every roadmap change must distinguish:
- **Implemented**
- **Partially implemented**
- **Externally blocked**
- **Planned**

**Last verified against repository:** 2026-09-24.
