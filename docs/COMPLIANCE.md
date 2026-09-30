# Funda360 Compliance Architecture

**Positioning:** POPIA + FERPA + GDPR ready, with COPPA and CIPA controls.
**Source of truth:** `supabase/migrations/20260930100000_compliance_framework.sql` (database enforcement) and `src/features/compliance/` (UI).
**Tests:** `supabase/rls-tests/tests/compliance_framework.test.sql`, `src/features/compliance/utils/*.test.ts`, `e2e/compliance.spec.ts`.

"Ready" means every control below exists in the product and is measured live for each school. It is **not** a certification by a regulator or auditor, and each school remains the responsible party (POPIA "responsible party", GDPR "controller", FERPA "educational agency") for its own processing.

## Design rule

Every control is enforced in PostgreSQL: RLS, triggers, and SECURITY DEFINER RPCs that write `audit_log`. The UI makes controls visible and usable, but bypassing the UI (for example, calling the API directly) never bypasses a rule.

## Framework coverage

| Requirement | How it is met | Enforced by |
|---|---|---|
| **POPIA** baseline, always on | `school_compliance_settings.frameworks` has a CHECK so POPIA cannot be disabled | DB constraint |
| POPIA s.55 Information Officer | Name and email in settings; shown to families; missing = *Action required* | Settings + Trust Center |
| POPIA s.23–25 / GDPR Art. 15–21 data-subject requests | `create_data_subject_request()`: families only for self or own children; statutory `due_at`; overdue tracking | RPC + RLS |
| **FERPA** right to inspect | `get_learner_record_package()` returns the full record to guardians, learners and staff with learner access | RPC |
| FERPA right to amend (§99.20–22) | `record_amendment_requests`: due date, reasoned denial (CHECK), hearing request, statement of disagreement | RPCs + CHECK |
| FERPA record of disclosures (§99.32) | `record_disclosures`, visible to guardians; consent-based and directory disclosures refused without current consent | RPC |
| **COPPA** verifiable parental consent under 13 | `parental_consents` append-only ledger with typed attestation and declaration. No login can be linked, reactivated, or used to submit homework or messages while consent is missing | Triggers on `learners`, `profiles`, `assignment_submissions`, `messages` |
| COPPA consent at onboarding | `ConsentOnboardingGate` blocks the parent portal until every required purpose is decided (granted **or** refused) | UI (DB enforces the consequences) |
| Withdrawal | Withdrawing online-account consent deactivates the child's login immediately | `record_parental_consent()` |
| **CIPA** safe content | `content_safety_rules` (platform baseline + school rules). *Block* rejects the write; *flag* keeps it and raises `content_safety_events`. Self-harm and violence flags notify owner and principal | Triggers on messages, announcements, assignments, submissions, resources |
| CIPA harmful uploads | `is_safe_upload()` refuses executables, scripts, HTML and SVG, and checks the MIME allowlist on every file table; every storage bucket has size and MIME limits | Triggers + `storage.buckets` |
| **GDPR** explicit consent | No pre-selected choices; refusing is as easy as granting; each purpose states what refusing means; privacy-notice version recorded per decision | UI + ledger |
| GDPR right to be forgotten | `execute_learner_erasure()`: verified deletion request, compliance officer, **MFA (aal2)** session, typed learner number. Deletes medical data, contacts, free text and documents; pseudonymises the learner; bans the login; redacts PII copies in `audit_log`; retains statutory registers (legal-obligation exemption) | RPC |
| GDPR portability | One-click JSON, CSV and PDF export of the full record (`recordExport.ts`); CSV is formula-injection safe | UI + RPC |
| Data minimisation | Guardians and learners see only staff, their own family and conversation participants — not the school-wide directory | `profiles` RLS policy |

## Technical safeguards

| Safeguard | Status basis | Detail |
|---|---|---|
| TLS in transit | **Measured** per session | The page protocol and API URL must both be `https` |
| AES-256 at rest | **Provider-attested** | Supabase (AWS) encrypts database, backups and storage. Funda360 adds no application-layer column encryption |
| Role-based access | **Measured** | Every table must have forced RLS; the count is shown live. Parents, teachers and admins have separate permissions (`ROLE_PERMISSIONS` in the UI, `can_*` / `is_*` helpers in the DB) |
| Audit logs | **Measured** | `audit_log` triggers on every student-data table (insert/update/delete with before/after), plus `student_record_access_log` for views, exports, prints, disclosures, amendments and erasures. Append-only; readable by owner, principal and platform admins |
| Consent workflow | **Measured** | Counts of granted, refused and withdrawn consents, and coverage of minors |
| Data portability | **Measured** | Export is always available; every export is access-logged |

## Screens

| Route | Who | Purpose |
|---|---|---|
| `/compliance` (Trust Center) | `compliance.view`: owner, principal, platform roles | Framework status, safeguards, KPIs, DSARs and erasure, amendments, consent ledger, paper-consent capture, audit and access logs, safe-content review and rules, disclosures, settings, white-label regulator report (PDF) |
| `/parent/privacy`, `/learner/privacy` | Guardians, learners | Consent management, record download (PDF/CSV/JSON), access and disclosure history, correction requests, deletion and restriction requests |
| Parent portal (all pages) | Guardians | Consent onboarding gate |
| Dashboards | Leadership and parents | Data-protection status beside learner progress |
| `/trust` | Public | "POPIA + FERPA + GDPR ready" positioning page |

Compliance icons: `src/components/ui/complianceIcons.tsx` (FERPA Shield, COPPA Consent, CIPA Safe Content, GDPR Lock, POPIA Trust, Audit Logs, Encryption, Role-Based Access, Consent Workflow, Data Portability). They are two-tone: navy through `currentColor`, orange through `--accent-500`.

## Known limits (stated, not hidden)

- **Access logging covers application paths.** The app logs every learner-profile view (per tab), every export and every compliance action. PostgreSQL cannot log `SELECT`s made directly against the API, so a staff member who queries the REST API by hand is constrained by RLS but not access-logged. To close this, enable `pgaudit` object auditing on the hosted project.
- **Content filtering is rule-based** (case-insensitive regular expressions). It does not classify images. Upload safety is file-type and size based; malware and image scanning would need an external scanning service.
- **CIPA** legally binds US schools and libraries receiving E-rate funding. Funda360 implements its safe-content controls for every school.
- **MFA** is enforced by the database: once a user has a verified factor, an `aal1` session resolves no tenant (`current_tenant_id()`, `is_platform_admin()` and the membership helpers return nothing) until it steps up to `aal2` (20260930110000). Users who have never enrolled a factor are not forced to enrol by the database; erasure always requires `aal2`.
- **Erasure deletes stored files through the Storage API** after the database transaction. The UI reports any file that could not be removed.

## Deployment note

The compliance migration, the security fix `20260930090000_revoke_public_worker_execute`, and five earlier migrations must be applied to production. The CI `migrate` job does this automatically once the `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_REF` secrets are set in the `github-pages` environment.
