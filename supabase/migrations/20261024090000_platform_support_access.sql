-- Platform support access (platform-owner review 2026-10-24, item A).
--
-- Before this migration every platform role (platform_owner,
-- super_administrator, platform_administrator) could read, across ALL
-- schools and with no school's involvement: safeguarding concerns, learner
-- medical information, behaviour incidents and every private conversation
-- (messages, attachments, participants). It could also write safeguarding,
-- medical and behaviour records. A school is the POPIA responsible party and
-- Funda360 its operator; health and child-protection records are special
-- personal information, so an operator must not hold standing access.
--
-- Now a platform user gets these areas only through a support-access grant:
--   * the platform user requests access to ONE school, for named areas
--     (safeguarding / medical / behaviour / messages), a reason and 1-72 hours
--     (request_platform_support_access);
--   * that school's owner or principal approves or declines it
--     (decide_platform_support_access) and either side can revoke it
--     (revoke_platform_support_access);
--   * an approved grant is personal to the requester, read-only, and only
--     usable from an MFA-verified (aal2) session until it expires;
--   * every request, decision and revocation is written to audit_log and
--     notified to the other side. (Individual reads cannot be logged from
--     inside a read-only PostgREST request; what is recorded is who had which
--     access, to which school, why, and for how long.)
--
-- Also fixed here: get_learner_record_package included medical information
-- and every behaviour incident for any staff member who can view learners.
-- It now includes them only for callers who may read those areas (or the
-- learner's own family, as before).

-- ---------------------------------------------------------------------------
-- 1. Grants

create table public.platform_support_grants (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools (id) on delete cascade,
  requested_by        uuid not null references public.profiles (id) on delete cascade,
  requested_by_name   text not null,
  requested_by_email  text,
  scopes              text[] not null,
  reason              text not null,
  duration_hours      integer not null,
  status              text not null default 'pending',
  decided_by          uuid references public.profiles (id) on delete set null,
  decided_at          timestamptz,
  decision_note       text,
  starts_at           timestamptz,
  expires_at          timestamptz,
  revoked_by          uuid references public.profiles (id) on delete set null,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now(),
  constraint platform_support_grants_scopes_check check (
    cardinality(scopes) > 0
    and scopes <@ array['safeguarding', 'medical', 'behaviour', 'messages']::text[]
  ),
  constraint platform_support_grants_reason_check check (char_length(btrim(reason)) between 10 and 1000),
  constraint platform_support_grants_duration_check check (duration_hours between 1 and 72),
  constraint platform_support_grants_status_check check (status in ('pending', 'approved', 'declined', 'revoked')),
  constraint platform_support_grants_window_check check (
    (status = 'approved') = (starts_at is not null and expires_at is not null) or status = 'revoked'
  )
);

comment on table public.platform_support_grants is
  'Time-limited, school-approved access for one platform user to one school''s safeguarding, medical, behaviour or messages data. Written only through request/decide/revoke_platform_support_access(). An approved grant is usable from starts_at until expires_at, from an aal2 session, unless revoked.';

create index platform_support_grants_school_idx on public.platform_support_grants (school_id, created_at desc);
create index platform_support_grants_requester_idx on public.platform_support_grants (requested_by, status, expires_at);

alter table public.platform_support_grants enable row level security;
alter table public.platform_support_grants force row level security;

-- Supabase default privileges grant everything; reads go through the policy
-- below, writes only through the RPCs.
revoke all on public.platform_support_grants from public, anon, authenticated;
grant select on public.platform_support_grants to authenticated;

-- Platform roles see every grant (they are the ones requesting); a school's
-- owner and principal see their own school's grants.
create policy platform_support_grants_select on public.platform_support_grants
  for select to authenticated using (
    (select public.is_platform_admin())
    or (
      school_id = (select public.current_tenant_id())
      and (select public.jwt_role()) in ('school_owner', 'principal')
    )
  );

-- ---------------------------------------------------------------------------
-- 2. The access check

-- Schools for which the caller holds an active grant covering p_scope.
-- Empty for anyone who is not a platform user in an aal2 session, so it is
-- cheap for everyone else and policies can evaluate it once per query.
create or replace function public.platform_support_school_ids(p_scope text)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not (public.is_platform_admin() and public.session_is_aal2()) then '{}'::uuid[]
    else coalesce((
      select array_agg(distinct g.school_id)
      from public.platform_support_grants g
      where g.requested_by = auth.uid()
        and g.status = 'approved'
        and g.revoked_at is null
        and now() >= g.starts_at
        and now() < g.expires_at
        and p_scope = any (g.scopes)
    ), '{}'::uuid[])
  end
$$;

revoke execute on function public.platform_support_school_ids(text) from public, anon;
grant execute on function public.platform_support_school_ids(text) to authenticated;

create or replace function public.platform_support_access(p_school_id uuid, p_scope text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_school_id = any (public.platform_support_school_ids(p_scope))
$$;

revoke execute on function public.platform_support_access(uuid, text) from public, anon;
grant execute on function public.platform_support_access(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Area helpers: no standing platform access; support access is read-only

create or replace function public.can_view_safeguarding(target_school_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    (
      target_school_id = public.current_tenant_id()
      and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('school_owner', 'principal')
    )
    or public.platform_support_access(target_school_id, 'safeguarding')
$$;

create or replace function public.can_manage_safeguarding(target_school_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    target_school_id = public.current_tenant_id()
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('school_owner', 'principal')
$$;

create or replace function public.can_view_learner_medical(target_school_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    (
      target_school_id = public.current_tenant_id()
      and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('school_owner', 'principal', 'medical_officer')
    )
    or public.platform_support_access(target_school_id, 'medical')
$$;

create or replace function public.can_manage_learner_medical(target_school_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    target_school_id = public.current_tenant_id()
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('school_owner', 'medical_officer')
$$;

create or replace function public.can_view_behaviour(target_school_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    (
      target_school_id = public.current_tenant_id()
      and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in
        ('school_owner', 'principal', 'vice_principal', 'department_head')
    )
    or public.platform_support_access(target_school_id, 'behaviour')
$$;

create or replace function public.can_manage_behaviour(target_school_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    target_school_id = public.current_tenant_id()
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in
      ('school_owner', 'principal', 'vice_principal', 'department_head')
$$;

-- ---------------------------------------------------------------------------
-- 4. Conversations: participants, or a platform user with a messages grant

drop policy conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated using (
    id = any ((select public.my_conversation_ids())::uuid[])
    or school_id = any ((select public.platform_support_school_ids('messages'))::uuid[])
  );

drop policy conversation_participants_select on public.conversation_participants;
create policy conversation_participants_select on public.conversation_participants
  for select to authenticated using (
    conversation_id = any ((select public.my_conversation_ids())::uuid[])
    or school_id = any ((select public.platform_support_school_ids('messages'))::uuid[])
  );

drop policy messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated using (
    conversation_id = any ((select public.my_conversation_ids())::uuid[])
    or school_id = any ((select public.platform_support_school_ids('messages'))::uuid[])
  );

drop policy message_attachments_select on public.message_attachments;
create policy message_attachments_select on public.message_attachments
  for select to authenticated using (
    conversation_id = any ((select public.my_conversation_ids())::uuid[])
    or school_id = any ((select public.platform_support_school_ids('messages'))::uuid[])
  );

-- ---------------------------------------------------------------------------
-- 5. Request / decide / revoke

create or replace function public.request_platform_support_access(
  p_school_id uuid,
  p_scopes text[],
  p_reason text,
  p_duration_hours integer
) returns public.platform_support_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_school public.schools;
  v_grant public.platform_support_grants;
  v_recipient record;
  v_scopes text[];
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators can request support access';
  end if;
  select * into v_school from public.schools where id = p_school_id;
  if v_school.id is null then
    raise exception 'not_found: school';
  end if;
  select array_agg(distinct s order by s) into v_scopes from unnest(coalesce(p_scopes, '{}')) s;
  if coalesce(cardinality(v_scopes), 0) = 0
     or not v_scopes <@ array['safeguarding', 'medical', 'behaviour', 'messages']::text[] then
    raise exception 'invalid_argument: choose at least one of safeguarding, medical, behaviour, messages';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'invalid_argument: give a reason of 10 to 1000 characters';
  end if;
  if p_duration_hours is null or p_duration_hours not between 1 and 72 then
    raise exception 'invalid_argument: duration must be between 1 and 72 hours';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  insert into public.platform_support_grants
    (school_id, requested_by, requested_by_name, requested_by_email, scopes, reason, duration_hours)
  values
    (p_school_id, auth.uid(),
     coalesce(nullif(btrim(coalesce(v_profile.first_name, '') || ' ' || coalesce(v_profile.last_name, '')), ''), 'Platform administrator'),
     v_profile.email, v_scopes, btrim(p_reason), p_duration_hours)
  returning * into v_grant;

  perform public.write_audit_log(
    p_school_id, auth.uid(), 'platform_support_access_requested', 'platform_support_grants', v_grant.id, null,
    jsonb_build_object('scopes', v_scopes, 'reason', v_grant.reason, 'duration_hours', p_duration_hours)
  );

  for v_recipient in
    select p.id from public.profiles p
    where p.tenant_id = p_school_id and p.role in ('school_owner', 'principal') and p.status = 'active'
  loop
    perform public.create_notification(
      v_recipient.id, 'platform_support_access_requested', 'Support access requested',
      v_grant.requested_by_name || ' (Funda360) asks for ' || p_duration_hours || ' hours of read-only access to: '
        || array_to_string(v_scopes, ', ') || '. Reason: ' || v_grant.reason,
      p_school_id, 'platform_support_grants', v_grant.id, '/compliance#support-access'
    );
  end loop;

  return v_grant;
end;
$$;

revoke execute on function public.request_platform_support_access(uuid, text[], text, integer) from public, anon;
grant execute on function public.request_platform_support_access(uuid, text[], text, integer) to authenticated;

create or replace function public.decide_platform_support_access(
  p_grant_id uuid,
  p_approve boolean,
  p_note text default null
) returns public.platform_support_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.platform_support_grants;
begin
  select * into v_grant from public.platform_support_grants where id = p_grant_id for update;
  if v_grant.id is null then
    raise exception 'not_found: support access request';
  end if;
  -- Only the school's own owner or principal decides; platform roles never
  -- approve access for themselves.
  if not (
    v_grant.school_id = public.current_tenant_id()
    and public.jwt_role() in ('school_owner', 'principal')
  ) then
    raise exception 'insufficient_privilege: only this school''s owner or principal can decide a support access request';
  end if;
  if v_grant.status <> 'pending' then
    raise exception 'invalid_state: this request has already been %', v_grant.status;
  end if;

  update public.platform_support_grants
    set status = case when p_approve then 'approved' else 'declined' end,
        decided_by = auth.uid(),
        decided_at = now(),
        decision_note = nullif(btrim(coalesce(p_note, '')), ''),
        starts_at = case when p_approve then now() end,
        expires_at = case when p_approve then now() + make_interval(hours => v_grant.duration_hours) end
    where id = p_grant_id
    returning * into v_grant;

  perform public.write_audit_log(
    v_grant.school_id, auth.uid(),
    case when p_approve then 'platform_support_access_approved' else 'platform_support_access_declined' end,
    'platform_support_grants', v_grant.id, null,
    jsonb_build_object('scopes', v_grant.scopes, 'expires_at', v_grant.expires_at, 'note', v_grant.decision_note)
  );

  perform public.create_notification(
    v_grant.requested_by, 'platform_support_access_decided',
    case when p_approve then 'Support access approved' else 'Support access declined' end,
    case when p_approve
      then 'Read-only access to ' || array_to_string(v_grant.scopes, ', ') || ' is open until '
        || to_char(v_grant.expires_at at time zone 'Africa/Johannesburg', 'YYYY-MM-DD HH24:MI') || ' (SAST).'
      else 'The school declined your request.' end
      || coalesce(' Note: ' || v_grant.decision_note, ''),
    null, 'platform_support_grants', v_grant.id, '/schools'
  );

  return v_grant;
end;
$$;

revoke execute on function public.decide_platform_support_access(uuid, boolean, text) from public, anon;
grant execute on function public.decide_platform_support_access(uuid, boolean, text) to authenticated;

create or replace function public.revoke_platform_support_access(p_grant_id uuid)
returns public.platform_support_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.platform_support_grants;
  v_by_school boolean;
begin
  select * into v_grant from public.platform_support_grants where id = p_grant_id for update;
  if v_grant.id is null then
    raise exception 'not_found: support access request';
  end if;
  v_by_school := v_grant.school_id = public.current_tenant_id()
    and public.jwt_role() in ('school_owner', 'principal');
  if not (v_by_school or (v_grant.requested_by = auth.uid() and public.is_platform_admin())) then
    raise exception 'insufficient_privilege: only this school''s owner or principal, or the requester, can revoke this access';
  end if;
  if v_grant.status not in ('pending', 'approved') or v_grant.revoked_at is not null then
    raise exception 'invalid_state: this request is already %', v_grant.status;
  end if;

  update public.platform_support_grants
    set status = 'revoked', revoked_by = auth.uid(), revoked_at = now()
    where id = p_grant_id
    returning * into v_grant;

  perform public.write_audit_log(
    v_grant.school_id, auth.uid(), 'platform_support_access_revoked', 'platform_support_grants', v_grant.id, null,
    jsonb_build_object('scopes', v_grant.scopes, 'revoked_by_school', v_by_school)
  );

  if v_by_school then
    perform public.create_notification(
      v_grant.requested_by, 'platform_support_access_revoked', 'Support access revoked',
      'The school revoked your access to ' || array_to_string(v_grant.scopes, ', ') || '.',
      null, 'platform_support_grants', v_grant.id, '/schools'
    );
  end if;

  return v_grant;
end;
$$;

revoke execute on function public.revoke_platform_support_access(uuid) from public, anon;
grant execute on function public.revoke_platform_support_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Learner record package: medical and behaviour only for callers who may
-- read them (or the learner's own family, as before).

create or replace function public.get_learner_record_package(p_learner_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_learner public.learners;
  v_family boolean;
  v_staff boolean;
  v_medical boolean;
  v_behaviour boolean;
  result jsonb;
begin
  select * into v_learner from public.learners where id = p_learner_id;
  if v_learner.id is null then raise exception 'not_found: learner'; end if;
  v_family := public.is_learner_guardian(p_learner_id) or public.is_learner_self(p_learner_id);
  v_staff := public.can_view_learners(v_learner.school_id);
  if not (v_family or v_staff) then raise exception 'insufficient_privilege: no access to this learner record'; end if;
  v_medical := v_family or public.can_view_learner_medical(v_learner.school_id);
  v_behaviour := public.can_view_behaviour(v_learner.school_id);

  result := jsonb_build_object(
    'format', 'funda360.learner-record.v1',
    'generated_at', now(),
    'generated_for', auth.uid(),
    'school', (select jsonb_build_object('id', s.id, 'name', s.name) from public.schools s where s.id = v_learner.school_id),
    'learner', to_jsonb(v_learner) - 'created_by' - 'updated_by',
    'enrollments', coalesce((select jsonb_agg(jsonb_build_object(
        'academic_year', ay.name, 'grade', g.name, 'class', c.name, 'status', e.enrollment_status, 'enrollment_date', e.enrollment_date)
        order by e.enrollment_date)
      from public.learner_enrollments e
      left join public.academic_years ay on ay.id = e.academic_year_id
      left join public.grades g on g.id = e.grade_id
      left join public.classes c on c.id = e.class_id
      where e.learner_id = p_learner_id), '[]'::jsonb),
    'guardians', coalesce((select jsonb_agg(jsonb_build_object(
        'name', p.first_name || ' ' || p.last_name, 'relationship', lg.relationship_type, 'is_primary', lg.is_primary,
        'custody_notes', case when v_staff then lg.custody_notes else null end))
      from public.learner_guardians lg join public.profiles p on p.id = lg.guardian_profile_id
      where lg.learner_id = p_learner_id and lg.active), '[]'::jsonb),
    'emergency_contacts', coalesce((select jsonb_agg(to_jsonb(ec) - 'created_by' - 'updated_by')
      from public.learner_emergency_contacts ec where ec.learner_id = p_learner_id and ec.active), '[]'::jsonb),
    'medical', case when v_medical then
      (select to_jsonb(m) - 'created_by' - 'updated_by' from public.learner_medical_information m where m.learner_id = p_learner_id limit 1)
      end,
    'attendance', coalesce((select jsonb_agg(jsonb_build_object('date', a.attendance_date, 'status', a.status, 'notes', a.notes) order by a.attendance_date)
      from public.attendance_records a where a.learner_id = p_learner_id), '[]'::jsonb),
    'assessment_results', coalesce((select jsonb_agg(jsonb_build_object(
        'assessment', asm.title, 'type', asm.assessment_type, 'date', asm.assessment_date, 'mark', r.mark, 'max_mark', asm.max_mark)
        order by asm.assessment_date)
      from public.assessment_results r join public.assessments asm on asm.id = r.assessment_id
      where r.learner_id = p_learner_id and asm.active), '[]'::jsonb),
    'report_cards', coalesce((select jsonb_agg(jsonb_build_object(
        'term_id', rc.term_id, 'status', rc.status, 'overall_average_percentage', rc.overall_average_percentage,
        'overall_achievement', rc.overall_achievement_label, 'class_teacher_comment', rc.class_teacher_comment,
        'principal_comment', rc.principal_comment, 'published_at', rc.published_at) order by rc.generated_at)
      from public.report_cards rc
      where rc.learner_id = p_learner_id and (v_staff or rc.status = 'published')), '[]'::jsonb),
    'behaviour', coalesce((select jsonb_agg(jsonb_build_object(
        'occurred_at', b.occurred_at, 'type', b.incident_type, 'severity', b.severity, 'category', b.category,
        'description', b.description, 'action_taken', b.action_taken) order by b.occurred_at)
      from public.behaviour_incidents b
      where b.learner_id = p_learner_id and b.active and (v_behaviour or (v_family and b.guardian_visible))), '[]'::jsonb),
    'fees', jsonb_build_object(
      'charges', coalesce((select jsonb_agg(jsonb_build_object('description', c.description, 'amount', c.amount, 'due_date', c.due_date))
        from public.learner_fee_charges c where c.learner_id = p_learner_id and c.active), '[]'::jsonb),
      'payments', coalesce((select jsonb_agg(jsonb_build_object('amount', pmt.amount, 'date', pmt.payment_date, 'method', pmt.method, 'reference', pmt.reference))
        from public.learner_fee_payments pmt where pmt.learner_id = p_learner_id and pmt.active), '[]'::jsonb)
    ),
    'documents', coalesce((select jsonb_agg(jsonb_build_object('type', d.document_type, 'file_name', d.file_name, 'uploaded_at', d.uploaded_at, 'expiry_date', d.expiry_date))
      from public.learner_documents d where d.learner_id = p_learner_id and d.active), '[]'::jsonb),
    'privacy', jsonb_build_object(
      'consents', coalesce((select jsonb_agg(jsonb_build_object('purpose', pc.purpose, 'decision', pc.decision, 'method', pc.method, 'policy_version', pc.policy_version, 'decided_at', pc.decided_at) order by pc.decided_at)
        from public.parental_consents pc where pc.learner_id = p_learner_id), '[]'::jsonb),
      'amendment_requests', coalesce((select jsonb_agg(to_jsonb(ar) - 'requested_by' - 'decided_by' order by ar.created_at)
        from public.record_amendment_requests ar where ar.learner_id = p_learner_id), '[]'::jsonb),
      'disclosures', coalesce((select jsonb_agg(jsonb_build_object('disclosed_to', rd.disclosed_to, 'recipient_type', rd.recipient_type, 'legal_basis', rd.legal_basis, 'data_categories', rd.data_categories, 'disclosed_at', rd.disclosed_at) order by rd.disclosed_at)
        from public.record_disclosures rd where rd.learner_id = p_learner_id), '[]'::jsonb)
    )
  );

  perform public.write_access_log(p_learner_id, 'export', 'Full learner record package generated');
  perform public.write_audit_log(v_learner.school_id, auth.uid(), 'learner_record_exported', 'learners', p_learner_id, null,
    jsonb_build_object('requested_by_role', public.jwt_role()));
  return result;
end $$;

-- New policies must be in the optimised form the RLS suite checks for.
select public.rls_optimize_policies();
