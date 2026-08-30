<title>Funda360 — Product Architecture</title>

# Funda360 — Target Product Architecture

This describes where Funda360 is headed, reconciled against what's actually built (see [FUNDA360-CURRENT-STATE.md](FUNDA360-CURRENT-STATE.md)). It replaces the acronym `docs/` specs as the authoritative architecture reference — those were AI-generated aspirational documents, not verified against the schema (see the note at the top of the current-state doc).

## Guiding principle: preserve, don't rebuild

Every recommendation below builds additively on the existing architecture. Nothing here proposes a rewrite. The existing patterns are genuinely good and should be the template for every new domain:

- **Tenant scoping**: every table carries `school_id`, checked by `current_tenant_id()` in RLS and by a `*_validate_tenant()` trigger (closing the "FK doesn't respect RLS" gap the codebase has explicitly identified and fixed repeatedly).
- **Archive, never delete**: `active`/terminal-status columns, no DELETE RLS policy anywhere, FORCE ROW LEVEL SECURITY. Any new domain should follow this exactly.
- **Ledger over allocation** where the data is naturally additive (fees, and now fee adjustments/refunds) — balance derived at query time from raw rows, not stored and mutated. Simpler, fewer invariants to protect, matches the existing fees domain's own documented reasoning.
- **SECURITY DEFINER applied precisely** — only on trigger functions that read a table the calling role doesn't otherwise have RLS access to (documented case-by-case in every migration that uses it, per the Sprint 6/7 lessons already recorded in the migrations themselves). Never applied reflexively.
- **RBAC mirrored, not derived** — `ROLE_PERMISSIONS` (TypeScript) and `can_view_*()`/`can_manage_*()` (SQL) are maintained in parallel by convention, with an explicit "keep in sync manually" comment on every SQL function. A future improvement (P2) would be generating one from the other, but this is not currently a correctness risk since RLS is the actual enforcement boundary regardless of what the TypeScript layer believes.
- **Service-layer-only Supabase access** — every feature's `*Service.ts` is the sole caller of `supabase.from()/.rpc()` for that domain; components never call Supabase directly. New domains should follow this.

## Layered domain map (current + target)

```text
                         FUNDA360 SCHOOL OS
                                │
    ┌───────────────┬──────────┼──────────┬───────────────┐
    ↓               ↓          ↓          ↓               ↓
 PLATFORM        LEARNER      HR       ACADEMICS      TIMETABLE
 FOUNDATION      (SIS)                                    │
    │               │          │           │              │
    │        ┌──────┴──────┐   │    ┌──────┴──────┐      │
    │        ↓             ↓   │    ↓             ↓      │
    │   GUARDIANS      DOCUMENTS│ ASSESSMENTS  ATTENDANCE │
    │        │                 │    │             │      │
    │        └────────┬────────┴────┴──────┬──────┴──────┘
    │                 ↓                     ↓
    │           PARENT PORTAL          BEHAVIOUR/
    │                 │                WELLBEING
    │                 ↓
    │              FINANCE  ← this session's deep-dive
    │           ┌─────┴─────┐
    │           ↓           ↓
    │        FEES        PAYMENTS (gateway abstraction;
    │      (ledger)        live wiring blocked on credentials)
    │
    ├── COMMUNICATION (missing — build after Notifications foundation)
    ├── DOCUMENTS (partial — extend existing storage pattern)
    ├── REPORTS / ANALYTICS (partial — real, shallow; AI deferred)
    └── COMMERCIAL (tenant onboarding, demo/seed — this session's other deliverable)
```

`Mobile`, `School Operations`, `Workflow Engine`, and `AI/Funda Intelligence` are deliberately drawn outside the core map above — see the sections below for why each is sequenced later or scoped differently than the original brief's flat list implied.

## Platform Foundation — what's next

1. **Audit log** (P0): a single `audit_log` table (`school_id, actor_profile_id, action, entity_table, entity_id, before, after, created_at`), written from the SECURITY DEFINER RPCs that already exist for every sensitive mutation (`admin_update_user_role`, `terminate_employee`, the new refund/adjustment paths, etc.) rather than a generic trigger-on-every-table approach, which would be noisy and slower. Start with the RPCs that already centralize privileged writes — they're the natural insertion point.
2. **Notifications**: an outbound-email-first implementation (Supabase already has a transactional-email path proven by password reset/guardian activation) before building in-app/SMS/WhatsApp. Sequence: email → in-app inbox → SMS/WhatsApp (each is a bigger commitment, don't front-load).
3. **MFA**: Supabase Auth supports TOTP natively — this is mostly a frontend enrolment/challenge UI + a policy decision on which roles require it (recommend: mandatory for `school_owner`/`finance_manager`/`accountant`/platform-admin roles once real payments exist).

## Timetable — auto-generation is not recommended as a near-term investment

Real timetable constraint-solving (a `timetable_entries` allocation that satisfies every teacher/room/class/subject-frequency constraint simultaneously) is a genuinely hard combinatorial problem — most commercial school platforms either license a third-party solver or ship "assisted manual" (suggest free slots, let a human place them) rather than full auto-generation. **Recommendation: build the assisted-suggestion version (P2), not full auto-generation (P3), and only after the conflict-detection foundation already shipped is exercised by a real published/draft workflow.**

## Communication — sequencing matters

Do not build messaging before notifications, and do not build a generic "communication platform" before either exists. Recommended order: **(1) transactional notifications** (fee overdue, document expiring, attendance alert — reusing existing calculation logic that's already correct, just not yet dispatched anywhere) → **(2) announcements** (one-to-many, school→all-guardians) → **(3) two-way messaging** (highest complexity: threading, read receipts, moderation). WhatsApp/SMS integration is an external-provider decision (Twilio, or a SA-specific aggregator) — don't build the abstraction until channel #1 (email) is live and proven.

## Mobile — recommendation

**Do not start a native (React Native) app before a responsive, installable PWA is evaluated.** The existing stack (Vite + React + Tailwind, already fully responsive per the accessibility/e2e test evidence) is a strong PWA candidate: a manifest + service worker gets "add to home screen," offline-shell caching, and push notifications (via web push) on Android and — with iOS's now-real PWA push support — increasingly on iOS too, at a fraction of the cost and with zero app-store review cycles for every release. Recommend: **PWA first (P2)**, revisit native only if a specific capability the web platform genuinely cannot provide (e.g. deep OS-level offline sync for a connectivity-poor rural school) becomes a proven requirement, not a speculative one.

## School Operations, Workflow Engine, AI — deliberately lowest priority

None of inventory/library/transport-logistics/procurement are core to what a school admin, teacher, or parent needs from Funda360 day-to-day (attendance, grades, fees, communication). Building them now would be scope creep away from making the existing core domains excellent. A **generic** workflow/escalation engine is explicitly not recommended (see gap analysis) — the 2-3 concrete workflows the product actually needs (fee-overdue reminder → escalation, document-expiry alert, attendance-intervention) should be built directly once Notifications exists, which is simpler, ships faster, and avoids building a rules-engine nobody outside this product will ever configure. AI features need a provider/data-handling decision this document cannot make, and are only genuinely useful once there's real usage data (attendance/finance/assessment history) to analyze — which the demo seed and continued real usage will provide over time.

## Finance architecture — see the dedicated doc

[FUNDA360-FINANCE-ARCHITECTURE.md](FUNDA360-FINANCE-ARCHITECTURE.md) covers the Finance domain's layered design (fees → adjustments/refunds → payment-gateway abstraction → reporting) in full, since it was the deep-dive target of this session.
