-- Curriculum Engine regression suite (20261001090000 / 20261001100000).
-- Fixtures: the Grade 4 Mathematics content pack (draft) + 15_curriculum_fixtures.sql.
-- Identities: platform admin 4444 (no tenant), School A teacher 1111 (teaches class 4A only), School A owner 2222,
-- curriculum parent c1 (guardian of learner b2 only), School B teacher 3333.

create or replace function test_util.become(p_uid uuid, p_role text, p_tenant uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', test_util.jwt_claims(p_uid, p_role, p_tenant), true);
  execute 'set local role authenticated';
end $$;

create or replace function test_util.err_of(p_sql text) returns text language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
    return 'ok';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    return v_msg;
  end;
end $$;
grant execute on function test_util.err_of(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 0. Fixtures for this suite only. They are created here and removed at the end, so the shared fixture
--    universe (learner counts, guardian links) that other suites assert on is left exactly as found.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'c4c40000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated',
   'curriculum.parent@schoola.test', jsonb_build_object('role', 'parent', 'tenant_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
insert into public.profiles (id, tenant_id, first_name, last_name, email, role, status) values
  ('c4c40000-0000-0000-0000-0000000000c1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Curriculum', 'Parent', 'curriculum.parent@schoola.test', 'parent', 'active');

insert into public.grades (id, school_id, name, sort_order) values
  ('c4c40000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Grade 4', 4);

insert into public.classes (id, grade_id, school_id, name, capacity) values
  ('c4c40000-0000-0000-0000-0000000000a1', 'c4c40000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Grade 4A', 35),
  ('c4c40000-0000-0000-0000-0000000000a2', 'c4c40000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Grade 4B', 35);

insert into public.learners (id, school_id, learner_number, admission_number, first_name, last_name, date_of_birth, status, admission_date) values
  ('c4c40000-0000-0000-0000-0000000000b1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'LRN-C4001', 'ADM-C4001', 'Amahle', 'Nkosi', '2016-02-01', 'active', '2026-01-15'),
  ('c4c40000-0000-0000-0000-0000000000b2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'LRN-C4002', 'ADM-C4002', 'Bongani', 'Dlamini', '2016-03-01', 'active', '2026-01-15'),
  ('c4c40000-0000-0000-0000-0000000000b3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'LRN-C4003', 'ADM-C4003', 'Chantelle', 'Botha', '2016-04-01', 'active', '2026-01-15'),
  ('c4c40000-0000-0000-0000-0000000000b4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'LRN-C4004', 'ADM-C4004', 'Dineo', 'Molefe', '2016-05-01', 'active', '2026-01-15'),
  ('c4c40000-0000-0000-0000-0000000000b5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'LRN-C4005', 'ADM-C4005', 'Elias', 'Naidoo', '2016-06-01', 'active', '2026-01-15');

-- b1..b4 are in 4A (taught by teacher 11111111); b5 is in 4B, which that teacher does not teach.
insert into public.learner_enrollments (id, school_id, learner_id, academic_year_id, grade_id, class_id, enrollment_date) values
  ('c4c40000-0000-0000-0000-0000000000e1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c4c40000-0000-0000-0000-0000000000b1', 'aaaa1111-0000-0000-0000-000000000001', 'c4c40000-0000-0000-0000-000000000001', 'c4c40000-0000-0000-0000-0000000000a1', '2026-01-15'),
  ('c4c40000-0000-0000-0000-0000000000e2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c4c40000-0000-0000-0000-0000000000b2', 'aaaa1111-0000-0000-0000-000000000001', 'c4c40000-0000-0000-0000-000000000001', 'c4c40000-0000-0000-0000-0000000000a1', '2026-01-15'),
  ('c4c40000-0000-0000-0000-0000000000e3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c4c40000-0000-0000-0000-0000000000b3', 'aaaa1111-0000-0000-0000-000000000001', 'c4c40000-0000-0000-0000-000000000001', 'c4c40000-0000-0000-0000-0000000000a1', '2026-01-15'),
  ('c4c40000-0000-0000-0000-0000000000e4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c4c40000-0000-0000-0000-0000000000b4', 'aaaa1111-0000-0000-0000-000000000001', 'c4c40000-0000-0000-0000-000000000001', 'c4c40000-0000-0000-0000-0000000000a1', '2026-01-15'),
  ('c4c40000-0000-0000-0000-0000000000e5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c4c40000-0000-0000-0000-0000000000b5', 'aaaa1111-0000-0000-0000-000000000001', 'c4c40000-0000-0000-0000-000000000001', 'c4c40000-0000-0000-0000-0000000000a2', '2026-01-15');

insert into public.class_teacher_assignments (id, school_id, academic_year_id, class_id, subject_id, teacher_profile_id) values
  ('c4c40000-0000-0000-0000-0000000000f1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-0000-0000-0000-000000000001',
   'c4c40000-0000-0000-0000-0000000000a1', 'facade00-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');

-- Parent 55555555 is the guardian of b2 only.
insert into public.learner_guardians (id, school_id, learner_id, guardian_profile_id, relationship_type, is_primary) values
  ('c4c40000-0000-0000-0000-0000000000d2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c4c40000-0000-0000-0000-0000000000b2',
   'c4c40000-0000-0000-0000-0000000000c1', 'mother', false);

-- ---------------------------------------------------------------------------
-- 1. Structure: composite foreign keys, valid values, valid subject relationships
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid; v2 uuid; e text;
  v_ip uuid; v_wn uuid; v_add uuid;
  v_subtopic uuid;
begin
  select id into v from public.curriculum_versions where code = 'ZA-CAPS-G4-MATH-SLICE';
  select id into v_ip from public.curriculum_phases where version_id = v and code = 'IP';
  select id into v_wn from public.curriculum_topics where code = 'G4.MATH.T1.WN';
  select id into v_add from public.curriculum_topics where code = 'G4.MATH.T1.ADD';
  insert into public.curriculum_versions (code, name, source) values ('TEST-V2', 'Second draft version', 'test') returning id into v2;

  e := test_util.err_of(format($q$insert into public.curriculum_grades (version_id, phase_id, grade_number, name) values (%L, %L, 5, 'Grade 5')$q$, v2, v_ip));
  call test_util.record('a grade cannot point at a phase from another curriculum version', e like '%foreign key%', e);

  e := test_util.err_of(format($q$insert into public.curriculum_phases (version_id, code, name) values (%L, 'XX', 'Bogus')$q$, v));
  call test_util.record('phase codes are limited to FP, IP, SP and FET', e like '%check constraint%', e);

  e := test_util.err_of(format($q$insert into public.curriculum_grades (version_id, phase_id, grade_number, name) values (%L, %L, 13, 'Grade 13')$q$, v, v_ip));
  call test_util.record('grade numbers outside R-12 are rejected', e like '%check constraint%', e);

  e := test_util.err_of(format($q$insert into public.curriculum_grade_subjects (version_id, grade_id, subject_id)
    select version_id, grade_id, subject_id from public.curriculum_grade_subjects where version_id = %L$q$, v));
  call test_util.record('a subject can be attached to a grade only once', e like '%unique%', e);

  insert into public.curriculum_subtopics (version_id, topic_id, code, title) values (v, v_add, 'G4.MATH.T1.ADD.ST1', 'Number line jumps') returning id into v_subtopic;
  e := test_util.err_of(format($q$insert into public.curriculum_objectives (version_id, topic_id, subtopic_id, code, description)
    values (%L, %L, %L, 'G4.MATH.T1.BAD', 'wrong parent')$q$, v, v_wn, v_subtopic));
  call test_util.record('an objective cannot use a subtopic from a different topic', e like '%foreign key%', e);

  e := test_util.err_of(format($q$insert into public.lessons (curriculum_version_id, grade_subject_id, topic_id, title)
    select %L, id, %L, 'wrong' from public.curriculum_grade_subjects where version_id = %L$q$, v2, v_wn, v));
  call test_util.record('a lesson cannot mix a grade-subject and topic from different versions', e like '%foreign key%', e);

  e := test_util.err_of(format($q$insert into public.lessons (curriculum_version_id, grade_subject_id, topic_id, title, origin)
    select %L, id, %L, 'ai', 'ai_draft' from public.curriculum_grade_subjects where version_id = %L$q$, v, v_wn, v));
  call test_util.record('AI-assisted content must carry a disclosure', e like '%ai_needs_disclosure%', e);

  e := test_util.err_of(format($q$insert into public.teaching_resources (curriculum_version_id, grade_subject_id, topic_id, stage, resource_kind, title, printable)
    select %L, id, %L, 'print', 'worksheet', 'not printable', false from public.curriculum_grade_subjects where version_id = %L$q$, v, v_wn, v));
  call test_util.record('a print-stage resource must be printable', e like '%print_is_printable%', e);

  e := test_util.err_of(format($q$insert into public.lessons (curriculum_version_id, grade_subject_id, topic_id, title, status)
    select %L, id, %L, 'sneaky', 'published' from public.curriculum_grade_subjects where version_id = %L$q$, v, v_wn, v));
  call test_util.record('new content must start as draft', e like '%must start as draft%', e);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Drafts are invisible to ordinary users
-- ---------------------------------------------------------------------------
do $$
declare n_ver int; n_obj int; n_les int; n_admin_ver int; n_admin_obj int;
begin
  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into n_ver from public.curriculum_versions;
  select count(*) into n_obj from public.curriculum_objectives;
  select count(*) into n_les from public.lessons;
  execute 'reset role';
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  select count(*) into n_admin_ver from public.curriculum_versions;
  select count(*) into n_admin_obj from public.curriculum_objectives;
  execute 'reset role';
  call test_util.record('a teacher sees no draft curriculum versions, objectives or lessons', n_ver = 0 and n_obj = 0 and n_les = 0,
    format('versions=%s objectives=%s lessons=%s', n_ver, n_obj, n_les));
  call test_util.record('a platform administrator sees draft curriculum', n_admin_ver = 2 and n_admin_obj = 7,
    format('versions=%s objectives=%s', n_admin_ver, n_admin_obj));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Lifecycle: no skipping, admins only, frozen once approved, low-resource rule
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid; e text; r record; v_lesson uuid; v_assess uuid; v_wn uuid; v_gs uuid; v_obj uuid;
  v_x uuid; v_xr uuid; v_z uuid; v_ai uuid; v_b uuid; v_bq uuid; n_topics int; n_rows int; n_objs int; s_lesson text; s_assess text; n_events int; still_there boolean;
begin
  select id into v from public.curriculum_versions where code = 'ZA-CAPS-G4-MATH-SLICE';
  select id into v_lesson from public.lessons where title = 'Place value to 10 000';
  select id into v_assess from public.learning_assessments where title like 'Quick check%';
  select id into v_wn from public.curriculum_topics where code = 'G4.MATH.T1.WN';
  select id into v_gs from public.curriculum_grade_subjects where version_id = v;
  select id into v_obj from public.curriculum_objectives where code = 'G4.MATH.T1.WN.02';

  -- a teacher cannot transition content
  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  e := test_util.err_of(format($q$select public.content_transition('curriculum_version', %L, 'review')$q$, v));
  execute 'reset role';
  call test_util.record('a teacher cannot change the status of curriculum content', e like '%only platform administrators%', e);

  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  e := test_util.err_of(format($q$select public.content_transition('curriculum_version', %L, 'published')$q$, v));
  call test_util.record('content cannot skip review (draft to published)', e like '%cannot move from draft to published%', e);

  e := test_util.err_of(format($q$update public.lessons set status = 'published' where id = %L$q$, v_lesson));
  call test_util.record('status cannot be changed by a direct update, even by an administrator', e like '%content_transition%', e);
  execute 'reset role';

  -- AI-assisted content: requester cannot approve their own request
  insert into public.lessons (curriculum_version_id, grade_subject_id, topic_id, title, origin, ai_disclosure)
  values (v, v_gs, v_wn, 'AI drafted lesson', 'ai_draft', 'Drafted with AI assistance; needs human review') returning id into v_ai;
  update public.lessons set created_by = '44444444-4444-4444-4444-444444444444' where id = v_ai;
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  perform public.content_transition('lesson', v_ai, 'review');
  e := test_util.err_of(format($q$select public.content_transition('lesson', %L, 'approved')$q$, v_ai));
  execute 'reset role';
  call test_util.record('an AI-assisted lesson cannot be approved by the person who requested it', e like '%other than the person%', e);

  -- version: review -> approved, then it is frozen
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  perform public.content_transition('curriculum_version', v, 'review', 'ready for review');
  perform public.content_transition('curriculum_version', v, 'approved', 'checked against the official document');
  perform public.content_transition('lesson', v_lesson, 'review');
  perform public.content_transition('lesson', v_lesson, 'approved');
  e := test_util.err_of(format($q$select public.content_transition('lesson', %L, 'published')$q$, v_lesson));
  execute 'reset role';
  call test_util.record('content cannot be published before its curriculum version is published', e like '%version must be published%', e);

  e := test_util.err_of(format($q$insert into public.curriculum_objectives (version_id, topic_id, code, description) values (%L, %L, 'G4.LATE', 'late edit')$q$, v, v_wn));
  call test_util.record('an approved curriculum version can no longer be edited', e like '%cannot be edited%', e);

  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  perform public.content_transition('curriculum_version', v, 'published');
  execute 'reset role';
  select count(*) into n_topics from public.curriculum_topics where version_id = v and status = 'published';
  select count(*) into n_objs from public.curriculum_objectives where version_id = v and status = 'published';
  call test_util.record('publishing a version publishes its topics and objectives', n_topics = 3 and n_objs = 7, format('topics=%s objectives=%s', n_topics, n_objs));

  -- publish every lesson-1 resource, then the lesson, then the quick check
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  for r in select id from public.teaching_resources where curriculum_version_id = v and title <> 'Jumping on a number line' order by id loop
    perform public.content_transition('teaching_resource', r.id, 'review');
    perform public.content_transition('teaching_resource', r.id, 'approved');
    perform public.content_transition('teaching_resource', r.id, 'published');
  end loop;
  perform public.content_transition('lesson', v_lesson, 'published');
  perform public.content_transition('learning_assessment', v_assess, 'review');
  perform public.content_transition('learning_assessment', v_assess, 'approved');
  perform public.content_transition('learning_assessment', v_assess, 'published');
  execute 'reset role';
  select status::text into s_lesson from public.lessons where id = v_lesson;
  select status::text into s_assess from public.learning_assessments where id = v_assess;
  select count(*) into n_events from public.content_review_events where entity_table = 'lessons' and entity_id = v_lesson;
  call test_util.record('lesson, resources and quick check publish through the full lifecycle',
    s_lesson = 'published' and s_assess = 'published' and n_events = 3, format('lesson=%s check=%s events=%s', s_lesson, s_assess, n_events));

  -- a lesson whose only resource needs a projector cannot be published
  insert into public.lessons (curriculum_version_id, grade_subject_id, topic_id, title) values (v, v_gs, v_wn, 'Projector only') returning id into v_x;
  insert into public.lesson_objectives (lesson_id, objective_id, curriculum_version_id) values (v_x, v_obj, v);
  insert into public.teaching_resources (curriculum_version_id, grade_subject_id, topic_id, stage, resource_kind, title, connectivity, projector_required, device, delivery_formats)
  values (v, v_gs, v_wn, 'show', 'animation', 'Animated place value (projector)', 'low', true, 'teacher_device', '{visual,video_audio}') returning id into v_xr;
  insert into public.lesson_resources (lesson_id, resource_id, curriculum_version_id) values (v_x, v_xr, v);
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  perform public.content_transition('teaching_resource', v_xr, 'review');
  perform public.content_transition('teaching_resource', v_xr, 'approved');
  perform public.content_transition('teaching_resource', v_xr, 'published');
  perform public.content_transition('lesson', v_x, 'review');
  perform public.content_transition('lesson', v_x, 'approved');
  e := test_util.err_of(format($q$select public.content_transition('lesson', %L, 'published')$q$, v_x));
  execute 'reset role';
  call test_util.record('a lesson needs a resource usable without a projector, connectivity or learner devices', e like '%without a projector%', e);

  -- a lesson with no objective cannot be published
  insert into public.lessons (curriculum_version_id, grade_subject_id, topic_id, title) values (v, v_gs, v_wn, 'No objective') returning id into v_z;
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  perform public.content_transition('lesson', v_z, 'review');
  perform public.content_transition('lesson', v_z, 'approved');
  e := test_util.err_of(format($q$select public.content_transition('lesson', %L, 'published')$q$, v_z));
  execute 'reset role';
  call test_util.record('a lesson needs at least one curriculum objective', e like '%at least one curriculum objective%', e);

  -- a quick check with a question that has no answer key cannot be published
  insert into public.learning_assessments (curriculum_version_id, grade_subject_id, topic_id, title) values (v, v_gs, v_wn, 'Keyless check') returning id into v_b;
  insert into public.assessment_objectives (assessment_id, objective_id, curriculum_version_id) values (v_b, v_obj, v);
  insert into public.assessment_questions (assessment_id, curriculum_version_id, position, question_type, prompt) values (v_b, v, 1, 'numeric', 'What is 1 + 1?') returning id into v_bq;
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  perform public.content_transition('learning_assessment', v_b, 'review');
  perform public.content_transition('learning_assessment', v_b, 'approved');
  e := test_util.err_of(format($q$select public.content_transition('learning_assessment', %L, 'published')$q$, v_b));
  execute 'reset role';
  call test_util.record('every question needs an answer key before a quick check is published', e like '%answer key%', e);

  -- published content is immutable; its links are frozen; it is never deleted
  e := test_util.err_of(format($q$update public.lessons set title = 'Changed after publishing' where id = %L$q$, v_lesson));
  call test_util.record('published content is immutable', e like '%immutable%', e);
  e := test_util.err_of(format($q$insert into public.lesson_objectives (lesson_id, objective_id, curriculum_version_id)
    select %L, id, version_id from public.curriculum_objectives where code = 'G4.MATH.T1.ADD.01'$q$, v_lesson));
  call test_util.record('links of a published lesson are frozen', e like '%cannot be edited%', e);

  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  delete from public.lessons where id = v_lesson;
  get diagnostics n_rows = row_count;
  execute 'reset role';
  select exists (select 1 from public.lessons where id = v_lesson) into still_there;
  call test_util.record('published content cannot be deleted by anyone (retire instead)', n_rows = 0 and still_there, format('deleted=%s', n_rows));
end $$;

-- ---------------------------------------------------------------------------
-- 4. What ordinary users can see once published
-- ---------------------------------------------------------------------------
do $$
declare n_ver int; n_obj int; n_les int; n_res int; n_keys int; n_q int; n_keys_parent int; n_q_parent int; n_retired int; v_xr uuid;
begin
  select id into v_xr from public.teaching_resources where title = 'Animated place value (projector)';
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  perform public.content_transition('teaching_resource', v_xr, 'retired');
  execute 'reset role';

  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into n_ver from public.curriculum_versions;
  select count(*) into n_obj from public.curriculum_objectives;
  select count(*) into n_les from public.lessons;
  select count(*) into n_res from public.teaching_resources where status = 'published';
  select count(*) into n_retired from public.teaching_resources where status = 'retired';
  select count(*) into n_keys from public.assessment_question_keys;
  select count(*) into n_q from public.assessment_questions;
  execute 'reset role';
  call test_util.record('a teacher sees the published version (not the second draft), its objectives and the published lesson',
    n_ver = 1 and n_obj = 7 and n_les = 1, format('versions=%s objectives=%s lessons=%s', n_ver, n_obj, n_les));
  call test_util.record('a teacher sees published toolkit resources and retired ones stay readable for history',
    n_res = 14 and n_retired = 1, format('published=%s retired=%s', n_res, n_retired));
  call test_util.record('a teacher can read questions and answer keys', n_q = 5 and n_keys = 5, format('questions=%s keys=%s', n_q, n_keys));

  perform test_util.become('c4c40000-0000-0000-0000-0000000000c1', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into n_q_parent from public.assessment_questions;
  select count(*) into n_keys_parent from public.assessment_question_keys;
  execute 'reset role';
  call test_util.record('a parent can see published questions but never the answer keys', n_q_parent = 5 and n_keys_parent = 0,
    format('questions=%s keys=%s', n_q_parent, n_keys_parent));
end $$;

-- ---------------------------------------------------------------------------
-- 5. School setup: adoption and mapping
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid; v2 uuid; e text; n_adopt int; v_id uuid; v_id2 uuid; v_cgrade uuid; v_csubject uuid;
begin
  select id into v from public.curriculum_versions where code = 'ZA-CAPS-G4-MATH-SLICE';
  select id into v2 from public.curriculum_versions where code = 'TEST-V2';
  select id into v_cgrade from public.curriculum_grades where version_id = v;
  select id into v_csubject from public.curriculum_subjects where version_id = v;

  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  e := test_util.err_of(format($q$select public.adopt_curriculum_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', %L)$q$, v));
  execute 'reset role';
  call test_util.record('a teacher cannot choose the school curriculum version', e like '%only academic managers%', e);

  perform test_util.become('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  e := test_util.err_of(format($q$select public.adopt_curriculum_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', %L)$q$, v2));
  call test_util.record('a draft curriculum version cannot be adopted', e like '%published%', e);
  v_id := public.adopt_curriculum_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v);
  v_id2 := public.adopt_curriculum_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v);
  select count(*) into n_adopt from public.school_curriculum_adoptions;
  call test_util.record('an owner adopts a published version, and adopting again is idempotent', v_id is not null and v_id = v_id2 and n_adopt = 1, format('rows=%s', n_adopt));

  insert into public.school_grade_curriculum_map (school_id, school_grade_id, curriculum_version_id, curriculum_grade_id)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c4c40000-0000-0000-0000-000000000001', v, v_cgrade);
  insert into public.school_subject_curriculum_map (school_id, school_subject_id, curriculum_version_id, curriculum_subject_id)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'facade00-0000-0000-0000-000000000001', v, v_csubject);
  e := test_util.err_of(format($q$insert into public.school_grade_curriculum_map (school_id, school_grade_id, curriculum_version_id, curriculum_grade_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cafe2222-0000-0000-0000-000000000001', %L, %L)$q$, v, v_cgrade));
  execute 'reset role';
  call test_util.record('a school cannot map another school''s grade', e like '%must match the school%', e);

  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  e := test_util.err_of(format($q$insert into public.school_grade_curriculum_map (school_id, school_grade_id, curriculum_version_id, curriculum_grade_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa2222-0000-0000-0000-000000000001', %L, %L)$q$, v, v_cgrade));
  execute 'reset role';
  call test_util.record('a teacher cannot edit curriculum mappings', e like '%row-level security%', e);

  perform test_util.become('33333333-3333-3333-3333-333333333333', 'teacher', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  select count(*) into n_adopt from public.school_curriculum_adoptions;
  execute 'reset role';
  call test_util.record('another school cannot see this school''s adoption', n_adopt = 0, format('rows=%s', n_adopt));
end $$;

-- ---------------------------------------------------------------------------
-- 6. Teaching workflow: current topic and assignments
-- ---------------------------------------------------------------------------
do $$
declare
  v_wn uuid; v_add uuid; v_lesson uuid; v_lesson2 uuid; v_assess uuid; e text; v_plan uuid; n_current int; n_done int;
  v_a uuid; n_assign int;
begin
  select id into v_wn from public.curriculum_topics where code = 'G4.MATH.T1.WN';
  select id into v_add from public.curriculum_topics where code = 'G4.MATH.T1.ADD';
  select id into v_lesson from public.lessons where title = 'Place value to 10 000';
  select id into v_lesson2 from public.lessons where title = 'Adding and subtracting with a number line';
  select id into v_assess from public.learning_assessments where title like 'Quick check%';

  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_plan := public.set_class_current_topic('c4c40000-0000-0000-0000-0000000000a1', 'facade00-0000-0000-0000-000000000001', v_wn);
  call test_util.record('the class teacher sets the current topic', v_plan is not null, 'plan id');

  e := test_util.err_of($q$select public.set_class_current_topic('c4c40000-0000-0000-0000-0000000000a2', 'facade00-0000-0000-0000-000000000001', (select id from public.curriculum_topics where code = 'G4.MATH.T1.WN'))$q$);
  call test_util.record('a teacher cannot set the topic for a class they do not teach', e like '%do not teach%', e);

  perform public.set_class_current_topic('c4c40000-0000-0000-0000-0000000000a1', 'facade00-0000-0000-0000-000000000001', v_add);
  execute 'reset role';
  select count(*) filter (where status = 'in_progress'), count(*) filter (where status = 'completed') into n_current, n_done
  from public.class_topic_plans where class_id = 'c4c40000-0000-0000-0000-0000000000a1';
  call test_util.record('changing the topic completes the previous one and keeps exactly one current topic', n_current = 1 and n_done = 1,
    format('current=%s completed=%s', n_current, n_done));
  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  perform public.set_class_current_topic('c4c40000-0000-0000-0000-0000000000a1', 'facade00-0000-0000-0000-000000000001', v_wn);
  execute 'reset role';

  perform test_util.become('33333333-3333-3333-3333-333333333333', 'teacher', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  e := test_util.err_of($q$select public.set_class_current_topic('c4c40000-0000-0000-0000-0000000000a1', 'facade00-0000-0000-0000-000000000001', (select id from public.curriculum_topics where code = 'G4.MATH.T1.WN'))$q$);
  execute 'reset role';
  call test_util.record('a teacher from another school cannot act on this school''s class', e like '%do not teach%', e);

  perform test_util.become('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  e := test_util.err_of($q$select public.set_class_current_topic('cccc1111-0000-0000-0000-000000000001', 'facade00-0000-0000-0000-000000000001', (select id from public.curriculum_topics where code = 'G4.MATH.T1.WN'))$q$);
  execute 'reset role';
  call test_util.record('a topic cannot be used for a class whose grade is not mapped to it', e like '%not mapped%', e);

  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  v_a := public.assign_learning_to_class('c4c40000-0000-0000-0000-0000000000a1', 'facade00-0000-0000-0000-000000000001', v_lesson, null, null, null, 'Do the practice set', null);
  call test_util.record('a teacher assigns a published lesson to their class', v_a is not null, 'assignment id');
  v_a := public.assign_learning_to_class('c4c40000-0000-0000-0000-0000000000a1', 'facade00-0000-0000-0000-000000000001', null, null, v_assess, null, null, now() + interval '2 days');
  e := test_util.err_of(format($q$select public.assign_learning_to_class('c4c40000-0000-0000-0000-0000000000a1', 'facade00-0000-0000-0000-000000000001', %L)$q$, v_lesson2));
  call test_util.record('a draft lesson cannot be assigned', e like '%only published lessons%', e);
  e := test_util.err_of($q$select public.assign_learning_to_class('c4c40000-0000-0000-0000-0000000000a1', 'facade00-0000-0000-0000-000000000001')$q$);
  call test_util.record('an assignment needs a target', e like '%choose a lesson%', e);
  e := test_util.err_of(format($q$select public.assign_learning_to_class('c4c40000-0000-0000-0000-0000000000a2', 'facade00-0000-0000-0000-000000000001', %L)$q$, v_lesson));
  call test_util.record('a teacher cannot assign learning to a class they do not teach', e like '%do not teach%', e);
  select count(*) into n_assign from public.class_learning_assignments;
  execute 'reset role';
  call test_util.record('the teacher can read the class assignments', n_assign = 2, format('assignments=%s', n_assign));
end $$;

-- ---------------------------------------------------------------------------
-- 7. Evidence and derived progress
-- ---------------------------------------------------------------------------
do $$
declare
  v_assess uuid; v_obj uuid; a public.learning_attempts; e text; s text; n int; v_ev int; v_mastered timestamptz; n_lp int;
begin
  select id into v_assess from public.learning_assessments where title like 'Quick check%';
  select id into v_obj from public.curriculum_objectives where code = 'G4.MATH.T1.WN.02';

  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

  -- b1: 2/6, then 3/6, then 5/6
  a := public.record_learning_attempt('c4c40000-0000-0000-0000-0000000000b1', v_assess, null, 2);
  call test_util.record('an attempt stores the score, the maximum from the question marks and the percentage',
    a.max_score = 6 and a.percent = 33.33 and a.attempt_number = 1, format('max=%s percent=%s n=%s', a.max_score, a.percent, a.attempt_number));
  select status::text into s from public.learner_objective_progress where learner_id = 'c4c40000-0000-0000-0000-0000000000b1' and objective_id = v_obj;
  call test_util.record('a low latest result means needs_support', s = 'needs_support', s);
  perform public.record_learning_attempt('c4c40000-0000-0000-0000-0000000000b1', v_assess, null, 3);
  select status::text into s from public.learner_objective_progress where learner_id = 'c4c40000-0000-0000-0000-0000000000b1' and objective_id = v_obj;
  call test_util.record('two results below 60% still mean needs_support', s = 'needs_support', s);
  perform public.record_learning_attempt('c4c40000-0000-0000-0000-0000000000b1', v_assess, null, 5);
  select status::text, evidence_count into s, v_ev from public.learner_objective_progress where learner_id = 'c4c40000-0000-0000-0000-0000000000b1' and objective_id = v_obj;
  call test_util.record('one strong result after struggling is completed, not mastered', s = 'completed' and v_ev = 3, format('%s / evidence=%s', s, v_ev));

  -- b2: two perfect results -> mastered
  perform public.record_learning_attempt('c4c40000-0000-0000-0000-0000000000b2', v_assess, null, 6);
  select status::text into s from public.learner_objective_progress where learner_id = 'c4c40000-0000-0000-0000-0000000000b2' and objective_id = v_obj;
  call test_util.record('a single strong result is completed, never mastered on one attempt', s = 'completed', s);
  perform public.record_learning_attempt('c4c40000-0000-0000-0000-0000000000b2', v_assess, null, 6);
  select status::text, mastered_at into s, v_mastered from public.learner_objective_progress where learner_id = 'c4c40000-0000-0000-0000-0000000000b2' and objective_id = v_obj;
  call test_util.record('two results at the mastery threshold mean mastered', s = 'mastered' and v_mastered is not null, s);

  -- b3: one good result; b4: one very low result
  perform public.record_learning_attempt('c4c40000-0000-0000-0000-0000000000b3', v_assess, null, 5);
  perform public.record_learning_attempt('c4c40000-0000-0000-0000-0000000000b4', v_assess, null, 1);

  e := test_util.err_of(format($q$select public.record_learning_attempt('c4c40000-0000-0000-0000-0000000000b3', %L, null, 7)$q$, v_assess));
  call test_util.record('a score above the maximum is rejected', e like '%cannot exceed%', e);
  e := test_util.err_of(format($q$select public.record_learning_attempt('c4c40000-0000-0000-0000-0000000000b5', %L, null, 4)$q$, v_assess));
  call test_util.record('a teacher cannot record results for a learner in a class they do not teach', e like '%do not teach this learner%', e);
  e := test_util.err_of(format($q$select public.record_learning_attempt('c4c40000-0000-0000-0000-0000000000b3', %L, null, null, null, true)$q$, v_assess));
  call test_util.record('a completed attempt needs a score', e like '%needs a score%', e);

  -- progress and attempts cannot be written directly by a teacher
  e := test_util.err_of($q$insert into public.learner_objective_progress (school_id, learner_id, objective_id, status)
    select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c4c40000-0000-0000-0000-0000000000b3', id, 'mastered' from public.curriculum_objectives limit 1$q$);
  call test_util.record('progress cannot be written directly (only derived from evidence)', e like '%row-level security%', e);
  e := test_util.err_of(format($q$insert into public.learning_attempts (school_id, learner_id, assessment_id, percent) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c4c40000-0000-0000-0000-0000000000b3', %L, 100)$q$, v_assess));
  call test_util.record('attempts cannot be inserted directly', e like '%row-level security%', e);

  -- class view
  select count(*) into n from public.class_objective_progress('c4c40000-0000-0000-0000-0000000000a1', v_obj);
  call test_util.record('the class view lists every enrolled learner of that class only', n = 4, format('rows=%s', n));
  e := test_util.err_of(format($q$select * from public.class_objective_progress('c4c40000-0000-0000-0000-0000000000a2', %L)$q$, v_obj));
  call test_util.record('the class view is refused for a class the teacher does not teach', e like '%do not teach%', e);
  execute 'reset role';

  select count(*) into n_lp from public.learner_lesson_progress where status = 'completed';
  call test_util.record('lesson progress is recorded from the attempts', n_lp = 4, format('completed lesson rows=%s', n_lp));
end $$;

-- ---------------------------------------------------------------------------
-- 8. Recommendations come only from recorded evidence
-- ---------------------------------------------------------------------------
do $$
declare
  v_obj uuid; v_assess uuid; n int; r1 text; r2 text; e text; v_rec uuid; s text;
begin
  select id into v_obj from public.curriculum_objectives where code = 'G4.MATH.T1.WN.02';
  select id into v_assess from public.learning_assessments where title like 'Quick check%';

  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  n := public.generate_learning_recommendations('c4c40000-0000-0000-0000-0000000000a1', v_obj);
  call test_util.record('one remediation (needs support) and one extension (mastered) are suggested', n = 2, format('created=%s', n));
  select r.title into r1 from public.learning_recommendations lr join public.teaching_resources r on r.id = lr.resource_id
    where lr.learner_id = 'c4c40000-0000-0000-0000-0000000000b4' and lr.kind = 'remediation';
  select r.title into r2 from public.learning_recommendations lr join public.teaching_resources r on r.id = lr.resource_id
    where lr.learner_id = 'c4c40000-0000-0000-0000-0000000000b2' and lr.kind = 'extension';
  call test_util.record('suggestions point at the support and challenge resources mapped to the objective',
    r1 = 'Support: build numbers with counters' and r2 = 'Challenge: largest and smallest puzzles', coalesce(r1, 'null') || ' / ' || coalesce(r2, 'null'));
  n := public.generate_learning_recommendations('c4c40000-0000-0000-0000-0000000000a1', v_obj);
  call test_util.record('generating again does not duplicate open suggestions', n = 0, format('created=%s', n));

  -- the struggling learner improves: remediation closes, extension appears
  perform public.record_learning_attempt('c4c40000-0000-0000-0000-0000000000b4', v_assess, null, 6);
  perform public.record_learning_attempt('c4c40000-0000-0000-0000-0000000000b4', v_assess, null, 6);
  n := public.generate_learning_recommendations('c4c40000-0000-0000-0000-0000000000a1', v_obj);
  select status into s from public.learning_recommendations where learner_id = 'c4c40000-0000-0000-0000-0000000000b4' and kind = 'remediation';
  call test_util.record('remediation closes once evidence shows the learner has caught up', s = 'completed' and n = 1, format('remediation=%s new=%s', s, n));

  select id into v_rec from public.learning_recommendations where learner_id = 'c4c40000-0000-0000-0000-0000000000b2' and kind = 'extension';
  perform public.update_recommendation_status(v_rec, 'accepted');
  select status into s from public.learning_recommendations where id = v_rec;
  e := test_util.err_of(format($q$select public.update_recommendation_status(%L, 'open')$q$, v_rec));
  call test_util.record('a teacher can accept a suggestion but not reopen it', s = 'accepted' and e like '%accepted, dismissed or completed%', coalesce(s, 'null') || ' / ' || e);
  execute 'reset role';
end $$;

-- ---------------------------------------------------------------------------
-- 9. Tenant and relationship isolation of learner data
-- ---------------------------------------------------------------------------
do $$
declare
  n_teacher int; n_owner int; n_b int; n_parent int; n_parent_other int; n_prog_parent int; n_plans_b int; n_platform int;
begin
  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into n_teacher from public.learning_attempts;
  execute 'reset role';
  perform test_util.become('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into n_owner from public.learning_attempts;
  execute 'reset role';
  perform test_util.become('33333333-3333-3333-3333-333333333333', 'teacher', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  select count(*) into n_b from public.learning_attempts;
  select count(*) into n_plans_b from public.class_topic_plans;
  execute 'reset role';
  perform test_util.become('c4c40000-0000-0000-0000-0000000000c1', 'parent', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into n_parent from public.learning_attempts where learner_id = 'c4c40000-0000-0000-0000-0000000000b2';
  select count(*) into n_parent_other from public.learning_attempts where learner_id <> 'c4c40000-0000-0000-0000-0000000000b2';
  select count(*) into n_prog_parent from public.learner_objective_progress;
  execute 'reset role';
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  select count(*) into n_platform from public.learning_attempts;
  execute 'reset role';

  call test_util.record('the teacher sees evidence for the learners of their own class', n_teacher = 9, format('attempts=%s', n_teacher));
  call test_util.record('the school owner sees all evidence for the school', n_owner = 9, format('attempts=%s', n_owner));
  call test_util.record('another school sees no evidence and no class plans', n_b = 0 and n_plans_b = 0, format('attempts=%s plans=%s', n_b, n_plans_b));
  call test_util.record('a guardian sees only their own child''s evidence and progress', n_parent = 2 and n_parent_other = 0 and n_prog_parent = 2,
    format('own=%s others=%s progress=%s', n_parent, n_parent_other, n_prog_parent));
  call test_util.record('a platform administrator can support any school', n_platform = 9, format('attempts=%s', n_platform));
end $$;

-- ---------------------------------------------------------------------------
-- 10. Privileges
-- ---------------------------------------------------------------------------
do $$
declare n_unforced int;
begin
  select count(*) into n_unforced from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relforcerowsecurity
    and c.relname in ('curriculum_versions', 'curriculum_phases', 'curriculum_grades', 'curriculum_subjects', 'curriculum_grade_subjects',
      'curriculum_terms', 'curriculum_topics', 'curriculum_subtopics', 'curriculum_objectives', 'curriculum_skills', 'lessons', 'lesson_objectives',
      'teaching_resources', 'lesson_resources', 'resource_objectives', 'learning_activities', 'learning_assessments', 'assessment_objectives',
      'assessment_questions', 'assessment_question_keys', 'content_review_events', 'school_curriculum_adoptions', 'school_grade_curriculum_map',
      'school_subject_curriculum_map', 'class_topic_plans', 'class_learning_assignments', 'learning_attempts', 'learner_objective_progress',
      'learner_lesson_progress', 'learning_recommendations');
  call test_util.record('anonymous users cannot run the teaching functions',
    not has_function_privilege('anon', 'public.record_learning_attempt(uuid, uuid, uuid, numeric, numeric, boolean, jsonb, uuid)', 'execute')
    and not has_function_privilege('anon', 'public.content_transition(text, uuid, public.content_status, text)', 'execute')
    and not has_function_privilege('anon', 'public.assign_learning_to_class(uuid, uuid, uuid, uuid, uuid, text, text, timestamptz)', 'execute'), 'anon execute');
  call test_util.record('internal helpers are not callable by signed-in users',
    not has_function_privilege('authenticated', 'public.derive_learner_progress(uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.can_teach_class(uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.school_follows_version(uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.class_matches_grade_subject(uuid, uuid, uuid, uuid)', 'execute'), 'authenticated execute');
  call test_util.record('teaching functions are callable by signed-in users',
    has_function_privilege('authenticated', 'public.record_learning_attempt(uuid, uuid, uuid, numeric, numeric, boolean, jsonb, uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.set_class_current_topic(uuid, uuid, uuid)', 'execute'), 'authenticated execute');
  call test_util.record('row level security is forced on every curriculum engine table', n_unforced = 0, format('not forced=%s', n_unforced));
end $$;

-- ---------------------------------------------------------------------------
-- 11. Teardown: restore the shared fixture universe for the suites that run after this one
-- ---------------------------------------------------------------------------
delete from public.audit_log where entity_table in ('class_topic_plans', 'class_learning_assignments', 'learning_attempts',
  'learning_recommendations', 'school_curriculum_adoptions', 'curriculum_versions', 'lessons', 'teaching_resources', 'learning_assessments');
delete from public.learning_recommendations;
delete from public.learning_attempts;
delete from public.learner_objective_progress;
delete from public.learner_lesson_progress;
delete from public.class_learning_assignments;
delete from public.class_topic_plans;
delete from public.school_grade_curriculum_map;
delete from public.school_subject_curriculum_map;
delete from public.school_curriculum_adoptions;
delete from public.learner_guardians where id = 'c4c40000-0000-0000-0000-0000000000d2';
delete from public.class_teacher_assignments where id = 'c4c40000-0000-0000-0000-0000000000f1';
delete from public.learner_enrollments where id::text like 'c4c40000-%';
delete from public.learners where id::text like 'c4c40000-%';
delete from public.classes where id::text like 'c4c40000-%';
delete from public.grades where id::text like 'c4c40000-%';
delete from public.profiles where id = 'c4c40000-0000-0000-0000-0000000000c1';
delete from auth.users where id = 'c4c40000-0000-0000-0000-0000000000c1';
