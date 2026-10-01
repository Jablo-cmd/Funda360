-- Funda360 Curriculum Engine — controlled AI-assisted authoring.
-- Design: docs/proposals/ai-authoring.md. Purely additive: nothing existing is dropped or loosened.
-- content_transition() is NOT redefined; the AI rules are enforced by triggers on the three content
-- tables, so they hold for every path that changes a status.
--
-- Pipeline: registered source -> approved objective -> generation request -> structured draft
--   (origin = 'ai_draft', status = draft) -> validation findings -> human review (source references,
--   verification) -> approval by someone other than the requester -> publication.
-- The model never writes to the database. An Edge Function calls these RPCs as the signed-in
-- platform administrator, so every check below applies to the administrator, not to a service role.

-- ---------------------------------------------------------------------------
-- 0. Enums
-- ---------------------------------------------------------------------------

create type public.content_verification_status as enum ('unverified', 'source_backed', 'reviewed', 'verified');
create type public.ai_generation_status as enum ('generating', 'draft_created', 'rejected_output', 'failed');
create type public.validation_severity as enum ('error', 'warning', 'info');

-- ---------------------------------------------------------------------------
-- 1. Source registry (metadata only: curriculum documents are never copied into the schema)
-- ---------------------------------------------------------------------------

create table public.curriculum_sources (
  id                uuid primary key default gen_random_uuid(),
  title             text not null check (char_length(title) between 3 and 300),
  publisher         text not null check (char_length(publisher) between 2 and 200),
  doc_type          text not null check (doc_type in ('caps_policy', 'annual_teaching_plan', 'assessment_guideline', 'textbook', 'other')),
  url               text check (url is null or url ~ '^https://'),
  edition           text,
  licence           text not null check (char_length(licence) > 0),
  excerpts_permitted boolean not null default false,
  checksum_sha256   text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  retrieved_on      date,
  status            text not null default 'registered' check (status in ('registered', 'verified', 'retired')),
  note              text,
  registered_by     uuid references public.profiles (id) on delete set null,
  verified_by       uuid references public.profiles (id) on delete set null,
  verified_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.curriculum_sources is 'Registry of authoritative documents content can be checked against. Holds title, publisher, licence, checksum and verification state only. status = verified means a platform administrator confirmed the document is the authoritative edition; it says nothing about any lesson.';

create table public.content_source_references (
  id            uuid primary key default gen_random_uuid(),
  entity_table  text not null check (entity_table in ('lessons', 'teaching_resources', 'learning_assessments')),
  entity_id     uuid not null,
  source_id     uuid not null references public.curriculum_sources (id),
  locator       text not null check (char_length(locator) between 3 and 300),
  supports      text check (supports is null or char_length(supports) <= 500),
  added_by      uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  check_result  text check (check_result in ('matches', 'partial', 'does_not_match')),
  checked_by    uuid references public.profiles (id) on delete set null,
  checked_at    timestamptz,
  check_note    text check (check_note is null or char_length(check_note) <= 1000),
  unique (entity_table, entity_id, source_id, locator)
);
comment on table public.content_source_references is 'Which part (locator) of which registered source a lesson, resource or assessment is based on, and whether a reviewer checked that it matches.';
create index content_source_references_entity_idx on public.content_source_references (entity_table, entity_id);

-- One row per content unit: its current verification level and the content version it applies to.
create table public.content_verifications (
  entity_table  text not null check (entity_table in ('lessons', 'teaching_resources', 'learning_assessments')),
  entity_id     uuid not null,
  status        public.content_verification_status not null default 'unverified',
  fingerprint   text,
  note          text check (note is null or char_length(note) <= 1000),
  set_by        uuid references public.profiles (id) on delete set null,
  set_at        timestamptz not null default now(),
  primary key (entity_table, entity_id)
);
comment on table public.content_verifications is 'unverified < source_backed < reviewed < verified. Set only by set_content_verification(). The status applies to the content as fingerprinted: any later edit makes it stale, which reads as unverified.';

-- ---------------------------------------------------------------------------
-- 2. Generation requests and outputs (provenance)
-- ---------------------------------------------------------------------------

create table public.ai_generation_requests (
  id                    uuid primary key default gen_random_uuid(),
  requested_by          uuid references public.profiles (id) on delete set null,
  curriculum_version_id uuid not null,
  grade_subject_id      uuid not null,
  topic_id              uuid not null,
  objective_ids         uuid[] not null check (cardinality(objective_ids) between 1 and 8),
  kind                  text not null default 'lesson_pack' check (kind in ('lesson_pack')),
  language              text not null default 'en' check (language ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),
  instruction           text check (instruction is null or char_length(instruction) <= 2000),
  status                public.ai_generation_status not null default 'generating',
  provider              text not null check (provider ~ '^[a-z0-9_.-]{2,40}$'),
  model                 text not null check (char_length(model) between 2 and 80),
  prompt_version        text not null check (char_length(prompt_version) between 1 and 40),
  schema_version        text not null default '1',
  params                jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  accepted_payload      jsonb,
  output_hash           text,
  rejection_reasons     jsonb,
  result_lesson_id      uuid references public.lessons (id) on delete set null,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz,
  foreign key (curriculum_version_id) references public.curriculum_versions (id),
  foreign key (grade_subject_id, curriculum_version_id) references public.curriculum_grade_subjects (id, version_id),
  foreign key (topic_id, curriculum_version_id) references public.curriculum_topics (id, version_id)
);
comment on table public.ai_generation_requests is 'One AI drafting run: who asked, for which version/topic/objectives, with which provider, model and prompt version, what was accepted or why it was rejected. Internal: readable by platform administrators only.';
create index ai_generation_requests_requester_idx on public.ai_generation_requests (requested_by, created_at desc);
create index ai_generation_requests_topic_idx on public.ai_generation_requests (topic_id, created_at desc);

create table public.ai_generation_outputs (
  request_id    uuid not null references public.ai_generation_requests (id) on delete cascade,
  entity_table  text not null check (entity_table in ('lessons', 'teaching_resources', 'learning_assessments')),
  entity_id     uuid not null,
  primary key (request_id, entity_table, entity_id)
);
create index ai_generation_outputs_entity_idx on public.ai_generation_outputs (entity_table, entity_id);

-- ---------------------------------------------------------------------------
-- 3. Validation runs and findings (findings are reported, content is never altered)
-- ---------------------------------------------------------------------------

create table public.content_validation_runs (
  id                  uuid primary key default gen_random_uuid(),
  entity_table        text not null check (entity_table in ('lessons', 'teaching_resources', 'learning_assessments')),
  entity_id           uuid not null,
  ruleset_version     text not null,
  content_fingerprint text not null,
  error_count         integer not null default 0,
  warning_count       integer not null default 0,
  info_count          integer not null default 0,
  passed              boolean not null,
  run_by              uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index content_validation_runs_entity_idx on public.content_validation_runs (entity_table, entity_id, created_at desc);

create table public.content_validation_findings (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid not null references public.content_validation_runs (id) on delete cascade,
  severity         public.validation_severity not null,
  category         text not null check (category in ('structure', 'curriculum', 'delivery', 'assessment', 'safety')),
  code             text not null,
  message          text not null,
  path             text,
  acknowledged_by  uuid references public.profiles (id) on delete set null,
  acknowledged_at  timestamptz,
  ack_note         text check (ack_note is null or char_length(ack_note) <= 1000)
);
create index content_validation_findings_run_idx on public.content_validation_findings (run_id, severity);

-- ---------------------------------------------------------------------------
-- 4. Internal helpers (not callable by clients)
-- ---------------------------------------------------------------------------

-- Hash of everything a reviewer reads: the unit, its children and links. Lifecycle columns are excluded,
-- so moving through review/approval does not change it but any edit to the content does.
create or replace function public.content_fingerprint(p_table text, p_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_life text[] := array['status', 'reviewed_by', 'reviewed_at', 'approved_by', 'approved_at',
                         'published_at', 'retired_at', 'updated_at', 'updated_by'];
  v_doc  jsonb;
begin
  if p_table = 'lessons' then
    select jsonb_build_object(
      'row', to_jsonb(l) - v_life,
      'objectives', coalesce((select jsonb_agg(o.objective_id order by o.objective_id) from public.lesson_objectives o where o.lesson_id = l.id), '[]'),
      'resources', coalesce((select jsonb_agg(jsonb_build_array(r.resource_id, r.sort_order) order by r.resource_id) from public.lesson_resources r where r.lesson_id = l.id), '[]'),
      'activities', coalesce((select jsonb_agg(to_jsonb(a) - 'created_at' - 'updated_at' order by a.sort_order, a.id) from public.learning_activities a where a.lesson_id = l.id), '[]'))
    into v_doc from public.lessons l where l.id = p_id;
  elsif p_table = 'teaching_resources' then
    select jsonb_build_object(
      'row', to_jsonb(r) - v_life,
      'objectives', coalesce((select jsonb_agg(o.objective_id order by o.objective_id) from public.resource_objectives o where o.resource_id = r.id), '[]'))
    into v_doc from public.teaching_resources r where r.id = p_id;
  elsif p_table = 'learning_assessments' then
    select jsonb_build_object(
      'row', to_jsonb(a) - v_life,
      'objectives', coalesce((select jsonb_agg(o.objective_id order by o.objective_id) from public.assessment_objectives o where o.assessment_id = a.id), '[]'),
      'questions', coalesce((select jsonb_agg(to_jsonb(q) - 'created_at' || jsonb_build_object('key', to_jsonb(k) - 'question_id' - 'assessment_id') order by q.position)
                             from public.assessment_questions q left join public.assessment_question_keys k on k.question_id = q.id
                             where q.assessment_id = a.id), '[]'))
    into v_doc from public.learning_assessments a where a.id = p_id;
  else
    raise exception 'invalid_reference: unknown content entity %', p_table;
  end if;
  if v_doc is null then return null; end if;
  return md5(v_doc::text);
end $$;

-- The whitelist of resource body blocks (mirrors src/features/learning/utils/toolkit.ts parseBlocks).
create or replace function public.content_body_problems(p_body jsonb)
returns text[] language plpgsql immutable set search_path = public as $$
declare
  v_problems text[] := '{}';
  v_block    jsonb;
  v_type     text;
  v_i        integer := 0;
  v_bad      integer;
begin
  if p_body is null or jsonb_typeof(p_body) <> 'object' then return array['body must be an object']; end if;
  if (p_body - 'blocks' - 'alt_text' - 'transcript') <> '{}'::jsonb then
    v_problems := v_problems || 'body has keys outside blocks, alt_text and transcript'::text;
  end if;
  if coalesce(jsonb_typeof(p_body -> 'alt_text'), 'string') <> 'string' or char_length(coalesce(p_body ->> 'alt_text', '')) > 500 then
    v_problems := v_problems || 'body.alt_text must be text of at most 500 characters'::text;
  end if;
  if coalesce(jsonb_typeof(p_body -> 'transcript'), 'string') <> 'string' or char_length(coalesce(p_body ->> 'transcript', '')) > 8000 then
    v_problems := v_problems || 'body.transcript must be text of at most 8000 characters'::text;
  end if;
  if coalesce(jsonb_typeof(p_body -> 'blocks'), '') <> 'array' then return v_problems || 'body.blocks must be an array'::text; end if;
  if jsonb_array_length(p_body -> 'blocks') = 0 then v_problems := v_problems || 'body.blocks is empty'::text; end if;
  if jsonb_array_length(p_body -> 'blocks') > 40 then return v_problems || 'body has more than 40 blocks'::text; end if;

  for v_block in select e from jsonb_array_elements(p_body -> 'blocks') e loop
    v_i := v_i + 1;
    if jsonb_typeof(v_block) <> 'object' then v_problems := v_problems || format('block %s is not an object', v_i); continue; end if;
    v_type := v_block ->> 'type';
    if v_type in ('heading', 'paragraph', 'tip') then
      if (v_block - 'type' - 'text') <> '{}'::jsonb then v_problems := v_problems || format('block %s has unsupported keys', v_i); end if;
      if coalesce(jsonb_typeof(v_block -> 'text'), '') <> 'string' or btrim(v_block ->> 'text') = '' or char_length(v_block ->> 'text') > 4000 then
        v_problems := v_problems || format('block %s needs text of 1 to 4000 characters', v_i);
      end if;
    elsif v_type in ('steps', 'numbered') then
      if (v_block - 'type' - 'items') <> '{}'::jsonb then v_problems := v_problems || format('block %s has unsupported keys', v_i); end if;
      if coalesce(jsonb_typeof(v_block -> 'items'), '') <> 'array' or jsonb_array_length(v_block -> 'items') not between 1 and 30 then
        v_problems := v_problems || format('block %s needs 1 to 30 items', v_i);
      else
        select count(*) into v_bad from jsonb_array_elements(v_block -> 'items') e
        where jsonb_typeof(e) <> 'string' or btrim(e #>> '{}') = '' or char_length(e #>> '{}') > 1000;
        if v_bad > 0 then v_problems := v_problems || format('block %s has items that are empty, too long or not text', v_i); end if;
      end if;
    elsif v_type = 'table' then
      if (v_block - 'type' - 'headers' - 'rows') <> '{}'::jsonb then v_problems := v_problems || format('block %s has unsupported keys', v_i); end if;
      if coalesce(jsonb_typeof(v_block -> 'headers'), '') <> 'array' or jsonb_array_length(v_block -> 'headers') not between 1 and 8 then
        v_problems := v_problems || format('block %s needs 1 to 8 headers', v_i);
      elsif coalesce(jsonb_typeof(v_block -> 'rows'), '') <> 'array' or jsonb_array_length(v_block -> 'rows') > 30 then
        v_problems := v_problems || format('block %s needs at most 30 rows', v_i);
      else
        select count(*) into v_bad from jsonb_array_elements(v_block -> 'headers') e where jsonb_typeof(e) <> 'string' or char_length(e #>> '{}') > 200;
        if v_bad > 0 then v_problems := v_problems || format('block %s has headers that are not short text', v_i); end if;
        select count(*) into v_bad from jsonb_array_elements(v_block -> 'rows') r
        where jsonb_typeof(r) <> 'array'
           or exists (select 1 from jsonb_array_elements(r) c where jsonb_typeof(c) <> 'string' or char_length(c #>> '{}') > 200);
        if v_bad > 0 then v_problems := v_problems || format('block %s has rows that are not lists of short text', v_i); end if;
      end if;
    else
      v_problems := v_problems || format('block %s has unsupported type', v_i);
    end if;
  end loop;
  return v_problems;
end $$;

-- All text leaves of a JSON document, joined (used by the text checks).
create or replace function public.content_json_text(p_doc jsonb)
returns text language sql immutable set search_path = public as $$
  select coalesce(string_agg(s #>> '{}', E'\n'), '')
  from jsonb_path_query(coalesce(p_doc, '{}'::jsonb), 'strict $.** ? (@.type() == "string")') s
$$;

-- Safety / quality findings for one piece of text. The "official claim" and "unsupported claim" rules apply
-- to AI-drafted text only: a model may not assert what the curriculum requires.
create or replace function public.content_text_findings(p_text text, p_path text, p_ai boolean)
returns jsonb[] language plpgsql immutable set search_path = public as $$
declare
  v_f jsonb[] := '{}';
  v_t text := coalesce(p_text, '');
begin
  if v_t = '' then return v_f; end if;
  if v_t ~* '(https?://|www\.)' then
    v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'safety', 'code', 'external_link', 'path', p_path,
      'message', 'Contains a web link. Content must be self-contained; links are not allowed.');
  end if;
  if v_t ~* '(ignore (all |any )?(previous|prior|above) instructions|system prompt|as an ai language model|<\s*script|javascript:)' then
    v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'safety', 'code', 'suspicious_text', 'path', p_path,
      'message', 'Contains text that looks like a prompt-injection or markup attempt.');
  end if;
  if v_t ~* '([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\m0[6-8][0-9][ -]?[0-9]{3}[ -]?[0-9]{4}\M|\+27[ ]?[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{4})' then
    v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'safety', 'code', 'personal_data', 'path', p_path,
      'message', 'Contains something that looks like an email address or phone number.');
  end if;
  if v_t ~* '(lorem ipsum|\mTODO\M|\mTBD\M|\[insert|\[your )' then
    v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'structure', 'code', 'placeholder_text', 'path', p_path,
      'message', 'Contains placeholder text.');
  end if;
  if v_t ~* '\m(alcohol|beer|wine|cigarettes?|gambl[a-z]*|gun|guns|weapons?|kill|murder|sex|drugs?)\M' then
    v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'safety', 'code', 'age_sensitive_text', 'path', p_path,
      'message', 'Mentions a topic that may not suit young learners. A reviewer must confirm it is appropriate.');
  end if;
  if p_ai then
    if v_t ~* '(\mCAPS\M|\mDBE\M|\mNCS\M|department of basic education|curriculum (requires|states|specifies|stipulates|prescribes)|the (national )?curriculum (says|demands))' then
      v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'curriculum', 'code', 'official_curriculum_claim', 'path', p_path,
        'message', 'AI-drafted text refers to official curriculum requirements. Remove it; alignment is shown only through verified source references.');
    end if;
    if v_t ~* '(research shows|studies show|scientists (say|agree)|experts agree|it is proven|proven to|guaranteed|statistics show)' then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'safety', 'code', 'unsupported_claim', 'path', p_path,
        'message', 'Makes a factual claim without a source. A reviewer must confirm or remove it.');
    end if;
  end if;
  return v_f;
end $$;

-- Structural checks on the AI payload, a backstop for the schema validation the Edge Function already did.
-- p_codes are the codes of the objectives the request was made for: a draft may only map to those.
create or replace function public.ai_payload_problems(p_payload jsonb, p_codes text[])
returns text[] language plpgsql immutable set search_path = public as $$
declare
  v_p     text[] := '{}';
  v_l     jsonb;
  v_r     jsonb;
  v_a     jsonb;
  v_q     jsonb;
  v_keys  text[] := '{}';
  v_key   text;
  v_i     integer;
  v_type  text;
  v_ans   jsonb;
  v_opts  jsonb;
  v_stage text[] := array['explain', 'show', 'try', 'practise', 'check', 'support', 'challenge', 'print'];
  v_kinds text[] := array['teacher_explanation', 'simplified_explanation', 'worked_example', 'diagram', 'illustration',
                          'animation', 'video', 'classroom_activity', 'group_activity', 'practical_activity', 'exercise',
                          'differentiated_exercise', 'quick_assessment', 'formative_questions', 'remediation',
                          'extension', 'worksheet', 'teacher_resource'];
  v_diff  text[] := array['foundational', 'standard', 'advanced'];
  v_fmt   text[] := array['visual', 'text', 'interactive', 'practical', 'teacher_led', 'printable', 'video_audio'];
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then return array['payload must be an object']; end if;
  if octet_length(p_payload::text) > 200000 then return array['payload is larger than 200 KB']; end if;
  if (p_payload - 'schema_version' - 'lesson' - 'resources' - 'activities' - 'assessment') <> '{}'::jsonb then
    v_p := v_p || 'payload has unsupported top-level keys'::text;
  end if;
  if p_payload ->> 'schema_version' is distinct from '1' then v_p := v_p || 'schema_version must be "1"'::text; end if;

  -- lesson
  v_l := p_payload -> 'lesson';
  if coalesce(jsonb_typeof(v_l), '') <> 'object' then
    v_p := v_p || 'lesson is required'::text;
  else
    if (v_l - 'title' - 'description' - 'estimated_minutes' - 'difficulty' - 'teacher_notes' - 'learner_instructions') <> '{}'::jsonb then
      v_p := v_p || 'lesson has unsupported keys'::text;
    end if;
    if coalesce(jsonb_typeof(v_l -> 'title'), '') <> 'string' or char_length(v_l ->> 'title') not between 3 and 200 then v_p := v_p || 'lesson.title must be 3 to 200 characters'::text; end if;
    if coalesce(jsonb_typeof(v_l -> 'description'), '') <> 'string' or char_length(v_l ->> 'description') not between 10 and 2000 then v_p := v_p || 'lesson.description must be 10 to 2000 characters'::text; end if;
    if coalesce(jsonb_typeof(v_l -> 'teacher_notes'), '') <> 'string' or char_length(v_l ->> 'teacher_notes') not between 20 and 4000 then v_p := v_p || 'lesson.teacher_notes must be 20 to 4000 characters'::text; end if;
    if v_l ? 'learner_instructions' and (coalesce(jsonb_typeof(v_l -> 'learner_instructions'), '') <> 'string' or char_length(v_l ->> 'learner_instructions') > 2000) then v_p := v_p || 'lesson.learner_instructions must be text of at most 2000 characters'::text; end if;
    if v_l ? 'difficulty' and (v_l ->> 'difficulty') <> all (v_diff) then v_p := v_p || 'lesson.difficulty is not recognised'::text; end if;
    if v_l ? 'estimated_minutes' and (coalesce(jsonb_typeof(v_l -> 'estimated_minutes'), '') <> 'number' or (v_l ->> 'estimated_minutes')::numeric not between 5 and 180 or (v_l ->> 'estimated_minutes')::numeric <> trunc((v_l ->> 'estimated_minutes')::numeric)) then
      v_p := v_p || 'lesson.estimated_minutes must be a whole number from 5 to 180'::text;
    end if;
  end if;

  -- resources
  if coalesce(jsonb_typeof(p_payload -> 'resources'), '') <> 'array' or jsonb_array_length(p_payload -> 'resources') not between 1 and 20 then
    v_p := v_p || 'resources must be a list of 1 to 20'::text;
  else
    v_i := 0;
    for v_r in select e from jsonb_array_elements(p_payload -> 'resources') e loop
      v_i := v_i + 1;
      if jsonb_typeof(v_r) <> 'object' then v_p := v_p || format('resource %s is not an object', v_i); continue; end if;
      if (v_r - 'key' - 'stage' - 'resource_kind' - 'title' - 'summary' - 'difficulty' - 'estimated_minutes' - 'delivery_formats'
            - 'connectivity' - 'device' - 'projector_required' - 'printable' - 'body') <> '{}'::jsonb then
        v_p := v_p || format('resource %s has unsupported keys', v_i);
      end if;
      v_key := v_r ->> 'key';
      if coalesce(jsonb_typeof(v_r -> 'key'), '') <> 'string' or v_key !~ '^[a-z0-9_]{1,40}$' then
        v_p := v_p || format('resource %s needs a key of lowercase letters, digits and underscores', v_i);
      elsif v_key = any (v_keys) then
        v_p := v_p || format('resource key %s is repeated', v_key);
      else
        v_keys := v_keys || v_key;
      end if;
      if coalesce(v_r ->> 'stage', '') <> all (v_stage) or (v_r ->> 'stage') is null then v_p := v_p || format('resource %s has an unknown stage', v_i); end if;
      if coalesce(v_r ->> 'resource_kind', '') <> all (v_kinds) or (v_r ->> 'resource_kind') is null then v_p := v_p || format('resource %s has an unknown kind', v_i); end if;
      if coalesce(jsonb_typeof(v_r -> 'title'), '') <> 'string' or char_length(v_r ->> 'title') not between 3 and 200 then v_p := v_p || format('resource %s needs a title of 3 to 200 characters', v_i); end if;
      if v_r ? 'summary' and (coalesce(jsonb_typeof(v_r -> 'summary'), '') <> 'string' or char_length(v_r ->> 'summary') > 1000) then v_p := v_p || format('resource %s summary is too long', v_i); end if;
      if v_r ? 'difficulty' and (v_r ->> 'difficulty') <> all (v_diff) then v_p := v_p || format('resource %s has an unknown difficulty', v_i); end if;
      if v_r ? 'connectivity' and (v_r ->> 'connectivity') <> all (array['none', 'low', 'online']) then v_p := v_p || format('resource %s has an unknown connectivity', v_i); end if;
      if v_r ? 'device' and (v_r ->> 'device') <> all (array['none', 'teacher_device', 'shared_device', 'learner_device']) then v_p := v_p || format('resource %s has an unknown device', v_i); end if;
      if v_r ? 'projector_required' and jsonb_typeof(v_r -> 'projector_required') <> 'boolean' then v_p := v_p || format('resource %s projector_required must be true or false', v_i); end if;
      if v_r ? 'printable' and jsonb_typeof(v_r -> 'printable') <> 'boolean' then v_p := v_p || format('resource %s printable must be true or false', v_i); end if;
      if v_r ? 'estimated_minutes' and (coalesce(jsonb_typeof(v_r -> 'estimated_minutes'), '') <> 'number' or (v_r ->> 'estimated_minutes')::numeric not between 1 and 180 or (v_r ->> 'estimated_minutes')::numeric <> trunc((v_r ->> 'estimated_minutes')::numeric)) then
        v_p := v_p || format('resource %s estimated_minutes must be a whole number from 1 to 180', v_i);
      end if;
      if v_r ? 'delivery_formats' then
        if coalesce(jsonb_typeof(v_r -> 'delivery_formats'), '') <> 'array' or jsonb_array_length(v_r -> 'delivery_formats') not between 1 and 7
           or exists (select 1 from jsonb_array_elements(v_r -> 'delivery_formats') f where jsonb_typeof(f) <> 'string' or (f #>> '{}') <> all (v_fmt)) then
          v_p := v_p || format('resource %s has unknown delivery formats', v_i);
        end if;
      end if;
      if (v_r ->> 'stage') = 'print' and (v_r -> 'printable') is distinct from 'true'::jsonb then
        v_p := v_p || format('resource %s is a print resource and must be printable', v_i);
      end if;
      v_p := v_p || array(select format('resource %s: %s', v_i, x) from unnest(public.content_body_problems(v_r -> 'body')) x);
    end loop;
  end if;

  -- activities
  if p_payload ? 'activities' then
    if coalesce(jsonb_typeof(p_payload -> 'activities'), '') <> 'array' or jsonb_array_length(p_payload -> 'activities') > 12 then
      v_p := v_p || 'activities must be a list of at most 12'::text;
    else
      v_i := 0;
      for v_a in select e from jsonb_array_elements(p_payload -> 'activities') e loop
        v_i := v_i + 1;
        if jsonb_typeof(v_a) <> 'object' then v_p := v_p || format('activity %s is not an object', v_i); continue; end if;
        if (v_a - 'title' - 'instructions' - 'activity_type' - 'grouping' - 'difficulty' - 'estimated_minutes' - 'resource_key') <> '{}'::jsonb then v_p := v_p || format('activity %s has unsupported keys', v_i); end if;
        if coalesce(jsonb_typeof(v_a -> 'title'), '') <> 'string' or char_length(v_a ->> 'title') not between 3 and 200 then v_p := v_p || format('activity %s needs a title', v_i); end if;
        if coalesce(jsonb_typeof(v_a -> 'instructions'), '') <> 'string' or char_length(v_a ->> 'instructions') not between 10 and 3000 then v_p := v_p || format('activity %s needs instructions of 10 to 3000 characters', v_i); end if;
        if coalesce(v_a ->> 'activity_type', '') <> all (array['individual_practice', 'pair_work', 'group_work', 'practical', 'game', 'discussion', 'worksheet', 'teacher_led']) or (v_a ->> 'activity_type') is null then v_p := v_p || format('activity %s has an unknown type', v_i); end if;
        if v_a ? 'grouping' and (v_a ->> 'grouping') <> all (array['individual', 'pair', 'small_group', 'whole_class']) then v_p := v_p || format('activity %s has an unknown grouping', v_i); end if;
        if v_a ? 'difficulty' and (v_a ->> 'difficulty') <> all (v_diff) then v_p := v_p || format('activity %s has an unknown difficulty', v_i); end if;
        if v_a ? 'estimated_minutes' and (coalesce(jsonb_typeof(v_a -> 'estimated_minutes'), '') <> 'number' or (v_a ->> 'estimated_minutes')::numeric not between 1 and 180 or (v_a ->> 'estimated_minutes')::numeric <> trunc((v_a ->> 'estimated_minutes')::numeric)) then
          v_p := v_p || format('activity %s estimated_minutes must be a whole number from 1 to 180', v_i);
        end if;
        if v_a ? 'resource_key' and (coalesce(jsonb_typeof(v_a -> 'resource_key'), '') <> 'string' or (v_a ->> 'resource_key') <> all (v_keys)) then
          v_p := v_p || format('activity %s points at a resource that does not exist', v_i);
        end if;
      end loop;
    end if;
  end if;

  -- assessment
  if p_payload ? 'assessment' and jsonb_typeof(p_payload -> 'assessment') <> 'null' then
    if jsonb_typeof(p_payload -> 'assessment') <> 'object' then
      v_p := v_p || 'assessment must be an object'::text;
    else
      if ((p_payload -> 'assessment') - 'title' - 'purpose' - 'difficulty' - 'estimated_minutes' - 'questions') <> '{}'::jsonb then v_p := v_p || 'assessment has unsupported keys'::text; end if;
      if coalesce(jsonb_typeof(p_payload -> 'assessment' -> 'title'), '') <> 'string' or char_length(p_payload -> 'assessment' ->> 'title') not between 3 and 200 then v_p := v_p || 'assessment.title must be 3 to 200 characters'::text; end if;
      if (p_payload -> 'assessment') ? 'purpose' and (p_payload -> 'assessment' ->> 'purpose') <> all (array['diagnostic', 'formative', 'summative_check']) then v_p := v_p || 'assessment.purpose is not recognised'::text; end if;
      if (p_payload -> 'assessment') ? 'difficulty' and (p_payload -> 'assessment' ->> 'difficulty') <> all (v_diff) then v_p := v_p || 'assessment.difficulty is not recognised'::text; end if;
      if coalesce(jsonb_typeof(p_payload -> 'assessment' -> 'questions'), '') <> 'array' or jsonb_array_length(p_payload -> 'assessment' -> 'questions') not between 3 and 20 then
        v_p := v_p || 'assessment.questions must be a list of 3 to 20'::text;
      else
        v_i := 0;
        for v_q in select e from jsonb_array_elements(p_payload -> 'assessment' -> 'questions') e loop
          v_i := v_i + 1;
          if jsonb_typeof(v_q) <> 'object' then v_p := v_p || format('question %s is not an object', v_i); continue; end if;
          if (v_q - 'question_type' - 'prompt' - 'options' - 'marks' - 'objective_code' - 'difficulty' - 'answer' - 'feedback' - 'marking_notes') <> '{}'::jsonb then v_p := v_p || format('question %s has unsupported keys', v_i); end if;
          v_type := v_q ->> 'question_type';
          if coalesce(v_type, '') <> all (array['multiple_choice', 'true_false', 'numeric', 'short_answer']) or v_type is null then v_p := v_p || format('question %s has an unknown type', v_i); continue; end if;
          if coalesce(jsonb_typeof(v_q -> 'prompt'), '') <> 'string' or char_length(v_q ->> 'prompt') not between 5 and 1000 then v_p := v_p || format('question %s needs a prompt of 5 to 1000 characters', v_i); end if;
          if coalesce(jsonb_typeof(v_q -> 'marks'), '') <> 'number' or (v_q ->> 'marks')::numeric not between 1 and 10 or (v_q ->> 'marks')::numeric <> trunc((v_q ->> 'marks')::numeric) then v_p := v_p || format('question %s marks must be a whole number from 1 to 10', v_i); end if;
          if coalesce(jsonb_typeof(v_q -> 'objective_code'), '') <> 'string' or (v_q ->> 'objective_code') <> all (p_codes) then v_p := v_p || format('question %s must map to one of the requested objectives', v_i); end if;
          if v_q ? 'difficulty' and (v_q ->> 'difficulty') <> all (v_diff) then v_p := v_p || format('question %s has an unknown difficulty', v_i); end if;
          if v_q ? 'feedback' and (coalesce(jsonb_typeof(v_q -> 'feedback'), '') <> 'string' or char_length(v_q ->> 'feedback') > 1000) then v_p := v_p || format('question %s feedback is too long', v_i); end if;
          if v_q ? 'marking_notes' and (coalesce(jsonb_typeof(v_q -> 'marking_notes'), '') <> 'string' or char_length(v_q ->> 'marking_notes') > 1000) then v_p := v_p || format('question %s marking_notes is too long', v_i); end if;
          v_ans := v_q -> 'answer';
          v_opts := v_q -> 'options';
          if v_ans is null then
            v_p := v_p || format('question %s needs an answer', v_i);
          elsif v_type = 'multiple_choice' then
            if coalesce(jsonb_typeof(v_opts), '') <> 'array' or jsonb_array_length(v_opts) not between 2 and 6
               or exists (select 1 from jsonb_array_elements(v_opts) o where jsonb_typeof(o) <> 'string' or btrim(o #>> '{}') = '' or char_length(o #>> '{}') > 200)
               or (select count(distinct o #>> '{}') from jsonb_array_elements(v_opts) o) <> jsonb_array_length(v_opts) then
              v_p := v_p || format('question %s needs 2 to 6 distinct, short options', v_i);
            elsif jsonb_typeof(v_ans) <> 'string' or not (v_opts @> to_jsonb(v_ans #>> '{}')) then
              v_p := v_p || format('question %s answer must be one of its options', v_i);
            end if;
          elsif v_type = 'true_false' then
            if jsonb_typeof(v_ans) <> 'boolean' then v_p := v_p || format('question %s answer must be true or false', v_i); end if;
          elsif v_type = 'numeric' then
            if jsonb_typeof(v_ans) <> 'number' then v_p := v_p || format('question %s answer must be a number', v_i); end if;
          else
            if not (jsonb_typeof(v_ans) = 'string' and btrim(v_ans #>> '{}') <> ''
                    or jsonb_typeof(v_ans) = 'array' and jsonb_array_length(v_ans) between 1 and 10
                       and not exists (select 1 from jsonb_array_elements(v_ans) e where jsonb_typeof(e) <> 'string' or btrim(e #>> '{}') = '')) then
              v_p := v_p || format('question %s answer must be text or a short list of text', v_i);
            end if;
          end if;
        end loop;
      end if;
    end if;
  end if;
  return v_p;
end $$;

-- AI-origin content may not change its origin once created ("laundering" an AI draft as authored).
create or replace function public.content_origin_lock()
returns trigger language plpgsql as $$
begin
  if old.origin = 'ai_draft' and new.origin is distinct from old.origin then
    raise exception 'insufficient_privilege: the origin of AI-assisted content cannot be changed';
  end if;
  return new;
end $$;

-- The gate every AI-origin unit must pass to be approved or published, whoever makes the change:
--   1. its latest validation run passed (no error findings),
--   2. that run is for exactly the content as it is now,
--   3. every warning in it was acknowledged by a reviewer,
--   4. a reviewer other than the requester marked it reviewed (or verified) against that same content.
create or replace function public.ai_content_gate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_run     public.content_validation_runs;
  v_now     text;
  v_ver     public.content_verifications;
begin
  if new.origin <> 'ai_draft' or new.status is not distinct from old.status or new.status not in ('approved', 'published') then
    return new;
  end if;
  v_now := public.content_fingerprint(tg_table_name, new.id);
  select * into v_run from public.content_validation_runs
  where entity_table = tg_table_name and entity_id = new.id order by created_at desc, id desc limit 1;
  if v_run.id is null or not v_run.passed then
    raise exception 'invalid_state: AI-assisted content needs a passing validation run before it can be %', new.status;
  end if;
  if v_run.content_fingerprint is distinct from v_now then
    raise exception 'invalid_state: this content changed after it was last validated; validate it again';
  end if;
  if exists (select 1 from public.content_validation_findings f
             where f.run_id = v_run.id and f.severity = 'warning' and f.acknowledged_at is null) then
    raise exception 'invalid_state: every validation warning must be acknowledged by a reviewer first';
  end if;
  select * into v_ver from public.content_verifications where entity_table = tg_table_name and entity_id = new.id;
  if v_ver.entity_id is null or v_ver.status < 'reviewed' or v_ver.fingerprint is distinct from v_now then
    raise exception 'invalid_state: AI-assisted content must be marked reviewed against its sources, as it currently reads, before it can be %', new.status;
  end if;
  return new;
end $$;

create trigger lessons_origin_lock before update on public.lessons for each row execute function public.content_origin_lock();
create trigger teaching_resources_origin_lock before update on public.teaching_resources for each row execute function public.content_origin_lock();
create trigger learning_assessments_origin_lock before update on public.learning_assessments for each row execute function public.content_origin_lock();
create trigger lessons_ai_gate before update of status on public.lessons for each row execute function public.ai_content_gate();
create trigger teaching_resources_ai_gate before update of status on public.teaching_resources for each row execute function public.ai_content_gate();
create trigger learning_assessments_ai_gate before update of status on public.learning_assessments for each row execute function public.ai_content_gate();

create trigger curriculum_sources_set_updated_at before update on public.curriculum_sources for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RPCs: sources, references, verification
-- ---------------------------------------------------------------------------

create or replace function public.register_curriculum_source(
  p_title text, p_publisher text, p_doc_type text, p_licence text,
  p_url text default null, p_edition text default null, p_excerpts_permitted boolean default false,
  p_checksum_sha256 text default null, p_retrieved_on date default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators register curriculum sources';
  end if;
  insert into public.curriculum_sources (title, publisher, doc_type, licence, url, edition, excerpts_permitted, checksum_sha256, retrieved_on, note, registered_by)
  values (p_title, p_publisher, p_doc_type, p_licence, p_url, p_edition, coalesce(p_excerpts_permitted, false), p_checksum_sha256, p_retrieved_on, p_note, auth.uid())
  returning id into v_id;
  perform public.write_audit_log(null, auth.uid(), 'curriculum_source_registered', 'curriculum_sources', v_id, null,
    jsonb_build_object('title', p_title, 'publisher', p_publisher, 'doc_type', p_doc_type));
  return v_id;
end $$;

create or replace function public.verify_curriculum_source(p_source_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators verify curriculum sources';
  end if;
  update public.curriculum_sources
     set status = 'verified', verified_by = auth.uid(), verified_at = now(), note = coalesce(p_note, note)
   where id = p_source_id and status = 'registered';
  if not found then raise exception 'invalid_state: source not found or not awaiting verification'; end if;
  perform public.write_audit_log(null, auth.uid(), 'curriculum_source_verified', 'curriculum_sources', p_source_id, null,
    jsonb_build_object('note', p_note));
end $$;

create or replace function public.add_content_source_reference(p_entity text, p_id uuid, p_source_id uuid, p_locator text, p_supports text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_found boolean;
  v_id    uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators manage source references';
  end if;
  if p_entity not in ('lessons', 'teaching_resources', 'learning_assessments') then
    raise exception 'invalid_reference: unknown content entity %', p_entity;
  end if;
  execute format('select exists (select 1 from public.%I where id = $1)', p_entity) into v_found using p_id;
  if not v_found then raise exception 'not_found: no % %', p_entity, p_id; end if;
  if not exists (select 1 from public.curriculum_sources where id = p_source_id and status <> 'retired') then
    raise exception 'invalid_reference: unknown or retired source';
  end if;
  insert into public.content_source_references (entity_table, entity_id, source_id, locator, supports, added_by)
  values (p_entity, p_id, p_source_id, p_locator, p_supports, auth.uid())
  returning id into v_id;
  perform public.write_audit_log(null, auth.uid(), 'content_source_added', p_entity, p_id, null,
    jsonb_build_object('source_id', p_source_id, 'locator', p_locator));
  return v_id;
end $$;

create or replace function public.check_content_source_reference(p_reference_id uuid, p_result text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_ref public.content_source_references;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators check source references';
  end if;
  if p_result not in ('matches', 'partial', 'does_not_match') then
    raise exception 'invalid_argument: result must be matches, partial or does_not_match';
  end if;
  update public.content_source_references
     set check_result = p_result, check_note = p_note, checked_by = auth.uid(), checked_at = now()
   where id = p_reference_id returning * into v_ref;
  if v_ref.id is null then raise exception 'not_found: no source reference %', p_reference_id; end if;
  perform public.write_audit_log(null, auth.uid(), 'content_source_checked', v_ref.entity_table, v_ref.entity_id, null,
    jsonb_build_object('reference_id', p_reference_id, 'result', p_result));
end $$;

-- Raise or lower the verification level of a unit. Never called by the generator.
--   source_backed  at least one source reference
--   reviewed       every reference checked, none contradicting, unit past draft, and (for AI content) not by its requester
--   verified       every reference checked as 'matches' against a verified source; same independence rule
create or replace function public.set_content_verification(p_entity text, p_id uuid, p_status public.content_verification_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_origin  text;
  v_creator uuid;
  v_status  text;
  v_actor   uuid := auth.uid();
  v_refs    integer;
  v_fp      text;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators set verification';
  end if;
  if p_entity not in ('lessons', 'teaching_resources', 'learning_assessments') then
    raise exception 'invalid_reference: unknown content entity %', p_entity;
  end if;
  execute format('select origin::text, created_by, status::text from public.%I where id = $1', p_entity) into v_origin, v_creator, v_status using p_id;
  if v_status is null then raise exception 'not_found: no % %', p_entity, p_id; end if;

  select count(*) into v_refs from public.content_source_references where entity_table = p_entity and entity_id = p_id;
  if p_status >= 'source_backed' and v_refs = 0 then
    raise exception 'invalid_state: add at least one source reference first';
  end if;
  if p_status >= 'reviewed' then
    if v_status = 'draft' then
      raise exception 'invalid_state: submit the content for review before marking it reviewed';
    end if;
    if exists (select 1 from public.content_source_references where entity_table = p_entity and entity_id = p_id and (check_result is null or check_result = 'does_not_match')) then
      raise exception 'invalid_state: every source reference must be checked and none may contradict the content';
    end if;
    if v_origin = 'ai_draft' and v_creator is not distinct from v_actor then
      raise exception 'insufficient_privilege: AI-assisted content must be reviewed by someone other than the person who requested it';
    end if;
  end if;
  if p_status = 'verified' then
    if exists (select 1 from public.content_source_references r join public.curriculum_sources s on s.id = r.source_id
               where r.entity_table = p_entity and r.entity_id = p_id and (r.check_result <> 'matches' or s.status <> 'verified')) then
      raise exception 'invalid_state: verified needs every reference to match a verified source';
    end if;
  end if;

  v_fp := public.content_fingerprint(p_entity, p_id);
  insert into public.content_verifications (entity_table, entity_id, status, fingerprint, note, set_by, set_at)
  values (p_entity, p_id, p_status, v_fp, p_note, v_actor, now())
  on conflict (entity_table, entity_id) do update
    set status = excluded.status, fingerprint = excluded.fingerprint, note = excluded.note, set_by = excluded.set_by, set_at = excluded.set_at;
  perform public.write_audit_log(null, v_actor, 'content_verification_' || p_status::text, p_entity, p_id, null,
    jsonb_build_object('status', p_status, 'note', p_note));
end $$;

-- ---------------------------------------------------------------------------
-- 6. RPCs: generation lifecycle
-- ---------------------------------------------------------------------------

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

-- What the prompt may be built from: taken from the database for this request, never from client input.
create or replace function public.ai_generation_context(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_req public.ai_generation_requests;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators can read generation context';
  end if;
  select * into v_req from public.ai_generation_requests where id = p_request_id and requested_by = auth.uid();
  if v_req.id is null then raise exception 'not_found: no generation request %', p_request_id; end if;
  return (
    select jsonb_build_object(
      'request_id', v_req.id,
      'language', v_req.language,
      'instruction', v_req.instruction,
      'phase', ph.name, 'grade', g.name, 'subject', s.name, 'term', t.term_number,
      'topic', jsonb_build_object('code', tp.code, 'title', tp.title, 'description', tp.description),
      'objectives', (select jsonb_agg(jsonb_build_object('code', o.code, 'description', o.description) order by o.sort_order, o.code)
                     from public.curriculum_objectives o where o.id = any (v_req.objective_ids)),
      'existing_titles', coalesce((select jsonb_agg(l.title order by l.title) from public.lessons l where l.topic_id = tp.id and l.status <> 'retired'), '[]'))
    from public.curriculum_topics tp
    join public.curriculum_terms t on t.id = tp.term_id
    join public.curriculum_grade_subjects gs on gs.id = t.grade_subject_id
    join public.curriculum_grades g on g.id = gs.grade_id
    join public.curriculum_phases ph on ph.id = g.phase_id
    join public.curriculum_subjects s on s.id = gs.subject_id
    where tp.id = v_req.topic_id);
end $$;

create or replace function public.ai_fail_generation(p_request_id uuid, p_status text, p_reasons jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_reasons jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators can update generation requests';
  end if;
  if p_status not in ('rejected_output', 'failed') then
    raise exception 'invalid_argument: status must be rejected_output or failed';
  end if;
  v_reasons := case when jsonb_typeof(p_reasons) = 'array'
    then coalesce((select jsonb_agg(left(e #>> '{}', 300)) from (select e from jsonb_array_elements(p_reasons) e limit 20) s), '[]'::jsonb)
    else '[]'::jsonb end;
  update public.ai_generation_requests
     set status = p_status::public.ai_generation_status, rejection_reasons = v_reasons, completed_at = now()
   where id = p_request_id and requested_by = auth.uid() and status = 'generating';
  if not found then raise exception 'invalid_state: request not found or already finished'; end if;
  perform public.write_audit_log(null, auth.uid(), 'ai_generation_' || p_status, 'ai_generation_requests', p_request_id, null,
    jsonb_build_object('reasons', v_reasons));
end $$;

-- Turn a model's structured output into DRAFT rows. Everything is created as origin ai_draft / status draft,
-- by the requesting administrator, linked only to the objectives the request named.
-- Malformed output is recorded as rejected_output and nothing is written; the function then returns ok = false.
create or replace function public.ai_ingest_draft(p_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor    uuid := auth.uid();
  v_req      public.ai_generation_requests;
  v_codes    text[];
  v_problems text[];
  v_disc     text;
  v_lesson   uuid;
  v_r        jsonb;
  v_a        jsonb;
  v_q        jsonb;
  v_rid      uuid;
  v_qid      uuid;
  v_aid      uuid;
  v_map      jsonb := '{}'::jsonb;
  v_res_ids  uuid[] := '{}';
  v_i        integer;
  v_msg      text;
  v_obj      uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators can create AI drafts';
  end if;
  select * into v_req from public.ai_generation_requests where id = p_request_id and requested_by = v_actor for update;
  if v_req.id is null then raise exception 'not_found: no generation request %', p_request_id; end if;
  if v_req.status <> 'generating' then raise exception 'invalid_state: this request has already finished'; end if;
  if v_req.created_at < now() - interval '30 minutes' then
    update public.ai_generation_requests set status = 'failed', rejection_reasons = '["expired"]'::jsonb, completed_at = now() where id = v_req.id;
    return jsonb_build_object('ok', false, 'status', 'failed', 'reasons', jsonb_build_array('expired'));
  end if;

  select array_agg(code order by code) into v_codes from public.curriculum_objectives where id = any (v_req.objective_ids);
  v_problems := public.ai_payload_problems(p_payload, v_codes);
  if cardinality(v_problems) > 0 then
    update public.ai_generation_requests
       set status = 'rejected_output', rejection_reasons = to_jsonb(v_problems[1:20]), completed_at = now(),
           output_hash = md5(coalesce(p_payload::text, ''))
     where id = v_req.id;
    perform public.write_audit_log(null, v_actor, 'ai_generation_rejected_output', 'ai_generation_requests', v_req.id, null,
      jsonb_build_object('problem_count', cardinality(v_problems)));
    return jsonb_build_object('ok', false, 'status', 'rejected_output', 'reasons', to_jsonb(v_problems[1:20]));
  end if;

  v_disc := format('AI-assisted draft (%s, prompt %s). It has not been checked against official curriculum documents unless its verification status says so.', v_req.model, v_req.prompt_version);

  begin
    insert into public.lessons (curriculum_version_id, grade_subject_id, topic_id, title, description, estimated_minutes, difficulty, language,
                                teacher_notes, learner_instructions, sort_order, origin, ai_disclosure, created_by)
    values (v_req.curriculum_version_id, v_req.grade_subject_id, v_req.topic_id,
            btrim(p_payload -> 'lesson' ->> 'title'), btrim(p_payload -> 'lesson' ->> 'description'),
            (p_payload -> 'lesson' ->> 'estimated_minutes')::integer,
            coalesce((p_payload -> 'lesson' ->> 'difficulty')::public.content_difficulty, 'standard'), v_req.language,
            p_payload -> 'lesson' ->> 'teacher_notes', p_payload -> 'lesson' ->> 'learner_instructions',
            coalesce((select max(sort_order) from public.lessons where topic_id = v_req.topic_id), 0) + 1,
            'ai_draft', v_disc, v_actor)
    returning id into v_lesson;

    v_i := 0;
    for v_obj in select unnest(v_req.objective_ids) loop
      v_i := v_i + 1;
      insert into public.lesson_objectives (lesson_id, objective_id, curriculum_version_id, is_primary)
      values (v_lesson, v_obj, v_req.curriculum_version_id, v_i = 1);
    end loop;

    v_i := 0;
    for v_r in select e from jsonb_array_elements(p_payload -> 'resources') e loop
      v_i := v_i + 1;
      insert into public.teaching_resources
        (curriculum_version_id, grade_subject_id, topic_id, stage, resource_kind, title, summary, body, difficulty, language, estimated_minutes,
         delivery_formats, connectivity, device, projector_required, printable, cacheable, size_kb, origin, ai_disclosure, created_by)
      values (v_req.curriculum_version_id, v_req.grade_subject_id, v_req.topic_id,
              (v_r ->> 'stage')::public.toolkit_stage, v_r ->> 'resource_kind', btrim(v_r ->> 'title'), v_r ->> 'summary', v_r -> 'body',
              coalesce((v_r ->> 'difficulty')::public.content_difficulty, 'standard'), v_req.language,
              (v_r ->> 'estimated_minutes')::integer,
              coalesce(array(select jsonb_array_elements_text(v_r -> 'delivery_formats')), array['text']),
              coalesce((v_r ->> 'connectivity')::public.connectivity_need, 'none'),
              coalesce((v_r ->> 'device')::public.device_need, 'teacher_device'),
              coalesce((v_r ->> 'projector_required')::boolean, false),
              coalesce((v_r ->> 'printable')::boolean, false),
              true, greatest(1, ceil(octet_length((v_r -> 'body')::text) / 1024.0)::integer),
              'ai_draft', v_disc, v_actor)
      returning id into v_rid;
      v_map := v_map || jsonb_build_object(v_r ->> 'key', v_rid);
      v_res_ids := v_res_ids || v_rid;
      insert into public.lesson_resources (lesson_id, resource_id, curriculum_version_id, sort_order) values (v_lesson, v_rid, v_req.curriculum_version_id, v_i);
      for v_obj in select unnest(v_req.objective_ids) loop
        insert into public.resource_objectives (resource_id, objective_id, curriculum_version_id) values (v_rid, v_obj, v_req.curriculum_version_id);
      end loop;
      insert into public.ai_generation_outputs (request_id, entity_table, entity_id) values (v_req.id, 'teaching_resources', v_rid);
    end loop;

    v_i := 0;
    for v_a in select e from jsonb_array_elements(coalesce(p_payload -> 'activities', '[]'::jsonb)) e loop
      v_i := v_i + 1;
      insert into public.learning_activities (lesson_id, curriculum_version_id, title, instructions, activity_type, grouping, difficulty, estimated_minutes, resource_id, sort_order)
      values (v_lesson, v_req.curriculum_version_id, btrim(v_a ->> 'title'), v_a ->> 'instructions', v_a ->> 'activity_type',
              coalesce(v_a ->> 'grouping', 'individual'), coalesce((v_a ->> 'difficulty')::public.content_difficulty, 'standard'),
              (v_a ->> 'estimated_minutes')::integer, (v_map ->> (v_a ->> 'resource_key'))::uuid, v_i);
    end loop;

    insert into public.ai_generation_outputs (request_id, entity_table, entity_id) values (v_req.id, 'lessons', v_lesson);

    if jsonb_typeof(p_payload -> 'assessment') = 'object' then
      insert into public.learning_assessments (curriculum_version_id, grade_subject_id, topic_id, lesson_id, title, purpose, difficulty, estimated_minutes, language, origin, ai_disclosure, created_by)
      values (v_req.curriculum_version_id, v_req.grade_subject_id, v_req.topic_id, v_lesson,
              btrim(p_payload -> 'assessment' ->> 'title'), coalesce(p_payload -> 'assessment' ->> 'purpose', 'formative'),
              coalesce((p_payload -> 'assessment' ->> 'difficulty')::public.content_difficulty, 'standard'),
              (p_payload -> 'assessment' ->> 'estimated_minutes')::integer, v_req.language, 'ai_draft', v_disc, v_actor)
      returning id into v_aid;
      for v_obj in
        select o.id from public.curriculum_objectives o
        where o.id = any (v_req.objective_ids)
          and o.code in (select q ->> 'objective_code' from jsonb_array_elements(p_payload -> 'assessment' -> 'questions') q)
      loop
        insert into public.assessment_objectives (assessment_id, objective_id, curriculum_version_id) values (v_aid, v_obj, v_req.curriculum_version_id);
      end loop;
      v_i := 0;
      for v_q in select e from jsonb_array_elements(p_payload -> 'assessment' -> 'questions') e loop
        v_i := v_i + 1;
        insert into public.assessment_questions (assessment_id, curriculum_version_id, position, question_type, prompt, options, marks, objective_id, difficulty)
        values (v_aid, v_req.curriculum_version_id, v_i, v_q ->> 'question_type', btrim(v_q ->> 'prompt'),
                coalesce(v_q -> 'options', '[]'::jsonb), (v_q ->> 'marks')::integer,
                (select o.id from public.curriculum_objectives o where o.id = any (v_req.objective_ids) and o.code = v_q ->> 'objective_code'),
                coalesce((v_q ->> 'difficulty')::public.content_difficulty, 'standard'))
        returning id into v_qid;
        insert into public.assessment_question_keys (question_id, assessment_id, answer, feedback, marking_notes)
        values (v_qid, v_aid, v_q -> 'answer', v_q ->> 'feedback',
                'AI-proposed answer: a reviewer must confirm it.' || coalesce(' ' || (v_q ->> 'marking_notes'), ''));
      end loop;
      insert into public.ai_generation_outputs (request_id, entity_table, entity_id) values (v_req.id, 'learning_assessments', v_aid);
    end if;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    update public.ai_generation_requests
       set status = 'rejected_output', rejection_reasons = jsonb_build_array(left(v_msg, 300)), completed_at = now(),
           output_hash = md5(p_payload::text)
     where id = v_req.id;
    return jsonb_build_object('ok', false, 'status', 'rejected_output', 'reasons', jsonb_build_array(left(v_msg, 300)));
  end;

  update public.ai_generation_requests
     set status = 'draft_created', accepted_payload = p_payload, output_hash = md5(p_payload::text),
         result_lesson_id = v_lesson, completed_at = now()
   where id = v_req.id;
  perform public.write_audit_log(null, v_actor, 'ai_draft_created', 'ai_generation_requests', v_req.id, null,
    jsonb_build_object('lesson_id', v_lesson, 'resource_count', cardinality(v_res_ids), 'assessment_id', v_aid));
  return jsonb_build_object('ok', true, 'status', 'draft_created', 'lesson_id', v_lesson, 'resource_ids', to_jsonb(v_res_ids), 'assessment_id', v_aid);
end $$;

-- ---------------------------------------------------------------------------
-- 7. RPC: validation
-- ---------------------------------------------------------------------------

create or replace function public.validate_content(p_entity text, p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor  uuid := auth.uid();
  v_row    jsonb;
  v_ai     boolean;
  v_f      jsonb[] := '{}';
  v_run    uuid;
  v_errors integer;
  v_warns  integer;
  v_infos  integer;
  v_count  integer;
  v_x      record;
  v_text   text;
  v_obj    text;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators validate content';
  end if;
  if p_entity not in ('lessons', 'teaching_resources', 'learning_assessments') then
    raise exception 'invalid_reference: unknown content entity %', p_entity;
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_entity) into v_row using p_id;
  if v_row is null then raise exception 'not_found: no % %', p_entity, p_id; end if;
  v_ai := v_row ->> 'origin' = 'ai_draft';

  if p_entity = 'lessons' then
    select count(*) into v_count from public.lesson_objectives where lesson_id = p_id;
    if v_count = 0 then
      v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'curriculum', 'code', 'no_objectives', 'message', 'The lesson is not linked to any curriculum objective.', 'path', 'objectives');
    end if;
    for v_x in select o.code, o.status from public.lesson_objectives lo join public.curriculum_objectives o on o.id = lo.objective_id
               where lo.lesson_id = p_id and o.status not in ('approved', 'published') loop
      v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'curriculum', 'code', 'objective_not_approved',
        'message', format('Objective %s is %s; content may only target approved objectives.', v_x.code, v_x.status), 'path', 'objectives');
    end loop;

    select count(*) into v_count from public.lesson_resources where lesson_id = p_id;
    if v_count = 0 then
      v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'structure', 'code', 'no_resources', 'message', 'The lesson has no toolkit resources.', 'path', 'resources');
    end if;
    foreach v_obj in array array['explain', 'practise_or_try', 'check', 'support'] loop
      select count(*) into v_count from public.lesson_resources lr join public.teaching_resources r on r.id = lr.resource_id
      where lr.lesson_id = p_id and (case v_obj when 'practise_or_try' then r.stage in ('practise', 'try') else r.stage::text = v_obj end);
      if v_count = 0 then
        v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'structure', 'code', 'toolkit_missing_' || v_obj,
          'message', format('The toolkit has no %s resource.', replace(v_obj, '_', ' ')), 'path', 'resources');
      end if;
    end loop;
    foreach v_obj in array array['challenge', 'print'] loop
      select count(*) into v_count from public.lesson_resources lr join public.teaching_resources r on r.id = lr.resource_id
      where lr.lesson_id = p_id and r.stage::text = v_obj;
      if v_count = 0 then
        v_f := v_f || jsonb_build_object('severity', 'info', 'category', 'structure', 'code', 'toolkit_missing_' || v_obj,
          'message', format('The toolkit has no %s resource yet.', v_obj), 'path', 'resources');
      end if;
    end loop;

    if not exists (select 1 from public.lesson_resources lr join public.teaching_resources r on r.id = lr.resource_id
                   where lr.lesson_id = p_id and not r.projector_required and r.connectivity = 'none' and r.device in ('none', 'teacher_device')) then
      v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'delivery', 'code', 'no_low_resource_path',
        'message', 'No resource can be taught without a projector, internet or learner devices.', 'path', 'resources');
    end if;
    if exists (select 1 from public.lesson_resources lr join public.teaching_resources r on r.id = lr.resource_id
               where lr.lesson_id = p_id and r.projector_required) then
      v_f := v_f || jsonb_build_object('severity', 'info', 'category', 'delivery', 'code', 'projector_resources_present',
        'message', 'Some resources need a projector. That is fine while a projector-free path also exists.', 'path', 'resources');
    end if;
    if exists (select 1 from public.lesson_resources lr join public.teaching_resources r on r.id = lr.resource_id
               where lr.lesson_id = p_id and r.language is distinct from v_row ->> 'language') then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'curriculum', 'code', 'language_mismatch',
        'message', 'A linked resource is written in a different language from the lesson.', 'path', 'resources');
    end if;

    if coalesce(char_length(v_row ->> 'teacher_notes'), 0) < 20 then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'safety', 'code', 'missing_teacher_guidance', 'message', 'Teacher notes are missing or very short.', 'path', 'teacher_notes');
    end if;
    if v_row ->> 'estimated_minutes' is null then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'structure', 'code', 'missing_duration', 'message', 'The lesson has no estimated duration.', 'path', 'estimated_minutes');
    end if;
    if exists (select 1 from public.lessons o where o.topic_id = (v_row ->> 'topic_id')::uuid and o.id <> p_id and o.lineage_id <> (v_row ->> 'lineage_id')::uuid
               and o.status <> 'retired' and lower(btrim(o.title)) = lower(btrim(v_row ->> 'title'))) then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'structure', 'code', 'duplicate_title', 'message', 'Another lesson in this topic has the same title.', 'path', 'title');
    end if;

    select count(*) into v_count from public.learning_activities where lesson_id = p_id;
    if v_count = 0 then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'structure', 'code', 'no_activities', 'message', 'The lesson has no learner activities.', 'path', 'activities');
    end if;
    for v_x in select a.title, a.instructions, a.grouping, a.resource_id from public.learning_activities a where a.lesson_id = p_id loop
      if v_x.resource_id is not null and not exists (select 1 from public.lesson_resources lr where lr.lesson_id = p_id and lr.resource_id = v_x.resource_id) then
        v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'structure', 'code', 'activity_resource_not_linked',
          'message', format('Activity "%s" uses a resource that is not part of the lesson.', v_x.title), 'path', 'activities');
      end if;
      if char_length(v_x.instructions) < 20 then
        v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'safety', 'code', 'ambiguous_instruction',
          'message', format('Activity "%s" has very short instructions.', v_x.title), 'path', 'activities');
      end if;
      if v_x.grouping = 'whole_class' and exists (select 1 from public.teaching_resources r where r.id = v_x.resource_id and r.device = 'learner_device') then
        v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'delivery', 'code', 'activity_device_mismatch',
          'message', format('Whole-class activity "%s" needs a device for every learner.', v_x.title), 'path', 'activities');
      end if;
    end loop;
    if (v_row ->> 'estimated_minutes') is not null
       and coalesce((select sum(estimated_minutes) from public.learning_activities where lesson_id = p_id), 0) > (v_row ->> 'estimated_minutes')::integer then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'structure', 'code', 'activities_exceed_lesson_time',
        'message', 'The activities add up to more time than the lesson allows.', 'path', 'activities');
    end if;

    v_text := concat_ws(E'\n', v_row ->> 'title', v_row ->> 'description', v_row ->> 'teacher_notes', v_row ->> 'learner_instructions',
                        (select string_agg(a.title || E'\n' || a.instructions, E'\n') from public.learning_activities a where a.lesson_id = p_id));
    v_f := v_f || public.content_text_findings(v_text, 'lesson text', v_ai);

  elsif p_entity = 'teaching_resources' then
    v_f := v_f || array(select jsonb_build_object('severity', 'error', 'category', 'structure', 'code', 'invalid_body', 'message', x, 'path', 'body')
                        from unnest(public.content_body_problems(v_row -> 'body')) x);
    if not exists (select 1 from public.resource_objectives where resource_id = p_id) then
      v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'curriculum', 'code', 'no_objectives', 'message', 'The resource is not linked to any curriculum objective.', 'path', 'objectives');
    end if;
    for v_x in select o.code, o.status from public.resource_objectives ro join public.curriculum_objectives o on o.id = ro.objective_id
               where ro.resource_id = p_id and o.status not in ('approved', 'published') loop
      v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'curriculum', 'code', 'objective_not_approved',
        'message', format('Objective %s is %s; content may only target approved objectives.', v_x.code, v_x.status), 'path', 'objectives');
    end loop;
    if (v_row ->> 'projector_required')::boolean and v_row ->> 'device' = 'none' then
      v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'delivery', 'code', 'dependency_conflict',
        'message', 'The resource needs a projector but says no device is needed.', 'path', 'device');
    end if;
    if v_row ->> 'connectivity' = 'none' and v_row ->> 'resource_kind' in ('video', 'animation') then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'delivery', 'code', 'offline_media_conflict',
        'message', 'Video or animation marked as needing no connectivity: confirm the media can be stored on the device.', 'path', 'connectivity');
    end if;
    if (v_row -> 'delivery_formats') ? 'printable' and not (v_row ->> 'printable')::boolean then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'delivery', 'code', 'printable_flag_mismatch',
        'message', 'Delivery formats include printable but the resource is not marked printable.', 'path', 'printable');
    end if;
    if v_row ->> 'resource_kind' in ('diagram', 'illustration', 'animation')
       and btrim(coalesce(v_row -> 'body' ->> 'alt_text', '')) = '' then
      v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'structure', 'code', 'missing_alt_text',
        'message', 'A visual resource needs a text description (body.alt_text).', 'path', 'body.alt_text');
    end if;
    if v_row ->> 'resource_kind' = 'video' and btrim(coalesce(v_row -> 'body' ->> 'transcript', '')) = '' then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'structure', 'code', 'missing_transcript',
        'message', 'A video resource should have a transcript.', 'path', 'body.transcript');
    end if;
    if octet_length((v_row -> 'body')::text) > 65536 then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'delivery', 'code', 'heavy_resource',
        'message', 'The resource body is larger than 64 KB, which is heavy for low-data devices.', 'path', 'body');
    end if;
    if exists (select 1 from public.teaching_resources o where o.topic_id = (v_row ->> 'topic_id')::uuid and o.id <> p_id and o.lineage_id <> (v_row ->> 'lineage_id')::uuid
               and o.status <> 'retired' and o.stage::text = v_row ->> 'stage' and lower(btrim(o.title)) = lower(btrim(v_row ->> 'title'))) then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'structure', 'code', 'duplicate_title', 'message', 'Another resource at this stage of the topic has the same title.', 'path', 'title');
    end if;
    v_text := concat_ws(E'\n', v_row ->> 'title', v_row ->> 'summary', public.content_json_text(v_row -> 'body'));
    v_f := v_f || public.content_text_findings(v_text, 'resource text', v_ai);

  else -- learning_assessments
    select count(*) into v_count from public.assessment_questions where assessment_id = p_id;
    if v_count = 0 then
      v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'assessment', 'code', 'no_questions', 'message', 'The assessment has no questions.', 'path', 'questions');
    elsif v_count < 3 then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'assessment', 'code', 'few_questions', 'message', 'Fewer than three questions is too few to show understanding.', 'path', 'questions');
    end if;
    if not exists (select 1 from public.assessment_objectives where assessment_id = p_id) then
      v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'curriculum', 'code', 'no_objectives', 'message', 'The assessment is not linked to any curriculum objective.', 'path', 'objectives');
    end if;
    for v_x in select o.code, o.status from public.assessment_objectives ao join public.curriculum_objectives o on o.id = ao.objective_id
               where ao.assessment_id = p_id and o.status not in ('approved', 'published') loop
      v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'curriculum', 'code', 'objective_not_approved',
        'message', format('Objective %s is %s; content may only target approved objectives.', v_x.code, v_x.status), 'path', 'objectives');
    end loop;
    for v_x in
      select q.position, q.question_type, q.prompt, q.options, q.objective_id, k.answer,
             (q.objective_id is not null and not exists (select 1 from public.assessment_objectives ao where ao.assessment_id = p_id and ao.objective_id = q.objective_id)) as obj_mismatch
      from public.assessment_questions q left join public.assessment_question_keys k on k.question_id = q.id
      where q.assessment_id = p_id order by q.position
    loop
      if v_x.answer is null then
        v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'assessment', 'code', 'missing_answer_key', 'message', format('Question %s has no answer key.', v_x.position), 'path', 'question ' || v_x.position);
      elsif v_x.question_type = 'multiple_choice' then
        if jsonb_array_length(v_x.options) not between 2 and 6 or not (v_x.options @> to_jsonb(v_x.answer #>> '{}')) then
          v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'assessment', 'code', 'answer_not_in_options', 'message', format('Question %s: the answer is not one of the 2 to 6 options.', v_x.position), 'path', 'question ' || v_x.position);
        end if;
      elsif v_x.question_type = 'true_false' and jsonb_typeof(v_x.answer) <> 'boolean' then
        v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'assessment', 'code', 'answer_wrong_type', 'message', format('Question %s: a true/false answer must be true or false.', v_x.position), 'path', 'question ' || v_x.position);
      elsif v_x.question_type = 'numeric' and jsonb_typeof(v_x.answer) <> 'number' then
        v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'assessment', 'code', 'answer_wrong_type', 'message', format('Question %s: a numeric answer must be a number.', v_x.position), 'path', 'question ' || v_x.position);
      end if;
      if v_x.objective_id is null then
        v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'curriculum', 'code', 'question_unmapped', 'message', format('Question %s is not mapped to an objective.', v_x.position), 'path', 'question ' || v_x.position);
      elsif v_x.obj_mismatch then
        v_f := v_f || jsonb_build_object('severity', 'error', 'category', 'curriculum', 'code', 'question_objective_mismatch', 'message', format('Question %s maps to an objective the assessment does not cover.', v_x.position), 'path', 'question ' || v_x.position);
      end if;
    end loop;
    if exists (select 1 from public.assessment_questions q where q.assessment_id = p_id group by lower(btrim(q.prompt)) having count(*) > 1) then
      v_f := v_f || jsonb_build_object('severity', 'warning', 'category', 'assessment', 'code', 'duplicate_question', 'message', 'Two questions have the same prompt.', 'path', 'questions');
    end if;
    if (select count(distinct difficulty) from public.assessment_questions where assessment_id = p_id) = 1 and v_count >= 3 then
      v_f := v_f || jsonb_build_object('severity', 'info', 'category', 'assessment', 'code', 'single_difficulty', 'message', 'All questions have the same difficulty.', 'path', 'questions');
    end if;
    v_text := concat_ws(E'\n', v_row ->> 'title',
      (select string_agg(q.prompt || E'\n' || coalesce(q.options::text, '') || E'\n' || coalesce(k.feedback, '') || E'\n' || coalesce(k.marking_notes, ''), E'\n')
       from public.assessment_questions q left join public.assessment_question_keys k on k.question_id = q.id where q.assessment_id = p_id));
    v_f := v_f || public.content_text_findings(v_text, 'assessment text', v_ai);
  end if;

  select count(*) filter (where e ->> 'severity' = 'error'), count(*) filter (where e ->> 'severity' = 'warning'), count(*) filter (where e ->> 'severity' = 'info')
    into v_errors, v_warns, v_infos from unnest(v_f) e;

  insert into public.content_validation_runs (entity_table, entity_id, ruleset_version, content_fingerprint, error_count, warning_count, info_count, passed, run_by)
  values (p_entity, p_id, '1', public.content_fingerprint(p_entity, p_id), v_errors, v_warns, v_infos, v_errors = 0, v_actor)
  returning id into v_run;
  insert into public.content_validation_findings (run_id, severity, category, code, message, path)
  select v_run, (e ->> 'severity')::public.validation_severity, e ->> 'category', e ->> 'code', e ->> 'message', e ->> 'path' from unnest(v_f) e;

  perform public.write_audit_log(null, v_actor, 'content_validated', p_entity, p_id, null,
    jsonb_build_object('run_id', v_run, 'errors', v_errors, 'warnings', v_warns, 'passed', v_errors = 0));
  return v_run;
end $$;

create or replace function public.acknowledge_validation_finding(p_finding_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_f       public.content_validation_findings;
  v_run     public.content_validation_runs;
  v_origin  text;
  v_creator uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only platform administrators acknowledge findings';
  end if;
  select * into v_f from public.content_validation_findings where id = p_finding_id;
  if v_f.id is null then raise exception 'not_found: no finding %', p_finding_id; end if;
  if v_f.severity = 'error' then
    raise exception 'invalid_state: errors cannot be acknowledged; fix the content and validate again';
  end if;
  if coalesce(btrim(p_note), '') = '' then raise exception 'invalid_argument: say why the warning is acceptable'; end if;
  select * into v_run from public.content_validation_runs where id = v_f.run_id;
  execute format('select origin::text, created_by from public.%I where id = $1', v_run.entity_table) into v_origin, v_creator using v_run.entity_id;
  if v_origin = 'ai_draft' and v_creator is not distinct from auth.uid() then
    raise exception 'insufficient_privilege: warnings on AI-assisted content must be acknowledged by someone other than the requester';
  end if;
  update public.content_validation_findings set acknowledged_by = auth.uid(), acknowledged_at = now(), ack_note = p_note where id = p_finding_id;
  perform public.write_audit_log(null, auth.uid(), 'validation_warning_acknowledged', v_run.entity_table, v_run.entity_id, null,
    jsonb_build_object('finding_id', p_finding_id, 'code', v_f.code));
end $$;

-- ---------------------------------------------------------------------------
-- 8. RPC: provenance ("where did this come from, who approved it?")
-- ---------------------------------------------------------------------------

create or replace function public.content_provenance(p_entity text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_row  jsonb;
  v_fp   text;
  v_ver  public.content_verifications;
  v_run  public.content_validation_runs;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: provenance is internal to platform administrators';
  end if;
  if p_entity not in ('lessons', 'teaching_resources', 'learning_assessments') then
    raise exception 'invalid_reference: unknown content entity %', p_entity;
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_entity) into v_row using p_id;
  if v_row is null then raise exception 'not_found: no % %', p_entity, p_id; end if;
  v_fp := public.content_fingerprint(p_entity, p_id);
  select * into v_ver from public.content_verifications where entity_table = p_entity and entity_id = p_id;
  select * into v_run from public.content_validation_runs where entity_table = p_entity and entity_id = p_id order by created_at desc, id desc limit 1;

  return jsonb_build_object(
    'entity', p_entity, 'id', p_id,
    'origin', v_row ->> 'origin', 'status', v_row ->> 'status', 'ai_disclosure', v_row ->> 'ai_disclosure',
    'created_by', (select jsonb_build_object('id', p.id, 'name', trim(p.first_name || ' ' || p.last_name)) from public.profiles p where p.id = (v_row ->> 'created_by')::uuid),
    'created_at', v_row ->> 'created_at',
    'reviewed_by', (select trim(p.first_name || ' ' || p.last_name) from public.profiles p where p.id = (v_row ->> 'reviewed_by')::uuid),
    'approved_by', (select trim(p.first_name || ' ' || p.last_name) from public.profiles p where p.id = (v_row ->> 'approved_by')::uuid),
    'approved_at', v_row ->> 'approved_at', 'published_at', v_row ->> 'published_at',
    'generation', (select jsonb_build_object(
        'request_id', r.id, 'requested_by', trim(p.first_name || ' ' || p.last_name), 'requested_at', r.created_at,
        'provider', r.provider, 'model', r.model, 'prompt_version', r.prompt_version, 'schema_version', r.schema_version,
        'curriculum_version_id', r.curriculum_version_id, 'topic_id', r.topic_id,
        'objectives', (select jsonb_agg(jsonb_build_object('code', o.code, 'description', o.description) order by o.code) from public.curriculum_objectives o where o.id = any (r.objective_ids)),
        'instruction', r.instruction, 'output_hash', r.output_hash)
      from public.ai_generation_outputs g join public.ai_generation_requests r on r.id = g.request_id
      left join public.profiles p on p.id = r.requested_by
      where g.entity_table = p_entity and g.entity_id = p_id order by r.created_at limit 1),
    'sources', coalesce((select jsonb_agg(jsonb_build_object(
        'reference_id', c.id, 'locator', c.locator, 'supports', c.supports, 'check_result', c.check_result, 'checked_at', c.checked_at,
        'source', jsonb_build_object('id', s.id, 'title', s.title, 'publisher', s.publisher, 'doc_type', s.doc_type, 'licence', s.licence, 'status', s.status)) order by c.created_at)
      from public.content_source_references c join public.curriculum_sources s on s.id = c.source_id
      where c.entity_table = p_entity and c.entity_id = p_id), '[]'::jsonb),
    'verification', jsonb_build_object(
      'status', case when v_ver.entity_id is null or v_ver.fingerprint is distinct from v_fp then 'unverified' else v_ver.status::text end,
      'recorded_status', v_ver.status, 'stale', v_ver.entity_id is not null and v_ver.fingerprint is distinct from v_fp,
      'set_at', v_ver.set_at, 'note', v_ver.note),
    'validation', case when v_run.id is null then null else jsonb_build_object(
      'run_id', v_run.id, 'run_at', v_run.created_at, 'passed', v_run.passed, 'stale', v_run.content_fingerprint is distinct from v_fp,
      'errors', v_run.error_count, 'warnings', v_run.warning_count, 'info', v_run.info_count,
      'unacknowledged_warnings', (select count(*) from public.content_validation_findings f where f.run_id = v_run.id and f.severity = 'warning' and f.acknowledged_at is null)) end,
    'review_events', coalesce((select jsonb_agg(jsonb_build_object('from', e.from_status, 'to', e.to_status, 'at', e.created_at, 'note', e.note,
        'by', (select trim(p.first_name || ' ' || p.last_name) from public.profiles p where p.id = e.actor_profile_id)) order by e.created_at)
      from public.content_review_events e where e.entity_table = p_entity and e.entity_id = p_id), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 9. Row level security and privileges
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['curriculum_sources', 'content_source_references', 'content_verifications', 'ai_generation_requests',
                           'ai_generation_outputs', 'content_validation_runs', 'content_validation_findings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    -- Platform administrators only. No client write policy exists: every write goes through an RPC above.
    execute format($p$create policy %I on public.%I for select to authenticated using ((select public.is_platform_admin()))$p$, t || '_select', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Internal helpers and triggers: nobody calls them directly.
revoke execute on function public.content_fingerprint(text, uuid) from public, anon, authenticated;
revoke execute on function public.content_body_problems(jsonb) from public, anon, authenticated;
revoke execute on function public.content_json_text(jsonb) from public, anon, authenticated;
revoke execute on function public.content_text_findings(text, text, boolean) from public, anon, authenticated;
revoke execute on function public.ai_payload_problems(jsonb, text[]) from public, anon, authenticated;
revoke execute on function public.content_origin_lock() from public, anon, authenticated;
revoke execute on function public.ai_content_gate() from public, anon, authenticated;

-- Client-callable RPCs. Each re-checks is_platform_admin() itself.
do $$
declare f text;
begin
  foreach f in array array[
    'register_curriculum_source(text, text, text, text, text, text, boolean, text, date, text)',
    'verify_curriculum_source(uuid, text)',
    'add_content_source_reference(text, uuid, uuid, text, text)',
    'check_content_source_reference(uuid, text, text)',
    'set_content_verification(text, uuid, public.content_verification_status, text)',
    'ai_begin_generation(uuid, uuid, uuid[], text, text, text, text, text, jsonb)',
    'ai_generation_context(uuid)',
    'ai_fail_generation(uuid, text, jsonb)',
    'ai_ingest_draft(uuid, jsonb)',
    'validate_content(text, uuid)',
    'acknowledge_validation_finding(uuid, text)',
    'content_provenance(text, uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select public.rls_optimize_policies();
