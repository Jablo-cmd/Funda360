# Offline and low-resource delivery: architecture and minimum viable workflow

Status: **design only. Nothing here is implemented**, and the system must not claim to work offline.
`teaching_resources.cacheable` records that a resource is small structured JSON that *could* be stored; it does not mean it *is*.

## What is already true

- Resource bodies are small whitelisted JSON, with `size_kb`, `connectivity`, `device` and `projector_required` recorded per resource.
- A lesson cannot be published without a path that needs no projector, no data and no learner device (database rule, plus validation).
- Content is immutable once published and versioned by `lineage_id` + `version_number`, so a cached copy is identifiable and never silently changes.
- Progress is derived from recorded attempts only, so late-arriving attempts are safe to apply if they carry their time.

## Minimum viable offline workflow (teacher laptop or phone)

Scope: one teacher, one class, one topic. Read-only teaching pack plus queued results. No learner devices.

1. **Pack**: when online, the teacher taps "Save this topic for offline". The app fetches the published lesson, its resources (bodies), activities and the quick-check questions (**without answer keys**) for the class's current topic and stores them in IndexedDB with `(unit id, version_number, fetched_at)`.
2. **Teach offline**: the Learning hub renders from the pack when the network is unavailable and says so ("Saved on this device, last updated ...").
3. **Record results offline**: results are written to a local queue, each with a client-generated `client_attempt_id` (UUID), learner id, assessment id, score, and `recorded_at` from the device.
4. **Sync**: when online, the queue is replayed in order through `record_learning_attempt`. Retry with exponential backoff; the queue survives reloads.
5. **Refresh**: on reconnect the pack checks for a newer `version_number` or a retirement and tells the teacher what changed.

## Required changes before building (not present today)

| Need | Why | Proposal |
| --- | --- | --- |
| Idempotent attempts | a retried upload must not create a second attempt | add `client_attempt_id uuid` to `learning_attempts` with `unique (school_id, client_attempt_id)`; `record_learning_attempt` returns the existing row when it has seen the id |
| Client time | "latest" ordering uses server time today | accept `p_recorded_at`, clamp it to `[now() - 14 days, now()]`, store both it and `created_at`; order progress by `recorded_at` |
| Pack endpoint | one request instead of many | an RPC returning the topic pack for a class the caller teaches (same checks as the hub), without keys |
| Tombstones | retired content must disappear from devices | the pack check returns retired/superseded ids |

## Conflict handling and audit safety

- The server is the source of truth. A queued attempt is accepted if the teacher still teaches the class, the learner is still enrolled and the assessment is still published (or was when recorded; decide per policy and document it).
- A rejected item is kept in the queue with a plain reason for the teacher to resolve; it is never dropped silently.
- Every applied attempt keeps `created_at` (server) and `recorded_at` (device) so reconciliation is auditable; the audit log records the sync batch.
- Learner personal data on the device is limited to what the roster already shows the teacher, stored per signed-in user, and cleared on sign-out.

## Out of scope on purpose

Learner-device offline play, peer-to-peer sync, offline media, background sync on iOS, conflict-free editing of content. Each needs its own design and test plan.

## Test plan when implemented

Service-worker/IndexedDB tests with the network blocked (Playwright `context.setOffline`), replay after reload, duplicate replay (idempotency), retired-content tombstone, clock-skew clamping, sign-out wipe, and 320px layout of the offline banner.
