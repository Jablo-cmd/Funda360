<title>Funda360 — Current State (Verified)</title>

# Funda360 — Current State (Verified Against Local Code)

**Audited:** 2026-08-28, against the local repository only (no GitHub). Every claim below is backed by a file/line reference or an explicit test result, produced by direct inspection plus two research passes over the full codebase (schema/RLS/RPCs, and a domain-by-domain feature audit). Nothing here is inferred from a route existing, a table existing, or documentation claiming a feature works — see [FUNDA360-GAP-ANALYSIS.md](FUNDA360-GAP-ANALYSIS.md) for what didn't survive that bar.

**A note on `docs/`:** this repo has ~19 files under `docs/` with elaborate names (PRD, BRS, DDS, RBAC spec, SDD, ADS, etc.). All 15 of the parenthesized-acronym ones open with a literal LLM role-play generation prompt ("You are a Senior Product Manager… produce the official PRD…") — they are aspirational generation outputs, not verified specifications, and several describe tables/features (Campuses, Payroll, Examinations, a public API) that do not exist in the actual schema or code. Only `docs/FUNDA360_KNOWN_LIMITATIONS.md` and `docs/adr/ADR-0001-*.md` read as genuinely maintained, and even `KNOWN_LIMITATIONS.md` is now stale on two points (it says "no timetable" and "no parent/guardian login" — both shipped since). Treat the current document, not the acronym docs, as ground truth going forward.

---

## 1. Verified baseline (before this audit's own changes)

```text
npm run lint        → clean, 0 errors
npm run typecheck    → clean, 0 errors
npm run test          → 117/117 unit tests passing (12 files)
npm run build           → succeeds
```

**Stack:** React 18 + TypeScript + Vite, React Router, react-hook-form + zod, Tailwind (dark-mode via class + full token system). Supabase (Postgres 17 + GoTrue + Storage), accessed **client-direct** — every feature's `*Service.ts` calls `supabase.from()/.rpc()` directly; there is no custom REST/GraphQL API layer anywhere. 26 tables, 13 client-callable `SECURITY DEFINER` RPCs, RLS enabled + **forced** on every tenant-scoped table, 24-value `user_role` enum. Local dev via Supabase CLI (`supabase start` / `db reset`); a disposable-Postgres RLS regression suite (`supabase/rls-tests/`, 25 test files + 14 fixture files) independent of the Vitest/Playwright suites.

---

## 2. 🟢 Verified existing capabilities, by domain

For each: what exists, the evidence, test coverage, security posture, and what's left for a top-tier bar (detailed as gap items in [FUNDA360-GAP-ANALYSIS.md](FUNDA360-GAP-ANALYSIS.md)).

### Platform Foundation
| Feature | Status | Evidence | Tests | Security |
|---|---|---|---|---|
| Multi-tenant data model | 🟢 DONE | Every domain table carries `school_id`; `current_tenant_id()`/`is_platform_admin()` SECURITY DEFINER helpers; FORCE RLS on all 26 tables | `supabase/rls-tests/tests/status_aware_authorization.test.sql` (cross-tenant isolation), `schools.test.sql` | Verified: a school-scoped role can never read/write another tenant's rows (tested explicitly, incl. FK-guessing attempts blocked by `*_validate_tenant()` triggers) |
| Authentication | 🟢 DONE | Supabase Auth email/password; `authService.ts`, `ForgotPasswordPage`, `ResetPasswordPage`, `activationService.ts` (guardian activation reuses the same recovery-link mechanism) | `e2e/login.spec.ts`, `forgot-password.spec.ts`, `reset-password.spec.ts`, `activate-account.spec.ts`, `verify-email.spec.ts` | No MFA; Supabase's own built-in rate limiting only |
| RBAC / permission model | 🟢 DONE | 24-value `user_role` enum; `ROLE_PERMISSIONS` in `rolePermissions.ts` mirrored 1:1 by ~20 SQL `can_view_*`/`can_manage_*` helper functions | `permissionHelpers.test.ts`, `roleHelpers.test.ts`, + every domain's RLS test file | Deliberately duplicated (app-layer + DB-layer) so a UI bug can never grant more than RLS allows; DB is the real boundary |
| Tenant switching (platform admin) | 🟡 PARTIAL | `tenantService.listAvailableSchools()`, `TenantProvider.switchTenant()` | — | Works but no UI surface calls it in the current build (support-tooling only) |
| School onboarding | 🟡 PARTIAL | `tenantService.createSchool()` — name/type/status/province only | `tenant.spec.ts` | No setup wizard, no default academic-year/term/grade seeding on creation |
| Deactivation / identity lifecycle | 🟢 DONE | Every status check re-verifies live `profiles.status` on every request (not session-cached); leaving a school = new independent identity, never a cross-tenant reuse | `status_aware_authorization.test.sql`, `e2e/identity-lifecycle.spec.ts` | Verified end-to-end; documented in `KNOWN_LIMITATIONS.md` |
| File storage | 🟡 PARTIAL | `src/lib/storage.ts` generic wrapper; used by exactly 2 buckets (`learner-documents`, `school-logos`) | `document-upload.spec.ts`, `learner_documents_storage.test.sql`, `school_logos_storage.test.sql` | Private buckets, signed URLs only — solid pattern, just narrowly applied |
| Audit logging | 🔴 MISSING | No `audit_log` table/service anywhere. Every table has `created_by`/`updated_by`/timestamps (who/when for that row), but no queryable cross-domain audit trail | — | — |
| Notifications (any kind) | 🔴 MISSING | Zero notification table/service/UI. Only Supabase Auth's own transactional emails (password reset, activation) exist | — | — |
| Global search / command palette | 🔴 MISSING | — | — | — |
| System configuration UI | 🔴 MISSING | No `/settings` route | — | — |

### Learner / SIS
| Feature | Status | Evidence |
|---|---|---|
| Learner CRUD, profile, search/filter | 🟢 DONE | `src/features/learners` (full CRUD, `LearnersFiltersBar` — search + status filter only) |
| Enrolment / grade+class placement | 🟢 DONE | `learner_enrollments`, `enrollmentService.ts` |
| Promotion workflow | 🟢 DONE | `PromoteLearnerModal.tsx` → `promote_learner()` RPC, atomic prior-enrolment-closeout | `learner_management.test.sql` |
| Status lifecycle (admissions pipeline states) | 🟡 PARTIAL | `learner_status` enum has the states (`prospective→…→withdrawn`); `ChangeLearnerStatusDialog` is one flat dropdown, not a pipeline/kanban view |
| Guardians (multi-guardian, multi-child) | 🟢 DONE | `learner_guardians` M:M join, `is_primary`/`is_emergency_contact`/`is_authorized_pickup`; `admin_create_guardian()` RPC | `guardian_management.test.sql` |
| Guardian invitations / activation | 🟢 DONE | `guardian_invitations` audit table + `send/revoke/accept/get_my_guardian_invitation()` RPCs, real Supabase recovery-link delivery | `guardian_invitations.test.sql`, `e2e/guardian-invitations.spec.ts`, `activate-account.spec.ts` |
| Emergency contacts | 🟢 DONE | `learner_emergency_contacts` | `guardian_emergency_contacts_access.test.sql` |
| Medical information | 🟢 DONE | `learner_medical_information`, separately RLS-gated (`can_view/manage_learner_medical`) | covered in `learner_management.test.sql` |
| Documents | 🟡 PARTIAL | Real upload/download (see Foundation); no versioning, no expiry date, no e-signature |
| Transfers | 🟡 PARTIAL | `transferred` is a status value only; no transfer-letter workflow |
| Alumni | 🟡 PARTIAL | `graduated`/`withdrawn` are status values only; no alumni registry/view |
| Bulk operations / CSV import | 🔴 MISSING | `src/lib/csv.ts` exists but is export-only (Reports module); no learner bulk-import path anywhere |

### HR / Staff
| Feature | Status | Evidence |
|---|---|---|
| Employee CRUD, departments, reporting lines | 🟢 DONE | `employees`/`departments` tables, cycle-safe `reports_to_employee_id` | `employee_management.test.sql`, `departments.test.sql` |
| Login provisioning from an employee record | 🟢 DONE | `provision_employee_login()` RPC, narrow assignable-role list | `employee_login_provisioning.test.sql` |
| Termination / reactivation | 🟢 DONE | `terminate_employee()`/`reactivate_employee()` RPCs (atomic profile deactivation on termination) | — |
| HR reporting | 🟡 PARTIAL | `EmployeeReportPage` — headcount, by-department, by-status only |
| Leave management | 🔴 MISSING | No table/service anywhere |
| Staff attendance | 🔴 MISSING | — |
| Contracts / qualifications / documents | 🔴 MISSING | No employee-document storage path (only learner-documents bucket exists) |

### Academics
| Feature | Status | Evidence |
|---|---|---|
| Academic structure (years/terms/grades/classes/subjects) | 🟢 DONE | Full CRUD, tenant/consistency-validated by triggers | `academic_structure.test.sql` |
| Active-year switching | 🟢 DONE | `set_active_academic_year()`, atomic, activation-guarded | — |
| Teaching assignments | 🟢 DONE | `class_teacher_assignments` (class-teacher and subject-teacher variants) | `teaching_assignments.test.sql` |
| Assessments + gradebook | 🟢 DONE | `assessments`/`assessment_results`, mark≤max_mark enforced by trigger, enrolment-gated | `assessment.test.sql` |
| Lesson planning | 🔴 MISSING | — |
| Homework / assignments (distinct from assessments) | 🔴 MISSING | `assignment`/`examination` are just `assessment_type` enum values in the one gradebook feature |
| Question banks / rubrics / moderation | 🔴 MISSING | — |
| Report cards / transcripts / PDF export | 🔴 MISSING | No PDF library dependency anywhere; `report_card` exists only as a document-upload category |
| Academic intervention tracking | 🔴 MISSING | — |

### Timetable
| Feature | Status | Evidence |
|---|---|---|
| Manual entry, per class/subject/teacher/day/time/room | 🟢 DONE | `timetable_entries`, full CRUD |
| Conflict detection (teacher/class/room) | 🟢 DONE | `timetable_entries_check_conflicts()` — hard DB-level rejection, not merely UI advice | `timetable.test.sql` (trigger-level), `e2e/timetable.spec.ts` |
| Auto-generation / scheduling assistant | 🔴 MISSING | Manual entry only, no algorithmic generation |
| Substitution handling | 🔴 MISSING | — |
| Published/draft states | 🔴 MISSING | Only `active`/archived, no draft lifecycle |
| Parent/learner-facing timetable view | 🔴 MISSING | Staff-only route; zero timetable code in `parentPortal` |

### Attendance
| Feature | Status | Evidence |
|---|---|---|
| Daily class attendance (present/absent/late/excused) | 🟢 DONE | `attendance_records`, class-scoped `can_record_attendance()` | `attendance.test.sql` |
| Reporting (by class, by learner, date range) | 🟡 PARTIAL | `AttendanceReportPage` — solid flat tables + CSV export, no trend charts |
| Alerts/interventions | 🟡 PARTIAL | Client-side-only derived banner ("<90% attendance") on the learner profile; not a persisted alert, no notification |
| Period-level attendance | 🔵 NOT PLANNED (see architecture doc) | Daily-only by deliberate design (documented in the migration itself) |
| Staff attendance | 🔴 MISSING | — |

### Behaviour / Wellbeing
| Feature | Status | Evidence |
|---|---|---|
| Incident recording (positive + negative) | 🟢 DONE | `behaviour_incidents`, role-gated to `vice_principal`/`department_head`/`school_owner`/`principal` | `behaviour.test.sql` |
| Guardian/parent visibility | 🔴 MISSING (deliberately, documented) | `ChildBehaviourTab.tsx` is an explicit placeholder — migration comment states no visibility-tier column exists yet to safely expose staff-only notes |
| Safeguarding/counselling workflow | 🔴 MISSING | — |
| Structured intervention/case tracking | 🟡 PARTIAL | Only free-text `followUpRequired`/`followUpNotes` fields |

### Parent Portal
| Feature | Status | Evidence |
|---|---|---|
| Guardian auth + multi-child dashboard | 🟢 DONE | `ParentDashboardPage`, `useMyLearners`, `useChildContext` | `e2e/parent-portal.spec.ts` |
| Per-child Attendance / Academics tabs | 🟢 DONE | `ChildAttendanceTab`, `ChildAcademicsTab` | — |
| Per-child Fees tab | 🟡 PARTIAL → improved this session, see Finance | `ChildFeesTab.tsx` | — |
| Behaviour tab | 🔴 MISSING (placeholder) | see above | — |
| Messaging | 🔴 MISSING | — |
| Document access | 🔴 MISSING | Learner documents exist but are staff-only; no guardian-facing download |
| Timetable | 🔴 MISSING | — |

### Learner Portal
🔴 **MISSING entirely.** No learner-facing login/route/page anywhere. All learner data is staff- or guardian-mediated.

### Finance
See [FUNDA360-FINANCE-MODULE.md](FUNDA360-FINANCE-MODULE.md) for the full before/after. Summary: charges + payments ledger existed and worked (🟢); this session added discounts/bursaries/scholarships/waivers, refunds, fee-structure catalogue wiring, and a school-wide finance report (see that doc). Payment gateway integration, budgets, expenses and suppliers remain 🔴 MISSING — explicitly scoped out this pass (see that doc's gap list).

### Communication
🔴 **MISSING beyond transactional auth email.** Password reset / activation emails exist (via Supabase Auth); no SMS, WhatsApp, in-app messaging, or announcements anywhere.

### Mobile
🔴 **MISSING.** Pure web SPA — no React Native, no Capacitor, no PWA manifest/service worker.

### School Operations (inventory / library / transport / procurement / facilities)
🔴 **MISSING**, beyond two free-text fields (`transport_mode`, `transport_notes`) on `learners`.

### Documents
🟡 **PARTIAL** — see Learner/SIS row above. Real, tested upload/download; no versioning/expiry/e-signature/form-builder.

### Workflow Engine
🔴 **MISSING** as a generic capability. Only hardcoded PL/pgSQL triggers exist (conflict checks, tenant validation) — no configurable trigger→condition→action→escalation engine.

### Funda Intelligence / AI
🔴 **MISSING.** No LLM/AI integration anywhere. "Analytics" today = basic aggregation (`reports/utils/aggregation.ts`) — counts, percentages, grouping. No predictive/risk-scoring logic.

### Executive Command Centre
🟡 **PARTIAL.** `DashboardPage.tsx` is a real, working stat-panel dashboard (Active Learners/Employees/Classes/Today's Attendance, My Classes, Attendance Overview, Recent Assessments, Quick Actions) — but its "System Status" panel is **partly hardcoded** (`Authentication: online` is a literal string, not a real health check) and there are no cross-domain KPIs (no finance, no behaviour summary).

### API / Integrations
🔴 **MISSING** beyond the Supabase client itself. No custom REST/GraphQL layer, no public API, no webhooks, no third-party integrations (payment, accounting, Google/Microsoft, government reporting).

### Security / POPIA Readiness
| Feature | Status |
|---|---|
| RLS coverage | 🟢 DONE — every tenant table, FORCE RLS, 25 SQL regression test files including explicit cross-tenant/IDOR-style attempts |
| Tenant isolation | 🟢 DONE — verified, see above |
| Accessibility testing | 🟡 PARTIAL — axe-core, 6 of ~25 routes, serious/critical only, `color-contrast` explicitly excluded (documented, app-wide token issue, not hidden) |
| MFA | 🔴 MISSING |
| Rate limiting beyond Supabase defaults | 🔴 MISSING |
| Data retention/deletion policy | 🔴 MISSING (soft-delete/deactivate only, no purge policy) |
| Consent management | 🔴 MISSING |
| POPIA compliance | ⚫ Not claimed, not verified — needs legal review, not just engineering (see Gate 8 in [FUNDA360-RELEASE-GATES.md](FUNDA360-RELEASE-GATES.md)) |

### Quality Engineering
🟢 **DONE, substantial, real.** 117 Vitest unit tests (12 files), 22 Playwright e2e specs (network-mocked, never touch a live Supabase project), 25 SQL RLS regression files + 14 fixture files (disposable-Postgres, run via `supabase/rls-tests/run.sh`). Coverage is concentrated on authorization correctness and calculation utilities; no load/performance tests, no visual regression, no mutation testing.

### Premium UX
| Feature | Status |
|---|---|
| Dark mode | 🟢 DONE — full CSS-variable token system, `ThemeToggle` |
| Component library | 🟡 PARTIAL — 16 primitives in `src/components/ui`, but no shared Tabs/Dropdown/Toast/DataTable (features hand-roll their own, e.g. `ParentChildProfilePage`'s inline tab buttons) |
| Command palette / global search | 🔴 MISSING |
| Accessibility | 🟡 PARTIAL (see Security row) |

### Commercial Readiness
🔴 **MISSING**, beyond the demo seed this session is building (`supabase/seed.sql`). No platform-level subscription/billing, no onboarding wizard, no trial system, no support console.

---

## 3. What this document is for

This is the evidence base for [FUNDA360-GAP-ANALYSIS.md](FUNDA360-GAP-ANALYSIS.md) and [FUNDA360-TOP-TIER-KANBAN.md](FUNDA360-TOP-TIER-KANBAN.md). Nothing here should be re-derived from scratch in a future session — update this file in place as capabilities change, the same way `KNOWN_LIMITATIONS.md` was meant to be kept current but drifted. Whoever next touches a domain listed 🟢 or 🟡 above should re-verify against code before trusting this file if more than a few weeks have passed.
