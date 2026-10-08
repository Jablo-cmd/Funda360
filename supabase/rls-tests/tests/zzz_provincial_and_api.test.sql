-- Regression suite for 20261010090000_provincial_dashboard_and_government_api.sql.
--
-- Runs after zz_government_reporting.test.sql and reuses its fixtures:
--   P1 Test Province One ── D1 ── C1 (circuit)      School A -> D1, R1 -> C1
--                        └─ D2                       R2 -> D2
--   P2 Test Province Two ── D3                       R3 -> D3
--   Officials: O1 D1, O2 D2 (learner detail), O3 P1, O4 no active grant,
--              O5 D1 revoked, O6 D1 inactive profile.
-- Added here:
--   O8 circuit C1 official, O9 school-level official for School A (learner
--   detail), and government API clients created through the admin RPC.

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated',
       'official' || n || '@department.test', jsonb_build_object('role', 'education_official')
from generate_series(8, 9) n;
insert into public.profiles (id, tenant_id, first_name, last_name, email, role, status)
select ('e0000000-0000-0000-0000-00000000000' || n)::uuid, null, 'Official', 'O' || n, 'official' || n || '@department.test',
       'education_official', 'active'
from generate_series(8, 9) n;
insert into public.education_official_assignments (profile_id, area_id) values
  ('e0000000-0000-0000-0000-000000000008', 'ea000000-0000-0000-0000-000000000111');

create table test_util.api_tokens (name text primary key, client_id uuid, token text);

-- Runs gov_api_request as the government-api Edge Function does (service
-- role JWT). Returns the response envelope, or {"error": message}.
create or replace function test_util.api_call(p_token text, p_method text, p_path text,
                                              p_query jsonb default '{}'::jsonb, p_body jsonb default null)
returns jsonb
language plpgsql
as $$
declare
  v jsonb;
  v_err text;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  begin
    v := public.gov_api_request(p_token, p_method, p_path, p_query, p_body, null);
  exception when others then
    get stacked diagnostics v_err = message_text;
    v := jsonb_build_object('error', v_err);
  end;
  execute 'reset role';
  return v;
end;
$$;

create or replace function test_util.tok(p_name text)
returns text
language sql
as $$ select token from test_util.api_tokens where name = p_name $$;

-- Sorted ids from an API list response (data[].id or data[].school_id).
create or replace function test_util.api_ids(p_resp jsonb)
returns text
language sql
as $$
  select coalesce(string_agg(coalesce(d ->> 'id', d ->> 'school_id'), ',' order by coalesce(d ->> 'id', d ->> 'school_id')), '')
  from jsonb_array_elements(coalesce(p_resp -> 'body' -> 'data', '[]'::jsonb)) d
$$;

-- ---------------------------------------------------------------------------
-- Provincial access and isolation
-- ---------------------------------------------------------------------------

do $$
declare
  v jsonb;
  v_ids text;
  v_d1 jsonb;
  v_sum int;
begin
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{}''::jsonb)');
  v_ids := test_util.gr_ids(v);
  call test_util.record('prov: province official sees every school in their province',
    v_ids = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,ec000000-0000-0000-0000-000000000001,ec000000-0000-0000-0000-000000000002',
    coalesce(v ->> 'error', v_ids));
  select sum((d ->> 'schools')::int) into v_sum from jsonb_array_elements(v -> 'districts') d;
  call test_util.record('prov: district comparison lists both districts of the province',
    jsonb_array_length(v -> 'districts') = 2
      and (v -> 'summary' ->> 'districts')::int = 2
      and v_sum = (v -> 'summary' ->> 'schools')::int,
    coalesce(v ->> 'error', (v -> 'districts')::text));

  select d into v_d1 from jsonb_array_elements(v -> 'districts') d where d ->> 'district_id' = 'ea000000-0000-0000-0000-000000000011';
  call test_util.record('prov: district row carries circuits, learners, interventions and data quality',
    (v_d1 ->> 'circuits')::int = 1 and (v_d1 ->> 'schools')::int = 2
      and (v_d1 -> 'interventions' ->> 'overdue')::int = 1 and (v_d1 ->> 'requires_attention')::boolean
      and (v_d1 ->> 'schools_with_data_quality_issues')::int = 2,
    coalesce(v_d1::text, 'missing'));

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000002'', ''{}''::jsonb)');
  call test_util.record('prov: province A official cannot read province B',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{}''::jsonb)');
  call test_util.record('prov: district official cannot escalate to their whole province',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000008', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{}''::jsonb)');
  call test_util.record('prov: circuit official cannot escalate to their province',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000008', 'education_official', null,
    'select public.get_government_report(''{"district_id":"ea000000-0000-0000-0000-000000000011"}''::jsonb)');
  call test_util.record('prov: circuit official naming their district still sees only their circuit',
    test_util.gr_ids(v) = 'ec000000-0000-0000-0000-000000000001', coalesce(v ->> 'error', test_util.gr_ids(v)));

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{"district_id":"ea000000-0000-0000-0000-000000000021"}''::jsonb)');
  call test_util.record('prov: a district filter from another province is refused',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{"school_id":"ec000000-0000-0000-0000-000000000003"}''::jsonb)');
  call test_util.record('prov: a school id from another province is refused',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{"province_id":"ea000000-0000-0000-0000-000000000002"}''::jsonb)');
  call test_util.record('prov: a province_id filter cannot switch provinces',
    test_util.gr_ids(v) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,ec000000-0000-0000-0000-000000000001,ec000000-0000-0000-0000-000000000002',
    coalesce(v ->> 'error', test_util.gr_ids(v)));

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{"district_id":"ea000000-0000-0000-0000-000000000011"}''::jsonb)');
  call test_util.record('prov: a district filter narrows the province',
    test_util.gr_ids(v) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,ec000000-0000-0000-0000-000000000001'
      and jsonb_array_length(v -> 'districts') = 1,
    coalesce(v ->> 'error', test_util.gr_ids(v)));

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000099'', ''{}''::jsonb)');
  call test_util.record('prov: an unknown province gets the same refusal as a foreign one',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000002'', ''{}''::jsonb)');
  call test_util.record('prov: platform administrator with MFA can open any province',
    test_util.gr_ids(v) = 'ec000000-0000-0000-0000-000000000003' and (v -> 'data_quality' ->> 'unlinked_schools') is not null,
    coalesce(v ->> 'error', test_util.gr_ids(v)));

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000002'', ''{}''::jsonb)', 'aal1');
  call test_util.record('prov: platform administrator without MFA is refused',
    coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{}''::jsonb)', 'aal1');
  call test_util.record('prov: province official without MFA is refused',
    coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{}''::jsonb)');
  call test_util.record('prov: school owner cannot open the provincial report',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{}''::jsonb)');
  call test_util.record('prov: teacher cannot open the provincial report',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000005', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{}''::jsonb)');
  call test_util.record('prov: an official with only a revoked grant is refused',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000006', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{}''::jsonb)');
  call test_util.record('prov: a deactivated official is refused',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_provincial_scope()');
  call test_util.record('prov: provincial scope lists only the provinces the caller may open',
    v::text = '[{"id": "ea000000-0000-0000-0000-000000000001", "code": "TP1", "name": "Test Province One"}]', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_provincial_scope()');
  call test_util.record('prov: a district official has no provinces to open', v::text = '[]', v::text);
end $$;

-- Anonymous callers.
do $$
declare
  v_err text;
begin
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin
    perform public.get_provincial_report('ea000000-0000-0000-0000-000000000001', '{}'::jsonb);
    v_err := 'executed';
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  reset role;
  call test_util.record('prov: anonymous callers cannot execute the provincial report', v_err like 'permission denied%', v_err);
end $$;

-- Definitions shared with the district dashboard.
do $$
declare
  v_prov jsonb;
  v_dist jsonb;
  v_d1 jsonb;
  v_r1 jsonb;
  v_a jsonb;
  v_opened int;
begin
  v_prov := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{}''::jsonb)');
  v_dist := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_government_report(''{"district_id":"ea000000-0000-0000-0000-000000000011"}''::jsonb)');
  select d into v_d1 from jsonb_array_elements(v_prov -> 'districts') d where d ->> 'district_id' = 'ea000000-0000-0000-0000-000000000011';
  call test_util.record('prov: district figures equal the district dashboard figures',
    (v_d1 ->> 'attendance_rate') is not distinct from (v_dist -> 'summary' ->> 'attendance_rate')
      and (v_d1 ->> 'average_percent') is not distinct from (v_dist -> 'summary' ->> 'average_percent')
      and (v_d1 ->> 'learners_enrolled')::int = (v_dist -> 'summary' ->> 'learners_enrolled')::int
      and (v_d1 ->> 'learners_requiring_intervention')::int = (v_dist -> 'summary' ->> 'learners_requiring_intervention')::int,
    format('province %s / district %s', v_d1, v_dist -> 'summary'));

  select s into v_r1 from jsonb_array_elements(v_prov -> 'data_quality' -> 'schools') s where s ->> 'id' = 'ec000000-0000-0000-0000-000000000001';
  select s into v_a from jsonb_array_elements(v_prov -> 'data_quality' -> 'schools') s where s ->> 'id' = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  call test_util.record('prov: data quality flags learners with incomplete records',
    (v_r1 -> 'issues' ->> 'incomplete_learner_records')::int = 6, coalesce(v_r1::text, 'missing'));
  call test_util.record('prov: data quality flags a school linked to a district that has circuits',
    (v_a -> 'issues' ->> 'not_linked_to_circuit')::boolean and v_r1 -> 'issues' -> 'not_linked_to_circuit' is null,
    coalesce(v_a::text, 'missing'));
  call test_util.record('prov: data quality issue counts are reported',
    (v_prov -> 'data_quality' -> 'issue_counts' -> 'incomplete_learner_records' ->> 'schools')::int >= 1, (v_prov -> 'data_quality' -> 'issue_counts')::text);
  select sum((t ->> 'opened')::int) into v_opened from jsonb_array_elements(v_prov -> 'intervention_trend') t;
  call test_util.record('prov: the intervention trend comes from intervention records',
    jsonb_array_length(v_prov -> 'intervention_trend') >= 1 and v_opened >= 1,
    (v_prov -> 'intervention_trend')::text);
  call test_util.record('prov: officials do not see the platform count of unlinked schools',
    v_prov -> 'data_quality' -> 'unlinked_schools' = 'null'::jsonb, (v_prov -> 'data_quality' -> 'unlinked_schools')::text);
end $$;

-- Exports, revocation, school-level officials.
do $$
declare
  v jsonb;
  v_exists boolean;
  v_assignment uuid;
begin
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select to_jsonb(public.record_provincial_report_export(''ea000000-0000-0000-0000-000000000001'', ''district_comparison'', ''csv'', ''{}''::jsonb))');
  select exists (select 1 from public.audit_log where action = 'government_report_exported'
                 and entity_id = 'ea000000-0000-0000-0000-000000000001'
                 and actor_profile_id = 'e0000000-0000-0000-0000-000000000003') into v_exists;
  call test_util.record('prov: provincial exports are written to the audit log', v ->> 'error' is null and v_exists, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select to_jsonb(public.record_provincial_report_export(''ea000000-0000-0000-0000-000000000001'', ''district_comparison'', ''csv'', ''{}''::jsonb))');
  call test_util.record('prov: a district official cannot record a provincial export',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select to_jsonb(public.record_provincial_report_export(''ea000000-0000-0000-0000-000000000001'', ''district_comparison'', ''pdf'', ''{"school_id":"ec000000-0000-0000-0000-000000000003"}''::jsonb))');
  call test_util.record('prov: an export cannot include a school outside the province',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  -- A province grant takes effect immediately and its revocation too.
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.grant_education_official_access(''e0000000-0000-0000-0000-000000000004'', ''ea000000-0000-0000-0000-000000000002'', false))');
  v_assignment := (v #>> '{}')::uuid;
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000004', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000002'', ''{}''::jsonb)');
  call test_util.record('prov: a new province grant takes effect immediately',
    test_util.gr_ids(v) = 'ec000000-0000-0000-0000-000000000003', coalesce(v ->> 'error', test_util.gr_ids(v)));
  perform test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    format('select to_jsonb(public.revoke_education_official_access(%L))', v_assignment));
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000004', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000002'', ''{}''::jsonb)');
  call test_util.record('prov: revoking a province grant removes provincial access immediately',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  -- School-level assignment.
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select to_jsonb(public.grant_education_official_school_access(''e0000000-0000-0000-0000-000000000009'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', true))');
  call test_util.record('prov: an official cannot grant school-level access',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.grant_education_official_school_access(''e0000000-0000-0000-0000-000000000009'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', true))');
  call test_util.record('prov: platform administrator can grant school-level access', v ->> 'error' is null, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000009', 'education_official', null,
    'select public.get_government_report(''{"district_id":"ea000000-0000-0000-0000-000000000011"}''::jsonb)');
  call test_util.record('prov: school-level official naming their district still sees only their school',
    test_util.gr_ids(v) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', coalesce(v ->> 'error', test_util.gr_ids(v)));

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000009', 'education_official', null,
    'select public.get_government_report(''{"school_id":"ec000000-0000-0000-0000-000000000001"}''::jsonb)');
  call test_util.record('prov: school-level official cannot read a neighbouring school',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000009', 'education_official', null,
    'select to_jsonb(array[public.reporting_learner_detail_allowed(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''), public.reporting_learner_detail_allowed(''ec000000-0000-0000-0000-000000000001'')])');
  call test_util.record('prov: a school-level learner grant covers only that school', v::text = '[true, false]', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000009', 'education_official', null,
    'select public.get_provincial_report(''ea000000-0000-0000-0000-000000000001'', ''{}''::jsonb)');
  call test_util.record('prov: school-level official cannot open the provincial report',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);
end $$;

-- ---------------------------------------------------------------------------
-- Government API clients (administration)
-- ---------------------------------------------------------------------------

do $$
declare
  v jsonb;
  v_hash_ok boolean;
begin
  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(t) from public.create_government_api_client(''x'', null, ''ea000000-0000-0000-0000-000000000011'', null, array[''schools'']) t');
  call test_util.record('api: a school owner cannot create API clients', coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(t) from public.create_government_api_client(''x'', null, ''ea000000-0000-0000-0000-000000000011'', null, array[''schools'']) t', 'aal1');
  call test_util.record('api: creating API clients requires MFA', coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(t) from public.create_government_api_client(''x'', null, ''ea000000-0000-0000-0000-000000000011'', ''ec000000-0000-0000-0000-000000000001'', array[''schools'']) t');
  call test_util.record('api: a client has exactly one scope', coalesce(v ->> 'error', '') like 'invalid_argument%', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(t) from public.create_government_api_client(''x'', null, ''ea000000-0000-0000-0000-000000000011'', null, array[''schools''], true) t');
  call test_util.record('api: learner detail needs the learners permission', coalesce(v ->> 'error', '') like 'invalid_argument%', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(t) from public.create_government_api_client(''x'', null, ''ea000000-0000-0000-0000-000000000011'', null, array[''schools'', ''delete_everything'']) t');
  call test_util.record('api: unknown permissions are rejected', v ? 'error', v::text);

  -- K1: District One, every permission, no learner detail.
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(t) from public.create_government_api_client(''K1 district'', ''test'', ''ea000000-0000-0000-0000-000000000011'', null,
       array[''schools'',''attendance'',''assessments'',''staff'',''interventions'',''data_quality'',''reports'',''imports'',''learners''], false, 600) t');
  insert into test_util.api_tokens values ('K1', (v ->> 'client_id')::uuid, v ->> 'token');
  call test_util.record('api: platform administrator creates a client and receives the token once',
    v ->> 'error' is null and v ->> 'token' ~ '^f360g_[0-9a-f]{8}_[0-9a-f]{48}$', v::text);

  select exists (select 1 from public.government_api_clients c
                 where c.id = (v ->> 'client_id')::uuid
                   and c.token_hash = encode(sha256(convert_to(v ->> 'token', 'UTF8')), 'hex')
                   and position(substring(v ->> 'token' from 16) in row_to_json(c)::text) = 0) into v_hash_ok;
  call test_util.record('api: only the token hash is stored', v_hash_ok, '');

  -- K2: Province One, reports + schools.
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(t) from public.create_government_api_client(''K2 province'', null, ''ea000000-0000-0000-0000-000000000001'', null, array[''reports'',''schools''], false, 600) t');
  insert into test_util.api_tokens values ('K2', (v ->> 'client_id')::uuid, v ->> 'token');
  -- K3: School R2 only, learners with learner detail.
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(t) from public.create_government_api_client(''K3 school'', null, null, ''ec000000-0000-0000-0000-000000000002'', array[''schools'',''learners'',''attendance'',''reports''], true, 600) t');
  insert into test_util.api_tokens values ('K3', (v ->> 'client_id')::uuid, v ->> 'token');
  -- K4: District One, rate limit 3 per minute.
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(t) from public.create_government_api_client(''K4 limited'', null, ''ea000000-0000-0000-0000-000000000011'', null, array[''schools''], false, 3) t');
  insert into test_util.api_tokens values ('K4', (v ->> 'client_id')::uuid, v ->> 'token');
  -- K5: District Three (Province Two), schools + imports.
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(t) from public.create_government_api_client(''K5 imports'', null, ''ea000000-0000-0000-0000-000000000021'', null, array[''schools'',''imports''], false, 600) t');
  insert into test_util.api_tokens values ('K5', (v ->> 'client_id')::uuid, v ->> 'token');
  -- K6: to be revoked; K7: to expire.
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(t) from public.create_government_api_client(''K6 revoked'', null, ''ea000000-0000-0000-0000-000000000011'', null, array[''schools'']) t');
  insert into test_util.api_tokens values ('K6', (v ->> 'client_id')::uuid, v ->> 'token');
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(t) from public.create_government_api_client(''K7 expiring'', null, ''ea000000-0000-0000-0000-000000000011'', null, array[''schools''], false, 60, now() + interval ''1 day'') t');
  insert into test_util.api_tokens values ('K7', (v ->> 'client_id')::uuid, v ->> 'token');

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(count(*)) from public.government_api_clients');
  call test_util.record('api: platform administrators can list clients', (v #>> '{}')::int >= 7, v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(count(token_hash)) from public.government_api_clients');
  call test_util.record('api: the token hash column is not readable through the API roles', coalesce(v ->> 'error', '') like 'permission denied%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select to_jsonb(count(*)) from public.government_api_clients');
  call test_util.record('api: officials cannot see API clients', v::text = '0', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select public.list_government_api_clients()');
  call test_util.record('api: the admin list never includes the token or its hash',
    v ->> 'error' is null and v::text not like '%token_hash%' and v::text not like '%f360g_%', left(v::text, 200));
end $$;

-- ---------------------------------------------------------------------------
-- Government API requests
-- ---------------------------------------------------------------------------

do $$
declare
  v jsonb;
  v_err text;
  v_next text;
begin
  -- Only the service role (the Edge Function) can call the API entry point.
  perform set_config('request.jwt.claims', test_util.jwt_claims('44444444-4444-4444-4444-444444444444', 'platform_administrator', null), true);
  set local role authenticated;
  begin
    perform public.gov_api_request(test_util.tok('K1'), 'GET', '/v1/schools', '{}'::jsonb, null, null);
    v_err := 'executed';
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  reset role;
  call test_util.record('api: signed-in users cannot call the API entry point directly', v_err like 'permission denied%', v_err);

  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin
    perform public.gov_api_request(test_util.tok('K1'), 'GET', '/v1/schools', '{}'::jsonb, null, null);
    v_err := 'executed';
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  reset role;
  call test_util.record('api: anonymous callers cannot call the API entry point', v_err like 'permission denied%', v_err);

  -- The client context cannot be forged from a user session.
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    format('select to_jsonb(array[(select set_config(''funda360.government_api_client'', %L, true))::text]) || to_jsonb(public.reporting_school_ids())',
           (select client_id from test_util.api_tokens where name = 'K5')));
  call test_util.record('api: a user session cannot assume an API client''s scope',
    v::text not like '%ec000000-0000-0000-0000-000000000003%' and v ->> 'error' is null, v::text);

  v := test_util.api_call(null, 'GET', '/v1/schools');
  call test_util.record('api: a request without a token gets 401', (v ->> 'status')::int = 401
    and v -> 'body' -> 'error' ->> 'code' = 'unauthenticated' and v ->> 'request_id' is not null, v::text);

  v := test_util.api_call('f360g_00000000_' || repeat('0', 48), 'GET', '/v1/schools');
  call test_util.record('api: an unknown token gets 401', (v ->> 'status')::int = 401, v::text);

  v := test_util.api_call(test_util.tok('K1') || 'x', 'GET', '/v1/schools');
  call test_util.record('api: a malformed token gets 401', (v ->> 'status')::int = 401, v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools');
  call test_util.record('api: a district client lists exactly the schools in its district',
    (v ->> 'status')::int = 200 and test_util.api_ids(v) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,ec000000-0000-0000-0000-000000000001'
      and v -> 'body' -> 'page' ->> 'next_cursor' is null,
    v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools', '{"province_id":"ea000000-0000-0000-0000-000000000001"}');
  call test_util.record('api: naming the parent province does not widen a district client',
    test_util.api_ids(v) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,ec000000-0000-0000-0000-000000000001', v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools', '{"district_id":"ea000000-0000-0000-0000-000000000012"}');
  call test_util.record('api: another district by id gets 403', (v ->> 'status')::int = 403
    and v -> 'body' -> 'error' ->> 'code' = 'forbidden', v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools/ec000000-0000-0000-0000-000000000002');
  call test_util.record('api: another district''s school by id gets 403', (v ->> 'status')::int = 403, v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools/ec000000-0000-0000-0000-000000000099');
  call test_util.record('api: an unknown school id gets the same 403', (v ->> 'status')::int = 403, v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools/ec000000-0000-0000-0000-000000000001');
  call test_util.record('api: a school in scope returns province, district and circuit',
    (v ->> 'status')::int = 200 and v -> 'body' -> 'data' -> 'circuit' ->> 'name' = 'Circuit One'
      and v -> 'body' -> 'data' -> 'district' ->> 'name' = 'District One'
      and v -> 'body' -> 'data' -> 'province' ->> 'name' = 'Test Province One'
      and v -> 'body' -> 'data' ->> 'emis_number' = '900000001',
    v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools', '{"limit":"1"}');
  v_next := v -> 'body' -> 'page' ->> 'next_cursor';
  call test_util.record('api: pagination returns one page and a cursor',
    test_util.api_ids(v) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and v_next = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v::text);
  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools', jsonb_build_object('limit', '1', 'cursor', v_next));
  call test_util.record('api: the cursor returns the next page and ends',
    test_util.api_ids(v) = 'ec000000-0000-0000-0000-000000000001' and v -> 'body' -> 'page' ->> 'next_cursor' is null, v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools', '{"limit":"0"}');
  call test_util.record('api: limit 0 is a validation error', (v ->> 'status')::int = 422 and v -> 'body' -> 'error' ->> 'code' = 'validation_failed', v::text);
  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools', '{"limit":"501"}');
  call test_util.record('api: a limit above the maximum is a validation error', (v ->> 'status')::int = 422, v::text);
  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools', '{"district_id":"not-a-uuid"}');
  call test_util.record('api: a malformed id is a validation error', (v ->> 'status')::int = 422, v::text);
  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools', '{"foo":"bar"}');
  call test_util.record('api: unknown query parameters are rejected', (v ->> 'status')::int = 422
    and v -> 'body' -> 'error' ->> 'message' like 'unknown query parameter%', v::text);
  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/attendance', '{"start_date":"2026-02-31"}');
  call test_util.record('api: an impossible date is a validation error', (v ->> 'status')::int = 422, v::text);

  v := test_util.api_call(test_util.tok('K1'), 'POST', '/v1/schools');
  call test_util.record('api: wrong method gets 405', (v ->> 'status')::int = 405 and v ->> 'allow' = 'GET', v::text);
  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/nothing-here');
  call test_util.record('api: unknown endpoints get 404', (v ->> 'status')::int = 404, v::text);
  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v2/schools');
  call test_util.record('api: unknown versions get 404', (v ->> 'status')::int = 404, v::text);
  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/schools', '{}', '{"a":1}');
  call test_util.record('api: a GET with a body is rejected', (v ->> 'status')::int = 422, v::text);
end $$;

do $$
declare
  v jsonb;
  v_rep jsonb;
  v_exists boolean;
  v_flag boolean;
  v_count int;
begin
  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/learners', '{"school_id":"ec000000-0000-0000-0000-000000000001"}');
  call test_util.record('api: learner data needs the learner-level grant', (v ->> 'status')::int = 403, v::text);

  v := test_util.api_call(test_util.tok('K3'), 'GET', '/v1/learners', '{"school_id":"ec000000-0000-0000-0000-000000000002"}');
  call test_util.record('api: a granted client lists enrolments without names or dates of birth',
    (v ->> 'status')::int = 200 and jsonb_array_length(v -> 'body' -> 'data') = 2
      and v::text not like '%first_name%' and v::text not like '%last_name%' and v::text not like '%date_of_birth%'
      and v::text not like '%id_number%',
    v::text);
  select exists (select 1 from public.audit_log where action = 'government_api_learner_detail_viewed'
                 and school_id = 'ec000000-0000-0000-0000-000000000002' and after ->> 'client_id' = (select client_id::text from test_util.api_tokens where name = 'K3'))
    into v_exists;
  call test_util.record('api: learner-level API reads are written to the audit log', v_exists, '');

  v := test_util.api_call(test_util.tok('K3'), 'GET', '/v1/learners', '{"school_id":"ec000000-0000-0000-0000-000000000001"}');
  call test_util.record('api: a school client cannot read another school''s learners', (v ->> 'status')::int = 403, v::text);
  v := test_util.api_call(test_util.tok('K3'), 'GET', '/v1/learners');
  call test_util.record('api: learners needs a school_id', (v ->> 'status')::int = 422, v::text);
  v := test_util.api_call(test_util.tok('K3'), 'GET', '/v1/schools');
  call test_util.record('api: a school client sees only its school', test_util.api_ids(v) = 'ec000000-0000-0000-0000-000000000002', v::text);

  v := test_util.api_call(test_util.tok('K2'), 'GET', '/v1/attendance');
  call test_util.record('api: endpoints need their permission', (v ->> 'status')::int = 403
    and v -> 'body' -> 'error' ->> 'code' = 'permission_not_granted', v::text);

  v := test_util.api_call(test_util.tok('K2'), 'GET', '/v1/reports/provinces/ea000000-0000-0000-0000-000000000001');
  call test_util.record('api: a province client gets its provincial report',
    (v ->> 'status')::int = 200 and jsonb_array_length(v -> 'body' -> 'data' -> 'districts') = 2
      and not (v -> 'body' -> 'data' ? 'schools'), left(v::text, 300));
  v := test_util.api_call(test_util.tok('K2'), 'GET', '/v1/reports/provinces/ea000000-0000-0000-0000-000000000002');
  call test_util.record('api: a province client cannot read another province', (v ->> 'status')::int = 403, v::text);
  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/reports/provinces/ea000000-0000-0000-0000-000000000001');
  call test_util.record('api: a district client cannot escalate to its province', (v ->> 'status')::int = 403, v::text);
  v := test_util.api_call(test_util.tok('K3'), 'GET', '/v1/reports/provinces/ea000000-0000-0000-0000-000000000001');
  call test_util.record('api: a school client cannot escalate to its province', (v ->> 'status')::int = 403, v::text);

  -- Same figures as the dashboards.
  v_rep := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/reports/schools', '{"school_id":"ec000000-0000-0000-0000-000000000001"}');
  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/attendance', '{"school_id":"ec000000-0000-0000-0000-000000000001"}');
  call test_util.record('api: attendance totals equal the report''s attendance rate',
    (v ->> 'status')::int = 200
      and (v -> 'body' -> 'data' -> 0 -> 'totals' ->> 'attendance_rate') = (v_rep -> 'body' -> 'data' -> 0 ->> 'attendance_rate')
      and jsonb_array_length(v -> 'body' -> 'data' -> 0 -> 'periods') >= 1,
    format('%s / %s', v -> 'body' -> 'data' -> 0 -> 'totals', v_rep -> 'body' -> 'data' -> 0 ->> 'attendance_rate'));

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/assessments', '{"school_id":"ec000000-0000-0000-0000-000000000001"}');
  call test_util.record('api: assessment aggregates match the report (Mathematics 70.0%, pass 83.3%)',
    v -> 'body' -> 'data' -> 0 -> 'subjects' -> 0 ->> 'average_percent' = '70.0'
      and v -> 'body' -> 'data' -> 0 -> 'subjects' -> 0 ->> 'pass_rate' = '83.3'
      and (v -> 'body' -> 'data' -> 0 -> 'subjects' -> 0 ->> 'learners')::int = 6,
    v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/staff', '{"school_id":"ec000000-0000-0000-0000-000000000001"}');
  call test_util.record('api: staff counts match the report (2 staff, 1 educator)',
    (v -> 'body' -> 'data' -> 0 ->> 'staff')::int = 2 and (v -> 'body' -> 'data' -> 0 ->> 'educators')::int = 1, v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/interventions');
  select count(*) into v_count from public.academic_interventions
  where school_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ec000000-0000-0000-0000-000000000001');
  select bool_and(d -> 'learner_id' = 'null'::jsonb and not (d ? 'title') and not (d ? 'description')),
         bool_or(d ->> 'school_id' = 'ec000000-0000-0000-0000-000000000001' and (d ->> 'overdue')::boolean)
    into v_flag, v_exists
  from jsonb_array_elements(v -> 'body' -> 'data') d;
  call test_util.record('api: interventions are listed without titles and without learner ids by default',
    (v ->> 'status')::int = 200 and jsonb_array_length(v -> 'body' -> 'data') = v_count and v_flag and v_exists
      and v::text not like '%Maths support%',
    v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/data-quality');
  call test_util.record('api: data quality lists every school in scope',
    test_util.api_ids(v) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,ec000000-0000-0000-0000-000000000001', v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/reports/summary');
  call test_util.record('api: the summary covers the client''s scope', (v -> 'body' -> 'data' -> 'summary' ->> 'schools')::int = 2, left(v::text, 300));

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/scope');
  call test_util.record('api: the scope endpoint describes the client', v -> 'body' -> 'data' -> 'scope' ->> 'name' = 'District One'
    and (v -> 'body' -> 'data' ->> 'schools')::int = 2, v::text);

  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/areas');
  select bool_and((a ->> 'in_scope')::boolean = (a ->> 'level' <> 'province')) into v_flag
  from jsonb_array_elements(v -> 'body' -> 'data') a;
  call test_util.record('api: areas mark which ones are in scope',
    v_flag and v::text not like '%Test Province Two%', v::text);
end $$;

-- Rate limiting, revocation and expiry.
do $$
declare
  v jsonb;
  v_statuses text := '';
begin
  for i in 1..4 loop
    v := test_util.api_call(test_util.tok('K4'), 'GET', '/v1/schools');
    v_statuses := v_statuses || (v ->> 'status') || ' ';
  end loop;
  call test_util.record('api: the per-client rate limit returns 429 with Retry-After',
    v_statuses = '200 200 200 429 ' and (v ->> 'retry_after')::int = 60 and v -> 'body' -> 'error' ->> 'code' = 'rate_limited', v_statuses);

  v := test_util.api_call(test_util.tok('K6'), 'GET', '/v1/schools');
  call test_util.record('api: a client works before revocation', (v ->> 'status')::int = 200, v::text);
  perform test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    format('select to_jsonb(public.revoke_government_api_client(%L))', (select client_id from test_util.api_tokens where name = 'K6')));
  v := test_util.api_call(test_util.tok('K6'), 'GET', '/v1/schools');
  call test_util.record('api: a revoked client is refused on its next request', (v ->> 'status')::int = 401, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    format('select to_jsonb(public.revoke_government_api_client(%L))', (select client_id from test_util.api_tokens where name = 'K7')));
  call test_util.record('api: officials cannot revoke clients', coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  update public.government_api_clients set expires_at = now() - interval '1 second'
  where id = (select client_id from test_util.api_tokens where name = 'K7');
  v := test_util.api_call(test_util.tok('K7'), 'GET', '/v1/schools');
  call test_util.record('api: an expired client is refused', (v ->> 'status')::int = 401, v::text);
end $$;

-- Imports: validate -> preview -> commit.
do $$
declare
  v jsonb;
  v_job uuid;
  v_emis text;
  v_codes text;
  v_count int;
  v_exists boolean;
begin
  v := test_util.api_call(test_util.tok('K5'), 'POST', '/v1/imports', '{}',
    '{"kind":"school_identifiers","dry_run":true,"rows":[{"school_id":"ec000000-0000-0000-0000-000000000003","emis_number":"EMIS-R3"}]}');
  select count(*) into v_count from public.government_import_jobs;
  call test_util.record('api: a dry run validates without storing anything',
    (v ->> 'status')::int = 200 and (v -> 'body' -> 'data' ->> 'valid')::boolean and v_count = 0
      and v -> 'body' -> 'data' -> 'rows' -> 0 ->> 'action' = 'set', v::text);

  v := test_util.api_call(test_util.tok('K5'), 'POST', '/v1/imports', '{}',
    '{"kind":"school_identifiers","dry_run":true,"rows":[
       {"school_id":"ec000000-0000-0000-0000-000000000001","emis_number":"X1"},
       {"school_id":"not-a-uuid","emis_number":"X2"},
       {"emis_number":"X3"},
       {"school_id":"ec000000-0000-0000-0000-000000000003","emis_number":"900000001"},
       {"school_id":"ec000000-0000-0000-0000-000000000003","emis_number":"bad emis!"},
       {"school_id":"ec000000-0000-0000-0000-000000000003","emis_number":"X6","extra":1}]}');
  select string_agg(e ->> 'code', ',' order by (e ->> 'row')::int, e ->> 'code') into v_codes from jsonb_array_elements(v -> 'body' -> 'data' -> 'errors') e;
  call test_util.record('api: import validation reports scope, format, required, conflict and duplicate errors',
    v_codes = 'school_not_in_scope,invalid_format,required,emis_number_in_use,duplicate_school,invalid_format,duplicate_school,invalid_type'
      and (v -> 'body' -> 'data' ->> 'valid')::boolean = false,
    coalesce(v_codes, v::text));

  v := test_util.api_call(test_util.tok('K5'), 'POST', '/v1/imports', '{}',
    '{"kind":"school_identifiers","rows":[{"school_id":"ec000000-0000-0000-0000-000000000003","emis_number":"EMIS-R3"}]}');
  call test_util.record('api: a stored import needs an idempotency key', (v ->> 'status')::int = 422, v::text);

  v := test_util.api_call(test_util.tok('K5'), 'POST', '/v1/imports', '{}',
    '{"kind":"learners","idempotency_key":"import-0001","rows":[]}');
  call test_util.record('api: unsupported import kinds are rejected', (v ->> 'status')::int = 422, v::text);

  v := test_util.api_call(test_util.tok('K5'), 'POST', '/v1/imports', '{}',
    '{"kind":"school_identifiers","idempotency_key":"import-0001","rows":[{"school_id":"ec000000-0000-0000-0000-000000000003","emis_number":"EMIS-R3"}]}');
  v_job := (v -> 'body' -> 'data' ->> 'id')::uuid;
  call test_util.record('api: a valid import is stored as validated (201)',
    (v ->> 'status')::int = 201 and v -> 'body' -> 'data' ->> 'status' = 'validated', v::text);
  select emis_number into v_emis from public.schools where id = 'ec000000-0000-0000-0000-000000000003';
  call test_util.record('api: an import writes nothing before it is committed', v_emis is null, coalesce(v_emis, 'null'));

  v := test_util.api_call(test_util.tok('K5'), 'POST', '/v1/imports', '{}',
    '{"kind":"school_identifiers","idempotency_key":"import-0001","rows":[{"school_id":"ec000000-0000-0000-0000-000000000003","emis_number":"EMIS-R3"}]}');
  call test_util.record('api: replaying the same import is idempotent',
    (v ->> 'status')::int = 200 and (v -> 'body' ->> 'replayed')::boolean and (v -> 'body' -> 'data' ->> 'id')::uuid = v_job, v::text);

  v := test_util.api_call(test_util.tok('K5'), 'POST', '/v1/imports', '{}',
    '{"kind":"school_identifiers","idempotency_key":"import-0001","rows":[{"school_id":"ec000000-0000-0000-0000-000000000003","emis_number":"OTHER"}]}');
  call test_util.record('api: reusing a key with a different payload gets 409', (v ->> 'status')::int = 409, v::text);

  v := test_util.api_call(test_util.tok('K5'), 'GET', '/v1/imports/' || v_job);
  call test_util.record('api: a client can read its own import', (v ->> 'status')::int = 200, v::text);
  v := test_util.api_call(test_util.tok('K1'), 'GET', '/v1/imports/' || v_job);
  call test_util.record('api: another client''s import is not exposed (404)', (v ->> 'status')::int = 404, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    format('select public.review_government_import_job(%L, ''commit'')', v_job));
  call test_util.record('api: officials cannot commit imports', coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    format('select public.review_government_import_job(%L, ''commit'')', v_job), 'aal1');
  call test_util.record('api: committing an import requires MFA', coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    format('select public.review_government_import_job(%L, ''commit'', ''checked'')', v_job));
  select emis_number into v_emis from public.schools where id = 'ec000000-0000-0000-0000-000000000003';
  select exists (select 1 from public.audit_log where action = 'school_emis_number_changed'
                 and entity_id = 'ec000000-0000-0000-0000-000000000003' and after ->> 'emis_number' = 'EMIS-R3') into v_exists;
  call test_util.record('api: a committed import updates the school and audits the change',
    v ->> 'status' = 'committed' and v_emis = 'EMIS-R3' and v_exists, v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    format('select public.review_government_import_job(%L, ''commit'')', v_job));
  call test_util.record('api: an import cannot be committed twice', coalesce(v ->> 'error', '') like 'conflict%', v::text);
end $$;

-- Request log.
do $$
declare
  v_ok boolean;
  v_err text;
  v_rows int;
begin
  select count(*) into v_rows from public.government_api_requests
  where client_id = (select client_id from test_util.api_tokens where name = 'K1');
  call test_util.record('api: every request is logged against its client', v_rows >= 20, v_rows::text);

  select bool_and(status = 401 and client_id is null) into v_ok from public.government_api_requests where error_code = 'unauthenticated';
  call test_util.record('api: failed authentication is logged without a client', v_ok, '');

  select not exists (select 1 from public.government_api_requests r
                     where row_to_json(r)::text ~ 'f360g_[0-9a-f]{8}_[0-9a-f]{48}') into v_ok;
  call test_util.record('api: no token is ever written to the request log', v_ok, '');

  select exists (select 1 from public.government_api_requests where status = 403 and error_code = 'forbidden')
     and exists (select 1 from public.government_api_requests where status = 422)
     and exists (select 1 from public.government_api_requests where status = 429)
    into v_ok;
  call test_util.record('api: refused requests are logged with their status', v_ok, '');

  begin
    update public.government_api_requests set status = 200 where status = 403;
    v_err := 'updated';
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  call test_util.record('api: the request log is append-only', v_err like 'insufficient_privilege%', v_err);

  begin
    delete from public.government_api_requests;
    v_err := 'deleted';
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  call test_util.record('api: request log rows cannot be deleted', v_err like 'insufficient_privilege%', v_err);
end $$;
