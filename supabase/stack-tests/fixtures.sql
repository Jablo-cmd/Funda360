-- Fixture data for supabase/stack-tests/government-reporting.mjs.
-- Load as a superuser into a DISPOSABLE local Supabase database only
-- (supabase start / a throwaway branch). Never run against production.
--
-- Same areas, schools and figures as
-- supabase/rls-tests/tests/zz_government_reporting.test.sql, so both suites
-- expect the same numbers:
--   P1 Test Province One -- D1 District One -- C1 Circuit One -> R1
--                        \- D2 District Two                  -> R2
--   P2 Test Province Two -- D3 District Three                -> R3
-- Users are created by the test through Supabase Auth.

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

