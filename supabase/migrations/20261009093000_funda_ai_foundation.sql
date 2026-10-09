-- Funda AI, Phase 1: the database half of the AI foundation.
--
-- Design (see docs/FUNDA_AI.md):
--
-- * The AI never gets its own data access. The funda-ai Edge Function runs
--   every data tool with the SIGNED-IN USER's JWT, so the existing RLS
--   policies decide what a tool can read (user -> school -> role -> data).
--   Nothing in this migration grants AI access to school data.
--
-- * This migration holds only the AI control plane:
--     ai_features          feature flags + policy (roles, tools, limits,
--                          model tier, retention, human approval)
--     ai_school_settings   per-school enablement (pilots) and token budget
--     ai_requests          one row per AI request: audit + usage + rate-limit
--                          source (no prompt or response text)
--     ai_tool_calls        one row per tool execution
--     ai_conversations,
--     ai_messages          optional content storage, OFF by default
--                          (ai_features.store_content), owner-only
--     ai_feedback          helpful / not helpful / problem reports
--
-- * ai_authorize_request() is the policy gate. It runs as the caller (so
--   role and school come from the same JWT/profile the rest of the app
--   uses), checks flags, role, school enablement, input size, rate limits
--   and the school's monthly token budget, and records the decision.
--   Completion, tool-call and content writes are service-role only (the
--   Edge Function), so a user cannot forge usage figures.
--
-- * Everything is additive and removable: dropping these tables and
--   functions removes Funda AI without touching any other feature. Funda AI
--   is OFF by default (no feature enabled, no school enabled).

-- ===========================================================================
-- 1. Tables
-- ===========================================================================

create table public.ai_features (
  key                         text primary key check (key ~ '^[a-z][a-z0-9_]{2,39}$'),
  name                        text not null check (char_length(btrim(name)) between 1 and 80),
  description                 text check (description is null or char_length(description) <= 500),
  enabled                     boolean not null default false,
  allowed_roles               text[] not null default '{}',
  allowed_tools               text[] not null default '{}',
  prompt_id                   text not null check (prompt_id ~ '^[a-z][a-z0-9_]{2,59}$'),
  model_tier                  text not null default 'standard' check (model_tier in ('simple', 'standard', 'complex')),
  max_input_chars             integer not null default 4000 check (max_input_chars between 100 and 50000),
  max_output_tokens           integer not null default 16000 check (max_output_tokens between 256 and 64000),
  user_requests_per_minute    integer not null default 6 check (user_requests_per_minute between 1 and 120),
  user_requests_per_day       integer not null default 150 check (user_requests_per_day between 1 and 10000),
  school_requests_per_day     integer not null default 3000 check (school_requests_per_day between 1 and 1000000),
  school_monthly_token_budget bigint check (school_monthly_token_budget is null or school_monthly_token_budget > 0),
  allow_without_school        boolean not null default false,
  store_content               boolean not null default false,
  content_retention_days      integer not null default 30 check (content_retention_days between 1 and 365),
  audit_retention_days        integer not null default 365 check (audit_retention_days between 30 and 3650),
  requires_human_approval     boolean not null default false,
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid references public.profiles (id) on delete set null
);

comment on table public.ai_features is
  'Funda AI feature flags and policy. A feature runs only when enabled here AND enabled for the caller''s school (ai_school_settings) AND the caller''s role is listed.';

create table public.ai_school_settings (
  school_id             uuid primary key references public.schools (id) on delete cascade,
  enabled               boolean not null default false,
  enabled_features      text[],
  monthly_token_budget  bigint check (monthly_token_budget is null or monthly_token_budget > 0),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles (id) on delete set null
);

comment on column public.ai_school_settings.enabled_features is
  'Null means every globally enabled feature; otherwise only the listed feature keys.';

create table public.ai_requests (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete cascade,
  school_id             uuid references public.schools (id) on delete cascade,
  role                  text not null,
  feature               text not null references public.ai_features (key) on delete restrict,
  status                text not null check (status in ('authorized', 'blocked', 'succeeded', 'failed', 'safety_escalated')),
  block_reason          text,
  client_request_id     text check (client_request_id is null or client_request_id ~ '^[A-Za-z0-9._:-]{8,64}$'),
  input_chars           integer not null default 0,
  provider              text,
  model                 text,
  model_tier            text,
  prompt_id             text,
  prompt_version        integer,
  input_tokens          integer,
  output_tokens         integer,
  estimated_cost_micros bigint,
  tool_calls            integer not null default 0,
  safety_flags          text[] not null default '{}',
  human_approval        text not null default 'not_required'
                          check (human_approval in ('not_required', 'required', 'approved', 'rejected')),
  error_code            text,
  duration_ms           integer,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz
);

comment on table public.ai_requests is
  'One row per Funda AI request: who, which school and role, feature, model, prompt version, tokens, tools, safety flags and outcome. Never stores prompt or response text. Also the source of AI rate limits and token budgets.';

create index ai_requests_user_time_idx on public.ai_requests (user_id, created_at desc);
create index ai_requests_school_time_idx on public.ai_requests (school_id, created_at desc) where school_id is not null;
create index ai_requests_feature_time_idx on public.ai_requests (feature, created_at desc);

create table public.ai_tool_calls (
  id            bigint generated always as identity primary key,
  request_id    uuid not null references public.ai_requests (id) on delete cascade,
  tool          text not null,
  status        text not null check (status in ('ok', 'empty', 'denied', 'invalid_input', 'invalid_output', 'error')),
  duration_ms   integer,
  result_count  integer,
  error_code    text,
  created_at    timestamptz not null default now()
);

create index ai_tool_calls_request_idx on public.ai_tool_calls (request_id);

create table public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  school_id   uuid references public.schools (id) on delete cascade,
  feature     text not null references public.ai_features (key) on delete restrict,
  title       text check (title is null or char_length(title) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  archived_at timestamptz
);

create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);
create index ai_conversations_expiry_idx on public.ai_conversations (expires_at);

create table public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  request_id      uuid references public.ai_requests (id) on delete set null,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null check (char_length(content) <= 20000),
  structured      jsonb,
  created_at      timestamptz not null default now()
);

create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

create table public.ai_feedback (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.ai_requests (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  rating      text not null check (rating in ('helpful', 'not_helpful', 'problem')),
  comment     text check (comment is null or char_length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  constraint ai_feedback_one_per_request unique (request_id, user_id)
);

-- ===========================================================================
-- 2. RLS and grants
-- ===========================================================================

alter table public.ai_features enable row level security;
alter table public.ai_features force row level security;
alter table public.ai_school_settings enable row level security;
alter table public.ai_school_settings force row level security;
alter table public.ai_requests enable row level security;
alter table public.ai_requests force row level security;
alter table public.ai_tool_calls enable row level security;
alter table public.ai_tool_calls force row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_conversations force row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_messages force row level security;
alter table public.ai_feedback enable row level security;
alter table public.ai_feedback force row level security;

-- Default privileges grant everything to anon/authenticated; take it back.
revoke all on public.ai_features, public.ai_school_settings, public.ai_requests, public.ai_tool_calls,
  public.ai_conversations, public.ai_messages, public.ai_feedback from public, anon, authenticated;

grant select on public.ai_features, public.ai_school_settings, public.ai_requests, public.ai_tool_calls,
  public.ai_conversations, public.ai_messages, public.ai_feedback to authenticated;
grant delete on public.ai_conversations to authenticated;

-- Configuration: platform administrators; a school's own leadership can read
-- its school's AI settings.
create policy ai_features_select on public.ai_features
  for select to authenticated using ((select public.is_platform_admin()));
create policy ai_school_settings_select on public.ai_school_settings
  for select to authenticated
  using ((select public.is_platform_admin())
         or (school_id = (select public.current_tenant_id()) and (select public.can_manage_academic((select public.current_tenant_id())))));

-- Audit: your own requests only; platform administrators see all.
create policy ai_requests_select on public.ai_requests
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_platform_admin()));
create policy ai_tool_calls_select on public.ai_tool_calls
  for select to authenticated
  using ((select public.is_platform_admin())
         or exists (select 1 from public.ai_requests r where r.id = ai_tool_calls.request_id and r.user_id = (select auth.uid())));

-- Conversation content: strictly the owner. Platform administrators do NOT
-- read other people's conversations.
create policy ai_conversations_select on public.ai_conversations
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_conversations_delete on public.ai_conversations
  for delete to authenticated using (user_id = (select auth.uid()));
create policy ai_messages_select on public.ai_messages
  for select to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = ai_messages.conversation_id and c.user_id = (select auth.uid())));
create policy ai_feedback_select on public.ai_feedback
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_platform_admin()));

-- ===========================================================================
-- 3. Policy gate
-- ===========================================================================

create or replace function public.ai_caller_role()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

-- Records the decision and returns it. Never raises for a policy outcome, so
-- blocked requests are audited too. Reasons: not_authenticated,
-- profile_inactive, feature_disabled, role_not_allowed,
-- school_context_required, school_not_enabled, input_too_large,
-- rate_limited, budget_exhausted.
create or replace function public.ai_authorize_request(
  p_feature text,
  p_input_chars integer,
  p_client_request_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.ai_caller_role();
  v_school uuid := public.current_tenant_id();
  v_feature public.ai_features;
  v_settings public.ai_school_settings;
  v_reason text;
  v_count integer;
  v_budget bigint;
  v_used bigint;
  v_id uuid;
  v_client text := case when p_client_request_id ~ '^[A-Za-z0-9._:-]{8,64}$' then p_client_request_id end;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    return jsonb_build_object('allowed', false, 'reason', 'profile_inactive');
  end if;

  select * into v_feature from public.ai_features where key = p_feature;
  if v_feature.key is null then
    -- Unknown features are not recorded (the foreign key needs a real key).
    return jsonb_build_object('allowed', false, 'reason', 'feature_disabled');
  end if;

  if not v_feature.enabled then
    v_reason := 'feature_disabled';
  elsif not (v_role = any (v_feature.allowed_roles)) then
    v_reason := 'role_not_allowed';
  elsif v_school is null and not v_feature.allow_without_school then
    v_reason := 'school_context_required';
  elsif v_school is not null then
    select * into v_settings from public.ai_school_settings where school_id = v_school;
    if v_settings.school_id is null or not v_settings.enabled
       or (v_settings.enabled_features is not null and not (p_feature = any (v_settings.enabled_features))) then
      v_reason := 'school_not_enabled';
    end if;
  end if;

  if v_reason is null and coalesce(p_input_chars, 0) > v_feature.max_input_chars then
    v_reason := 'input_too_large';
  end if;

  if v_reason is null then
    select count(*) into v_count from public.ai_requests
    where user_id = v_uid and created_at > now() - interval '1 minute' and status <> 'blocked';
    if v_count >= v_feature.user_requests_per_minute then
      v_reason := 'rate_limited';
    end if;
  end if;
  if v_reason is null then
    select count(*) into v_count from public.ai_requests
    where user_id = v_uid and created_at > now() - interval '1 day' and status <> 'blocked';
    if v_count >= v_feature.user_requests_per_day then
      v_reason := 'rate_limited';
    end if;
  end if;
  if v_reason is null and v_school is not null then
    select count(*) into v_count from public.ai_requests
    where school_id = v_school and created_at > now() - interval '1 day' and status <> 'blocked';
    if v_count >= v_feature.school_requests_per_day then
      v_reason := 'rate_limited';
    end if;
  end if;

  if v_reason is null and v_school is not null then
    v_budget := coalesce(v_settings.monthly_token_budget, v_feature.school_monthly_token_budget);
    if v_budget is not null then
      select coalesce(sum(coalesce(input_tokens, 0) + coalesce(output_tokens, 0)), 0) into v_used
      from public.ai_requests
      where school_id = v_school and created_at >= date_trunc('month', now());
      if v_used >= v_budget then
        v_reason := 'budget_exhausted';
      end if;
    end if;
  end if;

  insert into public.ai_requests (user_id, school_id, role, feature, status, block_reason, client_request_id, input_chars,
                                  model_tier, prompt_id, human_approval)
  values (v_uid, v_school, v_role, p_feature, case when v_reason is null then 'authorized' else 'blocked' end, v_reason,
          v_client, greatest(coalesce(p_input_chars, 0), 0), v_feature.model_tier, v_feature.prompt_id,
          case when v_feature.requires_human_approval then 'required' else 'not_required' end)
  returning id into v_id;

  if v_reason is not null then
    return jsonb_build_object('allowed', false, 'reason', v_reason, 'request_id', v_id);
  end if;

  return jsonb_build_object(
    'allowed', true,
    'request_id', v_id,
    'principal', jsonb_build_object('user_id', v_uid, 'school_id', v_school, 'role', v_role),
    'policy', jsonb_build_object(
      'feature', v_feature.key,
      'prompt_id', v_feature.prompt_id,
      'model_tier', v_feature.model_tier,
      'allowed_tools', to_jsonb(v_feature.allowed_tools),
      'max_input_chars', v_feature.max_input_chars,
      'max_output_tokens', v_feature.max_output_tokens,
      'store_content', v_feature.store_content,
      'content_retention_days', v_feature.content_retention_days,
      'requires_human_approval', v_feature.requires_human_approval
    )
  );
end;
$$;

-- Features the caller may use right now (for the UI launcher). Does not
-- count against rate limits and reveals no limits or tool lists.
create or replace function public.ai_my_features()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', f.key, 'name', f.name, 'description', f.description) order by f.name), '[]'::jsonb)
  from public.ai_features f
  where f.enabled
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
    and public.ai_caller_role() = any (f.allowed_roles)
    and (
      (public.current_tenant_id() is null and f.allow_without_school)
      or exists (
        select 1 from public.ai_school_settings s
        where s.school_id = public.current_tenant_id() and s.enabled
          and (s.enabled_features is null or f.key = any (s.enabled_features))
      )
    )
$$;

-- ===========================================================================
-- 4. Service-role writes (the funda-ai Edge Function only)
-- ===========================================================================

create or replace function public.ai_record_tool_call(
  p_request_id uuid, p_tool text, p_status text, p_duration_ms integer, p_result_count integer, p_error_code text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  insert into public.ai_tool_calls (request_id, tool, status, duration_ms, result_count, error_code)
  values (p_request_id, left(p_tool, 80), p_status, p_duration_ms, p_result_count, left(p_error_code, 80));
  update public.ai_requests set tool_calls = tool_calls + 1 where id = p_request_id;
end;
$$;

create or replace function public.ai_complete_request(
  p_request_id uuid,
  p_status text,
  p_provider text,
  p_model text,
  p_prompt_id text,
  p_prompt_version integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_micros bigint,
  p_duration_ms integer,
  p_safety_flags text[],
  p_error_code text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_status not in ('succeeded', 'failed', 'safety_escalated') then
    raise exception 'invalid_argument: unknown completion status';
  end if;
  update public.ai_requests
     set status = p_status, provider = left(p_provider, 40), model = left(p_model, 80),
         prompt_id = coalesce(left(p_prompt_id, 60), prompt_id), prompt_version = p_prompt_version,
         input_tokens = p_input_tokens, output_tokens = p_output_tokens, estimated_cost_micros = p_estimated_cost_micros,
         duration_ms = p_duration_ms, safety_flags = coalesce(p_safety_flags, '{}'), error_code = left(p_error_code, 80),
         completed_at = now()
   where id = p_request_id and status = 'authorized';
end;
$$;

-- Stores one exchange when the feature allows content storage. The
-- conversation must belong to the request's user.
create or replace function public.ai_store_exchange(
  p_request_id uuid, p_conversation_id uuid, p_user_text text, p_assistant_text text, p_structured jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_req public.ai_requests;
  v_feature public.ai_features;
  v_conv uuid := p_conversation_id;
begin
  select * into v_req from public.ai_requests where id = p_request_id;
  select * into v_feature from public.ai_features where key = v_req.feature;
  if v_req.id is null or not v_feature.store_content then
    return null;
  end if;
  if v_conv is not null and not exists (
    select 1 from public.ai_conversations where id = v_conv and user_id = v_req.user_id and archived_at is null) then
    raise exception 'insufficient_privilege: conversation does not belong to this user';
  end if;
  if v_conv is null then
    insert into public.ai_conversations (user_id, school_id, feature, title, expires_at)
    values (v_req.user_id, v_req.school_id, v_req.feature, left(p_user_text, 120),
            now() + make_interval(days => v_feature.content_retention_days))
    returning id into v_conv;
  else
    update public.ai_conversations
       set updated_at = now(), expires_at = now() + make_interval(days => v_feature.content_retention_days)
     where id = v_conv;
  end if;
  insert into public.ai_messages (conversation_id, request_id, role, content)
  values (v_conv, p_request_id, 'user', left(p_user_text, 20000));
  insert into public.ai_messages (conversation_id, request_id, role, content, structured)
  values (v_conv, p_request_id, 'assistant', left(p_assistant_text, 20000), p_structured);
  return v_conv;
end;
$$;

-- Retention: removes expired conversations and request rows older than each
-- feature's audit retention. Intended for a scheduled job (service role).
create or replace function public.ai_purge_expired()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_conv integer;
  v_req integer;
begin
  delete from public.ai_conversations where expires_at < now();
  get diagnostics v_conv = row_count;
  delete from public.ai_requests r using public.ai_features f
  where f.key = r.feature and r.created_at < now() - make_interval(days => f.audit_retention_days);
  get diagnostics v_req = row_count;
  return jsonb_build_object('conversations', v_conv, 'requests', v_req);
end;
$$;

-- ===========================================================================
-- 5. User actions
-- ===========================================================================

create or replace function public.ai_submit_feedback(p_request_id uuid, p_rating text, p_comment text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_rating not in ('helpful', 'not_helpful', 'problem') then
    raise exception 'invalid_argument: unknown rating';
  end if;
  if not exists (select 1 from public.ai_requests where id = p_request_id and user_id = auth.uid()) then
    raise exception 'insufficient_privilege: feedback can only be given on your own AI requests';
  end if;
  insert into public.ai_feedback (request_id, user_id, rating, comment)
  values (p_request_id, auth.uid(), p_rating, nullif(left(btrim(p_comment), 1000), ''))
  on conflict (request_id, user_id) do update set rating = excluded.rating, comment = excluded.comment, created_at = now();
end;
$$;

-- Usage report: platform administrators for any school (or all), school
-- leadership for their own school only.
create or replace function public.ai_usage_summary(p_from date, p_to date, p_school_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_school uuid := p_school_id;
begin
  if not public.is_platform_admin() then
    if public.current_tenant_id() is null or not public.can_manage_academic(public.current_tenant_id()) then
      raise exception 'insufficient_privilege: AI usage is visible to school leadership and platform administrators';
    end if;
    if v_school is not null and v_school <> public.current_tenant_id() then
      raise exception 'insufficient_privilege: this school is outside your scope';
    end if;
    v_school := public.current_tenant_id();
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid_argument: choose a period of at most one year';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'school_id', school_id, 'feature', feature, 'provider', provider, 'model', model,
      'requests', requests, 'succeeded', succeeded, 'failed', failed, 'blocked', blocked,
      'safety_escalated', safety_escalated, 'input_tokens', input_tokens, 'output_tokens', output_tokens,
      'estimated_cost_micros', estimated_cost_micros) order by school_id, feature, model)
    from (
      select school_id, feature, provider, model,
             count(*) as requests,
             count(*) filter (where status = 'succeeded') as succeeded,
             count(*) filter (where status = 'failed') as failed,
             count(*) filter (where status = 'blocked') as blocked,
             count(*) filter (where status = 'safety_escalated') as safety_escalated,
             coalesce(sum(input_tokens), 0) as input_tokens,
             coalesce(sum(output_tokens), 0) as output_tokens,
             sum(estimated_cost_micros) as estimated_cost_micros
      from public.ai_requests
      where created_at >= p_from and created_at < p_to + 1
        and (v_school is null or school_id = v_school)
      group by school_id, feature, provider, model
    ) t
  ), '[]'::jsonb);
end;
$$;

-- ===========================================================================
-- 6. Administration (platform administrators with an MFA session; audited)
-- ===========================================================================

create or replace function public.ai_require_platform_admin()
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can configure Funda AI';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required: two-factor authentication is required to configure Funda AI';
  end if;
end;
$$;

-- p_patch keys (all optional): enabled, allowed_roles, allowed_tools,
-- model_tier, max_input_chars, max_output_tokens, user_requests_per_minute,
-- user_requests_per_day, school_requests_per_day,
-- school_monthly_token_budget, allow_without_school, store_content,
-- content_retention_days, audit_retention_days, requires_human_approval.
create or replace function public.ai_admin_update_feature(p_key text, p_patch jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_before public.ai_features;
begin
  perform public.ai_require_platform_admin();
  select * into v_before from public.ai_features where key = p_key;
  if v_before.key is null then
    raise exception 'not_found: AI feature';
  end if;
  if exists (select 1 from jsonb_object_keys(coalesce(p_patch, '{}')) k where k not in (
    'enabled', 'allowed_roles', 'allowed_tools', 'model_tier', 'max_input_chars', 'max_output_tokens',
    'user_requests_per_minute', 'user_requests_per_day', 'school_requests_per_day', 'school_monthly_token_budget',
    'allow_without_school', 'store_content', 'content_retention_days', 'audit_retention_days', 'requires_human_approval')) then
    raise exception 'invalid_argument: unknown policy field';
  end if;

  update public.ai_features set
    enabled = coalesce((p_patch ->> 'enabled')::boolean, enabled),
    allowed_roles = coalesce((select array_agg(x) from jsonb_array_elements_text(p_patch -> 'allowed_roles') x), case when p_patch ? 'allowed_roles' then '{}'::text[] end, allowed_roles),
    allowed_tools = coalesce((select array_agg(x) from jsonb_array_elements_text(p_patch -> 'allowed_tools') x), case when p_patch ? 'allowed_tools' then '{}'::text[] end, allowed_tools),
    model_tier = coalesce(p_patch ->> 'model_tier', model_tier),
    max_input_chars = coalesce((p_patch ->> 'max_input_chars')::int, max_input_chars),
    max_output_tokens = coalesce((p_patch ->> 'max_output_tokens')::int, max_output_tokens),
    user_requests_per_minute = coalesce((p_patch ->> 'user_requests_per_minute')::int, user_requests_per_minute),
    user_requests_per_day = coalesce((p_patch ->> 'user_requests_per_day')::int, user_requests_per_day),
    school_requests_per_day = coalesce((p_patch ->> 'school_requests_per_day')::int, school_requests_per_day),
    school_monthly_token_budget = case when p_patch ? 'school_monthly_token_budget'
                                       then (p_patch ->> 'school_monthly_token_budget')::bigint else school_monthly_token_budget end,
    allow_without_school = coalesce((p_patch ->> 'allow_without_school')::boolean, allow_without_school),
    store_content = coalesce((p_patch ->> 'store_content')::boolean, store_content),
    content_retention_days = coalesce((p_patch ->> 'content_retention_days')::int, content_retention_days),
    audit_retention_days = coalesce((p_patch ->> 'audit_retention_days')::int, audit_retention_days),
    requires_human_approval = coalesce((p_patch ->> 'requires_human_approval')::boolean, requires_human_approval),
    updated_at = now(), updated_by = auth.uid()
  where key = p_key;

  perform public.write_audit_log(null, auth.uid(), 'ai_feature_updated', 'profiles', auth.uid(),
    jsonb_build_object('key', p_key, 'enabled', v_before.enabled), jsonb_build_object('key', p_key, 'patch', p_patch));
end;
$$;

create or replace function public.ai_admin_set_school(
  p_school_id uuid, p_enabled boolean, p_enabled_features text[] default null, p_monthly_token_budget bigint default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.ai_require_platform_admin();
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'not_found: school';
  end if;
  insert into public.ai_school_settings (school_id, enabled, enabled_features, monthly_token_budget, updated_by)
  values (p_school_id, coalesce(p_enabled, false), p_enabled_features, p_monthly_token_budget, auth.uid())
  on conflict (school_id) do update
    set enabled = excluded.enabled, enabled_features = excluded.enabled_features,
        monthly_token_budget = excluded.monthly_token_budget, updated_at = now(), updated_by = auth.uid();
  perform public.write_audit_log(p_school_id, auth.uid(), 'ai_school_settings_updated', 'schools', p_school_id, null,
    jsonb_build_object('enabled', p_enabled, 'features', p_enabled_features, 'monthly_token_budget', p_monthly_token_budget));
end;
$$;

-- ===========================================================================
-- 7. Grants
-- ===========================================================================

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'ai\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

grant execute on function public.ai_caller_role() to authenticated;
grant execute on function public.ai_authorize_request(text, integer, text) to authenticated;
grant execute on function public.ai_my_features() to authenticated;
grant execute on function public.ai_submit_feedback(uuid, text, text) to authenticated;
grant execute on function public.ai_usage_summary(date, date, uuid) to authenticated;
grant execute on function public.ai_admin_update_feature(text, jsonb) to authenticated;
grant execute on function public.ai_admin_set_school(uuid, boolean, text[], bigint) to authenticated;
grant execute on function public.ai_record_tool_call(uuid, text, text, integer, integer, text) to service_role;
grant execute on function public.ai_complete_request(uuid, text, text, text, text, integer, integer, integer, bigint, integer, text[], text) to service_role;
grant execute on function public.ai_store_exchange(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.ai_purge_expired() to service_role;

-- ===========================================================================
-- 8. Seed: the Phase 1 feature, OFF
-- ===========================================================================

insert into public.ai_features (key, name, description, enabled, allowed_roles, allowed_tools, prompt_id, model_tier)
values (
  'copilot', 'Funda AI Copilot',
  'Answers questions about the data you can already see in Funda360, with the figures it used.',
  false,
  array['school_owner', 'principal', 'vice_principal', 'department_head', 'teacher', 'class_teacher', 'subject_teacher'],
  array['find_learners', 'get_learner_attendance_summary', 'get_learner_assessment_summary', 'get_learner_fee_summary',
        'get_reporting_summary'],
  'school_copilot', 'standard'
)
on conflict (key) do nothing;

select public.rls_optimize_policies();
