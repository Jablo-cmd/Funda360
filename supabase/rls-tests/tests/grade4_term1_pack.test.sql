-- Grade 4 Mathematics Term 1 (2026 ATP reconciliation) content pack: structure, provenance and governance.
-- run.sh loads supabase/content/grade4-mathematics-2026-term1.sql just before this file and this file removes it
-- again at the end, so suites that count curriculum rows are unaffected. The pack must stay DRAFT and NOT VERIFIED.

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
-- 1. Shape and counts
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid; v_old uuid; v_status text; v_super uuid; v_old_name text; v_old_status text; n int;
  n_topics int; n_sub int; n_obj int; n_skill int; n_les int; n_res int; n_act int; n_asm int; n_q int; n_key int; n_phase text; n_grade int; n_subj text; n_sources int;
begin
  select id, status::text, supersedes_version_id into v, v_status, v_super from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1';
  select id, name, status::text into v_old, v_old_name, v_old_status from public.curriculum_versions where code = 'ZA-CAPS-G4-MATH-SLICE';
  call test_util.record('the reconciled Term 1 version exists as a draft', v is not null and v_status = 'draft', coalesce(v_status, 'missing'));
  call test_util.record('it supersedes the earlier draft pack without replacing it', v_super = v_old and v_old is not null, coalesce(v_super::text, 'null'));
  call test_util.record('the earlier pack is annotated as superseded only while it is a draft; an approved or published one is never touched',
    case when v_old_status = 'draft' then v_old_name like '%SUPERSEDED DRAFT%' else v_old_name not like '%SUPERSEDED DRAFT%' end, v_old_status || ': ' || v_old_name);

  select count(*) into n_topics from public.curriculum_topics where version_id = v;
  select count(*) into n_sub from public.curriculum_subtopics where version_id = v;
  select count(*) into n_obj from public.curriculum_objectives where version_id = v;
  select count(*) into n_skill from public.curriculum_skills where version_id = v;
  select count(*) into n_les from public.lessons where curriculum_version_id = v;
  select count(*) into n_res from public.teaching_resources where curriculum_version_id = v;
  select count(*) into n_act from public.learning_activities where curriculum_version_id = v;
  select count(*) into n_asm from public.learning_assessments where curriculum_version_id = v;
  select count(*) into n_q from public.assessment_questions where curriculum_version_id = v;
  select count(*) into n_key from public.assessment_question_keys k join public.assessment_questions q on q.id = k.question_id where q.curriculum_version_id = v;
  call test_util.record('the pack has 6 topics, 7 subtopics, 27 objectives and 10 skills', n_topics = 6 and n_sub = 7 and n_obj = 27 and n_skill = 10,
    format('topics=%s sub=%s obj=%s skills=%s', n_topics, n_sub, n_obj, n_skill));
  call test_util.record('the pack has 17 lessons, 112 resources, 34 activities and 6 assessments', n_les = 17 and n_res = 112 and n_act = 34 and n_asm = 6,
    format('lessons=%s resources=%s activities=%s assessments=%s', n_les, n_res, n_act, n_asm));
  call test_util.record('every one of the 60 questions has an answer key', n_q = 60 and n_key = 60, format('questions=%s keys=%s', n_q, n_key));

  select p.name, g.grade_number, s.name into n_phase, n_grade, n_subj
  from public.curriculum_phases p join public.curriculum_grades g on g.phase_id = p.id join public.curriculum_grade_subjects gs on gs.grade_id = g.id
  join public.curriculum_subjects s on s.id = gs.subject_id where p.version_id = v;
  select count(*) into n from public.curriculum_terms where version_id = v and term_number = 1;
  call test_util.record('it sits in Intermediate Phase, Grade 4, Mathematics, Term 1', n_phase = 'Intermediate Phase' and n_grade = 4 and n_subj = 'Mathematics' and n = 1,
    format('%s / %s / %s', n_phase, n_grade, n_subj));
end $$;

-- ---------------------------------------------------------------------------
-- 2. The scope is exactly the recorded 2026 ATP Term 1 scope, and Common Fractions is not in it
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := (select id from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1');
  v_codes text[]; v_expected text[]; n int; v_old uuid := (select id from public.curriculum_versions where code = 'ZA-CAPS-G4-MATH-SLICE');
  v_frac_new int; v_frac_old int; v_old_obj int; v_old_les int; n2 int;
begin
  select array_agg(code order by code) into v_codes from public.curriculum_objectives where version_id = v;
  v_expected := (select array_agg('G4.MATH.2026.T1.' || x order by 'G4.MATH.2026.T1.' || x) from unnest(array[
    'WN.01','WN.02','WN.03','WN.04','WN.05','WN.06','NS.01','NS.02','NS.03','NS.04','NS.05','NS.06','NS.07','NS.08',
    'AS.01','AS.02','AS.03','AS.04','AS.05','AS.06','MUL.01','MUL.02','MUL.03','MUL.04','PS.01','PS.02','FA.01']) x);
  call test_util.record('the objectives are exactly the recorded Term 1 scope: nothing added, nothing missing', v_codes = v_expected, coalesce(array_to_string(v_codes, ','), 'none'));

  select count(*) into v_frac_new from public.curriculum_topics where version_id = v and (title ilike '%fraction%' or code ilike '%FRAC%')
  ;
  select count(*) into n from public.curriculum_objectives where version_id = v and description ilike '%fraction%';
  call test_util.record('Common Fractions is not part of the reconciled Term 1 pack', v_frac_new = 0 and n = 0, format('topics=%s objectives=%s', v_frac_new, n));

  select count(*) into v_frac_old from public.curriculum_topics where version_id = v_old and code = 'G4.MATH.T1.FRAC';
  select count(*) into v_old_obj from public.curriculum_objectives where version_id = v_old;
  select count(*) into v_old_les from public.lessons where curriculum_version_id = v_old;
  call test_util.record('the earlier draft keeps its Common Fractions topic, its objectives and its lessons: history is recoverable', v_frac_old = 1 and v_old_obj >= 7 and v_old_les >= 2,
    format('frac=%s objectives=%s lessons=%s', v_frac_old, v_old_obj, v_old_les));

  select count(*) into n from public.curriculum_objectives where version_id = v and (source_reference is null
    or source_reference not like '%2026 Grade 4 Mathematics ATP, Term 1%' or source_reference not like '%NOT verified%');
  call test_util.record('every objective carries its ATP source, and says it is mapped but not verified', n = 0, 'objectives without it: ' || n);

  select count(*) into n from public.curriculum_objectives o where o.version_id = v and not exists (select 1 from public.lesson_objectives lo where lo.objective_id = o.id);
  call test_util.record('every objective is taught by at least one lesson', n = 0, 'objectives without a lesson: ' || n);
  select count(*) into n from public.curriculum_objectives o where o.version_id = v and o.code <> 'G4.MATH.2026.T1.FA.01'
    and not exists (select 1 from public.assessment_questions q where q.objective_id = o.id);
  call test_util.record('every objective except the formal assignment itself has at least one practice question', n = 0, 'objectives without a question: ' || n);
  select count(*) into n from public.curriculum_objectives o where o.version_id = v and o.code like '%.FA.01'
    and o.description like '%within three hours%' and o.description like '%number sentences%' and o.description like '%counting%';
  select count(*) into n2 from public.curriculum_objectives where version_id = v and code like '%.FA.01' and description ~* '(marks|weighting|rubric|%)';
  call test_util.record('the formal assessment objective records its coverage and the three-hour in-class time, and no marks or weighting', n = 1 and n2 = 0, format('with coverage=%s with marks=%s', n, n2));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Governance: draft, unverified, nothing claimed, sources registered but not verified
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := (select id from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1');
  n int; n2 int; n_src int; n_ver int; n_checked int; n_claims int;
begin
  select count(*) into n from public.curriculum_topics where version_id = v and status <> 'draft';
  select count(*) into n2 from public.curriculum_objectives where version_id = v and status <> 'draft';
  call test_util.record('every topic and objective is still a draft', n = 0 and n2 = 0, format('topics=%s objectives=%s', n, n2));
  select count(*) into n from public.lessons where curriculum_version_id = v and (status <> 'draft' or origin <> 'authored');
  select count(*) into n2 from public.teaching_resources where curriculum_version_id = v and (status <> 'draft' or origin <> 'authored');
  select count(*) into n_src from public.learning_assessments where curriculum_version_id = v and (status <> 'draft' or origin <> 'authored');
  call test_util.record('every lesson, resource and assessment is a human-authored draft: nothing approved, published or AI-labelled', n = 0 and n2 = 0 and n_src = 0,
    format('lessons=%s resources=%s assessments=%s', n, n2, n_src));

  select count(*) into n_src from public.curriculum_sources where title in ('Curriculum and Assessment Policy Statement (CAPS): Mathematics, Intermediate Phase, Grades 4-6', '2026 Annual Teaching Plan: Mathematics Grade 4 (English)')
    and status = 'registered' and checksum_sha256 is null and verified_at is null and verified_by is null;
  call test_util.record('both official sources are registered, not verified, and have no invented checksum', n_src = 2, 'sources: ' || n_src);
  select count(*) into n from public.curriculum_sources s where s.title in ('Curriculum and Assessment Policy Statement (CAPS): Mathematics, Intermediate Phase, Grades 4-6', '2026 Annual Teaching Plan: Mathematics Grade 4 (English)')
    and s.indexed_on is not null and s.retrieved_on is null and s.content_reviewed_at is null and public.source_evidence_level(s) = 'indexed';
  call test_util.record('both sources are at the "indexed" step only: found at a DBE location, not retrieved, not identity-verified, not reviewed', n = 2, 'sources at indexed: ' || n);

  select count(*) into n from public.lessons l where l.curriculum_version_id = v and not exists (select 1 from public.content_source_references r
    join public.curriculum_sources s on s.id = r.source_id where r.entity_table = 'lessons' and r.entity_id = l.id and s.title like '2026 Annual Teaching Plan%');
  select count(*) into n2 from public.lessons l where l.curriculum_version_id = v and not exists (select 1 from public.content_source_references r
    join public.curriculum_sources s on s.id = r.source_id where r.entity_table = 'lessons' and r.entity_id = l.id and s.title like 'Curriculum and Assessment Policy Statement%');
  call test_util.record('every lesson is linked to the 2026 ATP (sequence) and to CAPS (requirements)', n = 0 and n2 = 0, format('no ATP=%s no CAPS=%s', n, n2));
  select count(*) into n from public.teaching_resources t where t.curriculum_version_id = v and not exists (select 1 from public.content_source_references r where r.entity_table = 'teaching_resources' and r.entity_id = t.id);
  select count(*) into n2 from public.learning_assessments a where a.curriculum_version_id = v and not exists (select 1 from public.content_source_references r where r.entity_table = 'learning_assessments' and r.entity_id = a.id);
  call test_util.record('every resource and assessment is linked to a source', n = 0 and n2 = 0, format('resources=%s assessments=%s', n, n2));
  select count(*) into n_checked from public.content_source_references r
   where (r.checked_at is not null or r.check_result is not null or r.checked_by is not null)
     and r.entity_id in (select id from public.lessons where curriculum_version_id = v union select id from public.teaching_resources where curriculum_version_id = v
                         union select id from public.learning_assessments where curriculum_version_id = v);
  call test_util.record('no source reference has been marked as checked: nobody has verified anything yet', n_checked = 0, 'checked: ' || n_checked);
  select count(*) into n_ver from public.content_verifications cv where cv.entity_id in (
    select id from public.lessons where curriculum_version_id = v union select id from public.teaching_resources where curriculum_version_id = v
    union select id from public.learning_assessments where curriculum_version_id = v);
  call test_util.record('no unit has a verification record', n_ver = 0, 'rows: ' || n_ver);

  select count(*) into n_claims from (
    select title || ' ' || coalesce(description, '') || ' ' || coalesce(teacher_notes, '') as t from public.lessons where curriculum_version_id = v
    union all select title || ' ' || coalesce(summary, '') || ' ' || body::text from public.teaching_resources where curriculum_version_id = v
    union all select description from public.curriculum_objectives where version_id = v
    union all select title from public.learning_assessments where curriculum_version_id = v) x
  where t ~* '(caps[ -]?(aligned|compliant|approved)|fully aligned|dbe[ -]?(approved|verified)|officially verified|curriculum[ -]aligned)';
  call test_util.record('no text claims alignment, compliance or official approval', n_claims = 0, 'claims: ' || n_claims);
  select count(*) into n from public.lessons where curriculum_version_id = v and (teacher_notes not like '%not DBE examples%' or teacher_notes not like '%curriculum specialist has not yet checked%');
  call test_util.record('every lesson says its examples are Funda360 examples and that no specialist has checked it', n = 0, 'lessons without: ' || n);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Teaching quality rules: low-resource, offline, differentiated, assessment keys
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := (select id from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1');
  n int; n2 int; n3 int;
begin
  select count(*) into n from public.lessons l where l.curriculum_version_id = v and not exists (
    select 1 from public.lesson_resources lr join public.teaching_resources r on r.id = lr.resource_id
    where lr.lesson_id = l.id and not r.projector_required and r.connectivity = 'none' and r.device in ('none', 'teacher_device'));
  call test_util.record('every lesson can be taught with no projector, no data and no learner device', n = 0, 'lessons without: ' || n);
  select count(*) into n from public.teaching_resources where curriculum_version_id = v and (projector_required or connectivity <> 'none' or device not in ('none', 'teacher_device') or not cacheable or coalesce(size_kb, 0) < 1);
  call test_util.record('every resource works offline with no projector, is cacheable and records its size', n = 0, 'resources outside: ' || n);
  select count(*) into n from public.teaching_resources where curriculum_version_id = v and stage = 'print' and not printable;
  select count(*) into n2 from public.teaching_resources where curriculum_version_id = v and printable;
  call test_util.record('printable resources exist and every print-stage resource is printable', n = 0 and n2 >= 1, format('bad=%s printable=%s', n, n2));
  select count(*) into n from public.teaching_resources where curriculum_version_id = v and stage = 'support' and difficulty <> 'foundational';
  select count(*) into n2 from public.teaching_resources where curriculum_version_id = v and stage = 'challenge' and difficulty <> 'advanced';
  call test_util.record('support resources are foundational and challenge resources are advanced', n = 0 and n2 = 0, format('support=%s challenge=%s', n, n2));
  select count(distinct stage) into n from public.teaching_resources where curriculum_version_id = v;
  select count(*) into n2 from public.teaching_resources r where r.curriculum_version_id = v and r.resource_kind in ('diagram', 'illustration') and btrim(coalesce(r.body ->> 'alt_text', '')) = '';
  call test_util.record('the toolkit stages are used where they help, and every diagram has a text description', n between 6 and 8 and n2 = 0, format('stages=%s diagrams without alt text=%s', n, n2));
  select count(*) into n from public.lessons l where l.curriculum_version_id = v and (select count(*) from public.lesson_resources lr where lr.lesson_id = l.id) not between 5 and 9;
  call test_util.record('lessons carry between 5 and 9 resources, not a fixed set', n = 0, 'lessons outside: ' || n);
  select count(*) into n from public.learning_activities a where a.curriculum_version_id = v and a.resource_id is not null
    and not exists (select 1 from public.lesson_resources lr where lr.lesson_id = a.lesson_id and lr.resource_id = a.resource_id);
  call test_util.record('every activity points at a resource of its own lesson', n = 0, 'activities outside: ' || n);

  select count(*) into n from public.assessment_questions q where q.curriculum_version_id = v and q.difficulty = 'foundational';
  select count(*) into n2 from public.assessment_questions q where q.curriculum_version_id = v and q.difficulty = 'standard';
  select count(*) into n3 from public.assessment_questions q where q.curriculum_version_id = v and q.difficulty = 'advanced';
  call test_util.record('questions are differentiated into support, core and challenge', n >= 6 and n2 >= 20 and n3 >= 6, format('support=%s core=%s challenge=%s', n, n2, n3));
  select count(*) into n from public.assessment_questions q where q.curriculum_version_id = v and q.difficulty = 'advanced' and q.question_type not in ('short_answer', 'true_false');
  call test_util.record('challenge questions ask for reasoning (explain, compare, spot the mistake), not just bigger arithmetic', n = 0, 'challenge questions that are plain calculations: ' || n);
end $$;

-- ---------------------------------------------------------------------------
-- 4b. Independent content audit. These checks parse the stored content; they do not reuse the generator that wrote it.
-- Passing them says the pack is internally consistent. It says nothing about alignment with any official document.
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := (select id from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1');
  n int; n2 int; rec record; m text[]; want numeric; got numeric; bad text := '';
  scope_re constant text := '(fraction|decimal|percent|\malgebra|negative|\mratio\M|long division|÷)';
  device_re constant text := '\m(projector|smartphone|phone|tablet|computer|laptop|online|internet|website|video|download|wifi|wi-fi|screen|apps?|qr|youtube|https?)\M';
begin
  -- arithmetic: every numeric question that is a bare expression has the key an independent calculation gives
  n2 := 0;
  for rec in select q.prompt, (k.answer #>> '{}') as ans from public.assessment_questions q join public.assessment_question_keys k on k.question_id = q.id
           where q.curriculum_version_id = v and q.question_type = 'numeric' loop
    m := regexp_match(rec.prompt, '(?:^|: )([0-9][0-9 ]*) ([+−×]) ([0-9][0-9 ]*)$');
    if m is not null then
      n2 := n2 + 1;
      want := case m[2] when '+' then replace(m[1], ' ', '')::numeric + replace(m[3], ' ', '')::numeric
                        when '−' then replace(m[1], ' ', '')::numeric - replace(m[3], ' ', '')::numeric
                        else replace(m[1], ' ', '')::numeric * replace(m[3], ' ', '')::numeric end;
      got := rec.ans::numeric;
      if want is distinct from got then bad := bad || format('[%s = %s but key %s] ', rec.prompt, want, got); end if;
    end if;
  end loop;
  call test_util.record('every bare-expression numeric question has the key an independent calculation gives (13 checked)', n2 = 13 and bad = '', format('checked=%s %s', n2, bad));

  select count(*) into n from public.assessment_questions q join public.assessment_question_keys k on k.question_id = q.id
   where q.curriculum_version_id = v and q.question_type = 'short_answer' and btrim(coalesce(k.marking_notes, '')) = '';
  call test_util.record('every short-answer question carries marking notes for the teacher', n = 0, 'without notes: ' || n);

  select count(*) into n from public.assessment_questions q join public.teaching_resources r on r.curriculum_version_id = v
   where q.curriculum_version_id = v and length(q.prompt) > 25 and position(q.prompt in (r.title || ' ' || r.body::text)) > 0;
  call test_util.record('no assessment question is a verbatim copy of text inside a teaching resource', n = 0, 'verbatim copies: ' || n);

  select count(*) into n from public.resource_objectives ro join public.lesson_resources lr on lr.resource_id = ro.resource_id
   where ro.resource_id in (select id from public.teaching_resources where curriculum_version_id = v)
     and not exists (select 1 from public.lesson_objectives lo where lo.lesson_id = lr.lesson_id and lo.objective_id = ro.objective_id);
  call test_util.record('a resource only claims objectives its own lesson teaches', n = 0, 'resources outside their lesson: ' || n);

  select count(*) into n from public.curriculum_objectives o where o.version_id = v
   and not exists (select 1 from public.resource_objectives ro join public.teaching_resources r on r.id = ro.resource_id where ro.objective_id = o.id and r.stage = 'explain');
  select count(*) into n2 from public.curriculum_objectives o where o.version_id = v and o.code not like '%.FA.01'
   and not exists (select 1 from public.resource_objectives ro join public.teaching_resources r on r.id = ro.resource_id where ro.objective_id = o.id and r.stage in ('practise', 'try'));
  call test_util.record('every objective has a low-resource explanation resource, and every taught objective has practice', n = 0 and n2 = 0, format('no explanation=%s no practice=%s', n, n2));

  select count(*) into n from public.teaching_resources r where r.curriculum_version_id = v and r.stage in ('practise', 'check') and r.body::text not like '%Answers for the teacher%';
  select count(*) into n2 from public.teaching_resources r where r.curriculum_version_id = v and r.stage = 'print' and r.body::text like '%Answers for the teacher%';
  call test_util.record('practice and check resources carry teacher answers; printables for learners never do', n = 0 and n2 = 0, format('missing=%s printable with answers=%s', n, n2));

  select count(*) into n from public.teaching_resources r where r.curriculum_version_id = v
   and (r.title || ' ' || coalesce(r.summary, '') || ' ' || r.body::text) ~* scope_re;
  select count(*) into n2 from public.assessment_questions q where q.curriculum_version_id = v and q.prompt ~* scope_re;
  call test_util.record('nothing from later terms (fractions, decimals, percent, algebra, negatives, ratio, division) appears in a resource or question, ',
    n = 0 and n2 = 0, format('resources=%s questions=%s', n, n2));

  select count(*) into n from public.teaching_resources r where r.curriculum_version_id = v and (r.title || ' ' || coalesce(r.summary, '') || ' ' || r.body::text) ~* device_re;
  select count(*) into n2 from public.assessment_questions q where q.curriculum_version_id = v and (q.prompt || ' ' || q.options::text) ~* device_re;
  call test_util.record('no resource or question depends on the internet, a projector, a phone or any device', n = 0 and n2 = 0, format('resources=%s questions=%s', n, n2));

  select count(*) into n from (
    select title from public.curriculum_topics where version_id = v union all select title from public.curriculum_subtopics where version_id = v
    union all select description from public.curriculum_objectives where version_id = v
    union all select title || ' ' || coalesce(summary, '') || ' ' || body::text from public.teaching_resources where curriculum_version_id = v
    union all select prompt from public.assessment_questions where curriculum_version_id = v) t
   where title ~* 'common fraction|G4\.MATH\.T1\.FRAC';
  call test_util.record('the reconciled version contains no Common Fractions text or code anywhere', n = 0, 'occurrences: ' || n);

  select count(*) into n from public.curriculum_objectives where version_id = v and (code like 'G4.MATH.T1.%' or code not like 'G4.MATH.2026.T1.%');
  call test_util.record('every objective code in the reconciled version uses the 2026 prefix', n = 0, 'other prefixes: ' || n);
end $$;

-- ---------------------------------------------------------------------------
-- 5. The existing checks still run, and the gates still hold
-- ---------------------------------------------------------------------------
do $$
declare
  v uuid := (select id from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1');
  r record; v_run uuid; n_units int := 0; n_bad int; n_other int; n_ack int;
  v_lesson uuid := (select id from public.lessons where curriculum_version_id = v order by sort_order, title limit 1);
  v_topic uuid; v_obj uuid; e text; n int; n_res_vis int; n_obj_vis int; v_asm_ids uuid[]; v_old_topic uuid; v_old_obj uuid;
begin
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  for r in select 'lessons' t, id from public.lessons where curriculum_version_id = v
           union all select 'teaching_resources', id from public.teaching_resources where curriculum_version_id = v
           union all select 'learning_assessments', id from public.learning_assessments where curriculum_version_id = v loop
    v_run := public.validate_content(r.t, r.id);
    n_units := n_units + 1;
  end loop;
  select count(*) into n_other from public.content_validation_findings f join public.content_validation_runs ru on ru.id = f.run_id
   where f.severity = 'error' and f.code <> 'objective_not_approved' and ru.entity_id in (
     select id from public.lessons where curriculum_version_id = v union select id from public.teaching_resources where curriculum_version_id = v
     union select id from public.learning_assessments where curriculum_version_id = v);
  select count(*) into n_bad from public.content_validation_findings f join public.content_validation_runs ru on ru.id = f.run_id
   where f.code = 'objective_not_approved' and f.severity = 'error' and ru.entity_id in (select id from public.lessons where curriculum_version_id = v);
  call test_util.record('all 135 units were checked', n_units = 135, 'units: ' || n_units);
  call test_util.record('the only errors are "objective not approved", the gate that keeps the pack in draft: no structure, delivery, assessment or safety error', n_other = 0, 'other errors: ' || n_other);
  call test_util.record('the checks do report the unapproved objectives, so approval cannot be skipped', n_bad >= 17, 'lessons flagged: ' || n_bad);
  select count(*) into n_ack from public.content_validation_findings f join public.content_validation_runs ru on ru.id = f.run_id
   where f.severity = 'warning' and ru.entity_id in (select id from public.lessons where curriculum_version_id = v union select id from public.teaching_resources where curriculum_version_id = v
     union select id from public.learning_assessments where curriculum_version_id = v);
  select count(*) into n from public.content_validation_findings where acknowledged_at is not null;
  call test_util.record('nothing is pre-acknowledged: no reviewer sign-off exists yet', n = 0, format('acknowledged=%s', n));
  call test_util.record('the checks raise no warnings for the pack: no duplicate titles, vague instructions, unsupported claims or age-sensitive wording', n_ack = 0, 'warnings: ' || n_ack);

  e := test_util.err_of(format('select public.content_transition(''lesson'', %L, ''published'')', v_lesson));
  call test_util.record('a draft lesson cannot be published: no step can be skipped', e like 'invalid_state%', e);
  select t.id into v_topic from public.curriculum_topics t where t.version_id = v order by sort_order limit 1;
  select id into v_obj from public.curriculum_objectives where version_id = v order by sort_order limit 1;
  e := test_util.err_of(format('select public.ai_begin_generation(%L, %L, array[%L]::uuid[], null, ''en'', ''mock'', ''mock-model-1'', ''p1'')', v, v_topic, v_obj));
  call test_util.record('AI drafting is refused for this pack until its objectives are approved', e like 'invalid_state%approved%', e);
  select t.id, o.id into v_old_topic, v_old_obj from public.curriculum_topics t join public.curriculum_objectives o on o.topic_id = t.id
   where t.code = 'G4.MATH.T1.FRAC' order by o.code limit 1;
  e := test_util.err_of(format('select public.ai_begin_generation(%L, %L, array[%L]::uuid[], null, ''en'', ''mock'', ''mock-model-1'', ''p1'')',
    (select id from public.curriculum_versions where code = 'ZA-CAPS-G4-MATH-SLICE'), v_old_topic, v_old_obj));
  call test_util.record('AI drafting against the superseded earlier pack (including its Common Fractions objectives) is refused', e like 'invalid_state%superseded%', e);
  e := test_util.err_of(format('select public.set_content_verification(''lessons'', %L, ''reviewed'')', v_lesson));
  call test_util.record('a lesson cannot be marked reviewed while it is a draft with unchecked references', e like 'invalid_state%', e);

  execute 'reset role';
  v_asm_ids := array(select id from public.learning_assessments where curriculum_version_id = v);
  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  select count(*) into n from public.lessons where curriculum_version_id = v;
  select count(*) into n_res_vis from public.teaching_resources where curriculum_version_id = v;
  select count(*) into n_obj_vis from public.curriculum_objectives where version_id = v;
  call test_util.record('a teacher cannot see any lesson, resource or objective of the pack', n = 0 and n_res_vis = 0 and n_obj_vis = 0,
    format('lessons=%s resources=%s objectives=%s', n, n_res_vis, n_obj_vis));
  select count(*) into n from public.assessment_question_keys where assessment_id = any (v_asm_ids);
  call test_util.record('a teacher cannot read the answer keys of its assessments', n = 0, 'keys visible: ' || n);
  execute 'reset role';
end $$;

-- ---------------------------------------------------------------------------
-- 6. Teardown: leave the shared universe as found
-- ---------------------------------------------------------------------------
reset role;
set session_replication_role = replica;
do $$
declare v uuid := (select id from public.curriculum_versions where code = 'ZA-G4-MATH-2026-T1');
begin
  delete from public.audit_log where entity_id in (select id from public.lessons where curriculum_version_id = v union select id from public.teaching_resources where curriculum_version_id = v
    union select id from public.learning_assessments where curriculum_version_id = v);
  delete from public.content_validation_findings where run_id in (select id from public.content_validation_runs where entity_id in (
    select id from public.lessons where curriculum_version_id = v union select id from public.teaching_resources where curriculum_version_id = v union select id from public.learning_assessments where curriculum_version_id = v));
  delete from public.content_validation_runs where entity_id in (select id from public.lessons where curriculum_version_id = v union select id from public.teaching_resources where curriculum_version_id = v
    union select id from public.learning_assessments where curriculum_version_id = v);
  delete from public.content_source_references where entity_id in (select id from public.lessons where curriculum_version_id = v union select id from public.teaching_resources where curriculum_version_id = v
    union select id from public.learning_assessments where curriculum_version_id = v);
  delete from public.curriculum_open_questions where version_id = v;
  delete from public.curriculum_formal_assessment_details where version_id = v;
  delete from public.assessment_question_keys where assessment_id in (select id from public.learning_assessments where curriculum_version_id = v);
  delete from public.assessment_questions where curriculum_version_id = v;
  delete from public.assessment_objectives where curriculum_version_id = v;
  delete from public.learning_activities where curriculum_version_id = v;
  delete from public.lesson_resources where curriculum_version_id = v;
  delete from public.lesson_objectives where curriculum_version_id = v;
  delete from public.resource_objectives where curriculum_version_id = v;
  delete from public.learning_assessments where curriculum_version_id = v;
  delete from public.lessons where curriculum_version_id = v;
  delete from public.teaching_resources where curriculum_version_id = v;
  delete from public.curriculum_skills where version_id = v;
  delete from public.curriculum_objectives where version_id = v;
  delete from public.curriculum_subtopics where version_id = v;
  delete from public.curriculum_topics where version_id = v;
  delete from public.curriculum_terms where version_id = v;
  delete from public.curriculum_grade_subjects where version_id = v;
  delete from public.curriculum_subjects where version_id = v;
  delete from public.curriculum_grades where version_id = v;
  delete from public.curriculum_phases where version_id = v;
  delete from public.curriculum_versions where id = v;
  delete from public.curriculum_sources where title in ('Curriculum and Assessment Policy Statement (CAPS): Mathematics, Intermediate Phase, Grades 4-6', '2026 Annual Teaching Plan: Mathematics Grade 4 (English)');
  update public.curriculum_versions
     set name = replace(name, ' [SUPERSEDED DRAFT: not the 2026 ATP Term 1 scope]', ''),
         license_notes = regexp_replace(license_notes, '^SUPERSEDED DRAFT\. Kept for history\..*?\(also a draft\)\. ', '')
   where code = 'ZA-CAPS-G4-MATH-SLICE';
end $$;
set session_replication_role = origin;
