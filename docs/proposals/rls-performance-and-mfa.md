# Proposal: RLS performance (P1-4) + server-side MFA (P1-2) — IMPLEMENTED

Status: **implemented** in `supabase/migrations/20260930110000_rls_performance_and_mfa.sql`
(written with explicit approval; not yet applied to production). Compared with
the draft below, the migration also:

- is idempotent (a second `rls_optimize_policies()` run rewrites 0 policies);
- makes the membership helpers (`is_learner_guardian`, `is_learner_self`,
  `is_teacher_of_enrolled_learner`, `is_conversation_participant` and the
  `my_*_ids()` arrays) return nothing without an active, MFA-satisfied tenant;
- makes `admin_create_user` refuse a caller with no active school instead of
  falling through to the JWT tenant.

Result on the benchmark database: 239 policies rewritten, identical row
fingerprints for all 1,984 identity x table pairs, and `count(*)` on 100k
attendance rows went from 10.8-29.6 s to 15-38 ms per caller. Regression
tests: `supabase/rls-tests/tests/rls_performance_and_mfa.test.sql`.

## Evidence (disposable Postgres 16 with every migration and the RLS fixtures, 100k attendance rows)

| Caller | `select count(*) from attendance_records` |
|---|---|
| postgres (RLS off) | 16 ms |
| principal | 10.2 s |
| guardian | 22.0 s |
| teacher | 10.7 s |
| other school's owner (0 visible rows) | 22.8 s |

Root cause: policies call helpers per row. Postgres cannot inline them because
they are SECURITY DEFINER, have a `SET search_path` clause, or contain a
sub-select in the body. So each row re-parses the JWT and re-reads `profiles`.

## Design

1. **MFA choke point:** `current_tenant_id()` and `is_platform_admin()`
   return no access when the caller has a verified factor in
   `auth.mfa_factors` but the JWT `aal` is not `aal2`. Users without MFA are
   unaffected, and the UI already routes enrolled users through the challenge.
   The RLS harness stub needs an `auth.mfa_factors` table.
2. **Policy rewrite (not helper rewrite).** For single-school helpers that
   satisfy `h(x) ⇒ is_platform_admin() ∨ x = current_tenant_id()` (verified
   for all 31 listed in the draft):
   `h(col) ⇒ ((select is_platform_admin()) and h(col)) or (col = (select current_tenant_id()) and (select h((select current_tenant_id()))))`.
   Row-membership helpers become `col = any((select my_guardian_learner_ids())::uuid[])`
   and the equivalent for self, taught learners and conversations.
3. **Verification plan:** capture a visibility fingerprint (row count plus an
   md5 of all visible rows, per identity per table, 16 identities × 124
   tables) before and after; require them to be identical. Then run the
   RLS suite and re-run the benchmark (target: under 1 s).

## Known gap in the draft below

`rls_optimize_expression()` is not yet idempotent. It relies on an
`rls_optimized` marker it never writes, so re-running it would re-wrap
already-optimized calls. The intended fix is to drop the marker and add
negative lookbehinds so the patterns skip calls that are already optimized:
`(?<!SELECT )` for the bare session calls, and
`(?<!is_platform_admin\) AND )` for the admin-guarded helper copy. Also add
an RLS-suite lint that fails on any policy calling a session helper outside
an InitPlan.

## Draft SQL

```sql
-- ============================================================================
-- RLS performance (audit P1-4) + server-side MFA enforcement (audit P1-2)
-- ============================================================================
--
-- PART A — MFA at the database choke point.
-- Every tenant-scoped authorization decision goes through
-- current_tenant_id(), and every cross-tenant one through
-- is_platform_admin(). Both now return "no access" when the caller has a
-- verified MFA factor but the session is only aal1 (password only). A stolen
-- password therefore no longer reaches any school data over the API for an
-- account that enrolled MFA. Users without MFA are unaffected, so nobody is
-- locked out; the UI already routes enrolled users through the challenge.
--
-- PART B — make RLS cost per query, not per row.
-- Before: SELECT count(*) over 100k attendance rows took ~10s as a principal
-- and ~22s as a guardian (16ms with RLS off). Every row re-ran helper
-- functions that parse the JWT and look up the caller's profile, because
-- Postgres cannot inline SECURITY DEFINER / SET-search_path functions or
-- functions whose body contains a sub-select.
--
-- Fix: rewrite the POLICY expressions (not the helpers) so every
-- session-constant part is an uncorrelated scalar sub-select, which Postgres
-- evaluates once per query (an InitPlan):
--
--  1. Single-school helpers h(col) — every one of them satisfies
--       h(x)  implies  is_platform_admin() OR x = current_tenant_id()
--     (verified for each helper listed in rls_single_school_helpers()).
--     Under that property this rewrite is exactly equivalent:
--       h(col)  ==>  ((SELECT is_platform_admin()) AND h(col))
--                     OR (col = (SELECT current_tenant_id())
--                         AND (SELECT h((SELECT current_tenant_id()))))
--     For everyone but platform admins the row test is a plain, indexable
--     equality; h() runs once per query.
--  2. Row-membership helpers become "col = ANY(<my ids, computed once>)":
--       is_learner_guardian(col)            ==> col = ANY(my_guardian_learner_ids())
--       is_learner_self(col)                ==> col = ANY(my_self_learner_ids())
--       is_teacher_of_enrolled_learner(col) ==> col = ANY(my_taught_learner_ids())
--       is_conversation_participant(col)    ==> col = ANY(my_conversation_ids())
--  3. Bare session calls are wrapped: auth.uid(), auth.jwt(),
--     current_tenant_id(), is_platform_admin(), is_family_role().
--
-- The helper functions keep their definitions and remain the right tool
-- inside RPCs. New policies must use the optimized form — the RLS suite's
-- rls_performance lint fails on a policy that does not.

-- ---------------------------------------------------------------------------
-- A. MFA-aware tenant and platform checks
-- ---------------------------------------------------------------------------

create or replace function public.session_mfa_satisfied()
returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status::text = 'verified'
      )
$$;

comment on function public.session_mfa_satisfied() is
  'False only when the caller has a verified MFA factor but this session has not completed the MFA challenge (aal1). Users without MFA always pass.';

create or replace function public.current_tenant_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select p.tenant_id from public.profiles p
  where p.id = auth.uid() and p.status = 'active' and public.session_mfa_satisfied()
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('platform_owner', 'super_administrator', 'platform_administrator')
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
    and public.session_mfa_satisfied()
$$;

revoke execute on function public.session_mfa_satisfied() from public, anon;
grant execute on function public.session_mfa_satisfied() to authenticated;

-- ---------------------------------------------------------------------------
-- B1. Per-query membership sets
-- ---------------------------------------------------------------------------

create or replace function public.my_guardian_learner_ids()
returns uuid[] language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(learner_id), '{}') from public.learner_guardians
  where guardian_profile_id = auth.uid() and active
$$;

create or replace function public.my_self_learner_ids()
returns uuid[] language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(id), '{}') from public.learners where profile_id = auth.uid()
$$;

create or replace function public.my_taught_learner_ids()
returns uuid[] language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(distinct le.learner_id), '{}')
  from public.learner_enrollments le
  join public.class_teacher_assignments cta on cta.class_id = le.class_id
  where le.enrollment_status = 'enrolled' and cta.teacher_profile_id = auth.uid() and cta.active
$$;

create or replace function public.my_conversation_ids()
returns uuid[] language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(conversation_id), '{}') from public.conversation_participants where profile_id = auth.uid()
$$;

do $$
declare f text;
begin
  foreach f in array array['public.my_guardian_learner_ids()', 'public.my_self_learner_ids()', 'public.my_taught_learner_ids()', 'public.my_conversation_ids()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- B2. The policy rewriter
-- ---------------------------------------------------------------------------

-- Helpers proven to satisfy  h(x) => is_platform_admin() OR x = current_tenant_id().
-- Only add a helper here after checking its body has that shape.
create or replace function public.rls_single_school_helpers()
returns text[] language sql immutable
as $$
  select array[
    'can_manage_academic', 'can_manage_academic_intervention', 'can_manage_admissions', 'can_manage_behaviour',
    'can_manage_employees', 'can_manage_learner_financial', 'can_manage_learner_medical', 'can_manage_learners',
    'can_manage_operations', 'can_manage_profiles', 'can_manage_safeguarding', 'can_manage_school', 'can_manage_transport',
    'can_view_academic', 'can_view_academic_intervention', 'can_view_academic_reference_as_guardian',
    'can_view_academic_reference_as_learner', 'can_view_academic_years_for_domain_roles', 'can_view_admissions',
    'can_view_behaviour', 'can_view_dsar', 'can_view_employees', 'can_view_governance', 'can_view_learner_financial',
    'can_view_learner_medical', 'can_view_learners', 'can_view_operations', 'can_view_report_cards',
    'can_view_safeguarding', 'can_view_transport', 'is_compliance_officer'
  ]
$$;

create or replace function public.rls_optimize_expression(p_expr text)
returns text language plpgsql immutable
as $$
declare
  e text := p_expr;
  h text;
  col constant text := '([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)';
begin
  if e is null then return null; end if;
  -- Idempotence: an expression that already carries the optimized markers is left alone.
  if e ~ 'rls_optimized' then return e; end if;

  -- 3. Bare session calls (done first so the text we insert below is not re-wrapped).
  e := regexp_replace(e, '(?<![a-z_.])auth\.uid\(\)', '(select auth.uid())', 'g');
  e := regexp_replace(e, '(?<![a-z_.])uid\(\)', '(select auth.uid())', 'g');
  e := regexp_replace(e, '(?<![a-z_.])auth\.jwt\(\)', '(select auth.jwt())', 'g');
  e := regexp_replace(e, '(?<![a-z_.])jwt\(\)', '(select auth.jwt())', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(?:public\.)?current_tenant_id\(\)', '(select public.current_tenant_id())', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(?:public\.)?is_platform_admin\(\)', '(select public.is_platform_admin())', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(?:public\.)?is_family_role\(\)', '(select public.is_family_role())', 'g');

  -- 2. Row-membership helpers.
  e := regexp_replace(e, '(?<![a-z_.])(?:public\.)?is_learner_guardian\(' || col || '\)', '(\1 = any ((select public.my_guardian_learner_ids())::uuid[]))', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(?:public\.)?is_learner_self\(' || col || '\)', '(\1 = any ((select public.my_self_learner_ids())::uuid[]))', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(?:public\.)?is_teacher_of_enrolled_learner\(' || col || '\)', '(\1 = any ((select public.my_taught_learner_ids())::uuid[]))', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(?:public\.)?is_conversation_participant\(' || col || '\)', '(\1 = any ((select public.my_conversation_ids())::uuid[]))', 'g');

  -- 1. Single-school helpers.
  foreach h in array public.rls_single_school_helpers() loop
    e := regexp_replace(
      e,
      '(?<![a-z_.])(?:public\.)?' || h || '\(' || col || '\)',
      '(((select public.is_platform_admin()) and public.' || h || '(\1)) or (\1 = (select public.current_tenant_id()) and (select public.' || h || '((select public.current_tenant_id())))))',
      'g'
    );
  end loop;
  return e;
end $$;

revoke execute on function public.rls_optimize_expression(text) from public, anon, authenticated;
revoke execute on function public.rls_single_school_helpers() from public, anon, authenticated;

-- Rewrites every policy on public tables (and is safe to re-run: unchanged
-- expressions are skipped). Future migrations that add policies may call
--   select public.rls_optimize_policies();
-- at their end, or write the optimized form directly.
create or replace function public.rls_optimize_policies()
returns integer language plpgsql
as $$
declare
  r record;
  v_using text;
  v_check text;
  n integer := 0;
begin
  for r in
    select p.polname, c.relname, p.polcmd,
           pg_get_expr(p.polqual, p.polrelid) as qual,
           pg_get_expr(p.polwithcheck, p.polrelid) as wcheck
    from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
  loop
    v_using := public.rls_optimize_expression(r.qual);
    v_check := public.rls_optimize_expression(r.wcheck);
    if v_using is distinct from r.qual or v_check is distinct from r.wcheck then
      execute format('alter policy %I on public.%I', r.polname, r.relname)
        || case when v_using is not null then format(' using (%s)', v_using) else '' end
        || case when v_check is not null then format(' with check (%s)', v_check) else '' end;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

revoke execute on function public.rls_optimize_policies() from public, anon, authenticated;

select public.rls_optimize_policies();
```
