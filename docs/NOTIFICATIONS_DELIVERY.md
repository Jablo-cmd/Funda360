# Funda360 — Reconciled Documentation

**Current as of:** 2026-09-24  
**Authoritative register:** `docs/FUNDA360_CURRENT_STATE_2026-09-24.md`

> This document is reconciled against implementation evidence. Planned, partial and configuration-dependent capabilities are not presented as live.

## Current implementation
In-app notification records and an outbox/adapter architecture exist for email, SMS and WhatsApp. External delivery is configuration-dependent and must not be described as active without provider secrets, sender configuration, deployed functions and end-to-end verification.

Unconfigured channels should remain pending/fail closed rather than silently claiming delivery. Scheduled delivery is an expansion area unless a deployed scheduler is verified.