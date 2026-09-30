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
-- A2. Membership checks honour account status and MFA too.
-- Guardian / learner / teacher / conversation access used to bypass
-- current_tenant_id(), so a deactivated guardian (or an MFA-pending session)
-- could still read their child's records. Every membership helper now also
-- requires an active, MFA-satisfied session in a school.
-- ---------------------------------------------------------------------------

create or replace function public.is_learner_guardian(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.current_tenant_id() is not null and exists (
    select 1 from public.learner_guardians
    where learner_id = p_learner_id and guardian_profile_id = auth.uid() and active
  )
$$;

create or replace function public.is_learner_self(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.current_tenant_id() is not null
     and exists (select 1 from public.learners where id = p_learner_id and profile_id = auth.uid())
$$;

create or replace function public.is_teacher_of_enrolled_learner(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.current_tenant_id() is not null and exists (
    select 1
    from public.learner_enrollments le
    join public.class_teacher_assignments cta on cta.class_id = le.class_id
    where le.learner_id = p_learner_id
      and le.enrollment_status = 'enrolled'
      and cta.teacher_profile_id = auth.uid()
      and cta.active
  )
$$;

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.current_tenant_id() is not null and exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and profile_id = auth.uid()
  )
$$;

-- Account provisioning (audit finding): a caller with no active school — a
-- deactivated principal whose JWT has not expired, or an MFA-pending session
-- — could still create tenantless accounts, because only the role was
-- checked. Only platform admins may create users outside an active school.
-- Emails are also compared case-insensitively (GoTrue stores them lower-case).
create or replace function public.admin_create_user(p_email text, p_first_name text, p_last_name text, p_phone text, p_role user_role, p_tenant_id uuid default null::uuid)
returns table(user_id uuid, temporary_password text)
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  v_effective_tenant uuid;
  v_new_user_id uuid;
  v_temp_password text;
begin
  perform public.check_rate_limit('account_provisioning', 20, interval '1 hour');

  if public.is_platform_admin() then
    v_effective_tenant := coalesce(p_tenant_id, public.current_tenant_id());
  else
    v_effective_tenant := public.current_tenant_id();
  end if;

  if not public.is_platform_admin()
     and (v_effective_tenant is null or not public.can_manage_profiles(v_effective_tenant)) then
    raise exception 'insufficient_privilege: no active school to create users in';
  end if;

  if not public.can_assign_role(p_role, null) then
    raise exception 'insufficient_privilege: cannot create a user with role %', p_role;
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = lower(trim(p_email))) then
    raise exception 'email_taken: % is already registered', p_email;
  end if;

  v_new_user_id := gen_random_uuid();
  v_temp_password := encode(gen_random_bytes(18), 'base64');

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_new_user_id, 'authenticated', 'authenticated', p_email,
    crypt(v_temp_password, gen_salt('bf')), now(),
    jsonb_build_object(
      'provider', 'email', 'providers', jsonb_build_array('email'),
      'role', p_role, 'tenant_id', v_effective_tenant
    ),
    jsonb_build_object('first_name', p_first_name, 'last_name', p_last_name),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_new_user_id,
    jsonb_build_object('sub', v_new_user_id::text, 'email', p_email),
    'email', v_new_user_id::text, now(), now(), now()
  );

  insert into public.profiles (id, tenant_id, first_name, last_name, email, phone, role, status)
  values (v_new_user_id, v_effective_tenant, p_first_name, p_last_name, p_email, p_phone, p_role, 'active');

  return query select v_new_user_id, v_temp_password;
end;
$function$;

-- ---------------------------------------------------------------------------
-- B1. Per-query membership sets (same active-session requirement as A2)
-- ---------------------------------------------------------------------------

create or replace function public.my_guardian_learner_ids()
returns uuid[] language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(learner_id), '{}') from public.learner_guardians
  where guardian_profile_id = auth.uid() and active and public.current_tenant_id() is not null
$$;

create or replace function public.my_self_learner_ids()
returns uuid[] language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(id), '{}') from public.learners
  where profile_id = auth.uid() and public.current_tenant_id() is not null
$$;

create or replace function public.my_taught_learner_ids()
returns uuid[] language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(distinct le.learner_id), '{}')
  from public.learner_enrollments le
  join public.class_teacher_assignments cta on cta.class_id = le.class_id
  where le.enrollment_status = 'enrolled' and cta.teacher_profile_id = auth.uid() and cta.active
    and public.current_tenant_id() is not null
$$;

create or replace function public.my_conversation_ids()
returns uuid[] language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(conversation_id), '{}') from public.conversation_participants
  where profile_id = auth.uid() and public.current_tenant_id() is not null
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
  -- Idempotent by construction: every pattern skips a call that is already in
  -- optimized form. pg_get_expr prints a wrapped call as "( SELECT f() AS f)"
  -- and the admin-guarded helper copy as "... AS is_platform_admin) AND h(col)".

  -- 3. Bare session calls (first, so text inserted below is not re-wrapped).
  e := regexp_replace(e, '(?<![a-z_.])(?<!SELECT )(auth\.)?uid\(\)', '(select auth.uid())', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(?<!SELECT )(auth\.)?jwt\(\)', '(select auth.jwt())', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(?<!SELECT )(public\.)?current_tenant_id\(\)', '(select public.current_tenant_id())', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(?<!SELECT )(public\.)?is_platform_admin\(\)', '(select public.is_platform_admin())', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(?<!SELECT )(public\.)?is_family_role\(\)', '(select public.is_family_role())', 'g');

  -- 2. Row-membership helpers.
  e := regexp_replace(e, '(?<![a-z_.])(public\.)?is_learner_guardian\(' || col || '\)', '(\2 = any ((select public.my_guardian_learner_ids())::uuid[]))', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(public\.)?is_learner_self\(' || col || '\)', '(\2 = any ((select public.my_self_learner_ids())::uuid[]))', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(public\.)?is_teacher_of_enrolled_learner\(' || col || '\)', '(\2 = any ((select public.my_taught_learner_ids())::uuid[]))', 'g');
  e := regexp_replace(e, '(?<![a-z_.])(public\.)?is_conversation_participant\(' || col || '\)', '(\2 = any ((select public.my_conversation_ids())::uuid[]))', 'g');

  -- 1. Single-school helpers (skipping the admin-guarded copy this function emits).
  foreach h in array public.rls_single_school_helpers() loop
    e := regexp_replace(
      e,
      '(?<![a-z_.])(?<!is_platform_admin\) AND )(?<!is_platform_admin\(\)\) and )(public\.)?' || h || '\(' || col || '\)',
      '(((select public.is_platform_admin()) and public.' || h || '(\2)) or (\2 = (select public.current_tenant_id()) and (select public.' || h || '((select public.current_tenant_id())))))',
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
