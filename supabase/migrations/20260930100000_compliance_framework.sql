-- ============================================================================
-- Compliance framework — POPIA (baseline) + FERPA + COPPA + CIPA + GDPR.
-- ============================================================================
--
-- This migration is the database half of Funda360's compliance layer. Every
-- control below is enforced in PostgreSQL (RLS, triggers, SECURITY DEFINER
-- RPCs), never only in the UI, and every state change is written to
-- public.audit_log.
--
--   §1  Per-school compliance settings (frameworks, age thresholds, officers)
--   §2  Helper functions (age, roles, consent state)
--   §3  COPPA / POPIA / GDPR verifiable parental consent (append-only ledger)
--       + hard enforcement: no online learner account, no child-originated
--       submissions/messages, while consent is missing for a child under the
--       school's COPPA age (default 13)
--   §4  Student-record access log (FERPA §99.32 / POPIA s.23 transparency)
--   §5  FERPA amendment requests (§99.20–99.22, incl. hearing + statement of
--       disagreement)
--   §6  FERPA disclosure log (§99.32), tied to third-party-sharing consent
--   §7  Data-subject requests: family self-service, statutory due dates
--   §8  Right of access / portability — full learner record package
--   §9  Right to be forgotten — audited, MFA-gated learner erasure
--   §10 CIPA safe-content policy — text filtering + upload safety
--   §11 Comprehensive modification audit on every student-data table
--   §12 Data minimisation — guardians/learners no longer see the whole
--       school's profile directory (audit finding P1-3)
--   §13 Compliance overview for the Trust Center / regulator report
--   §14 Grants
--
-- Frameworks never marked "certified" by this code: the overview reports
-- measured control state, and the UI labels are "ready", not "certified".

-- ============================================================================
-- §1 Per-school compliance settings
-- ============================================================================

create table public.school_compliance_settings (
  school_id                    uuid primary key references public.schools (id) on delete cascade,
  frameworks                   text[] not null default array['POPIA', 'FERPA', 'COPPA', 'CIPA', 'GDPR'],
  coppa_consent_age            integer not null default 13 check (coppa_consent_age between 13 and 18),
  gdpr_digital_consent_age     integer not null default 16 check (gdpr_digital_consent_age between 13 and 16),
  ferpa_amendment_response_days integer not null default 45 check (ferpa_amendment_response_days between 1 and 90),
  dsar_response_days           integer not null default 30 check (dsar_response_days between 1 and 90),
  content_filter_enabled       boolean not null default true,
  information_officer_name     text,
  information_officer_email    text,
  privacy_notice_version       text not null default '2026-09',
  updated_by                   uuid references public.profiles (id) on delete set null,
  updated_at                   timestamptz not null default now(),
  constraint school_compliance_settings_popia_mandatory check ('POPIA' = any (frameworks)),
  constraint school_compliance_settings_known_frameworks check (frameworks <@ array['POPIA', 'FERPA', 'COPPA', 'CIPA', 'GDPR'])
);

comment on table public.school_compliance_settings is
  'One row per school. POPIA is always on (South African baseline — enforced by a CHECK). A school with no row uses the column defaults via public.compliance_settings().';

-- ============================================================================
-- §2 Helpers
-- ============================================================================

create or replace function public.compliance_settings(p_school_id uuid)
returns public.school_compliance_settings
language plpgsql stable security definer set search_path = public
as $$
declare r public.school_compliance_settings;
begin
  select * into r from public.school_compliance_settings where school_id = p_school_id;
  if not found then
    r.school_id := p_school_id;
    r.frameworks := array['POPIA', 'FERPA', 'COPPA', 'CIPA', 'GDPR'];
    r.coppa_consent_age := 13;
    r.gdpr_digital_consent_age := 16;
    r.ferpa_amendment_response_days := 45;
    r.dsar_response_days := 30;
    r.content_filter_enabled := true;
    r.privacy_notice_version := '2026-09';
  end if;
  return r;
end $$;

create or replace function public.jwt_role()
returns text language sql stable
as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') $$;

create or replace function public.is_family_role()
returns boolean language sql stable
as $$ select public.jwt_role() in ('parent', 'guardian', 'learner') $$;

-- Compliance officers: the school's owner and principal (POPIA Information
-- Officer / deputy), plus platform administrators.
create or replace function public.is_compliance_officer(p_school_id uuid)
returns boolean language sql stable
as $$
  select public.is_platform_admin()
    or (p_school_id = public.current_tenant_id() and public.jwt_role() in ('school_owner', 'principal'))
$$;

create or replace function public.learner_age_years(p_learner_id uuid)
returns integer language sql stable security definer set search_path = public
as $$
  select extract(year from age(current_date, date_of_birth))::int from public.learners where id = p_learner_id
$$;

create or replace function public.learner_under_coppa_age(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.learner_age_years(l.id) < (public.compliance_settings(l.school_id)).coppa_consent_age
  from public.learners l where l.id = p_learner_id
$$;

-- ============================================================================
-- §3 Verifiable parental consent (COPPA / POPIA s.35 / GDPR Art. 8)
-- ============================================================================
--
-- Append-only ledger: every decision is a new row, never an update, so the
-- full consent history ("granted 2026-01-10, withdrawn 2026-03-02") is
-- provable. The current state of a (learner, purpose) is its latest row.
-- There are NO default grants anywhere: a learner with no row has consent
-- state "pending", which is treated exactly like "refused" by enforcement.

create table public.parental_consents (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools (id) on delete cascade,
  learner_id          uuid not null references public.learners (id) on delete cascade,
  guardian_profile_id uuid references public.profiles (id) on delete set null,
  purpose             text not null check (purpose in (
                        'core_educational_processing',
                        'online_learner_account',
                        'directory_information',
                        'third_party_sharing',
                        'photo_media_use'
                      )),
  decision            text not null check (decision in ('granted', 'refused', 'withdrawn')),
  method              text not null check (method in ('in_app_attestation', 'paper_form_recorded_by_staff')),
  attested_name       text,
  policy_version      text not null,
  recorded_by         uuid references public.profiles (id) on delete set null,
  decided_at          timestamptz not null default now(),
  constraint parental_consents_attestation_required check (decision <> 'granted' or char_length(coalesce(trim(attested_name), '')) >= 3)
);

comment on table public.parental_consents is
  'Append-only verifiable parental-consent ledger (COPPA, POPIA s.35, GDPR Art. 8). Latest row per (learner_id, purpose) is the current state. Written only via record_parental_consent().';

create index parental_consents_learner_purpose_idx on public.parental_consents (learner_id, purpose, decided_at desc);
create index parental_consents_school_idx on public.parental_consents (school_id);

create or replace function public.learner_consent_decision(p_learner_id uuid, p_purpose text)
returns text language sql stable security definer set search_path = public
as $$
  select decision from public.parental_consents
  where learner_id = p_learner_id and purpose = p_purpose
  order by decided_at desc, id desc limit 1
$$;

create or replace function public.learner_has_consent(p_learner_id uuid, p_purpose text)
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.learner_consent_decision(p_learner_id, p_purpose) = 'granted', false) $$;

-- The COPPA gate: may this child have an online account / submit content?
create or replace function public.learner_online_consent_satisfied(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select not coalesce(public.learner_under_coppa_age(p_learner_id), false)
      or public.learner_has_consent(p_learner_id, 'online_learner_account')
$$;

create or replace function public.record_parental_consent(
  p_learner_id uuid,
  p_purpose text,
  p_decision text,
  p_attested_name text default null,
  p_method text default 'in_app_attestation'
) returns public.parental_consents
language plpgsql security definer set search_path = public
as $$
declare
  v_school uuid;
  v_row public.parental_consents;
  v_is_guardian boolean;
  v_learner_profile uuid;
  v_previous text;
begin
  select school_id, profile_id into v_school, v_learner_profile from public.learners where id = p_learner_id;
  if v_school is null then raise exception 'not_found: learner'; end if;

  v_is_guardian := public.is_learner_guardian(p_learner_id);
  if p_method = 'in_app_attestation' then
    if not v_is_guardian then
      raise exception 'insufficient_privilege: only a linked guardian can give in-app consent for this learner';
    end if;
  elsif p_method = 'paper_form_recorded_by_staff' then
    if not public.can_manage_learners(v_school) then
      raise exception 'insufficient_privilege: only learner managers can record a paper consent form';
    end if;
  else
    raise exception 'invalid_argument: unknown consent method %', p_method;
  end if;

  if p_decision = 'withdrawn' and coalesce(public.learner_consent_decision(p_learner_id, p_purpose), '') <> 'granted' then
    raise exception 'invalid_state: there is no granted consent to withdraw';
  end if;

  v_previous := public.learner_consent_decision(p_learner_id, p_purpose);

  insert into public.parental_consents (school_id, learner_id, guardian_profile_id, purpose, decision, method, attested_name, policy_version, recorded_by)
  values (
    v_school, p_learner_id,
    case when v_is_guardian then auth.uid() else null end,
    p_purpose, p_decision, p_method, nullif(trim(p_attested_name), ''),
    (public.compliance_settings(v_school)).privacy_notice_version, auth.uid()
  )
  returning * into v_row;

  -- COPPA enforcement on withdrawal / refusal: a child under the threshold
  -- whose online-account consent is no longer granted loses portal access
  -- immediately.
  if p_purpose = 'online_learner_account' and p_decision <> 'granted'
     and v_learner_profile is not null and coalesce(public.learner_under_coppa_age(p_learner_id), false) then
    update public.profiles set status = 'inactive' where id = v_learner_profile and status = 'active';
  end if;

  perform public.write_audit_log(
    v_school, auth.uid(), 'parental_consent_' || p_decision, 'parental_consents', v_row.id,
    jsonb_build_object('purpose', p_purpose, 'decision', v_previous),
    jsonb_build_object('purpose', p_purpose, 'decision', p_decision, 'method', p_method, 'policy_version', v_row.policy_version)
  );
  return v_row;
end $$;

-- Enforcement 1: a learner login cannot be linked while consent is missing.
create or replace function public.enforce_learner_account_consent()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.profile_id is not null
     and (tg_op = 'INSERT' or old.profile_id is distinct from new.profile_id)
     and not (
       -- On INSERT the row is not visible to the helper yet, so evaluate the
       -- threshold from NEW directly. A brand-new learner has no consent rows.
       case when tg_op = 'INSERT'
            then extract(year from age(current_date, new.date_of_birth)) >= (public.compliance_settings(new.school_id)).coppa_consent_age
            else public.learner_online_consent_satisfied(new.id) end
     ) then
    raise exception 'consent_required: verifiable parental consent for an online learner account is required before this child (under %) can be given a login', (public.compliance_settings(new.school_id)).coppa_consent_age;
  end if;
  return new;
end $$;

create trigger learners_enforce_account_consent
  before insert or update of profile_id on public.learners
  for each row execute function public.enforce_learner_account_consent();

-- Enforcement 2: a learner profile cannot be (re)activated while consent is missing.
create or replace function public.enforce_learner_profile_consent()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_learner uuid;
begin
  if new.role = 'learner' and new.status = 'active' and old.status is distinct from 'active' then
    select id into v_learner from public.learners where profile_id = new.id;
    if v_learner is not null and not public.learner_online_consent_satisfied(v_learner) then
      raise exception 'consent_required: this learner account cannot be activated until a guardian grants online-account consent';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_enforce_learner_consent
  before update of status on public.profiles
  for each row execute function public.enforce_learner_profile_consent();

-- Enforcement 3: no child-originated content (submissions, messages) from an
-- under-threshold learner without consent — covers any path, including
-- direct PostgREST calls.
create or replace function public.enforce_child_content_consent()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_learner uuid;
begin
  if public.jwt_role() <> 'learner' then return new; end if;
  select id into v_learner from public.learners where profile_id = auth.uid();
  if v_learner is not null and not public.learner_online_consent_satisfied(v_learner) then
    raise exception 'consent_required: a guardian must grant online-account consent before this learner can submit content';
  end if;
  return new;
end $$;

create trigger assignment_submissions_enforce_child_consent
  before insert or update on public.assignment_submissions
  for each row execute function public.enforce_child_content_consent();

create trigger messages_enforce_child_consent
  before insert on public.messages
  for each row execute function public.enforce_child_content_consent();

-- ============================================================================
-- §4 Student-record access log
-- ============================================================================

create table public.student_record_access_log (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  learner_id        uuid not null references public.learners (id) on delete cascade,
  actor_profile_id  uuid references public.profiles (id) on delete set null,
  actor_role        text not null,
  access_type       text not null check (access_type in ('view', 'export', 'print', 'disclosure', 'amendment', 'erasure')),
  context           text not null check (char_length(context) between 1 and 200),
  created_at        timestamptz not null default now()
);

comment on table public.student_record_access_log is
  'Append-only log of who accessed which learner''s education record, how and why. Written only by log_learner_record_access() and the compliance RPCs. Visible to compliance officers, the learner''s guardians and the learner.';

create index student_record_access_log_learner_idx on public.student_record_access_log (learner_id, created_at desc);
create index student_record_access_log_school_idx on public.student_record_access_log (school_id, created_at desc);

create or replace function public.can_access_learner_record(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.learners l where l.id = p_learner_id and public.can_view_learners(l.school_id))
      or public.is_learner_guardian(p_learner_id)
      or public.is_learner_self(p_learner_id)
      or public.is_teacher_of_enrolled_learner(p_learner_id)
$$;

create or replace function public.write_access_log(p_learner_id uuid, p_access_type text, p_context text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  -- De-duplicate identical views within 5 minutes (page refreshes).
  if p_access_type = 'view' and exists (
    select 1 from public.student_record_access_log
    where learner_id = p_learner_id and actor_profile_id = auth.uid() and access_type = 'view'
      and context = p_context and created_at > now() - interval '5 minutes'
  ) then
    return;
  end if;
  insert into public.student_record_access_log (school_id, learner_id, actor_profile_id, actor_role, access_type, context)
  select l.school_id, l.id, auth.uid(), coalesce(nullif(public.jwt_role(), ''), 'system'), p_access_type, left(p_context, 200)
  from public.learners l where l.id = p_learner_id;
end $$;

create or replace function public.log_learner_record_access(p_learner_id uuid, p_access_type text, p_context text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_access_learner_record(p_learner_id) then
    raise exception 'insufficient_privilege: no access to this learner record';
  end if;
  if p_access_type not in ('view', 'export', 'print') then
    raise exception 'invalid_argument: access type % must be recorded by its own workflow', p_access_type;
  end if;
  perform public.write_access_log(p_learner_id, p_access_type, p_context);
end $$;

-- ============================================================================
-- §5 FERPA amendment requests
-- ============================================================================

create table public.record_amendment_requests (
  id                      uuid primary key default gen_random_uuid(),
  school_id               uuid not null references public.schools (id) on delete cascade,
  learner_id              uuid not null references public.learners (id) on delete cascade,
  requested_by            uuid references public.profiles (id) on delete set null,
  record_area             text not null check (record_area in ('personal_details', 'attendance', 'assessment', 'report_card', 'behaviour', 'medical', 'financial', 'other')),
  record_reference        text,
  current_value           text,
  requested_change        text not null check (char_length(requested_change) between 3 and 4000),
  reason                  text not null check (char_length(reason) between 3 and 4000),
  status                  text not null default 'submitted' check (status in ('submitted', 'under_review', 'approved', 'denied', 'hearing_requested', 'closed')),
  decision_notes          text,
  decided_by              uuid references public.profiles (id) on delete set null,
  decided_at              timestamptz,
  due_by                  date not null,
  disagreement_statement  text,
  hearing_requested_at    timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint record_amendment_requests_denial_reason check (status <> 'denied' or char_length(coalesce(decision_notes, '')) >= 3)
);

comment on table public.record_amendment_requests is
  'FERPA §99.20–99.22 / POPIA s.24 correction requests. A denial must carry reasons; the requester may then request a hearing and place a statement of disagreement on the record, which is disclosed with the record thereafter.';

create index record_amendment_requests_learner_idx on public.record_amendment_requests (learner_id);
create index record_amendment_requests_school_status_idx on public.record_amendment_requests (school_id, status);

create trigger record_amendment_requests_set_updated_at
  before update on public.record_amendment_requests
  for each row execute function public.set_updated_at();

create or replace function public.submit_record_amendment(
  p_learner_id uuid, p_record_area text, p_requested_change text, p_reason text,
  p_record_reference text default null, p_current_value text default null
) returns public.record_amendment_requests
language plpgsql security definer set search_path = public
as $$
declare v_school uuid; r public.record_amendment_requests;
begin
  select school_id into v_school from public.learners where id = p_learner_id;
  if v_school is null then raise exception 'not_found: learner'; end if;
  if not (public.is_learner_guardian(p_learner_id)
          or (public.is_learner_self(p_learner_id) and public.learner_age_years(p_learner_id) >= 18)
          or public.can_manage_learners(v_school)) then
    raise exception 'insufficient_privilege: only a guardian, an eligible (18+) learner or a learner manager can request an amendment';
  end if;
  insert into public.record_amendment_requests (school_id, learner_id, requested_by, record_area, record_reference, current_value, requested_change, reason, due_by)
  values (v_school, p_learner_id, auth.uid(), p_record_area, p_record_reference, p_current_value, p_requested_change, p_reason,
          current_date + (public.compliance_settings(v_school)).ferpa_amendment_response_days)
  returning * into r;
  perform public.write_access_log(p_learner_id, 'amendment', 'Amendment requested: ' || p_record_area);
  perform public.write_audit_log(v_school, auth.uid(), 'record_amendment_requested', 'record_amendment_requests', r.id, null,
    jsonb_build_object('record_area', p_record_area, 'due_by', r.due_by));
  return r;
end $$;

create or replace function public.decide_record_amendment(p_request_id uuid, p_status text, p_decision_notes text)
returns public.record_amendment_requests
language plpgsql security definer set search_path = public
as $$
declare r public.record_amendment_requests; v_old text;
begin
  select * into r from public.record_amendment_requests where id = p_request_id for update;
  if r.id is null then raise exception 'not_found: amendment request'; end if;
  if not public.can_manage_learners(r.school_id) then raise exception 'insufficient_privilege'; end if;
  if p_status not in ('under_review', 'approved', 'denied', 'closed') then raise exception 'invalid_argument: status %', p_status; end if;
  if r.status in ('approved', 'closed') then raise exception 'invalid_state: request is already %', r.status; end if;
  v_old := r.status;
  update public.record_amendment_requests
    set status = p_status, decision_notes = p_decision_notes,
        decided_by = case when p_status in ('approved', 'denied', 'closed') then auth.uid() else decided_by end,
        decided_at = case when p_status in ('approved', 'denied', 'closed') then now() else decided_at end
    where id = p_request_id returning * into r;
  perform public.write_audit_log(r.school_id, auth.uid(), 'record_amendment_' || p_status, 'record_amendment_requests', r.id,
    jsonb_build_object('status', v_old), jsonb_build_object('status', p_status, 'notes', p_decision_notes));
  if r.requested_by is not null then
    perform public.create_notification(r.requested_by, 'record_amendment', 'Amendment request ' || replace(p_status, '_', ' '),
      coalesce(p_decision_notes, 'Your record amendment request was updated.'), r.school_id, 'record_amendment_requests', r.id, '/parent/privacy');
  end if;
  return r;
end $$;

create or replace function public.respond_to_amendment_denial(p_request_id uuid, p_request_hearing boolean, p_disagreement_statement text default null)
returns public.record_amendment_requests
language plpgsql security definer set search_path = public
as $$
declare r public.record_amendment_requests;
begin
  select * into r from public.record_amendment_requests where id = p_request_id for update;
  if r.id is null then raise exception 'not_found: amendment request'; end if;
  if r.requested_by is distinct from auth.uid() and not public.is_learner_guardian(r.learner_id) then
    raise exception 'insufficient_privilege';
  end if;
  if r.status not in ('denied', 'hearing_requested') then raise exception 'invalid_state: only a denied request can be contested'; end if;
  update public.record_amendment_requests
    set status = case when p_request_hearing then 'hearing_requested' else status end,
        hearing_requested_at = case when p_request_hearing then now() else hearing_requested_at end,
        disagreement_statement = coalesce(nullif(trim(p_disagreement_statement), ''), disagreement_statement)
    where id = p_request_id returning * into r;
  perform public.write_audit_log(r.school_id, auth.uid(),
    case when p_request_hearing then 'record_amendment_hearing_requested' else 'record_amendment_statement_added' end,
    'record_amendment_requests', r.id, null, jsonb_build_object('hearing', p_request_hearing));
  return r;
end $$;

-- ============================================================================
-- §6 FERPA disclosure log
-- ============================================================================

create table public.record_disclosures (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools (id) on delete cascade,
  learner_id          uuid not null references public.learners (id) on delete cascade,
  disclosed_to        text not null check (char_length(disclosed_to) between 2 and 200),
  recipient_type      text not null check (recipient_type in (
                        'school_official', 'transfer_school', 'education_authority', 'health_safety_emergency',
                        'court_order_or_subpoena', 'parental_consent', 'directory_information', 'other_lawful_basis'
                      )),
  legal_basis         text not null check (char_length(legal_basis) between 3 and 1000),
  data_categories     text[] not null check (cardinality(data_categories) > 0),
  disclosed_by        uuid references public.profiles (id) on delete set null,
  disclosed_at        timestamptz not null default now()
);

comment on table public.record_disclosures is
  'FERPA §99.32 record of disclosures (and POPIA s.18/s.23 transparency). Visible to the learner''s guardians. Consent-based and directory-information disclosures are refused by record_disclosure() unless the matching consent is currently granted.';

create index record_disclosures_learner_idx on public.record_disclosures (learner_id, disclosed_at desc);
create index record_disclosures_school_idx on public.record_disclosures (school_id, disclosed_at desc);

create or replace function public.record_disclosure(
  p_learner_id uuid, p_disclosed_to text, p_recipient_type text, p_legal_basis text, p_data_categories text[]
) returns public.record_disclosures
language plpgsql security definer set search_path = public
as $$
declare v_school uuid; r public.record_disclosures;
begin
  select school_id into v_school from public.learners where id = p_learner_id;
  if v_school is null then raise exception 'not_found: learner'; end if;
  if not public.can_manage_learners(v_school) then raise exception 'insufficient_privilege'; end if;
  if p_recipient_type = 'parental_consent' and not public.learner_has_consent(p_learner_id, 'third_party_sharing') then
    raise exception 'consent_required: no current guardian consent for third-party sharing of this learner''s records';
  end if;
  if p_recipient_type = 'directory_information' and not public.learner_has_consent(p_learner_id, 'directory_information') then
    raise exception 'consent_required: the guardian has not consented to directory-information disclosure';
  end if;
  insert into public.record_disclosures (school_id, learner_id, disclosed_to, recipient_type, legal_basis, data_categories, disclosed_by)
  values (v_school, p_learner_id, p_disclosed_to, p_recipient_type, p_legal_basis, p_data_categories, auth.uid())
  returning * into r;
  perform public.write_access_log(p_learner_id, 'disclosure', 'Disclosed to ' || p_disclosed_to);
  perform public.write_audit_log(v_school, auth.uid(), 'record_disclosed', 'record_disclosures', r.id, null,
    jsonb_build_object('recipient_type', p_recipient_type, 'data_categories', p_data_categories));
  return r;
end $$;

-- ============================================================================
-- §7 Data-subject requests — family self-service + statutory due dates
-- ============================================================================

alter table public.data_subject_requests
  add column if not exists requested_by uuid references public.profiles (id) on delete set null,
  add column if not exists due_at timestamptz;

update public.data_subject_requests set due_at = requested_at + interval '30 days' where due_at is null;

create or replace function public.create_data_subject_request(
  p_school_id uuid, p_subject_profile_id uuid default null, p_subject_learner_id uuid default null,
  p_request_type text default 'access', p_reason text default null
) returns public.data_subject_requests
language plpgsql security definer set search_path = public
as $$
declare r public.data_subject_requests;
begin
  if auth.uid() is null or public.current_tenant_id() is distinct from p_school_id then
    raise exception 'insufficient_privilege';
  end if;
  if p_request_type not in ('access', 'correction', 'restriction', 'deletion', 'portability') then
    raise exception 'validation_error';
  end if;
  if p_subject_profile_id is null and p_subject_learner_id is null then
    raise exception 'validation_error: a subject (person or learner) is required';
  end if;
  -- Family callers may only raise requests about themselves or their own children.
  if public.is_family_role() then
    if p_subject_profile_id is not null and p_subject_profile_id <> auth.uid() then
      raise exception 'insufficient_privilege: you can only raise requests about yourself or your own children';
    end if;
    if p_subject_learner_id is not null
       and not (public.is_learner_guardian(p_subject_learner_id) or public.is_learner_self(p_subject_learner_id)) then
      raise exception 'insufficient_privilege: you can only raise requests about yourself or your own children';
    end if;
  end if;
  if p_subject_learner_id is not null
     and not exists (select 1 from public.learners where id = p_subject_learner_id and school_id = p_school_id) then
    raise exception 'validation_error: learner not in school';
  end if;
  insert into public.data_subject_requests (school_id, subject_profile_id, subject_learner_id, request_type, reason, requested_by, due_at)
  values (p_school_id, p_subject_profile_id, p_subject_learner_id, p_request_type, p_reason, auth.uid(),
          now() + make_interval(days => (public.compliance_settings(p_school_id)).dsar_response_days))
  returning * into r;
  perform public.write_audit_log(p_school_id, auth.uid(), 'dsar_created', 'data_subject_requests', r.id, null,
    jsonb_build_object('request_type', p_request_type, 'due_at', r.due_at));
  return r;
end $$;

drop policy if exists data_subject_requests_select on public.data_subject_requests;
create policy data_subject_requests_select on public.data_subject_requests
  for select to authenticated using (
    public.can_view_dsar(school_id) or subject_profile_id = auth.uid() or requested_by = auth.uid()
    or (subject_learner_id is not null and public.is_learner_guardian(subject_learner_id))
  );

-- ============================================================================
-- §8 Right of access / portability — the full learner record package
-- ============================================================================

create or replace function public.get_learner_record_package(p_learner_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_learner public.learners;
  v_family boolean;
  v_staff boolean;
  result jsonb;
begin
  select * into v_learner from public.learners where id = p_learner_id;
  if v_learner.id is null then raise exception 'not_found: learner'; end if;
  v_family := public.is_learner_guardian(p_learner_id) or public.is_learner_self(p_learner_id);
  v_staff := public.can_view_learners(v_learner.school_id);
  if not (v_family or v_staff) then raise exception 'insufficient_privilege: no access to this learner record'; end if;

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
    'medical', (select to_jsonb(m) - 'created_by' - 'updated_by' from public.learner_medical_information m where m.learner_id = p_learner_id limit 1),
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
      where b.learner_id = p_learner_id and b.active and (v_staff or b.guardian_visible)), '[]'::jsonb),
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

-- Transparency for families: who accessed / received this child's record.
create or replace function public.get_learner_privacy_history(p_learner_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_school uuid;
begin
  select school_id into v_school from public.learners where id = p_learner_id;
  if v_school is null then raise exception 'not_found: learner'; end if;
  if not (public.is_learner_guardian(p_learner_id) or public.is_learner_self(p_learner_id) or public.is_compliance_officer(v_school)) then
    raise exception 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'access', coalesce((select jsonb_agg(jsonb_build_object(
        'at', a.created_at, 'type', a.access_type, 'role', a.actor_role, 'context', a.context,
        'by', coalesce(p.first_name || ' ' || p.last_name, 'System')) order by a.created_at desc)
      from (select * from public.student_record_access_log where learner_id = p_learner_id order by created_at desc limit 500) a
      left join public.profiles p on p.id = a.actor_profile_id), '[]'::jsonb),
    'disclosures', coalesce((select jsonb_agg(jsonb_build_object('at', d.disclosed_at, 'to', d.disclosed_to, 'type', d.recipient_type, 'legal_basis', d.legal_basis, 'data_categories', d.data_categories) order by d.disclosed_at desc)
      from public.record_disclosures d where d.learner_id = p_learner_id), '[]'::jsonb)
  );
end $$;

-- ============================================================================
-- §9 Right to be forgotten — learner erasure
-- ============================================================================
--
-- Irreversible. Requires: a deletion DSAR that has passed identity
-- verification, a compliance officer caller, an MFA (aal2) session, and the
-- learner number typed back as confirmation. Statutory records (attendance
-- registers, financial ledger, safeguarding) are retained but pseudonymised
-- — POPIA s.14(1)(a)/GDPR Art. 17(3)(b) legal-obligation exemption. Free
-- text, identifiers, contacts, medical data and documents are removed, and
-- the PII copies inside audit_log are redacted. Storage object paths are
-- returned so the caller can delete the files through the Storage API.

create or replace function public.execute_learner_erasure(p_request_id uuid, p_confirm_learner_number text)
returns jsonb language plpgsql security definer set search_path = public, auth
as $$
declare
  v_req public.data_subject_requests;
  v_learner public.learners;
  v_paths text[] := array[]::text[];
  v_counts jsonb := '{}'::jsonb;
  n integer;
begin
  select * into v_req from public.data_subject_requests where id = p_request_id for update;
  if v_req.id is null then raise exception 'not_found: request'; end if;
  if not public.is_compliance_officer(v_req.school_id) then
    raise exception 'insufficient_privilege: only the school owner, principal or a platform administrator can execute an erasure';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required: erasure is irreversible and requires a multi-factor authenticated session';
  end if;
  if v_req.request_type <> 'deletion' or v_req.subject_learner_id is null then
    raise exception 'invalid_state: only a learner deletion request can be executed as an erasure';
  end if;
  if v_req.status not in ('identity_verified', 'processing') then
    raise exception 'invalid_state: the requester''s identity must be verified first (status is %)', v_req.status;
  end if;
  select * into v_learner from public.learners where id = v_req.subject_learner_id for update;
  if v_learner.id is null then raise exception 'not_found: learner'; end if;
  if p_confirm_learner_number is distinct from v_learner.learner_number then
    raise exception 'invalid_argument: confirmation does not match the learner number';
  end if;

  -- Documents and uploaded files: collect storage paths, then remove rows.
  select coalesce(array_agg(file_url), array[]::text[]) into v_paths from public.learner_documents where learner_id = v_learner.id;
  update public.learner_documents set active = false, notes = null, file_name = '[erased]' where learner_id = v_learner.id;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('documents_deactivated', n);
  v_paths := v_paths || coalesce((select array_agg(storage_path) from public.assignment_submission_files where learner_id = v_learner.id), array[]::text[]);
  delete from public.assignment_submission_files where learner_id = v_learner.id;

  -- Special-category and contact data: deleted outright.
  delete from public.learner_medical_information where learner_id = v_learner.id;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('medical_records_deleted', n);
  delete from public.learner_emergency_contacts where learner_id = v_learner.id;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('emergency_contacts_deleted', n);

  -- Free text written about or by the child. Report cards and submissions are
  -- workflow-protected tables; the erasure is a sanctioned writer.
  perform set_config('app.allow_report_card_write', 'true', true);
  perform set_config('app.allow_submission_write', 'true', true);
  update public.behaviour_incidents set description = '[erased]', action_taken = null, outcome = null, follow_up_notes = null where learner_id = v_learner.id;
  update public.assignment_submissions set submission_text = null, teacher_feedback = null where learner_id = v_learner.id;
  update public.report_cards set learner_name = 'Erased learner', class_teacher_comment = null, principal_comment = null, conduct_summary = null where learner_id = v_learner.id;
  update public.attendance_records set notes = null where learner_id = v_learner.id;
  if v_learner.profile_id is not null then
    update public.messages set body = '[erased]' where sender_profile_id = v_learner.profile_id;
  end if;

  -- Guardian links end; the learner row itself is pseudonymised.
  update public.learner_guardians set active = false, custody_notes = null where learner_id = v_learner.id;
  update public.learners set
    first_name = 'Erased', last_name = 'Learner', preferred_name = null, gender = null, id_number = null,
    passport_number = null, passport_country = null, nationality = null, home_language = null,
    additional_languages = null, photo_url = null, transport_notes = null, status_reason = null,
    date_of_birth = make_date(extract(year from v_learner.date_of_birth)::int, 1, 1),
    profile_id = null
  where id = v_learner.id;

  -- Learner login: deactivate, strip names, block sign-in.
  if v_learner.profile_id is not null then
    update public.profiles set first_name = 'Erased', last_name = 'Learner', phone = null, avatar_url = null, status = 'inactive'
      where id = v_learner.profile_id;
    if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'banned_until') then
      execute 'update auth.users set banned_until = ''infinity'' where id = $1' using v_learner.profile_id;
    end if;
    update auth.users set raw_user_meta_data = '{}'::jsonb where id = v_learner.profile_id;
  end if;

  -- Redact PII copies held in the audit trail (the trail itself is kept).
  update public.audit_log
    set before = case when before is null then null else jsonb_build_object('redacted', true, 'reason', 'learner erasure ' || v_req.id) end,
        after  = case when after  is null then null else jsonb_build_object('redacted', true, 'reason', 'learner erasure ' || v_req.id) end
    where entity_id = v_learner.id
       or entity_id = v_learner.profile_id
       or before ->> 'learner_id' = v_learner.id::text
       or after ->> 'learner_id' = v_learner.id::text;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('audit_entries_redacted', n);

  update public.data_subject_requests
    set status = 'completed', completed_at = now(), handled_by = auth.uid(),
        outcome_notes = 'Learner erased. Statutory attendance, financial and safeguarding records retained in pseudonymised form under legal obligation.'
    where id = v_req.id;

  perform public.write_access_log(v_learner.id, 'erasure', 'Right-to-erasure executed for request ' || v_req.id);
  perform public.write_audit_log(v_req.school_id, auth.uid(), 'learner_erased', 'learners', v_learner.id, null,
    v_counts || jsonb_build_object('request_id', v_req.id, 'files_to_remove', cardinality(v_paths)));

  return jsonb_build_object('learner_id', v_learner.id, 'summary', v_counts, 'storage_paths', to_jsonb(v_paths));
end $$;

-- ============================================================================
-- §10 CIPA safe-content policy
-- ============================================================================

create table public.content_safety_rules (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid references public.schools (id) on delete cascade,
  category    text not null check (category in ('adult', 'gambling', 'violence', 'self_harm', 'bullying', 'drugs', 'hate', 'custom')),
  pattern     text not null check (char_length(pattern) between 2 and 500),
  action      text not null check (action in ('block', 'flag')),
  description text,
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.content_safety_rules is
  'CIPA safe-content rules. school_id NULL = platform baseline (applies to every school, editable only by platform admins). Patterns are case-insensitive PostgreSQL regular expressions. block = the write is rejected; flag = the write is kept and a content_safety_events row is raised for review (self_harm/violence flags also alert the school''s owner and principal).';

create index content_safety_rules_school_idx on public.content_safety_rules (school_id) where active;

insert into public.content_safety_rules (school_id, category, pattern, action, description) values
  (null, 'adult',     '\m(porn|porno|pornhub|xvideos|xnxx|xhamster|onlyfans|hentai|redtube|youporn)\M', 'block', 'Adult content and adult-site links'),
  (null, 'gambling',  '\m(bet365|betway|hollywoodbets|sportingbet|pokerstars|supabets|1xbet)\M', 'block', 'Gambling operators'),
  (null, 'self_harm', '\m(kill myself|killing myself|suicide|suicidal|self[- ]harm|cut myself|want to die|end my life)\M', 'flag', 'Possible self-harm risk — routed to safeguarding'),
  (null, 'violence',  '\m(bring a (gun|knife) to school|shoot up the school|bomb the school|shoot everyone)\M', 'flag', 'Threat of violence — routed to safeguarding'),
  (null, 'bullying',  '\m(kill yourself|kys|go die)\M', 'flag', 'Bullying / incitement'),
  (null, 'drugs',     '\m(buy weed|dagga for sale|selling drugs|buy drugs)\M', 'flag', 'Drug dealing');

create table public.content_safety_events (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools (id) on delete cascade,
  rule_id       uuid references public.content_safety_rules (id) on delete set null,
  category      text not null,
  action        text not null,
  source_table  text not null,
  source_id     uuid,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  excerpt       text,
  status        text not null default 'open' check (status in ('open', 'reviewed_no_action', 'escalated', 'resolved')),
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  review_notes  text,
  created_at    timestamptz not null default now()
);

create index content_safety_events_school_idx on public.content_safety_events (school_id, status, created_at desc);

create or replace function public.match_content_safety(p_school_id uuid, p_text text)
returns public.content_safety_rules
language sql stable security definer set search_path = public
as $$
  select r.* from public.content_safety_rules r
  where r.active and (r.school_id is null or r.school_id = p_school_id)
    and p_text ~* r.pattern
  order by (r.action = 'block') desc, r.school_id nulls last
  limit 1
$$;

create or replace function public.enforce_content_safety()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_text text := '';
  v_old_text text := '';
  v_col text;
  v_rule public.content_safety_rules;
  v_event uuid;
  v_recipient record;
begin
  if not (public.compliance_settings(new.school_id)).content_filter_enabled then return new; end if;
  foreach v_col in array tg_argv loop
    v_text := v_text || ' ' || coalesce(to_jsonb(new) ->> v_col, '');
    if tg_op = 'UPDATE' then v_old_text := v_old_text || ' ' || coalesce(to_jsonb(old) ->> v_col, ''); end if;
  end loop;
  if tg_op = 'UPDATE' and v_text = v_old_text then return new; end if;
  if btrim(v_text) = '' then return new; end if;

  v_rule := public.match_content_safety(new.school_id, v_text);
  if v_rule.id is null then return new; end if;

  if v_rule.action = 'block' then
    raise exception 'content_blocked: this content was blocked by the school''s safe-content policy (%)', v_rule.category
      using errcode = 'check_violation';
  end if;

  insert into public.content_safety_events (school_id, rule_id, category, action, source_table, source_id, actor_profile_id, excerpt)
  values (new.school_id, v_rule.id, v_rule.category, v_rule.action, tg_table_name, (to_jsonb(new) ->> 'id')::uuid, auth.uid(), left(btrim(v_text), 280))
  returning id into v_event;

  if v_rule.category in ('self_harm', 'violence') then
    for v_recipient in
      select id from public.profiles where tenant_id = new.school_id and status = 'active' and role in ('school_owner', 'principal')
    loop
      perform public.create_notification(v_recipient.id, 'safeguarding_content_flag',
        'Safe-content alert: ' || replace(v_rule.category, '_', ' '),
        'Content matching the ' || replace(v_rule.category, '_', ' ') || ' policy was posted and needs review.',
        new.school_id, 'content_safety_events', v_event, '/compliance');
    end loop;
  end if;
  return new;
end $$;

create trigger messages_content_safety before insert or update on public.messages
  for each row execute function public.enforce_content_safety('body');
create trigger announcements_content_safety before insert or update on public.announcements
  for each row execute function public.enforce_content_safety('title', 'body');
create trigger assignments_content_safety before insert or update on public.assignments
  for each row execute function public.enforce_content_safety('title', 'instructions');
create trigger assignment_submissions_content_safety before insert or update on public.assignment_submissions
  for each row execute function public.enforce_content_safety('submission_text');
create trigger assignment_resources_content_safety before insert or update on public.assignment_resources
  for each row execute function public.enforce_content_safety('label', 'url');

-- Upload safety: executable / script / active-content file types are never
-- accepted, whatever the bucket, and declared MIME types must be on the
-- document/image allowlist.
create or replace function public.is_safe_upload(p_name text, p_mime text)
returns boolean language sql immutable
as $$
  select coalesce(lower(p_name), '') !~ '\.(exe|bat|cmd|com|scr|pif|msi|dll|jar|js|mjs|vbs|vbe|wsf|ps1|psm1|sh|bash|php|py|rb|pl|html?|xhtml|svg|svgz|hta|apk|ipa|iso|dmg|lnk|reg)$'
     and (p_mime is null or lower(p_mime) ~ '^(application/pdf|image/(png|jpeg|gif|webp)|text/(plain|csv)|application/(msword|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.[a-z.]+|vnd\.oasis\.opendocument\.[a-z.]+|rtf))$')
$$;

-- Trigger arguments: (path column, mime column or '', optional second name column).
create or replace function public.enforce_safe_upload()
returns trigger language plpgsql set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_mime text := case when tg_nargs > 1 and tg_argv[1] <> '' then v_row ->> tg_argv[1] else null end;
begin
  if not public.is_safe_upload(v_row ->> tg_argv[0], v_mime)
     or (tg_nargs > 2 and not public.is_safe_upload(v_row ->> tg_argv[2], null)) then
    raise exception 'unsafe_upload: this file type is not permitted by the school''s safe-content policy'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger message_attachments_safe_upload before insert or update on public.message_attachments
  for each row execute function public.enforce_safe_upload('storage_path', 'mime_type');
create trigger assignment_submission_files_safe_upload before insert or update on public.assignment_submission_files
  for each row execute function public.enforce_safe_upload('storage_path', 'mime_type');
create trigger assignment_resources_safe_upload before insert or update on public.assignment_resources
  for each row execute function public.enforce_safe_upload('storage_path', 'mime_type');
create trigger admission_application_documents_safe_upload before insert or update on public.admission_application_documents
  for each row execute function public.enforce_safe_upload('storage_path', 'mime_type');
create trigger learner_documents_safe_upload before insert or update on public.learner_documents
  for each row execute function public.enforce_safe_upload('file_url', '', 'file_name');

-- Storage-level limits for the buckets created without any (audit S7).
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  where id = 'message-attachments';
update storage.buckets set file_size_limit = 26214400,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain', 'text/csv',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
  where id = 'assignment-files';
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg']
  where id = 'admission-documents';

create or replace function public.review_content_safety_event(p_event_id uuid, p_status text, p_notes text default null)
returns public.content_safety_events
language plpgsql security definer set search_path = public
as $$
declare r public.content_safety_events;
begin
  select * into r from public.content_safety_events where id = p_event_id for update;
  if r.id is null then raise exception 'not_found'; end if;
  if not public.is_compliance_officer(r.school_id) then raise exception 'insufficient_privilege'; end if;
  if p_status not in ('reviewed_no_action', 'escalated', 'resolved') then raise exception 'invalid_argument'; end if;
  update public.content_safety_events set status = p_status, review_notes = p_notes, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_event_id returning * into r;
  perform public.write_audit_log(r.school_id, auth.uid(), 'content_safety_event_' || p_status, 'content_safety_events', r.id, null,
    jsonb_build_object('category', r.category, 'notes', p_notes));
  return r;
end $$;

create or replace function public.upsert_content_safety_rule(
  p_school_id uuid, p_category text, p_pattern text, p_action text, p_description text default null,
  p_active boolean default true, p_rule_id uuid default null
) returns public.content_safety_rules
language plpgsql security definer set search_path = public
as $$
declare r public.content_safety_rules; v_target uuid;
begin
  if p_rule_id is not null then
    select school_id into v_target from public.content_safety_rules where id = p_rule_id;
    if not found then raise exception 'not_found'; end if;
  else
    v_target := p_school_id;
  end if;
  if v_target is null then
    if not public.is_platform_admin() then raise exception 'insufficient_privilege: platform baseline rules are platform-managed'; end if;
  elsif not public.is_compliance_officer(v_target) then
    raise exception 'insufficient_privilege';
  end if;
  perform 'x' ~* p_pattern; -- rejects an invalid regular expression before it can break every write
  if p_rule_id is null then
    insert into public.content_safety_rules (school_id, category, pattern, action, description, active, created_by)
    values (v_target, p_category, p_pattern, p_action, p_description, p_active, auth.uid()) returning * into r;
  else
    update public.content_safety_rules set category = p_category, pattern = p_pattern, action = p_action,
      description = p_description, active = p_active where id = p_rule_id returning * into r;
  end if;
  perform public.write_audit_log(v_target, auth.uid(), 'content_safety_rule_saved', 'content_safety_rules', r.id, null, to_jsonb(r));
  return r;
end $$;

-- ============================================================================
-- §11 Comprehensive modification audit on every student-data table
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'learners', 'learner_enrollments', 'learner_guardians', 'learner_emergency_contacts', 'learner_medical_information',
    'learner_documents', 'attendance_records', 'assessment_results', 'behaviour_incidents', 'learner_fee_charges',
    'learner_fee_payments', 'learner_transfers', 'academic_interventions', 'report_cards', 'assignment_submissions',
    'guardian_profile_details', 'record_amendment_requests', 'data_subject_requests', 'transport_assignments', 'boarding_allocations'
  ] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_trigger where tgrelid = ('public.' || t)::regclass and tgname = t || '_audit_log') then
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_log_from_trigger()', t || '_audit_log', t);
    end if;
  end loop;
end $$;

-- Compliance officers may read the full trail; widen the existing policy
-- only by making the officer set explicit (unchanged semantics).
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select to authenticated using (
    (school_id is not null and public.is_compliance_officer(school_id)) or public.is_platform_admin()
  );

-- ============================================================================
-- §12 Data minimisation — profile directory scoping (audit P1-3)
-- ============================================================================
--
-- Staff keep the tenant-wide directory. Guardians and learners now see only:
-- themselves, school staff, their own children (and a learner's guardians),
-- and people they share a conversation with.

create or replace function public.profile_visible_to_family(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.employees e where e.profile_id = p_profile_id and e.school_id = public.current_tenant_id())
      or exists (select 1 from public.profiles p where p.id = p_profile_id and p.role not in ('parent', 'guardian', 'learner'))
      or exists (select 1 from public.learners l where l.profile_id = p_profile_id and (public.is_learner_guardian(l.id) or l.profile_id = auth.uid()))
      or exists (
        select 1 from public.learner_guardians mine
        join public.learner_guardians theirs on theirs.learner_id = mine.learner_id and theirs.active
        where mine.active and mine.guardian_profile_id = auth.uid() and theirs.guardian_profile_id = p_profile_id)
      or exists (
        select 1 from public.learners me join public.learner_guardians g on g.learner_id = me.id and g.active
        where me.profile_id = auth.uid() and g.guardian_profile_id = p_profile_id)
      or exists (
        select 1 from public.conversation_participants mine
        join public.conversation_participants theirs on theirs.conversation_id = mine.conversation_id
        where mine.profile_id = auth.uid() and theirs.profile_id = p_profile_id)
$$;

drop policy if exists profiles_select_own_or_tenant_or_platform_admin on public.profiles;
create policy profiles_select_own_or_tenant_or_platform_admin on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.is_platform_admin()
    or (tenant_id = public.current_tenant_id() and (not public.is_family_role() or public.profile_visible_to_family(id)))
  );

-- ============================================================================
-- §13 Compliance overview (Trust Center, regulator report, family view)
-- ============================================================================

create or replace function public.get_compliance_overview(p_school_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth
as $$
declare
  s public.school_compliance_settings;
  v_minors int; v_under_coppa int; v_coppa_consented int; v_core_decided int;
  v_admins int; v_admins_mfa int := 0;
  v_learners int;
begin
  if not public.is_compliance_officer(p_school_id) then raise exception 'insufficient_privilege'; end if;
  s := public.compliance_settings(p_school_id);

  select count(*),
         count(*) filter (where public.learner_age_years(id) < 18),
         count(*) filter (where public.learner_age_years(id) < s.coppa_consent_age),
         count(*) filter (where public.learner_age_years(id) < s.coppa_consent_age and public.learner_has_consent(id, 'online_learner_account')),
         count(*) filter (where public.learner_consent_decision(id, 'core_educational_processing') is not null)
    into v_learners, v_minors, v_under_coppa, v_coppa_consented, v_core_decided
    from public.learners where school_id = p_school_id and status in ('accepted', 'enrolled', 'active', 'suspended');

  select count(*) into v_admins from public.profiles
    where tenant_id = p_school_id and status = 'active' and role in ('school_owner', 'principal', 'finance_manager', 'accountant', 'hr_manager');
  if to_regclass('auth.mfa_factors') is not null then
    execute 'select count(distinct p.id) from public.profiles p join auth.mfa_factors f on f.user_id = p.id and f.status = ''verified''
             where p.tenant_id = $1 and p.status = ''active'' and p.role in (''school_owner'',''principal'',''finance_manager'',''accountant'',''hr_manager'')'
      into v_admins_mfa using p_school_id;
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'school', (select jsonb_build_object('id', id, 'name', name) from public.schools where id = p_school_id),
    'settings', to_jsonb(s),
    'learners', jsonb_build_object('active', v_learners, 'minors', v_minors, 'under_coppa_age', v_under_coppa,
      'under_coppa_with_online_consent', v_coppa_consented, 'core_processing_decided', v_core_decided,
      'online_accounts_without_consent', (select count(*) from public.learners l where l.school_id = p_school_id and l.profile_id is not null and not public.learner_online_consent_satisfied(l.id))),
    'consents', jsonb_build_object(
      'granted', (select count(*) from public.parental_consents where school_id = p_school_id and decision = 'granted'),
      'refused', (select count(*) from public.parental_consents where school_id = p_school_id and decision = 'refused'),
      'withdrawn', (select count(*) from public.parental_consents where school_id = p_school_id and decision = 'withdrawn')),
    'dsar', jsonb_build_object(
      'open', (select count(*) from public.data_subject_requests where school_id = p_school_id and status not in ('completed', 'rejected')),
      'overdue', (select count(*) from public.data_subject_requests where school_id = p_school_id and status not in ('completed', 'rejected') and due_at < now()),
      'completed_90d', (select count(*) from public.data_subject_requests where school_id = p_school_id and status = 'completed' and completed_at > now() - interval '90 days')),
    'amendments', jsonb_build_object(
      'open', (select count(*) from public.record_amendment_requests where school_id = p_school_id and status in ('submitted', 'under_review', 'hearing_requested')),
      'overdue', (select count(*) from public.record_amendment_requests where school_id = p_school_id and status in ('submitted', 'under_review') and due_by < current_date),
      'hearings_requested', (select count(*) from public.record_amendment_requests where school_id = p_school_id and status = 'hearing_requested')),
    'disclosures_90d', (select count(*) from public.record_disclosures where school_id = p_school_id and disclosed_at > now() - interval '90 days'),
    'access_events_30d', (select count(*) from public.student_record_access_log where school_id = p_school_id and created_at > now() - interval '30 days'),
    'audit_events_30d', (select count(*) from public.audit_log where school_id = p_school_id and created_at > now() - interval '30 days'),
    'content_safety', jsonb_build_object(
      'active_rules', (select count(*) from public.content_safety_rules where active and (school_id is null or school_id = p_school_id)),
      'open_events', (select count(*) from public.content_safety_events where school_id = p_school_id and status = 'open'),
      'events_30d', (select count(*) from public.content_safety_events where school_id = p_school_id and created_at > now() - interval '30 days')),
    'mfa', jsonb_build_object('privileged_accounts', v_admins, 'privileged_with_mfa', v_admins_mfa),
    'rls', jsonb_build_object(
      'tables', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'),
      'forced', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relforcerowsecurity))
  );
end $$;

create or replace function public.update_compliance_settings(
  p_school_id uuid, p_frameworks text[], p_coppa_consent_age integer, p_gdpr_digital_consent_age integer,
  p_ferpa_amendment_response_days integer, p_dsar_response_days integer, p_content_filter_enabled boolean,
  p_information_officer_name text, p_information_officer_email text, p_privacy_notice_version text
) returns public.school_compliance_settings
language plpgsql security definer set search_path = public
as $$
declare r public.school_compliance_settings; v_before jsonb;
begin
  if not public.is_compliance_officer(p_school_id) then raise exception 'insufficient_privilege'; end if;
  v_before := to_jsonb(public.compliance_settings(p_school_id));
  insert into public.school_compliance_settings as t (school_id, frameworks, coppa_consent_age, gdpr_digital_consent_age,
      ferpa_amendment_response_days, dsar_response_days, content_filter_enabled, information_officer_name,
      information_officer_email, privacy_notice_version, updated_by, updated_at)
  values (p_school_id, p_frameworks, p_coppa_consent_age, p_gdpr_digital_consent_age, p_ferpa_amendment_response_days,
      p_dsar_response_days, p_content_filter_enabled, nullif(trim(p_information_officer_name), ''),
      nullif(trim(p_information_officer_email), ''), p_privacy_notice_version, auth.uid(), now())
  on conflict (school_id) do update set
      frameworks = excluded.frameworks, coppa_consent_age = excluded.coppa_consent_age,
      gdpr_digital_consent_age = excluded.gdpr_digital_consent_age,
      ferpa_amendment_response_days = excluded.ferpa_amendment_response_days,
      dsar_response_days = excluded.dsar_response_days, content_filter_enabled = excluded.content_filter_enabled,
      information_officer_name = excluded.information_officer_name, information_officer_email = excluded.information_officer_email,
      privacy_notice_version = excluded.privacy_notice_version, updated_by = auth.uid(), updated_at = now()
  returning * into r;
  perform public.write_audit_log(p_school_id, auth.uid(), 'compliance_settings_updated', 'school_compliance_settings', p_school_id, v_before, to_jsonb(r));
  return r;
end $$;

-- Family view: consent state + open requests for each linked child.
create or replace function public.get_my_privacy_overview()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_school uuid;
begin
  v_school := public.current_tenant_id();
  if v_school is null then raise exception 'insufficient_privilege'; end if;
  return jsonb_build_object(
    'settings', (select jsonb_build_object('coppa_consent_age', s.coppa_consent_age, 'gdpr_digital_consent_age', s.gdpr_digital_consent_age,
                   'privacy_notice_version', s.privacy_notice_version, 'frameworks', s.frameworks,
                   'information_officer_name', s.information_officer_name, 'information_officer_email', s.information_officer_email)
                 from (select (public.compliance_settings(v_school)).*) s),
    'children', coalesce((select jsonb_agg(jsonb_build_object(
        'learner_id', l.id, 'name', l.first_name || ' ' || l.last_name, 'age', public.learner_age_years(l.id),
        'under_coppa_age', public.learner_under_coppa_age(l.id),
        'has_online_account', l.profile_id is not null,
        'consents', (select jsonb_object_agg(pur, public.learner_consent_decision(l.id, pur))
                     from unnest(array['core_educational_processing', 'online_learner_account', 'directory_information', 'third_party_sharing', 'photo_media_use']) pur),
        'open_amendments', (select count(*) from public.record_amendment_requests a where a.learner_id = l.id and a.status in ('submitted', 'under_review', 'hearing_requested')),
        'open_requests', (select count(*) from public.data_subject_requests d where d.subject_learner_id = l.id and d.status not in ('completed', 'rejected'))
      ) order by l.first_name)
      from public.learners l
      where exists (select 1 from public.learner_guardians g where g.learner_id = l.id and g.guardian_profile_id = auth.uid() and g.active)
         or l.profile_id = auth.uid()), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(d) - 'handled_by' order by d.requested_at desc)
      from public.data_subject_requests d where d.requested_by = auth.uid() or d.subject_profile_id = auth.uid()), '[]'::jsonb),
    'amendments', coalesce((select jsonb_agg(to_jsonb(a) - 'decided_by' order by a.created_at desc)
      from public.record_amendment_requests a where a.requested_by = auth.uid() or public.is_learner_guardian(a.learner_id)), '[]'::jsonb)
  );
end $$;

-- ============================================================================
-- RLS for the new tables (all FORCE; writes are RPC-only)
-- ============================================================================

alter table public.school_compliance_settings enable row level security;
alter table public.school_compliance_settings force row level security;
alter table public.parental_consents enable row level security;
alter table public.parental_consents force row level security;
alter table public.student_record_access_log enable row level security;
alter table public.student_record_access_log force row level security;
alter table public.record_amendment_requests enable row level security;
alter table public.record_amendment_requests force row level security;
alter table public.record_disclosures enable row level security;
alter table public.record_disclosures force row level security;
alter table public.content_safety_rules enable row level security;
alter table public.content_safety_rules force row level security;
alter table public.content_safety_events enable row level security;
alter table public.content_safety_events force row level security;

create policy school_compliance_settings_select on public.school_compliance_settings
  for select to authenticated using (school_id = public.current_tenant_id() or public.is_platform_admin());

create policy parental_consents_select on public.parental_consents
  for select to authenticated using (
    public.can_view_learners(school_id) or public.is_learner_guardian(learner_id) or public.is_learner_self(learner_id)
  );

create policy student_record_access_log_select on public.student_record_access_log
  for select to authenticated using (
    public.is_compliance_officer(school_id) or public.is_learner_guardian(learner_id) or public.is_learner_self(learner_id)
  );

create policy record_amendment_requests_select on public.record_amendment_requests
  for select to authenticated using (
    public.can_view_learners(school_id) or public.is_learner_guardian(learner_id) or requested_by = auth.uid()
  );

create policy record_disclosures_select on public.record_disclosures
  for select to authenticated using (
    public.can_view_learners(school_id) or public.is_learner_guardian(learner_id) or public.is_learner_self(learner_id)
  );

create policy content_safety_rules_select on public.content_safety_rules
  for select to authenticated using (
    (school_id is null and (public.current_tenant_id() is not null or public.is_platform_admin()))
    or public.is_compliance_officer(school_id)
  );

create policy content_safety_events_select on public.content_safety_events
  for select to authenticated using (public.is_compliance_officer(school_id));

-- ============================================================================
-- §14 Grants
-- ============================================================================

-- Internal helpers: never callable from the API.
revoke execute on function public.write_access_log(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.enforce_learner_account_consent() from public, anon, authenticated;
revoke execute on function public.enforce_learner_profile_consent() from public, anon, authenticated;
revoke execute on function public.enforce_child_content_consent() from public, anon, authenticated;
revoke execute on function public.enforce_content_safety() from public, anon, authenticated;
revoke execute on function public.enforce_safe_upload() from public, anon, authenticated;
revoke execute on function public.match_content_safety(uuid, text) from public, anon;
revoke execute on function public.compliance_settings(uuid) from public, anon;

-- Helpers used inside RLS policies: authenticated only.
do $$
declare f text;
begin
  foreach f in array array[
    'public.jwt_role()', 'public.is_family_role()', 'public.is_compliance_officer(uuid)', 'public.learner_age_years(uuid)',
    'public.learner_under_coppa_age(uuid)', 'public.learner_consent_decision(uuid, text)', 'public.learner_has_consent(uuid, text)',
    'public.learner_online_consent_satisfied(uuid)', 'public.can_access_learner_record(uuid)', 'public.profile_visible_to_family(uuid)',
    'public.is_safe_upload(text, text)', 'public.match_content_safety(uuid, text)', 'public.compliance_settings(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Client-facing RPCs.
do $$
declare f text;
begin
  foreach f in array array[
    'public.record_parental_consent(uuid, text, text, text, text)',
    'public.log_learner_record_access(uuid, text, text)',
    'public.submit_record_amendment(uuid, text, text, text, text, text)',
    'public.decide_record_amendment(uuid, text, text)',
    'public.respond_to_amendment_denial(uuid, boolean, text)',
    'public.record_disclosure(uuid, text, text, text, text[])',
    'public.create_data_subject_request(uuid, uuid, uuid, text, text)',
    'public.get_learner_record_package(uuid)',
    'public.get_learner_privacy_history(uuid)',
    'public.execute_learner_erasure(uuid, text)',
    'public.review_content_safety_event(uuid, text, text)',
    'public.upsert_content_safety_rule(uuid, text, text, text, text, boolean, uuid)',
    'public.get_compliance_overview(uuid)',
    'public.update_compliance_settings(uuid, text[], integer, integer, integer, integer, boolean, text, text, text)',
    'public.get_my_privacy_overview()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Audit finding S-list: SECURITY DEFINER helpers that were anon-executable.
revoke execute on function public.can_message_profile(uuid) from public, anon;
revoke execute on function public.is_learner_self(uuid) from public, anon;
revoke execute on function public.is_conversation_participant(uuid) from public, anon;
revoke execute on function public.get_guardian_visible_behaviour_incidents(uuid) from public, anon;
revoke execute on function public.admin_create_guardian(text, text, text, text, uuid, text, text) from public, anon;
grant execute on function public.can_message_profile(uuid) to authenticated;
grant execute on function public.is_learner_self(uuid) to authenticated;
grant execute on function public.is_conversation_participant(uuid) to authenticated;
grant execute on function public.get_guardian_visible_behaviour_incidents(uuid) to authenticated;
grant execute on function public.admin_create_guardian(text, text, text, text, uuid, text, text) to authenticated;
