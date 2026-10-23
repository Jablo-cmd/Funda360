-- Government readiness, part 2: the Provincial Dashboard and the Government
-- Data & Integration API. Both sit on the reporting layer from
-- 20261009091000_government_reporting.sql and share its definitions.
--
-- Design (see docs/PROVINCIAL_DASHBOARD.md and docs/GOVERNMENT_API.md):
--
-- * One scope authority. reporting_school_ids(), reporting_resolve_schools()
--   and reporting_learner_detail_allowed() remain the only places that decide
--   which schools a caller may see. This migration extends them with two new
--   kinds of caller:
--     - education officials assigned to a single school (assignments now
--       target an area OR a school);
--     - government API clients, which exist only inside gov_api_request(),
--       a function only the service role (the government-api Edge Function)
--       may execute.
--
-- * Provincial reporting needs province-level access: a platform
--   administrator, an official assigned to the province itself, or an API
--   client scoped to the province. A district or circuit official asking for
--   their province is refused (insufficient_privilege); a filter can only
--   narrow the province, never widen it.
--
-- * get_provincial_report() wraps get_government_report(): every figure on
--   the Provincial Dashboard and in the API comes from the same calculation
--   as the District Dashboard and Government Reports.
--
-- * API credentials: a random token is shown once; only its SHA-256 hash is
--   stored. Clients carry their own scope (one area or one school),
--   permissions, learner-detail grant, expiry and rate limit. Every request,
--   successful or not, is written to government_api_requests (append-only).
--
-- * Imports are VALIDATE -> PREVIEW -> COMMIT. The API can only create a
--   validated import job; a platform administrator commits it. The only
--   import kind is school identifiers (EMIS numbers) for schools already in
--   the client's scope. Learner, attendance and assessment imports need an
--   external specification and are not implemented.
--
-- Nothing is dropped. No existing policy is weakened. No school record is
-- modified, and no education area is created, by this migration.

-- ===========================================================================
-- 1. School-level official assignments
-- ===========================================================================

alter table public.education_official_assignments
  add column if not exists school_id uuid references public.schools (id) on delete restrict;

alter table public.education_official_assignments
  alter column area_id drop not null;

alter table public.education_official_assignments
  add constraint education_official_assignments_target check (num_nonnulls(area_id, school_id) = 1);

create unique index if not exists education_official_assignments_active_school_key
  on public.education_official_assignments (profile_id, school_id) where active and school_id is not null;
create index if not exists education_official_assignments_school_idx
  on public.education_official_assignments (school_id) where school_id is not null;

comment on column public.education_official_assignments.school_id is
  'Set instead of area_id for an official whose mandate is a single school.';

-- ===========================================================================
-- 2. Government API clients, request log and import jobs
-- ===========================================================================

create table public.government_api_clients (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (char_length(btrim(name)) between 1 and 120),
  description             text check (description is null or char_length(description) <= 500),
  area_id                 uuid references public.education_areas (id) on delete restrict,
  school_id               uuid references public.schools (id) on delete restrict,
  permissions             text[] not null check (
                            cardinality(permissions) > 0
                            and permissions <@ array['schools', 'learners', 'attendance', 'assessments', 'staff',
                                                     'interventions', 'data_quality', 'reports', 'imports']::text[]),
  can_view_learner_detail boolean not null default false,
  rate_limit_per_minute   integer not null default 60 check (rate_limit_per_minute between 1 and 600),
  token_prefix            text not null unique check (token_prefix ~ '^[0-9a-f]{8}$'),
  token_hash              text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at              timestamptz,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  revoked_at              timestamptz,
  revoked_by              uuid references public.profiles (id) on delete set null,
  constraint government_api_clients_scope check (num_nonnulls(area_id, school_id) = 1)
);

comment on table public.government_api_clients is
  'Machine clients of the government-api Edge Function. Scope is one education area (and everything beneath it) or one school. Only the SHA-256 hash of the token is stored; the token is shown once at creation.';

create index government_api_clients_area_idx on public.government_api_clients (area_id) where area_id is not null;
create index government_api_clients_school_idx on public.government_api_clients (school_id) where school_id is not null;

create table public.government_api_requests (
  id           bigint generated always as identity primary key,
  request_id   text not null,
  client_id    uuid references public.government_api_clients (id) on delete restrict,
  token_prefix text,
  method       text not null,
  path         text not null,
  operation    text,
  status       smallint not null,
  error_code   text,
  result_count integer,
  duration_ms  integer,
  query        jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.government_api_requests is
  'Append-only log of every government API request: client, operation, status, row count and duration. Never contains tokens, request bodies or learner data. Also the source for per-client rate limiting.';

create index government_api_requests_client_time_idx on public.government_api_requests (client_id, created_at desc);
create index government_api_requests_time_idx on public.government_api_requests (created_at);

create table public.government_import_jobs (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.government_api_clients (id) on delete restrict,
  kind            text not null check (kind in ('school_identifiers')),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
  payload_hash    text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  status          text not null check (status in ('validated', 'failed', 'committed', 'rejected')),
  total_rows      integer not null,
  valid_rows      integer not null,
  error_rows      integer not null,
  rows            jsonb not null default '[]'::jsonb,
  errors          jsonb not null default '[]'::jsonb,
  request_id      text,
  created_at      timestamptz not null default now(),
  reviewed_by     uuid references public.profiles (id) on delete set null,
  reviewed_at     timestamptz,
  review_notes    text check (review_notes is null or char_length(review_notes) <= 500),
  constraint government_import_jobs_idempotency unique (client_id, idempotency_key)
);

comment on table public.government_import_jobs is
  'Imports submitted through the government API. Created already validated (or failed); nothing is written to school records until a platform administrator commits the job.';

create index government_import_jobs_status_idx on public.government_import_jobs (status, created_at desc);

-- Append-only request log: refuse UPDATE and DELETE even for privileged code.
create or replace function public.government_api_requests_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'insufficient_privilege: the government API request log is append-only';
end;
$$;

create trigger government_api_requests_append_only
  before update or delete on public.government_api_requests
  for each row execute function public.government_api_requests_append_only();

revoke execute on function public.government_api_requests_append_only() from public, anon, authenticated;

alter table public.government_api_clients enable row level security;
alter table public.government_api_clients force row level security;
alter table public.government_api_requests enable row level security;
alter table public.government_api_requests force row level security;
alter table public.government_import_jobs enable row level security;
alter table public.government_import_jobs force row level security;

-- Reads for platform administrators (with MFA) only. Every write goes
-- through the SECURITY DEFINER functions below. token_hash is never granted.
create policy government_api_clients_select on public.government_api_clients
  for select to authenticated using ((select public.reporting_platform_admin()));
create policy government_api_requests_select on public.government_api_requests
  for select to authenticated using ((select public.reporting_platform_admin()));
create policy government_import_jobs_select on public.government_import_jobs
  for select to authenticated using ((select public.reporting_platform_admin()));

-- Default privileges give anon/authenticated every table privilege; take
-- them all back first so the column list below is the only read access.
revoke all on public.government_api_clients from public, anon, authenticated;
revoke all on public.government_api_requests from public, anon, authenticated;
revoke all on public.government_import_jobs from public, anon, authenticated;

grant select (id, name, description, area_id, school_id, permissions, can_view_learner_detail, rate_limit_per_minute,
              token_prefix, expires_at, created_by, created_at, revoked_at, revoked_by)
  on public.government_api_clients to authenticated;
grant select on public.government_api_requests to authenticated;
grant select on public.government_import_jobs to authenticated;

-- ===========================================================================
-- 3. API client context
-- ===========================================================================

create or replace function public.government_api_hash_token(p_token text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

-- The API client of the current request, or null. Only ever non-null inside
-- gov_api_request(): it needs the service-role JWT (which no browser holds)
-- and the transaction-local setting that gov_api_request() sets after
-- authenticating the token. Revoked or expired clients are never returned,
-- so a revocation takes effect on the next request.
create or replace function public.reporting_api_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.government_api_clients c
  where coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    and c.id = nullif(current_setting('funda360.government_api_client', true), '')::uuid
    and c.revoked_at is null
    and (c.expires_at is null or c.expires_at > now())
$$;

-- Schools an API client may see: everything under its area, or its school.
create or replace function public.government_api_client_school_ids(p_client_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  with recursive c as (
    select area_id, school_id from public.government_api_clients
    where id = p_client_id and revoked_at is null and (expires_at is null or expires_at > now())
  ),
  sub as (
    select area_id as id from c where area_id is not null
    union
    select a.id from public.education_areas a join sub on a.parent_id = sub.id
  )
  select coalesce(array_agg(s.id), '{}')
  from public.schools s
  where s.education_area_id in (select id from sub)
     or s.id in (select school_id from c where school_id is not null)
$$;

-- Schools assigned directly to the calling official.
create or replace function public.official_school_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(a.school_id), '{}')
  from public.education_official_assignments a
  where a.profile_id = auth.uid() and a.active and a.school_id is not null and public.is_education_official()
$$;

-- ===========================================================================
-- 4. Scope functions, extended (same contracts as 20261009091000)
-- ===========================================================================

create or replace function public.official_area_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  with recursive scope as (
    select a.area_id as id
    from public.education_official_assignments a
    where a.profile_id = auth.uid() and a.active and a.area_id is not null and public.is_education_official()
    union
    select c.id from public.education_areas c join scope s on c.parent_id = s.id
  )
  select coalesce(array_agg(id), '{}') from scope
$$;

create or replace function public.reporting_visible_area_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  with recursive base as (
    select id from public.education_areas where public.reporting_platform_admin()
    union
    select unnest(public.official_area_ids())
    union
    select s.education_area_id from public.schools s
    where s.id = any (public.official_school_ids()) and s.education_area_id is not null
    union
    select s.education_area_id from public.schools s
    where s.id = public.current_tenant_id()
      and s.education_area_id is not null
      and public.can_manage_academic(s.id)
    union
    select a.id from public.education_areas a
    join public.government_api_clients c on c.area_id = a.id
    where c.id = public.reporting_api_client_id()
    union
    select s.education_area_id from public.schools s
    where public.reporting_api_client_id() is not null
      and s.id = any (public.government_api_client_school_ids(public.reporting_api_client_id()))
      and s.education_area_id is not null
  ),
  down as (
    -- An API client scoped to an area may also name the areas beneath it.
    select a.id from public.education_areas a
    join public.government_api_clients c on c.area_id = a.id
    where c.id = public.reporting_api_client_id()
    union
    select a.id from public.education_areas a join down on a.parent_id = down.id
  ),
  up as (
    select id from base
    union
    select id from down
    union
    select a.parent_id from public.education_areas a join up on a.id = up.id where a.parent_id is not null
  )
  select coalesce(array_agg(distinct id), '{}') from up
$$;

create or replace function public.reporting_school_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.reporting_api_client_id() is not null then
      public.government_api_client_school_ids(public.reporting_api_client_id())
    when public.reporting_platform_admin() then
      (select coalesce(array_agg(id), '{}') from public.schools)
    when public.is_education_official() then
      (select coalesce(array_agg(s.id), '{}') from public.schools s
       where s.education_area_id = any (public.official_area_ids())
          or s.id = any (public.official_school_ids()))
    when public.current_tenant_id() is not null and public.can_manage_academic(public.current_tenant_id()) then
      array[public.current_tenant_id()]
    else '{}'::uuid[]
  end
$$;

-- 'api' | 'platform' | 'official' | 'school' | null.
create or replace function public.reporting_caller_kind()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.reporting_api_client_id() is not null then 'api'
    when public.reporting_platform_admin() then 'platform'
    when public.is_education_official() then 'official'
    when public.current_tenant_id() is not null and public.can_manage_academic(public.current_tenant_id()) then 'school'
    else null
  end
$$;

create or replace function public.reporting_learner_detail_allowed(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.reporting_api_client_id() is not null then
      exists (select 1 from public.government_api_clients c
              where c.id = public.reporting_api_client_id() and c.can_view_learner_detail)
      and p_school_id = any (public.government_api_client_school_ids(public.reporting_api_client_id()))
    else
      public.reporting_platform_admin()
      or (p_school_id = public.current_tenant_id() and public.can_manage_academic(p_school_id))
      or (
        public.is_education_official()
        and (
          exists (
            with recursive covered as (
              select a.area_id as id from public.education_official_assignments a
              where a.profile_id = auth.uid() and a.active and a.can_view_learner_detail and a.area_id is not null
              union
              select c.id from public.education_areas c join covered on c.parent_id = covered.id
            )
            select 1 from public.schools s
            where s.id = p_school_id and s.education_area_id in (select id from covered)
          )
          or exists (
            select 1 from public.education_official_assignments a
            where a.profile_id = auth.uid() and a.active and a.can_view_learner_detail and a.school_id = p_school_id
          )
        )
      )
  end
$$;

-- Adds the school_ids key (a JSON array of school ids; every id must be in
-- scope) to the filters understood by every reporting function. The API
-- uses it to compute a page of schools at a time with the same
-- calculation as the dashboards.
create or replace function public.reporting_resolve_schools(p_filters jsonb)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind text := public.reporting_caller_kind();
  v_allowed uuid[];
  v_area uuid;
  v_school uuid;
  v_list uuid[];
  v_result uuid[];
begin
  perform public.reporting_require_mfa();
  if v_kind is null then
    raise exception 'insufficient_privilege: no reporting access';
  end if;

  v_allowed := public.reporting_school_ids();
  v_area := coalesce(
    nullif(p_filters ->> 'circuit_id', '')::uuid,
    nullif(p_filters ->> 'district_id', '')::uuid,
    nullif(p_filters ->> 'province_id', '')::uuid
  );
  v_school := nullif(p_filters ->> 'school_id', '')::uuid;

  if v_area is not null and not (v_area = any (public.reporting_visible_area_ids())) then
    raise exception 'insufficient_privilege: this education area is outside your reporting scope';
  end if;
  if v_school is not null and not (v_school = any (v_allowed)) then
    raise exception 'insufficient_privilege: this school is outside your reporting scope';
  end if;

  if jsonb_typeof(p_filters -> 'school_ids') = 'array' then
    select coalesce(array_agg(value::uuid), '{}') into v_list from jsonb_array_elements_text(p_filters -> 'school_ids');
    if cardinality(v_list) > 500 then
      raise exception 'invalid_argument: at most 500 school ids per request';
    end if;
    if not (v_list <@ v_allowed) then
      raise exception 'insufficient_privilege: this school is outside your reporting scope';
    end if;
  elsif p_filters ? 'school_ids' and jsonb_typeof(p_filters -> 'school_ids') <> 'null' then
    raise exception 'invalid_argument: school_ids must be an array';
  end if;

  with recursive sub as (
    select v_area as id where v_area is not null
    union
    select c.id from public.education_areas c join sub on c.parent_id = sub.id
  )
  select coalesce(array_agg(s.id), '{}') into v_result
  from public.schools s
  where s.id = any (v_allowed)
    and (v_school is null or s.id = v_school)
    and (v_list is null or s.id = any (v_list))
    and (v_area is null or s.education_area_id in (select id from sub));

  return v_result;
end;
$$;

-- Province, district and circuit of each school (same rule as the
-- area_chain in get_government_report: a school links to a district or a
-- circuit).
create or replace function public.reporting_school_areas(p_school_ids uuid[])
returns table (school_id uuid, province_id uuid, province_name text, district_id uuid, district_name text,
               circuit_id uuid, circuit_name text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id,
         p.id, p.name,
         case when a.level = 'circuit' then d.id else a.id end,
         case when a.level = 'circuit' then d.name else a.name end,
         case when a.level = 'circuit' then a.id end,
         case when a.level = 'circuit' then a.name end
  from public.schools s
  left join public.education_areas a on a.id = s.education_area_id
  left join public.education_areas d on d.id = a.parent_id and a.level = 'circuit'
  left join public.education_areas p on p.id = case when a.level = 'circuit' then d.parent_id else a.parent_id end
  where s.id = any (p_school_ids)
$$;

revoke execute on function public.government_api_hash_token(text) from public, anon, authenticated;
revoke execute on function public.reporting_api_client_id() from public, anon;
revoke execute on function public.government_api_client_school_ids(uuid) from public, anon, authenticated;
revoke execute on function public.official_school_ids() from public, anon;
revoke execute on function public.reporting_school_areas(uuid[]) from public, anon, authenticated;
grant execute on function public.reporting_api_client_id() to authenticated;
grant execute on function public.official_school_ids() to authenticated;

-- ===========================================================================
-- 5. Provincial reporting
-- ===========================================================================

-- True when the caller may report on the whole province.
create or replace function public.reporting_province_access(p_province_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.education_areas where id = p_province_id and level = 'province')
    and (
      (public.reporting_api_client_id() is not null and exists (
         select 1 from public.government_api_clients c
         where c.id = public.reporting_api_client_id() and c.area_id = p_province_id))
      or (public.reporting_api_client_id() is null and public.reporting_platform_admin())
      or (public.reporting_api_client_id() is null and public.is_education_official() and exists (
         select 1 from public.education_official_assignments a
         where a.profile_id = auth.uid() and a.active and a.area_id = p_province_id))
    )
$$;

-- Provinces the caller may open on the Provincial Dashboard.
create or replace function public.get_provincial_scope()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.reporting_require_mfa();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'code', a.code) order by a.name)
    from public.education_areas a
    where a.level = 'province' and public.reporting_province_access(a.id)
  ), '[]'::jsonb);
end;
$$;

-- Validates a provincial request and returns the filters to pass to
-- get_government_report(). Any narrower area or school must lie inside the
-- province. Raises insufficient_privilege otherwise (an unknown province
-- gets the same answer as one outside the caller's access).
create or replace function public.reporting_province_filters(p_province_id uuid, p_filters jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb) - 'province_id' - 'school_ids';
  v_area uuid;
  v_school uuid;
begin
  perform public.reporting_require_mfa();
  if p_province_id is null then
    raise exception 'invalid_argument: province_id is required';
  end if;
  if not public.reporting_province_access(p_province_id) then
    raise exception 'insufficient_privilege: provincial reporting needs province-level access to this province';
  end if;

  v_area := coalesce(nullif(v_filters ->> 'circuit_id', '')::uuid, nullif(v_filters ->> 'district_id', '')::uuid);
  if v_area is not null and not exists (
    with recursive up as (
      select id, parent_id from public.education_areas where id = v_area
      union
      select a.id, a.parent_id from public.education_areas a join up on a.id = up.parent_id
    )
    select 1 from up where id = p_province_id
  ) then
    raise exception 'insufficient_privilege: this education area is outside the province';
  end if;

  v_school := nullif(v_filters ->> 'school_id', '')::uuid;
  if v_school is not null and not exists (
    select 1 from public.reporting_school_areas(array[v_school]) r where r.province_id = p_province_id
  ) then
    raise exception 'insufficient_privilege: this school is outside the province';
  end if;

  return v_filters || jsonb_build_object('province_id', p_province_id);
end;
$$;

-- The Provincial Dashboard dataset: the government report for the province
-- plus a district comparison, province-wide data quality and an
-- intervention trend.
--
-- Districts requiring attention: at least one school requiring attention,
-- pooled attendance below the attendance threshold, average mark below the
-- performance threshold, or an overdue intervention.
--
-- Extra data-quality checks (on top of the per-school checks of the
-- government report):
--   not_linked_to_circuit       the school's district has circuits but the
--                               school is linked to the district directly;
--   incomplete_learner_records  learners on the register (enrolled/active)
--                               with no gender recorded.
create or replace function public.get_provincial_report(p_province_id uuid, p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_filters jsonb := public.reporting_province_filters(p_province_id, p_filters);
  v_report jsonb;
  v_school_ids uuid[];
  v_att_thr numeric;
  v_perf_thr numeric;
  v_district_filter uuid;
  v_result jsonb;
begin
  v_report := public.get_government_report(v_filters);
  v_att_thr := (v_report -> 'thresholds' ->> 'attendance')::numeric;
  v_perf_thr := (v_report -> 'thresholds' ->> 'performance')::numeric;
  select coalesce(array_agg((s ->> 'id')::uuid), '{}') into v_school_ids
  from jsonb_array_elements(v_report -> 'schools') s;

  v_district_filter := coalesce(
    nullif(v_filters ->> 'district_id', '')::uuid,
    (select parent_id from public.education_areas where id = nullif(v_filters ->> 'circuit_id', '')::uuid),
    (select r.district_id from public.reporting_school_areas(array[nullif(v_filters ->> 'school_id', '')::uuid]) r)
  );

  with
  sch as (
    select s, (s ->> 'id')::uuid as id, nullif(s ->> 'district_id', '')::uuid as district_id
    from jsonb_array_elements(v_report -> 'schools') s
  ),
  extra as (
    select r.school_id,
           (sc.education_area_id = r.district_id
             and exists (select 1 from public.education_areas c where c.parent_id = r.district_id and c.level = 'circuit')) as not_linked_to_circuit,
           (select count(*) from public.learners l
             where l.school_id = r.school_id and l.status in ('enrolled', 'active') and nullif(btrim(l.gender), '') is null) as missing_gender
    from public.reporting_school_areas(v_school_ids) r
    join public.schools sc on sc.id = r.school_id
  ),
  school_dq as (
    select sch.id, sch.district_id, sch.s ->> 'name' as name, sch.s ->> 'district' as district, sch.s ->> 'circuit' as circuit,
           (sch.s -> 'data_quality')
             || case when e.not_linked_to_circuit then jsonb_build_object('not_linked_to_circuit', true) else '{}'::jsonb end
             || case when e.missing_gender > 0 then jsonb_build_object('incomplete_learner_records', e.missing_gender) else '{}'::jsonb end
             as issues
    from sch left join extra e on e.school_id = sch.id
  ),
  dist as (
    select a.id, a.name, a.code,
           (select count(*) from public.education_areas c where c.parent_id = a.id and c.level = 'circuit') as circuits
    from public.education_areas a
    where a.level = 'district' and a.parent_id = p_province_id
      and (v_district_filter is null or a.id = v_district_filter)
  ),
  dist_sums as (
    select sch.district_id,
           count(*) as schools,
           sum((sch.s ->> 'learners_enrolled')::int) as learners,
           sum((sch.s ->> 'learners_active')::int) as learners_active,
           sum((sch.s ->> 'educators')::int) as educators,
           sum((sch.s ->> 'staff')::int) as staff,
           sum((sch.s ->> 'classes')::int) as classes,
           sum((sch.s ->> 'attendance_records')::int) as attendance_records,
           sum((sch.s ->> 'assessment_results')::int) as assessment_results,
           sum((sch.s ->> 'learners_requiring_intervention')::int) as needing_intervention,
           sum((sch.s -> 'interventions' ->> 'open')::int) as iv_open,
           sum((sch.s -> 'interventions' ->> 'in_progress')::int) as iv_in_progress,
           sum((sch.s -> 'interventions' ->> 'overdue')::int) as iv_overdue,
           sum((sch.s -> 'interventions' ->> 'resolved')::int) as iv_resolved,
           count(*) filter (where jsonb_array_length(sch.s -> 'attention') > 0) as attention
    from sch group by sch.district_id
  ),
  dist_dq as (
    select district_id, count(*) filter (where issues <> '{}'::jsonb) as schools_with_issues,
           sum((select count(*) from jsonb_object_keys(issues))) as issues
    from school_dq group by district_id
  ),
  dist_rates as (
    select nullif(a ->> 'district_id', '')::uuid as district_id,
           (a ->> 'attendance_rate')::numeric as attendance_rate,
           (a ->> 'average_percent')::numeric as average_percent
    from jsonb_array_elements(v_report -> 'areas') a
  ),
  district_rows as (
    select d.id, d.name, d.code, d.circuits,
           coalesce(ds.schools, 0) as schools,
           coalesce(ds.learners, 0) as learners,
           coalesce(ds.learners_active, 0) as learners_active,
           coalesce(ds.educators, 0) as educators,
           coalesce(ds.staff, 0) as staff,
           coalesce(ds.classes, 0) as classes,
           coalesce(ds.attendance_records, 0) as attendance_records,
           coalesce(ds.assessment_results, 0) as assessment_results,
           dr.attendance_rate, dr.average_percent,
           coalesce(ds.needing_intervention, 0) as needing_intervention,
           coalesce(ds.iv_open, 0) as iv_open, coalesce(ds.iv_in_progress, 0) as iv_in_progress,
           coalesce(ds.iv_overdue, 0) as iv_overdue, coalesce(ds.iv_resolved, 0) as iv_resolved,
           coalesce(ds.attention, 0) as attention,
           coalesce(dq.schools_with_issues, 0) as dq_schools,
           coalesce(dq.issues, 0) as dq_issues
    from dist d
    left join dist_sums ds on ds.district_id = d.id
    left join dist_rates dr on dr.district_id = d.id
    left join dist_dq dq on dq.district_id = d.id
  ),
  district_flagged as (
    select r.*,
           array_remove(array[
             case when r.attention > 0 then 'schools_requiring_attention' end,
             case when r.attendance_rate < v_att_thr then 'low_attendance' end,
             case when r.average_percent < v_perf_thr then 'low_performance' end,
             case when r.iv_overdue > 0 then 'overdue_interventions' end
           ], null) as reasons
    from district_rows r
  ),
  w as (select * from public.reporting_windows(v_school_ids, v_filters)),
  iv_events as (
    select date_trunc('month', i.created_at)::date as period, 1 as opened, 0 as resolved
    from public.academic_interventions i join w on w.school_id = i.school_id
    where i.created_at::date between w.start_date and w.end_date
    union all
    select date_trunc('month', i.resolved_at)::date, 0, 1
    from public.academic_interventions i join w on w.school_id = i.school_id
    where i.status = 'resolved' and i.resolved_at::date between w.start_date and w.end_date
  ),
  iv_trend as (
    select period, sum(opened) as opened, sum(resolved) as resolved from iv_events group by period
  ),
  dq_counts as (
    select k.key,
           count(*) as schools,
           sum(case when jsonb_typeof(k.value) = 'number' then (k.value #>> '{}')::numeric else 1 end) as total
    from school_dq, jsonb_each(school_dq.issues) k
    group by k.key
  )
  select jsonb_build_object(
    'generated_at', now(),
    'province', (select jsonb_build_object('id', a.id, 'name', a.name, 'code', a.code)
                 from public.education_areas a where a.id = p_province_id),
    'filters', v_filters,
    'thresholds', v_report -> 'thresholds',
    'summary', (v_report -> 'summary') || jsonb_build_object(
      'districts', (select count(*) from district_flagged),
      'districts_requiring_attention', (select count(*) from district_flagged where cardinality(reasons) > 0),
      'data_quality_issues', (select coalesce(sum(dq_issues), 0) from district_flagged)
    ),
    'districts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'district_id', f.id, 'district', f.name, 'code', f.code, 'circuits', f.circuits,
        'schools', f.schools, 'learners_enrolled', f.learners, 'learners_active', f.learners_active,
        'educators', f.educators, 'staff', f.staff, 'classes', f.classes,
        'attendance_rate', f.attendance_rate, 'attendance_records', f.attendance_records,
        'average_percent', f.average_percent, 'assessment_results', f.assessment_results,
        'learners_requiring_intervention', f.needing_intervention,
        'interventions', jsonb_build_object('open', f.iv_open, 'in_progress', f.iv_in_progress,
                                            'overdue', f.iv_overdue, 'resolved', f.iv_resolved),
        'schools_requiring_attention', f.attention,
        'schools_with_data_quality_issues', f.dq_schools,
        'data_quality_issues', f.dq_issues,
        'requires_attention', cardinality(f.reasons) > 0,
        'attention', to_jsonb(f.reasons),
        'insufficient_data', f.attendance_records = 0 and f.assessment_results = 0
      ) order by f.name)
      from district_flagged f
    ), '[]'::jsonb),
    'schools', v_report -> 'schools',
    'grades', v_report -> 'grades',
    'subjects', v_report -> 'subjects',
    'attendance_trend', v_report -> 'attendance_trend',
    'performance_trend', v_report -> 'performance_trend',
    'intervention_trend', coalesce((
      select jsonb_agg(jsonb_build_object('period', t.period, 'opened', t.opened, 'resolved', t.resolved) order by t.period)
      from iv_trend t
    ), '[]'::jsonb),
    'data_quality', jsonb_build_object(
      'issue_counts', coalesce((select jsonb_object_agg(key, jsonb_build_object('schools', schools, 'total', total)) from dq_counts), '{}'::jsonb),
      'schools', coalesce((
        select jsonb_agg(jsonb_build_object('id', q.id, 'name', q.name, 'district_id', q.district_id,
                                            'district', q.district, 'circuit', q.circuit, 'issues', q.issues) order by q.name)
        from school_dq q where q.issues <> '{}'::jsonb
      ), '[]'::jsonb),
      -- Platform administrators also see schools not linked to any area
      -- (they cannot appear under a province until they are linked).
      'unlinked_schools', case when public.reporting_caller_kind() = 'platform'
                               then (select count(*) from public.schools where education_area_id is null) end
    )
  ) into v_result;

  return v_result;
end;
$$;

-- Records a provincial export after the same access checks as the report.
create or replace function public.record_provincial_report_export(
  p_province_id uuid, p_report text, p_format text, p_filters jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_filters jsonb;
  v_schools uuid[];
begin
  if p_format not in ('csv', 'excel_csv', 'pdf') then
    raise exception 'invalid_argument: unknown export format';
  end if;
  if p_report is null or char_length(p_report) not between 1 and 60 then
    raise exception 'invalid_argument: unknown report';
  end if;
  v_filters := public.reporting_province_filters(p_province_id, p_filters);
  v_schools := public.reporting_resolve_schools(v_filters);
  perform public.write_audit_log(
    null, auth.uid(), 'government_report_exported', 'education_areas', p_province_id, null,
    jsonb_build_object('report', p_report, 'format', p_format, 'caller_kind', public.reporting_caller_kind(),
                       'scope', 'province', 'schools', cardinality(v_schools), 'filters', v_filters)
  );
end;
$$;

revoke execute on function public.reporting_province_access(uuid) from public, anon;
revoke execute on function public.get_provincial_scope() from public, anon;
revoke execute on function public.reporting_province_filters(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.get_provincial_report(uuid, jsonb) from public, anon;
revoke execute on function public.record_provincial_report_export(uuid, text, text, jsonb) from public, anon;
grant execute on function public.reporting_province_access(uuid) to authenticated;
grant execute on function public.get_provincial_scope() to authenticated;
grant execute on function public.get_provincial_report(uuid, jsonb) to authenticated;
grant execute on function public.record_provincial_report_export(uuid, text, text, jsonb) to authenticated;

-- ===========================================================================
-- 6. Administration (platform administrators with MFA; audited)
-- ===========================================================================

create or replace function public.grant_education_official_school_access(
  p_profile_id uuid, p_school_id uuid, p_learner_detail boolean default false, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.reporting_require_mfa();
  if not public.reporting_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can grant reporting access';
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = p_profile_id and p.role::text = 'education_official' and p.status = 'active') then
    raise exception 'invalid_argument: access can only be granted to an active education official';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'not_found: school';
  end if;

  update public.education_official_assignments
     set can_view_learner_detail = coalesce(p_learner_detail, false), notes = p_notes
   where profile_id = p_profile_id and school_id = p_school_id and active
  returning id into v_id;

  if v_id is null then
    insert into public.education_official_assignments (profile_id, school_id, can_view_learner_detail, notes, granted_by)
    values (p_profile_id, p_school_id, coalesce(p_learner_detail, false), p_notes, auth.uid())
    returning id into v_id;
  end if;

  perform public.write_audit_log(p_school_id, auth.uid(), 'education_official_access_granted', 'education_official_assignments', v_id, null,
    jsonb_build_object('profile_id', p_profile_id, 'school_id', p_school_id, 'learner_detail', coalesce(p_learner_detail, false)));
  return v_id;
end;
$$;

create or replace function public.create_government_api_client(
  p_name text,
  p_description text,
  p_area_id uuid,
  p_school_id uuid,
  p_permissions text[],
  p_learner_detail boolean default false,
  p_rate_limit_per_minute integer default 60,
  p_expires_at timestamptz default null
)
returns table (client_id uuid, token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prefix text := encode(gen_random_bytes(4), 'hex');
  v_token text := 'f360g_' || v_prefix || '_' || encode(gen_random_bytes(24), 'hex');
  v_id uuid;
begin
  perform public.reporting_require_mfa();
  if not public.reporting_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can create API clients';
  end if;
  perform public.check_rate_limit('government_api_client_admin', 30, interval '1 hour');
  if num_nonnulls(p_area_id, p_school_id) <> 1 then
    raise exception 'invalid_argument: an API client is scoped to exactly one education area or one school';
  end if;
  if p_area_id is not null and not exists (select 1 from public.education_areas where id = p_area_id) then
    raise exception 'not_found: education area';
  end if;
  if p_school_id is not null and not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'not_found: school';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invalid_argument: the expiry must be in the future';
  end if;
  if coalesce(p_learner_detail, false) and not ('learners' = any (coalesce(p_permissions, '{}'))) then
    raise exception 'invalid_argument: learner-level detail needs the learners permission';
  end if;

  insert into public.government_api_clients (name, description, area_id, school_id, permissions, can_view_learner_detail,
                                             rate_limit_per_minute, token_prefix, token_hash, expires_at, created_by)
  values (btrim(p_name), nullif(btrim(p_description), ''), p_area_id, p_school_id,
          (select array_agg(distinct x order by x) from unnest(p_permissions) x),
          coalesce(p_learner_detail, false), coalesce(p_rate_limit_per_minute, 60),
          v_prefix, public.government_api_hash_token(v_token), p_expires_at, auth.uid())
  returning id into v_id;

  perform public.write_audit_log(p_school_id, auth.uid(), 'government_api_client_created', 'government_api_clients', v_id, null,
    jsonb_build_object('name', btrim(p_name), 'area_id', p_area_id, 'school_id', p_school_id, 'permissions', p_permissions,
                       'learner_detail', coalesce(p_learner_detail, false), 'expires_at', p_expires_at,
                       'token_prefix', v_prefix));

  return query select v_id, v_token;
end;
$$;

create or replace function public.revoke_government_api_client(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.reporting_require_mfa();
  if not public.reporting_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can revoke API clients';
  end if;
  update public.government_api_clients
     set revoked_at = now(), revoked_by = auth.uid()
   where id = p_client_id and revoked_at is null;
  if not found then
    raise exception 'not_found: active API client';
  end if;
  perform public.write_audit_log(null, auth.uid(), 'government_api_client_revoked', 'government_api_clients', p_client_id, null, null);
end;
$$;

create or replace function public.list_government_api_clients()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.reporting_require_mfa();
  if not public.reporting_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can list API clients';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'description', c.description, 'area_id', c.area_id, 'school_id', c.school_id,
      'scope_name', coalesce(a.name, s.name), 'scope_level', coalesce(a.level::text, 'school'),
      'permissions', to_jsonb(c.permissions), 'learner_detail', c.can_view_learner_detail,
      'rate_limit_per_minute', c.rate_limit_per_minute, 'token_prefix', c.token_prefix,
      'expires_at', c.expires_at, 'created_at', c.created_at, 'revoked_at', c.revoked_at,
      'last_used_at', (select max(r.created_at) from public.government_api_requests r where r.client_id = c.id),
      'requests_24h', (select count(*) from public.government_api_requests r
                       where r.client_id = c.id and r.created_at > now() - interval '24 hours'),
      'errors_24h', (select count(*) from public.government_api_requests r
                     where r.client_id = c.id and r.created_at > now() - interval '24 hours' and r.status >= 400)
    ) order by c.revoked_at nulls first, c.name)
    from public.government_api_clients c
    left join public.education_areas a on a.id = c.area_id
    left join public.schools s on s.id = c.school_id
  ), '[]'::jsonb);
end;
$$;

-- ===========================================================================
-- 7. Import validation (shared by the API and the commit step)
-- ===========================================================================

-- Validates school-identifier rows against a client's scope. Returns
-- { total_rows, valid_rows, error_rows, rows: [...], errors: [...] }.
-- Error codes: required, invalid_type, invalid_format, school_not_in_scope,
-- duplicate_school, duplicate_emis_number, emis_number_in_use.
create or replace function public.government_import_validate_school_identifiers(p_client_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope uuid[] := public.government_api_client_school_ids(p_client_id);
  v_rows jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_item jsonb;
  v_idx int := 0;
  v_school_text text;
  v_school uuid;
  v_emis text;
  v_current text;
  v_seen_schools uuid[] := '{}';
  v_seen_emis text[] := '{}';
  v_row_errors int;
  v_error_rows int := 0;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'invalid_argument: rows must be an array';
  end if;
  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 1000 then
    raise exception 'invalid_argument: rows must contain between 1 and 1000 items';
  end if;

  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_idx := v_idx + 1;
    v_row_errors := 0;
    v_school := null;
    v_emis := null;

    if jsonb_typeof(v_item) is distinct from 'object' then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'field', null, 'code', 'invalid_type', 'message', 'Each row must be an object.');
      v_error_rows := v_error_rows + 1;
      continue;
    end if;
    if exists (select 1 from jsonb_object_keys(v_item) k where k not in ('school_id', 'emis_number')) then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'field', null, 'code', 'invalid_type',
        'message', 'Only school_id and emis_number are accepted.');
      v_row_errors := v_row_errors + 1;
    end if;

    -- school_id
    if jsonb_typeof(v_item -> 'school_id') is distinct from 'string' then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'field', 'school_id',
        'code', case when v_item ? 'school_id' then 'invalid_type' else 'required' end, 'message', 'school_id must be a string UUID.');
      v_row_errors := v_row_errors + 1;
    else
      v_school_text := v_item ->> 'school_id';
      if v_school_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'field', 'school_id', 'code', 'invalid_format', 'message', 'school_id must be a UUID.');
        v_row_errors := v_row_errors + 1;
      else
        v_school := v_school_text::uuid;
        if not (v_school = any (v_scope)) then
          v_errors := v_errors || jsonb_build_object('row', v_idx, 'field', 'school_id', 'code', 'school_not_in_scope',
            'message', 'This school is not in the client''s scope.');
          v_row_errors := v_row_errors + 1;
          v_school := null;
        elsif v_school = any (v_seen_schools) then
          v_errors := v_errors || jsonb_build_object('row', v_idx, 'field', 'school_id', 'code', 'duplicate_school',
            'message', 'This school appears more than once in the import.');
          v_row_errors := v_row_errors + 1;
        end if;
      end if;
    end if;

    -- emis_number. Funda360 hygiene check only (1-32 letters, digits or
    -- hyphens); the official EMIS format needs an external specification.
    if jsonb_typeof(v_item -> 'emis_number') is distinct from 'string' then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'field', 'emis_number',
        'code', case when v_item ? 'emis_number' then 'invalid_type' else 'required' end, 'message', 'emis_number must be a string.');
      v_row_errors := v_row_errors + 1;
    else
      v_emis := btrim(v_item ->> 'emis_number');
      if v_emis !~ '^[A-Za-z0-9-]{1,32}$' then
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'field', 'emis_number', 'code', 'invalid_format',
          'message', 'emis_number must be 1-32 letters, digits or hyphens.');
        v_row_errors := v_row_errors + 1;
      elsif lower(v_emis) = any (v_seen_emis) then
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'field', 'emis_number', 'code', 'duplicate_emis_number',
          'message', 'This EMIS number appears more than once in the import.');
        v_row_errors := v_row_errors + 1;
      elsif exists (select 1 from public.schools s
                    where lower(btrim(s.emis_number)) = lower(v_emis) and s.id is distinct from v_school) then
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'field', 'emis_number', 'code', 'emis_number_in_use',
          'message', 'This EMIS number is already recorded for another school.');
        v_row_errors := v_row_errors + 1;
      end if;
    end if;

    if v_school is not null then
      v_seen_schools := v_seen_schools || v_school;
    end if;
    if v_emis is not null then
      v_seen_emis := v_seen_emis || lower(v_emis);
    end if;

    if v_row_errors > 0 then
      v_error_rows := v_error_rows + 1;
    else
      select emis_number into v_current from public.schools where id = v_school;
      v_rows := v_rows || jsonb_build_object(
        'row', v_idx, 'school_id', v_school, 'emis_number', v_emis, 'current_emis_number', v_current,
        'action', case when v_current is null or btrim(v_current) = '' then 'set'
                       when v_current = v_emis then 'unchanged' else 'change' end);
    end if;
  end loop;

  return jsonb_build_object('total_rows', v_idx, 'valid_rows', jsonb_array_length(v_rows), 'error_rows', v_error_rows,
                            'rows', v_rows, 'errors', v_errors);
end;
$$;

create or replace function public.list_government_import_jobs()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.reporting_require_mfa();
  if not public.reporting_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can review imports';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', j.id, 'client_id', j.client_id, 'client_name', c.name, 'kind', j.kind, 'status', j.status,
      'idempotency_key', j.idempotency_key, 'total_rows', j.total_rows, 'valid_rows', j.valid_rows,
      'error_rows', j.error_rows, 'rows', j.rows, 'errors', j.errors, 'created_at', j.created_at,
      'reviewed_at', j.reviewed_at, 'review_notes', j.review_notes
    ) order by j.created_at desc)
    from (select * from public.government_import_jobs order by created_at desc limit 200) j
    join public.government_api_clients c on c.id = j.client_id
  ), '[]'::jsonb);
end;
$$;

-- COMMIT step. Re-validates against the client's current scope and current
-- school records; commits only when every row is still valid. Each changed
-- school is audited individually.
create or replace function public.review_government_import_job(p_job_id uuid, p_decision text, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.government_import_jobs;
  v_check jsonb;
  v_row jsonb;
  v_changed int := 0;
begin
  perform public.reporting_require_mfa();
  if not public.reporting_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can review imports';
  end if;
  if p_decision not in ('commit', 'reject') then
    raise exception 'invalid_argument: decision must be commit or reject';
  end if;

  select * into v_job from public.government_import_jobs where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'not_found: import job';
  end if;
  if v_job.status <> 'validated' then
    raise exception 'conflict: only a validated import can be reviewed (status is %)', v_job.status;
  end if;

  if p_decision = 'reject' then
    update public.government_import_jobs
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes
     where id = p_job_id;
    perform public.write_audit_log(null, auth.uid(), 'government_import_rejected', 'government_import_jobs', p_job_id, null,
      jsonb_build_object('notes', p_notes));
    return jsonb_build_object('status', 'rejected', 'changed', 0);
  end if;

  -- Re-validate from the stored, already-normalised rows.
  v_check := public.government_import_validate_school_identifiers(
    v_job.client_id,
    (select coalesce(jsonb_agg(jsonb_build_object('school_id', r ->> 'school_id', 'emis_number', r ->> 'emis_number')), '[]'::jsonb)
     from jsonb_array_elements(v_job.rows) r));
  if (v_check ->> 'error_rows')::int > 0 or (v_check ->> 'valid_rows')::int <> v_job.valid_rows then
    raise exception 'conflict: the import no longer validates against current records; ask the client to resubmit';
  end if;

  for v_row in select value from jsonb_array_elements(v_check -> 'rows') loop
    if v_row ->> 'action' <> 'unchanged' then
      update public.schools set emis_number = v_row ->> 'emis_number' where id = (v_row ->> 'school_id')::uuid;
      perform public.write_audit_log((v_row ->> 'school_id')::uuid, auth.uid(), 'school_emis_number_changed', 'schools',
        (v_row ->> 'school_id')::uuid,
        jsonb_build_object('emis_number', v_row ->> 'current_emis_number'),
        jsonb_build_object('emis_number', v_row ->> 'emis_number', 'import_job_id', p_job_id));
      v_changed := v_changed + 1;
    end if;
  end loop;

  update public.government_import_jobs
     set status = 'committed', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes
   where id = p_job_id;
  perform public.write_audit_log(null, auth.uid(), 'government_import_committed', 'government_import_jobs', p_job_id, null,
    jsonb_build_object('changed', v_changed, 'notes', p_notes));
  return jsonb_build_object('status', 'committed', 'changed', v_changed);
end;
$$;

revoke execute on function public.grant_education_official_school_access(uuid, uuid, boolean, text) from public, anon;
revoke execute on function public.create_government_api_client(text, text, uuid, uuid, text[], boolean, integer, timestamptz) from public, anon;
revoke execute on function public.revoke_government_api_client(uuid) from public, anon;
revoke execute on function public.list_government_api_clients() from public, anon;
revoke execute on function public.government_import_validate_school_identifiers(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.list_government_import_jobs() from public, anon;
revoke execute on function public.review_government_import_job(uuid, text, text) from public, anon;
grant execute on function public.grant_education_official_school_access(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.create_government_api_client(text, text, uuid, uuid, text[], boolean, integer, timestamptz) to authenticated;
grant execute on function public.revoke_government_api_client(uuid) to authenticated;
grant execute on function public.list_government_api_clients() to authenticated;
grant execute on function public.list_government_import_jobs() to authenticated;
grant execute on function public.review_government_import_job(uuid, text, text) to authenticated;

-- ===========================================================================
-- 8. Government API (v1)
-- ===========================================================================
--
-- gov_api_request() is the single entry point, executable by the service
-- role only (the government-api Edge Function). It authenticates the token,
-- applies the client's rate limit, sets the client context, dispatches to
-- one operation, maps every error to a stable HTTP status and code, and
-- logs the request. Operation functions refuse to run outside that context.

create or replace function public.gov_api_fail(p_code text, p_message text)
returns void
language plpgsql
volatile
set search_path = public
as $$
begin
  raise exception '%: %', p_code, p_message;
end;
$$;

-- Rejects unknown query parameters and over-long values.
create or replace function public.gov_api_check_params(p_query jsonb, p_allowed text[])
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_key text;
  v_value jsonb;
begin
  for v_key, v_value in select key, value from jsonb_each(coalesce(p_query, '{}'::jsonb)) loop
    if not (v_key = any (p_allowed)) then
      perform public.gov_api_fail('unknown_parameter', format('unknown query parameter "%s"', left(v_key, 40)));
    end if;
    if jsonb_typeof(v_value) <> 'string' or char_length(v_value #>> '{}') > 200 then
      perform public.gov_api_fail('invalid_parameter', format('parameter "%s" must be a string of at most 200 characters', v_key));
    end if;
  end loop;
end;
$$;

-- The reporting filters carried by a query, validated. Only these keys are
-- ever passed to the reporting functions.
create or replace function public.gov_api_filters(p_query jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v jsonb := '{}'::jsonb;
  v_key text;
  v_value text;
begin
  foreach v_key in array array['province_id', 'district_id', 'circuit_id', 'school_id'] loop
    v_value := nullif(btrim(p_query ->> v_key), '');
    if v_value is not null then
      if v_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        perform public.gov_api_fail('invalid_parameter', format('%s must be a UUID', v_key));
      end if;
      v := v || jsonb_build_object(v_key, lower(v_value));
    end if;
  end loop;
  foreach v_key in array array['start_date', 'end_date'] loop
    v_value := nullif(btrim(p_query ->> v_key), '');
    if v_value is not null then
      if v_value !~ '^\d{4}-\d{2}-\d{2}$' then
        perform public.gov_api_fail('invalid_parameter', format('%s must be a date (YYYY-MM-DD)', v_key));
      end if;
      v := v || jsonb_build_object(v_key, v_value::date);
    end if;
  end loop;
  v_value := nullif(btrim(p_query ->> 'term'), '');
  if v_value is not null then
    if v_value !~ '^[1-9][0-9]?$' then
      perform public.gov_api_fail('invalid_parameter', 'term must be a term number (1-99)');
    end if;
    v := v || jsonb_build_object('term', v_value);
  end if;
  foreach v_key in array array['attendance_threshold', 'performance_threshold'] loop
    v_value := nullif(btrim(p_query ->> v_key), '');
    if v_value is not null then
      if v_value !~ '^\d{1,3}(\.\d+)?$' or v_value::numeric > 100 then
        perform public.gov_api_fail('invalid_parameter', format('%s must be a number between 0 and 100', v_key));
      end if;
      v := v || jsonb_build_object(v_key, v_value);
    end if;
  end loop;
  v_value := nullif(btrim(p_query ->> 'academic_year'), '');
  if v_value is not null then
    if char_length(v_value) > 40 then
      perform public.gov_api_fail('invalid_parameter', 'academic_year is too long');
    end if;
    v := v || jsonb_build_object('academic_year', v_value);
  end if;
  v_value := nullif(btrim(p_query ->> 'grade'), '');
  if v_value is not null then
    if char_length(v_value) > 60 then
      perform public.gov_api_fail('invalid_parameter', 'grade is too long');
    end if;
    v := v || jsonb_build_object('grade', v_value);
  end if;
  return v;
end;
$$;

create or replace function public.gov_api_limit(p_query jsonb, p_default int, p_max int)
returns int
language plpgsql
stable
set search_path = public
as $$
declare
  v text := nullif(btrim(p_query ->> 'limit'), '');
begin
  if v is null then
    return p_default;
  end if;
  if v !~ '^\d{1,4}$' or v::int < 1 or v::int > p_max then
    perform public.gov_api_fail('invalid_parameter', format('limit must be an integer between 1 and %s', p_max));
  end if;
  return v::int;
end;
$$;

create or replace function public.gov_api_cursor(p_query jsonb)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v text := nullif(btrim(p_query ->> 'cursor'), '');
begin
  if v is null then
    return null;
  end if;
  if v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform public.gov_api_fail('invalid_parameter', 'cursor is not valid');
  end if;
  return v::uuid;
end;
$$;

create or replace function public.gov_api_require(p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.government_api_clients c
                 where c.id = public.reporting_api_client_id() and p_permission = any (c.permissions)) then
    perform public.gov_api_fail('permission_not_granted', format('this client is not granted the %s permission', p_permission));
  end if;
end;
$$;

-- One page of in-scope schools, ordered by id (keyset pagination).
create or replace function public.gov_api_school_page(p_filters jsonb, p_limit int, p_cursor uuid, p_status text default null)
returns table (ids uuid[], next_cursor uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_all uuid[] := public.reporting_resolve_schools(p_filters);
  v_page uuid[];
begin
  select coalesce(array_agg(id order by id), '{}') into v_page
  from (
    select s.id from public.schools s
    where s.id = any (v_all)
      and (p_cursor is null or s.id > p_cursor)
      and (p_status is null or s.status::text = p_status)
    order by s.id
    limit p_limit + 1
  ) t;
  if cardinality(v_page) > p_limit then
    return query select v_page[1:p_limit], v_page[p_limit];
  else
    return query select v_page, null::uuid;
  end if;
end;
$$;

create or replace function public.gov_api_page(p_data jsonb, p_limit int, p_next uuid)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object('data', coalesce(p_data, '[]'::jsonb),
                            'page', jsonb_build_object('limit', p_limit, 'next_cursor', p_next))
$$;

-- --- Operations -------------------------------------------------------------

create or replace function public.gov_api_op_scope()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_client public.government_api_clients;
  v_schools uuid[];
begin
  select * into v_client from public.government_api_clients where id = public.reporting_api_client_id();
  v_schools := public.government_api_client_school_ids(v_client.id);
  return jsonb_build_object('data', jsonb_build_object(
    'client', jsonb_build_object('id', v_client.id, 'name', v_client.name, 'permissions', to_jsonb(v_client.permissions),
                                 'learner_detail', v_client.can_view_learner_detail,
                                 'rate_limit_per_minute', v_client.rate_limit_per_minute, 'expires_at', v_client.expires_at),
    'scope', case
      when v_client.area_id is not null then
        (select jsonb_build_object('type', a.level, 'id', a.id, 'name', a.name, 'code', a.code)
         from public.education_areas a where a.id = v_client.area_id)
      else
        (select jsonb_build_object('type', 'school', 'id', s.id, 'name', s.name, 'emis_number', s.emis_number)
         from public.schools s where s.id = v_client.school_id)
      end,
    'schools', cardinality(v_schools)
  ));
end;
$$;

create or replace function public.gov_api_op_areas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_visible uuid[] := public.reporting_visible_area_ids();
  v_client public.government_api_clients;
begin
  select * into v_client from public.government_api_clients where id = public.reporting_api_client_id();
  return jsonb_build_object('data', coalesce((
    with recursive sub as (
      select v_client.area_id as id where v_client.area_id is not null
      union
      select a.id from public.education_areas a join sub on a.parent_id = sub.id
    )
    select jsonb_agg(jsonb_build_object('id', a.id, 'level', a.level, 'parent_id', a.parent_id, 'name', a.name,
                                        'code', a.code, 'in_scope', a.id in (select id from sub))
                     order by a.level, a.name)
    from public.education_areas a where a.id = any (v_visible)
  ), '[]'::jsonb));
end;
$$;

create or replace function public.gov_api_school_json(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'emis_number', s.emis_number, 'name', s.name, 'status', s.status,
    'province', case when r.province_id is not null then jsonb_build_object('id', r.province_id, 'name', r.province_name) end,
    'district', case when r.district_id is not null then jsonb_build_object('id', r.district_id, 'name', r.district_name) end,
    'circuit', case when r.circuit_id is not null then jsonb_build_object('id', r.circuit_id, 'name', r.circuit_name) end
  ) order by s.id), '[]'::jsonb)
  from public.schools s
  join public.reporting_school_areas(p_ids) r on r.school_id = s.id
$$;

create or replace function public.gov_api_op_schools(p_query jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := public.gov_api_limit(p_query, 100, 500);
  v_status text := nullif(btrim(p_query ->> 'status'), '');
  v_ids uuid[];
  v_next uuid;
begin
  perform public.gov_api_require('schools');
  perform public.gov_api_check_params(p_query, array['province_id', 'district_id', 'circuit_id', 'status', 'limit', 'cursor']);
  if v_status is not null and v_status not in ('active', 'inactive', 'suspended') then
    perform public.gov_api_fail('invalid_parameter', 'status must be active, inactive or suspended');
  end if;
  select ids, next_cursor into v_ids, v_next
  from public.gov_api_school_page(public.gov_api_filters(p_query), v_limit, public.gov_api_cursor(p_query), v_status);
  return public.gov_api_page(public.gov_api_school_json(v_ids), v_limit, v_next);
end;
$$;

create or replace function public.gov_api_op_school(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  perform public.gov_api_require('schools');
  v_ids := public.reporting_resolve_schools(jsonb_build_object('school_id', p_id));
  return jsonb_build_object('data', public.gov_api_school_json(v_ids) -> 0);
end;
$$;

-- Learner enrolments for one school. Needs the learners permission and the
-- client's learner-level grant; every call is audited. No names, dates of
-- birth or identity numbers are returned.
create or replace function public.gov_api_op_learners(p_query jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_limit int := public.gov_api_limit(p_query, 200, 1000);
  v_cursor uuid := public.gov_api_cursor(p_query);
  v_filters jsonb;
  v_school uuid;
  v_year uuid;
  v_year_name text;
  v_rows jsonb;
  v_next uuid;
begin
  perform public.gov_api_require('learners');
  perform public.gov_api_check_params(p_query, array['school_id', 'academic_year', 'grade', 'limit', 'cursor']);
  v_filters := public.gov_api_filters(p_query);
  v_school := nullif(v_filters ->> 'school_id', '')::uuid;
  if v_school is null then
    perform public.gov_api_fail('invalid_parameter', 'school_id is required');
  end if;
  perform public.reporting_resolve_schools(jsonb_build_object('school_id', v_school));
  if not public.reporting_learner_detail_allowed(v_school) then
    perform public.gov_api_fail('insufficient_privilege', 'learner-level data is not granted for this client');
  end if;
  select academic_year_id, academic_year_name into v_year, v_year_name
  from public.reporting_windows(array[v_school], v_filters);

  select coalesce(jsonb_agg(jsonb_build_object(
           'learner_id', t.learner_id, 'learner_number', t.learner_number, 'school_id', v_school,
           'academic_year', v_year_name, 'grade', t.grade, 'class_id', t.class_id, 'class', t.class_name,
           'enrollment_status', t.enrollment_status, 'learner_status', t.learner_status, 'enrollment_date', t.enrollment_date
         ) order by t.learner_id), '[]'::jsonb)
    into v_rows
  from (
    select e.learner_id, l.learner_number, l.status as learner_status, g.name as grade, e.class_id, c.name as class_name,
           e.enrollment_status, e.enrollment_date
    from public.learner_enrollments e
    join public.learners l on l.id = e.learner_id
    join public.grades g on g.id = e.grade_id
    left join public.classes c on c.id = e.class_id
    where e.school_id = v_school and e.academic_year_id = v_year and e.enrollment_status = 'enrolled'
      and (v_filters ->> 'grade' is null or lower(btrim(g.name)) = lower(v_filters ->> 'grade'))
      and (v_cursor is null or e.learner_id > v_cursor)
    order by e.learner_id
    limit v_limit + 1
  ) t;
  if jsonb_array_length(v_rows) > v_limit then
    v_rows := v_rows - v_limit;
    v_next := (v_rows -> (v_limit - 1) ->> 'learner_id')::uuid;
  end if;

  perform public.write_audit_log(v_school, null, 'government_api_learner_detail_viewed', 'schools', v_school, null,
    jsonb_build_object('client_id', public.reporting_api_client_id(),
                       'request_id', nullif(current_setting('funda360.government_api_request', true), ''),
                       'rows', jsonb_array_length(v_rows)));
  return public.gov_api_page(v_rows, v_limit, v_next);
end;
$$;

-- Attendance aggregates per school and period. Same population and rule as
-- the dashboards: learners enrolled for the period's academic year, rate =
-- (present + late) / (present + late + absent), excused days excluded.
create or replace function public.gov_api_op_attendance(p_query jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := public.gov_api_limit(p_query, 25, 100);
  v_gran text := coalesce(nullif(btrim(p_query ->> 'granularity'), ''), 'month');
  v_filters jsonb;
  v_ids uuid[];
  v_next uuid;
  v_data jsonb;
begin
  perform public.gov_api_require('attendance');
  perform public.gov_api_check_params(p_query, array['province_id', 'district_id', 'circuit_id', 'school_id', 'academic_year',
    'term', 'start_date', 'end_date', 'grade', 'granularity', 'limit', 'cursor']);
  if v_gran not in ('week', 'month') then
    perform public.gov_api_fail('invalid_parameter', 'granularity must be week or month');
  end if;
  v_filters := public.gov_api_filters(p_query);
  select ids, next_cursor into v_ids, v_next
  from public.gov_api_school_page(v_filters, v_limit, public.gov_api_cursor(p_query));

  with
  w as (select * from public.reporting_windows(v_ids, v_filters)),
  ls as (select school_id, learner_id from public.reporting_learner_stats(v_ids, v_filters)),
  agg as (
    select a.school_id, date_trunc(v_gran, a.attendance_date)::date as period,
           count(*) filter (where a.status = 'present') as present,
           count(*) filter (where a.status = 'late') as late,
           count(*) filter (where a.status = 'absent') as absent,
           count(*) filter (where a.status = 'excused') as excused
    from public.attendance_records a
    join ls on ls.learner_id = a.learner_id and ls.school_id = a.school_id
    join w on w.school_id = a.school_id and a.attendance_date between w.start_date and w.end_date
    group by 1, 2
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'school_id', w.school_id, 'academic_year', w.academic_year_name, 'period_start', w.start_date, 'period_end', w.end_date,
    'totals', jsonb_build_object(
      'present', coalesce(t.present, 0), 'late', coalesce(t.late, 0), 'absent', coalesce(t.absent, 0), 'excused', coalesce(t.excused, 0),
      'attendance_rate', public.reporting_rate(t.present + t.late, t.present + t.late + t.absent)),
    'periods', coalesce((
      select jsonb_agg(jsonb_build_object('period', g.period, 'present', g.present, 'late', g.late, 'absent', g.absent,
                                          'excused', g.excused,
                                          'attendance_rate', public.reporting_rate(g.present + g.late, g.present + g.late + g.absent))
                       order by g.period)
      from agg g where g.school_id = w.school_id), '[]'::jsonb)
  ) order by w.school_id), '[]'::jsonb)
  into v_data
  from w
  left join (select school_id, sum(present) as present, sum(late) as late, sum(absent) as absent, sum(excused) as excused
             from agg group by school_id) t on t.school_id = w.school_id;

  return public.gov_api_page(v_data, v_limit, v_next) || jsonb_build_object('granularity', v_gran);
end;
$$;

-- Assessment aggregates per school and subject. Same rules as the subject
-- breakdown of the government report, including the small-group rule.
create or replace function public.gov_api_op_assessments(p_query jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := public.gov_api_limit(p_query, 25, 100);
  v_filters jsonb;
  v_ids uuid[];
  v_next uuid;
  v_thr numeric;
  v_data jsonb;
begin
  perform public.gov_api_require('assessments');
  perform public.gov_api_check_params(p_query, array['province_id', 'district_id', 'circuit_id', 'school_id', 'academic_year',
    'term', 'start_date', 'end_date', 'grade', 'performance_threshold', 'limit', 'cursor']);
  v_filters := public.gov_api_filters(p_query);
  v_thr := coalesce((v_filters ->> 'performance_threshold')::numeric, 50);
  select ids, next_cursor into v_ids, v_next
  from public.gov_api_school_page(v_filters, v_limit, public.gov_api_cursor(p_query));

  with
  w as (select * from public.reporting_windows(v_ids, v_filters)),
  ls as (select school_id, learner_id from public.reporting_learner_stats(v_ids, v_filters)),
  sub as (
    select s.school_id, min(btrim(sb.name)) as subject,
           count(*) as results, count(distinct r.learner_id) as learners,
           sum(r.mark::numeric * 100 / s.max_mark) as pct_sum,
           count(*) filter (where r.mark::numeric * 100 / s.max_mark < v_thr) as below_pass
    from public.assessment_results r
    join public.assessments s on s.id = r.assessment_id and s.active and s.max_mark > 0
    join public.subjects sb on sb.id = s.subject_id
    join ls on ls.learner_id = r.learner_id and ls.school_id = r.school_id
    join w on w.school_id = s.school_id and s.assessment_date between w.start_date and w.end_date
    group by s.school_id, lower(btrim(sb.name))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'school_id', w.school_id, 'academic_year', w.academic_year_name, 'period_start', w.start_date, 'period_end', w.end_date,
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject', x.subject, 'learners', x.learners, 'assessment_results', x.results,
        'suppressed', x.learners < 5 and not public.reporting_learner_detail_allowed(w.school_id),
        'average_percent', case when x.learners < 5 and not public.reporting_learner_detail_allowed(w.school_id) then null
                                else round(x.pct_sum / x.results, 1) end,
        'pass_rate', case when x.learners < 5 and not public.reporting_learner_detail_allowed(w.school_id) then null
                          else public.reporting_rate(x.results - x.below_pass, x.results) end
      ) order by x.subject)
      from sub x where x.school_id = w.school_id), '[]'::jsonb)
  ) order by w.school_id), '[]'::jsonb)
  into v_data
  from w;

  return public.gov_api_page(v_data, v_limit, v_next) || jsonb_build_object('performance_threshold', v_thr);
end;
$$;

-- Per-school indicators computed by get_government_report() for one page of
-- schools. p_view: 'reports' (everything), 'staff' or 'data_quality'.
create or replace function public.gov_api_op_school_report(p_query jsonb, p_view text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := public.gov_api_limit(p_query, 25, 100);
  v_filters jsonb;
  v_ids uuid[];
  v_next uuid;
  v_report jsonb;
  v_data jsonb;
begin
  perform public.gov_api_require(p_view);
  perform public.gov_api_check_params(p_query, case p_view
    when 'staff' then array['province_id', 'district_id', 'circuit_id', 'school_id', 'academic_year', 'limit', 'cursor']
    else array['province_id', 'district_id', 'circuit_id', 'school_id', 'academic_year', 'term', 'start_date', 'end_date',
               'grade', 'attendance_threshold', 'performance_threshold', 'limit', 'cursor'] end);
  v_filters := public.gov_api_filters(p_query);
  select ids, next_cursor into v_ids, v_next
  from public.gov_api_school_page(v_filters, v_limit, public.gov_api_cursor(p_query));

  if cardinality(v_ids) = 0 then
    return public.gov_api_page('[]'::jsonb, v_limit, null);
  end if;
  v_report := public.get_government_report(v_filters || jsonb_build_object('school_ids', to_jsonb(v_ids)));

  select coalesce(jsonb_agg(case p_view
      when 'staff' then jsonb_build_object(
        'school_id', s -> 'id', 'name', s -> 'name', 'emis_number', s -> 'emis_number',
        'staff', s -> 'staff', 'educators', s -> 'educators', 'learners_enrolled', s -> 'learners_enrolled',
        'learner_educator_ratio', s -> 'learner_educator_ratio')
      when 'data_quality' then jsonb_build_object(
        'school_id', s -> 'id', 'name', s -> 'name', 'emis_number', s -> 'emis_number',
        'academic_year', s -> 'academic_year', 'issues', s -> 'data_quality', 'attention', s -> 'attention')
      else (s - 'id' - 'learner_detail') || jsonb_build_object('school_id', s -> 'id')
    end order by s ->> 'id'), '[]'::jsonb)
  into v_data
  from jsonb_array_elements(v_report -> 'schools') s;

  return public.gov_api_page(v_data, v_limit, v_next) || jsonb_build_object('thresholds', v_report -> 'thresholds');
end;
$$;

-- Intervention records (status and dates only; free-text titles and notes
-- are never returned). learner_id is included only with learner-level access.
create or replace function public.gov_api_op_interventions(p_query jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := public.gov_api_limit(p_query, 200, 1000);
  v_cursor uuid := public.gov_api_cursor(p_query);
  v_status text := nullif(btrim(p_query ->> 'status'), '');
  v_schools uuid[];
  v_rows jsonb;
  v_next uuid;
begin
  perform public.gov_api_require('interventions');
  perform public.gov_api_check_params(p_query, array['province_id', 'district_id', 'circuit_id', 'school_id', 'status', 'limit', 'cursor']);
  if v_status is not null and v_status not in ('open', 'in_progress', 'resolved') then
    perform public.gov_api_fail('invalid_parameter', 'status must be open, in_progress or resolved');
  end if;
  v_schools := public.reporting_resolve_schools(public.gov_api_filters(p_query));

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'school_id', t.school_id, 'academic_year', t.year_name, 'subject', t.subject,
           'status', t.status, 'opened_on', t.created_at::date, 'target_date', t.target_date,
           'resolved_on', t.resolved_at::date,
           'overdue', t.status <> 'resolved' and t.target_date < current_date,
           'learner_id', case when public.reporting_learner_detail_allowed(t.school_id) then t.learner_id end
         ) order by t.id), '[]'::jsonb)
    into v_rows
  from (
    select i.id, i.school_id, y.name as year_name, sb.name as subject, i.status, i.created_at, i.target_date, i.resolved_at, i.learner_id
    from public.academic_interventions i
    left join public.academic_years y on y.id = i.academic_year_id
    left join public.subjects sb on sb.id = i.subject_id
    where i.school_id = any (v_schools)
      and (v_status is null or i.status::text = v_status)
      and (v_cursor is null or i.id > v_cursor)
    order by i.id
    limit v_limit + 1
  ) t;
  if jsonb_array_length(v_rows) > v_limit then
    v_rows := v_rows - v_limit;
    v_next := (v_rows -> (v_limit - 1) ->> 'id')::uuid;
  end if;
  return public.gov_api_page(v_rows, v_limit, v_next);
end;
$$;

create or replace function public.gov_api_op_summary(p_query jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_report jsonb;
begin
  perform public.gov_api_require('reports');
  perform public.gov_api_check_params(p_query, array['province_id', 'district_id', 'circuit_id', 'school_id', 'academic_year',
    'term', 'start_date', 'end_date', 'grade', 'attendance_threshold', 'performance_threshold']);
  v_report := public.get_government_report(public.gov_api_filters(p_query));
  return jsonb_build_object('data', jsonb_build_object(
    'generated_at', v_report -> 'generated_at', 'filters', v_report -> 'filters', 'thresholds', v_report -> 'thresholds',
    'summary', v_report -> 'summary', 'districts', v_report -> 'areas', 'grades', v_report -> 'grades',
    'subjects', v_report -> 'subjects', 'attendance_trend', v_report -> 'attendance_trend',
    'performance_trend', v_report -> 'performance_trend'));
end;
$$;

create or replace function public.gov_api_op_province(p_id uuid, p_query jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.gov_api_require('reports');
  perform public.gov_api_check_params(p_query, array['district_id', 'circuit_id', 'school_id', 'academic_year', 'term',
    'start_date', 'end_date', 'grade', 'attendance_threshold', 'performance_threshold']);
  return jsonb_build_object('data', public.get_provincial_report(p_id, public.gov_api_filters(p_query)) - 'schools');
end;
$$;

create or replace function public.gov_api_import_json(p_job public.government_import_jobs)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object('id', p_job.id, 'kind', p_job.kind, 'idempotency_key', p_job.idempotency_key,
                            'status', p_job.status, 'total_rows', p_job.total_rows, 'valid_rows', p_job.valid_rows,
                            'error_rows', p_job.error_rows, 'rows', p_job.rows, 'errors', p_job.errors,
                            'created_at', p_job.created_at, 'reviewed_at', p_job.reviewed_at)
$$;

-- POST /v1/imports. dry_run validates and returns the preview without
-- storing anything; otherwise the validated job is stored (idempotent on
-- idempotency_key) for a platform administrator to commit.
create or replace function public.gov_api_op_import_create(p_body jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_client uuid := public.reporting_api_client_id();
  v_key text;
  v_dry boolean;
  v_check jsonb;
  v_hash text;
  v_job public.government_import_jobs;
begin
  perform public.gov_api_require('imports');
  if jsonb_typeof(p_body) is distinct from 'object' then
    perform public.gov_api_fail('invalid_argument', 'the request body must be a JSON object');
  end if;
  if exists (select 1 from jsonb_object_keys(p_body) k where k not in ('kind', 'idempotency_key', 'dry_run', 'rows')) then
    perform public.gov_api_fail('invalid_argument', 'only kind, idempotency_key, dry_run and rows are accepted');
  end if;
  if p_body ->> 'kind' is distinct from 'school_identifiers' then
    perform public.gov_api_fail('invalid_argument', 'kind must be school_identifiers');
  end if;
  if p_body ? 'dry_run' and jsonb_typeof(p_body -> 'dry_run') <> 'boolean' then
    perform public.gov_api_fail('invalid_argument', 'dry_run must be true or false');
  end if;
  v_dry := coalesce((p_body ->> 'dry_run')::boolean, false);
  v_key := p_body ->> 'idempotency_key';
  if not v_dry and (jsonb_typeof(p_body -> 'idempotency_key') is distinct from 'string' or v_key !~ '^[A-Za-z0-9._:-]{8,128}$') then
    perform public.gov_api_fail('invalid_argument', 'idempotency_key is required: 8-128 letters, digits, ".", "_", ":" or "-"');
  end if;

  v_check := public.government_import_validate_school_identifiers(v_client, p_body -> 'rows');
  if v_dry then
    return jsonb_build_object('status', 200, 'body', jsonb_build_object('data',
      v_check || jsonb_build_object('dry_run', true, 'kind', 'school_identifiers',
                                    'valid', (v_check ->> 'error_rows')::int = 0)));
  end if;

  v_hash := encode(sha256(convert_to('school_identifiers:' || (p_body -> 'rows')::text, 'UTF8')), 'hex');
  select * into v_job from public.government_import_jobs where client_id = v_client and idempotency_key = v_key;
  if v_job.id is not null then
    if v_job.payload_hash <> v_hash then
      perform public.gov_api_fail('conflict', 'this idempotency_key was already used with a different payload');
    end if;
    return jsonb_build_object('status', 200, 'body', jsonb_build_object('data', public.gov_api_import_json(v_job), 'replayed', true));
  end if;

  insert into public.government_import_jobs (client_id, kind, idempotency_key, payload_hash, status, total_rows, valid_rows,
                                             error_rows, rows, errors, request_id)
  values (v_client, 'school_identifiers', v_key, v_hash,
          case when (v_check ->> 'error_rows')::int = 0 then 'validated' else 'failed' end,
          (v_check ->> 'total_rows')::int, (v_check ->> 'valid_rows')::int, (v_check ->> 'error_rows')::int,
          v_check -> 'rows', v_check -> 'errors', nullif(current_setting('funda360.government_api_request', true), ''))
  returning * into v_job;
  return jsonb_build_object('status', 201, 'body', jsonb_build_object('data', public.gov_api_import_json(v_job)));
end;
$$;

create or replace function public.gov_api_op_import_get(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_job public.government_import_jobs;
begin
  perform public.gov_api_require('imports');
  select * into v_job from public.government_import_jobs where id = p_id and client_id = public.reporting_api_client_id();
  if v_job.id is null then
    perform public.gov_api_fail('not_found', 'import job');
  end if;
  return jsonb_build_object('data', public.gov_api_import_json(v_job));
end;
$$;

-- --- Router -------------------------------------------------------------------

create or replace function public.gov_api_dispatch(p_method text, p_path text, p_query jsonb, p_body jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_seg text[];
  v_n int;
  v_route text;
  v_id uuid;
  v_allowed text;
  v_result jsonb;
begin
  if public.reporting_api_client_id() is null then
    perform public.gov_api_fail('insufficient_privilege', 'no API client');
  end if;
  if p_path is null or char_length(p_path) > 300 or p_path !~ '^/v1(/[A-Za-z0-9_-]+)*/?$' then
    return jsonb_build_object('status', 404, 'operation', null, 'code', 'not_found', 'message', 'No such endpoint.');
  end if;

  v_seg := string_to_array(btrim(p_path, '/'), '/');
  v_n := cardinality(v_seg);
  v_route := case
    when v_n = 2 and v_seg[2] in ('scope', 'areas', 'schools', 'learners', 'attendance', 'assessments', 'staff',
                                  'interventions', 'data-quality', 'imports') then v_seg[2]
    when v_n = 3 and v_seg[2] in ('schools', 'imports') then v_seg[2] || '/{id}'
    when v_n = 3 and v_seg[2] = 'reports' and v_seg[3] in ('summary', 'schools') then 'reports/' || v_seg[3]
    when v_n = 4 and v_seg[2] = 'reports' and v_seg[3] = 'provinces' then 'reports/provinces/{id}'
  end;
  if v_route is null then
    return jsonb_build_object('status', 404, 'operation', null, 'code', 'not_found', 'message', 'No such endpoint.');
  end if;

  v_allowed := case when v_route = 'imports' then 'POST' else 'GET' end;
  if upper(coalesce(p_method, '')) <> v_allowed then
    return jsonb_build_object('status', 405, 'operation', v_route, 'code', 'method_not_allowed',
                              'message', format('Use %s for this endpoint.', v_allowed), 'allow', v_allowed);
  end if;

  if v_route like '%{id}' then
    if v_seg[v_n] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('status', 404, 'operation', v_route, 'code', 'not_found',
                                'message', 'The resource was not found or is not exposed to this client.');
    end if;
    v_id := v_seg[v_n]::uuid;
  end if;
  if v_route not like 'imports%' and p_body is not null and p_body <> 'null'::jsonb then
    perform public.gov_api_fail('invalid_argument', 'this endpoint does not accept a request body');
  end if;
  if v_route in ('scope', 'areas', 'schools/{id}', 'imports', 'imports/{id}') then
    perform public.gov_api_check_params(p_query, '{}'::text[]);
  end if;

  v_result := case v_route
    when 'scope' then public.gov_api_op_scope()
    when 'areas' then public.gov_api_op_areas()
    when 'schools' then public.gov_api_op_schools(p_query)
    when 'schools/{id}' then public.gov_api_op_school(v_id)
    when 'learners' then public.gov_api_op_learners(p_query)
    when 'attendance' then public.gov_api_op_attendance(p_query)
    when 'assessments' then public.gov_api_op_assessments(p_query)
    when 'staff' then public.gov_api_op_school_report(p_query, 'staff')
    when 'data-quality' then public.gov_api_op_school_report(p_query, 'data_quality')
    when 'reports/schools' then public.gov_api_op_school_report(p_query, 'reports')
    when 'interventions' then public.gov_api_op_interventions(p_query)
    when 'reports/summary' then public.gov_api_op_summary(p_query)
    when 'reports/provinces/{id}' then public.gov_api_op_province(v_id, p_query)
    when 'imports' then public.gov_api_op_import_create(p_body)
    when 'imports/{id}' then public.gov_api_op_import_get(v_id)
  end;

  if v_result ? 'status' then
    return v_result || jsonb_build_object('operation', v_route);
  end if;
  return jsonb_build_object('status', 200, 'operation', v_route, 'body', v_result);
end;
$$;

-- --- Entry point ---------------------------------------------------------------

create or replace function public.gov_api_request(
  p_token text,
  p_method text,
  p_path text,
  p_query jsonb default '{}'::jsonb,
  p_body jsonb default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_request_id text := case when p_request_id ~ '^[A-Za-z0-9._:-]{8,64}$' then p_request_id else gen_random_uuid()::text end;
  v_prefix text := substring(coalesce(p_token, '') from '^f360g_([0-9a-f]{8})_[0-9a-f]{48}$');
  v_client public.government_api_clients;
  v_query jsonb := case when jsonb_typeof(p_query) = 'object' then p_query else '{}'::jsonb end;
  v_recent int;
  v_status int;
  v_code text;
  v_message text;
  v_operation text;
  v_body jsonb;
  v_result jsonb;
  v_state text;
  v_err text;
  v_retry int;
  v_allow text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'insufficient_privilege: the government API is only reachable through its Edge Function';
  end if;

  if v_prefix is not null then
    select * into v_client from public.government_api_clients where token_hash = public.government_api_hash_token(p_token);
  end if;

  if v_client.id is null or v_client.revoked_at is not null or (v_client.expires_at is not null and v_client.expires_at <= now()) then
    v_status := 401;
    v_code := 'unauthenticated';
    v_message := 'A valid, unrevoked and unexpired API token is required.';
  else
    select count(*) into v_recent from public.government_api_requests
    where client_id = v_client.id and created_at > now() - interval '1 minute';
    if v_recent >= v_client.rate_limit_per_minute then
      v_status := 429;
      v_code := 'rate_limited';
      v_message := format('Rate limit of %s requests per minute exceeded.', v_client.rate_limit_per_minute);
      v_retry := 60;
    end if;
  end if;

  if v_status is null then
    perform set_config('funda360.government_api_client', v_client.id::text, true);
    perform set_config('funda360.government_api_request', v_request_id, true);
    begin
      v_result := public.gov_api_dispatch(p_method, p_path, v_query, p_body);
      v_status := (v_result ->> 'status')::int;
      v_operation := v_result ->> 'operation';
      if v_status >= 400 then
        v_code := v_result ->> 'code';
        v_message := v_result ->> 'message';
        v_allow := v_result ->> 'allow';
      else
        v_body := v_result -> 'body';
      end if;
    exception when others then
      get stacked diagnostics v_err = message_text, v_state = returned_sqlstate;
      v_status := case
        when v_err ~ '^(insufficient_privilege|permission_not_granted|mfa_required)' then 403
        when v_err ~ '^(invalid_argument|invalid_parameter|unknown_parameter)' then 422
        when v_state in ('22P02', '22007', '22008', '22003', '22023', '22004', '22018', '22001') then 422
        when v_err ~ '^not_found' then 404
        when v_err ~ '^conflict' or v_state = '23505' then 409
        else 500 end;
      v_code := case v_status
        when 403 then case when v_err ~ '^permission_not_granted' then 'permission_not_granted' else 'forbidden' end
        when 422 then 'validation_failed'
        when 404 then 'not_found'
        when 409 then 'conflict'
        else 'internal_error' end;
      v_message := case
        when v_status = 403 and v_code = 'forbidden' then 'The requested resource is outside this client''s permitted scope.'
        when v_status = 404 then 'The resource was not found or is not exposed to this client.'
        when v_status = 500 then 'An internal error occurred. Quote the request id when reporting it.'
        when v_err ~ '^[a-z_]+: ' then substring(v_err from '^[a-z_]+: (.*)$')
        else 'A parameter has an invalid value.' end;
      if v_status = 500 then
        v_code := 'internal_error';
        v_operation := coalesce(v_operation, 'error:' || v_state);
      end if;
    end;
    perform set_config('funda360.government_api_client', '', true);
    perform set_config('funda360.government_api_request', '', true);
  end if;

  -- Log every request. Unauthenticated requests are logged up to 120 per
  -- minute so a flood of bad tokens cannot fill the table.
  if v_client.id is not null and v_status <> 401
     or (select count(*) from public.government_api_requests
         where client_id is null and created_at > now() - interval '1 minute') < 120 then
    insert into public.government_api_requests (request_id, client_id, token_prefix, method, path, operation, status,
                                                error_code, result_count, duration_ms, query)
    values (v_request_id, case when v_status = 401 then null else v_client.id end, v_prefix,
            left(upper(coalesce(p_method, '')), 10), left(coalesce(p_path, ''), 300), v_operation, v_status, v_code,
            case when jsonb_typeof(v_body -> 'data') = 'array' then jsonb_array_length(v_body -> 'data')
                 when v_body ? 'data' then 1 end,
            (extract(epoch from clock_timestamp() - v_started) * 1000)::int,
            (select jsonb_object_agg(key, left(value #>> '{}', 200)) from jsonb_each(v_query)
             where key in ('province_id', 'district_id', 'circuit_id', 'school_id', 'academic_year', 'term', 'start_date',
                           'end_date', 'grade', 'granularity', 'status', 'limit', 'cursor',
                           'attendance_threshold', 'performance_threshold')));
  end if;

  if v_status >= 400 then
    return jsonb_strip_nulls(jsonb_build_object(
      'status', v_status, 'request_id', v_request_id, 'retry_after', v_retry, 'allow', v_allow,
      'body', jsonb_build_object('error', jsonb_build_object('code', v_code, 'message', v_message, 'request_id', v_request_id))));
  end if;
  return jsonb_build_object('status', v_status, 'request_id', v_request_id, 'body', v_body);
end;
$$;

-- Internal functions: no client may call them directly.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'gov\_api\_%' or p.proname = 'government_import_validate_school_identifiers')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

grant execute on function public.gov_api_request(text, text, text, jsonb, jsonb, text) to service_role;

select public.rls_optimize_policies();
