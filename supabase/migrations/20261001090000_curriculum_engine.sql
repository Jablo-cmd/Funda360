-- Funda360 Curriculum Engine — schema, lifecycle guards and RLS.
-- Design: docs/proposals/curriculum-engine.md. Purely additive: no existing table,
-- policy or function is altered. RPCs are in 20261001100000_curriculum_engine_rpcs.sql.
--
-- Two kinds of data:
--   GLOBAL   curriculum master data and teaching content (no school_id). Owned by the
--            platform; ordinary users can read only `published` / `retired` rows.
--   TENANT   school adoption/mapping, class plans and assignments, learner evidence
--            and progress. Always carries school_id and is tenant isolated.

-- ---------------------------------------------------------------------------
-- 0. Enums
-- ---------------------------------------------------------------------------

create type public.content_status as enum ('draft', 'review', 'approved', 'published', 'retired');
create type public.toolkit_stage as enum ('explain', 'show', 'try', 'practise', 'check', 'support', 'challenge', 'print');
create type public.content_difficulty as enum ('foundational', 'standard', 'advanced');
create type public.connectivity_need as enum ('none', 'low', 'online');
create type public.device_need as enum ('none', 'teacher_device', 'shared_device', 'learner_device');
create type public.content_origin as enum ('authored', 'ai_draft');
create type public.learner_progress_status as enum ('not_started', 'in_progress', 'completed', 'needs_support', 'mastered');

-- ---------------------------------------------------------------------------
-- 1. Lifecycle guards (shared trigger functions)
-- ---------------------------------------------------------------------------

-- Status changes are RPC-only. content_transition() sets funda360.content_rpc for its own
-- transaction; a direct UPDATE of status by a client (even a platform admin) is rejected, and
-- new rows must start as draft. Same idea as assignments_protect in the homework domain.
create or replace function public.content_protect_status()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('funda360.content_rpc', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'insufficient_privilege: new content must start as draft';
    end if;
  elsif new.status is distinct from old.status then
    raise exception 'insufficient_privilege: content status changes go through content_transition()';
  end if;
  return new;
end $$;

-- Published and retired content is immutable. Fixing it means creating a new version.
create or replace function public.content_freeze()
returns trigger language plpgsql as $$
declare
  v_lifecycle text[] := array['status', 'reviewed_by', 'reviewed_at', 'approved_by', 'approved_at',
                              'published_at', 'retired_at', 'updated_at', 'updated_by'];
begin
  if old.status in ('published', 'retired')
     and (to_jsonb(new) - v_lifecycle) is distinct from (to_jsonb(old) - v_lifecycle) then
    raise exception 'invalid_state: published content is immutable; create a new version instead';
  end if;
  return new;
end $$;

-- Children of a version (phases ... skills) are frozen once the version is approved,
-- so a signed-off or live curriculum can never be edited underneath learner records.
create or replace function public.curriculum_hierarchy_freeze()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row     jsonb;
  v_version uuid;
  v_status  public.content_status;
begin
  -- OLD is unassigned on INSERT and NEW on DELETE, so only ever read the one that exists.
  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  v_version := (v_row ->> 'version_id')::uuid;
  select status into v_status from public.curriculum_versions where id = v_version;
  if v_status in ('approved', 'published', 'retired') then
    raise exception 'invalid_state: curriculum version is % and cannot be edited; create a new version', v_status;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Links and children of a content unit (lesson_objectives, questions, ...) follow their parent:
-- no changes once the parent is published or retired.
-- TG_ARGV[0] = parent table, TG_ARGV[1] = parent key column on this table.
create or replace function public.content_child_freeze()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row    jsonb;
  v_parent uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  v_parent := (v_row ->> tg_argv[1])::uuid;
  execute format('select status::text from public.%I where id = $1', tg_argv[0]) into v_status using v_parent;
  if v_status in ('published', 'retired') then
    raise exception 'invalid_state: % is % and cannot be edited; create a new version instead', tg_argv[0], v_status;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- A lesson / resource / assessment topic must belong to the same grade-subject it is filed under.
create or replace function public.content_validate_topic_scope()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_gs uuid;
begin
  select t.grade_subject_id into v_gs
  from public.curriculum_topics tp
  join public.curriculum_terms t on t.id = tp.term_id
  where tp.id = new.topic_id;
  if v_gs is distinct from new.grade_subject_id then
    raise exception 'invalid_reference: topic does not belong to the given grade and subject';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 2. GLOBAL: versioned curriculum hierarchy
-- ---------------------------------------------------------------------------

create table public.curriculum_versions (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique check (code ~ '^[A-Za-z0-9._-]{2,64}$'),
  name                  text not null check (char_length(name) > 0),
  version_label         text not null default '1',
  source                text not null check (char_length(source) > 0),
  source_reference      text,
  license_notes         text,
  status                public.content_status not null default 'draft',
  effective_from        date,
  effective_to          date,
  supersedes_version_id uuid references public.curriculum_versions (id),
  created_by            uuid references public.profiles (id) on delete set null,
  approved_by           uuid references public.profiles (id) on delete set null,
  approved_at           timestamptz,
  published_at          timestamptz,
  retired_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint curriculum_versions_dates_valid check (effective_to is null or effective_from is null or effective_to >= effective_from),
  constraint curriculum_versions_not_self_superseding check (supersedes_version_id is distinct from id)
);
comment on table public.curriculum_versions is 'One edition of a national curriculum (e.g. a CAPS edition). Learner records reference rows of a specific version, so retiring or superseding a version never rewrites history. Status is RPC-only (content_transition).';
comment on column public.curriculum_versions.source is 'Who issued the curriculum (e.g. the education department).';
comment on column public.curriculum_versions.source_reference is 'Pointer to the official document (title, edition, URL). The document text itself is never copied into this schema.';
comment on column public.curriculum_versions.license_notes is 'Permissions / licensing conditions for the referenced material and review status of Funda360''s own paraphrase.';

create table public.curriculum_phases (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.curriculum_versions (id),
  code        text not null check (code in ('FP', 'IP', 'SP', 'FET')),
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (version_id, code),
  unique (id, version_id)
);
comment on table public.curriculum_phases is 'Foundation, Intermediate, Senior and FET phases of a curriculum version.';

create table public.curriculum_grades (
  id           uuid primary key default gen_random_uuid(),
  version_id   uuid not null,
  phase_id     uuid not null,
  grade_number smallint not null check (grade_number between 0 and 12),
  name         text not null,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (version_id, grade_number),
  unique (id, version_id),
  foreign key (phase_id, version_id) references public.curriculum_phases (id, version_id)
);
comment on column public.curriculum_grades.grade_number is '0 = Grade R, 1..12 = Grade 1..12.';

create table public.curriculum_subjects (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.curriculum_versions (id),
  code        text not null,
  name        text not null,
  language    text not null default 'en',
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (version_id, code),
  unique (id, version_id)
);
comment on table public.curriculum_subjects is 'Subjects known to a curriculum version. Which grades offer a subject is decided only by curriculum_grade_subjects, so there is no universal hard-coded subject list.';

create table public.curriculum_grade_subjects (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null,
  grade_id      uuid not null,
  subject_id    uuid not null,
  is_compulsory boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (grade_id, subject_id),
  unique (id, version_id),
  foreign key (grade_id, version_id) references public.curriculum_grades (id, version_id),
  foreign key (subject_id, version_id) references public.curriculum_subjects (id, version_id)
);
comment on table public.curriculum_grade_subjects is 'The valid Phase -> Grade -> Subject relationships of a version. A subject exists for a grade only if a row is here.';

create table public.curriculum_terms (
  id               uuid primary key default gen_random_uuid(),
  version_id       uuid not null,
  grade_subject_id uuid not null,
  term_number      smallint not null check (term_number between 1 and 4),
  weeks            smallint check (weeks is null or weeks > 0),
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (grade_subject_id, term_number),
  unique (id, version_id),
  foreign key (grade_subject_id, version_id) references public.curriculum_grade_subjects (id, version_id)
);

create table public.curriculum_topics (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null,
  term_id     uuid not null,
  code        text not null,
  title       text not null check (char_length(title) > 0),
  description text,
  language    text not null default 'en',
  status      public.content_status not null default 'draft',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (version_id, code),
  unique (id, version_id),
  foreign key (term_id, version_id) references public.curriculum_terms (id, version_id)
);

create table public.curriculum_subtopics (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null,
  topic_id    uuid not null,
  code        text not null,
  title       text not null check (char_length(title) > 0),
  description text,
  language    text not null default 'en',
  status      public.content_status not null default 'draft',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (version_id, code),
  unique (id, version_id),
  unique (id, topic_id),
  foreign key (topic_id, version_id) references public.curriculum_topics (id, version_id)
);

create table public.curriculum_objectives (
  id               uuid primary key default gen_random_uuid(),
  version_id       uuid not null,
  topic_id         uuid not null,
  subtopic_id      uuid,
  code             text not null,
  description      text not null check (char_length(description) > 0),
  language         text not null default 'en',
  source_reference text,
  status           public.content_status not null default 'draft',
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (version_id, code),
  unique (id, version_id),
  foreign key (topic_id, version_id) references public.curriculum_topics (id, version_id),
  foreign key (subtopic_id, topic_id) references public.curriculum_subtopics (id, topic_id)
);
comment on column public.curriculum_objectives.description is 'Funda360''s own plain-language paraphrase of the learning objective, not the official wording.';
comment on column public.curriculum_objectives.source_reference is 'Where this objective comes from in the official document (section reference), for reviewers.';

create table public.curriculum_skills (
  id           uuid primary key default gen_random_uuid(),
  version_id   uuid not null,
  objective_id uuid not null,
  code         text not null,
  name         text not null check (char_length(name) > 0),
  description  text,
  status       public.content_status not null default 'draft',
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (version_id, code),
  unique (id, version_id),
  foreign key (objective_id, version_id) references public.curriculum_objectives (id, version_id)
);

create index curriculum_grades_phase_idx on public.curriculum_grades (phase_id);
create index curriculum_grade_subjects_subject_idx on public.curriculum_grade_subjects (subject_id);
create index curriculum_terms_grade_subject_idx on public.curriculum_terms (grade_subject_id);
create index curriculum_topics_term_idx on public.curriculum_topics (term_id, sort_order);
create index curriculum_subtopics_topic_idx on public.curriculum_subtopics (topic_id, sort_order);
create index curriculum_objectives_topic_idx on public.curriculum_objectives (topic_id, sort_order);
create index curriculum_objectives_subtopic_idx on public.curriculum_objectives (subtopic_id) where subtopic_id is not null;
create index curriculum_skills_objective_idx on public.curriculum_skills (objective_id, sort_order);

-- ---------------------------------------------------------------------------
-- 3. GLOBAL: lessons, toolkit resources, activities, assessments
-- ---------------------------------------------------------------------------

create table public.lessons (
  id                    uuid primary key default gen_random_uuid(),
  lineage_id            uuid not null default gen_random_uuid(),
  version_number        integer not null default 1 check (version_number > 0),
  previous_version_id   uuid references public.lessons (id),
  curriculum_version_id uuid not null,
  grade_subject_id      uuid not null,
  topic_id              uuid not null,
  title                 text not null check (char_length(title) > 0),
  description           text,
  estimated_minutes     integer check (estimated_minutes is null or estimated_minutes > 0),
  difficulty            public.content_difficulty not null default 'standard',
  language              text not null default 'en',
  status                public.content_status not null default 'draft',
  teacher_notes         text,
  learner_instructions  text,
  sort_order            integer not null default 0,
  accessibility         jsonb not null default '{}'::jsonb check (jsonb_typeof(accessibility) = 'object'),
  origin                public.content_origin not null default 'authored',
  ai_disclosure         text,
  reviewed_by           uuid references public.profiles (id) on delete set null,
  reviewed_at           timestamptz,
  approved_by           uuid references public.profiles (id) on delete set null,
  approved_at           timestamptz,
  published_at          timestamptz,
  retired_at            timestamptz,
  created_by            uuid references public.profiles (id) on delete set null,
  updated_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (lineage_id, version_number),
  unique (id, curriculum_version_id),
  foreign key (curriculum_version_id) references public.curriculum_versions (id),
  foreign key (grade_subject_id, curriculum_version_id) references public.curriculum_grade_subjects (id, version_id),
  foreign key (topic_id, curriculum_version_id) references public.curriculum_topics (id, version_id),
  constraint lessons_ai_needs_disclosure check (origin <> 'ai_draft' or ai_disclosure is not null)
);
comment on table public.lessons is 'A lesson for one topic of one grade-subject, written against one curriculum version. lineage_id + version_number give "create a new version" without overwriting a published lesson. Status is RPC-only; published lessons are immutable.';

create table public.lesson_objectives (
  lesson_id             uuid not null,
  objective_id          uuid not null,
  curriculum_version_id uuid not null,
  is_primary            boolean not null default false,
  primary key (lesson_id, objective_id),
  foreign key (lesson_id, curriculum_version_id) references public.lessons (id, curriculum_version_id),
  foreign key (objective_id, curriculum_version_id) references public.curriculum_objectives (id, version_id)
);

create table public.teaching_resources (
  id                    uuid primary key default gen_random_uuid(),
  lineage_id            uuid not null default gen_random_uuid(),
  version_number        integer not null default 1 check (version_number > 0),
  previous_version_id   uuid references public.teaching_resources (id),
  curriculum_version_id uuid not null,
  grade_subject_id      uuid not null,
  topic_id              uuid not null,
  stage                 public.toolkit_stage not null,
  resource_kind         text not null check (resource_kind in (
                          'teacher_explanation', 'simplified_explanation', 'worked_example', 'diagram', 'illustration',
                          'animation', 'video', 'classroom_activity', 'group_activity', 'practical_activity', 'exercise',
                          'differentiated_exercise', 'quick_assessment', 'formative_questions', 'remediation',
                          'extension', 'worksheet', 'teacher_resource')),
  title                 text not null check (char_length(title) > 0),
  summary               text,
  body                  jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object'),
  difficulty            public.content_difficulty not null default 'standard',
  language              text not null default 'en',
  estimated_minutes     integer check (estimated_minutes is null or estimated_minutes > 0),
  delivery_formats      text[] not null default '{text}'
                        check (delivery_formats <@ array['visual', 'text', 'interactive', 'practical', 'teacher_led', 'printable', 'video_audio']::text[]
                               and cardinality(delivery_formats) > 0),
  connectivity          public.connectivity_need not null default 'none',
  device                public.device_need not null default 'teacher_device',
  projector_required    boolean not null default false,
  printable             boolean not null default false,
  cacheable             boolean not null default true,
  size_kb               integer check (size_kb is null or size_kb >= 0),
  media_path            text,
  accessibility         jsonb not null default '{}'::jsonb check (jsonb_typeof(accessibility) = 'object'),
  origin                public.content_origin not null default 'authored',
  ai_disclosure         text,
  status                public.content_status not null default 'draft',
  reviewed_by           uuid references public.profiles (id) on delete set null,
  reviewed_at           timestamptz,
  approved_by           uuid references public.profiles (id) on delete set null,
  approved_at           timestamptz,
  published_at          timestamptz,
  retired_at            timestamptz,
  created_by            uuid references public.profiles (id) on delete set null,
  updated_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (lineage_id, version_number),
  unique (id, curriculum_version_id),
  foreign key (curriculum_version_id) references public.curriculum_versions (id),
  foreign key (grade_subject_id, curriculum_version_id) references public.curriculum_grade_subjects (id, version_id),
  foreign key (topic_id, curriculum_version_id) references public.curriculum_topics (id, version_id),
  constraint teaching_resources_print_is_printable check (stage <> 'print' or printable),
  constraint teaching_resources_ai_needs_disclosure check (origin <> 'ai_draft' or ai_disclosure is not null)
);
comment on table public.teaching_resources is 'A separate, reusable piece of the Teacher Toolkit (one explanation, one activity, one worksheet...), not a lesson blob. stage is the toolkit step; connectivity/device/projector_required/printable/cacheable/size_kb describe what a low-resource school needs to use it. body is small structured JSON so it can be cached and synced offline later.';
comment on column public.teaching_resources.projector_required is 'Defaults to false: a projector is never assumed. A lesson cannot be published without at least one resource that needs no projector, no connectivity and no learner device.';

create table public.lesson_resources (
  lesson_id             uuid not null,
  resource_id           uuid not null,
  curriculum_version_id uuid not null,
  sort_order            integer not null default 0,
  primary key (lesson_id, resource_id),
  foreign key (lesson_id, curriculum_version_id) references public.lessons (id, curriculum_version_id),
  foreign key (resource_id, curriculum_version_id) references public.teaching_resources (id, curriculum_version_id)
);

create table public.resource_objectives (
  resource_id           uuid not null,
  objective_id          uuid not null,
  curriculum_version_id uuid not null,
  primary key (resource_id, objective_id),
  foreign key (resource_id, curriculum_version_id) references public.teaching_resources (id, curriculum_version_id),
  foreign key (objective_id, curriculum_version_id) references public.curriculum_objectives (id, version_id)
);

create table public.learning_activities (
  id                    uuid primary key default gen_random_uuid(),
  lesson_id             uuid not null,
  curriculum_version_id uuid not null,
  title                 text not null check (char_length(title) > 0),
  instructions          text not null check (char_length(instructions) > 0),
  activity_type         text not null check (activity_type in (
                          'individual_practice', 'pair_work', 'group_work', 'practical', 'game', 'discussion', 'worksheet', 'teacher_led')),
  grouping              text not null default 'individual' check (grouping in ('individual', 'pair', 'small_group', 'whole_class')),
  difficulty            public.content_difficulty not null default 'standard',
  estimated_minutes     integer check (estimated_minutes is null or estimated_minutes > 0),
  resource_id           uuid,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, curriculum_version_id),
  foreign key (lesson_id, curriculum_version_id) references public.lessons (id, curriculum_version_id),
  foreign key (resource_id, curriculum_version_id) references public.teaching_resources (id, curriculum_version_id)
);
comment on table public.learning_activities is 'A learner-facing task inside a lesson. Visibility and immutability follow the parent lesson.';

create table public.learning_assessments (
  id                      uuid primary key default gen_random_uuid(),
  lineage_id              uuid not null default gen_random_uuid(),
  version_number          integer not null default 1 check (version_number > 0),
  previous_version_id     uuid references public.learning_assessments (id),
  curriculum_version_id   uuid not null,
  grade_subject_id        uuid not null,
  topic_id                uuid not null,
  lesson_id               uuid,
  title                   text not null check (char_length(title) > 0),
  purpose                 text not null default 'formative' check (purpose in ('diagnostic', 'formative', 'summative_check')),
  difficulty              public.content_difficulty not null default 'standard',
  estimated_minutes       integer check (estimated_minutes is null or estimated_minutes > 0),
  mastery_percent         numeric(5, 2) not null default 80 check (mastery_percent between 1 and 100),
  support_below_percent   numeric(5, 2) not null default 50 check (support_below_percent between 0 and 99),
  language                text not null default 'en',
  origin                  public.content_origin not null default 'authored',
  ai_disclosure           text,
  status                  public.content_status not null default 'draft',
  reviewed_by             uuid references public.profiles (id) on delete set null,
  reviewed_at             timestamptz,
  approved_by             uuid references public.profiles (id) on delete set null,
  approved_at             timestamptz,
  published_at            timestamptz,
  retired_at              timestamptz,
  created_by              uuid references public.profiles (id) on delete set null,
  updated_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (lineage_id, version_number),
  unique (id, curriculum_version_id),
  foreign key (curriculum_version_id) references public.curriculum_versions (id),
  foreign key (grade_subject_id, curriculum_version_id) references public.curriculum_grade_subjects (id, version_id),
  foreign key (topic_id, curriculum_version_id) references public.curriculum_topics (id, version_id),
  foreign key (lesson_id, curriculum_version_id) references public.lessons (id, curriculum_version_id),
  constraint learning_assessments_thresholds check (support_below_percent < mastery_percent),
  constraint learning_assessments_ai_needs_disclosure check (origin <> 'ai_draft' or ai_disclosure is not null)
);
comment on table public.learning_assessments is 'A quick check / diagnostic with questions mapped to objectives. Separate from the gradebook (assessments): it feeds learner progress evidence, never report-card marks. mastery_percent / support_below_percent are the thresholds derive_learner_progress() applies.';

create table public.assessment_objectives (
  assessment_id         uuid not null,
  objective_id          uuid not null,
  curriculum_version_id uuid not null,
  primary key (assessment_id, objective_id),
  foreign key (assessment_id, curriculum_version_id) references public.learning_assessments (id, curriculum_version_id),
  foreign key (objective_id, curriculum_version_id) references public.curriculum_objectives (id, version_id)
);

create table public.assessment_questions (
  id                    uuid primary key default gen_random_uuid(),
  assessment_id         uuid not null,
  curriculum_version_id uuid not null,
  position              integer not null check (position > 0),
  question_type         text not null check (question_type in ('multiple_choice', 'true_false', 'numeric', 'short_answer')),
  prompt                text not null check (char_length(prompt) > 0),
  options               jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  marks                 integer not null default 1 check (marks > 0),
  objective_id          uuid,
  difficulty            public.content_difficulty not null default 'standard',
  created_at            timestamptz not null default now(),
  unique (assessment_id, position),
  unique (id, assessment_id),
  foreign key (assessment_id, curriculum_version_id) references public.learning_assessments (id, curriculum_version_id),
  foreign key (objective_id, curriculum_version_id) references public.curriculum_objectives (id, version_id)
);

-- Answer keys are kept apart so a learner's or guardian's client can never read them.
create table public.assessment_question_keys (
  question_id    uuid primary key,
  assessment_id  uuid not null,
  answer         jsonb not null,
  feedback       text,
  marking_notes  text,
  foreign key (question_id, assessment_id) references public.assessment_questions (id, assessment_id)
);
comment on table public.assessment_question_keys is 'Correct answers and marking notes. Readable by staff and platform administrators only.';

create index lessons_grade_subject_idx on public.lessons (grade_subject_id, status);
create index lessons_topic_idx on public.lessons (topic_id, status, sort_order);
create index lessons_lineage_idx on public.lessons (lineage_id);
create index lesson_objectives_objective_idx on public.lesson_objectives (objective_id);
create index teaching_resources_topic_idx on public.teaching_resources (topic_id, stage, status);
create index teaching_resources_grade_subject_idx on public.teaching_resources (grade_subject_id, status);
create index lesson_resources_resource_idx on public.lesson_resources (resource_id);
create index resource_objectives_objective_idx on public.resource_objectives (objective_id);
create index learning_activities_lesson_idx on public.learning_activities (lesson_id, sort_order);
create index learning_assessments_topic_idx on public.learning_assessments (topic_id, status);
create index learning_assessments_lesson_idx on public.learning_assessments (lesson_id) where lesson_id is not null;
create index assessment_objectives_objective_idx on public.assessment_objectives (objective_id);
create index assessment_questions_assessment_idx on public.assessment_questions (assessment_id, position);

-- ---------------------------------------------------------------------------
-- 4. GLOBAL: review trail
-- ---------------------------------------------------------------------------

create table public.content_review_events (
  id               uuid primary key default gen_random_uuid(),
  entity_table     text not null check (entity_table in ('curriculum_versions', 'lessons', 'teaching_resources', 'learning_assessments')),
  entity_id        uuid not null,
  from_status      public.content_status,
  to_status        public.content_status not null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  note             text,
  created_at       timestamptz not null default now()
);
comment on table public.content_review_events is 'Append-only review and publication trail for global content. Written only by content_transition().';
create index content_review_events_entity_idx on public.content_review_events (entity_table, entity_id, created_at);

-- ---------------------------------------------------------------------------
-- 5. TENANT: adoption, mapping, class plans, assignments
-- ---------------------------------------------------------------------------

create table public.school_curriculum_adoptions (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools (id) on delete cascade,
  curriculum_version_id uuid not null references public.curriculum_versions (id),
  status                text not null default 'active' check (status in ('active', 'ended')),
  adopted_by            uuid references public.profiles (id) on delete set null,
  adopted_at            timestamptz not null default now(),
  ended_at              timestamptz,
  unique (school_id, curriculum_version_id)
);
comment on table public.school_curriculum_adoptions is 'Which published curriculum version a school follows. Written by adopt_curriculum_version().';

create table public.school_grade_curriculum_map (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools (id) on delete cascade,
  school_grade_id       uuid not null references public.grades (id) on delete cascade,
  curriculum_version_id uuid not null,
  curriculum_grade_id   uuid not null,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  unique (school_grade_id, curriculum_version_id),
  foreign key (curriculum_grade_id, curriculum_version_id) references public.curriculum_grades (id, version_id)
);
comment on table public.school_grade_curriculum_map is 'Bridges a school''s own grade (free-text name) to the national curriculum grade, per curriculum version.';

create table public.school_subject_curriculum_map (
  id                      uuid primary key default gen_random_uuid(),
  school_id               uuid not null references public.schools (id) on delete cascade,
  school_subject_id       uuid not null references public.subjects (id) on delete cascade,
  curriculum_version_id   uuid not null,
  curriculum_subject_id   uuid not null,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  unique (school_subject_id, curriculum_version_id),
  foreign key (curriculum_subject_id, curriculum_version_id) references public.curriculum_subjects (id, version_id)
);

create or replace function public.curriculum_map_validate_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  if tg_table_name = 'school_grade_curriculum_map' then
    select school_id into v_school from public.grades where id = new.school_grade_id;
  else
    select school_id into v_school from public.subjects where id = new.school_subject_id;
  end if;
  if v_school is distinct from new.school_id then
    raise exception 'insufficient_privilege: mapping school_id must match the school of the grade/subject';
  end if;
  return new;
end $$;

create table public.class_topic_plans (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools (id) on delete cascade,
  class_id              uuid not null references public.classes (id) on delete cascade,
  school_subject_id     uuid not null references public.subjects (id) on delete cascade,
  curriculum_version_id uuid not null,
  topic_id              uuid not null,
  status                text not null default 'in_progress' check (status in ('planned', 'in_progress', 'completed')),
  started_on            date,
  completed_on          date,
  set_by                uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (class_id, school_subject_id, topic_id),
  foreign key (topic_id, curriculum_version_id) references public.curriculum_topics (id, version_id)
);
comment on table public.class_topic_plans is 'The topic a class is on, per subject. The row with status in_progress is "what I am teaching now". Written by set_class_current_topic().';
create unique index class_topic_plans_one_current_idx on public.class_topic_plans (class_id, school_subject_id) where status = 'in_progress';

create table public.class_learning_assignments (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  class_id          uuid not null references public.classes (id) on delete cascade,
  school_subject_id uuid not null references public.subjects (id) on delete cascade,
  lesson_id         uuid references public.lessons (id),
  activity_id       uuid references public.learning_activities (id),
  assessment_id     uuid references public.learning_assessments (id),
  title             text not null check (char_length(title) > 0),
  instructions      text,
  due_at            timestamptz,
  status            text not null default 'assigned' check (status in ('assigned', 'closed')),
  assigned_by       uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint class_learning_assignments_has_target check (lesson_id is not null or activity_id is not null or assessment_id is not null)
);
comment on table public.class_learning_assignments is 'Learning material (lesson, activity or quick check) a teacher assigned to a class. Separate from homework `assignments`; a later change can bridge the two. Written by assign_learning_to_class().';

-- ---------------------------------------------------------------------------
-- 6. TENANT: learner evidence and progress
-- ---------------------------------------------------------------------------

create table public.learning_attempts (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools (id) on delete cascade,
  learner_id     uuid not null references public.learners (id) on delete cascade,
  class_id       uuid references public.classes (id) on delete set null,
  assessment_id  uuid references public.learning_assessments (id),
  activity_id    uuid references public.learning_activities (id),
  lesson_id      uuid references public.lessons (id),
  assignment_id  uuid references public.class_learning_assignments (id) on delete set null,
  attempt_number integer not null default 1 check (attempt_number > 0),
  score          numeric(8, 2) check (score is null or score >= 0),
  max_score      numeric(8, 2) check (max_score is null or max_score > 0),
  percent        numeric(5, 2) check (percent is null or percent between 0 and 100),
  completed      boolean not null default true,
  responses      jsonb not null default '[]'::jsonb check (jsonb_typeof(responses) = 'array'),
  source         text not null default 'teacher_entered' check (source in ('teacher_entered', 'learner_device', 'import')),
  recorded_by    uuid references public.profiles (id) on delete set null,
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  constraint learning_attempts_has_target check (assessment_id is not null or activity_id is not null),
  constraint learning_attempts_score_within_max check (score is null or max_score is null or score <= max_score)
);
comment on table public.learning_attempts is 'Recorded evidence: one learner attempt at a quick check or activity. The only input to learner progress, so insights always trace back to real recorded results. Written by record_learning_attempt().';
create unique index learning_attempts_number_idx on public.learning_attempts (learner_id, assessment_id, attempt_number) where assessment_id is not null;

create table public.learner_objective_progress (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools (id) on delete cascade,
  learner_id       uuid not null references public.learners (id) on delete cascade,
  objective_id     uuid not null references public.curriculum_objectives (id),
  status           public.learner_progress_status not null default 'not_started',
  evidence_count   integer not null default 0 check (evidence_count >= 0),
  latest_percent   numeric(5, 2),
  best_percent     numeric(5, 2),
  last_evidence_at timestamptz,
  mastered_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (learner_id, objective_id)
);
comment on table public.learner_objective_progress is 'Derived per-objective status. Computed only by derive_learner_progress() from learning_attempts; never hand-edited and never predicted.';

create table public.learner_lesson_progress (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools (id) on delete cascade,
  learner_id       uuid not null references public.learners (id) on delete cascade,
  lesson_id        uuid not null references public.lessons (id),
  status           public.learner_progress_status not null default 'not_started',
  last_activity_at timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (learner_id, lesson_id)
);

create table public.learning_recommendations (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools (id) on delete cascade,
  learner_id      uuid not null references public.learners (id) on delete cascade,
  objective_id    uuid not null references public.curriculum_objectives (id),
  kind            text not null check (kind in ('remediation', 'extension', 'reassess')),
  resource_id     uuid references public.teaching_resources (id),
  reason          text not null check (char_length(reason) > 0),
  evidence        jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  status          text not null default 'open' check (status in ('open', 'accepted', 'dismissed', 'completed')),
  intervention_id uuid references public.academic_interventions (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
comment on table public.learning_recommendations is 'A suggested next step for a learner, derived from recorded evidence (reason + evidence explain why). Can be linked to an academic_interventions record. No predictions.';
create unique index learning_recommendations_one_open_idx on public.learning_recommendations (learner_id, objective_id, kind) where status = 'open';

create index school_grade_map_school_idx on public.school_grade_curriculum_map (school_id);
create index school_subject_map_school_idx on public.school_subject_curriculum_map (school_id);
create index class_topic_plans_school_idx on public.class_topic_plans (school_id, class_id);
create index class_learning_assignments_class_idx on public.class_learning_assignments (school_id, class_id, status);
create index learning_attempts_learner_idx on public.learning_attempts (learner_id, created_at desc);
create index learning_attempts_school_idx on public.learning_attempts (school_id);
create index learner_objective_progress_school_idx on public.learner_objective_progress (school_id, objective_id);
create index learner_lesson_progress_school_idx on public.learner_lesson_progress (school_id, lesson_id);
create index learning_recommendations_school_idx on public.learning_recommendations (school_id, status);

-- ---------------------------------------------------------------------------
-- 7. Triggers
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  -- updated_at everywhere it exists
  foreach t in array array[
    'curriculum_versions', 'curriculum_phases', 'curriculum_grades', 'curriculum_subjects', 'curriculum_grade_subjects',
    'curriculum_terms', 'curriculum_topics', 'curriculum_subtopics', 'curriculum_objectives', 'curriculum_skills',
    'lessons', 'teaching_resources', 'learning_activities', 'learning_assessments', 'class_topic_plans',
    'class_learning_assignments', 'learner_objective_progress', 'learner_lesson_progress'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  end loop;

  -- status is RPC-only
  foreach t in array array[
    'curriculum_versions', 'curriculum_topics', 'curriculum_subtopics', 'curriculum_objectives', 'curriculum_skills',
    'lessons', 'teaching_resources', 'learning_assessments'
  ] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.content_protect_status()', t || '_protect_status', t);
  end loop;

  -- published content is immutable
  foreach t in array array['lessons', 'teaching_resources', 'learning_assessments'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.content_freeze()', t || '_freeze', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.content_validate_topic_scope()', t || '_topic_scope', t);
  end loop;

  -- a version's hierarchy is frozen once approved
  foreach t in array array[
    'curriculum_phases', 'curriculum_grades', 'curriculum_subjects', 'curriculum_grade_subjects', 'curriculum_terms',
    'curriculum_topics', 'curriculum_subtopics', 'curriculum_objectives', 'curriculum_skills'
  ] loop
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.curriculum_hierarchy_freeze()', t || '_freeze', t);
  end loop;
end $$;

create trigger lessons_created_updated_by before insert or update on public.lessons for each row execute function public.set_created_updated_by();
create trigger teaching_resources_created_updated_by before insert or update on public.teaching_resources for each row execute function public.set_created_updated_by();
create trigger learning_assessments_created_updated_by before insert or update on public.learning_assessments for each row execute function public.set_created_updated_by();
create or replace function public.curriculum_versions_set_created_by()
returns trigger language plpgsql as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;
create trigger curriculum_versions_set_created_by before insert on public.curriculum_versions
  for each row execute function public.curriculum_versions_set_created_by();

create trigger lesson_objectives_child_freeze before insert or update or delete on public.lesson_objectives
  for each row execute function public.content_child_freeze('lessons', 'lesson_id');
create trigger lesson_resources_child_freeze before insert or update or delete on public.lesson_resources
  for each row execute function public.content_child_freeze('lessons', 'lesson_id');
create trigger resource_objectives_child_freeze before insert or update or delete on public.resource_objectives
  for each row execute function public.content_child_freeze('teaching_resources', 'resource_id');
create trigger learning_activities_child_freeze before insert or update or delete on public.learning_activities
  for each row execute function public.content_child_freeze('lessons', 'lesson_id');
create trigger assessment_objectives_child_freeze before insert or update or delete on public.assessment_objectives
  for each row execute function public.content_child_freeze('learning_assessments', 'assessment_id');
create trigger assessment_questions_child_freeze before insert or update or delete on public.assessment_questions
  for each row execute function public.content_child_freeze('learning_assessments', 'assessment_id');
create trigger assessment_question_keys_child_freeze before insert or update or delete on public.assessment_question_keys
  for each row execute function public.content_child_freeze('learning_assessments', 'assessment_id');

create trigger school_grade_map_validate before insert or update on public.school_grade_curriculum_map
  for each row execute function public.curriculum_map_validate_school();
create trigger school_subject_map_validate before insert or update on public.school_subject_curriculum_map
  for each row execute function public.curriculum_map_validate_school();

-- ---------------------------------------------------------------------------
-- 8. Row level security
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  -- Hierarchy tables: readable when the version is published/retired (or by a platform admin).
  foreach t in array array[
    'curriculum_phases', 'curriculum_grades', 'curriculum_subjects', 'curriculum_grade_subjects', 'curriculum_terms',
    'curriculum_topics', 'curriculum_subtopics', 'curriculum_objectives', 'curriculum_skills'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy %I on public.%I for select to authenticated
      using ((select public.is_platform_admin())
             or version_id in (select v.id from public.curriculum_versions v where v.status in ('published', 'retired')))$p$, t || '_select', t);
    execute format($p$create policy %I on public.%I for insert to authenticated with check ((select public.is_platform_admin()))$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated
      using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()))$p$, t || '_update', t);
    execute format($p$create policy %I on public.%I for delete to authenticated using ((select public.is_platform_admin()))$p$, t || '_delete', t);
  end loop;

  -- Content units: readable when published/retired and their curriculum version is readable.
  foreach t in array array['lessons', 'teaching_resources', 'learning_assessments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy %I on public.%I for select to authenticated
      using ((select public.is_platform_admin())
             or (status in ('published', 'retired')
                 and curriculum_version_id in (select v.id from public.curriculum_versions v where v.status in ('published', 'retired'))))$p$, t || '_select', t);
    execute format($p$create policy %I on public.%I for insert to authenticated with check ((select public.is_platform_admin()))$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated
      using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()))$p$, t || '_update', t);
  end loop;
end $$;

alter table public.curriculum_versions enable row level security;
alter table public.curriculum_versions force row level security;
create policy curriculum_versions_select on public.curriculum_versions for select to authenticated
  using ((select public.is_platform_admin()) or status in ('published', 'retired'));
create policy curriculum_versions_insert on public.curriculum_versions for insert to authenticated
  with check ((select public.is_platform_admin()));
create policy curriculum_versions_update on public.curriculum_versions for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

-- Children of content units: readable exactly when the parent is.
do $$
declare
  spec text[];
begin
  foreach spec slice 1 in array array[
    array['lesson_objectives', 'lessons', 'lesson_id'],
    array['lesson_resources', 'lessons', 'lesson_id'],
    array['learning_activities', 'lessons', 'lesson_id'],
    array['resource_objectives', 'teaching_resources', 'resource_id'],
    array['assessment_objectives', 'learning_assessments', 'assessment_id'],
    array['assessment_questions', 'learning_assessments', 'assessment_id']
  ] loop
    execute format('alter table public.%I enable row level security', spec[1]);
    execute format('alter table public.%I force row level security', spec[1]);
    execute format($p$create policy %I on public.%I for select to authenticated
      using ((select public.is_platform_admin()) or %I in (select p.id from public.%I p))$p$, spec[1] || '_select', spec[1], spec[3], spec[2]);
    execute format($p$create policy %I on public.%I for insert to authenticated with check ((select public.is_platform_admin()))$p$, spec[1] || '_insert', spec[1]);
    execute format($p$create policy %I on public.%I for update to authenticated
      using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()))$p$, spec[1] || '_update', spec[1]);
    execute format($p$create policy %I on public.%I for delete to authenticated using ((select public.is_platform_admin()))$p$, spec[1] || '_delete', spec[1]);
  end loop;
end $$;

-- Answer keys: staff (teachers, school leadership) and platform admins only.
alter table public.assessment_question_keys enable row level security;
alter table public.assessment_question_keys force row level security;
create policy assessment_question_keys_select on public.assessment_question_keys for select to authenticated
  using ((select public.is_platform_admin())
         or ((select public.current_tenant_id()) is not null
             and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('school_owner', 'principal', 'teacher', 'class_teacher', 'subject_teacher')
             and assessment_id in (select a.id from public.learning_assessments a)));
create policy assessment_question_keys_insert on public.assessment_question_keys for insert to authenticated
  with check ((select public.is_platform_admin()));
create policy assessment_question_keys_update on public.assessment_question_keys for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy assessment_question_keys_delete on public.assessment_question_keys for delete to authenticated
  using ((select public.is_platform_admin()));

alter table public.content_review_events enable row level security;
alter table public.content_review_events force row level security;
create policy content_review_events_select on public.content_review_events for select to authenticated
  using ((select public.is_platform_admin()));

-- Tenant configuration and plans: any academic viewer of the school can read; writes are RPC-only,
-- except the two mapping tables which an academic manager maintains directly.
alter table public.school_curriculum_adoptions enable row level security;
alter table public.school_curriculum_adoptions force row level security;
create policy school_curriculum_adoptions_select on public.school_curriculum_adoptions for select to authenticated
  using (public.can_view_academic(school_id));

alter table public.school_grade_curriculum_map enable row level security;
alter table public.school_grade_curriculum_map force row level security;
create policy school_grade_map_select on public.school_grade_curriculum_map for select to authenticated using (public.can_view_academic(school_id));
create policy school_grade_map_insert on public.school_grade_curriculum_map for insert to authenticated with check (public.can_manage_academic(school_id));
create policy school_grade_map_update on public.school_grade_curriculum_map for update to authenticated
  using (public.can_manage_academic(school_id)) with check (public.can_manage_academic(school_id));
create policy school_grade_map_delete on public.school_grade_curriculum_map for delete to authenticated using (public.can_manage_academic(school_id));

alter table public.school_subject_curriculum_map enable row level security;
alter table public.school_subject_curriculum_map force row level security;
create policy school_subject_map_select on public.school_subject_curriculum_map for select to authenticated using (public.can_view_academic(school_id));
create policy school_subject_map_insert on public.school_subject_curriculum_map for insert to authenticated with check (public.can_manage_academic(school_id));
create policy school_subject_map_update on public.school_subject_curriculum_map for update to authenticated
  using (public.can_manage_academic(school_id)) with check (public.can_manage_academic(school_id));
create policy school_subject_map_delete on public.school_subject_curriculum_map for delete to authenticated using (public.can_manage_academic(school_id));

alter table public.class_topic_plans enable row level security;
alter table public.class_topic_plans force row level security;
create policy class_topic_plans_select on public.class_topic_plans for select to authenticated using (public.can_view_academic(school_id));

alter table public.class_learning_assignments enable row level security;
alter table public.class_learning_assignments force row level security;
create policy class_learning_assignments_select on public.class_learning_assignments for select to authenticated using (public.can_view_academic(school_id));

-- Learner evidence and progress: academic managers, the teacher of that learner, the learner, or their guardians.
do $$
declare t text;
begin
  foreach t in array array['learning_attempts', 'learner_objective_progress', 'learner_lesson_progress', 'learning_recommendations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (
      public.can_manage_academic(school_id)
      or (public.can_view_academic(school_id) and learner_id = any((select public.my_taught_learner_ids())::uuid[]))
      or (school_id = (select public.current_tenant_id())
          and (learner_id = any((select public.my_self_learner_ids())::uuid[])
               or learner_id = any((select public.my_guardian_learner_ids())::uuid[]))))$p$, t || '_select', t);
  end loop;
end $$;

-- Re-run the policy optimiser so the new policies use InitPlans like every other table.
select public.rls_optimize_policies();
