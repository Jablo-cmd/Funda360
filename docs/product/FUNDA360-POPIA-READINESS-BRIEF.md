<title>Funda360 — POPIA Readiness Brief</title>

# Funda360 — POPIA Readiness Brief

**Status: engagement kickoff artifact (FND-SEC-010, Wave 1). Not a compliance determination.** This document does not claim POPIA compliance and cannot — that determination requires South African legal counsel or a qualified compliance consultant reviewing Funda360's actual data flows, the specific schools deploying it, and their own operational practices (who has access, how backups are handled, where support staff are located, etc.), none of which an engineering audit alone can certify. What follows is the concrete, factual input that engagement needs — a data inventory and a technical-controls summary — so the legal review can start immediately rather than waiting on a discovery phase.

---

## 1. What personal information Funda360 actually stores

Verified against the live schema (`supabase/migrations/`), not assumed:

| Category | Fields | Table(s) | Data subjects |
|---|---|---|---|
| Learner identity | Name, date of birth, ID/passport number, nationality, home language, gender, photo (path only, no upload UI wired yet) | `learners` | Minors (the large majority of Funda360's data subjects) |
| Learner medical | Allergies, medication, medical conditions, doctor/medical aid details | `learner_medical_information` | Minors — **special personal information** under POPIA §26 (health information) |
| Learner behaviour | Incident descriptions, action taken, outcome | `behaviour_incidents` | Minors |
| Learner financial | Fee charges, payments, discounts/bursaries (means-adjacent), refunds | `learner_fee_*` | Minors (financially, the responsible party is the guardian) |
| Guardian identity | Name, contact details, address, ID number (free text) | `profiles`, `guardian_profile_details` | Adults |
| Employee identity | Name, contact, ID number, date of birth, banking/salary — **not currently stored** (no payroll module exists) | `employees` | Adults |
| Authentication | Email, hashed password (Supabase Auth / GoTrue, industry-standard bcrypt) | `auth.users` | All account holders |
| Audit trail | Who changed what, when (role changes, terminations, financial adjustments) | `audit_log` (added this session) | Staff acting as data subjects of their own actions |

**Not currently collected**: biometric data, precise location data, payroll/banking details, religious/political/trade-union affiliation, criminal history. If any future module introduces these, this brief needs revisiting before that module ships.

## 2. Technical controls already in place (verified, not aspirational)

| Control | Evidence |
|---|---|
| Tenant isolation | Every table scoped by `school_id`, enforced by Row Level Security + `FORCE ROW LEVEL SECURITY` on all 28 tables — verified by 332 automated regression tests including explicit cross-tenant access attempts (`supabase/rls-tests/`) |
| Role-based access | 24-role permission model, enforced identically at the database layer (RLS) and the application layer — a UI bug can never grant more access than the database allows |
| Special-category data (medical) | Separately gated from general learner data — `can_view_learner_medical()`/`can_manage_learner_medical()` restrict to `school_owner`/`principal`/`medical_officer` only, not the broader staff set that can see general learner records |
| Password storage | Delegated entirely to Supabase Auth (GoTrue) — bcrypt-hashed, never stored or logged in plaintext by Funda360's own code |
| Audit trail | `audit_log` (this session) — append-only, no update/delete policy for any authenticated role, covering role changes, employee termination/reactivation, learner status changes, and financial refunds/adjustments |
| Encryption in transit | HTTPS enforced by the Supabase-hosted API layer (standard for any hosted Supabase project) |
| No service-role key in the client | Verified — only the anon/publishable key ships to the browser; RLS is the actual boundary, documented explicitly in `.env.example` |

## 3. Gaps a compliance review will need to weigh in on

These are not yet resolved and are correctly outside engineering's authority to resolve unilaterally:

1. **Data retention & deletion policy** (FND-SEC-008) — no defined retention period for a learner who leaves the school, no purge mechanism (current architecture is soft-delete/deactivate only, by design — see `docs/FUNDA360_KNOWN_LIMITATIONS.md`). POPIA §14 requires personal information not be retained longer than necessary. **Needs a decision**: how long after a learner/guardian/employee leaves should their record be retained, and what "deletion" means for a system that currently never hard-deletes anything.
2. **Information Officer designation** — POPIA requires every responsible party (each school, or Funda360 as an operator on their behalf, depending on the actual contractual relationship) to register an Information Officer with the Information Regulator. This is an organizational, not technical, requirement.
3. **Consent management** (FND-SEC-009) — no explicit consent-capture UI exists yet for guardians (data processing, photo/media use). POPIA's lawful-processing conditions may already be satisfied via the school-enrollment contract for core processing, but this needs a legal determination, not an engineering guess.
4. **Operator vs. responsible party** — whether Funda360 (the platform operator) is itself a POPIA "operator" processing data on each school's behalf, or whether each school is independently the responsible party, changes which contractual instruments (operator agreements) are required. This is a legal/commercial question, not a technical one.
5. **Cross-border data transfer** — where the underlying Supabase project is hosted (region) determines whether POPIA §72's cross-border transfer conditions apply. Needs confirming against the actual hosting region chosen for production.
6. **Breach notification procedure** — POPIA §22 requires notifying the Regulator and affected data subjects "as soon as reasonably possible" after a breach is discovered. No documented incident-response procedure exists yet (ties to Release Gate 10, commercial readiness).
7. **Data subject access/deletion requests** — no self-service or staff-assisted workflow exists yet for a guardian to request a copy of, or the deletion of, their own or their child's data (POPIA §23-25).

## 4. Recommended immediate action

Engage a South African attorney or POPIA compliance consultant with this document, the data inventory above, and read access to this repository's `supabase/migrations/` (the actual schema is the ground truth — the acronym-titled docs under `docs/` were flagged during this session's audit as AI-generated aspirational drafts, not verified specifications, and should not be handed to counsel as if they were).

**This can start today** — none of the above requires further engineering work to begin the legal conversation. Items 1 and 3 (retention policy, consent capture) have a concrete engineering task once the legal/policy decision is made (`FND-SEC-008`, `FND-SEC-009` — see the Kanban); the rest are governance/contractual work.

---

*Compiled as part of this session's Wave 1 execution (FND-SEC-010). The blocked status — external legal sign-off — is unchanged; what changed is that the engagement now has a concrete, factual starting point instead of an empty backlog line.*
