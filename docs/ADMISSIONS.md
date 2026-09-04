# Admissions

Domain 3 of `DOMAIN_STATUS.md`. A real `admission_applications` entity with
a full review workflow and safe conversion to a learner + guardian +
enrolment. Migration: `20260905090000_admissions.sql`. Feature code:
`src/features/admissions/`. Edge Function: `supabase/functions/admissions-public/`.

## Reconciliation with the old pipeline

Before this domain, `/admissions` was a Kanban that moved
`learners.status` (`prospective → applied → accepted → enrolled`) for
learner records **that already existed**. It could not represent a family
who is not yet in the system. That board, its hook
(`useAdmissionsPipeline`), and the `ADMISSIONS_PIPELINE_STAGES` /
`ADMISSIONS_NEXT_STATUS` constants are **removed**. The `learners.status`
enum and its forward-only transition whitelist (`20260803190000`) are
**unchanged** — a converted applicant's learner record still enters at
`accepted` and is promoted to `active` by the normal learner lifecycle.

## Entities

| Table | Purpose |
| --- | --- |
| `admission_applications` | One family's application to enrol one learner. Applicant + learner free-text fields, requested year/grade, `reference_number` (gap-free per school), `status`, secret `resume_token`, decision fields, `converted_learner_id`. `status` / `reference_number` / `decision_*` / `converted_learner_id` / `submitted_at` / `resume_token` are **RPC-only** (`admission_applications_protect` trigger). Free-text data is staff-editable while the status is pre-decision (`draft` / `submitted` / `under_review` / `incomplete`). Never hard-deleted. |
| `admission_document_requirements` | Per-school (optionally per-grade) list of documents an application should include. Shown on the public form. |
| `admission_application_documents` | Uploaded files → private `admission-documents` storage bucket (path `<school>/<application>/<file>`). Staff-verifiable. |
| `admission_application_events` | Append-only per-application timeline (created / submitted / status changes / notes / document uploads / converted). Written only by the workflow RPCs. |
| `admission_counters` | Gap-free per-school sequence behind `next_admission_reference()` (and the learner/admission numbers minted at conversion). No RLS policy — RPC-only. |

## Workflow

`draft → submitted → under_review → { incomplete, interview_required, assessment_required, waitlisted } → accepted → enrolled`
plus `rejected` / `withdrawn` from most states, and `incomplete → submitted` (applicant re-submits). The exact allowed set is
`admission_can_transition(from, to)` in SQL, mirrored in
`ADMISSION_NEXT_STATUSES` in TS.

| Action | RPC | Who (DB-enforced) |
| --- | --- | --- |
| create (staff) | `create_admission_application` | `can_manage_admissions()` — admissions_officer / principal / school_owner / platform |
| submit | `submit_admission_application` | `can_manage_admissions()` (assigns the reference number) |
| move / decide | `transition_admission_application(id, to, note)` | `can_manage_admissions()` — rejects `to = 'enrolled'` (use convert), rejects an illegal transition |
| internal note | `add_admission_application_note` | `can_manage_admissions()` |
| **convert** | `convert_admission_application(id, class_id?, provision_guardian_account?)` | `can_manage_admissions()` — status must be `accepted`; idempotent (rejects if `converted_learner_id` set) |

### Conversion

`convert_admission_application` (one transaction):

1. Resolves the academic year (application's, else the school's active year) and requires a `requested_grade_id`.
2. Mints `LRN-YY-NNNNN` / `ADM-YY-NNNNN` off the per-school counter and inserts a `learners` row at status `accepted`.
3. **Guardian de-dup:** reuses an existing `profiles` row at that school with the same email; otherwise calls `admin_create_guardian()` (only if the email is not registered globally). Links `learner_guardians` (`on conflict do nothing`). Optionally fires `send_guardian_invitation()`.
4. Inserts `learner_enrollments` (year + grade + optional class, status `enrolled`).
5. Moves the application to `enrolled`, sets `converted_learner_id`, logs the event, writes `audit_log`.

## Public intake (no account)

A prospective family has no login (auth is invitation-only). They use a
public form at **`/apply?school=<id>`** (and **`/apply/resume`** to check a
status). The form talks only to the **`admissions-public` Edge Function**,
which holds the service-role key and calls the `public_*` RPCs (granted to
`service_role` only). **There is no `anon` RLS policy on any admissions
table.**

| Edge action | RPC | Scope |
| --- | --- | --- |
| `config` | direct service-role reads | school name + academic years + grades + document requirements |
| `start` | `public_start_admission_application` | creates a `draft`, returns a secret `resume_token` |
| `get` / `save` / `submit` | `public_get/save/submit_admission_application` | scoped by `resume_token`; `submit` assigns the reference and requires applicant + learner names |
| `resume` | `public_resume_admission_application` | scoped by **email + reference number**; returns a resume token only while `draft`/`incomplete` |
| `upload-url` / `register-doc` | signed upload URL + `public_register_admission_document` | scoped by `resume_token`; documents accepted while `draft`/`incomplete`/`submitted`/`under_review` |

The draft resume link (`/apply?school=…&t=<token>`) is shown on screen
after the first save. Emailing it to the applicant is a Domain 19 concern
(no generic transactional-mail path exists yet).

## RLS / security

- `can_view_admissions()` — school_owner / principal / vice_principal / admissions_officer / **receptionist** (front desk); `can_manage_admissions()` — school_owner / principal / admissions_officer. Platform admins for both.
- All 5 new tenant-scoped tables `ENABLE` + `FORCE ROW LEVEL SECURITY`, fail-closed.
- `admission_applications`: staff `SELECT` / `INSERT (draft only)` / `UPDATE` for managers; **no** `DELETE`. `status` etc. still trigger-guarded (`app.allow_admission_write`) so a manager's direct `UPDATE` cannot forge a decision — RLS-tested.
- `admission_application_events` has no client write policy (RPC/trigger only).
- `next_admission_reference()` and every `public_*` RPC: `revoke execute … from public` **and** `from authenticated` (or granted to `service_role` only). RLS-tested that an authenticated client cannot call them.
- Storage: the `admission-documents` bucket is private; `storage.objects` policies gate read/write on `can_view_admissions` / `can_manage_admissions` for segment-1 (school id). The public function uploads with the service-role key.

## UI

- `/admissions` — pipeline snapshot (clickable status tiles) + filterable list + "New application" + link to requirements.
- `/admissions/:id` — applicant + learner details (grade/year editable while pre-decision), documents panel (signed-URL view + verify), timeline + internal notes, the status-aware workflow bar, and the **Convert to learner** modal (class picker + guardian-invite toggle).
- `/admissions/requirements` — manage document requirements.
- `/apply`, `/apply/resume` — the public pages (outside the app shell / auth).

## Tests

- **RLS** (`supabase/rls-tests/tests/admissions.test.sql`, 21) — full staff workflow + conversion (learner + guardian link + enrolment produced), double-convert rejection, illegal-transition rejection, direct-status-UPDATE blocked (but draft data editable), receptionist view-not-manage, teacher sees nothing, cross-tenant isolation, `next_admission_reference` not client-callable, the public `start → save → submit → resume` round-trip + wrong-email rejection, public RPCs not authenticated-callable. Full harness **577 pass**.
- **E2E** (`e2e/admissions.spec.ts`, 4) — pipeline dashboard + list, work an application through the workflow and convert it, a role without `admission.view` is blocked, the public form renders for a valid school link.
- **CI**: `admissions-public/index.ts` added to the `deno check` list in the `edge-functions` job.

## Production activation

The `admissions-public` Edge Function must be deployed
(`supabase functions deploy admissions-public --no-verify-jwt`). It needs
only the standard `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` env (already
present for the payments functions) — **no third-party credentials**. Each
school shares its own `/apply?school=<its id>` link.

## Not in scope (deferred, non-blocking)

- Emailing the applicant their draft-resume link / decision letters (Domain 19).
- Configurable application forms per school (the field set is fixed).
- CAPTCHA / rate-limiting on the public form — the Edge Function is the single choke point where that would be added; the architecture is ready, the control is not wired.
- Interview / assessment **scheduling** UI — the `interview_at` / `assessment_at` columns exist and the statuses are in the workflow, but there is no calendar integration yet.
