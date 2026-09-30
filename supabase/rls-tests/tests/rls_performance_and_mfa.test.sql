-- Regression suite for 20260930110000_rls_performance_and_mfa.sql.

-- ---------------------------------------------------------------------------
-- Performance lint: every policy on a public table must already be in the
-- optimized (InitPlan) form, i.e. rls_optimize_expression() changes nothing.
-- A new policy written as `can_view_learners(school_id)` or with a bare
-- `auth.uid()` fails here — run `select public.rls_optimize_policies();` at
-- the end of the migration that adds it, or write the optimized form.
do $$
declare v_bad text;
begin
  select string_agg(c.relname || '.' || p.polname, ', ') into v_bad
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and (public.rls_optimize_expression(pg_get_expr(p.polqual, p.polrelid)) is distinct from pg_get_expr(p.polqual, p.polrelid)
      or public.rls_optimize_expression(pg_get_expr(p.polwithcheck, p.polrelid)) is distinct from pg_get_expr(p.polwithcheck, p.polrelid));
  call test_util.record('perf lint: every public policy evaluates session helpers once per query', v_bad is null, coalesce(v_bad, ''));
end $$;

do $$
declare v_n int;
begin
  v_n := public.rls_optimize_policies();
  call test_util.record('perf: rls_optimize_policies() is idempotent', v_n = 0, 'rewrote ' || v_n);
end $$;

do $$
begin
  call test_util.record('perf: the policy rewriter is not callable by clients',
    not has_function_privilege('authenticated', 'public.rls_optimize_policies()', 'execute')
    and not has_function_privilege('anon', 'public.rls_optimize_expression(text)', 'execute'), '');
end $$;

-- ---------------------------------------------------------------------------
-- Server-side MFA
-- ---------------------------------------------------------------------------

create or replace function pg_temp.as_user_aal(p_id uuid, p_role text, p_tenant uuid, p_aal text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (test_util.jwt_claims(p_id, p_role, p_tenant)::jsonb || jsonb_build_object('aal', p_aal))::text, true);
  execute 'set local role authenticated';
end $$;

-- Without an MFA factor, an aal1 session works exactly as before.
do $$
declare v_tenant uuid; v_learners int;
begin
  perform pg_temp.as_user_aal('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal1');
  v_tenant := public.current_tenant_id();
  select count(*) into v_learners from public.learners;
  execute 'reset role';
  call test_util.record('MFA: a user without MFA keeps access on a password-only session',
    v_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and v_learners > 0, 'learners=' || v_learners);
end $$;

-- An MFA-enrolled principal on a password-only (aal1) session reaches nothing…
do $$
declare v_tenant uuid; v_learners int; v_err text := '';
begin
  insert into auth.mfa_factors (user_id, status) values ('77777777-7777-7777-7777-777777777777', 'verified');
  perform pg_temp.as_user_aal('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal1');
  v_tenant := public.current_tenant_id();
  select count(*) into v_learners from public.learners;
  begin
    perform public.admin_create_user('mfa.bypass@schoola.test', 'M', 'B', null, 'teacher');
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  execute 'reset role';
  call test_util.record('MFA: an enrolled user on an aal1 session gets no tenant', v_tenant is null, coalesce(v_tenant::text, 'null'));
  call test_util.record('MFA: an enrolled user on an aal1 session sees no learners', v_learners = 0, 'learners=' || v_learners);
  call test_util.record('MFA: an enrolled user on an aal1 session cannot call privileged RPCs', v_err like 'insufficient_privilege%', v_err);
end $$;

-- …and full access returns once the session has passed the MFA challenge.
do $$
declare v_tenant uuid; v_learners int;
begin
  perform pg_temp.as_user_aal('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal2');
  v_tenant := public.current_tenant_id();
  select count(*) into v_learners from public.learners;
  execute 'reset role';
  delete from auth.mfa_factors where user_id = '77777777-7777-7777-7777-777777777777';
  call test_util.record('MFA: the same user on an aal2 session has full access',
    v_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and v_learners > 0, 'learners=' || v_learners);
end $$;

-- An unverified (abandoned) enrolment does not lock the user out.
do $$
declare v_tenant uuid;
begin
  insert into auth.mfa_factors (user_id, status) values ('77777777-7777-7777-7777-777777777777', 'unverified');
  perform pg_temp.as_user_aal('77777777-7777-7777-7777-777777777777', 'principal', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal1');
  v_tenant := public.current_tenant_id();
  execute 'reset role';
  delete from auth.mfa_factors where user_id = '77777777-7777-7777-7777-777777777777';
  call test_util.record('MFA: an unverified factor does not require aal2', v_tenant is not null, coalesce(v_tenant::text, 'null'));
end $$;

-- Platform admins: an enrolled super admin on aal1 loses the cross-tenant bypass.
do $$
declare v_admin boolean; v_admin2 boolean;
begin
  insert into auth.mfa_factors (user_id, status) values ('44444444-4444-4444-4444-444444444444', 'verified');
  perform pg_temp.as_user_aal('44444444-4444-4444-4444-444444444444', 'super_administrator', null, 'aal1');
  v_admin := public.is_platform_admin();
  execute 'reset role';
  perform pg_temp.as_user_aal('44444444-4444-4444-4444-444444444444', 'super_administrator', null, 'aal2');
  v_admin2 := public.is_platform_admin();
  execute 'reset role';
  delete from auth.mfa_factors where user_id = '44444444-4444-4444-4444-444444444444';
  call test_util.record('MFA: an enrolled platform admin on aal1 is not a platform admin', not v_admin, '');
  call test_util.record('MFA: the same platform admin on aal2 is', v_admin2, '');
end $$;

-- A guardian enrolled in MFA on aal1 cannot see their child's records either.
do $$
declare v_rows int;
begin
  insert into auth.mfa_factors (user_id, status) values ('55555555-5555-5555-5555-555555555555', 'verified');
  perform pg_temp.as_user_aal('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aal1');
  select count(*) into v_rows from public.learners;
  execute 'reset role';
  delete from auth.mfa_factors where user_id = '55555555-5555-5555-5555-555555555555';
  call test_util.record('MFA: an enrolled guardian on aal1 sees no learner records', v_rows = 0, 'rows=' || v_rows);
end $$;
