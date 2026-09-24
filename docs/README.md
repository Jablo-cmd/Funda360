# Funda360 Documentation

## Current source of truth

**[FUNDA360_CURRENT_STATE_2026-09-24.md](./FUNDA360_CURRENT_STATE_2026-09-24.md)** — authoritative snapshot of the capabilities, implementation paths, security architecture, verification surface, production truth, and remaining roadmap as of 2026-09-24.

Use the current-state document first when answering **"what does Funda360 have today?"** It is derived from the repository's actual code and migration/test inventory, not the original product plan.

## Foundation Documents

1. Context & Architecture  
2. Product Requirements Document  
3. Business Requirements Specification  
4. Functional Requirements Specification  
5. System Design Document  
6. Database Design Specification  
7. API Design Specification  
8. Design System & Frontend Standards  
9. RBAC & Security Permissions Specification  
10. Testing Strategy & Quality Assurance Master Plan  
11. DevOps & Infrastructure Architecture Guide  
12. Deployment, Release & Operations Runbook  
13. Business Continuity & Disaster Recovery Plan  
14. Implementation & Rollout Strategy  

## Domain implementation notes

- [FINANCE.md](./FINANCE.md) — fee ledger, invoicing, allocation, statements, receipts, bank reconciliation
- [PAYMENT_GATEWAY.md](./PAYMENT_GATEWAY.md) — provider-agnostic online payment architecture + go-live checklist
- [LEARNER_PORTAL.md](./LEARNER_PORTAL.md) — learner self-service
- [PARENT_PORTAL_COMPLETION.md](./PARENT_PORTAL_COMPLETION.md) — guardian/parent portal completion
- [COMMUNICATION.md](./COMMUNICATION.md) — messaging and notifications
- [HOMEWORK.md](./HOMEWORK.md) — assignments, submissions and learning workflow
- [TEACHER_WORKSPACE.md](./TEACHER_WORKSPACE.md) — teacher operational workspace
- [REPORT_CARDS.md](./REPORT_CARDS.md) — governed report-card workflow
- [ADMISSIONS.md](./ADMISSIONS.md) — admissions workflow and public intake
- [NOTIFICATIONS_DELIVERY.md](./NOTIFICATIONS_DELIVERY.md) — notification delivery architecture

## Roadmap and engineering control

- [DOMAIN_STATUS.md](./DOMAIN_STATUS.md) — domain queue, completion rules and remaining implementation sequence
- [product/FUNDA360-TOP-TIER-KANBAN.md](./product/FUNDA360-TOP-TIER-KANBAN.md) — detailed product backlog and verification history

## Documentation rule

These documents form the official engineering and business foundation for Funda360. However, **the code is the authority for current implementation**.

When documentation conflicts with the repository:
1. Inspect the implementation.
2. Correct the documentation.
3. Record whether the capability is implemented, partial, externally blocked, or planned.
4. Do not present roadmap functionality as shipped functionality.

This keeps Funda360's technical, product, sales and investor-facing claims aligned with what the platform actually does.
