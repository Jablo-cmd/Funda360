# Platform owner workspace

This applies to the platform roles: `platform_owner`, `super_administrator` and `platform_administrator`. It replaced the earlier set-up on 2026-10-24, after a review found three problems:

- the dashboard showed placeholder words instead of figures;
- the sidebar listed 47 items of a school's day-to-day work;
- platform roles could read every school's safeguarding, medical, behaviour and message records.

## 1. Support access (no standing access to sensitive records)

Migration `20261024090000_platform_support_access`.

Platform roles have **no** standing access to a school's:

- safeguarding concerns;
- learner medical information;
- behaviour incidents;
- conversations (messages, attachments, participants).

To see any of these, a platform user requests **support access**:

| Step    | Who                                    | Where                                          | What happens                                                                                                                                                       |
| ------- | -------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Request | Platform user                          | `/support-access`                              | One school; areas: safeguarding, medical, behaviour, messages; a reason (10 to 1000 characters); 1 to 72 hours. The school's owner and principal are notified.     |
| Decide  | That school's owner or principal       | Trust Center → Support access (`/compliance#support-access`) | Approve (optionally with a note) or decline. The requester is notified. A platform user can never approve their own request.                                       |
| Use     | The requester only                     | The normal school pages                        | Read-only, only the approved areas of that school, only from a two-factor (aal2) login, until the grant expires.                                                   |
| End     | The school, or the requester           | Same pages                                     | "End access now" / "Withdraw request". Expiry ends access on its own.                                                                                              |

Every request, decision and revocation is written to `audit_log`. Individual reads are not logged, because PostgREST reads are read-only transactions.

How it is enforced in the database:

- `platform_support_school_ids(scope)` returns the schools for which the caller holds an active grant. It is empty unless the caller is a platform admin in an aal2 session.
- The helpers `can_view_safeguarding`, `can_view_learner_medical` and `can_view_behaviour` use it.
- The `can_manage_*` helpers no longer include platform roles at all.
- The four conversation policies use it for the `messages` scope.

Same migration: `get_learner_record_package` now includes medical information and staff behaviour history only for callers who may read those areas, or for the learner's own family. Before, it included them for any staff member who can view learners.

Tests: `supabase/rls-tests/tests/zzzzzzzz_platform_support_access.test.sql`, `e2e/support-access.spec.ts`.

## 2. Sidebar

`src/features/rbac/constants/navigation.ts`: `isPlatformRole()`, and the `platform` field on each nav item.

- **No school selected:**
  - Dashboard;
  - Platform: Schools, Users & Roles, Support Access;
  - Government: the five reporting pages;
  - Notification Preferences;
  - My Profile.
- **After "Switch school":** the school's pages are added, and a banner names the school with a **Leave school** button (`leaveTenant()`). Messages and Announcements are never shown to platform roles, because they need the user's own school membership.

School roles are unchanged.

Tests: `src/features/rbac/constants/navigation.test.ts`, `e2e/platform-owner.spec.ts`.

## 3. Dashboard

Data comes from `get_platform_overview()` (migration `20261024091000_platform_overview`). It is for platform admins only and returns counts, no learner, guardian or message content.

The dashboard shows:

- **Figures:**
  - schools, active and new this month;
  - active learners;
  - users signed in this month and this week;
  - MFA coverage, for platform accounts and for school leaders.
- **Needs attention** (`src/features/dashboard/platformAttention.ts`), most serious first:
  - platform accounts without MFA;
  - demo accounts with platform access;
  - overdue data subject requests;
  - failed scheduled jobs;
  - school leaders without MFA;
  - pending support requests;
  - unverified payment callbacks;
  - failed notifications;
  - schools still onboarding.
- **Platform health:**
  - database version;
  - failed scheduled jobs;
  - notification backlog;
  - unverified payment callbacks;
  - Funda AI requests.
- **Privacy and support access** and **Government reporting** counts.
- A table of schools: learners, staff and guardians per school.
- Recent administrative actions, from `audit_log`.
- Quick actions.

Tests: `supabase/rls-tests/tests/zzzzzzzzz_platform_overview.test.sql`, `src/features/dashboard/platformAttention.test.ts`, `e2e/platform-owner.spec.ts`.
