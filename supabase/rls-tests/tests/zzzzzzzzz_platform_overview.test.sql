-- Regression suite for 20261024091000_platform_overview.sql:
-- get_platform_overview() is for platform administrators only and returns
-- counts, never learner content.

do $$
declare
  v_overview jsonb;
  v_schools int;
  v_learners int;
  v_school_error text;
  v_learner_name text;
  v_anon boolean;
  v_keys text;
begin
  select count(*) into v_schools from public.schools;
  select count(*) into v_learners from public.learners where status = 'active';
  select first_name into v_learner_name from public.learners where first_name is not null and char_length(first_name) >= 4 limit 1;

  perform set_config('request.jwt.claims',
    test_util.jwt_claims('44444444-4444-4444-4444-444444444444', 'platform_administrator', null), true);
  execute 'set local role authenticated';
  v_overview := public.get_platform_overview();
  execute 'reset role';

  perform set_config('request.jwt.claims',
    test_util.jwt_claims('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), true);
  execute 'set local role authenticated';
  begin
    perform public.get_platform_overview();
    v_school_error := 'a school owner read the platform overview';
  exception when others then
    v_school_error := null;
  end;
  execute 'reset role';

  v_anon := has_function_privilege('anon', 'public.get_platform_overview()', 'execute');
  select string_agg(k, ',') into v_keys from jsonb_object_keys(v_overview) k;

  call test_util.record('platform overview: counts every school and active learner',
    (v_overview -> 'schools' ->> 'total')::int = v_schools
      and jsonb_array_length(v_overview -> 'schools' -> 'list') = v_schools
      and (v_overview -> 'learners' ->> 'active')::int = v_learners,
    format('schools %s/%s learners %s/%s', v_overview -> 'schools' ->> 'total', v_schools,
      v_overview -> 'learners' ->> 'active', v_learners));
  call test_util.record('platform overview: reports security, health, compliance and government sections',
    v_overview ? 'security' and v_overview ? 'health' and v_overview ? 'compliance' and v_overview ? 'government'
      and (v_overview -> 'security' ? 'platform_with_mfa') and (v_overview -> 'users' ? 'signed_in_30d'),
    v_keys);
  call test_util.record('platform overview: contains no learner names',
    v_learner_name is null or position(lower(v_learner_name) in lower(v_overview::text)) = 0,
    coalesce(v_learner_name, 'no learner'));
  call test_util.record('platform overview: refused to a school owner', v_school_error is null, coalesce(v_school_error, 'refused'));
  call test_util.record('platform overview: not executable by anon', not v_anon, 'anon execute: ' || v_anon);
end $$;
