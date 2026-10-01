-- Funda360 curriculum review workflow. Additive: no table is dropped; three functions are replaced by stricter versions.
-- Design: docs/verification/review-workflow.md.
--
-- Purpose: let a curriculum specialist do the human verification work inside the product, and make it hard for software,
-- AI or an administrator to pretend it happened.
--
--   * sources:  retrieval evidence comes from the output of docs/sources/verify-dbe-sources.sh (parsed server-side, tied to the
--               registered URL, dated by the server), identity / document / licence reviews are recorded decisions, and a recorded
--               checksum can only change through an explicit, audited correction that resets every later step.
--   * content:  one append-only table of review decisions for objectives, lessons, resources, practice checks, questions and the
--               formal assessment; findings for anything a reviewer flags; open questions with evidence rules.
--   * rule:     curriculum_review_compute() is the single deterministic definition of "review complete". Versions that use the
--               workflow (review_workflow = true, the default for every new version) cannot be approved, published, or used for
--               AI drafting unless it holds.
--
-- Three different things stay separate: source evidence (is the document what we think it is), curriculum review (does a unit
-- match the document) and the content lifecycle (draft, review, approved, published, retired). "Reviewed" never means "approved".

-- ---------------------------------------------------------------------------
-- 1. Versions: opt in to the workflow. New versions are in it by default; versions that existed before this migration are not.
-- ---------------------------------------------------------------------------

alter table public.curriculum_versions add column review_workflow boolean not null default false;
alter table public.curriculum_versions alter column review_workflow set default true;
comment on column public.curriculum_versions.review_workflow is 'true: the version cannot be approved, published or drafted against by AI until curriculum_review_compute() says the review is complete. Versions that existed before the review workflow are false (legacy). It can only be switched on, never off, through the API.';

create or replace function public.curriculum_review_workflow_lock()
returns trigger language plpgsql as $$
begin
  if old.review_workflow and not new.review_workflow and session_user in ('authenticator', 'anon', 'authenticated', 'service_role') then
    raise exception 'insufficient_privilege: a curriculum version cannot leave the review workflow';
  end if;
  return new;
end $$;
create trigger curriculum_versions_review_workflow_lock before update of review_workflow on public.curriculum_versions
  for each row execute function public.curriculum_review_workflow_lock();

-- ---------------------------------------------------------------------------
-- 2. Sources: fuller registration, retrieval evidence, reviews
-- ---------------------------------------------------------------------------

alter table public.curriculum_sources
  add column jurisdiction            text,
  add column subject                 text,
  add column grade_phase             text,
  add column alternate_urls          text[] not null default '{}',
  add column isbn                    text,
  add column licence_status          text not null default 'unreviewed' check (licence_status in ('unreviewed', 'permitted', 'restricted', 'not_permitted')),
  add column licence_reviewed_by     uuid references public.profiles (id) on delete set null,
  add column licence_reviewed_at     timestamptz,
  add column licence_review_note     text,
  add column retrieval_status        text not null default 'not_attempted' check (retrieval_status in ('not_attempted', 'retrieved', 'inaccessible', 'not_a_pdf')),
  add column retrieval_size_bytes    bigint check (retrieval_size_bytes is null or retrieval_size_bytes > 0),
  add column retrieval_content_type  text,
  add column retrieval_final_url     text,
  add column retrieval_redirects     integer check (retrieval_redirects is null or retrieval_redirects >= 0),
  add column retrieval_record        text,
  add column retrieval_recorded_by   uuid references public.profiles (id) on delete set null,
  add column retrieval_recorded_at   timestamptz;
comment on column public.curriculum_sources.retrieval_record is 'The RECORD line printed by docs/sources/verify-dbe-sources.sh, kept verbatim so anyone can re-run the script and compare.';
comment on column public.curriculum_sources.licence_status is 'unreviewed | permitted | restricted | not_permitted. Set only by a person through record_source_review(kind => licence).';

-- Append-only history of every human decision about a source (identity, document, licence) and of corrections.
create table public.curriculum_source_reviews (
  id          uuid primary key default gen_random_uuid(),
  source_id   uuid not null references public.curriculum_sources (id),
  kind        text not null check (kind in ('identity', 'document', 'licence', 'correction')),
  decision    text not null check (char_length(decision) between 3 and 40),
  notes       text not null check (char_length(btrim(notes)) >= 3),
  findings    text,
  checksum_at_review text,
  reviewer    uuid not null references public.profiles (id),
  reviewed_at timestamptz not null default clock_timestamp()
);
create index curriculum_source_reviews_source_idx on public.curriculum_source_reviews (source_id, reviewed_at);

create or replace function public.append_only_guard()
returns trigger language plpgsql as $$
begin
  raise exception 'invalid_state: % is append-only; add a new row instead of changing history', tg_table_name;
end $$;
create trigger curriculum_source_reviews_append_only before update or delete on public.curriculum_source_reviews
  for each row execute function public.append_only_guard();

-- The checksum of a retrieved file can only change through correct_source_evidence() (which sets the flag below).
create or replace function public.curriculum_sources_protect_evidence()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('funda360.source_correction', true), '') = 'on' then
    return new;
  end if;
  if old.checksum_sha256 is not null and new.checksum_sha256 is distinct from old.checksum_sha256 then
    raise exception 'invalid_state: a different checksum is already recorded for this source; use the correction workflow (it resets identity and document review)';
  end if;
  if old.checksum_sha256 is not null and new.retrieved_on is distinct from old.retrieved_on then
    raise exception 'invalid_state: the retrieval date cannot change once the checksum is recorded';
  end if;
  return new;
end $$;

-- Registration: a client can describe a source but can no longer hand over cryptographic evidence with it.
drop function public.register_curriculum_source(text, text, text, text, text, text, boolean, text, date, text);
create or replace function public.register_curriculum_source(
  p_title text, p_publisher text, p_doc_type text, p_licence text,
  p_url text default null, p_edition text default null, p_excerpts_permitted boolean default false,
  p_checksum_sha256 text default null, p_retrieved_on date default null, p_note text default null,
  p_jurisdiction text default null, p_subject text default null, p_grade_phase text default null,
  p_alternate_urls text[] default null, p_isbn text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; u text;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators register curriculum sources';
  end if;
  if p_checksum_sha256 is not null or p_retrieved_on is not null then
    raise exception 'invalid_argument: a checksum cannot be supplied at registration; record the retrieval with record_source_retrieval() from the output of verify-dbe-sources.sh';
  end if;
  foreach u in array coalesce(p_alternate_urls, '{}') loop
    if u !~ '^https://' then raise exception 'invalid_argument: alternate URLs must start with https://'; end if;
  end loop;
  insert into public.curriculum_sources (title, publisher, doc_type, licence, url, edition, excerpts_permitted, note, registered_by,
                                         jurisdiction, subject, grade_phase, alternate_urls, isbn)
  values (p_title, p_publisher, p_doc_type, p_licence, p_url, p_edition, coalesce(p_excerpts_permitted, false), p_note, auth.uid(),
          nullif(btrim(p_jurisdiction), ''), nullif(btrim(p_subject), ''), nullif(btrim(p_grade_phase), ''), coalesce(p_alternate_urls, '{}'), nullif(btrim(p_isbn), ''))
  returning id into v_id;
  perform public.write_audit_log(null, auth.uid(), 'curriculum_source_registered', 'curriculum_sources', v_id, null,
    jsonb_build_object('title', p_title, 'publisher', p_publisher, 'doc_type', p_doc_type, 'url', p_url, 'edition', p_edition));
  return v_id;
end $$;

-- Retrieval evidence. The caller pastes the RECORD line printed by docs/sources/verify-dbe-sources.sh. The server parses it,
-- refuses anything that is not a retrieved PDF with an HTTP success, requires the requested URL to be the one registered for
-- this source, and dates the retrieval itself. Whether the bytes are really the file at that URL is something only a person
-- re-running the script can confirm, which is why the line is kept verbatim.
create or replace function public.record_source_retrieval(p_source_id uuid, p_record text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_src    public.curriculum_sources;
  f        text[];
  v_state  text;
  v_size   bigint;
  v_status integer;
  v_red    integer;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators record source retrieval';
  end if;
  select * into v_src from public.curriculum_sources where id = p_source_id for update;
  if v_src.id is null then raise exception 'not_found: no source %', p_source_id; end if;
  if v_src.status = 'retired' then raise exception 'invalid_state: a retired source cannot take new evidence'; end if;

  f := string_to_array(btrim(coalesce(p_record, ''), E' \r\n'), E'\t');
  if coalesce(array_length(f, 1), 0) < 10 or f[1] <> 'RECORD' then
    raise exception 'invalid_argument: paste one RECORD line exactly as printed by docs/sources/verify-dbe-sources.sh (tab separated, 10 fields)';
  end if;
  v_state := f[3];
  if v_state not in ('retrieved', 'inaccessible', 'not-a-pdf') then
    raise exception 'invalid_argument: unknown retrieval state %', v_state;
  end if;
  if f[10] is distinct from v_src.url and not (f[10] = any (v_src.alternate_urls)) then
    raise exception 'invalid_argument: the requested URL in the record is not a registered location of this source';
  end if;
  v_status := case when f[4] ~ '^[0-9]+$' then f[4]::integer else 0 end;
  v_red    := case when f[5] ~ '^[0-9]+$' then f[5]::integer else 0 end;
  v_size   := case when f[6] ~ '^[0-9]+$' then f[6]::bigint else 0 end;

  if v_state <> 'retrieved' then
    if v_src.checksum_sha256 is null then
      update public.curriculum_sources
         set retrieval_status = case v_state when 'not-a-pdf' then 'not_a_pdf' else 'inaccessible' end,
             retrieval_record = p_record, retrieval_recorded_by = auth.uid(), retrieval_recorded_at = now(),
             retrieval_final_url = nullif(f[9], ''), retrieval_content_type = nullif(f[8], '-'), retrieval_redirects = v_red
       where id = p_source_id;
    end if;
    perform public.write_audit_log(null, auth.uid(), 'curriculum_source_retrieval_failed', 'curriculum_sources', p_source_id, null,
      jsonb_build_object('state', v_state, 'http_status', v_status, 'requested_url', f[10]));
    return;
  end if;

  if f[7] !~ '^[0-9a-f]{64}$' then raise exception 'invalid_argument: the record does not contain a SHA-256 of 64 lowercase hexadecimal characters'; end if;
  if v_status < 200 or v_status > 299 then raise exception 'invalid_argument: a retrieved file needs an HTTP success status'; end if;
  if v_size <= 0 then raise exception 'invalid_argument: a retrieved file has a size above zero'; end if;
  if f[9] !~ '^https://' then raise exception 'invalid_argument: the final URL must start with https://'; end if;
  if v_src.checksum_sha256 is not null and v_src.checksum_sha256 <> f[7] then
    raise exception 'invalid_state: a different checksum is already recorded for this source; use the correction workflow (it resets identity and document review)';
  end if;

  update public.curriculum_sources
     set checksum_sha256 = f[7], retrieved_on = coalesce(retrieved_on, current_date),
         retrieval_status = 'retrieved', retrieval_size_bytes = v_size, retrieval_content_type = nullif(f[8], '-'),
         retrieval_final_url = f[9], retrieval_redirects = v_red, retrieval_record = p_record,
         retrieval_recorded_by = auth.uid(), retrieval_recorded_at = now()
   where id = p_source_id;
  perform public.write_audit_log(null, auth.uid(), 'curriculum_source_retrieved', 'curriculum_sources', p_source_id, null,
    jsonb_build_object('sha256', f[7], 'size', v_size, 'final_url', f[9], 'requested_url', f[10], 'content_type', f[8]));
end $$;

-- The older entry point can no longer take a checksum from the client.
create or replace function public.record_source_evidence(
  p_source_id uuid, p_level text, p_sha256 text default null, p_on date default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_src public.curriculum_sources;
  v_actor uuid := auth.uid();
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators record source evidence';
  end if;
  select * into v_src from public.curriculum_sources where id = p_source_id for update;
  if v_src.id is null then raise exception 'not_found: no source %', p_source_id; end if;
  if v_src.status = 'retired' then raise exception 'invalid_state: a retired source cannot take new evidence'; end if;

  if p_level = 'indexed' then
    update public.curriculum_sources set indexed_on = coalesce(p_on, current_date) where id = p_source_id;
  elsif p_level = 'retrieved' then
    raise exception 'invalid_argument: retrieval evidence comes from the output of verify-dbe-sources.sh; use record_source_retrieval()';
  elsif p_level = 'content_reviewed' then
    raise exception 'invalid_argument: a document review is a decision with findings; use record_source_review(kind => document)';
  else
    raise exception 'invalid_argument: level must be indexed';
  end if;

  perform public.write_audit_log(null, v_actor, 'curriculum_source_' || p_level, 'curriculum_sources', p_source_id, null,
    jsonb_build_object('level', p_level, 'on', p_on, 'note', p_note));
end $$;

-- Identity, document and licence reviews: decisions with a reviewer, a date and notes. Each is appended to the source's history.
--   identity   verified | not_verified | needs_information     verified needs retrieved bytes and sets status = verified
--   document   reviewed | issues_found                          reviewed needs identity verified; issues_found needs findings
--   licence    permitted | restricted | not_permitted
create or replace function public.record_source_review(
  p_source_id uuid, p_kind text, p_decision text, p_notes text, p_findings text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_src   public.curriculum_sources;
  v_actor uuid := auth.uid();
  v_id    uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators review curriculum sources';
  end if;
  if char_length(btrim(coalesce(p_notes, ''))) < 3 then raise exception 'invalid_argument: notes are required for every source review'; end if;
  select * into v_src from public.curriculum_sources where id = p_source_id for update;
  if v_src.id is null then raise exception 'not_found: no source %', p_source_id; end if;
  if v_src.status = 'retired' then raise exception 'invalid_state: a retired source cannot be reviewed'; end if;

  if p_kind = 'identity' then
    if p_decision not in ('verified', 'not_verified', 'needs_information') then
      raise exception 'invalid_argument: identity decision must be verified, not_verified or needs_information';
    end if;
    if p_decision = 'verified' then
      if v_src.status <> 'registered' then raise exception 'invalid_state: source is not awaiting identity verification'; end if;
      if v_src.checksum_sha256 is null or v_src.retrieved_on is null then
        raise exception 'invalid_state: record the retrieval (verify-dbe-sources.sh output) first; identity cannot be verified without the actual bytes';
      end if;
      update public.curriculum_sources set status = 'verified', verified_by = v_actor, verified_at = now(), note = coalesce(p_notes, note) where id = p_source_id;
    end if;
  elsif p_kind = 'document' then
    if p_decision not in ('reviewed', 'issues_found') then
      raise exception 'invalid_argument: document decision must be reviewed or issues_found';
    end if;
    if v_src.status <> 'verified' then
      raise exception 'invalid_state: confirm the document''s identity first; a document cannot be reviewed before its identity is verified';
    end if;
    if p_decision = 'issues_found' and coalesce(btrim(p_findings), '') = '' then
      raise exception 'invalid_argument: describe the issues found';
    end if;
    if p_decision = 'reviewed' then
      update public.curriculum_sources set content_reviewed_by = v_actor, content_reviewed_at = now(), content_review_note = p_notes where id = p_source_id;
    end if;
  elsif p_kind = 'licence' then
    if p_decision not in ('permitted', 'restricted', 'not_permitted') then
      raise exception 'invalid_argument: licence decision must be permitted, restricted or not_permitted';
    end if;
    update public.curriculum_sources
       set licence_status = p_decision, licence_reviewed_by = v_actor, licence_reviewed_at = now(), licence_review_note = p_notes
     where id = p_source_id;
  else
    raise exception 'invalid_argument: kind must be identity, document or licence';
  end if;

  insert into public.curriculum_source_reviews (source_id, kind, decision, notes, findings, checksum_at_review, reviewer)
  values (p_source_id, p_kind, p_decision, p_notes, nullif(btrim(p_findings), ''), v_src.checksum_sha256, v_actor) returning id into v_id;
  perform public.write_audit_log(null, v_actor, 'curriculum_source_review_' || p_kind, 'curriculum_sources', p_source_id,
    jsonb_build_object('status', v_src.status), jsonb_build_object('kind', p_kind, 'decision', p_decision, 'notes', p_notes, 'findings', p_findings));
  return v_id;
end $$;

-- Explicit correction of recorded evidence. Clears the retrieval and every later step (identity, document review) so they must be
-- redone for the corrected bytes. The old values are kept in the append-only history and in the audit log.
create or replace function public.correct_source_evidence(p_source_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_src   public.curriculum_sources;
  v_actor uuid := auth.uid();
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators correct source evidence';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'invalid_argument: give the reason for the correction (at least 10 characters)';
  end if;
  select * into v_src from public.curriculum_sources where id = p_source_id for update;
  if v_src.id is null then raise exception 'not_found: no source %', p_source_id; end if;
  if v_src.checksum_sha256 is null then raise exception 'invalid_state: no retrieval evidence has been recorded for this source'; end if;

  perform set_config('funda360.source_correction', 'on', true);
  update public.curriculum_sources
     set checksum_sha256 = null, retrieved_on = null, status = case when status = 'verified' then 'registered' else status end,
         verified_by = null, verified_at = null, content_reviewed_by = null, content_reviewed_at = null, content_review_note = null,
         retrieval_status = 'not_attempted', retrieval_size_bytes = null, retrieval_content_type = null, retrieval_final_url = null,
         retrieval_redirects = null, retrieval_record = null, retrieval_recorded_by = null, retrieval_recorded_at = null
   where id = p_source_id;
  perform set_config('funda360.source_correction', '', true);

  insert into public.curriculum_source_reviews (source_id, kind, decision, notes, findings, checksum_at_review, reviewer)
  values (p_source_id, 'correction', 'evidence_cleared', p_reason, v_src.retrieval_record, v_src.checksum_sha256, v_actor);
  perform public.write_audit_log(null, v_actor, 'curriculum_source_evidence_corrected', 'curriculum_sources', p_source_id,
    jsonb_build_object('status', v_src.status, 'sha256', v_src.checksum_sha256, 'retrieved_on', v_src.retrieved_on),
    jsonb_build_object('reason', p_reason));
end $$;

-- verify_curriculum_source keeps working and now also leaves a row in the source history.
create or replace function public.verify_curriculum_source(p_source_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.record_source_review(p_source_id, 'identity', 'verified', coalesce(nullif(btrim(p_note), ''), 'Identity verified'));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Review decisions, findings, open questions, formal assessment details
-- ---------------------------------------------------------------------------

create table public.curriculum_reviews (
  id                   uuid primary key default gen_random_uuid(),
  seq                  bigint generated always as identity,
  version_id           uuid not null references public.curriculum_versions (id),
  entity_type          text not null check (entity_type in ('objective', 'lesson', 'resource', 'assessment', 'question', 'formal_assessment')),
  entity_id            uuid not null,
  decision             text not null check (decision in ('verified', 'accepted', 'needs_correction', 'rejected')),
  notes                text not null check (char_length(btrim(notes)) >= 3),
  source_id            uuid references public.curriculum_sources (id),
  source_section       text,
  source_page          text,
  previous_decision    text,
  content_fingerprint  text not null,
  reviewer             uuid not null references public.profiles (id),
  reviewed_at          timestamptz not null default clock_timestamp(),
  constraint curriculum_reviews_vocabulary check (
    (entity_type in ('objective', 'formal_assessment') and decision in ('verified', 'needs_correction', 'rejected'))
    or (entity_type in ('lesson', 'resource', 'assessment', 'question') and decision in ('accepted', 'needs_correction', 'rejected'))),
  constraint curriculum_reviews_positive_needs_source check (
    decision not in ('verified', 'accepted') or entity_type in ('lesson', 'resource', 'assessment', 'question')
    or (source_id is not null and char_length(btrim(coalesce(source_section, ''))) >= 2 and char_length(btrim(coalesce(source_page, ''))) >= 1))
);
create index curriculum_reviews_entity_idx on public.curriculum_reviews (version_id, entity_type, entity_id, reviewed_at);
create trigger curriculum_reviews_append_only before update or delete on public.curriculum_reviews
  for each row execute function public.append_only_guard();
comment on table public.curriculum_reviews is 'Append-only. One row per reviewer decision. The current decision of a unit is its latest row, and only counts while content_fingerprint still equals the unit''s present content.';

create table public.curriculum_review_findings (
  id               uuid primary key default gen_random_uuid(),
  version_id       uuid not null references public.curriculum_versions (id),
  entity_type      text not null check (entity_type in ('objective', 'lesson', 'resource', 'assessment', 'question', 'formal_assessment', 'open_question', 'source')),
  entity_id        uuid not null,
  category         text not null check (category in ('factual_error', 'curriculum_mismatch', 'age_suitability', 'language_issue', 'unclear_instruction',
                                                     'unsuitable_activity', 'incorrect_answer', 'low_resource_problem', 'assessment_problem', 'scope_question', 'other')),
  description      text not null check (char_length(btrim(description)) >= 3),
  status           text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  review_id        uuid references public.curriculum_reviews (id),
  raised_by        uuid not null references public.profiles (id),
  raised_at        timestamptz not null default now(),
  resolved_by      uuid references public.profiles (id),
  resolved_at      timestamptz,
  resolution_note  text,
  constraint curriculum_review_findings_resolution check (status = 'open' or (resolved_by is not null and char_length(btrim(coalesce(resolution_note, ''))) >= 3))
);
create index curriculum_review_findings_entity_idx on public.curriculum_review_findings (version_id, entity_type, entity_id, status);

create table public.curriculum_open_questions (
  id               uuid primary key default gen_random_uuid(),
  version_id       uuid not null references public.curriculum_versions (id),
  code             text not null check (code ~ '^Q[0-9]{1,2}$'),
  title            text not null,
  description      text not null,
  materially_affects_scope boolean not null default true,
  status           text not null default 'open' check (status in ('open', 'resolved', 'deferred')),
  answer           text,
  source_id        uuid references public.curriculum_sources (id),
  source_section   text,
  source_page      text,
  notes            text,
  resolved_by      uuid references public.profiles (id),
  resolved_at      timestamptz,
  unique (version_id, code),
  constraint curriculum_open_questions_resolved_needs_evidence check (
    status <> 'resolved' or (char_length(btrim(coalesce(answer, ''))) >= 3 and source_id is not null
      and char_length(btrim(coalesce(source_section, ''))) >= 2 and char_length(btrim(coalesce(source_page, ''))) >= 1
      and char_length(btrim(coalesce(notes, ''))) >= 3 and resolved_by is not null and resolved_at is not null)),
  constraint curriculum_open_questions_deferred_needs_reason check (
    status <> 'deferred' or (char_length(btrim(coalesce(notes, ''))) >= 3 and resolved_by is not null and resolved_at is not null))
);
comment on column public.curriculum_open_questions.materially_affects_scope is 'Set by the pack. A deferred question that materially affects scope blocks review completion; only resolving it with evidence unblocks it.';

create table public.curriculum_formal_assessment_details (
  id               uuid primary key default gen_random_uuid(),
  version_id       uuid not null references public.curriculum_versions (id),
  objective_id     uuid not null,
  status           text not null default 'pending' check (status in ('pending', 'recorded')),
  assessment_name  text,
  assessment_type  text,
  scope            text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  timing           text,
  marks            integer check (marks is null or marks > 0),
  weighting        text,
  instructions     text,
  source_id        uuid references public.curriculum_sources (id),
  source_section   text,
  source_page      text,
  notes            text,
  recorded_by      uuid references public.profiles (id),
  recorded_at      timestamptz,
  unique (version_id, objective_id),
  foreign key (objective_id, version_id) references public.curriculum_objectives (id, version_id),
  constraint curriculum_formal_details_recorded check (
    status = 'pending' or (char_length(btrim(coalesce(assessment_name, ''))) >= 3 and char_length(btrim(coalesce(assessment_type, ''))) >= 3
      and char_length(btrim(coalesce(scope, ''))) >= 3 and source_id is not null and char_length(btrim(coalesce(source_section, ''))) >= 2
      and char_length(btrim(coalesce(source_page, ''))) >= 1 and char_length(btrim(coalesce(notes, ''))) >= 3 and recorded_by is not null))
);
comment on table public.curriculum_formal_assessment_details is 'What the official source says about a formal assessment. Marks and weighting stay null until a person copies them from the source; nothing here is ever derived.';

-- ---------------------------------------------------------------------------
-- 4. Fingerprints, current decisions and the completion rule (internal)
-- ---------------------------------------------------------------------------

create or replace function public.review_fingerprint(p_type text, p_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  if p_type = 'objective' then
    select md5(o.code || '|' || o.description || '|' || coalesce(o.source_reference, '')) into v from public.curriculum_objectives o where o.id = p_id;
  elsif p_type = 'lesson' then v := public.content_fingerprint('lessons', p_id);
  elsif p_type = 'resource' then v := public.content_fingerprint('teaching_resources', p_id);
  elsif p_type = 'assessment' then v := public.content_fingerprint('learning_assessments', p_id);
  elsif p_type = 'question' then
    select md5((to_jsonb(q) - 'created_at' || jsonb_build_object('key', to_jsonb(k) - 'question_id' - 'assessment_id'))::text)
      into v from public.assessment_questions q left join public.assessment_question_keys k on k.question_id = q.id where q.id = p_id;
  elsif p_type = 'formal_assessment' then
    select md5((to_jsonb(d) - 'id' - 'recorded_by' - 'recorded_at')::text) into v from public.curriculum_formal_assessment_details d where d.objective_id = p_id;
  else raise exception 'invalid_reference: unknown review entity %', p_type;
  end if;
  return v;
end $$;

create or replace function public.review_current(p_version_id uuid, p_type text)
returns table (entity_id uuid, decision text, stale boolean, reviewer uuid, reviewed_at timestamptz, notes text, source_id uuid, source_section text, source_page text)
language sql stable security definer set search_path = public as $$
  select l.entity_id, l.decision, l.content_fingerprint is distinct from public.review_fingerprint(l.entity_type, l.entity_id),
         l.reviewer, l.reviewed_at, l.notes, l.source_id, l.source_section, l.source_page
  from (select distinct on (r.entity_id) r.* from public.curriculum_reviews r
        where r.version_id = p_version_id and r.entity_type = p_type
        order by r.entity_id, r.seq desc) l
$$;

-- The one definition of "review complete". Returns counts and the reasons it is not complete. Reads only the database.
create or replace function public.curriculum_review_compute(p_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ver      public.curriculum_versions;
  v_blockers text[] := '{}';
  v_counts   jsonb := '{}'::jsonb;
  t          text;
  v_total    integer; v_pos integer; v_neg integer; v_rej integer; v_pend integer;
  v_open_q   integer; v_res_q integer; v_def_q integer; v_def_mat integer; v_total_q integer;
  v_findings integer;
  v_fa_total integer; v_fa_rec integer; v_fa_pos integer;
  v_sources  jsonb;
  s          public.curriculum_sources;
  v_src_ok   integer := 0;
  v_src_all  integer := 0;
  v_overall  text;
begin
  select * into v_ver from public.curriculum_versions where id = p_version_id;
  if v_ver.id is null then raise exception 'not_found: no curriculum version %', p_version_id; end if;

  foreach t in array array['objective', 'lesson', 'resource', 'assessment', 'question'] loop
    execute format($q$select count(*) from %s$q$, case t
      when 'objective' then format('public.curriculum_objectives where version_id = %L', p_version_id)
      when 'lesson' then format('public.lessons where curriculum_version_id = %L', p_version_id)
      when 'resource' then format('public.teaching_resources where curriculum_version_id = %L', p_version_id)
      when 'assessment' then format('public.learning_assessments where curriculum_version_id = %L', p_version_id)
      else format('public.assessment_questions where curriculum_version_id = %L', p_version_id) end) into v_total;
    select count(*) filter (where not c.stale and c.decision in ('verified', 'accepted')),
           count(*) filter (where not c.stale and c.decision = 'needs_correction'),
           count(*) filter (where not c.stale and c.decision = 'rejected')
      into v_pos, v_neg, v_rej from public.review_current(p_version_id, t) c;
    v_pend := v_total - v_pos - v_neg - v_rej;
    v_counts := v_counts || jsonb_build_object(t, jsonb_build_object('total', v_total, 'positive', v_pos, 'needs_correction', v_neg, 'rejected', v_rej, 'pending', v_pend));
    if v_pend > 0 then v_blockers := v_blockers || format('%s %s not reviewed yet', v_pend, t || case when v_pend = 1 then '' else 's' end); end if;
    if v_neg + v_rej > 0 then v_blockers := v_blockers || format('%s %s marked needs correction or rejected', v_neg + v_rej, t || case when v_neg + v_rej = 1 then '' else 's' end); end if;
  end loop;

  select count(*) filter (where status = 'open'), count(*) filter (where status = 'resolved'), count(*) filter (where status = 'deferred'),
         count(*) filter (where status = 'deferred' and materially_affects_scope), count(*)
    into v_open_q, v_res_q, v_def_q, v_def_mat, v_total_q from public.curriculum_open_questions where version_id = p_version_id;
  v_counts := v_counts || jsonb_build_object('open_questions', jsonb_build_object('total', v_total_q, 'open', v_open_q, 'resolved', v_res_q, 'deferred', v_def_q, 'deferred_material', v_def_mat));
  if v_open_q > 0 then v_blockers := v_blockers || format('%s open question(s) unanswered', v_open_q); end if;
  if v_def_mat > 0 then v_blockers := v_blockers || format('%s deferred question(s) materially affect scope and need an answer with evidence', v_def_mat); end if;

  select count(*), count(*) filter (where d.status = 'recorded') into v_fa_total, v_fa_rec from public.curriculum_formal_assessment_details d where d.version_id = p_version_id;
  select count(*) filter (where not c.stale and c.decision = 'verified') into v_fa_pos from public.review_current(p_version_id, 'formal_assessment') c;
  v_counts := v_counts || jsonb_build_object('formal_assessment', jsonb_build_object('total', v_fa_total, 'details_recorded', v_fa_rec, 'verified', v_fa_pos));
  if v_fa_total - v_fa_pos > 0 then v_blockers := array_append(v_blockers, 'formal assessment details not recorded and verified'); end if;

  select count(*) into v_findings from public.curriculum_review_findings where version_id = p_version_id and status = 'open';
  v_counts := v_counts || jsonb_build_object('open_findings', v_findings);
  if v_findings > 0 then v_blockers := v_blockers || format('%s open review finding(s)', v_findings); end if;

  -- Sources: every document this version's units cite.
  v_sources := '[]'::jsonb;
  for s in
    select distinct src.* from public.curriculum_sources src join public.content_source_references r on r.source_id = src.id
    where (r.entity_table = 'lessons' and r.entity_id in (select id from public.lessons where curriculum_version_id = p_version_id))
       or (r.entity_table = 'teaching_resources' and r.entity_id in (select id from public.teaching_resources where curriculum_version_id = p_version_id))
       or (r.entity_table = 'learning_assessments' and r.entity_id in (select id from public.learning_assessments where curriculum_version_id = p_version_id))
    order by src.title
  loop
    v_src_all := v_src_all + 1;
    v_sources := v_sources || jsonb_build_object('id', s.id, 'title', s.title, 'doc_type', s.doc_type, 'evidence_level', public.source_evidence_level(s),
      'licence_status', s.licence_status, 'retrieval_status', s.retrieval_status);
    if s.status = 'verified' and s.content_reviewed_at is not null and s.licence_status in ('permitted', 'restricted') then
      v_src_ok := v_src_ok + 1;
    else
      v_blockers := v_blockers || format('source "%s": %s', s.title,
        case when s.status <> 'verified' then 'identity not verified'
             when s.content_reviewed_at is null then 'document not reviewed'
             when s.licence_status = 'not_permitted' then 'licence does not permit use'
             else 'licence not reviewed' end);
    end if;
  end loop;
  if v_src_all = 0 then v_blockers := array_append(v_blockers, 'no source is linked to this version'); end if;
  v_counts := v_counts || jsonb_build_object('sources', v_sources);

  v_overall := case
    when v_ver.status = 'published' then 'PUBLISHED'
    when v_ver.status = 'approved' then 'APPROVED — NOT PUBLISHED'
    when cardinality(v_blockers) = 0 then 'REVIEW COMPLETE — NOT APPROVED'
    else upper(v_ver.status::text) || ' — NOT VERIFIED' end;
  return v_counts || jsonb_build_object('version_id', v_ver.id, 'version_code', v_ver.code, 'version_name', v_ver.name, 'version_status', v_ver.status,
    'review_workflow', v_ver.review_workflow, 'ready', cardinality(v_blockers) = 0, 'blockers', to_jsonb(v_blockers), 'overall', v_overall);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Gates: workflow versions need a complete review to be approved or published; content needs its own accepted review
-- ---------------------------------------------------------------------------

create or replace function public.review_workflow_version_gate()
returns trigger language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not new.review_workflow or new.status is not distinct from old.status or new.status not in ('approved', 'published') then
    return new;
  end if;
  if new.status = 'approved' and new.created_by is not null and new.created_by is not distinct from auth.uid() then
    raise exception 'insufficient_privilege: a curriculum version cannot be approved by the person who authored it';
  end if;
  v := public.curriculum_review_compute(new.id);
  if not (v ->> 'ready')::boolean then
    raise exception 'invalid_state: the curriculum review is not complete: %', (select string_agg(x, '; ') from (select jsonb_array_elements_text(v -> 'blockers') x limit 4) b);
  end if;
  return new;
end $$;
create trigger curriculum_versions_review_gate before update of status on public.curriculum_versions
  for each row execute function public.review_workflow_version_gate();

create or replace function public.review_workflow_content_gate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type text; v_workflow boolean; v_ok boolean; v_bad integer;
begin
  if new.status is not distinct from old.status or new.status not in ('approved', 'published') then return new; end if;
  select review_workflow into v_workflow from public.curriculum_versions where id = new.curriculum_version_id;
  if not coalesce(v_workflow, false) then return new; end if;
  v_type := case tg_table_name when 'lessons' then 'lesson' when 'teaching_resources' then 'resource' else 'assessment' end;
  if new.status = 'approved' and new.created_by is not null and new.created_by is not distinct from auth.uid() then
    raise exception 'insufficient_privilege: content cannot be approved by the person who authored it';
  end if;
  select exists (select 1 from public.review_current(new.curriculum_version_id, v_type) c where c.entity_id = new.id and not c.stale and c.decision = 'accepted') into v_ok;
  if not v_ok then
    raise exception 'invalid_state: this % has no current accepted curriculum review; it cannot be %', v_type, new.status;
  end if;
  if v_type = 'assessment' then
    select count(*) into v_bad from public.assessment_questions q
     where q.assessment_id = new.id and not exists (select 1 from public.review_current(new.curriculum_version_id, 'question') c
                                                    where c.entity_id = q.id and not c.stale and c.decision = 'accepted');
    if v_bad > 0 then raise exception 'invalid_state: % question(s) of this assessment have no current accepted review', v_bad; end if;
  end if;
  return new;
end $$;
create trigger lessons_review_gate before update of status on public.lessons for each row execute function public.review_workflow_content_gate();
create trigger teaching_resources_review_gate before update of status on public.teaching_resources for each row execute function public.review_workflow_content_gate();
create trigger learning_assessments_review_gate before update of status on public.learning_assessments for each row execute function public.review_workflow_content_gate();

-- AI drafting is refused while a workflow version's review is incomplete (in addition to every existing condition).
create or replace function public.ai_begin_generation(
  p_version_id uuid, p_topic_id uuid, p_objective_ids uuid[], p_instruction text,
  p_language text, p_provider text, p_model text, p_prompt_version text, p_params jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor    uuid := auth.uid();
  v_gs       uuid;
  v_ver_stat public.content_status;
  v_workflow boolean;
  v_ids      uuid[];
  v_ok       integer;
  v_id       uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators can request AI drafts';
  end if;
  if (select count(*) from public.ai_generation_requests where requested_by = v_actor and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited: at most 20 AI draft requests per hour';
  end if;
  select status, review_workflow into v_ver_stat, v_workflow from public.curriculum_versions where id = p_version_id;
  if v_ver_stat is null then raise exception 'not_found: no curriculum version %', p_version_id; end if;
  if v_ver_stat = 'retired' then raise exception 'invalid_state: a retired curriculum version cannot receive new drafts'; end if;
  if exists (select 1 from public.curriculum_versions where supersedes_version_id = p_version_id) then
    raise exception 'invalid_state: this curriculum version has been superseded; draft against its replacement';
  end if;

  select t.grade_subject_id into v_gs
  from public.curriculum_topics tp join public.curriculum_terms t on t.id = tp.term_id
  where tp.id = p_topic_id and tp.version_id = p_version_id;
  if v_gs is null then raise exception 'invalid_reference: topic does not belong to this curriculum version'; end if;

  select array_agg(distinct x) into v_ids from unnest(p_objective_ids) x;
  if v_ids is null or cardinality(v_ids) not between 1 and 8 then
    raise exception 'invalid_argument: choose 1 to 8 objectives';
  end if;
  select count(*) into v_ok from public.curriculum_objectives
  where id = any (v_ids) and topic_id = p_topic_id and version_id = p_version_id and status in ('approved', 'published');
  if v_ok <> cardinality(v_ids) then
    raise exception 'invalid_state: every objective must belong to the topic and be approved before AI drafting';
  end if;

  -- Approved objectives are not enough: a review that has been reopened (for example by a new finding) closes drafting again.
  if v_workflow and not (public.curriculum_review_compute(p_version_id) ->> 'ready')::boolean then
    raise exception 'invalid_state: the curriculum review of this version is incomplete (sources, objectives, lessons, resources, questions, open questions and the formal assessment must all be reviewed); AI drafting is closed';
  end if;

  insert into public.ai_generation_requests
    (requested_by, curriculum_version_id, grade_subject_id, topic_id, objective_ids, instruction, language, provider, model, prompt_version, params)
  values (v_actor, p_version_id, v_gs, p_topic_id, v_ids, nullif(btrim(p_instruction), ''), coalesce(p_language, 'en'), p_provider, p_model, p_prompt_version, coalesce(p_params, '{}'::jsonb))
  returning id into v_id;
  perform public.write_audit_log(null, v_actor, 'ai_generation_requested', 'ai_generation_requests', v_id, null,
    jsonb_build_object('topic_id', p_topic_id, 'objective_ids', v_ids, 'provider', p_provider, 'model', p_model, 'prompt_version', p_prompt_version));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Reviewer RPCs
-- ---------------------------------------------------------------------------

create or replace function public.require_curriculum_review(p_version_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators manage the review workflow';
  end if;
  update public.curriculum_versions set review_workflow = true where id = p_version_id and not review_workflow;
  if found then
    perform public.write_audit_log(null, auth.uid(), 'curriculum_review_required', 'curriculum_versions', p_version_id, jsonb_build_object('review_workflow', false), jsonb_build_object('review_workflow', true));
  end if;
end $$;

-- The creator of a unit (used to refuse self-verification).
create or replace function public.review_entity_creator(p_type text, p_id uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  if p_type = 'lesson' then select created_by into v from public.lessons where id = p_id;
  elsif p_type = 'resource' then select created_by into v from public.teaching_resources where id = p_id;
  elsif p_type = 'assessment' then select created_by into v from public.learning_assessments where id = p_id;
  elsif p_type = 'question' then select a.created_by into v from public.assessment_questions q join public.learning_assessments a on a.id = q.assessment_id where q.id = p_id;
  elsif p_type = 'objective' then select ver.created_by into v from public.curriculum_objectives o join public.curriculum_versions ver on ver.id = o.version_id where o.id = p_id;
  elsif p_type = 'formal_assessment' then select ver.created_by into v from public.curriculum_objectives o join public.curriculum_versions ver on ver.id = o.version_id where o.id = p_id;
  end if;
  return v;
end $$;

create or replace function public.review_entity_in_version(p_version_id uuid, p_type text, p_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v boolean;
begin
  if p_type = 'objective' or p_type = 'formal_assessment' then select exists (select 1 from public.curriculum_objectives where id = p_id and version_id = p_version_id) into v;
  elsif p_type = 'lesson' then select exists (select 1 from public.lessons where id = p_id and curriculum_version_id = p_version_id) into v;
  elsif p_type = 'resource' then select exists (select 1 from public.teaching_resources where id = p_id and curriculum_version_id = p_version_id) into v;
  elsif p_type = 'assessment' then select exists (select 1 from public.learning_assessments where id = p_id and curriculum_version_id = p_version_id) into v;
  elsif p_type = 'question' then select exists (select 1 from public.assessment_questions where id = p_id and curriculum_version_id = p_version_id) into v;
  else v := false;
  end if;
  return coalesce(v, false);
end $$;

-- Record one decision. Positive decisions on an objective or the formal assessment need an adequate source reference; negative
-- decisions need notes and create a finding. The unit is never edited.
create or replace function public.record_curriculum_review(
  p_version_id uuid, p_entity_type text, p_entity_id uuid, p_decision text, p_notes text,
  p_source_id uuid default null, p_source_section text default null, p_source_page text default null,
  p_finding_category text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor  uuid := auth.uid();
  v_ver    public.curriculum_versions;
  v_prev   text;
  v_fp     text;
  v_id     uuid;
  v_src    public.curriculum_sources;
  v_cat    text := coalesce(p_finding_category, 'other');
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators review curriculum content';
  end if;
  select * into v_ver from public.curriculum_versions where id = p_version_id;
  if v_ver.id is null then raise exception 'not_found: no curriculum version %', p_version_id; end if;
  if v_ver.status in ('approved', 'published', 'retired') then
    raise exception 'invalid_state: the curriculum version is %; decisions are only recorded while it is a draft or in review', v_ver.status;
  end if;
  if not public.review_entity_in_version(p_version_id, p_entity_type, p_entity_id) then
    raise exception 'invalid_reference: this % does not belong to the curriculum version', p_entity_type;
  end if;
  if char_length(btrim(coalesce(p_notes, ''))) < 3 then raise exception 'invalid_argument: reviewer notes are required'; end if;

  if p_decision in ('verified', 'accepted') then
    if p_entity_type in ('objective', 'formal_assessment') and p_decision <> 'verified' or p_entity_type not in ('objective', 'formal_assessment') and p_decision <> 'accepted' then
      raise exception 'invalid_argument: use % for a % review', case when p_entity_type in ('objective', 'formal_assessment') then 'verified' else 'accepted' end, p_entity_type;
    end if;
    if public.review_entity_creator(p_entity_type, p_entity_id) is not distinct from v_actor and v_actor is not null then
      raise exception 'insufficient_privilege: the author of a unit cannot verify or accept it';
    end if;
    if p_entity_type in ('objective', 'formal_assessment') then
      if p_source_id is null then raise exception 'invalid_argument: a verified objective needs the source it was checked against'; end if;
      if char_length(btrim(coalesce(p_source_section, ''))) < 2 then raise exception 'invalid_argument: give the section of the source'; end if;
      if char_length(btrim(coalesce(p_source_page, ''))) < 1 then raise exception 'invalid_argument: give the page or reference in the source'; end if;
      select * into v_src from public.curriculum_sources where id = p_source_id;
      if v_src.id is null or v_src.status <> 'verified' then
        raise exception 'invalid_state: the source must have its identity verified before anything can be verified against it';
      end if;
    end if;
    if p_entity_type = 'formal_assessment' and not exists (select 1 from public.curriculum_formal_assessment_details where objective_id = p_entity_id and status = 'recorded') then
      raise exception 'invalid_state: record the official details of the formal assessment before verifying it';
    end if;
  elsif p_decision in ('needs_correction', 'rejected') then
    null;
  else
    raise exception 'invalid_argument: unknown decision %', p_decision;
  end if;

  select decision into v_prev from public.review_current(p_version_id, p_entity_type) where entity_id = p_entity_id;
  v_fp := public.review_fingerprint(p_entity_type, p_entity_id);
  insert into public.curriculum_reviews (version_id, entity_type, entity_id, decision, notes, source_id, source_section, source_page, previous_decision, content_fingerprint, reviewer)
  values (p_version_id, p_entity_type, p_entity_id, p_decision, p_notes, p_source_id, nullif(btrim(p_source_section), ''), nullif(btrim(p_source_page), ''), v_prev, v_fp, v_actor)
  returning id into v_id;

  if p_decision in ('needs_correction', 'rejected') then
    insert into public.curriculum_review_findings (version_id, entity_type, entity_id, category, description, review_id, raised_by)
    values (p_version_id, p_entity_type, p_entity_id, v_cat, p_notes, v_id, v_actor);
  end if;

  perform public.write_audit_log(null, v_actor, 'curriculum_review_' || p_decision, 'curriculum_reviews', v_id,
    jsonb_build_object('decision', v_prev),
    jsonb_build_object('entity_type', p_entity_type, 'entity_id', p_entity_id, 'decision', p_decision, 'notes', p_notes,
                       'source_id', p_source_id, 'source_section', p_source_section, 'source_page', p_source_page));
  return v_id;
end $$;

create or replace function public.raise_review_finding(p_version_id uuid, p_entity_type text, p_entity_id uuid, p_category text, p_description text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators raise review findings';
  end if;
  if not exists (select 1 from public.curriculum_versions where id = p_version_id) then raise exception 'not_found: no curriculum version %', p_version_id; end if;
  if p_entity_type not in ('open_question', 'source') and not public.review_entity_in_version(p_version_id, p_entity_type, p_entity_id) then
    raise exception 'invalid_reference: this % does not belong to the curriculum version', p_entity_type;
  end if;
  insert into public.curriculum_review_findings (version_id, entity_type, entity_id, category, description, raised_by)
  values (p_version_id, p_entity_type, p_entity_id, p_category, p_description, auth.uid()) returning id into v_id;
  perform public.write_audit_log(null, auth.uid(), 'curriculum_finding_raised', 'curriculum_review_findings', v_id, null,
    jsonb_build_object('entity_type', p_entity_type, 'entity_id', p_entity_id, 'category', p_category, 'description', p_description));
  return v_id;
end $$;

create or replace function public.resolve_review_finding(p_finding_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_f public.curriculum_review_findings;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators resolve review findings';
  end if;
  if p_status not in ('resolved', 'dismissed') then raise exception 'invalid_argument: status must be resolved or dismissed'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'invalid_argument: say how the finding was resolved'; end if;
  select * into v_f from public.curriculum_review_findings where id = p_finding_id for update;
  if v_f.id is null then raise exception 'not_found: no finding %', p_finding_id; end if;
  if v_f.status <> 'open' then raise exception 'invalid_state: the finding is already %', v_f.status; end if;
  update public.curriculum_review_findings set status = p_status, resolved_by = auth.uid(), resolved_at = now(), resolution_note = p_note where id = p_finding_id;
  perform public.write_audit_log(null, auth.uid(), 'curriculum_finding_' || p_status, 'curriculum_review_findings', p_finding_id,
    jsonb_build_object('status', 'open'), jsonb_build_object('status', p_status, 'note', p_note));
end $$;

create or replace function public.resolve_open_question(
  p_question_id uuid, p_status text, p_answer text default null, p_source_id uuid default null,
  p_source_section text default null, p_source_page text default null, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_q   public.curriculum_open_questions;
  v_src public.curriculum_sources;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators answer curriculum questions';
  end if;
  select * into v_q from public.curriculum_open_questions where id = p_question_id for update;
  if v_q.id is null then raise exception 'not_found: no question %', p_question_id; end if;
  if exists (select 1 from public.curriculum_versions where id = v_q.version_id and status in ('approved', 'published', 'retired')) then
    raise exception 'invalid_state: the curriculum version is past review; raise a finding instead';
  end if;
  if p_status not in ('open', 'resolved', 'deferred') then raise exception 'invalid_argument: status must be open, resolved or deferred'; end if;
  if char_length(btrim(coalesce(p_notes, ''))) < 3 then raise exception 'invalid_argument: an explanation is required for every change'; end if;

  if p_status = 'resolved' then
    if char_length(btrim(coalesce(p_answer, ''))) < 3 then raise exception 'invalid_argument: state the answer'; end if;
    if p_source_id is null then raise exception 'invalid_argument: a resolved question needs the source of the answer'; end if;
    if char_length(btrim(coalesce(p_source_section, ''))) < 2 or char_length(btrim(coalesce(p_source_page, ''))) < 1 then
      raise exception 'invalid_argument: give the section and page or reference in the source';
    end if;
    select * into v_src from public.curriculum_sources where id = p_source_id;
    if v_src.id is null or v_src.status <> 'verified' then
      raise exception 'invalid_state: a question can only be resolved with evidence from a source whose identity is verified; defer it otherwise';
    end if;
  end if;

  update public.curriculum_open_questions set
    status = p_status,
    answer = case when p_status = 'resolved' then p_answer else null end,
    source_id = case when p_status = 'resolved' then p_source_id else null end,
    source_section = case when p_status = 'resolved' then p_source_section else null end,
    source_page = case when p_status = 'resolved' then p_source_page else null end,
    notes = p_notes,
    resolved_by = case when p_status = 'open' then null else auth.uid() end,
    resolved_at = case when p_status = 'open' then null else now() end
  where id = p_question_id;
  perform public.write_audit_log(null, auth.uid(), 'curriculum_question_' || p_status, 'curriculum_open_questions', p_question_id,
    jsonb_build_object('status', v_q.status, 'answer', v_q.answer),
    jsonb_build_object('status', p_status, 'answer', p_answer, 'source_id', p_source_id, 'source_section', p_source_section, 'source_page', p_source_page, 'notes', p_notes));
end $$;

create or replace function public.record_formal_assessment_details(
  p_version_id uuid, p_objective_id uuid, p_name text, p_type text, p_scope text, p_duration_minutes integer,
  p_timing text, p_marks integer, p_weighting text, p_instructions text,
  p_source_id uuid, p_source_section text, p_source_page text, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_src public.curriculum_sources;
  v_old jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators record formal assessment details';
  end if;
  if exists (select 1 from public.curriculum_versions where id = p_version_id and status in ('approved', 'published', 'retired')) then
    raise exception 'invalid_state: the curriculum version is past review';
  end if;
  select to_jsonb(d) into v_old from public.curriculum_formal_assessment_details d where d.version_id = p_version_id and d.objective_id = p_objective_id;
  if v_old is null then raise exception 'not_found: this objective is not a formal assessment of the version'; end if;
  select * into v_src from public.curriculum_sources where id = p_source_id;
  if v_src.id is null or v_src.status <> 'verified' then
    raise exception 'invalid_state: official details can only be recorded from a source whose identity is verified';
  end if;
  if char_length(btrim(coalesce(p_source_section, ''))) < 2 or char_length(btrim(coalesce(p_source_page, ''))) < 1 then
    raise exception 'invalid_argument: give the section and page or reference in the source';
  end if;
  update public.curriculum_formal_assessment_details set
    status = 'recorded', assessment_name = p_name, assessment_type = p_type, scope = p_scope, duration_minutes = p_duration_minutes,
    timing = nullif(btrim(p_timing), ''), marks = p_marks, weighting = nullif(btrim(p_weighting), ''), instructions = nullif(btrim(p_instructions), ''),
    source_id = p_source_id, source_section = p_source_section, source_page = p_source_page, notes = p_notes, recorded_by = auth.uid(), recorded_at = now()
  where version_id = p_version_id and objective_id = p_objective_id;
  perform public.write_audit_log(null, auth.uid(), 'curriculum_formal_assessment_recorded', 'curriculum_formal_assessment_details', (v_old ->> 'id')::uuid,
    v_old - 'id', jsonb_build_object('name', p_name, 'type', p_type, 'duration_minutes', p_duration_minutes, 'marks', p_marks, 'weighting', p_weighting,
                                     'source_id', p_source_id, 'source_section', p_source_section, 'source_page', p_source_page));
end $$;

-- ---------------------------------------------------------------------------
-- 7. Reads for the review screen (platform administrators only; the same data the tables expose, shaped for the screen)
-- ---------------------------------------------------------------------------

create or replace function public.curriculum_review_summary(p_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: the curriculum review is internal to platform administrators';
  end if;
  return public.curriculum_review_compute(p_version_id);
end $$;

create or replace function public.curriculum_review_items(p_version_id uuid, p_type text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: the curriculum review is internal to platform administrators';
  end if;
  if p_type = 'objective' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'code', o.code, 'description', o.description, 'topic', tp.title, 'subtopic', st.title,
      'source_reference', o.source_reference,
      'lessons', (select count(*) from public.lesson_objectives lo where lo.objective_id = o.id),
      'resources', (select count(*) from public.resource_objectives ro where ro.objective_id = o.id),
      'assessments', (select count(distinct q.assessment_id) from public.assessment_questions q where q.objective_id = o.id),
      'questions', (select count(*) from public.assessment_questions q where q.objective_id = o.id),
      'review', (select to_jsonb(c) - 'entity_id' from public.review_current(p_version_id, 'objective') c where c.entity_id = o.id)) order by o.sort_order, o.code), '[]'::jsonb) into v
    from public.curriculum_objectives o join public.curriculum_topics tp on tp.id = o.topic_id left join public.curriculum_subtopics st on st.id = o.subtopic_id
    where o.version_id = p_version_id;
  elsif p_type = 'lesson' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'title', l.title, 'description', l.description, 'teacher_notes', l.teacher_notes, 'learner_instructions', l.learner_instructions, 'origin', l.origin, 'status', l.status, 'minutes', l.estimated_minutes,
      'objectives', (select coalesce(jsonb_agg(o.code order by o.code), '[]') from public.lesson_objectives lo join public.curriculum_objectives o on o.id = lo.objective_id where lo.lesson_id = l.id),
      'activities', (select coalesce(jsonb_agg(jsonb_build_object('title', a.title, 'type', a.activity_type, 'instructions', a.instructions, 'minutes', a.estimated_minutes) order by a.sort_order), '[]') from public.learning_activities a where a.lesson_id = l.id),
      'resources', (select coalesce(jsonb_agg(jsonb_build_object('title', r.title, 'stage', r.stage, 'kind', r.resource_kind) order by lr.sort_order), '[]') from public.lesson_resources lr join public.teaching_resources r on r.id = lr.resource_id where lr.lesson_id = l.id),
      'sources', (select coalesce(jsonb_agg(jsonb_build_object('title', s.title, 'locator', c.locator, 'status', s.status, 'check_result', c.check_result)), '[]') from public.content_source_references c join public.curriculum_sources s on s.id = c.source_id where c.entity_table = 'lessons' and c.entity_id = l.id),
      'review', (select to_jsonb(c) - 'entity_id' from public.review_current(p_version_id, 'lesson') c where c.entity_id = l.id)) order by l.sort_order, l.title), '[]'::jsonb) into v
    from public.lessons l where l.curriculum_version_id = p_version_id;
  elsif p_type = 'resource' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'title', r.title, 'summary', r.summary, 'kind', r.resource_kind, 'stage', r.stage, 'difficulty', r.difficulty, 'formats', r.delivery_formats,
      'printable', r.printable, 'cacheable', r.cacheable, 'projector_required', r.projector_required, 'device', r.device, 'connectivity', r.connectivity,
      'body', r.body,
      'lessons', (select coalesce(jsonb_agg(l.title order by l.sort_order), '[]') from public.lesson_resources lr join public.lessons l on l.id = lr.lesson_id where lr.resource_id = r.id),
      'objectives', (select coalesce(jsonb_agg(o.code order by o.code), '[]') from public.resource_objectives ro join public.curriculum_objectives o on o.id = ro.objective_id where ro.resource_id = r.id),
      'review', (select to_jsonb(c) - 'entity_id' from public.review_current(p_version_id, 'resource') c where c.entity_id = r.id)) order by r.title), '[]'::jsonb) into v
    from public.teaching_resources r where r.curriculum_version_id = p_version_id;
  elsif p_type = 'assessment' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'summary', a.purpose, 'minutes', a.estimated_minutes, 'questions', (select count(*) from public.assessment_questions q where q.assessment_id = a.id),
      'review', (select to_jsonb(c) - 'entity_id' from public.review_current(p_version_id, 'assessment') c where c.entity_id = a.id)) order by a.title), '[]'::jsonb) into v
    from public.learning_assessments a where a.curriculum_version_id = p_version_id;
  elsif p_type = 'question' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'assessment', a.title, 'position', q.position, 'type', q.question_type, 'prompt', q.prompt, 'options', q.options, 'marks', q.marks,
      'difficulty', q.difficulty, 'objective', o.code, 'answer', k.answer, 'feedback', k.feedback, 'marking_notes', k.marking_notes,
      'review', (select to_jsonb(c) - 'entity_id' from public.review_current(p_version_id, 'question') c where c.entity_id = q.id)) order by a.title, q.position), '[]'::jsonb) into v
    from public.assessment_questions q join public.learning_assessments a on a.id = q.assessment_id left join public.assessment_question_keys k on k.question_id = q.id
    left join public.curriculum_objectives o on o.id = q.objective_id where q.curriculum_version_id = p_version_id;
  else
    raise exception 'invalid_reference: unknown review entity %', p_type;
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Row level security and privileges
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['curriculum_source_reviews', 'curriculum_reviews', 'curriculum_review_findings', 'curriculum_open_questions', 'curriculum_formal_assessment_details'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy %I on public.%I for select to authenticated using ((select public.is_platform_admin()))$p$, t || '_select', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Internal helpers and triggers.
revoke execute on function public.append_only_guard() from public, anon, authenticated;
revoke execute on function public.curriculum_review_workflow_lock() from public, anon, authenticated;
revoke execute on function public.curriculum_sources_protect_evidence() from public, anon, authenticated;
revoke execute on function public.review_fingerprint(text, uuid) from public, anon, authenticated;
revoke execute on function public.review_current(uuid, text) from public, anon, authenticated;
revoke execute on function public.curriculum_review_compute(uuid) from public, anon, authenticated;
revoke execute on function public.review_workflow_version_gate() from public, anon, authenticated;
revoke execute on function public.review_workflow_content_gate() from public, anon, authenticated;
revoke execute on function public.review_entity_creator(text, uuid) from public, anon, authenticated;
revoke execute on function public.review_entity_in_version(uuid, text, uuid) from public, anon, authenticated;

-- Client-callable RPCs. Each re-checks is_platform_admin() itself.
do $$
declare f text;
begin
  foreach f in array array[
    'register_curriculum_source(text, text, text, text, text, text, boolean, text, date, text, text, text, text, text[], text)',
    'record_source_retrieval(uuid, text)',
    'record_source_review(uuid, text, text, text, text)',
    'correct_source_evidence(uuid, text)',
    'require_curriculum_review(uuid)',
    'record_curriculum_review(uuid, text, uuid, text, text, uuid, text, text, text)',
    'raise_review_finding(uuid, text, uuid, text, text)',
    'resolve_review_finding(uuid, text, text)',
    'resolve_open_question(uuid, text, text, uuid, text, text, text)',
    'record_formal_assessment_details(uuid, uuid, text, text, text, integer, text, integer, text, text, uuid, text, text, text)',
    'curriculum_review_summary(uuid)',
    'curriculum_review_items(uuid, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select public.rls_optimize_policies();
