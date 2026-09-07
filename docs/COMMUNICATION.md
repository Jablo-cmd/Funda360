# Communication & Notifications

Domain 4. Migration: `supabase/migrations/20260907090000_communication.sql`.

This domain adds **two-way threaded messaging** and **per-user notification
preferences** on top of the pre-existing one-way primitives (`announcements`
broadcasts, the `notifications` in-app inbox), and introduces the
**multi-channel delivery architecture** (email / SMS / WhatsApp) — see
[NOTIFICATIONS_DELIVERY.md](./NOTIFICATIONS_DELIVERY.md).

## Messaging

| Table | Purpose |
| ----- | ------- |
| `conversations` | A thread. `kind` = `direct` (exactly 2 people) or `group`. `subject` optional. `last_message_at` / `message_count` are denormalised for the list view. |
| `conversation_participants` | Membership, one row per profile. `last_read_at` is the per-user read cursor; `archived` / `muted` are per-user views. |
| `messages` | Append-only stream. `edited_at` / `deleted_at` are soft markers set only by the sender. A deleted message keeps its row with a `(message deleted)` tombstone. |
| `message_attachments` | Files on a message, in the private `message-attachments` bucket (`<school_id>/<conversation_id>/<filename>`). |

### Who can talk to whom — `can_message_profile(target)`

- **Staff** (any role that is not `parent` / `guardian` / `learner`) may start a conversation with **any active profile in their own tenant**.
- A **guardian** may only converse with **staff** — never guardian↔guardian, never guardian↔learner. (Learner accounts do not exist yet; the rule is applied defensively so Domain 8 inherits it.)
- Cross-tenant is impossible — the target must share the caller's `current_tenant_id()`.
- There is **no new `Permission`** — messaging is open to every authenticated tenant member, like email. The restriction is purely on the counterparty. Nav visibility is unconditional.

### RPCs (all `SECURITY DEFINER`, `authenticated`-granted, `revoke … from public`)

| RPC | Notes |
| --- | ----- |
| `start_conversation(participant_ids[], body, subject?, kind?)` | Validates every target via `can_message_profile`. A `direct` conversation between the same two people is **reused**, not duplicated (the first message is appended to the existing thread). Writes `audit_log`. |
| `send_message(conversation_id, body)` | Participant-only. Bumps `last_message_at` / `message_count`, advances the sender's read cursor, un-archives the thread for everyone, and fans out a `message` notification to every other **non-muted** participant (routing `link_path` to `/messages/…` or `/parent/messages/…` by recipient role). |
| `edit_message` / `delete_message` | Sender-only. Delete is soft. |
| `mark_conversation_read(conversation_id)` | Sets the caller's `last_read_at = now()`. |
| `set_conversation_flags(conversation_id, archived?, muted?)` | Caller's own participant row only. |
| `add_conversation_participants(conversation_id, profile_ids[])` | Group threads only, **staff only**, each target re-checked against `can_message_profile`. |
| `register_message_attachment(message_id, label, storage_path, mime?, size?)` | Sender-only; called after the client uploads to the bucket. |

### RLS

All four tables are `ENABLE` + `FORCE ROW LEVEL SECURITY`, fail-closed.

- `conversations` / `messages` / `message_attachments`: **SELECT only**, gated by `is_conversation_participant(id)` (or `is_platform_admin()`). No client INSERT/UPDATE/DELETE — the RPCs own all writes.
- `conversation_participants`: SELECT for participants; **UPDATE only your own row**, and the `conversation_participants_protect` trigger pins that update to `last_read_at` / `archived` / `muted` (you cannot repoint your row to another conversation or profile). INSERT is impossible for `authenticated`; the RPC path sets `app.allow_conversation_write` to pass the guard. DELETE is intentionally not trapped so participant rows still cascade when a profile or conversation is removed.
- `*_validate_tenant` triggers keep `school_id` consistent between a conversation and its participants / messages.
- Storage: the `message-attachments` bucket is private; read + write are both gated by `is_conversation_participant((storage.foldername(name))[2]::uuid)`.

## Notification preferences

`notification_preferences` — one row per profile, **own-row RLS** (`profile_id = auth.uid()`), never deleted (upsert). `notification_preferences_validate` forces `profile_id = auth.uid()` and stamps `school_id` from the profile.

- `email_enabled` / `sms_enabled` / `whatsapp_enabled` — opt-in per channel. **In-app is always on and is deliberately not representable here** (it is the system of record).
- `type_overrides` (`jsonb`, shape `{ "<type>": { "email": false, "sms": true } }`) — silence or enable a single notification `type` on one channel without touching the global toggle. The current UI does not expose this yet; the data model and `resolve_notification_channels()` honour it.
- `quiet_hours_start` / `quiet_hours_end` (local time, Africa/Johannesburg; a window may wrap midnight) — only delays external deliveries (`scheduled_for`), never the in-app row.

UI: `/notifications/settings` (staff) and `/parent/notifications/settings` (guardians).

## New notification producer

`behaviour_incidents_notify_guardians()` — an `AFTER INSERT OR UPDATE` trigger on `behaviour_incidents`. When an incident is (or becomes) `guardian_visible AND active`, each of the learner's active guardians gets one `behaviour_incident` notification. It mirrors the same opt-in visibility model as `get_guardian_visible_behaviour_incidents()` — a staff-only incident never notifies — and is idempotent (never a second notification for the same incident to the same guardian).

Report-published, invoice-issued, payment-settled, attendance-streak, fee-overdue and document-expiry producers already existed and are unchanged; they now also benefit from the delivery fan-out because it lives inside `create_notification()`.

## Verification

`tsc` · `eslint` · `vitest` (11 new, `conversationDisplay.test.ts`) · RLS harness `communication.test.sql` (28 new) · `vite build` · `messaging.spec.ts` E2E (3) · `notifications-dispatch/index.ts` added to the CI `deno check` list.
