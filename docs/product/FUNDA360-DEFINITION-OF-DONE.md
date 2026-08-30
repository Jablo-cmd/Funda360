<title>Funda360 — Definition of Done</title>

# Funda360 — Definition of Done

Applies to every Kanban task in [FUNDA360-TOP-TIER-KANBAN.md](FUNDA360-TOP-TIER-KANBAN.md). A task does not move to **DONE** until all applicable items below are satisfied — "applicable" because not every task touches every layer (a pure documentation task has no RLS to verify; a UI-only refactor has no migration).

## Standard bar (every task)

- [ ] Implementation exists and matches the task's acceptance criteria.
- [ ] Business logic is correct — verified by an actual test run, not by inspection alone.
- [ ] UI works where applicable — manually exercised in the running app, not just "the component compiles."
- [ ] Database implementation works where applicable — migration applies cleanly via `supabase db reset`, no orphaned objects.
- [ ] Authorization works — the correct roles can act, the wrong roles are correctly denied, tenant isolation holds.
- [ ] RLS/security verified where applicable — either a new SQL regression test in `supabase/rls-tests/tests/`, or an explicit note of why the existing coverage already proves it.
- [ ] Tests exist at the appropriate level: unit tests for pure calculation/logic, RLS tests for anything touching a new table/policy, e2e coverage for a new user-facing flow.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` all pass.
- [ ] No known critical (P0) defect remains in the changed area.
- [ ] Documentation updated where the change affects [FUNDA360-CURRENT-STATE.md](FUNDA360-CURRENT-STATE.md)'s claims, `docs/FUNDA360_KNOWN_LIMITATIONS.md`, or any other doc a reader would reasonably trust.
- [ ] Acceptance criteria (stated on the task) are explicitly satisfied, one by one — not "roughly done."
- [ ] No unresolved blocker remains for this specific task (cross-task dependencies are fine; they just mean the *dependent* task isn't ready, not that this one isn't done).

## Elevated bar — financial or security-sensitive features

Any task touching money (Finance/Payments) or sensitive personal data (medical, behaviour, identity/auth) additionally requires:

- [ ] Server-side/database-authoritative calculation — the frontend may display and pre-validate, but the database (via CHECK constraints, triggers, or RPC logic) is the actual source of truth for any number or authorization decision.
- [ ] Explicit test coverage for the specific failure modes the brief called out for that domain (e.g. for Finance: duplicate-payment/idempotency, refund-exceeds-original-amount, cross-tenant access attempt).
- [ ] An explicit "what happens on partial failure" answer (e.g. a webhook that fails halfway) — not merely "it should work."
- [ ] Audit trail: who did it, when, and (for anything mutable) what changed — via `created_by`/`updated_by` at minimum, via the future `audit_log` table once it exists for anything higher-sensitivity.
- [ ] A named reviewer/second pass before the task can move past REVIEW — self-certification is not sufficient for this tier.

## What does NOT count as done

- A route/page/component existing, with no verified working logic behind it.
- A database table/migration existing, with no RLS policy, no service layer, no UI consuming it.
- "The happy path works" with no test proving the unhappy paths (wrong role, wrong tenant, invalid input) are actually rejected.
- A claim in documentation with no corresponding code.
- A TODO comment marking something finished.

## Kanban status meanings (for reference)

| Status | Meaning |
|---|---|
| `BACKLOG` | Identified, not yet started, not yet ready (may be missing a design decision or blocked on a dependency) |
| `READY` | Fully specified, dependencies satisfied, could be picked up next |
| `IN PROGRESS` | Actively being worked |
| `REVIEW` | Implementation complete, pending code/design review |
| `QA` | Passed review, undergoing the Definition of Done checklist verification |
| `BLOCKED` | Cannot proceed — the task's `DEPENDENCIES` field names exactly what's blocking it |
| `DONE` | Every applicable Definition of Done item is checked, verified, not merely claimed |
