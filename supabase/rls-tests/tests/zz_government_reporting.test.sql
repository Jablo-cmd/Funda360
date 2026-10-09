-- Regression suite for 20261009091000_government_reporting.sql.
--
-- Named zz_ so it runs last: it adds its own areas, schools, learners and
-- officials, and links School A to a district, which no earlier suite
-- expects.
--
-- Hierarchy:  P1 Test Province One ── D1 ── C1 (circuit)
--                                   └─ D2
--             P2 Test Province Two ── D3
-- Schools:    School A -> D1, R1 -> C1, R2 -> D2, R3 -> D3
-- Officials:  O1 D1 (aggregate only)   O2 D2 (learner detail)
--             O3 P1 (aggregate only)   O4 no assignment
--             O5 D1 revoked            O6 D1 but profile inactive
--             O7 JWT claims education_official, profile is a teacher

-- ---------------------------------------------------------------------------
-- Fixtures (as the connecting superuser)
-- ---------------------------------------------------------------------------

insert into public.education_areas (id, level, parent_id, name, code) values
  ('ea000000-0000-0000-0000-000000000001', 'province', null, 'Test Province One', 'TP1'),
  ('ea000000-0000-0000-0000-000000000002', 'province', null, 'Test Province Two', 'TP2');
insert into public.education_areas (id, level, parent_id, name) values
  ('ea000000-0000-0000-0000-000000000011', 'district', 'ea000000-0000-0000-0000-000000000001', 'District One'),
  ('ea000000-0000-0000-0000-000000000012', 'district', 'ea000000-0000-0000-0000-000000000001', 'District Two'),
  ('ea000000-0000-0000-0000-000000000021', 'district', 'ea000000-0000-0000-0000-000000000002', 'District Three');
insert into public.education_areas (id, level, parent_id, name) values
  ('ea000000-0000-0000-0000-000000000111', 'circuit', 'ea000000-0000-0000-0000-000000000011', 'Circuit One');

insert into public.schools (id, name, status, emis_number, education_area_id) values
  ('ec000000-0000-0000-0000-000000000001', 'Reporting School One', 'active', '900000001', 'ea000000-0000-0000-0000-000000000111'),
  ('ec000000-0000-0000-0000-000000000002', 'Reporting School Two', 'active', '900000002', 'ea000000-0000-0000-0000-000000000012'),
  ('ec000000-0000-0000-0000-000000000003', 'Reporting School Three', 'active', null, 'ea000000-0000-0000-0000-000000000021');
update public.schools set education_area_id = 'ea000000-0000-0000-0000-000000000011'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

insert into public.academic_years (id, school_id, name, start_date, end_date, is_active)
select ('ed000000-0000-0000-0000-00000000000' || n)::uuid, ('ec000000-0000-0000-0000-00000000000' || n)::uuid,
       '2026', '2026-01-12', '2026-12-04', true
from generate_series(1, 3) n;

insert into public.terms (academic_year_id, school_id, name, sequence, start_date, end_date)
select ('ed000000-0000-0000-0000-00000000000' || n)::uuid, ('ec000000-0000-0000-0000-00000000000' || n)::uuid,
       'Term ' || t, t,
       case t when 1 then date '2026-01-12' else date '2026-04-08' end,
       case t when 1 then date '2026-03-27' else date '2026-06-26' end
from generate_series(1, 3) n, generate_series(1, 2) t;

insert into public.grades (id, school_id, name, sort_order)
select ('ee000000-0000-0000-0000-00000000000' || n)::uuid, ('ec000000-0000-0000-0000-00000000000' || n)::uuid, 'Grade 10', 10
from generate_series(1, 3) n;

insert into public.classes (id, grade_id, school_id, name, capacity)
select ('ef000000-0000-0000-0000-00000000000' || n)::uuid, ('ee000000-0000-0000-0000-00000000000' || n)::uuid,
       ('ec000000-0000-0000-0000-00000000000' || n)::uuid, '10A', 40
from generate_series(1, 3) n;

insert into public.subjects (id, school_id, name)
select ('e5000000-0000-0000-0000-00000000000' || n)::uuid, ('ec000000-0000-0000-0000-00000000000' || n)::uuid, 'Mathematics'
from generate_series(1, 3) n;

-- R1: 6 learners, R2: 2 learners, R3: 3 learners.
insert into public.learners (id, school_id, learner_number, admission_number, first_name, last_name, date_of_birth, status, admission_date)
select ('e1000000-0000-0000-0000-0000000000' || s || l)::uuid, ('ec000000-0000-0000-0000-00000000000' || s)::uuid,
       'GR-' || s || l, 'GA-' || s || l, 'Learner', 'S' || s || 'L' || l, '2010-01-01', 'active', '2025-01-15'
from (values (1, 6), (2, 2), (3, 3)) as c(s, k), generate_series(1, k) l;

insert into public.learner_enrollments (school_id, learner_id, academic_year_id, grade_id, class_id, enrollment_date)
select ('ec000000-0000-0000-0000-00000000000' || s)::uuid, ('e1000000-0000-0000-0000-0000000000' || s || l)::uuid,
       ('ed000000-0000-0000-0000-00000000000' || s)::uuid, ('ee000000-0000-0000-0000-00000000000' || s)::uuid,
       ('ef000000-0000-0000-0000-00000000000' || s)::uuid, '2026-01-12'
from (values (1, 6), (2, 2), (3, 3)) as c(s, k), generate_series(1, k) l;

-- R1 term 1, 2-6 Feb: learners 1-5 present every day; learner 6 absent
-- Mon-Thu, present Fri. 26 present / 30 qualifying = 86.7%.
-- 2-5 Feb only: 20 / 24 = 83.3%.
insert into public.attendance_records (school_id, academic_year_id, class_id, learner_id, attendance_date, status)
select 'ec000000-0000-0000-0000-000000000001', 'ed000000-0000-0000-0000-000000000001', 'ef000000-0000-0000-0000-000000000001',
       ('e1000000-0000-0000-0000-00000000001' || l)::uuid, d::date,
       (case when l = 6 and d::date < date '2026-02-06' then 'absent' else 'present' end)::public.attendance_status
from generate_series(1, 6) l, generate_series(date '2026-02-02', date '2026-02-06', interval '1 day') d;

-- R1 term 2: one absence, so a term-2 report reads 0.0%.
insert into public.attendance_records (school_id, academic_year_id, class_id, learner_id, attendance_date, status)
values ('ec000000-0000-0000-0000-000000000001', 'ed000000-0000-0000-0000-000000000001', 'ef000000-0000-0000-0000-000000000001',
        'e1000000-0000-0000-0000-000000000011', '2026-05-04', 'absent');

-- R2: both learners absent on 2 Feb -> 0.0%, low attendance.
insert into public.attendance_records (school_id, academic_year_id, class_id, learner_id, attendance_date, status)
select 'ec000000-0000-0000-0000-000000000002', 'ed000000-0000-0000-0000-000000000002', 'ef000000-0000-0000-0000-000000000002',
       ('e1000000-0000-0000-0000-00000000002' || l)::uuid, '2026-02-02', 'absent'
from generate_series(1, 2) l;

-- R1 assessment, out of 50: learners 1-5 score 40 (80%), learner 6 scores 10
-- (20%). Average 70.0%, pass rate 5/6 = 83.3%.
insert into public.assessments (id, school_id, academic_year_id, term_id, class_id, subject_id, title, assessment_type, assessment_date, max_mark)
select 'e6000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'ed000000-0000-0000-0000-000000000001',
       t.id, 'ef000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'Test 1', 'test', '2026-03-02', 50
from public.terms t where t.school_id = 'ec000000-0000-0000-0000-000000000001' and t.sequence = 1;

insert into public.assessment_results (school_id, assessment_id, learner_id, mark)
select 'ec000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001',
       ('e1000000-0000-0000-0000-00000000001' || l)::uuid, case when l = 6 then 10 else 40 end
from generate_series(1, 6) l;

-- R1 learner 6 has an overdue open intervention.
insert into public.academic_interventions (school_id, learner_id, academic_year_id, subject_id, title, status, target_date)
values ('ec000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000016', 'ed000000-0000-0000-0000-000000000001',
        'e5000000-0000-0000-0000-000000000001', 'Maths support', 'open', '2026-03-01');

-- R1 staff: one teacher with a login (an educator) and one administrator
-- without one (staff, not an educator).
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'e7000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'teacher.r1@reporting.test', jsonb_build_object('role', 'teacher', 'tenant_id', 'ec000000-0000-0000-0000-000000000001'));
insert into public.profiles (id, tenant_id, first_name, last_name, email, role, status) values
  ('e7000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'Teacher', 'R1', 'teacher.r1@reporting.test', 'teacher', 'active');
insert into public.employees (school_id, employee_number, first_name, last_name, hire_date, profile_id) values
  ('ec000000-0000-0000-0000-000000000001', 'R1-T1', 'Teacher', 'R1', '2025-01-01', 'e7000000-0000-0000-0000-000000000001'),
  ('ec000000-0000-0000-0000-000000000001', 'R1-A1', 'Admin', 'R1', '2025-01-01', null);

-- Officials.
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data)
select '00000000-0000-0000-0000-000000000000', ('e0000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated',
       'official' || n || '@department.test', jsonb_build_object('role', 'education_official')
from generate_series(1, 7) n;
insert into public.profiles (id, tenant_id, first_name, last_name, email, role, status)
select ('e0000000-0000-0000-0000-00000000000' || n)::uuid,
       case when n = 7 then 'ec000000-0000-0000-0000-000000000001'::uuid end,
       'Official', 'O' || n, 'official' || n || '@department.test',
       (case when n = 7 then 'teacher' else 'education_official' end)::public.user_role,
       (case when n = 6 then 'inactive' else 'active' end)::public.profile_status
from generate_series(1, 7) n;

insert into public.education_official_assignments (profile_id, area_id, can_view_learner_detail, active, revoked_at) values
  ('e0000000-0000-0000-0000-000000000001', 'ea000000-0000-0000-0000-000000000011', false, true, null),
  ('e0000000-0000-0000-0000-000000000002', 'ea000000-0000-0000-0000-000000000012', true, true, null),
  ('e0000000-0000-0000-0000-000000000003', 'ea000000-0000-0000-0000-000000000001', false, true, null),
  ('e0000000-0000-0000-0000-000000000005', 'ea000000-0000-0000-0000-000000000011', false, false, now()),
  ('e0000000-0000-0000-0000-000000000006', 'ea000000-0000-0000-0000-000000000011', false, true, null),
  ('e0000000-0000-0000-0000-000000000007', 'ea000000-0000-0000-0000-000000000011', true, true, null);

-- Runs p_sql as the given identity; returns the jsonb result, or
-- {"error": message} when it raises. p_aal is the session's Supabase Auth
-- assurance level; 'aal2' (MFA completed) unless a test says otherwise.
create or replace function test_util.gr_call(p_uid uuid, p_role text, p_tenant uuid, p_sql text, p_aal text default 'aal2')
returns jsonb
language plpgsql
as $$
declare
  v jsonb;
  v_err text;
begin
  perform set_config('request.jwt.claims',
    (test_util.jwt_claims(p_uid, p_role, p_tenant)::jsonb || jsonb_build_object('aal', p_aal))::text, true);
  execute 'set local role authenticated';
  begin
    execute p_sql into v;
  exception when others then
    get stacked diagnostics v_err = message_text;
    v := jsonb_build_object('error', v_err);
  end;
  execute 'reset role';
  return v;
end;
$$;

-- School ids in a report, sorted, as text.
create or replace function test_util.gr_ids(p_report jsonb)
returns text
language sql
as $$
  select coalesce(string_agg(s ->> 'id', ',' order by s ->> 'id'), '')
  from jsonb_array_elements(coalesce(p_report -> 'schools', '[]'::jsonb)) s
$$;

-- ---------------------------------------------------------------------------
-- District / province / circuit isolation
-- ---------------------------------------------------------------------------

do $$
declare
  v jsonb;
  v_ids text;
begin
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)');
  v_ids := test_util.gr_ids(v);
  call test_util.record('gov: district official sees exactly the schools in their district and its circuits',
    v_ids = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,ec000000-0000-0000-0000-000000000001', coalesce(v ->> 'error', v_ids));

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{"school_id":"ec000000-0000-0000-0000-000000000002"}''::jsonb)');
  call test_util.record('gov: district official cannot request another district''s school by id',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{"district_id":"ea000000-0000-0000-0000-000000000012"}''::jsonb)');
  call test_util.record('gov: district official cannot request another district by id',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{"province_id":"ea000000-0000-0000-0000-000000000002"}''::jsonb)');
  call test_util.record('gov: district official cannot request another province',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{"province_id":"ea000000-0000-0000-0000-000000000001"}''::jsonb)');
  v_ids := test_util.gr_ids(v);
  call test_util.record('gov: naming the parent province does not widen a district official''s scope',
    v_ids = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,ec000000-0000-0000-0000-000000000001', coalesce(v ->> 'error', v_ids));

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{"circuit_id":"ea000000-0000-0000-0000-000000000111"}''::jsonb)');
  v_ids := test_util.gr_ids(v);
  call test_util.record('gov: circuit filter narrows to the circuit''s schools',
    v_ids = 'ec000000-0000-0000-0000-000000000001', coalesce(v ->> 'error', v_ids));

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)');
  v_ids := test_util.gr_ids(v);
  call test_util.record('gov: province official sees every district in the province and nothing outside it',
    v_ids = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,ec000000-0000-0000-0000-000000000001,ec000000-0000-0000-0000-000000000002',
    coalesce(v ->> 'error', v_ids));

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000002', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)');
  v_ids := test_util.gr_ids(v);
  call test_util.record('gov: second district official sees only their own district',
    v_ids = 'ec000000-0000-0000-0000-000000000002', coalesce(v ->> 'error', v_ids));
end $$;

-- ---------------------------------------------------------------------------
-- Role and account-state restrictions
-- ---------------------------------------------------------------------------

do $$
declare
  v jsonb;
begin
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000004', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)');
  call test_util.record('gov: official with no assignment gets an empty report, not data',
    v ->> 'error' is null and jsonb_array_length(v -> 'schools') = 0, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000005', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)');
  call test_util.record('gov: revoked assignment gives no schools',
    v ->> 'error' is null and jsonb_array_length(v -> 'schools') = 0, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000006', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)');
  call test_util.record('gov: deactivated official has no reporting access',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000007', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)');
  call test_util.record('gov: a JWT role claim without a matching education_official profile is rejected',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.get_government_report(''{}''::jsonb)');
  call test_util.record('gov: teacher has no reporting access',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('55555555-5555-5555-5555-555555555555', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.get_government_report(''{}''::jsonb)');
  call test_util.record('gov: parent has no reporting access',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.get_government_report(''{}''::jsonb)');
  call test_util.record('gov: school owner sees only their own school',
    test_util.gr_ids(v) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v::text);

  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.get_government_report(''{"school_id":"ec000000-0000-0000-0000-000000000001"}''::jsonb)');
  call test_util.record('gov: school owner cannot report on another school in the same district',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.get_government_report(''{"district_id":"ea000000-0000-0000-0000-000000000011"}''::jsonb)');
  call test_util.record('gov: school owner naming their own district still sees only their school',
    test_util.gr_ids(v) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select public.get_government_report(''{"province_id":"ea000000-0000-0000-0000-000000000002"}''::jsonb)');
  call test_util.record('gov: platform administrator can report on any province',
    test_util.gr_ids(v) = 'ec000000-0000-0000-0000-000000000003', v::text);

  call test_util.record('gov: anon cannot execute any reporting function',
    not has_function_privilege('anon', 'public.get_government_report(jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.get_school_report(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.get_class_learner_report(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.get_reporting_scope()', 'execute'), '');

  call test_util.record('gov: internal reporting helpers are not callable by signed-in users',
    not has_function_privilege('authenticated', 'public.reporting_learner_stats(uuid[], jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.reporting_windows(uuid[], jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.reporting_resolve_schools(jsonb)', 'execute'), '');
end $$;

-- ---------------------------------------------------------------------------
-- Drill-down and learner privacy
-- ---------------------------------------------------------------------------

do $$
declare
  v jsonb;
  v_audit_before int;
  v_audit_after int;
begin
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_school_report(''ec000000-0000-0000-0000-000000000002''::uuid, ''{}''::jsonb)');
  call test_util.record('gov: school drill-down outside the district is rejected',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_school_report(''ec000000-0000-0000-0000-000000000001''::uuid, ''{"academic_year":"2026","term":"1"}''::jsonb)');
  call test_util.record('gov: school drill-down returns class figures from source data',
    (v -> 'classes' -> 0 ->> 'learners')::int = 6
    and (v -> 'classes' -> 0 ->> 'attendance_rate')::numeric = 86.7
    and (v -> 'classes' -> 0 ->> 'average_percent')::numeric = 70.0
    and (v -> 'classes' -> 0 ->> 'learners_requiring_intervention')::int = 1, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_class_learner_report(''ef000000-0000-0000-0000-000000000001''::uuid, ''{}''::jsonb)');
  call test_util.record('gov: official without the learner-detail grant cannot list learners',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000002', 'education_official', null,
    'select public.get_class_learner_report(''ef000000-0000-0000-0000-000000000001''::uuid, ''{}''::jsonb)');
  call test_util.record('gov: learner-detail grant does not reach a class in another district',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.get_class_learner_report(''ef000000-0000-0000-0000-000000000001''::uuid, ''{}''::jsonb)');
  call test_util.record('gov: school owner cannot list learners in another school''s class',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_class_learner_report(''00000000-0000-0000-0000-0000000000ff''::uuid, ''{}''::jsonb)');
  call test_util.record('gov: unknown class id gives the same refusal as an out-of-scope one',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  select count(*) into v_audit_before from public.audit_log where action = 'government_report_learner_detail_viewed';
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000002', 'education_official', null,
    'select public.get_class_learner_report(''ef000000-0000-0000-0000-000000000002''::uuid, ''{}''::jsonb)');
  select count(*) into v_audit_after from public.audit_log where action = 'government_report_learner_detail_viewed';
  call test_util.record('gov: official with the learner-detail grant can list their own district''s learners',
    jsonb_array_length(v -> 'learners') = 2, v::text);
  call test_util.record('gov: every learner-level view is written to the audit log',
    v_audit_after = v_audit_before + 1, v_audit_before || ' -> ' || v_audit_after);

  -- Small groups are suppressed for aggregate-only officials.
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000003', 'education_official', null,
    'select public.get_government_report(''{"school_id":"ec000000-0000-0000-0000-000000000002"}''::jsonb)');
  call test_util.record('gov: grade figures for fewer than 5 learners are suppressed without learner-detail access',
    (v -> 'grades' -> 0 ->> 'suppressed')::boolean and v -> 'grades' -> 0 -> 'attendance_rate' = 'null'::jsonb, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000002', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)');
  call test_util.record('gov: the same small group is shown to an official with learner-detail access',
    not (v -> 'grades' -> 0 ->> 'suppressed')::boolean and (v -> 'grades' -> 0 ->> 'attendance_rate')::numeric = 0.0, v::text);
end $$;

-- ---------------------------------------------------------------------------
-- Calculations, filters and data quality
-- ---------------------------------------------------------------------------

do $$
declare
  v jsonb;
  r1 jsonb;
begin
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{"school_id":"ec000000-0000-0000-0000-000000000001","academic_year":"2026","term":"1"}''::jsonb)');
  r1 := v -> 'schools' -> 0;
  call test_util.record('gov: attendance rate is pooled present+late over qualifying days',
    (r1 ->> 'attendance_rate')::numeric = 86.7 and (r1 ->> 'attendance_records')::int = 30, r1::text);
  call test_util.record('gov: average and pass rate come from assessment results',
    (r1 ->> 'average_percent')::numeric = 70.0 and (r1 ->> 'pass_rate')::numeric = 83.3, r1::text);
  call test_util.record('gov: enrolment, educators and staff are counted from source tables',
    (r1 ->> 'learners_enrolled')::int = 6 and (r1 ->> 'educators')::int = 1 and (r1 ->> 'staff')::int = 2, r1::text);
  call test_util.record('gov: learners requiring intervention and overdue interventions are counted',
    (r1 ->> 'learners_requiring_intervention')::int = 1 and (r1 -> 'interventions' ->> 'overdue')::int = 1
    and r1 -> 'attention' ? 'overdue_interventions', r1::text);
  call test_util.record('gov: subject breakdown uses subject data',
    v -> 'subjects' -> 0 ->> 'subject' = 'Mathematics' and (v -> 'subjects' -> 0 ->> 'average_percent')::numeric = 70.0, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{"school_id":"ec000000-0000-0000-0000-000000000001","academic_year":"2026","term":"2"}''::jsonb)');
  r1 := v -> 'schools' -> 0;
  call test_util.record('gov: term filter uses that term''s dates',
    (r1 ->> 'attendance_rate')::numeric = 0.0 and (r1 ->> 'attendance_records')::int = 1
    and r1 -> 'average_percent' = 'null'::jsonb, r1::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{"school_id":"ec000000-0000-0000-0000-000000000001","start_date":"2026-02-02","end_date":"2026-02-05"}''::jsonb)');
  r1 := v -> 'schools' -> 0;
  call test_util.record('gov: date range filter narrows the period',
    (r1 ->> 'attendance_rate')::numeric = 83.3 and (r1 ->> 'attendance_records')::int = 24, r1::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{"school_id":"ec000000-0000-0000-0000-000000000001","academic_year":"1999"}''::jsonb)');
  r1 := v -> 'schools' -> 0;
  call test_util.record('gov: an academic year the school does not have gives no figures and a data-quality flag',
    r1 -> 'attendance_rate' = 'null'::jsonb and (r1 -> 'data_quality' ->> 'no_academic_year')::boolean, r1::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{"grade":"grade 10"}''::jsonb)');
  call test_util.record('gov: grade filter matches grade names case-insensitively',
    (v -> 'summary' ->> 'learners_enrolled')::int = 6, coalesce(v -> 'summary' ->> 'learners_enrolled', v::text));

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select public.get_government_report(''{"school_id":"ec000000-0000-0000-0000-000000000003","academic_year":"2026"}''::jsonb)');
  r1 := v -> 'schools' -> 0;
  call test_util.record('gov: school with learners but no attendance or marks reports nulls, not zeros',
    (r1 ->> 'learners_enrolled')::int = 3 and r1 -> 'attendance_rate' = 'null'::jsonb and r1 -> 'average_percent' = 'null'::jsonb, r1::text);
  call test_util.record('gov: data quality flags missing EMIS number, missing attendance and missing assessments',
    (r1 -> 'data_quality' ->> 'missing_emis_number')::boolean
    and (r1 -> 'data_quality' ->> 'classes_without_attendance')::int = 1
    and (r1 -> 'data_quality' ->> 'classes_without_assessments')::int = 1, coalesce(r1 ->> 'data_quality', 'none'));

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select public.get_government_report(''{"school_id":"ec000000-0000-0000-0000-000000000002","academic_year":"2026"}''::jsonb)');
  call test_util.record('gov: low attendance flags a school for attention',
    v -> 'schools' -> 0 -> 'attention' ? 'low_attendance', coalesce(v -> 'schools' -> 0 ->> 'attention', 'none'));

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000004', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)');
  call test_util.record('gov: empty scope returns zero totals and null rates',
    (v -> 'summary' ->> 'schools')::int = 0 and v -> 'summary' -> 'attendance_rate' = 'null'::jsonb, coalesce(v ->> 'summary', v::text));

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{"attendance_threshold":150}''::jsonb)');
  call test_util.record('gov: out-of-range thresholds are rejected',
    coalesce(v ->> 'error', '') like 'invalid_argument%', v::text);
end $$;

-- ---------------------------------------------------------------------------
-- Direct table access, administration and exports
-- ---------------------------------------------------------------------------

do $$
declare
  v jsonb;
  v_exists boolean;
begin
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select jsonb_build_object(''learners'', (select count(*) from public.learners), ''attendance'', (select count(*) from public.attendance_records), ''results'', (select count(*) from public.assessment_results), ''schools'', (select count(*) from public.schools))');
  call test_util.record('gov: an official reads no learner, attendance, result or school rows directly',
    (v ->> 'learners')::int = 0 and (v ->> 'attendance')::int = 0 and (v ->> 'results')::int = 0 and (v ->> 'schools')::int = 0, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select to_jsonb(array(select name from public.education_areas order by name))');
  call test_util.record('gov: an official sees their areas and the province above, not other districts',
    v = '["Circuit One", "District One", "Test Province One"]'::jsonb, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select to_jsonb((select count(*) from public.education_official_assignments))');
  call test_util.record('gov: an official sees only their own access grants', v::text = '1', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'with i as (insert into public.education_official_assignments (profile_id, area_id) values (''e0000000-0000-0000-0000-000000000001'', ''ea000000-0000-0000-0000-000000000012'') returning 1) select to_jsonb(count(*)) from i');
  call test_util.record('gov: an official cannot grant themselves another district directly',
    v ? 'error', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select to_jsonb(public.grant_education_official_access(''e0000000-0000-0000-0000-000000000001'', ''ea000000-0000-0000-0000-000000000012'', true))');
  call test_util.record('gov: an official cannot grant access through the RPC',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'with u as (update public.schools set education_area_id = ''ea000000-0000-0000-0000-000000000012'' where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'' returning 1) select to_jsonb(count(*)) from u');
  call test_util.record('gov: a school owner cannot move their school to another district',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%' or v::text = '0', v::text);

  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select to_jsonb(public.provision_education_official(''x@department.test'', ''X'', ''Y''))');
  call test_util.record('gov: a school owner cannot create education official accounts',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  -- Platform administrator grants O4 District Three, O4 sees R3, then the
  -- grant is revoked and the access disappears.
  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.grant_education_official_access(''e0000000-0000-0000-0000-000000000004'', ''ea000000-0000-0000-0000-000000000021'', false))');
  call test_util.record('gov: platform administrator can grant area access', v ->> 'error' is null, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000004', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)');
  call test_util.record('gov: a new grant takes effect immediately',
    test_util.gr_ids(v) = 'ec000000-0000-0000-0000-000000000003', v::text);

  perform test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.revoke_education_official_access((select id from public.education_official_assignments where profile_id = ''e0000000-0000-0000-0000-000000000004'' and active)))');
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000004', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)');
  call test_util.record('gov: revoking a grant removes access immediately',
    jsonb_array_length(v -> 'schools') = 0, v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.provision_education_official(''new.official@department.test'', ''New'', ''Official''))');
  select exists (select 1 from public.profiles where email = 'new.official@department.test'
                 and role = 'education_official' and tenant_id is null) into v_exists;
  call test_util.record('gov: platform administrator can provision an official account with no school',
    v ->> 'error' is null and v_exists, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select to_jsonb(public.record_government_report_export(''district_summary'', ''csv'', ''{"school_id":"ec000000-0000-0000-0000-000000000002"}''::jsonb))');
  call test_util.record('gov: an export cannot be recorded for a school outside the caller''s scope',
    coalesce(v ->> 'error', '') like 'insufficient_privilege%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select to_jsonb(public.record_government_report_export(''district_summary'', ''csv'', ''{}''::jsonb))');
  select exists (select 1 from public.audit_log where action = 'government_report_exported'
                 and actor_profile_id = 'e0000000-0000-0000-0000-000000000001') into v_exists;
  call test_util.record('gov: exports are recorded in the audit log', v ->> 'error' is null and v_exists, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select to_jsonb(public.record_government_report_export(''district_summary'', ''xlsm'', ''{}''::jsonb))');
  call test_util.record('gov: unknown export formats are rejected',
    coalesce(v ->> 'error', '') like 'invalid_argument%', v::text);
end $$;

-- A school can only be linked to a district or circuit.
do $$
declare
  v_err text;
begin
  begin
    update public.schools set education_area_id = 'ea000000-0000-0000-0000-000000000001'
    where id = 'ec000000-0000-0000-0000-000000000003';
    v_err := 'accepted';
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  call test_util.record('gov: a school cannot be linked directly to a province', v_err like 'invalid_argument%', v_err);

  begin
    insert into public.education_areas (level, parent_id, name)
    values ('circuit', 'ea000000-0000-0000-0000-000000000001', 'Bad circuit');
    v_err := 'accepted';
  exception when others then
    get stacked diagnostics v_err = message_text;
  end;
  call test_util.record('gov: a circuit must sit under a district', v_err like 'invalid_argument%', v_err);
end $$;

-- ---------------------------------------------------------------------------
-- Mandatory MFA for officials and platform administrators
-- ---------------------------------------------------------------------------

do $$
declare
  v jsonb;
begin
  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)', 'aal1');
  call test_util.record('mfa: official without MFA cannot read the district report',
    coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_reporting_scope()', 'aal1');
  call test_util.record('mfa: official without MFA cannot read their reporting scope',
    coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_school_report(''ec000000-0000-0000-0000-000000000001''::uuid, ''{}''::jsonb)', 'aal1');
  call test_util.record('mfa: official without MFA cannot drill into a school',
    coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000002', 'education_official', null,
    'select public.get_class_learner_report(''ef000000-0000-0000-0000-000000000002''::uuid, ''{}''::jsonb)', 'aal1');
  call test_util.record('mfa: official with the learner grant but no MFA cannot list learners',
    coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select to_jsonb(public.record_government_report_export(''school_summary'', ''csv'', ''{}''::jsonb))', 'aal1');
  call test_util.record('mfa: official without MFA cannot record an export',
    coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select to_jsonb((select count(*) from public.education_areas))', 'aal1');
  call test_util.record('mfa: official without MFA sees no education areas', v::text = '0', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select public.get_government_report(''{}''::jsonb)', 'aal1');
  call test_util.record('mfa: platform administrator without MFA cannot read reports',
    coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.grant_education_official_access(''e0000000-0000-0000-0000-000000000004'', ''ea000000-0000-0000-0000-000000000021'', true))', 'aal1');
  call test_util.record('mfa: platform administrator without MFA cannot grant access',
    coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.provision_education_official(''nomfa@department.test'', ''No'', ''Mfa''))', 'aal1');
  call test_util.record('mfa: platform administrator without MFA cannot create official accounts',
    coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb(public.set_school_education_area(''ec000000-0000-0000-0000-000000000003'', ''ea000000-0000-0000-0000-000000000011''))', 'aal1');
  call test_util.record('mfa: platform administrator without MFA cannot move a school between areas',
    coalesce(v ->> 'error', '') like 'mfa_required%', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb((select count(*) from public.education_official_assignments))', 'aal1');
  call test_util.record('mfa: platform administrator without MFA cannot list officials'' access grants', v::text = '0', v::text);

  v := test_util.gr_call('44444444-4444-4444-4444-444444444444', 'platform_administrator', null,
    'select to_jsonb((select count(*) from public.schools))', 'aal1');
  call test_util.record('mfa: the requirement is scoped to reporting; other platform administration is unchanged',
    (v #>> '{}')::int >= 2, v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select public.get_government_report(''{}''::jsonb)', 'aal2');
  call test_util.record('mfa: the same official with an MFA session gets their district',
    test_util.gr_ids(v) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,ec000000-0000-0000-0000-000000000001', v::text);

  v := test_util.gr_call('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'select public.get_government_report(''{}''::jsonb)', 'aal1');
  call test_util.record('mfa: school owner reporting on their own school is unchanged',
    test_util.gr_ids(v) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v::text);

  v := test_util.gr_call('e0000000-0000-0000-0000-000000000001', 'education_official', null,
    'select to_jsonb((select count(*) from public.education_official_assignments))', 'aal1');
  call test_util.record('mfa: an official can still see their own access grants before setting up MFA', v::text = '1', v::text);
end $$;
