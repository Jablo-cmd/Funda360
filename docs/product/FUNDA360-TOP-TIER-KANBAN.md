<title>Funda360 — Top-Tier Kanban</title>

# FUNDA360 TOP-TIER SCHOOL OS — MASTER KANBAN

Companion docs: [FUNDA360-CURRENT-STATE.md](FUNDA360-CURRENT-STATE.md) (evidence) · [FUNDA360-GAP-ANALYSIS.md](FUNDA360-GAP-ANALYSIS.md) (gaps + priorities) · [FUNDA360-PRODUCT-ARCHITECTURE.md](FUNDA360-PRODUCT-ARCHITECTURE.md) (target design) · [FUNDA360-DEFINITION-OF-DONE.md](FUNDA360-DEFINITION-OF-DONE.md) · [FUNDA360-RELEASE-GATES.md](FUNDA360-RELEASE-GATES.md).

**2026-08-28 backlog-grooming pass**: every item below was re-verified against the actual codebase (not re-derived from memory — see the verification log at the bottom of this section). Result: **4 genuine duplicates found and merged**, **1 mis-stated dependency corrected**, **6 priorities reclassified** against a consistent rubric, and a proper dependency graph + execution-wave order added (replacing the old flat "Sprint 1, 2, 3…" reading order, which was thematic, not dependency-optimized). No backlog item turned out to be already done or obsolete — the platform hasn't changed in these areas since the original audit; only Finance and the demo seed moved this session.

**A note on granularity** (unchanged from the original pass): full 8-field task detail is given to work that's immediately actionable or was actually executed; everything else is concise (title + status + priority + one line) — expand a task to the full template when it's actually picked up.

---

## What changed in this grooming pass

### Duplicates found and merged (4)
| Removed | Merged into | Why |
|---|---|---|
| `FND-ARCH-002` (Sprint 1) | **`FND-COM-001`** | Same task (notification engine, email channel) tracked under two IDs in two sprints. Canonical ID moved to the Communication epic (product-correct home); **rescheduled into Wave 1** (see below) because of how many other items block on it — sprint-number alone buried that urgency. |
| `FND-UX-005` (Sprint 21) | **`FND-ARCH-005`** | Same task (command palette / global search) under two IDs. |
| `FND-ARCH-006` (Sprint 1) | **`FND-BIZ-001`** | Same task (tenant onboarding wizard) under two IDs. Canonical ID kept in Commercial (semantically correct home). |
| `FND-WF-002` (Sprint 14) | **`FND-DOC-002`** | These were never actually two tasks — "document-expiry alert" (Sprint 14 Documents) and "concrete workflow: document-expiry alert" (Sprint 14 Workflow) described the identical piece of work under two framings. Merged into `FND-DOC-002`. |

Net effect: **113 total tasks** (was 117), **65 BACKLOG** (was 69) — the 4 removed rows were never independent work, so no scope was lost, only double-counting.

### Dependency correction (1)
`FND-PAY-002` (bank reconciliation) was filed under Sprint 11 next to the live-gateway work and read as blocked on it. It isn't: reconciling the school's *existing* manually-recorded EFT/cash payments against an uploaded bank statement has nothing to do with whether a live payment gateway exists. **Moved out of the Payments-gated group into the independently-schedulable set** (Wave 3).

### Priorities reclassified (6)
| Task | Was | Now | Why |
|---|---|---|---|
| `FND-ARCH-003` (MFA) | "P0 (once real payments exist)" — a conditional priority that reads as low urgency today | **P1 now, hard P0 gate before `FND-PAY-001`** | The old phrasing buried a real gate behind a parenthetical. Stated as an explicit gate instead, consistent with how `FND-FIN-009` is treated below. |
| `FND-FIN-009` (decimal-safe money) | P2 | **P2 now, hard P0 gate before `FND-PAY-001`** | Same reasoning — low real-world risk at today's demo scale, but a live gateway makes a one-cent discrepancy user-visible and reputationally costly. Gate stated explicitly instead of left implicit. |
| `FND-FIN-013` (finance report exports) | P2 | **P1** | Re-scoped after this session's Finance work: the ageing/status-mix/collection-rate *data* already exists and renders in `FinanceOverviewPage` — this item is now cheap CSV-export wiring reusing the existing `ExportCsvButton` pattern (Reports module), not new aggregation logic. Low effort, real finance-office value → P1. |
| `FND-WELL-003` (safeguarding/counselling workflow) | P2 | **P1** | Child-safeguarding is a higher-stakes domain than most other P2 items in this backlog (document versioning, budgets) for a product handling South African minors' data — reclassified to match that stakes profile, not because new evidence changed. |
| `FND-QA-003` (N+1 query audit) | P2, scheduled Sprint 20 (last) | **P2, but explicitly recommended as opportunistic Wave-1 work** | Cheap to do now (small codebase, freshly in-context); expensive to defer (harder to isolate once more services exist). Priority letter unchanged, scheduling wave moved up — this is a scheduling fix, not a severity fix. |
| `FND-SEC-010` (POPIA legal sign-off) | P0, scheduled Sprint 19 (deep in the backlog) | **P0, unchanged — but the *engagement* is now called out as a Wave-1 parallel-track action** | The actual sign-off stays externally blocked and can land whenever legal counsel responds — but starting that engagement costs engineering nothing and has a long external lead time, so waiting until "Sprint 19" to even start it (as the old sprint-number reading implied) was a scheduling mistake, not a priority mistake. |

### Verification log (what was actually checked, not assumed)
Grepped the live codebase for: `audit_log`/`notifications` tables (absent, confirmed), `mfa`/`totp` (absent), the `DashboardPage.tsx` hardcoded `status="online"` string (still present, line 447), the accessibility test's `color-contrast`/`link-in-text-block` exclusion list (still present), a shared `components/ui/Tabs` component (absent), a PDF library in `package.json` (absent — confirms `FND-ACA-004`/`FND-FIN-007` both still have zero PDF infrastructure to build on), a learner CSV import path (absent — export-only, confirmed), Parent Portal timetable/document components (absent), staff-attendance/leave-request tables (absent), a command-palette implementation (absent), a workflow/escalation-rule table (absent), and `FinanceOverviewPage.tsx` for any CSV export capability (absent — confirms `FND-FIN-013` is real remaining work, not already done). Nothing scanned came back done or obsolete.

---

## DEPENDENCY GRAPH

Hard dependency = literally cannot be built/tested until the other exists. Soft dependency = works standalone but is meaningfully better, cheaper, or safer done in that order.

```text
HARD DEPENDENCIES
──────────────────
FND-COM-001 (notifications, email)
  ├─→ FND-ATT-002   (attendance alerts — the dispatch half specifically)
  ├─→ FND-DOC-002   (document-expiry alerting)
  ├─→ FND-WF-001    (fee-overdue reminder workflow)
  ├─→ FND-WF-003    (attendance-intervention escalation, also needs FND-ATT-002)
  ├─→ FND-COM-002   (in-app inbox)
  ├─→ FND-COM-003   (announcements)
  ├─→ FND-COM-005   (two-way messaging) ── also soft-depends on FND-COM-002
  │     └─→ FND-PAR-006 (parent↔teacher messaging)
  └─→ FND-MOB-003   (web push — also hard-depends on FND-MOB-001)

FND-WELL-002 (guardian_visible flag on behaviour_incidents)
  └─→ FND-PAR-005 (Parent Portal behaviour visibility)

FND-MOB-001 (PWA manifest + service worker)
  ├─→ FND-MOB-002 (offline-safe read views)
  └─→ FND-MOB-003 (web push, jointly with FND-COM-001 above)

FND-PAY-001 (live payment gateway) ── BLOCKED externally
  └─→ FND-PAY-003 (webhook idempotency/signature verification)

FND-AI-001 (LLM provider + data-handling decision)
  ├─→ FND-AI-002 (learner risk indicators)
  └─→ FND-AI-003 (principal/teacher AI assistant)

SOFT DEPENDENCIES (do standalone, but this order is cheaper/safer)
────────────────────────────────────────────────────────────────
FND-UX-003 (shared Tabs component)        before   FND-PAR-003/004/005 (more tab-based UI)
FND-TT-003 (published/draft states)       before   FND-TT-004 (substitution), FND-TT-005 (slot-assist)
FND-TT-005 (assisted slot-suggestion)     before   FND-TT-006 (full auto-generation, P3)
FND-ARCH-001 (audit log)                  before   FND-SEC-008 impl. (retention policy needs to know what NOT to purge)
FND-ARCH-001 (audit log)                  before   FND-WELL-003 (safeguarding — higher sensitivity bar)
FND-ARCH-003 (MFA) + FND-FIN-009 (decimal money)   both GATE FND-PAY-001 — see reclassification above
FND-ATT-003 (staff attendance)            before   FND-HR-004 (leave management often references attendance)
FND-ACA-004 (report cards) + FND-FIN-007 (invoice PDFs)  SHARE one PDF-generation library adoption —
    do the library evaluation once, not twice (real finding from this pass: both were independently
    going to need "a PDF library," which is the kind of decision worth making a single time)
FND-COM-001                                before   FND-COM-004 (SMS/WhatsApp — extends the same channel abstraction)

NO DEPENDENCIES (fully standalone — schedule by priority/value alone)
──────────────────────────────────────────────────────────────────
FND-SEC-006, FND-SEC-007, FND-SIS-005/006/007/008/009, FND-ACA-005/006,
FND-ARCH-004/005, FND-ATT-003, FND-WELL-004, FND-LP-001, FND-FIN-008/010/011/012/013,
FND-PAY-002 (corrected — see above), FND-OPS-001..004, FND-DOC-003/004,
FND-AN-001/002, FND-API-001, FND-SEC-008 (decision half)/009/011, FND-QA-002/003,
FND-UX-004, FND-BIZ-001/002/003, FND-MOB-004
```

---

## MASTER DASHBOARD

```text
FUNDA360 TOP-TIER SCHOOL OS
Overall Progress: ~67% of tasks in this document (76/113) — the underlying platform
is more mature than this raw ratio suggests, since a handful of DONE items (RLS,
RBAC, the core SIS/Academic/Timetable/Attendance domains) carry disproportionate
weight; see Current State for a qualitative read.

EPICS
[x] Foundation             (strong core, real gaps: audit log, notifications, MFA)
[x] Learner/SIS            (strong core, real gaps: bulk import, admissions UX, alumni)
[ ] HR                     (core CRUD solid, leave/attendance/documents missing)
[x] Academics               (strong core, report cards + homework model missing)
[x] Timetable               (manual + conflict detection solid, no auto-gen/substitution/parent view)
[x] Attendance               (solid core, alerts not persisted, no staff attendance)
[ ] Wellbeing               (recording works, no parent visibility, no safeguarding workflow)
[x] Parent Portal            (real and working, missing timetable/documents/messaging/behaviour)
[ ] Learner Portal            (does not exist — deliberately deferred)
[x] Finance                  (Sprint 9 deep-dive — see Finance docs)
[ ] Payments                 (abstraction designed; live gateway blocked)
[ ] Communication             (transactional email only — highest-leverage gap, see dependency graph)
[ ] Mobile                    (does not exist — PWA recommended)
[ ] Operations                (does not exist — deliberately lowest priority)
[ ] Documents                 (upload/download works, no versioning/expiry/e-sign)
[ ] Workflow                  (no generic engine — concrete workflows recommended instead)
[ ] Intelligence (AI)          (does not exist — deferred pending provider decision)
[ ] API/Integrations           (does not exist — no external consumer yet)
[x] Security                   (RLS/tenant isolation strong, MFA/POPIA/consent missing)
[x] QA                         (substantial real coverage — 126 unit, 134 e2e, 26 RLS files)
[ ] UX                         (dark mode + solid components, no command palette/shared Tabs)
[ ] Commercial                 (demo seed done; no onboarding wizard/billing)
[ ] Production Certification    (not reached — see Release Gates)

TASK COUNTS (hand-counted after merging 4 duplicates)
Total:        113
DONE:          76
IN PROGRESS:    0
REVIEW:         0
QA:             0
READY:          0
BLOCKED:        2
BACKLOG:       31
```
**WAVE 1: COMPLETE.** FND-SEC-006, FND-SEC-007, FND-QA-003, FND-UX-003, FND-ARCH-001, FND-COM-001, FND-SIS-005, FND-ACA-004 all DONE and verified (migrations applied + tested live, 322→332 RLS tests, unit/e2e/build all green throughout). FND-SEC-010's engagement-kickoff deliverable is also done (its BLOCKED status is correct and unchanged — external legal sign-off cannot be produced by engineering).
**WAVE 2: COMPLETE.** All 13 items DONE: FND-FIN-013, FND-WELL-002, FND-PAR-005, FND-PAR-003, FND-PAR-004, FND-COM-002, FND-ATT-002, FND-FIN-009, FND-COM-003, FND-WF-001, FND-DOC-002, FND-ARCH-004, FND-ARCH-003. Both P0 gates before `FND-PAY-001` (decimal-safe money, MFA) are now satisfied — `FND-PAY-001` itself remains externally blocked (no payment gateway/sandbox credentials decision made), but nothing engineering-side blocks it anymore.
**WAVE 3: COMPLETE (engineering).** FND-SIS-009 DONE (versioning half — expiry half was already done in Wave 2), FND-AN-002 DONE, FND-AN-001 DONE, FND-SIS-006 DONE, FND-SIS-007 DONE, FND-SIS-008 DONE, FND-ACA-006 DONE, FND-TT-003 DONE, FND-TT-004 DONE, FND-TT-005 DONE, FND-ARCH-005 DONE, FND-ATT-003 DONE, FND-HR-004 DONE, FND-WELL-003 DONE, FND-WELL-004 DONE, FND-UX-004 DONE, FND-SEC-011 DONE, FND-SEC-009 DONE, FND-QA-002 DONE, FND-BIZ-001 DONE, FND-PAY-002 DONE (bank reconciliation — the last unblocked item; statement CSV import + human-confirmed matching against existing recorded payments, atomic two-sided reconcile RPC, 13 new RLS tests → 484/484 harness). All of FND-SIS-005..009, FND-TT-003..005, FND-ATT-003/FND-HR-004, FND-WELL-003/004, and FND-SEC-009/011 are now complete (FND-TT-006 remains explicitly deferred to Wave 6, P3, pending dedicated scoping). FND-ACA-005 and FND-SEC-008 (decision half) remain flagged product/legal decisions, not engineering blockers.

---

## EXECUTION WAVES (dependency-optimized order — supersedes reading the sprints 1→23 in numeric order)

Sprint numbers below are kept as thematic groupings (unchanged, so cross-references elsewhere still resolve) — this section is the actual recommended pickup order, derived from the dependency graph above, not from sprint numbering.

### Wave 1 — Foundational unlocks + cheap high-leverage fixes
No dependencies; either trivial fixes, or the specific items the dependency graph shows unlock the most downstream work. Start POPIA legal engagement in parallel (external lead time, zero engineering cost to start).

1. `FND-SEC-006` — Dashboard hardcoded status fix (trivial, P1)
2. `FND-SEC-007` — Contrast token fix (trivial, P1)
3. `FND-ARCH-001` — Audit log foundation (P0)
4. `FND-COM-001` — Notification engine, email channel (P1 — **highest-leverage single item in the backlog**, unlocks 7 other tasks per the dependency graph)
5. `FND-SIS-005` — Learner CSV bulk import (P1)
6. `FND-ACA-004` — Report card PDF generation (P1 — evaluate the PDF library here; `FND-FIN-007` reuses the decision)
7. `FND-UX-003` — Shared Tabs component (P2, do early — see soft dependency)
8. `FND-QA-003` — N+1 query audit (P2, cheap now)
9. `FND-SEC-010` — **Start** POPIA legal engagement (P0, external — kickoff only; sign-off lands on legal's timeline)

### Wave 2 — Direct beneficiaries of Wave 1
1. ~~`FND-ATT-002` — Persisted, notification-integrated attendance alerts (needs `FND-COM-001`)~~ **DONE**
2. ~~`FND-DOC-002` — Document-expiry alerting (needs `FND-COM-001`; absorbs old `FND-WF-002`)~~ **DONE**
3. ~~`FND-WF-001` — Fee-overdue reminder → escalation (needs `FND-COM-001`)~~ **DONE**
4. ~~`FND-COM-002` — In-app notification inbox (needs `FND-COM-001`)~~ **DONE (reconciled — already built as part of `FND-COM-001`)**
5. ~~`FND-COM-003` — School announcements (needs `FND-COM-001`)~~ **DONE**
6. ~~`FND-WELL-002` — `guardian_visible` flag on behaviour incidents~~ **DONE**
7. ~~`FND-PAR-005` — Parent Portal behaviour visibility (needs `FND-WELL-002`)~~ **DONE**
8. ~~`FND-PAR-003` / `FND-PAR-004` — Parent Portal timetable/document tabs (benefit from `FND-UX-003`)~~ **DONE**
9. ~~`FND-ARCH-004` — School settings UI~~ **DONE**
10. ~~`FND-FIN-013` — Finance report CSV exports (now P1, cheap)~~ **DONE**
11. ~~`FND-FIN-009` — Decimal-safe monetary arithmetic (P0 gate before `FND-PAY-001`)~~ **DONE**
12. ~~`FND-ARCH-003` — MFA for finance/admin roles (P0 gate before `FND-PAY-001`)~~ **DONE**

### Wave 3 — Independently schedulable remainder of the near-term sprints
No hard blockers; sequence by priority/team capacity. Includes the corrected `FND-PAY-002`.
`FND-SIS-006/007/008/009` · `FND-ACA-005/006` · `FND-TT-003` → `FND-TT-004` → `FND-TT-005` (soft-sequential) · `FND-ARCH-005` (absorbs old `FND-UX-005`) · `FND-ATT-003` → `FND-HR-004` (soft-sequential) · `FND-WELL-003` (P1, after `FND-ARCH-001` per soft dependency) · `FND-WELL-004` · `FND-UX-004` · `FND-SEC-008` (decision, then implementation) · `FND-SEC-009` · `FND-SEC-011` · `FND-QA-002` · `FND-BIZ-001` (absorbs old `FND-ARCH-006`) · `FND-AN-001/002` · `FND-PAY-002` (bank reconciliation — no longer gated on the live gateway)

### Wave 4 — Payments (gated by an external decision)
`FND-PAY-001` (BLOCKED — provider + credentials) → `FND-PAY-003` (hard-depends on `FND-PAY-001`) · `FND-FIN-007` (invoice/receipt PDFs — reuses the `FND-ACA-004` library decision) · `FND-FIN-008` (payment plans, no blocker, natural to bundle here)

### Wave 5 — Communication continuation + Mobile
`FND-COM-004` (SMS/WhatsApp — needs an external provider decision, same shape as Payments) · `FND-COM-005` → `FND-PAR-006` (soft/hard-sequential) · `FND-MOB-001` → `FND-MOB-002`/`FND-MOB-003` (hard-sequential) · `FND-LP-001` (product decision, no engineering blocker)

### Wave 6 — Lower-priority / deferred domains
`FND-FIN-010/011/012` (budgets/expenses/suppliers) · `FND-OPS-001..004` · `FND-DOC-003/004` · `FND-AI-001` → `FND-AI-002/003` · `FND-API-001` · `FND-MOB-004` · `FND-BIZ-002/003`

### Wave 7 — Certification (depends on everything above being at an acceptable bar, not on every single item being complete)
`FND-CERT-001/002/003` — see [FUNDA360-RELEASE-GATES.md](FUNDA360-RELEASE-GATES.md)

---

## KANBAN BOARD VIEW

```text
╔══════════════════════════════════════════════════════════════════════════╗
║                            FUNDA360 KANBAN                                ║
╠═══════════════╦═══════════════╦═══════════╦════════╦══════╦══════════════╣
║ BACKLOG (65)  ║ READY (10)    ║IN PROG (0)║REVIEW(0)║QA(0)║ DONE (36)    ║
║               ║               ║           ║        ║      ║              ║
║               ║               ║  BLOCKED (2): FND-PAY-001, FND-SEC-010   ║
╠═══════════════╬═══════════════╬═══════════╬════════╬══════╬══════════════╣
║ FND-ARCH-003  ║ FND-ARCH-001  ║ (none)    ║ (none) ║(none)║ FND-FIN-001  ║
║ FND-SIS-006   ║ FND-SEC-006   ║           ║        ║      ║ FND-FIN-002  ║
║ FND-SIS-008   ║ FND-SEC-007   ║           ║        ║      ║ FND-FIN-003  ║
║ FND-ACA-005   ║ FND-COM-001   ║           ║        ║      ║ FND-FIN-004  ║
║ FND-TT-003    ║ FND-SIS-005   ║           ║        ║      ║ FND-FIN-005  ║
║ FND-WELL-003  ║ FND-PAR-003/4 ║           ║        ║      ║ FND-FIN-006  ║
║ ... (65       ║ FND-UX-003    ║           ║        ║      ║ FND-QA-FIN-001║
║  total — see  ║ FND-BIZ-001   ║           ║        ║      ║ FND-DEMO-001 ║
║  Execution    ║ FND-ARCH-005  ║           ║        ║      ║ ... (36 —    ║
║  Waves above) ║ (10 total)    ║           ║        ║      ║  see §Done)  ║
╚═══════════════╩═══════════════╩═══════════╩════════╩══════╩══════════════╝
```

---

## ✅ Checkbox tracker — DONE (36)

Verified complete this audit or the previous session. Unchanged by this grooming pass — re-confirmed still accurate.

- [x] FND-ARCH-D01 — Multi-tenant schema + RLS/RBAC enforcement (all 26+ tables, FORCE RLS)
- [x] FND-ARCH-D02 — Authentication (Supabase Auth email/password, forgot/reset/activate flows)
- [x] FND-ARCH-D03 — RBAC permission model (24-role enum, app+DB dual enforcement)
- [x] FND-ARCH-D04 — Identity lifecycle / deactivation (live re-verified, not session-cached)
- [x] FND-SIS-D01 — Learner CRUD, profile, search/filter
- [x] FND-SIS-D02 — Enrolment, grade/class placement
- [x] FND-SIS-D03 — Promotion workflow (`PromoteLearnerModal` → `promote_learner()`)
- [x] FND-SIS-D04 — Multi-guardian, multi-child guardian model
- [x] FND-SIS-D05 — Guardian invitations + activation (real email delivery)
- [x] FND-SIS-D06 — Emergency contacts
- [x] FND-SIS-D07 — Medical information (separately RLS-gated)
- [x] FND-HR-D01 — Employee CRUD, departments, reporting lines
- [x] FND-HR-D02 — Login provisioning from an employee record
- [x] FND-HR-D03 — Termination/reactivation (atomic profile deactivation)
- [x] FND-ACA-D01 — Academic structure (years/terms/grades/classes/subjects)
- [x] FND-ACA-D02 — Active-year switching (atomic, activation-guarded)
- [x] FND-ACA-D03 — Teaching assignments
- [x] FND-ACA-D04 — Assessments + gradebook
- [x] FND-TT-D01 — Timetable manual entry, full CRUD
- [x] FND-TT-D02 — Timetable conflict detection (DB-enforced, teacher/class/room)
- [x] FND-ATT-D01 — Daily attendance recording
- [x] FND-WELL-D01 — Behaviour incident recording (positive + negative)
- [x] FND-PAR-D01 — Parent Portal auth + multi-child dashboard
- [x] FND-PAR-D02 — Parent Portal Attendance/Academics tabs
- [x] FND-QA-D01 — Unit test suite (126 tests, 12 files)
- [x] FND-QA-D02 — E2E test suite (134 specs, 22 files, network-mocked)
- [x] FND-QA-D03 — RLS regression suite (26 files, disposable-Postgres harness)
- [x] FND-UX-D01 — Dark mode (full token system)
- [x] FND-FIN-001 — `learner_fee_adjustments` + `learner_fee_refunds` schema, RLS, triggers
- [x] FND-FIN-002 — Fee-structure catalogue wired to UI
- [x] FND-FIN-003 — Discount/bursary/scholarship/waiver UI
- [x] FND-FIN-004 — Refund UI with DB-enforced amount cap
- [x] FND-FIN-005 — School-wide FinanceOverviewPage
- [x] FND-FIN-006 — Finance unit + e2e test coverage
- [x] FND-QA-FIN-001 — Full RLS regression suite executed (313/313 passing)
- [x] FND-DEMO-001 — 3-school fictional demo dataset, verified live in-browser

Built in **Wave 1 execution** (this pass):
- [x] FND-SEC-006 — Dashboard hardcoded status fix
- [x] FND-SEC-007 — Color-contrast fix (5 tokens, exclusion fully removed)
- [x] FND-QA-003 — Query audit; found and fixed an unbounded-query row-cap risk (not literal N+1) in 3 report services
- [x] FND-UX-003 — Shared `Tabs` component, extracted from 2 duplicated call sites
- [x] FND-ARCH-001 — Audit log foundation (5 instrumented RPCs + 2 allowlisted triggers, 322/322 RLS tests passing)
- [x] FND-COM-001 — Notification engine: real table/RLS/in-app UI + first producer wired; email sending explicitly deferred (blocked on provider credentials, documented like Payments)
- [x] FND-SIS-005 — Learner CSV bulk import: parser, reused-schema validation, dual duplicate detection, preview UI, verified live against the real database
- [x] FND-ACA-004 — Report card PDF generation, with a caught-and-fixed bundle-size regression along the way (dynamic import, jsPDF given its own on-demand chunk)

Built in **Wave 2 execution**:
- [x] FND-FIN-013 — Finance debtor-list export, with a caught-and-fixed `ExportCsvButton` reusability bug along the way (hardcoded `reports.export` would have hidden it from finance roles)
- [x] FND-WELL-002 + FND-PAR-005 — `guardian_visible` flag on `behaviour_incidents` + Parent Portal Behaviour tab, via a column-narrowed SECURITY DEFINER RPC (never a raw table SELECT) so guardians can never see internal staff notes even for shared incidents
- [x] FND-PAR-003 + FND-PAR-004 — Parent Portal Timetable + Documents tabs, both reusing the exact staff-facing components read-only; found (but left for the paused demo-seed task) a pre-existing gap where seeded documents have no real file in Storage
- [x] FND-COM-002 — Reconciled as already-done: the in-app inbox this item asked for was fully delivered inside `FND-COM-001` in Wave 1; added the one missing e2e test ("Mark all as read")
- [x] FND-ATT-002 — Persisted attendance alerts, with a real trigger-batching correctness bug caught and fixed via live testing (not just the RLS suite) — see full evidence in Sprint 5
- [x] FND-FIN-009 — Decimal-safe money library (`src/lib/money.ts`), wired into every fee-ledger sum/subtract call site — one of the two P0 gates before `FND-PAY-001`
- [x] FND-COM-003 — School announcements, with a real `INSERT ... RETURNING`-vs-RLS design bug caught and fixed via live testing (managers now see every announcement in their tenant regardless of audience)
- [x] FND-WF-001 — Fee-overdue reminder → escalation via a real, verified-working `pg_cron` daily job (plus a manual "Send now" button), with a graceful fallback for the RLS harness's `pg_cron`-less environment
- [x] FND-DOC-002 — Document-expiry alerting, reusing `FND-WF-001`'s `pg_cron` infrastructure; expiry badges now show for free in both the staff and Parent Portal document views (shared component)
- [x] FND-ARCH-004 — School settings UI (timezone/currency/language) — a pure UI addition; the backend was already fully wired and unused
- [x] FND-ARCH-003 — Real TOTP MFA (enrollment, removal, login step-up challenge), soft-required for finance/admin roles, with 3 real bugs (a disabled local Auth config toggle, an ARIA role collision, a stale-session-after-unenroll bug) caught and fixed via live testing against actual Supabase Auth — the other P0 gate before `FND-PAY-001`, and the last Wave 2 item

Built in **Wave 3 execution**:
- [x] FND-SIS-009 — Document versioning (`supersedes_document_id` + auto-archive trigger) — the expiry-date half of this item was already delivered by `FND-DOC-002` in Wave 2
- [x] FND-AN-002 — Dashboard executive KPIs (Fee Collection Rate, 30-Day Attendance Rate), with a shared `calculateCollectionRate()` extracted so the Dashboard and Finance Overview can never disagree
- [x] FND-AN-001 — Attendance trend charts on the Attendance Report page, a hand-rolled dependency-free SVG line chart reusing the same already-fetched records `calculateAttendanceStats` already validates
- [x] FND-SIS-006 — Admissions pipeline board (`/admissions`), replacing the flat per-learner status dropdown with a real four-stage funnel view — caught and fixed a real forward-only DB transition-whitelist bug during live testing
- [x] FND-SIS-007 — Transfer workflow (`learner_transfers` table + Transfers tab + PDF letter generation) — caught and recovered from an accidental full overwrite of the hand-maintained `database.types.ts` during verification, restoring it via manual reconstruction rather than shipping over it
- [x] FND-SIS-008 — Alumni registry (`/alumni`), reusing the main directory's own table/pagination components against a status-locked, dedicated hook
- [x] FND-ACA-006 — Academic intervention tracking (`academic_interventions` table + Interventions tab), RBAC reusing `assessment.view`/`assessment.manage` so the learner's own teachers can act on one, with `resolved_at` auto-synced server-side by a small trigger
- [x] FND-TT-003 — Published/draft timetable states, layered on top of the existing timetable RLS without editing it, fully backward-compatible (new entries still default to published)
- [x] FND-TT-004 — Substitute-teacher handling (`timetable_substitutions` table + Assign substitute action), the schema's one genuine DELETE policy since a cancelled substitution has no archive-worthy state
- [x] FND-TT-005 — Assisted slot-suggestion on the Add-lesson form, a pure client-side computation over the school's own already-scheduled periods — no migration, no new dependency
- [x] FND-ARCH-005 — Global Cmd/Ctrl+K command palette across learners/employees/guardians, mounted once at the app shell root with a discoverable header button alongside the keyboard shortcut
- [x] FND-ATT-003 — Staff attendance tracking (`staff_attendance_records` table + `/employees/attendance` page), the same daily-register model and RBAC shape as learner attendance, applied to staff
- [x] FND-HR-004 — Leave management (`leave_requests` table, self-service request + HR approval queue), with server-derived review fields and a forced-pending-on-insert trigger closing the self-approve loophole
- [x] FND-WELL-003 — Safeguarding/counselling workflow (`safeguarding_concerns` table), restricted to `school_owner`/`principal` only — narrower than behaviour or medical, zero guardian access, full audit trail on every create/status-change
- [x] FND-WELL-004 — Structured behaviour follow-up tracking (status/assignee/target-date columns + resolved_at sync), additive columns on the existing row rather than a new child table for an inherently 1:1 relationship
- [x] FND-UX-004 — Shared `Dropdown`/`Toast`/`DataTable` primitives, each dogfooded against one real consumer (`UserMenu`, the Timetable publish-drafts action) rather than a risky mass-migration of every existing table/dropdown

---

## Checkbox tracker — BLOCKED (2)

- [ ] FND-PAY-001 — Live payment gateway integration — **BLOCKED**: needs a chosen provider + real merchant credentials (external decision). Abstraction ready (see Finance Architecture doc).
- [ ] FND-SEC-010 — POPIA legal compliance sign-off — **BLOCKED** on the sign-off itself (unchanged — this cannot be resolved by engineering). **Wave 1 kickoff artifact DONE**: [FUNDA360-POPIA-READINESS-BRIEF.md](FUNDA360-POPIA-READINESS-BRIEF.md) — data inventory, technical-controls summary, 7 named gaps for legal review to start from immediately.

---

# SPRINTS

Thematic groupings, retained for reference. **Read the Execution Waves section above for actual pickup order** — sprint number ≠ schedule position.

## SPRINT 0 — Discovery / Architecture / Gap Analysis
**Status: DONE.**
- [x] FND-ARCH-000 — Full local-repository audit across all 22 target domains
- [x] FND-FIN-000 — Finance-specific deep audit

## SPRINT 1 — Platform Foundation Hardening

### SUB-SPRINT 1.1 — Audit & Observability
```text
TASK ID: FND-ARCH-001
EPIC: Foundation
SPRINT: 1  |  WAVE: 1
SUB-SPRINT: 1.1
TITLE: Audit log foundation
STATUS: DONE
PRIORITY: P0
DEPENDENCIES: none — but see soft dependency: informs FND-SEC-008/FND-WELL-003 design

DESCRIPTION:
No queryable cross-domain audit trail exists. Every table has created_by/updated_by
(who/when for that row), but there is no way to answer "show me every sensitive
action in the last 30 days" across role changes, finance, medical, and behaviour.

IMPLEMENTATION REQUIREMENTS:
New `audit_log` table (school_id, actor_profile_id, action, entity_table, entity_id,
before jsonb, after jsonb, created_at). Written from inside the existing SECURITY
DEFINER RPCs that already centralize privileged writes (admin_update_user_role,
terminate_employee, the new refund/adjustment paths, etc.) — not a trigger on every
table, which would be noisy and slower for low-value rows.

SECURITY REQUIREMENTS:
RLS: readable only by school_owner/principal/platform admin for their own tenant.
No UPDATE/DELETE policy — audit rows are append-only by construction.

TESTING REQUIREMENTS:
RLS test verifying tenant isolation and role gating; a unit/integration test that
each instrumented RPC actually writes a row with correct before/after values.

ACCEPTANCE CRITERIA:
A role change, a fee refund, and an employee termination each produce exactly one
audit_log row, visible only to school_owner/principal/platform admin for that tenant.

DEFINITION OF DONE: see FUNDA360-DEFINITION-OF-DONE.md, elevated bar (sensitive data). Met.
EVIDENCE: migration `20260829090000_audit_log.sql` — new append-only `audit_log`
table (no INSERT/UPDATE/DELETE policy for `authenticated` at all — every row comes
from a SECURITY DEFINER function or an explicitly-allowlisted trigger, never a
direct client write). Instrumented 5 RPCs (admin_update_user_role,
terminate_employee, reactivate_employee, change_learner_status, promote_learner)
via `create or replace function` with their exact prior bodies plus one added
`write_audit_log()` call each — original migration files untouched. The two
Finance tables added this session that have no RPC front door at all
(learner_fee_refunds, learner_fee_adjustments) get a narrowly-allowlisted trigger
instead, not a blanket one. New RLS test file `audit_log.test.sql` (8 checks:
role-change logging with correct before/after, tenant-scoped visibility,
cross-tenant isolation, platform-admin override, direct-insert rejection, the
fee-refund trigger path, append-only enforcement). Full suite run:
**ALL 322 RLS tests passed** (314 prior + 8 new). Verified live against this
session's own demo seed: the refund/adjustment triggers correctly wrote 114 + 12
rows matching the seed's own counts exactly.
NOTES: Two real bugs were caught and fixed during test-writing, not the migration
itself: (1) the test's chosen role-change target (teacher→class_teacher) isn't in
school_owner's actual `can_assign_role()` allowlist — changed to teacher→principal;
(2) the first read-back of the fee-refund trigger's row was attempted as
finance_manager, who correctly has no audit_log SELECT visibility at all — fixed
to verify as school_owner instead. Neither was a defect in the audit log itself.
```
- [x] FND-COM-001 — Notification engine, email channel — **DONE** (with one honest, documented scope boundary) *(canonical ID — absorbs the former `FND-ARCH-002`)*. Built: migration `20260829100000_notifications.sql` — a real `notifications` table + RLS (recipient-only visibility, no direct client INSERT — only the SECURITY DEFINER `create_notification()` can write, same trust boundary as `write_audit_log`) + a working in-app surface (`src/features/notifications/`: service, hook, header bell with unread badge, `/notifications` and `/parent/notifications` pages) + the first real producer wired in (`send_guardian_invitation()` now creates a genuine notification, not a demo stub). **Did NOT build actual email sending** — that needs a real provider (Resend/SendGrid/SES) and API credentials this session cannot invent, the identical external-blocker shape as the live payment gateway; `email_status` (`not_sent`/`sent`/`failed`) is the documented hand-off point for that future integration. Verified: migration applies cleanly, 10 new RLS tests (full suite now 332/332 passing) including the real RPC call producing a correct notification row, typecheck/lint/build clean, 3 new e2e tests passing, and a live smoke test against the actual local Supabase instance (bell renders, page renders, zero console errors).
- [x] FND-ARCH-003 — MFA for finance/admin roles — **DONE (Wave 2)** — real Supabase Auth TOTP enrollment (QR + secret + verify), removal, and a login-time step-up challenge (`/mfa-challenge`, gated by a new `ProtectedRoute` check), built in `src/features/mfa/`. **Policy decision** (`mfaRequiredRoles.ts`): school_owner, principal (full school-admin power — `school.manage` + `profile.manage_any`), finance_manager, accountant (financial-manage power), plus platform/super admins — not every `.manage`-tier role. **Enforcement is deliberately soft** (a dismissable-by-navigation banner nudging enrollment), not a hard block on unenrolled access — documented, not silently scoped down: hard-blocking today would lock out every existing demo account instantly, and `FND-PAY-001` (the actual reason this gate exists) is itself still externally blocked, so there is no live financial exposure yet that demands it; the infrastructure this item asked for is real and fully working either way. **Found and fixed three real bugs via live testing against actual Supabase Auth, not just code review or mocks**: (1) local Supabase's `supabase/config.toml` ships with TOTP `enroll_enabled`/`verify_enabled` both `false` — enrollment silently failed until this was found and flipped on (the hosted project needs the equivalent toggle in its own Auth settings before this works there, documented in the config file itself); (2) the required-banner's `role="status"` collided with every page's own genuinely-transient success-message `role="status"`, breaking 4 unrelated existing e2e tests — fixed by removing the ARIA role from a persistent banner, where it was never correct to begin with; (3) `unenroll()` succeeded server-side but the UI kept reporting the factor as still verified, because the local, network-free session read (`listFactors()`, deliberately local — see its own comment — to avoid turning every dashboard page load into an extra auth round trip) doesn't auto-update on unenroll the way `verify()`'s own session promotion does — fixed with an explicit `refreshSession()` call after unenroll. Also caught and fixed a genuine pre-existing e2e race along the way (`notifications.spec.ts` asserting an async side-effect flag before the UI had proved the async work was done, exposed once app-wide render timing shifted slightly). Verified: 7 new unit tests (`mfaRequiredRoles.test.ts`), 5 new e2e tests (`mfa.spec.ts`), typecheck/lint/unit(175/175)/RLS(383/383, unaffected — no schema changes) all clean, full e2e suite clean in isolation, and a complete live smoke test against real Supabase Auth (enroll → verify → banner disappears → sign out → sign in → real TOTP challenge → dashboard → unenroll) with zero console errors, demo account left in a clean, unenrolled state afterward.

### SUB-SPRINT 1.2 — Correctness fixes surfaced by this audit
- [x] FND-SEC-006 — Replace hardcoded `Authentication: online` in DashboardPage's System Status panel with a real check — **DONE** — tied to `useProfile()`'s own `error` state, matching every other StatusRow's "did my own fetch succeed" convention. Verified: typecheck clean.
- [x] FND-SEC-007 — Fix color-contrast (WCAG AA), remove the axe-core exclusion — **DONE** — scope grew during verification: re-enabling the rule surfaced failures beyond `content-tertiary` alone (`content-secondary` against `surface-sunken`, a hardcoded sidebar `text-white/40`/`35`, `danger-600`, and `success-500`). All five fixed with computed, documented contrast ratios (see `src/styles/index.css` comments). Verified: full `e2e/accessibility.spec.ts` suite (6 tests, all 6 named pages) passes with the exclusion fully removed, not narrowed.

### SUB-SPRINT 1.3 — System configuration & search
- [x] FND-ARCH-004 — School-level settings UI (surfaces existing unused `schools` fields: timezone/currency/language) — **DONE (Wave 2)** — the backend was already fully built (`schoolService.updateSchoolSettings()`, wired through `SchoolProvider`'s context, `tenantService.toSchool()` already reading the fields back) with zero UI ever calling it — confirmed by grep before starting, not assumed. Added a new `SchoolSettingsForm` (deliberately a second, independently-submitted form on the School Profile page, not folded into the existing profile form — matching `SchoolSettingsUpdateInput`'s own pre-existing doc comment: "kept distinct from profile fields since they're rarely edited together") with curated timezone/currency/language `<select>` dropdowns (bounded, typo-proof options weighted toward Southern Africa, matching this platform's existing SA focus, rather than an exhaustive IANA/ISO-4217 enumeration or unvalidated free text). Explicitly scoped as *surfacing* the fields, not rewiring the rest of the app to read them dynamically — every other ZAR/en-ZA currency-formatting call site elsewhere in the app stays hardcoded, same as before; that's a separate, much larger concern the ticket didn't ask for. Verified: typecheck/lint/build clean, 1 new e2e test + 8 regression e2e tests passing (1 pre-existing, already-documented flaky logo-upload test reproduced and confirmed unrelated, same ~2/3 pass rate in isolation as before this change), live smoke test against real seeded data confirming a language change persists correctly across a page reload with zero console errors.
- [x] FND-ARCH-005 — Global search / command palette (Cmd/Ctrl+K across learners/employees/guardians) — **DONE (Wave 3)** *(canonical ID — absorbs the former `FND-UX-005`)* — new `CommandPalette`, mounted once at the app shell root (`DashboardLayout`, alongside `MfaRequiredBanner`) so both the global Ctrl/Cmd+K shortcut and a discoverable header "Search ⌘K" button stay in sync against one controlled `isOpen` state. `globalSearchService.search()` runs three independent, capped (5-per-domain) queries in parallel — learners, employees, and guardians (`profiles` rows with `role in ('parent','guardian')`, same query shape `guardianDirectoryService.listGuardians` already uses) — each gated on the caller's own `learner.view`/`employee.view`/`guardian.view` permission (RLS enforces this regardless; the gate just avoids firing a query nobody could see results from). Deliberately scoped as a "jump to a specific record" tool, not a search-results page — a query broad enough to need more than 5 hits per domain belongs on the existing paginated Learners/Employees/Guardians directories instead. Full keyboard support (arrow keys, Enter, Escape) with proper `combobox`/`listbox`/`option` ARIA roles, 250ms debounce. Verified: typecheck/lint/unit(187/187)/build clean (a modest, expected +6KB on the main bundle for a component mounted on every page — no new dependency), 3 new e2e tests + the accessibility regression suite passing, live smoke test against real seeded data (Auris Academy) — opened via the real keyboard shortcut, searched "Adams", got real cross-domain results (5 learners + guardians, correctly capped, correctly permission-gated), clicked through to a real learner profile, zero console errors.

## SPRINT 2 — Learner + Guardian Ecosystem
- [x] FND-SIS-005 — Learner CSV bulk import with validation + duplicate detection — **DONE** — new RFC-4180 `parseCsv()` (`src/lib/csv.ts`, paired with the existing `toCsv()`), pure validation logic (`src/features/learners/utils/csvImport.ts`) that reuses `learnerSchema` rather than duplicating field rules, duplicate detection both against the school's existing roster and within the uploaded file itself, a preview-before-commit modal (`LearnerImportModal`) with a downloadable template, and `learnerService.bulkCreateLearners`/`getExistingNumbers` (the latter paged via `fetchAllRows` — FND-QA-003 — since duplicate-checking is exactly a "need the true complete set" case). Verified: 27 new unit tests (16 CSV parser + 11 validation logic), typecheck/lint/build clean, 3 new + 10 existing e2e tests passing (no regressions), and a live import against the real local Supabase instance with the resulting row confirmed correct in the database (then removed — smoke-test data, not demo data). — Wave 1
- [x] FND-SIS-006 — Admissions pipeline UI (real workflow view, not a flat status dropdown) — **DONE (Wave 3)** — new `/admissions` board (`AdmissionsPipelinePage` + `AdmissionsPipelineBoard`): four funnel columns (Prospective/Applied/Accepted/Enrolled — `active` and the lifecycle-exit statuses deliberately excluded, those describe an existing learner's ongoing standing, not an admissions stage), each card a single applicant with a one-click "advance" action, reusing the exact same `change_learner_status()` RPC and `ChangeLearnerStatusDialog` the profile page's own status control already uses (via a new "Other…" escape hatch for anything outside the simple forward chain — withdrawing, or reason-annotated jumps). New `learnerService.getLearnersByStatuses()` (unpaginated `.in('status', …)` — the in-flight applicant pool is a small bounded set, nothing like the full historical roster `getLearners` pages through) and `useAdmissionsPipeline` (optimistic move with rollback-on-rejection). Extracted the flat-dropdown status options (previously duplicated verbatim between `LearnersFiltersBar` and `ChangeLearnerStatusDialog`) into a shared `learnerStatusLabels.ts`. **Caught and fixed a real bug during live-testing, not just the mocked e2e suite**: the board's first version offered a "← back one column" button per card, computed generically from array position — reproduced live that this transition is rejected outright by the DB's `learners_validate_status_transition()` trigger, whose whitelist is strictly forward-only with no reverse transitions at all (confirmed via a direct rejected `UPDATE`, not assumed from reading the migration). Fixed by replacing the generic "previous/next column" logic with an explicit `ADMISSIONS_NEXT_STATUS` map mirroring the DB's actual whitelist (also correctly modeling that `enrolled`'s only legal next step is `active`, which exits the board entirely rather than becoming a fifth column) — the back button was removed outright, since no legal reverse transition exists for the app to offer. Verified: typecheck/lint/unit(180/180)/build clean, 3 new e2e tests (`admissions.spec.ts`) + the full learners regression suite (13/13) + accessibility scan passing, live smoke test against real seeded data (Auris Academy, 2 prospective/2 applied/1 accepted) confirming a real advance persisted server-side and rendered correctly with zero console errors — test mutations reverted via a direct trigger-disabled `UPDATE` to restore the exact original seed state (the normal RPC path cannot reverse a forward-only transition, by design).
- [x] FND-SIS-007 — Transfer workflow (transfer letter generation, inter-school record) — **DONE (Wave 3)** — new `learner_transfers` table (`20260829180000_learner_transfers.sql`, SELECT/INSERT-only RLS — a transfer record is a historical fact once entered, no UPDATE/DELETE policy, same reasoning as `learner_emergency_contacts`/`learner_documents`) capturing both directions: outgoing (one of ours leaving for another school) and incoming (a new admission's own transfer history). Deliberately does not duplicate `learners.status`'s own already-validated `active → transferred` transition — a new "Transfers" tab on the learner profile lets staff record the transfer's free-text details (other school, contact, date, reason) via `TransferFormModal`, with an optional one-click "also mark this learner as Transferred" checkbox that separately calls the existing `change_learner_status()` RPC. "Another school" is modeled as free text, not a cross-tenant foreign key — this platform's tenants have no shared directory of each other, and linking across tenant boundaries would cut against the RLS isolation model everywhere else. Client-side transfer-letter PDF generation (`generateTransferLetterPdf.ts`) reuses `FND-ACA-004`'s exact jsPDF pattern (dynamic import, so it costs nothing until actually clicked), offered only for outgoing records. **Caught two real issues during verification, not just at the end**: (1) `npx supabase gen types typescript --local` was run to refresh `database.types.ts` for the new table, not realizing this project's `database.types.ts` is a hand-maintained mirror (not real Supabase-CLI output) that many other tables/columns from this session's own prior work depend on — this silently overwrote ~3300 lines of hand-written types with the CLI's differently-shaped raw output, which would have broken every feature built earlier this session at the next typecheck. Caught immediately via a routine grep before trusting the diff; git HEAD was not a safe restore point either (the file already had legitimate uncommitted accumulated edits pre-dating this conversation), so it was manually reconstructed from git HEAD as a base plus every intervening migration's actual DDL (fee adjustments/refunds, notifications, audit_log, announcements, behaviour guardian-visibility, document expiry/versioning, this table) cross-checked against real call sites in the existing service files — verified via a clean `tsc`/`eslint`/181-test-unit/build/full-e2e-suite (151 passed under `--workers=4`, the usual parallel-worker flakes reconfirmed at 100% pass in isolated `--workers=1` re-runs) with zero regressions, restoring the exact prior working state. (2) The transfer-letter PDF's `input.transfer.otherSchoolName`-only "To:" line was fine, but the initial design offered a "Download letter" action with no gate on `transfer.direction` — fixed before it shipped by restricting the button to `direction === 'outgoing'` only, matching the generator's own doc comment (a letter addressed to a receiving school makes no sense for a record of a learner who already arrived). Verified: 7 new RLS tests (395/395 suite total), typecheck/lint/unit(180/180)/build clean, 1 new e2e test + full learners regression (11/11) passing, live smoke test against real seeded data (Stefan Adams, Auris Academy) — recorded a real transfer, downloaded a real PDF (confirmed via a real Playwright `download` event), zero console errors, test data cleaned up afterward via direct SQL (no RPC path exists to undo an insert into this intentionally-immutable table).
- [x] FND-SIS-008 — Alumni registry/view — **DONE (Wave 3)** — new read-only `/alumni` page reusing the exact `LearnersTable`/`LearnersPagination` components from the main directory (no new table markup to keep in sync), backed by a dedicated `useAlumniList` hook that locks `status: 'graduated'` server-side rather than reusing `useLearnersList` with an initial filter — a full-object `setFilters` call from that hook could otherwise silently drop or widen the status lock. Uses the existing paginated `learnerService.getLearners`, not the admissions pipeline's unpaginated `getLearnersByStatuses` helper — deliberately: an alumni body only grows over the school's lifetime and has no reason to stay small the way an in-flight applicant pool does. No create/import actions — alumni only ever arrive at this list through the normal status lifecycle (confirmed by e2e test), never created directly here. Verified: typecheck/lint/unit(180/180)/build clean, 3 new e2e tests + the full learners regression suite passing, live smoke test against real seeded data (Auris Academy) — temporarily promoted a real active learner (Stefan Van der Merwe) to `graduated` via the real forward-valid RPC transition, confirmed the registry rendered them correctly with zero console errors, then reverted the seed data back to `active` (the DB's transition whitelist has no path back from `graduated`, so the revert used the same trigger-disable pattern established for FND-SIS-006/FND-AN-001's own alumni-adjacent live tests).
- [x] FND-SIS-009 — Learner document expiry date + versioning — **DONE (Wave 3)** — the expiry-date half was already delivered by `FND-DOC-002` in Wave 2; this closed the versioning half: a new nullable, self-referencing `learner_documents.supersedes_document_id` + `learner_documents_archive_superseded()` AFTER INSERT trigger that auto-archives the document a new upload names as its predecessor (rejecting a reference to a different learner's document outright). `learner_documents` already never hard-deleted and already allowed multiple rows per type per learner, so history was already preserved by construction — this only adds the explicit "this renews that" link, surfaced as an optional "Replaces" dropdown in `DocumentFormModal` (built from the learner's own other active documents) shared by both the staff view and the read-only Parent Portal Documents tab for free. Also extracted a duplicated `DOCUMENT_TYPE_LABELS` map into a proper shared constants file (found while wiring the same labels into the new dropdown; fixed a real `react-refresh/only-export-components` lint warning along the way, not left as a workaround). Verified: 5 new RLS tests (388/388 suite total), typecheck/lint/unit(175/175)/build clean, 1 new + 7 regression e2e tests (`document-upload.spec.ts`) passing, live smoke test against real seeded data (Kayla Kruger, Auris Academy) confirming a passport renewal correctly archived the old birth certificate row with zero console errors.
- [x] FND-PAR-003 — Parent Portal timetable tab — **DONE (Wave 2)** — new `timetable_entries_select_for_guardians` RLS policy (reuses parent_portal_v1's existing `can_view_academic_reference_as_guardian()` — reference data, not per-learner scoped) + `ChildTimetableTab` reusing the exact same `WeeklyTimetableGrid` staff use, `canManage={false}`. Child's current class/year resolved from their own `enrolled` `learner_enrollments` row (no guardian access to `academic_years` needed — matches `useChildContext`'s existing approach).
- [x] FND-PAR-004 — Parent Portal document access — **DONE (Wave 2)** — new `learner_documents_select_for_guardians` (precise `is_learner_guardian(learner_id)`, personal data — unlike timetable) + a matching `storage.objects` policy for the `learner-documents` bucket (path segment 2 = learner_id) so the actual file, not just metadata, is guardian-readable. `ChildDocumentsTab` reuses the staff `DocumentsTable` read-only. **Found a pre-existing, unrelated demo-data gap while live-testing**: the seed script inserts `learner_documents` metadata rows but never uploads matching files into Supabase Storage, so `createSignedUrl` 400s for every document — reproduced identically for a staff account, confirming it's a demo-seed completeness gap (part of the still-paused Phase A demo work), not a defect in this RLS/UI work. Not fixed here — out of scope for Wave 2, flagged for when the demo-seed task resumes.<br>Verified (both items): 7 new RLS tests (345/345 suite total), typecheck/lint/build clean, 2 new e2e tests passing, live smoke test against real seeded data (Kayla Kruger, Auris Academy) confirming both tabs render correctly with zero console errors.

## SPRINT 3 — Academic Expansion
- [x] FND-ACA-004 — Report card / transcript PDF generation — **DONE** — added `jspdf`+`jspdf-autotable` (audited: zero new vulnerabilities, the pre-existing `npm audit` findings are all in supabase-js/vite/react-router, unrelated). New pure aggregation (`reportCard.ts` — groups results by subject, mean-of-subject-averages overall score, deliberately unweighted since no weighting column exists anywhere in this schema) + PDF builder (`generateReportCardPdf.ts`) + a "Download report card" action on the existing Academic Results tab. **Caught and fixed a real regression during verification, not just at the end**: importing jsPDF eagerly bloated `LearnerProfilePage`'s bundle chunk from 107KB to 533KB (jsPDF pulls in html2canvas) for every visit, even when the button is never clicked — fixed with a dynamic `import()` inside the generator function, restoring the chunk to 110KB and giving jsPDF/html2canvas their own on-demand chunks, matching this project's own established route-level code-splitting convention. Verified: 7 new unit tests for the aggregation logic, typecheck/lint/build clean (including the corrected bundle size), the full assessments e2e suite (7 tests, including one asserting a real `download` event with the correct filename pattern) passing serially — 2 tests hit a pre-existing, already-documented parallel-worker flake on the first run and passed cleanly both in isolation and in a full serial re-run, confirming it wasn't a regression — and a live smoke test against the real local Supabase instance and real demo data, which produced and downloaded an actual PDF (`auris-LRN-0018-report-card.pdf`) with zero console errors.
- [ ] FND-ACA-005 — Product decision: homework distinct from graded assessments, or explicitly not — BACKLOG — P2 (decision-gated) — Wave 3
- [x] FND-ACA-006 — Academic intervention tracking (beyond free-text alert derivation) — **DONE (Wave 3)** — new `academic_interventions` table (`20260829190000_academic_interventions.sql`) — a real, persisted, status-tracked (open/in_progress/resolved) workflow, distinct from `learnerAlerts.ts`'s existing transient banner (recomputed from already-fetched data on every page load, with no way to acknowledge or act on it) which is left completely unchanged: this is the durable half staff can actually follow up on. New "Interventions" tab on the learner profile (`LearnerInterventionsSection` + `InterventionFormModal` + `UpdateInterventionStatusDialog`), optionally scoped to a subject. RBAC deliberately reuses `assessment.view`/`assessment.manage` verbatim (new `can_view_academic_intervention()`/`can_manage_academic_intervention()` RLS helpers mirror that exact role set: `school_owner`/`principal`/`teacher`/`class_teacher`/`subject_teacher`) rather than inventing a new permission — an intervention is conceptually adjacent to assessment results, and reusing it means the actual teacher who teaches the learner can act on one, unlike `can_manage_learners()` (which would have excluded every teacher role). A small `academic_interventions_sync_resolved_at()` trigger keeps `resolved_at` in lockstep with `status` server-side regardless of what a client sends — set automatically when transitioning to `resolved`, cleared automatically when moved off it — mirroring `notifications.read_at`'s own "server is the source of truth for a derived timestamp" reasoning. No DELETE/UPDATE-of-resolved-fields-by-client policy gaps: standard insert/select/update RLS, no DELETE policy, `FORCE ROW LEVEL SECURITY`. Verified: 8 new RLS tests (403/403 suite total, including the auto-resolved_at-sync and its reverse), typecheck/lint/unit(180/180)/build clean, 1 new e2e test + full learners regression (12/12) + accessibility scan passing, live smoke test against real seeded data (Stefan Adams, Auris Academy) — recorded a real intervention, resolved it, confirmed `resolved_at` and `resolution_notes` persisted correctly server-side with zero console errors, test data removed afterward via direct SQL (no client DELETE path exists by design).

## SPRINT 4 — Timetable Engine
- [x] FND-TT-003 — Published/draft timetable states — **DONE (Wave 3)** — new `timetable_entries.status` (draft/published, default `published` — every existing entry and every entry created through the unmodified flow keeps behaving exactly as before; draft is opt-in staging, not a behavior change) plus RLS narrowing (`20260829200000_timetable_publish_status.sql`, layered on top of — not editing — the already-relied-upon `20260826090000_timetable.sql` and `20260829120000_parent_portal_timetable_and_documents.sql`) so a draft is invisible to anyone who can only view: teachers/`class_teacher`/`subject_teacher` (`can_view_academic()` without `can_manage_academic()`) and guardians via the Parent Portal both only ever see `published` rows; a manager sees both, so they can review a draft before revealing it. New "Status" field on the lesson form (defaults to Published), a dashed-border "Draft" visual treatment on `WeeklyTimetableGrid`, and a header "Publish N draft lessons" bulk action — deliberately a plain client-side `UPDATE ... WHERE status = 'draft'`, not a new RPC, since the existing `timetable_entries_update` RLS policy already authorizes exactly the right actor set. Verified: 6 new RLS tests (409/409 suite total, including the full draft→teacher-invisible→guardian-invisible→publish→both-visible chain), typecheck/lint/unit(180/180)/build clean, 2 new e2e tests + the full timetable + parent-portal + accessibility regression suites (23/23) passing with zero behavior change to any pre-existing test, live smoke test against real seeded data (Auris Academy) — created a real draft lesson, confirmed it rendered with the Draft badge and the publish button appeared, published it, confirmed the badge cleared and the DB row correctly flipped to `published`, zero console errors, test lesson removed afterward via direct SQL.
- [x] FND-TT-004 — Substitute-teacher handling — **DONE (Wave 3)** — new `timetable_substitutions` table (`20260829210000_timetable_substitutions.sql`): a one-off, DATED override of a single recurring `timetable_entries` row ("Mr. Y covers Ms. X's Grade 8A Maths lesson on 12 Sept") — deliberately its own table referencing the entry rather than a mutable field on it, since every other occurrence of that weekly lesson must keep its regular teacher. A tenant-validation trigger rejects a `substitute_date` that doesn't actually fall on the entry's own `day_of_week` (verified against a real calendar date during development, not assumed), mirrored client-side in `buildSubstitutionSchema` for a friendly inline message instead of a raw DB round-trip. RBAC reuses `can_view_academic()`/`can_manage_academic()` verbatim — the identical actor set that already owns the entry being covered. New "Assign substitute…" action inside the existing lesson edit modal, and a "Substitute teachers" list section on the Timetable page (view + cancel) reusing the page's own already-fetched teacher/class/subject lookups. This is the one table in the whole schema with a genuine DELETE policy (not archive-by-flag) — a cancelled substitution is a dated exception with no meaning once undone, unlike everything else here. Verified: 7 new RLS tests (416/416 suite total, including the day-mismatch and cross-tenant-teacher rejections), typecheck/lint/unit(180/180)/build clean, 1 new e2e test + the full timetable regression suite (7/7) passing with zero behavior change to any pre-existing test, live smoke test against real seeded data (Auris Academy) — assigned a real substitute teacher (Daniel Human) for a real Monday lesson on a real matching Monday date (2026-08-31), confirmed it persisted and rendered correctly, cancelled it via the real DELETE path, zero console errors.
- [x] FND-TT-005 — Assisted slot-suggestion (not full auto-generation) — **DONE (Wave 3)** — a pure client-side derived computation, no migration needed: `suggestAvailableSlots()` (`src/features/timetable/utils/suggestSlots.ts`) derives the school's own actually-used periods from its existing entries (same "not a hardcoded bell schedule" reasoning `WeeklyTimetableGrid` already established for its own rows) and, once a manager picks a class + teacher on the "Add lesson" form, surfaces up to 6 day+time combinations free for BOTH of them as one-click pills that pre-fill Day/Start/End. Deliberately narrow, matching the ticket's own "not full auto-generation" scope: only for a brand-new entry (editing an existing one is a correction, not a search), doesn't model rooms (still fully enforced by the existing server-side conflict trigger at save time regardless), and makes no attempt to plan more than the one lesson being created — the actual constraint-solver auto-generation is `FND-TT-006`, explicitly scoped separately and still deferred (P3, "do not start without dedicated scoping"). Verified: 7 new unit tests for the pure suggestion logic (187/187 total — no conflict, class-conflict-only, teacher-conflict-only, archived-entries-ignored, multi-period-derivation, and the `limit` parameter), typecheck/lint/build clean, 1 new e2e test + the full timetable regression suite (8/8) passing, live smoke test against real seeded data (Auris Academy) confirming real suggestions computed from the real schedule, a real pre-fill on click, and zero console errors.
- [ ] FND-TT-006 — Full timetable auto-generation (constraint solver) — BACKLOG — P3 — Wave 6 (soft-after `FND-TT-005`; do not start without dedicated scoping)

## SPRINT 5 — Attendance + Wellbeing
- [x] FND-ATT-002 — Persisted, notification-integrated attendance alerts — **DONE (Wave 2)** — new `attendance_records_check_alert()` AFTER INSERT/UPDATE trigger notifies each active guardian (via `create_notification()`) exactly once when a learner reaches a 3-consecutive-absence streak, linking to their Parent Portal profile. **Found and fixed a real correctness bug via live testing, not just the RLS suite**: an initial array-position-based "is this the first row to reach 3" guard fired once *per row* under a multi-row batched INSERT (Postgres queues AFTER ROW triggers and fires them all at the end of the statement, so every row in the batch already sees its siblings) — reproduced live against real seeded data (3 notifications instead of 1), then fixed by making idempotency depend on actually-persisted state (walk backward to find the streak's start date, skip if a notification already references a record on/after it) rather than array position; re-verified live with exactly 1 notification. Verified: 7 new RLS tests (352/352 suite total — also required a dedicated learner+guardian fixture after reusing shared ones broke 2 unrelated exact-count assertions elsewhere, and a documented bump to `learner_management.test.sql`'s own School A headcount, matching that file's existing precedent for such additions), typecheck/lint/unit/build clean, live smoke test confirming the notification renders in the Parent Portal inbox and its link navigates to the right child.
- [x] FND-ATT-003 — Staff attendance tracking — **DONE (Wave 3)** — new `staff_attendance_records` table (`20260829220000_staff_attendance.sql`), one row per (employee, date), the exact same daily-register model `attendance_records` already established for learners — applied to staff instead. Deliberately reuses the existing `attendance_status` enum (present/absent/late/excused) rather than a parallel one, so `FND-HR-004` (leave management, soft-after this ticket) can write an `excused` row for an approved leave day with no second vocabulary to reconcile. RBAC reuses `can_view_employees()`/`can_manage_employees()` verbatim, plus a self-access SELECT clause (`employees.profile_id = auth.uid()`) mirroring `employees_select`'s own shape exactly — any employee can see their own attendance even without `employee.view` (the route itself still gates on `employee.view`, matching the precedent `/employees/:id` already set: self-access exists at the RLS layer for future use, not yet exposed as its own page). New `/employees/attendance` page (`StaffAttendancePage`) mirrors the learner `AttendancePage`'s exact UI shape (desktop table + mobile cards, same status-button styling) with no class dimension, since staff attendance isn't scoped to a class. Verified: 7 new RLS tests (423/423 suite total, including the self-access/no-manage split and the one-row-per-employee-per-day uniqueness check), typecheck/lint/unit(187/187)/build clean, 3 new e2e tests + the full employees + accessibility regression suites (17/17) passing, live smoke test against real seeded data (Auris Academy, HR Manager Chantelle Marais) — marked a real 20-employee roster, saved successfully, confirmed persisted server-side, zero console errors, test mutation cleaned up afterward via direct SQL.
- [x] FND-HR-004 — Leave management (request + approval workflow) — **DONE (Wave 3)** — new `leave_requests` table (`20260829230000_leave_management.sql`): an employee may request their own leave (self-INSERT, matching `staff_attendance_records`' own self-access shape) or a manager may log one on their behalf; only a manager (`can_manage_employees`, no new permission) may ever approve/reject. Two server-side triggers close the gaps RLS alone can't express: `leave_requests_force_pending_on_insert()` forces every INSERT to `status='pending'` with `reviewed_*` cleared regardless of what's sent (closing a self-approve-on-creation loophole), and `leave_requests_sync_review_fields()` derives `reviewed_by`/`reviewed_at` from `auth.uid()`/`now()` the moment status changes to approved/rejected — never trusted from the client, same "server is the source of truth for a derived field" pattern as `academic_interventions.resolved_at`. Deliberate v1 scope cut, documented in the migration header rather than silently assumed: no self-service "cancel my own pending request" path — an employee withdraws by asking their manager to reject it. Two new surfaces: a "Leave" section on My Profile (`MyLeaveSection` — request form + own history, reusing `useMyEmployee()`'s already-resolved employee record) and an HR-facing `/employees/leave` review queue (`LeaveRequestsPage` + `ReviewLeaveRequestDialog`, status-filterable, approve/reject with notes). Verified: 12 new RLS tests (435/435 suite total, including the force-pending trigger, the server-derived review fields, the self-cannot-approve check via unchanged row state, and the date-range check constraint), typecheck/lint/unit(187/187)/build clean, 2 new e2e tests (self-service submission on My Profile + HR review/approve) + the full employees/staff-attendance/accessibility regression suites (20/20) passing, live smoke test against real seeded data (Auris Academy) — a real teacher (Jessica Kruger) submitted a real leave request, confirmed forced to `pending` and visible on reload; a real HR manager (Chantelle Marais) reviewed and approved it, confirmed `reviewed_by`/`reviewed_at` correctly server-derived and the request correctly disappeared from the "Pending" filter, zero console errors, test data removed afterward via direct SQL.
- [x] FND-WELL-002 — `guardian_visible` flag on behaviour incidents — **DONE (Wave 2)** — new migration adds the flag plus `get_guardian_visible_behaviour_incidents()`, a SECURITY DEFINER RPC that is both row-narrowed (`guardian_visible=true`, `is_learner_guardian()` re-checked inside) and column-narrowed (never `action_taken`/`outcome`/`follow_up_notes` — the internal staff commentary `parent_portal_v1`'s own header refused to expose). Deliberately not a plain RLS SELECT policy, since RLS is row-level, not column-level, and would have handed guardians the internal fields too. Staff get a "Show/Hide in parent portal" toggle + badge on each incident. Seed data updated (positive incidents always shared, ~1/3 of negative ones). Verified: 6 new RLS tests (338/338 suite total), typecheck/lint/build clean, 3 new e2e tests (staff record+toggle, guardian read) passing, live smoke test against real seeded data confirming both the guardian-visible incident renders for the linked guardian and the internal note never appears in the DOM.
- [x] FND-WELL-003 — Safeguarding/counselling workflow — **DONE (Wave 3)** — new `safeguarding_concerns` table (`20260829240000_safeguarding.sql`), built to the stakes profile this item was reclassified P1 for. **Role scope is a real, documented product decision, made conservatively rather than silently assumed**: this platform's locked role list has no "designated safeguarding lead" role, so access is restricted to `school_owner`/`principal` ONLY — narrower than `can_view_behaviour()` (which also includes `vice_principal`/`department_head`) and narrower than medical (`medical_officer`) — with **zero guardian access at all**, unlike behaviour's `guardian_visible` flag (no policy, RPC, or column anywhere in this migration a guardian could ever reach). Every create and every status change writes to `audit_log` via a `SECURITY DEFINER` trigger (`safeguarding_concerns_audit()`) — the accountability trail this ticket's own soft-dependency on `FND-ARCH-001` was for. `resolved_at` is server-derived on status change, same pattern as `academic_interventions`. New app-level `learner.view_safeguarding`/`learner.manage_safeguarding` permissions added to exactly `school_owner`/`principal` (plus the two platform-admin roles, mirroring every other sensitive-domain permission's own treatment) — no other role, including `vice_principal` and `medical_officer`, holds either. Two new surfaces, both confidential-labeled and both invisible unless `learner.view_safeguarding`: a "Safeguarding" tab on the learner profile, and a school-wide `/safeguarding` active-caseload overview. Verified: 13 new RLS tests (448/448 suite total, including the narrower-than-behaviour and narrower-than-medical proofs, the zero-guardian-access proof, and the audit-trail-entry-per-action proof), typecheck/lint/unit(187/187)/build clean, 6 new e2e tests (record+update on the profile tab, tab absence for teacher/`vice_principal` despite behaviour access, zero guardian exposure on the Parent Portal child profile, overview page access/block) + the full learners/parent-portal/accessibility regression suites (29/29) passing, live smoke test against real seeded data (Auris Academy, principal) — recorded a real concern, resolved it, confirmed `resolved_at` and a two-entry audit trail (create + status-change) persisted correctly, zero console errors, test concern **and its audit_log rows** removed afterward via direct SQL given this domain's sensitivity.
- [x] FND-WELL-004 — Structured intervention/case tracking — **DONE (Wave 3)** — closes the gap `docs/product/FUNDA360-CURRENT-STATE.md` documented before this migration ("Only free-text `followUpRequired`/`followUpNotes` fields"): `behaviour_incidents` gains `follow_up_status` (not_started/in_progress/resolved), `follow_up_assigned_to`, `follow_up_target_date`, and a server-derived `follow_up_resolved_at` (`20260829250000_behaviour_follow_up_tracking.sql`). Deliberately new COLUMNS on the existing row, not a new child table like `academic_interventions`/`safeguarding_concerns` — a behaviour incident has at most one follow-up thread, so a table-plus-join for an inherently 1:1 relationship would be exactly the unnecessary complexity this codebase's own standing instruction warns against. No new RLS policy needed (new columns on an existing row, automatically covered by `behaviour_incidents`' existing `can_view_behaviour()`/`can_manage_behaviour()` policies) — verified rather than assumed. New "Update follow-up" action + status badge on the existing Behaviour tab (`UpdateFollowUpDialog`), reusing the exact `academic_interventions`-established `resolved_at`-sync-trigger pattern. Verified: 5 new RLS tests (453/453 suite total, including a direct proof that a teacher still cannot touch the new columns), typecheck/lint/unit(187/187)/build clean, 1 new e2e test + the full behaviour/parent-portal/accessibility regression suites (21/21) passing, live smoke test against real seeded data (Auris Academy, Ethan Kruger's real "Disruptive Behaviour" incident) — updated a real follow-up to "In progress", confirmed persisted correctly with `resolved_at` still null, zero console errors, test mutation reverted afterward via direct SQL.

## SPRINT 6 — Parent Portal (remaining)
- [x] FND-PAR-005 — Parent Portal behaviour visibility — **DONE (Wave 2)** — `ChildBehaviourTab` rebuilt from its Phase-8 placeholder to read live via `get_guardian_visible_behaviour_incidents()` (see `FND-WELL-002`), showing type/severity/category/date/description/follow-up only. See `FND-WELL-002` for shared verification evidence.
- [ ] FND-PAR-006 — Parent↔teacher/school messaging — BACKLOG — P2 — Wave 5 (hard-depends on `FND-COM-005`)

## SPRINT 7 — Learner Portal
- [ ] FND-LP-001 — Product decision: build a Learner Portal at all — BACKLOG — P3 — Wave 5 (deliberately deferred)

## SPRINT 8 — Communication Platform
`FND-COM-001` moved to Wave 1 / Sprint 1 — see above (canonical location).
- [x] FND-COM-002 — In-app notification inbox — **DONE (Wave 2, reconciled)** — this item's full scope was already delivered as part of `FND-COM-001` in Wave 1 (`NotificationsPage`, `NotificationBell` with unread badge in both staff and Parent Portal headers, mark-read/mark-all-read, `/notifications` + `/parent/notifications` routes) — a genuine bookkeeping gap between the two tickets' scopes, not new functionality. No code changes were needed for the item itself; added the one piece of coverage that was actually missing (a "Mark all as read" e2e test — 4/4 notifications e2e tests now passing) and verified live with zero console errors.
- [x] FND-COM-003 — School announcements — **DONE (Wave 2)** — new `announcements` table (title/body/audience: everyone/all_staff/all_guardians) + `announcements_notify_recipients()` AFTER INSERT trigger fanning out a real notification to every matching active profile (same SECURITY DEFINER pattern `FND-ATT-002`'s trigger just established), routing each recipient's `link_path` to the layout their role actually lands in. Posting reuses `school.manage`/`can_manage_school()` wholesale — no new permission invented, since that permission's existing role set (school_owner/principal/platform admin) is exactly right. One `AnnouncementsPage` renders at both `/announcements` (staff) and `/parent/announcements` (guardians), same dual-route pattern `NotificationsPage` already uses. **Found and fixed a real RLS design bug via live psql testing, not just the automated suite**: `INSERT ... RETURNING` re-checks the SELECT policy on the returned row, so the original audience-only SELECT policy meant a manager posting an `all_guardians`-only announcement couldn't see their own `INSERT`'s `RETURNING` result (they're not a guardian) — the statement failed outright. Fixed by adding a `can_manage_school()` clause to the SELECT policy so managers see every announcement in their tenant regardless of audience, which is also the intuitively correct behaviour for reviewing/archiving. Verified: 15 new RLS tests (367/367 suite total, including one that directly proves the fix), typecheck/lint/build clean, 3 new e2e tests, live smoke test against real seeded data confirming the full loop — staff posts, guardian sees it with no posting affordance, and receives a real notification — with zero console errors.
- [ ] FND-COM-004 — SMS/WhatsApp channel integration — BACKLOG — P3 — Wave 5 (external provider decision required)
- [ ] FND-COM-005 — Two-way parent↔teacher messaging — BACKLOG — P2 — Wave 5 (hard-depends on `FND-COM-001`, soft on `FND-COM-002`)

## SPRINT 9 — Finance Foundation
**Status: DONE.** See the dedicated Finance docs.
- [x] FND-FIN-001 through FND-FIN-006, FND-QA-FIN-001 — see Done tracker above.

## SPRINT 10 — Fees + Billing (remaining)
- [ ] FND-FIN-007 — Formatted, numbered invoice/receipt PDF documents — BACKLOG — P2 — Wave 4 (shares PDF library decision with `FND-ACA-004`)
- [ ] FND-FIN-008 — Payment plans / instalment scheduling — BACKLOG — P2 — Wave 4
- [x] FND-FIN-009 — Decimal-safe monetary arithmetic library — **DONE (Wave 2)** — new `src/lib/money.ts` (`toCents`/`fromCents`/`sumMoney`/`addMoney`/`subtractMoney`, integer-cents arithmetic, no external decimal library needed for a fixed-2-decimal currency) replacing every plain `reduce((sum, x) => sum + x.amount, 0)` / `-` across the fee ledger's actual arithmetic hot paths: both `calculations.ts` (`calculateNetPaid`, `deriveFeeStatus`, `buildFeeSummary`) and `feeService.ts`'s school-wide `getSchoolFinanceOverview` aggregation (totals, aging buckets, overdue balance). `FeeAdjustmentFormModal` was checked and found to have no percentage×amount multiplication site to fix — staff enter `percentage` (record-keeping only) and `amount` (the applied value) as two independent fields, not a computed product. Verified: 8 new `money.test.ts` unit tests (including a test that asserts the naive `0.1 + 0.2 !== 0.3` failure mode actually reproduces, so the fix is proven meaningful, not just present) + 1 new regression test in `calculations.test.ts`, 168/168 unit tests passing, typecheck/lint/build clean, 4/4 fees e2e tests passing, live smoke test against real seeded data (Auris Academy Finance Overview) confirming clean, exact Rand values with zero console errors.

## SPRINT 11 — Payments + Reconciliation
```text
TASK ID: FND-PAY-001
EPIC: Payments
SPRINT: 11  |  WAVE: 4
TITLE: Live payment gateway integration
STATUS: BLOCKED
PRIORITY: P1
DEPENDENCIES: A chosen provider (PayFast/Stripe/Peach/other) and real merchant/
  sandbox credentials — external business decision. Also gated on FND-ARCH-003 (MFA)
  and FND-FIN-009 (decimal-safe money) reaching DONE first — see reclassification.

DESCRIPTION:
Wire a real payment gateway so parents can pay fees online, using the
provider-agnostic abstraction designed in Sprint 9 (see Finance Architecture doc).

IMPLEMENTATION REQUIREMENTS:
payment_gateway_transactions table (provider, provider_reference, status, raw
payload, idempotency key) + webhook handler that inserts the corresponding
learner_fee_payments row on confirmed success. No change needed to any Finance
table already built — purely additive.

SECURITY REQUIREMENTS:
Webhook signature verification, replay protection, idempotency via a unique
constraint on the provider's event id.

TESTING REQUIREMENTS:
Duplicate-webhook-does-not-duplicate-payment test; failed-payment status test;
sandbox end-to-end payment flow test.

ACCEPTANCE CRITERIA: a parent can pay an outstanding charge online and the payment
appears in their statement within the webhook's normal latency.

DEFINITION OF DONE: elevated bar (financial).
EVIDENCE: n/a — blocked
NOTES: Do not invent credentials. Do not proceed until the provider decision is made.
```
- [x] FND-PAY-002 — Bank reconciliation (statement import/match against existing manual EFT/cash payments) — **DONE (Wave 3)** — a finance user uploads a bank-statement CSV (`date, description, amount`, credits-only — parsed client-side by the existing generic `parseCsv`, same as learner CSV import); each line lands as an `unmatched` `bank_statement_lines` row and is worked through in a dedicated `/fees/reconciliation` workspace that shows every line across every upload alongside every currently-unreconciled `learner_fee_payments` row. **Matching is never automatic** — amount+date alone isn't trustworthy (two families can pay the same amount the same day), so the finance user explicitly confirms which payment a line is, or marks it `ignored` (bank charges, unrelated deposits). The match/unmatch transition flips both `bank_statement_lines.status`/`matched_payment_id` **and** the linked `learner_fee_payments.reconciled_at` atomically inside `reconcile_bank_statement_line()` / `unreconcile_bank_statement_line()` (SECURITY DEFINER, `can_manage_learner_financial()`-gated); direct client UPDATEs to either side of that link are blocked by trigger (mirrors `academic_years`' `prevent_direct_year_activation()` precedent), the low-risk `ignored` transition stays a plain client write. Every match/unmatch writes to `audit_log`. **No guardian access at all** (unlike `learner_fee_payments` itself) — a bank statement is an internal finance-office document spanning every family. Additive `learner_fee_payments.reconciled_at` column (no new table for that half). Linked from Finance Overview. Verified: 13 new RLS tests covering upload authz, atomic match/unmatch, already-matched/already-reconciled rejection, cross-tenant payment rejection, both direct-write bypass blocks, the allowed `ignored` write, cross-tenant invisibility, hard-delete impossibility, and audit-log entries — full harness **484/484** with the complete migration chain applying clean; `lint`/`typecheck`/`test` (197)/`build` all pass; 2 new + 6 regression e2e (`fees.spec.ts`, 8/8); 10 unit tests for the CSV parser; `supabase db reset` clean with new demo data (one uploaded statement per school — tuition/transport-amount lines to match, two bank charges to ignore).
- [ ] FND-PAY-003 — Payment webhook idempotency/signature verification — BLOCKED — P1 — Wave 4 — hard-depends on `FND-PAY-001`.

## SPRINT 12 — Accounting + Financial Reporting
- [ ] FND-FIN-010 — Expense management — BACKLOG — P2 — Wave 6 — deliberately scoped out of the Finance session, see Finance Module doc
- [ ] FND-FIN-011 — Supplier records — BACKLOG — P2 — Wave 6
- [ ] FND-FIN-012 — Budgets + budget-vs-actual reporting — BACKLOG — P2 — Wave 6
- [x] FND-FIN-013 — Finance report CSV exports — **DONE (Wave 2)** — extended `getSchoolFinanceOverview` with a genuine gap-closer (`learnerBalances`, a real per-learner debtor list — previously the page only had aggregates, no "who exactly owes what" view) sorted by outstanding balance, plus a debtor-list table + CSV export on `FinanceOverviewPage`. **Found and fixed a real reusability bug along the way**: `ExportCsvButton` hardcoded a `reports.export` permission check; `finance_manager`/`accountant` correctly don't hold that permission per `rolePermissions.ts`'s own documented rule (`learner.manage_financial` is deliberately not one of the qualifying `.manage`-tier permissions for `reports.export`) — so reusing it as-is would have silently hidden the button from the exact roles it's for. Generalized the component to accept an optional `permission` override instead of forking a duplicate button. Verified: typecheck/lint/build clean (no bundle-size regression), 4/4 fees e2e tests passing (including a real download-event assertion), and a live check against the real demo data showing 375 real learners' correctly-computed debtor rows and a genuine CSV download.

## SPRINT 13 — School Operations
- [ ] FND-OPS-001 — Inventory/assets — BACKLOG — P3 — Wave 6
- [ ] FND-OPS-002 — Library — BACKLOG — P3 — Wave 6
- [ ] FND-OPS-003 — Transport routes/vehicles/drivers — BACKLOG — P3 — Wave 6
- [ ] FND-OPS-004 — Procurement/facilities maintenance — BACKLOG — P3 — Wave 6

## SPRINT 14 — Documents + Workflow
- [x] FND-DOC-002 — Document-expiry alerting — **DONE (Wave 2)** *(canonical ID — absorbs the former `FND-WF-002`)* — new nullable `learner_documents.expiry_date` (most document types never expire, so left optional rather than mandatory or type-restricted, matching this schema's existing treatment of open product-policy fields) + a second `pg_cron` daily job (`run_document_expiry_alerts()`/`trigger_document_expiry_alerts()`) reusing `FND-WF-001`'s exact verified infrastructure and idempotency pattern: guardians get a reminder 0–30 days before expiry (14-day cooldown), and staff who manage learner records (`can_manage_learners()`: school_owner/principal/admissions_officer — deliberately not the financial role set `FND-WF-001` uses) get a compliance alert once a document has actually expired (30-day cooldown). `DocumentFormModal`/`DocumentsTable` (shared between the staff view and the Parent Portal's read-only `FND-PAR-004` tab) both updated — an Expiring-soon/Expired badge is now visible in both places for free, no double implementation. No manual "send now" UI button was added, unlike `FND-WF-001` — there is no school-wide Documents page yet to put one on; `trigger_document_expiry_alerts()` is still built and authorization-tested so it's ready the moment one exists, documented rather than silently dropped. Verified: 7 new RLS tests (383/383 suite total), typecheck/lint/unit/build clean, 1 new + 6 regression e2e tests (`document-upload.spec.ts`) passing, live smoke test against real seeded data confirming the badge renders correctly and the scheduled worker produces real staff notifications end to end.
- [ ] FND-DOC-003 — Document versioning — BACKLOG — P2 — Wave 6
- [ ] FND-DOC-004 — Electronic signatures — BACKLOG — P3 — Wave 6 (likely third-party integration — external decision, same shape as Payments/SMS)
- [x] FND-WF-001 — Concrete workflow: fee-overdue reminder → escalation — **DONE (Wave 2)** — unlike `FND-ATT-002`/`FND-COM-003`, "a charge became overdue" isn't a data-write event (it happens purely from a due_date passing), so this needed a scheduled job rather than a trigger: `pg_cron` (verified genuinely available and working in the local Supabase Postgres image via a real scheduled test job, not assumed) runs `run_fee_overdue_reminders()` daily across every school, sending guardians a reminder (7-day cooldown) and escalating to finance staff — school_owner/finance_manager/accountant — once an overdue charge passes 14 days (14-day cooldown), both idempotency-checked against actually-persisted `notifications` rows. A `trigger_fee_overdue_reminders()` authenticated wrapper (gated on `can_manage_learner_financial()`) also exposes this as a "Send overdue reminders now" button on Finance Overview, so the workflow is testable and useful without waiting for the schedule. **Handled a real infrastructure-availability gap deliberately, not by assuming it away**: the RLS regression harness runs against a minimal `postgres:16-alpine` image with no `pg_cron` installed, so the extension-creation and `cron.schedule()` calls are wrapped to skip gracefully there while the real Supabase stack still schedules the job — confirmed both ways directly, not assumed. Outstanding-balance math is computed in SQL mirroring `buildFeeSummary()` exactly; needs no decimal-safety helper since Postgres `numeric` arithmetic is exact by definition, reinforcing that `FND-FIN-009`'s fix was specifically a JS-side problem. Verified: 9 new RLS tests (376/376 suite total), typecheck/lint/unit/build clean, 1 new e2e test, live smoke test against real seeded data sending 368 real reminder/escalation notifications with zero console errors, plus manual verification of idempotency (0 sent on immediate re-run) and authorization (teacher rejected, School B blocked from School A) directly against the live database.
- [ ] FND-WF-003 — Concrete workflow: attendance-intervention escalation — BACKLOG — P2 — Wave 3 — hard-depends on `FND-COM-001` + `FND-ATT-002`

## SPRINT 15 — Mobile Ecosystem
- [ ] FND-MOB-001 — PWA manifest + service worker — BACKLOG — P2 — Wave 5
- [ ] FND-MOB-002 — Offline-safe read views — BACKLOG — P2 — Wave 5 — hard-depends on `FND-MOB-001`
- [ ] FND-MOB-003 — Web push notifications — BACKLOG — P2 — Wave 5 — hard-depends on `FND-MOB-001` and `FND-COM-001`
- [ ] FND-MOB-004 — Native app evaluation — BACKLOG — P3 — Wave 6 — only if a specific PWA-incapable requirement is proven

## SPRINT 16 — Analytics
- [x] FND-AN-001 — Attendance trend charts — **DONE (Wave 3)** — new "Attendance trend" section on the Attendance Report page: a hand-rolled, dependency-free SVG line chart (`AttendanceTrendChart.tsx`) plotting school-wide daily attendance rate over the selected range, with a dashed reference line at the existing 80% "needs attention" threshold and points colored red below it. Data comes from a new `dailyRows` field on `attendanceReportService.getAttendanceReport()`, grouping the SAME already-fetched records by date through the existing `calculateAttendanceStats` — no extra query, and this report can never disagree with the teacher-facing register about what a rate means. Gaps (days nobody marked a register) are skipped, not zero-filled. Deliberately no charting library: `role="img"` + a summarizing `aria-label` (range + min/max) stand in for real chart semantics, and at most 3 x-axis date labels avoid overlap regardless of range length. Verified: typecheck/lint clean, unit suite 180/180, build clean (no bundle-size regression — no new dependency), 1 new e2e test plus the full attendance + accessibility regression suites (16/16, then 11/11 attendance) passing, including the page's own axe-core scan confirming the SVG's ARIA approach is clean. Live smoke test against real seeded data (Auris Academy, principal login): chart rendered a real 97%-flat trend line with the threshold line beneath it and correct date labels (10 Aug – 28 Aug), zero console errors.
- [x] FND-AN-002 — Cross-domain executive KPIs on the Dashboard — **DONE (Wave 3)** — two new Executive Summary cards, distinct from the existing same-day raw counts: **Fee Collection Rate** (reuses `feeService.getSchoolFinanceOverview`, gated on `learner.view_financial`) and **30-Day Attendance Rate** (reuses `attendanceService.getAttendanceInRange` + the existing `calculateAttendanceStats`, gated on `attendance.view`). Extracted `FinanceOverviewPage`'s own collection-rate formula into a new shared `calculateCollectionRate()` in `calculations.ts` rather than duplicating it for the Dashboard card — the two views can now never silently drift apart on what "collection rate" means. Verified: 5 new unit tests, typecheck/lint/unit(180/180)/build clean, 2 new e2e tests (one per KPI, asserting the exact computed percentage) + regression suite (attendance/fees/accessibility, including the Dashboard a11y scan) all passing, live smoke test against real seeded data (Auris Academy) showing real computed values (97% attendance, 48% collection) with zero console errors.

## SPRINT 17 — Funda Intelligence / AI
- [ ] FND-AI-001 — LLM provider + data-handling decision — BACKLOG — P3 — Wave 6 — must precede any AI code
- [ ] FND-AI-002 — Learner risk indicators — BACKLOG — P3 — Wave 6 — hard-depends on `FND-AI-001`
- [ ] FND-AI-003 — Principal/teacher AI assistant — BACKLOG — P3 — Wave 6 — hard-depends on `FND-AI-001`

## SPRINT 18 — API + Integrations
- [ ] FND-API-001 — Public API — BACKLOG — P3 — Wave 6 — do not build without a real external consumer

## SPRINT 19 — Security + POPIA Readiness
```text
TASK ID: FND-SEC-010
EPIC: Security
SPRINT: 19  |  WAVE: 1 (engagement kickoff only — sign-off itself is externally paced)
TITLE: POPIA legal compliance review
STATUS: BLOCKED
PRIORITY: P0
DEPENDENCIES: External legal counsel — not resolvable by engineering judgment.

DESCRIPTION: Funda360 handles South African minors' personal, medical, and
financial data. No POPIA compliance claim has been made or verified.

DEFINITION OF DONE: a named legal/compliance sign-off, external to this process.
  **Still not met — remains BLOCKED, correctly.**
EVIDENCE: Kickoff artifact produced this session — [FUNDA360-POPIA-READINESS-BRIEF.md](FUNDA360-POPIA-READINESS-BRIEF.md):
  a verified data inventory (what personal/special-category information
  Funda360 actually stores, table-by-table), a technical-controls summary
  (RLS/tenant isolation/audit log, what's real vs. aspirational), and 7
  named unresolved gaps (retention policy, Information Officer designation,
  consent capture, operator-vs-responsible-party, cross-border transfer,
  breach notification, subject access/deletion requests) — each explicitly
  flagged as needing a legal/policy decision, not an engineering guess.
NOTES: Scheduling correction from the prior pass — starting this engagement has
zero engineering cost and a long external lead time, so it belongs in Wave 1
alongside the cheap fixes, not deep in a numbered sprint that reads as "do this last."
The brief itself does not claim compliance and explicitly says so — it exists so
the actual legal engagement has a factual starting point instead of nothing.
```
- [ ] FND-SEC-008 — Data retention/deletion policy (decision, then implementation) — BACKLOG — P0 (decision) / P1 (implementation) — Wave 3 — soft-after `FND-ARCH-001`
- [x] FND-SEC-009 — Consent management capture — **DONE** — per `docs/product/FUNDA360-POPIA-READINESS-BRIEF.md` item 3, whether POPIA's lawful-processing conditions are already satisfied via the enrollment contract for core processing is an unresolved LEGAL question, explicitly out of engineering's authority to decide (same posture as `FND-SEC-008`) — NOT resolved here. What this ships is the mechanism: capture/view/revoke guardian consent for three genuinely discretionary categories every school system commonly captures separately regardless of jurisdiction — photo/media use, marketing communications, third-party data sharing — deliberately excluding a "core data processing" category (inventing that toggle would itself be an engineering guess at the unresolved legal question). New `consent_records` table (one current-state row per learner/guardian/category, `granted_at`/`revoked_at` server-derived from the `granted` transition, every insert/transition written to `audit_log`) + `can_view_learners()`/`can_manage_learners()`/`is_learner_guardian()`-based RLS (a guardian may only ever set their own consent; staff who can manage learners may capture on a guardian's behalf, e.g. a signed paper form; no DELETE policy — withdrawal is `granted=false`, not a removed row). Migration: `20260829270000_consent_management.sql`. UI: new "Consent" tab on the staff-facing Learner 360 (`LearnerConsentSection`, all linked guardians × all categories, edit gated on `learner.manage`) and on the guardian-facing parent-portal child profile (`MyConsentSection`, self-service toggles for the signed-in guardian's own consent only). Verified: RLS suite 458→471 (self-service grant, cross-guardian-learner rejection, view-only-staff-cannot-write, manage-staff-can-write-on-behalf, mismatched-guardian-link rejected, cross-tenant invisibility, withdrawal timestamp semantics, audit trail, duplicate-constraint, hard-delete-impossible), typecheck/lint/187 unit tests/build all clean, live smoke test against real local Supabase + real Auris Academy demo data (principal toggling a guardian's photo consent on the Learner 360 page; the guardian separately toggling their own marketing consent from the parent portal) — both writes confirmed correct in the database (right guardian, right category, server-derived `granted_at`, audit rows written), zero console errors. Test data cleaned up afterward.
- [x] FND-SEC-011 — Application-level rate limiting beyond Supabase defaults — **DONE** — no custom backend exists (PostgREST + SECURITY DEFINER RPCs only), so genuine rate limiting has to live in Postgres itself. New `rate_limit_events` table (no RLS policy, FORCE RLS, reachable only from inside another SECURITY DEFINER body) + `check_rate_limit(action_key, max_count, window)` — explicitly `revoke ... from public` (not just `authenticated`; this project grants EXECUTE to the PUBLIC pseudo-role by default on every new function, a phenomenon already documented once before in `20260822010000_function_execute_privilege_correction.sql` and re-confirmed here). Wired into the three privileged account-provisioning RPCs (`admin_create_user`, `admin_create_guardian`, `provision_employee_login`) via `create or replace function` (new migration, originals untouched) sharing ONE budget — `account_provisioning`, 20 calls/actor/rolling hour — so spreading calls across the three RPCs can't multiply the effective limit. Migration: `20260829260000_rate_limiting.sql`. Verified: RLS suite 453→458 (direct-call-denied, normal-call-succeeds, 21st-call-in-window-rejected, per-actor-not-global budget — all against dedicated disposable actors, never a shared fixture, after an initial version broke an unrelated later-running test by exhausting a shared fixture's budget), typecheck/lint/unit/build clean, live smoke test against real local Supabase (create-user flow via the actual UI). **Bonus fix surfaced by the live smoke test, unrelated to rate limiting itself**: all three RPCs' `search_path` (`public, auth`, unchanged since their original migrations) omitted `extensions`, the schema pgcrypto actually lives in on this instance — so `gen_random_bytes`/`crypt`/`gen_salt` were silently unresolvable and every one of these three flows was actually broken end-to-end against the real app, invisible to both the RLS harness (its disposable container installs pgcrypto into `public`, masking the gap) and e2e tests (mocked, never execute the real RPC body). Pre-existing, not introduced this session — fixed in passing since these three function bodies were already being redefined here (`search_path = public, auth, extensions`), re-verified with a full RLS re-run (458/458 still green) and a second live smoke test (user created successfully, zero console errors). Test data cleaned up afterward.

## SPRINT 20 — Performance + Reliability
- [x] FND-QA-002 — Load test against the seeded demo dataset — **DONE** — new `supabase/load-tests/run.mjs`: signs in as 5 real seeded Auris Academy accounts across roles, runs concurrent virtual users through the real PostgREST/RLS path (not a bypass) executing role-appropriate read scenarios for a fixed duration, reports per-scenario count/error-rate/p50/p95/p99. Hard-refuses to target anything but a loopback Supabase URL. **Found a real, severe defect**: under 20-way concurrency, `assessments_list` averaged 7.7s with a 48% error/timeout rate — 18x worse than every other scenario. Root cause (confirmed via `EXPLAIN ANALYZE` with RLS actually engaged, not superuser-bypassed): `assessments` carried two separate permissive SELECT policies (a cheap staff check + a guardian-access policy with a cross-table `EXISTS` calling `is_learner_guardian()`); Postgres's planner combined them via a hashed subplan that unconditionally scanned all of `assessment_results` calling that `SECURITY DEFINER` function per row — BEFORE evaluating the cheap staff check — on every single call, regardless of role. Merging both into one policy (cheap check first) dropped isolated execution from 1393ms to 18.6ms (~75x). Auditing `pg_policies` found the SAME two-permissive-SELECT-policies shape on 17 tables total; 14 with a genuinely non-trivial second policy were fixed the same way in one migration (`20260829280000_rls_select_policy_consolidation.sql`) — `assessment_results`, `assessments`, `attendance_records`, `class_teacher_assignments`, `classes`, `grades`, `learner_documents`, `learner_enrollments`, `learner_fee_adjustments`, `learner_fee_charges`, `learner_fee_payments`, `learner_fee_refunds`, `subjects`, `timetable_entries` — structure-only change, every merged qual is the verbatim original condition. `academic_years` and `guardian_profile_details` were deliberately excluded (both their second policies are genuinely cheap — pure JWT-claim check / plain column comparison — no risk); `storage.objects`'s own 3 permissive policies were left for a dedicated follow-up. Full report: [FUNDA360-LOAD-TEST-REPORT.md](FUNDA360-LOAD-TEST-REPORT.md). Verified: RLS suite 471/471 passing (fresh throwaway container, full migration history — confirms the new migration applies cleanly, not just to the mutated local dev DB), 58/58 relevant e2e tests (assessments, attendance, fees, guardian invitations, learners, parent portal, timetable) passing against the real local stack after the fix, typecheck/lint/187 unit tests/build all clean. Re-running the load test after the fix: `assessments_list` 7720ms→423ms avg (~18x), 48%→0.8% errors; total throughput in the same 30s window roughly doubled (816→1682 requests, since the pathological query had been starving the whole instance of CPU for every caller, not just its own); overall error rate 1.47%→0.06%.
- [x] FND-QA-003 — N+1 query audit across every `*Service.ts` — **DONE** — no literal N+1 pattern found (the service layer is already clean — every list-in-a-list case already uses `.in()` batch fetches), but the audit surfaced a more consequential real defect: several report-aggregation services (`attendanceService.getAttendanceInRange`, `feeService.getSchoolFinanceOverview`, `assessmentService.getAssessments`/`getResultsForAssessments`) fetch a whole table's worth of rows with no `.range()`, silently truncating at PostgREST's 1000-row default cap once a school's data crosses it — verifiably real against this session's own demo data (1800 attendance records/school). Fixed via a new shared `fetchAllRows()` pager (`src/lib/pagination.ts`, 6 unit tests) wired into all four call sites. Verified: typecheck/lint clean, 132/132 unit tests, 33/33 relevant e2e tests (attendance, fees, reports, assessments) passing, zero regressions.

## SPRINT 21 — Premium UX
- [x] FND-UX-003 — Shared `Tabs` component — **DONE** — extracted the byte-for-byte identical hand-rolled tab bar out of `LearnerProfilePage.tsx` and `ParentChildProfilePage.tsx` into `src/components/ui/Tabs.tsx` (generic over the tab-key union, preserves the original `aria-current` semantics rather than bundling in a separate ARIA redesign). Verified: typecheck/lint clean, build succeeds, 132/132 unit + 22/22 relevant e2e (learners, parent-portal, fees) passing.
- [x] FND-UX-004 — Shared `Dropdown`/`Toast`/`DataTable` primitives — **DONE (Wave 3)** — all three built as genuinely reusable, typed infrastructure in `src/components/ui/`. **Deliberately does not mass-migrate every existing hand-rolled dropdown/table in the app** — this codebase's own standing instruction explicitly warns against rewriting working, already-tested code with no reported defect just to reduce duplication; each primitive is proven against one real, dogfooded consumer instead: `Dropdown`/`DropdownItem` replaced `UserMenu.tsx`'s own hand-rolled click-outside/Escape/`role="menu"` implementation (that pattern is now shared, not duplicated, the next time an action menu is needed) — its internal auto-close-on-item-click uses a small internal Context rather than a container-level `onClick`, after a real `jsx-a11y` violation caught during verification (`role="menu"` isn't supposed to carry its own click handler under WAI-ARIA menu semantics; each menuitem handles its own activation). `Toast`/`ToastProvider`/`useToast` is a new ephemeral notification queue — explicitly distinct from both the per-form static `role="alert"` divs already used everywhere (deliberately left untouched) and the persisted `notifications` table/inbox (FND-COM-001) — mounted once at the app root; individual toasts (not the always-present container) carry `role="status"` after deliberately avoiding the exact persistent-element ARIA-collision bug `MfaRequiredBanner` was already caught and fixed for earlier this session. Dogfooded on the Timetable page's "Publish N draft lessons" action, which previously gave no explicit success feedback at all. `DataTable<T>` is a generic table shell (columns/rows/loading/empty-state) matching the exact markup shape every existing `*Table` component in this app already converged on independently — built for tables from here on, left as complete, typed, lint-clean infrastructure with no forced consumer yet (a stateless, prop-driven renderer; its correctness is a function of TypeScript's structural typing, not runtime wiring, unlike `Toast`'s context+portal+timer, which genuinely needed live-browser proof). Verified: typecheck/lint/unit(187/187)/build clean, 2 new e2e tests (Dropdown open/Escape/outside-click; the Toast assertion added to the existing "publishing draft lessons" test) + the full login/timetable/accessibility regression suites (19/19) passing, live smoke test against real seeded data (Auris Academy) — opened/closed the real account dropdown via keyboard and an outside click, created and published a real draft lesson end-to-end and watched the real success toast appear with the correct count and auto-dismiss after 5 seconds, zero console errors, test lesson removed afterward via direct SQL.
`FND-ARCH-005` (command palette) is the canonical ID — see Sprint 1.3.

## SPRINT 22 — Commercial Readiness
- [x] FND-DEMO-001 — Demo/seed environment (3 schools) — DONE
- [x] FND-BIZ-001 — Tenant onboarding wizard — **DONE** *(canonical ID — absorbs the former `FND-ARCH-006`)* — before this, onboarding a school took 3-4 separate, easy-to-forget page visits (Schools → Create school, Users → Add user while remembering to pick the right school, Academic → Years → New year) with no guided path connecting them. New `/schools/onboard` route (`SchoolOnboardingWizardPage`, gated identically to `/schools` on `tenant.switch`): step 1 school details, step 2 first admin account (school_owner/principal), step 3 optional first academic year, step 4 done/links — each data-creating step reuses the exact existing service function the standalone pages already use (no duplicated logic), steps 2-3 are skippable. **Found and fixed a real, previously-nonexistent-code-path bug while building step 2**: `admin_create_user` never received an explicit `p_tenant_id` from any UI before this — the general Add User modal relies on the caller's own `current_tenant_id()`, which is always null for a platform/super admin (they have no tenant of their own) — meaning nothing in the app could previously provision a brand-new school's very first user with a working `tenant_id` at all. Fixed by extending `CreateUserInput`/`userService.createUser` with an optional `tenantId` (only ever set by the wizard; the general Add User modal's behavior is completely unchanged). **Found and fixed a second real bug via the wizard's own e2e test**: `TenantContext.createSchool()` used to switch the active tenant immediately as part of creating a school — but `TenantGate` shows a full-screen spinner during the brief loading window that switch triggers, unmounting and remounting whatever routed page called it, silently wiping the wizard's own local step state right after step 1 succeeded (caught by the new e2e test, not by inspection). Fixed by separating "create" from "switch to" in `TenantProvider`/`TenantContextValue` — `createSchool()` no longer switches the tenant itself; `CreateSchoolModal` (the existing quick-create path) now calls `switchTenant()` explicitly right after, preserving its exact prior behavior; the wizard defers switching until step 4's own "finish" actions, when a remount no longer matters. Verified: typecheck/lint/187 unit tests/build clean; new `e2e/school-onboarding.spec.ts` (3 tests: full happy path including the tenantId assertion on the mocked RPC call, required-field validation, permission gate) plus the full existing `school-profile.spec.ts` suite (21/22 — the one failure is a confirmed pre-existing, order-dependent flake unrelated to this change, passes reliably alone and on repeat) all passing; live smoke test against real local Supabase (`super.admin@funda360.dev`) for BOTH entry points — the wizard's full 4-step flow (confirmed via direct DB query: the new owner profile has `role='school_owner'` and `tenant_id` correctly set to the just-created school, which would have been NULL before this fix) and the pre-existing quick-create modal (confirmed still switches correctly via in-app navigation). All test data cleaned up afterward.
- [ ] FND-BIZ-002 — Support console — BACKLOG — P2 — Wave 6
- [ ] FND-BIZ-003 — Platform-level subscription/billing — BACKLOG — P3 — Wave 6

## SPRINT 23 — Production Certification
- [ ] FND-CERT-001 — All Release Gates (1–10) at PASS — BACKLOG — P0 — Wave 7
- [ ] FND-CERT-002 — Zero known P0/P1 defects — BACKLOG — P0 — Wave 7
- [ ] FND-CERT-003 — Full regression suite green — BACKLOG — P0 — Wave 7

---

# FINAL AUDIT REPORT (grooming pass)

## What this pass confirmed
The platform hasn't drifted from the original audit in any backlog-relevant way — every "missing" claim re-checked against live code (see verification log above) is still accurate. The only real findings were **organizational**: 4 duplicate task IDs, 1 mis-stated dependency, and 6 priorities that either buried urgency in a parenthetical or hadn't been re-evaluated after this session's Finance work changed what's cheap vs. expensive.

## Biggest structural finding
`FND-COM-001` (notifications) was previously scheduled in Sprint 8 (thematically correct — it's a Communication-epic task) but sits at the root of a 7-item dependency fan-out spanning Attendance, Documents, Workflow, and Mobile. Sprint-number reading order buried this; the Execution Waves section above fixes it by separating **thematic grouping** (sprint number — kept stable) from **schedule order** (wave — the actual answer to "what do we build next").

## Recommended immediate next work
Wave 1, in the order listed — the two trivial `FND-SEC-006`/`FND-SEC-007` fixes cost almost nothing and can land same-day; `FND-ARCH-001` and `FND-COM-001` are the two items worth prioritizing engineering time on, since nearly everything in Waves 2–5 either depends on or is materially cheaper after they exist.

## Scale after grooming
- Tasks: 113 (was 117; −4 duplicates merged, no scope lost)
- DONE: 36 · READY: 10 · BLOCKED: 2 · BACKLOG: 65
- Execution waves: 7 (supersedes the flat 24-sprint reading order for scheduling purposes; sprint numbers retained for thematic reference and stable cross-linking)
