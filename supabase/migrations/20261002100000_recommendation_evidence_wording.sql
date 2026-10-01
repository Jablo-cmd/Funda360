-- Recommendation evidence must state only what was recorded.
--
-- generate_learning_recommendations() (20261001100000) wrote "below the support threshold" for every learner
-- flagged as needing support, but a learner is also flagged by the second rule (the latest two results both
-- under 60%), where the latest result can be above the support threshold. The sentence was then stronger than
-- the data. Evidence now says only what was recorded (latest result, number of attempts, status), and the
-- suggestion (what to do about it) is a separate thing the interface labels as such.
-- The function body is otherwise unchanged; grants are kept by CREATE OR REPLACE.

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
                 then format('Recorded results: the latest is %s%% across %s recorded %s.',
                             v_row.latest_percent, v_row.evidence_count, case when v_row.evidence_count = 1 then 'attempt' else 'attempts' end)
                 else format('Recorded results: the latest two met the mastery threshold (the latest is %s%%).', v_row.latest_percent) end,
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
