-- Funda360 Curriculum Engine — privileged RPCs. Schema: 20261001090000_curriculum_engine.sql.
--
-- Every write to lifecycle, plan, assignment, evidence or progress tables happens here, never from
-- the client directly. Each function checks the caller in the database, pins search_path, and is
-- revoked from public/anon. Functions the client calls are granted to `authenticated`; internal helpers are not.

-- The hierarchy freeze must let content_transition() mirror a version's status onto its rows.
create or replace function public.curriculum_hierarchy_freeze()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row     jsonb;
  v_version uuid;
  v_status  public.content_status;
begin
  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  if coalesce(current_setting('funda360.content_rpc', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  v_version := (v_row ->> 'version_id')::uuid;
  select status into v_status from public.curriculum_versions where id = v_version;
  if v_status in ('approved', 'published', 'retired') then
    raise exception 'invalid_state: curriculum version is % and cannot be edited; create a new version', v_status;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Internal helpers (not callable by clients)
-- ---------------------------------------------------------------------------

-- Academic managers, or a teacher actively assigned to the class.
create or replace function public.can_teach_class(p_school_id uuid, p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_manage_academic(p_school_id)
      or (p_school_id = public.current_tenant_id()
          and exists (select 1 from public.class_teacher_assignments cta
                      where cta.class_id = p_class_id and cta.school_id = p_school_id
                        and cta.teacher_profile_id = auth.uid() and cta.active))
$$;

-- Has the school adopted (and not ended) this curriculum version?
create or replace function public.school_follows_version(p_school_id uuid, p_version_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.school_curriculum_adoptions a
                 join public.curriculum_versions v on v.id = a.curriculum_version_id
                 where a.school_id = p_school_id and a.curriculum_version_id = p_version_id
                   and a.status = 'active' and v.status = 'published')
$$;

-- Is this curriculum grade-subject the one the class's school grade and the school subject are mapped to?
create or replace function public.class_matches_grade_subject(p_school_id uuid, p_class_id uuid, p_school_subject_id uuid, p_grade_subject_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.curriculum_grade_subjects gs
    join public.classes c on c.id = p_class_id and c.school_id = p_school_id
    join public.school_grade_curriculum_map gm
      on gm.school_grade_id = c.grade_id and gm.school_id = p_school_id
     and gm.curriculum_grade_id = gs.grade_id and gm.curriculum_version_id = gs.version_id
    join public.school_subject_curriculum_map sm
      on sm.school_subject_id = p_school_subject_id and sm.school_id = p_school_id
     and sm.curriculum_subject_id = gs.subject_id and sm.curriculum_version_id = gs.version_id
    where gs.id = p_grade_subject_id)
$$;

-- ---------------------------------------------------------------------------
-- 1. Content lifecycle (platform administrators)
-- ---------------------------------------------------------------------------

create or replace function public.content_transition(p_entity text, p_id uuid, p_to public.content_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_table    text;
  v_from     public.content_status;
  v_origin   text;
  v_creator  uuid;
  v_version  uuid;
  v_ver_stat public.content_status;
  v_actor    uuid := auth.uid();
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators manage curriculum content';
  end if;

  v_table := case p_entity
    when 'curriculum_version' then 'curriculum_versions'
    when 'lesson' then 'lessons'
    when 'teaching_resource' then 'teaching_resources'
    when 'learning_assessment' then 'learning_assessments'
  end;
  if v_table is null then
    raise exception 'invalid_reference: unknown content entity %', p_entity;
  end if;

  execute format('select status from public.%I where id = $1 for update', v_table) into v_from using p_id;
  if v_from is null then
    raise exception 'not_found: no % %', p_entity, p_id;
  end if;

  -- draft -> review -> approved -> published -> retired, plus review -> draft (changes requested). Nothing may be skipped.
  if not ((v_from, p_to) in (('draft', 'review'), ('review', 'draft'), ('review', 'approved'), ('approved', 'published'), ('published', 'retired'))) then
    raise exception 'invalid_state: % cannot move from % to %', p_entity, v_from, p_to;
  end if;

  if p_entity <> 'curriculum_version' then
    execute format('select origin::text, created_by, curriculum_version_id from public.%I where id = $1', v_table)
      into v_origin, v_creator, v_version using p_id;
    if p_to = 'approved' and v_origin = 'ai_draft' and v_creator is not distinct from v_actor then
      raise exception 'insufficient_privilege: AI-assisted content must be approved by a reviewer other than the person who requested it';
    end if;
    if p_to = 'published' then
      select status into v_ver_stat from public.curriculum_versions where id = v_version;
      if v_ver_stat <> 'published' then
        raise exception 'invalid_state: the curriculum version must be published before its content';
      end if;
    end if;
  end if;

  if p_to = 'published' then
    if p_entity = 'curriculum_version' then
      if not exists (select 1 from public.curriculum_objectives where version_id = p_id)
         or not exists (select 1 from public.curriculum_grade_subjects where version_id = p_id) then
        raise exception 'invalid_state: a curriculum version needs grade-subjects and objectives before it can be published';
      end if;
    elsif p_entity = 'lesson' then
      if not exists (select 1 from public.lesson_objectives where lesson_id = p_id) then
        raise exception 'invalid_state: a lesson needs at least one curriculum objective';
      end if;
      if exists (select 1 from public.lesson_resources lr join public.teaching_resources r on r.id = lr.resource_id
                 where lr.lesson_id = p_id and r.status <> 'published') then
        raise exception 'invalid_state: every resource linked to a lesson must be published first';
      end if;
      -- Low-resource path: something a teacher can run with no projector, no connectivity and no learner device.
      if not exists (select 1 from public.lesson_resources lr join public.teaching_resources r on r.id = lr.resource_id
                     where lr.lesson_id = p_id and r.status = 'published' and not r.projector_required
                       and r.connectivity = 'none' and r.device in ('none', 'teacher_device')) then
        raise exception 'invalid_state: a lesson needs at least one resource usable without a projector, connectivity or learner devices';
      end if;
    elsif p_entity = 'learning_assessment' then
      if not exists (select 1 from public.assessment_questions where assessment_id = p_id)
         or not exists (select 1 from public.assessment_objectives where assessment_id = p_id) then
        raise exception 'invalid_state: an assessment needs questions and at least one objective';
      end if;
      if exists (select 1 from public.assessment_questions q
                 where q.assessment_id = p_id
                   and not exists (select 1 from public.assessment_question_keys k where k.question_id = q.id)) then
        raise exception 'invalid_state: every question needs an answer key before publishing';
      end if;
    end if;
  end if;

  perform set_config('funda360.content_rpc', 'on', true);

  if p_entity = 'curriculum_version' then
    update public.curriculum_versions set
      status = p_to,
      approved_by = case when p_to = 'approved' then v_actor else approved_by end,
      approved_at = case when p_to = 'approved' then now() else approved_at end,
      published_at = case when p_to = 'published' then now() else published_at end,
      retired_at = case when p_to = 'retired' then now() else retired_at end,
      effective_from = case when p_to = 'published' then coalesce(effective_from, current_date) else effective_from end,
      effective_to = case when p_to = 'retired' then coalesce(effective_to, current_date) else effective_to end
    where id = p_id;
    -- The hierarchy rows mirror their version's status.
    update public.curriculum_topics set status = p_to where version_id = p_id;
    update public.curriculum_subtopics set status = p_to where version_id = p_id;
    update public.curriculum_objectives set status = p_to where version_id = p_id;
    update public.curriculum_skills set status = p_to where version_id = p_id;
  else
    execute format($q$update public.%I set
        status = $2,
        reviewed_by = case when $2 in ('review', 'approved') then $3 else reviewed_by end,
        reviewed_at = case when $2 in ('review', 'approved') then now() else reviewed_at end,
        approved_by = case when $2 = 'approved' then $3 else approved_by end,
        approved_at = case when $2 = 'approved' then now() else approved_at end,
        published_at = case when $2 = 'published' then now() else published_at end,
        retired_at = case when $2 = 'retired' then now() else retired_at end
      where id = $1$q$, v_table) using p_id, p_to, v_actor;
  end if;

  perform set_config('funda360.content_rpc', '', true);

  insert into public.content_review_events (entity_table, entity_id, from_status, to_status, actor_profile_id, note)
  values (v_table, p_id, v_from, p_to, v_actor, p_note);

  perform public.write_audit_log(null, v_actor, 'content_' || p_to::text, v_table, p_id,
    jsonb_build_object('status', v_from), jsonb_build_object('status', p_to, 'note', p_note));
end $$;

-- ---------------------------------------------------------------------------
-- 2. School setup
-- ---------------------------------------------------------------------------

create or replace function public.adopt_curriculum_version(p_school_id uuid, p_version_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.can_manage_academic(p_school_id) then
    raise exception 'insufficient_privilege: only academic managers can choose a curriculum version';
  end if;
  if not exists (select 1 from public.curriculum_versions where id = p_version_id and status = 'published') then
    raise exception 'invalid_state: only a published curriculum version can be adopted';
  end if;
  insert into public.school_curriculum_adoptions (school_id, curriculum_version_id, adopted_by)
  values (p_school_id, p_version_id, auth.uid())
  on conflict (school_id, curriculum_version_id)
    do update set status = 'active', ended_at = null, adopted_by = auth.uid()
  returning id into v_id;
  perform public.write_audit_log(p_school_id, auth.uid(), 'curriculum_adopted', 'school_curriculum_adoptions', v_id,
    null, jsonb_build_object('curriculum_version_id', p_version_id));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Teaching workflow
-- ---------------------------------------------------------------------------

create or replace function public.set_class_current_topic(p_class_id uuid, p_school_subject_id uuid, p_topic_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_school  uuid;
  v_version uuid;
  v_gs      uuid;
  v_id      uuid;
begin
  select school_id into v_school from public.classes where id = p_class_id;
  if v_school is null then raise exception 'not_found: no class %', p_class_id; end if;
  if not public.can_teach_class(v_school, p_class_id) then
    raise exception 'insufficient_privilege: you do not teach this class';
  end if;
  if not exists (select 1 from public.subjects where id = p_school_subject_id and school_id = v_school) then
    raise exception 'invalid_reference: subject does not belong to this school';
  end if;

  select tp.version_id, t.grade_subject_id into v_version, v_gs
  from public.curriculum_topics tp join public.curriculum_terms t on t.id = tp.term_id
  where tp.id = p_topic_id;
  if v_version is null then raise exception 'not_found: no topic %', p_topic_id; end if;
  if not public.school_follows_version(v_school, v_version) then
    raise exception 'invalid_state: this school has not adopted the topic''s published curriculum version';
  end if;
  if not public.class_matches_grade_subject(v_school, p_class_id, p_school_subject_id, v_gs) then
    raise exception 'invalid_reference: this topic is not mapped to the class grade and subject';
  end if;

  update public.class_topic_plans set status = 'completed', completed_on = current_date
  where class_id = p_class_id and school_subject_id = p_school_subject_id and status = 'in_progress' and topic_id <> p_topic_id;

  insert into public.class_topic_plans (school_id, class_id, school_subject_id, curriculum_version_id, topic_id, status, started_on, set_by)
  values (v_school, p_class_id, p_school_subject_id, v_version, p_topic_id, 'in_progress', current_date, auth.uid())
  on conflict (class_id, school_subject_id, topic_id)
    do update set status = 'in_progress', completed_on = null, set_by = auth.uid(),
                  started_on = coalesce(public.class_topic_plans.started_on, current_date)
  returning id into v_id;

  perform public.write_audit_log(v_school, auth.uid(), 'class_topic_set', 'class_topic_plans', v_id, null,
    jsonb_build_object('class_id', p_class_id, 'topic_id', p_topic_id));
  return v_id;
end $$;

create or replace function public.assign_learning_to_class(
  p_class_id uuid, p_school_subject_id uuid,
  p_lesson_id uuid default null, p_activity_id uuid default null, p_assessment_id uuid default null,
  p_title text default null, p_instructions text default null, p_due_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_school  uuid;
  v_lesson  uuid := p_lesson_id;
  v_version uuid;
  v_gs      uuid;
  v_status  public.content_status;
  v_title   text := p_title;
  v_id      uuid;
begin
  select school_id into v_school from public.classes where id = p_class_id;
  if v_school is null then raise exception 'not_found: no class %', p_class_id; end if;
  if not public.can_teach_class(v_school, p_class_id) then
    raise exception 'insufficient_privilege: you do not teach this class';
  end if;
  if p_lesson_id is null and p_activity_id is null and p_assessment_id is null then
    raise exception 'invalid_reference: choose a lesson, activity or quick check to assign';
  end if;

  if p_activity_id is not null then
    select a.lesson_id into v_lesson from public.learning_activities a where a.id = p_activity_id;
    if v_lesson is null then raise exception 'not_found: no activity %', p_activity_id; end if;
    v_title := coalesce(v_title, (select title from public.learning_activities where id = p_activity_id));
  end if;
  if v_lesson is not null then
    select l.curriculum_version_id, l.grade_subject_id, l.status, coalesce(v_title, l.title)
      into v_version, v_gs, v_status, v_title from public.lessons l where l.id = v_lesson;
    if v_version is null then raise exception 'not_found: no lesson %', v_lesson; end if;
    if v_status <> 'published' then raise exception 'invalid_state: only published lessons can be assigned'; end if;
    if not public.school_follows_version(v_school, v_version) then
      raise exception 'invalid_state: this school has not adopted the curriculum version of this lesson';
    end if;
    if not public.class_matches_grade_subject(v_school, p_class_id, p_school_subject_id, v_gs) then
      raise exception 'invalid_reference: this lesson is not for the class grade and subject';
    end if;
  end if;
  if p_assessment_id is not null then
    select a.curriculum_version_id, a.grade_subject_id, a.status, coalesce(v_title, a.title)
      into v_version, v_gs, v_status, v_title from public.learning_assessments a where a.id = p_assessment_id;
    if v_version is null then raise exception 'not_found: no assessment %', p_assessment_id; end if;
    if v_status <> 'published' then raise exception 'invalid_state: only published quick checks can be assigned'; end if;
    if not public.school_follows_version(v_school, v_version) then
      raise exception 'invalid_state: this school has not adopted the curriculum version of this quick check';
    end if;
    if not public.class_matches_grade_subject(v_school, p_class_id, p_school_subject_id, v_gs) then
      raise exception 'invalid_reference: this quick check is not for the class grade and subject';
    end if;
  end if;

  insert into public.class_learning_assignments
    (school_id, class_id, school_subject_id, lesson_id, activity_id, assessment_id, title, instructions, due_at, assigned_by)
  values (v_school, p_class_id, p_school_subject_id, v_lesson, p_activity_id, p_assessment_id, v_title, p_instructions, p_due_at, auth.uid())
  returning id into v_id;

  perform public.write_audit_log(v_school, auth.uid(), 'learning_assigned', 'class_learning_assignments', v_id, null,
    jsonb_build_object('class_id', p_class_id, 'lesson_id', v_lesson, 'assessment_id', p_assessment_id));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Evidence and progress
-- ---------------------------------------------------------------------------

-- Deterministic, evidence-only progress rules (documented in docs/proposals/curriculum-engine.md):
--   no attempts                                   -> not_started
--   attempts but none completed                   -> in_progress
--   latest two completed >= mastery threshold     -> mastered
--   latest < support threshold, or latest two < 60 -> needs_support
--   otherwise (at least one completed attempt)    -> completed
create or replace function public.derive_learner_progress(p_learner_id uuid, p_objective_id uuid)
returns public.learner_progress_status language plpgsql security definer set search_path = public as $$
declare
  v_school     uuid;
  v_total      integer;
  v_completed  integer;
  v_latest     numeric;
  v_previous   numeric;
  v_best       numeric;
  v_last_at    timestamptz;
  v_mastery    numeric := 80;
  v_support    numeric := 50;
  v_status     public.learner_progress_status;
  v_prev_status public.learner_progress_status;
begin
  select school_id into v_school from public.learners where id = p_learner_id;
  if v_school is null then raise exception 'not_found: no learner %', p_learner_id; end if;

  with ev as (
    select at.percent, at.completed, coalesce(at.completed_at, at.created_at) as at_ts,
           a.mastery_percent as mastery, a.support_below_percent as support
    from public.learning_attempts at
    left join public.learning_assessments a on a.id = at.assessment_id
    where at.learner_id = p_learner_id
      and (
        exists (select 1 from public.assessment_objectives ao where ao.assessment_id = at.assessment_id and ao.objective_id = p_objective_id)
        or exists (select 1 from public.learning_activities la
                   join public.lesson_objectives lo on lo.lesson_id = la.lesson_id
                   where la.id = at.activity_id and lo.objective_id = p_objective_id)
      )
  ),
  done as (
    select percent, mastery, support, row_number() over (order by at_ts desc) as rn
    from ev where completed and percent is not null
  )
  select (select count(*) from ev),
         (select count(*) from done),
         (select max(percent) from ev),
         (select max(at_ts) from ev),
         (select percent from done where rn = 1),
         (select mastery from done where rn = 1),
         (select support from done where rn = 1),
         (select percent from done where rn = 2)
  into v_total, v_completed, v_best, v_last_at, v_latest, v_mastery, v_support, v_previous;
  v_mastery := coalesce(v_mastery, 80);
  v_support := coalesce(v_support, 50);

  v_status := case
    when v_total = 0 then 'not_started'
    when v_completed = 0 then 'in_progress'
    when v_completed >= 2 and v_latest >= v_mastery and v_previous >= v_mastery then 'mastered'
    when v_latest < v_support or (v_completed >= 2 and v_latest < 60 and v_previous < 60) then 'needs_support'
    else 'completed'
  end;

  select status into v_prev_status from public.learner_objective_progress where learner_id = p_learner_id and objective_id = p_objective_id;

  insert into public.learner_objective_progress
    (school_id, learner_id, objective_id, status, evidence_count, latest_percent, best_percent, last_evidence_at, mastered_at)
  values (v_school, p_learner_id, p_objective_id, v_status, v_total, v_latest, v_best, v_last_at,
          case when v_status = 'mastered' then now() end)
  on conflict (learner_id, objective_id) do update set
    status = excluded.status, evidence_count = excluded.evidence_count, latest_percent = excluded.latest_percent,
    best_percent = excluded.best_percent, last_evidence_at = excluded.last_evidence_at,
    mastered_at = case when excluded.status = 'mastered'
                       then coalesce(case when v_prev_status = 'mastered' then public.learner_objective_progress.mastered_at end, now())
                  end;
  return v_status;
end $$;

create or replace function public.record_learning_attempt(
  p_learner_id uuid, p_assessment_id uuid default null, p_activity_id uuid default null,
  p_score numeric default null, p_max_score numeric default null, p_completed boolean default true,
  p_responses jsonb default '[]'::jsonb, p_assignment_id uuid default null)
returns public.learning_attempts language plpgsql security definer set search_path = public as $$
declare
  v_school   uuid;
  v_class    uuid;
  v_lesson   uuid;
  v_version  uuid;
  v_status   public.content_status;
  v_max      numeric := p_max_score;
  v_percent  numeric;
  v_number   integer;
  v_attempt  public.learning_attempts;
  v_obj      uuid;
begin
  select school_id into v_school from public.learners where id = p_learner_id;
  if v_school is null then raise exception 'not_found: no learner %', p_learner_id; end if;
  if p_assessment_id is null and p_activity_id is null then
    raise exception 'invalid_reference: an attempt needs a quick check or an activity';
  end if;

  select le.class_id into v_class from public.learner_enrollments le
  where le.learner_id = p_learner_id and le.enrollment_status = 'enrolled' and le.class_id is not null
  order by le.enrollment_date desc limit 1;
  if v_class is null or not public.can_teach_class(v_school, v_class) then
    raise exception 'insufficient_privilege: you do not teach this learner';
  end if;

  if p_assessment_id is not null then
    select a.curriculum_version_id, a.status, a.lesson_id into v_version, v_status, v_lesson
    from public.learning_assessments a where a.id = p_assessment_id;
    if v_version is null then raise exception 'not_found: no assessment %', p_assessment_id; end if;
    if v_max is null then
      select sum(marks) into v_max from public.assessment_questions where assessment_id = p_assessment_id;
    end if;
  else
    select l.curriculum_version_id, l.status, l.id into v_version, v_status, v_lesson
    from public.learning_activities la join public.lessons l on l.id = la.lesson_id where la.id = p_activity_id;
    if v_version is null then raise exception 'not_found: no activity %', p_activity_id; end if;
  end if;
  if v_status <> 'published' then raise exception 'invalid_state: evidence can only be recorded against published content'; end if;
  if not public.school_follows_version(v_school, v_version) then
    raise exception 'invalid_state: this school has not adopted the curriculum version of this content';
  end if;
  if p_completed and (p_score is null or v_max is null) then
    raise exception 'invalid_reference: a completed attempt needs a score and a maximum';
  end if;
  if p_score is not null and v_max is not null and p_score > v_max then
    raise exception 'invalid_reference: score cannot exceed the maximum';
  end if;
  v_percent := case when p_score is not null and v_max is not null then round(p_score / v_max * 100, 2) end;

  select coalesce(max(attempt_number), 0) + 1 into v_number from public.learning_attempts
  where learner_id = p_learner_id and assessment_id is not distinct from p_assessment_id and activity_id is not distinct from p_activity_id;

  insert into public.learning_attempts
    (school_id, learner_id, class_id, assessment_id, activity_id, lesson_id, assignment_id, attempt_number,
     score, max_score, percent, completed, responses, recorded_by, started_at, completed_at, created_at)
  -- clock_timestamp(), not now(): several attempts can be recorded inside one transaction and "latest" must stay well defined.
  values (v_school, p_learner_id, v_class, p_assessment_id, p_activity_id, v_lesson, p_assignment_id, v_number,
          p_score, v_max, v_percent, p_completed, coalesce(p_responses, '[]'::jsonb), auth.uid(),
          clock_timestamp(), case when p_completed then clock_timestamp() end, clock_timestamp())
  returning * into v_attempt;

  for v_obj in
    select ao.objective_id from public.assessment_objectives ao where ao.assessment_id = p_assessment_id
    union
    select lo.objective_id from public.learning_activities la join public.lesson_objectives lo on lo.lesson_id = la.lesson_id where la.id = p_activity_id
  loop
    perform public.derive_learner_progress(p_learner_id, v_obj);
  end loop;

  if v_lesson is not null then
    insert into public.learner_lesson_progress (school_id, learner_id, lesson_id, status, last_activity_at, completed_at)
    values (v_school, p_learner_id, v_lesson,
            case when p_completed then 'completed'::public.learner_progress_status else 'in_progress'::public.learner_progress_status end, now(),
            case when p_completed then now() end)
    on conflict (learner_id, lesson_id) do update set
      status = case when public.learner_lesson_progress.status = 'completed' or excluded.status = 'completed'
                    then 'completed'::public.learner_progress_status else 'in_progress'::public.learner_progress_status end,
      last_activity_at = now(),
      completed_at = coalesce(public.learner_lesson_progress.completed_at, excluded.completed_at);
  end if;

  perform public.write_audit_log(v_school, auth.uid(), 'learning_attempt_recorded', 'learning_attempts', v_attempt.id, null,
    jsonb_build_object('learner_id', p_learner_id, 'assessment_id', p_assessment_id, 'percent', v_percent));
  return v_attempt;
end $$;

-- Who in the class understands, and who needs help, for one objective (only recorded evidence).
create or replace function public.class_objective_progress(p_class_id uuid, p_objective_id uuid)
returns table (learner_id uuid, first_name text, last_name text, learner_number text,
               status public.learner_progress_status, latest_percent numeric, evidence_count integer, last_evidence_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_school uuid;
begin
  select school_id into v_school from public.classes where id = p_class_id;
  if v_school is null then raise exception 'not_found: no class %', p_class_id; end if;
  if not public.can_teach_class(v_school, p_class_id) then
    raise exception 'insufficient_privilege: you do not teach this class';
  end if;
  return query
  select l.id, l.first_name, l.last_name, l.learner_number,
         coalesce(p.status, 'not_started'::public.learner_progress_status), p.latest_percent,
         coalesce(p.evidence_count, 0), p.last_evidence_at
  from public.learner_enrollments le
  join public.learners l on l.id = le.learner_id
  left join public.learner_objective_progress p on p.learner_id = l.id and p.objective_id = p_objective_id
  where le.class_id = p_class_id and le.enrollment_status = 'enrolled'
  order by l.last_name, l.first_name;
end $$;

-- Turn recorded evidence into suggested next steps: support for those who need it, extension for those who mastered.
create or replace function public.generate_learning_recommendations(p_class_id uuid, p_objective_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_school   uuid;
  v_created  integer := 0;
  v_row      record;
  v_resource uuid;
  v_kind     text;
  v_inserted integer;
begin
  select school_id into v_school from public.classes where id = p_class_id;
  if v_school is null then raise exception 'not_found: no class %', p_class_id; end if;
  if not public.can_teach_class(v_school, p_class_id) then
    raise exception 'insufficient_privilege: you do not teach this class';
  end if;

  -- Close remediation that recorded evidence no longer supports.
  update public.learning_recommendations r set status = 'completed', resolved_at = now()
  where r.school_id = v_school and r.objective_id = p_objective_id and r.kind = 'remediation' and r.status = 'open'
    and r.learner_id in (select le.learner_id from public.learner_enrollments le where le.class_id = p_class_id and le.enrollment_status = 'enrolled')
    and not exists (select 1 from public.learner_objective_progress p
                    where p.learner_id = r.learner_id and p.objective_id = p_objective_id and p.status = 'needs_support');

  for v_row in
    select p.learner_id, p.status, p.latest_percent, p.evidence_count
    from public.learner_objective_progress p
    join public.learner_enrollments le on le.learner_id = p.learner_id and le.class_id = p_class_id and le.enrollment_status = 'enrolled'
    where p.objective_id = p_objective_id and p.status in ('needs_support', 'mastered')
  loop
    v_kind := case when v_row.status = 'needs_support' then 'remediation' else 'extension' end;
    select r.id into v_resource
    from public.resource_objectives ro
    join public.teaching_resources r on r.id = ro.resource_id
    where ro.objective_id = p_objective_id and r.status = 'published'
      and r.stage = case when v_kind = 'remediation' then 'support'::public.toolkit_stage else 'challenge'::public.toolkit_stage end
    order by case r.difficulty when 'foundational' then 1 when 'standard' then 2 else 3 end * (case when v_kind = 'remediation' then 1 else -1 end), r.title
    limit 1;

    insert into public.learning_recommendations (school_id, learner_id, objective_id, kind, resource_id, reason, evidence, created_by)
    values (v_school, v_row.learner_id, p_objective_id, v_kind, v_resource,
            case when v_kind = 'remediation'
                 then format('Latest recorded result is %s%%, below the support threshold (%s attempt(s) recorded).', v_row.latest_percent, v_row.evidence_count)
                 else format('Latest two recorded results met the mastery threshold (latest %s%%).', v_row.latest_percent) end,
            jsonb_build_object('status', v_row.status, 'latest_percent', v_row.latest_percent, 'evidence_count', v_row.evidence_count),
            auth.uid())
    on conflict (learner_id, objective_id, kind) where status = 'open' do nothing;
    get diagnostics v_inserted = row_count;
    v_created := v_created + v_inserted;
  end loop;

  if v_created > 0 then
    perform public.write_audit_log(v_school, auth.uid(), 'recommendations_generated', 'learning_recommendations', p_objective_id, null,
      jsonb_build_object('class_id', p_class_id, 'created', v_created));
  end if;
  return v_created;
end $$;

create or replace function public.update_recommendation_status(p_id uuid, p_status text, p_intervention_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_school  uuid;
  v_learner uuid;
  v_class   uuid;
begin
  if p_status not in ('accepted', 'dismissed', 'completed') then
    raise exception 'invalid_state: a recommendation can be accepted, dismissed or completed';
  end if;
  select school_id, learner_id into v_school, v_learner from public.learning_recommendations where id = p_id;
  if v_school is null then raise exception 'not_found: no recommendation %', p_id; end if;
  select le.class_id into v_class from public.learner_enrollments le
  where le.learner_id = v_learner and le.enrollment_status = 'enrolled' and le.class_id is not null
  order by le.enrollment_date desc limit 1;
  if v_class is null or not public.can_teach_class(v_school, v_class) then
    raise exception 'insufficient_privilege: you do not teach this learner';
  end if;
  if p_intervention_id is not null and not exists
     (select 1 from public.academic_interventions where id = p_intervention_id and school_id = v_school and learner_id = v_learner) then
    raise exception 'invalid_reference: that intervention is not for this learner';
  end if;
  update public.learning_recommendations
  set status = p_status, intervention_id = coalesce(p_intervention_id, intervention_id),
      resolved_at = case when p_status in ('dismissed', 'completed') then now() end
  where id = p_id;
  perform public.write_audit_log(v_school, auth.uid(), 'recommendation_' || p_status, 'learning_recommendations', p_id, null,
    jsonb_build_object('intervention_id', p_intervention_id));
end $$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.can_teach_class(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.school_follows_version(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.class_matches_grade_subject(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.derive_learner_progress(uuid, uuid) from public, anon, authenticated;

revoke execute on function public.content_transition(text, uuid, public.content_status, text) from public, anon;
revoke execute on function public.adopt_curriculum_version(uuid, uuid) from public, anon;
revoke execute on function public.set_class_current_topic(uuid, uuid, uuid) from public, anon;
revoke execute on function public.assign_learning_to_class(uuid, uuid, uuid, uuid, uuid, text, text, timestamptz) from public, anon;
revoke execute on function public.record_learning_attempt(uuid, uuid, uuid, numeric, numeric, boolean, jsonb, uuid) from public, anon;
revoke execute on function public.class_objective_progress(uuid, uuid) from public, anon;
revoke execute on function public.generate_learning_recommendations(uuid, uuid) from public, anon;
revoke execute on function public.update_recommendation_status(uuid, text, uuid) from public, anon;

grant execute on function public.content_transition(text, uuid, public.content_status, text) to authenticated;
grant execute on function public.adopt_curriculum_version(uuid, uuid) to authenticated;
grant execute on function public.set_class_current_topic(uuid, uuid, uuid) to authenticated;
grant execute on function public.assign_learning_to_class(uuid, uuid, uuid, uuid, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.record_learning_attempt(uuid, uuid, uuid, numeric, numeric, boolean, jsonb, uuid) to authenticated;
grant execute on function public.class_objective_progress(uuid, uuid) to authenticated;
grant execute on function public.generate_learning_recommendations(uuid, uuid) to authenticated;
grant execute on function public.update_recommendation_status(uuid, text, uuid) to authenticated;

-- The trigger functions and schema helpers of the previous migration are internal only.
revoke execute on function public.content_protect_status() from public, anon, authenticated;
revoke execute on function public.content_freeze() from public, anon, authenticated;
revoke execute on function public.curriculum_hierarchy_freeze() from public, anon, authenticated;
revoke execute on function public.content_child_freeze() from public, anon, authenticated;
revoke execute on function public.content_validate_topic_scope() from public, anon, authenticated;
revoke execute on function public.curriculum_map_validate_school() from public, anon, authenticated;
revoke execute on function public.curriculum_versions_set_created_by() from public, anon, authenticated;
