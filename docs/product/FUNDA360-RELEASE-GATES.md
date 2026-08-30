<title>Funda360 — Release Gates</title>

# Funda360 — Release Gates

Each gate must PASS before the next major phase of work is considered safe to build on. A gate is evaluated honestly against [FUNDA360-DEFINITION-OF-DONE.md](FUNDA360-DEFINITION-OF-DONE.md) — no gate is marked PASS on the strength of a plan, only on verified, tested work.

## GATE 1 — Architecture Ready
**Status: PASS.** Multi-tenant schema, RLS/RBAC pattern, service-layer convention, archive-not-delete convention, and the migration/testing toolchain are all established and proven across 12+ domains. This gate was already passed before this audit — see [FUNDA360-CURRENT-STATE.md](FUNDA360-CURRENT-STATE.md) §1.

**Criteria:** tenant isolation model defined and tested ✅ · RBAC model defined and tested ✅ · migration/RLS-test/e2e toolchain working ✅ · a documented, followable pattern for adding a new domain ✅ (demonstrated again this session by the Finance extension).

## GATE 2 — Core Platform Ready
**Status: PARTIAL.** Auth/RBAC/tenant isolation ✅. Missing: audit logging, notifications, MFA — see Gap Analysis P0/P1 items.

**Criteria to reach PASS:** audit log live for at least role-change/finance/medical mutations · MFA available for finance/admin roles · at least the email notification channel live for one real event (e.g. fee overdue).

## GATE 3 — Academic Ready
**Status: PARTIAL.** Academic structure, teaching assignments, assessments/gradebook, timetable (manual + conflict detection), attendance are all real and tested ✅. Missing for a genuine top-tier bar: report cards, homework distinct from assessments (or an explicit decision not to build it).

**Criteria to reach PASS:** report card generation shipped · admissions pipeline has a real workflow UI, not a flat dropdown.

## GATE 4 — Parent/Learner Ready
**Status: PARTIAL.** Parent Portal exists and is genuinely wired (auth, multi-child, attendance, academics, and now an improved fees tab) ✅. Missing: behaviour visibility (deliberately deferred pending a schema decision), timetable tab, document access, messaging. Learner Portal does not exist (deliberately deferred, see architecture doc).

**Criteria to reach PASS:** timetable + document tabs shipped in Parent Portal · behaviour visibility either shipped (with a real visibility-tier column) or explicitly and permanently descoped by product decision.

## GATE 5 — Finance Ready
See [FUNDA360-FINANCE-RELEASE-GATE.md](FUNDA360-FINANCE-RELEASE-GATE.md) for the full, dedicated gate — Finance was this session's deep-dive and gets its own detailed pass/fail with functional/security/data-integrity/testing/UX/production sub-criteria.

## GATE 6 — Payments Ready
**Status: FAIL (blocked, not failed-on-merit).** Provider-agnostic gateway abstraction + manual/EFT adapter shipped this session. A live gateway (PayFast/Stripe/Peach/etc.) requires real merchant credentials and a business decision on which provider and whose settlement account — neither of which this session can supply. **Cannot PASS until that decision is made and credentials are provisioned**; the engineering path (webhook idempotency, signature verification, reconciliation) is designed and ready to receive a real adapter with no architectural rework.

## GATE 7 — Mobile Ready
**Status: NOT STARTED.** See architecture doc's PWA-first recommendation. No PWA manifest/service worker exists yet.

**Criteria to reach PASS (PWA path):** installable manifest + service worker shell caching · offline-safe read views for attendance/timetable/fees · web push wired to the Notifications foundation (Gate 2).

## GATE 8 — Security Ready
**Status: PARTIAL.** RLS/tenant isolation is genuinely strong (25 SQL regression files, explicit cross-tenant attack tests) ✅. Missing: MFA, rate limiting beyond Supabase defaults, consent management, a documented data retention/deletion policy, and — critically — **POPIA compliance is not claimed and has not been legally reviewed**; this gate cannot be marked PASS on engineering controls alone.

**Criteria to reach PASS:** MFA for sensitive roles · documented retention policy · consent capture live · a named legal/compliance sign-off on POPIA readiness (external to this engineering process).

## GATE 9 — Performance/Reliability Ready
**Status: NOT VERIFIED.** No load/performance test suite exists yet. The new demo seed (3 schools, ~375 learners, ~5,400 attendance rows, ~3,800 assessment results) gives, for the first time, a realistic dataset to baseline against.

**Criteria to reach PASS:** a load test run against the seeded demo dataset with recorded p50/p95 query times for the heaviest pages (Reports, Attendance, Timetable) · no N+1 query patterns in the audited services · documented acceptable-load ceiling.

## GATE 10 — Commercial Ready
**Status: NOT STARTED.** Tenant provisioning is bare (`createSchool()` with no seeding wizard); no subscription/billing for the platform itself; no support console. This session's demo seed *is* a step toward this gate's "demo environment" criterion, but not the whole gate.

**Criteria to reach PASS:** onboarding wizard seeds a default academic structure for a new school · a documented (even if manual, initially) support/incident process exists.

## GATE 11 — Top-Tier Production Release
**Status: NOT REACHED — by a wide margin, honestly.** This is the terminal gate; it requires Gates 1–10 all at PASS, plus:

- [ ] No known P0/P1 defect anywhere in the product.
- [ ] Full regression suite (unit + RLS + e2e) green.
- [ ] A real, legally-reviewed POPIA position (Gate 8).
- [ ] A real payment provider live (Gate 6) if Finance's fee-collection promise is to be real, not theoretical.
- [ ] Documented SLA/incident-response process (Gate 10).

**This gate is realistically many sprints away.** See the Kanban's recommended sprint order for the path there.
