# Funda360 — Transport Management

**Status:** IN PROGRESS  
**Started:** 2026-09-29  
**Branch:** feat/transport

## Implemented in this domain pass

- Tenant-scoped fleet register with vehicle status and capacity.
- Transport driver register with optional employee linkage and licence metadata.
- Routes and stops with coordinates/time metadata.
- Learner-to-route assignments with effective dates and lifecycle status.
- Dated route schedules with vehicle/driver assignment.
- Per-trip learner transport attendance including boarded, absent, picked-up, dropped-off and no-show states.
- SECURITY DEFINER workflow RPCs for assignment status, trip status and attendance.
- Guardian notification for pickup, drop-off and no-show events.
- Staff transport workspace and guardian transport view.
- New transport.view / transport.manage RBAC permissions.
- FORCE RLS and tenant validation triggers across all transport tables.
- Cross-tenant, role-boundary and guardian visibility regression tests.

## Remaining closure gates

- Route-stop ordering management UI.
- Learner assignment workflow UI using the existing learner/guardian records.
- Daily trip register with roster-derived attendance and bulk marking.
- Guardian/learner navigation and learner transport view.
- Transport fee/ledger integration using the existing transport fee category.
- Transport operational reporting and CSV export.
- Full unit/E2E verification and RLS harness execution.
- Final documentation reconciliation and domain closure commit.

## Design boundary

GPS is intentionally not fabricated. The schema keeps stable route/stop/vehicle/trip identifiers so a future GPS provider can be attached without replacing the transport domain.
