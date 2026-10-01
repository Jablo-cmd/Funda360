-- Funda360 source evidence ladder. Additive: nothing is dropped; two functions are replaced by stricter versions.
-- Design: docs/proposals/ai-authoring.md and docs/sources/curriculum-source-register.md.
--
-- "Verified" used to be one word for several different things. A source row now records, separately:
--
--   indexed            a DBE document with this title was found at this URL                    indexed_on
--   retrieved          the actual bytes were downloaded and hashed                              checksum_sha256 + retrieved_on
--   identity verified  a person confirmed the downloaded file is the authoritative edition      status = 'verified'  (requires retrieved)
--   content reviewed   a person read the actual document                                        content_reviewed_*   (requires identity verified)
--
-- A fifth thing is NOT a property of the source and stays where it already lives: whether a Funda360 lesson, resource
-- or assessment matches a source is content_source_references.check_result and content_verifications
-- ("curriculum verification"). A source can be fully reviewed while every unit that cites it is still unverified.
--
-- The lifecycle of a unit (draft, review, approved, published, retired) is a third, separate concept.

alter table public.curriculum_sources
  add column indexed_on          date,
  add column content_reviewed_by uuid references public.profiles (id) on delete set null,
  add column content_reviewed_at timestamptz,
  add column content_review_note text check (content_review_note is null or char_length(content_review_note) <= 1000);

comment on column public.curriculum_sources.indexed_on is 'Date a document with this title was seen at this URL (for example in the publisher''s own index). It proves existence at a location, not content and not identity.';
comment on column public.curriculum_sources.checksum_sha256 is 'SHA-256 of the exact bytes that were downloaded. Together with retrieved_on this is the "retrieved" step. Never set from a title, a page or another URL.';
comment on column public.curriculum_sources.status is 'registered | verified | retired. verified means IDENTITY verified: a person confirmed the downloaded file (see checksum_sha256) is the authoritative edition. It does not mean the document was read, and it says nothing about any lesson.';
comment on column public.curriculum_sources.content_reviewed_at is 'A person read the actual document. Needs identity to be verified first.';

-- Identity cannot be verified without the actual bytes, and the document cannot be reviewed before its identity is verified.
alter table public.curriculum_sources
  add constraint curriculum_sources_verified_needs_bytes
    check (status <> 'verified' or (checksum_sha256 is not null and retrieved_on is not null)),
  add constraint curriculum_sources_review_needs_identity
    check (content_reviewed_at is null or status = 'verified');

-- Once bytes are recorded they cannot be swapped for a different file's checksum: a different file is a different source.
create or replace function public.curriculum_sources_protect_evidence()
returns trigger language plpgsql as $$
begin
  if old.checksum_sha256 is not null and new.checksum_sha256 is distinct from old.checksum_sha256 then
    raise exception 'invalid_state: a different checksum is already recorded for this source; register the other file as its own source';
  end if;
  if old.checksum_sha256 is not null and new.retrieved_on is distinct from old.retrieved_on then
    raise exception 'invalid_state: the retrieval date cannot change once the checksum is recorded';
  end if;
  return new;
end $$;
create trigger curriculum_sources_protect_evidence before update on public.curriculum_sources
  for each row execute function public.curriculum_sources_protect_evidence();

-- The highest step a source has reached, as one plain word. Internal helper.
create or replace function public.source_evidence_level(s public.curriculum_sources)
returns text language sql immutable set search_path = public as $$
  select case
    when s.status = 'verified' and s.content_reviewed_at is not null then 'content_reviewed'
    when s.status = 'verified' then 'identity_verified'
    when s.checksum_sha256 is not null and s.retrieved_on is not null then 'retrieved'
    when s.indexed_on is not null then 'indexed'
    else 'registered'
  end
$$;

-- Record one step of evidence. Identity verification keeps its own function, verify_curriculum_source().
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
    if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
      raise exception 'invalid_argument: give the SHA-256 of the downloaded file as 64 lowercase hexadecimal characters';
    end if;
    if p_on is null or p_on > current_date then
      raise exception 'invalid_argument: give the date the file was downloaded (not a future date)';
    end if;
    update public.curriculum_sources set checksum_sha256 = p_sha256, retrieved_on = p_on where id = p_source_id;
  elsif p_level = 'content_reviewed' then
    if v_src.status <> 'verified' then
      raise exception 'invalid_state: confirm the document''s identity first; a document cannot be reviewed before its identity is verified';
    end if;
    if coalesce(btrim(p_note), '') = '' then
      raise exception 'invalid_argument: say what was reviewed (sections and edition)';
    end if;
    update public.curriculum_sources set content_reviewed_by = v_actor, content_reviewed_at = now(), content_review_note = p_note where id = p_source_id;
  else
    raise exception 'invalid_argument: level must be indexed, retrieved or content_reviewed';
  end if;

  perform public.write_audit_log(null, v_actor, 'curriculum_source_' || p_level, 'curriculum_sources', p_source_id, null,
    jsonb_build_object('level', p_level, 'sha256', p_sha256, 'on', p_on, 'note', p_note));
end $$;

-- Stricter: identity can only be verified once the actual bytes are recorded.
create or replace function public.verify_curriculum_source(p_source_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_src public.curriculum_sources;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators verify curriculum sources';
  end if;
  select * into v_src from public.curriculum_sources where id = p_source_id;
  if v_src.id is null or v_src.status <> 'registered' then
    raise exception 'invalid_state: source not found or not awaiting verification';
  end if;
  if v_src.checksum_sha256 is null or v_src.retrieved_on is null then
    raise exception 'invalid_state: record the downloaded file''s SHA-256 and date first; identity cannot be verified without the actual bytes';
  end if;
  update public.curriculum_sources
     set status = 'verified', verified_by = auth.uid(), verified_at = now(), note = coalesce(p_note, note)
   where id = p_source_id;
  perform public.write_audit_log(null, auth.uid(), 'curriculum_source_verified', 'curriculum_sources', p_source_id, null,
    jsonb_build_object('note', p_note, 'sha256', v_src.checksum_sha256));
end $$;

-- A superseded version must not receive new AI drafts: they belong in its replacement. Otherwise unchanged.
create or replace function public.ai_begin_generation(
  p_version_id uuid, p_topic_id uuid, p_objective_ids uuid[], p_instruction text,
  p_language text, p_provider text, p_model text, p_prompt_version text, p_params jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor    uuid := auth.uid();
  v_gs       uuid;
  v_ver_stat public.content_status;
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
  select status into v_ver_stat from public.curriculum_versions where id = p_version_id;
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

  insert into public.ai_generation_requests
    (requested_by, curriculum_version_id, grade_subject_id, topic_id, objective_ids, instruction, language, provider, model, prompt_version, params)
  values (v_actor, p_version_id, v_gs, p_topic_id, v_ids, nullif(btrim(p_instruction), ''), coalesce(p_language, 'en'), p_provider, p_model, p_prompt_version, coalesce(p_params, '{}'::jsonb))
  returning id into v_id;
  perform public.write_audit_log(null, v_actor, 'ai_generation_requested', 'ai_generation_requests', v_id, null,
    jsonb_build_object('topic_id', p_topic_id, 'objective_ids', v_ids, 'provider', p_provider, 'model', p_model, 'prompt_version', p_prompt_version));
  return v_id;
end $$;

-- Privileges. record_source_evidence is called by the client (and re-checks the caller); the helpers are internal.
revoke execute on function public.record_source_evidence(uuid, text, text, date, text) from public, anon;
grant execute on function public.record_source_evidence(uuid, text, text, date, text) to authenticated;
revoke execute on function public.source_evidence_level(public.curriculum_sources) from public, anon, authenticated;
revoke execute on function public.curriculum_sources_protect_evidence() from public, anon, authenticated;
