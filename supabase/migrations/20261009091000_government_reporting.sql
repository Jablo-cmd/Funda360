-- Government readiness, part 1: education-area hierarchy, official access,
-- and the reporting functions behind Government Reports and the District
-- Dashboard.
--
-- Design (see docs/GOVERNMENT_REPORTING.md):
--
-- * education_areas holds the Province -> District -> Circuit hierarchy.
--   Schools link to their district or circuit through
--   schools.education_area_id. The legacy free-text schools.province and
--   schools.district columns are kept untouched; this migration only reads
--   them once to seed the hierarchy.
--
-- * education_official_assignments grants an education_official access to
--   one area and everything under it. Learner-level detail is a separate,
--   explicit grant (can_view_learner_detail) and every learner-level read
--   is written to the audit log.
--
-- * Reporting scope is computed in the database for every call:
--     platform admins     -> every school
--     education officials -> schools under their active assignments
--     school owner / principal -> their own school only
--   Any requested school, area or class outside that scope raises
--   insufficient_privilege. Nothing in a URL or request body can widen it.
--
-- * All figures come from the authoritative tables (learners,
--   learner_enrollments, employees, classes, attendance_records,
--   assessments, assessment_results, academic_interventions). Nothing is
--   stored twice. Thresholds are request parameters with Funda360 defaults
--   (attendance 80%, performance 50%); they are not official standards.
--
-- No existing table, policy or function is dropped or weakened.

-- ===========================================================================
-- 1. Hierarchy
-- ===========================================================================

create type public.education_area_level as enum ('province', 'district', 'circuit');

create table public.education_areas (
  id          uuid primary key default gen_random_uuid(),
  level       public.education_area_level not null,
  parent_id   uuid references public.education_areas (id) on delete restrict,
  name        text not null check (char_length(btrim(name)) between 1 and 160),
  code        text check (code is null or char_length(btrim(code)) between 1 and 40),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint education_areas_parent_rule check (
    (level = 'province' and parent_id is null) or (level <> 'province' and parent_id is not null)
  )
);

comment on table public.education_areas is
  'Education department hierarchy: province -> district -> circuit. Schools link to a district or circuit via schools.education_area_id.';

create unique index education_areas_name_key
  on public.education_areas (level, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));
create unique index education_areas_code_key
  on public.education_areas (level, lower(btrim(code))) where code is not null;
create index education_areas_parent_idx on public.education_areas (parent_id);

create trigger education_areas_set_updated_at
  before update on public.education_areas
  for each row execute function public.set_updated_at();

-- A district's parent must be a province, a circuit's parent a district.
create or replace function public.education_areas_validate_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_level public.education_area_level;
begin
  if new.parent_id is null then
    return new;
  end if;
  select level into v_parent_level from public.education_areas where id = new.parent_id;
  if (new.level = 'district' and v_parent_level is distinct from 'province')
     or (new.level = 'circuit' and v_parent_level is distinct from 'district') then
    raise exception 'invalid_argument: a % must sit under a %', new.level,
      case new.level when 'district' then 'province' else 'district' end;
  end if;
  return new;
end;
$$;

create trigger education_areas_validate_parent
  before insert or update on public.education_areas
  for each row execute function public.education_areas_validate_parent();

revoke execute on function public.education_areas_validate_parent() from public, anon, authenticated;

alter table public.schools
  add column if not exists education_area_id uuid references public.education_areas (id) on delete set null;

comment on column public.schools.education_area_id is
  'The district or circuit this school reports to. Set by platform administrators only (schools_protect_education_area).';

create index if not exists schools_education_area_idx on public.schools (education_area_id);

-- A school links to a district or circuit, never directly to a province;
-- and only a platform administrator (or a server-side process) may move a
-- school between areas, because it decides which officials can see it.
create or replace function public.schools_protect_education_area()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_level public.education_area_level;
begin
  if tg_op = 'UPDATE' and new.education_area_id is not distinct from old.education_area_id then
    return new;
  end if;
  if tg_op = 'INSERT' and new.education_area_id is null then
    return new;
  end if;
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can change a school''s education area';
  end if;
  if new.education_area_id is not null then
    select level into v_level from public.education_areas where id = new.education_area_id;
    if v_level is distinct from 'district' and v_level is distinct from 'circuit' then
      raise exception 'invalid_argument: a school must be linked to a district or circuit';
    end if;
  end if;
  return new;
end;
$$;

create trigger schools_protect_education_area
  before insert or update of education_area_id on public.schools
  for each row execute function public.schools_protect_education_area();

revoke execute on function public.schools_protect_education_area() from public, anon, authenticated;

-- Seed the hierarchy from the existing free-text columns, once. Exact
-- (trimmed, case-insensitive) names only; anything ambiguous is left for a
-- platform administrator to link by hand and shows up as a data-quality
-- issue ("not linked to an education area").
insert into public.education_areas (level, name)
select distinct on (lower(btrim(province))) 'province'::public.education_area_level, btrim(province)
from public.schools
where nullif(btrim(province), '') is not null
order by lower(btrim(province)), btrim(province)
on conflict do nothing;

insert into public.education_areas (level, parent_id, name)
select distinct on (p.id, lower(btrim(s.district))) 'district'::public.education_area_level, p.id, btrim(s.district)
from public.schools s
join public.education_areas p
  on p.level = 'province' and lower(p.name) = lower(btrim(s.province))
where nullif(btrim(s.district), '') is not null
order by p.id, lower(btrim(s.district)), btrim(s.district)
on conflict do nothing;

update public.schools s
set education_area_id = d.id
from public.education_areas d
join public.education_areas p on p.id = d.parent_id
where s.education_area_id is null
  and d.level = 'district'
  and lower(d.name) = lower(btrim(s.district))
  and lower(p.name) = lower(btrim(s.province));

-- ===========================================================================
-- 2. Official access
-- ===========================================================================

create table public.education_official_assignments (
  id                      uuid primary key default gen_random_uuid(),
  profile_id              uuid not null references public.profiles (id) on delete cascade,
  area_id                 uuid not null references public.education_areas (id) on delete restrict,
  can_view_learner_detail boolean not null default false,
  active                  boolean not null default true,
  notes                   text check (notes is null or char_length(notes) <= 500),
  granted_by              uuid references public.profiles (id) on delete set null,
  granted_at              timestamptz not null default now(),
  revoked_by              uuid references public.profiles (id) on delete set null,
  revoked_at              timestamptz,
  constraint education_official_assignments_revoked check (active or revoked_at is not null)
);

comment on table public.education_official_assignments is
  'Which education area an education_official may report on. Access covers the area and everything beneath it. can_view_learner_detail is required for learner-level drill-down.';

create unique index education_official_assignments_active_key
  on public.education_official_assignments (profile_id, area_id) where active;
create index education_official_assignments_area_idx on public.education_official_assignments (area_id);

-- ===========================================================================
-- 3. Scope functions
-- ===========================================================================

create or replace function public.is_education_official()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'education_official'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active' and p.role = 'education_official'
    )
    and public.session_mfa_satisfied()
$$;

-- Every area the caller may report on: each active assignment plus all
-- areas beneath it.
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
    where a.profile_id = auth.uid() and a.active and public.is_education_official()
    union
    select c.id from public.education_areas c join scope s on c.parent_id = s.id
  )
  select coalesce(array_agg(id), '{}') from scope
$$;

-- Areas the caller may name in a filter: their scope plus its ancestors
-- (an official for one district sees the province name above it, but
-- reports remain limited to their own schools).
create or replace function public.reporting_visible_area_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  with recursive base as (
    select id from public.education_areas where public.is_platform_admin()
    union
    select unnest(public.official_area_ids())
    union
    select s.education_area_id from public.schools s
    where s.id = public.current_tenant_id()
      and s.education_area_id is not null
      and public.can_manage_academic(s.id)
  ),
  up as (
    select id from base
    union
    select a.parent_id from public.education_areas a join up on a.id = up.id where a.parent_id is not null
  )
  select coalesce(array_agg(distinct id), '{}') from up
$$;

-- Schools the caller may report on. The single authority for every
-- reporting function below.
create or replace function public.reporting_school_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_platform_admin() then
      (select coalesce(array_agg(id), '{}') from public.schools)
    when public.is_education_official() then
      (select coalesce(array_agg(s.id), '{}') from public.schools s
       where s.education_area_id = any (public.official_area_ids()))
    when public.current_tenant_id() is not null and public.can_manage_academic(public.current_tenant_id()) then
      array[public.current_tenant_id()]
    else '{}'::uuid[]
  end
$$;

-- 'platform' | 'official' | 'school' | null (no reporting access at all).
create or replace function public.reporting_caller_kind()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_platform_admin() then 'platform'
    when public.is_education_official() then 'official'
    when public.current_tenant_id() is not null and public.can_manage_academic(public.current_tenant_id()) then 'school'
    else null
  end
$$;

-- Learner-level detail: platform admins, the school's own owner/principal,
-- or an official whose assignment covering the school carries the
-- explicit learner-detail grant.
create or replace function public.reporting_learner_detail_allowed(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or (p_school_id = public.current_tenant_id() and public.can_manage_academic(p_school_id))
    or (
      public.is_education_official()
      and exists (
        with recursive covered as (
          select a.area_id as id from public.education_official_assignments a
          where a.profile_id = auth.uid() and a.active and a.can_view_learner_detail
          union
          select c.id from public.education_areas c join covered on c.parent_id = covered.id
        )
        select 1 from public.schools s
        where s.id = p_school_id and s.education_area_id in (select id from covered)
      )
    )
$$;

-- ===========================================================================
-- 4. RLS
-- ===========================================================================

alter table public.education_areas enable row level security;
alter table public.education_areas force row level security;
alter table public.education_official_assignments enable row level security;
alter table public.education_official_assignments force row level security;

-- Reads only. Every write goes through the audited RPCs in section 6.
create policy education_areas_select on public.education_areas
  for select to authenticated
  using (id = any ((select public.reporting_visible_area_ids())::uuid[]));

create policy education_official_assignments_select on public.education_official_assignments
  for select to authenticated
  using ((select public.is_platform_admin()) or profile_id = (select auth.uid()));

grant select on public.education_areas to authenticated;
grant select on public.education_official_assignments to authenticated;

-- ===========================================================================
-- 5. Reporting
-- ===========================================================================

-- Validates a filter object against the caller's scope and returns the
-- schools it covers. Raises insufficient_privilege for anything outside it.
-- Recognised keys: province_id, district_id, circuit_id, school_id.
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
  v_result uuid[];
begin
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

  with recursive sub as (
    select v_area as id where v_area is not null
    union
    select c.id from public.education_areas c join sub on c.parent_id = sub.id
  )
  select coalesce(array_agg(s.id), '{}') into v_result
  from public.schools s
  where s.id = any (v_allowed)
    and (v_school is null or s.id = v_school)
    and (v_area is null or s.education_area_id in (select id from sub));

  return v_result;
end;
$$;

-- Reporting period per school. academic_year (a year name such as "2026")
-- and term (a term sequence number) resolve against each school's own
-- calendar; start_date / end_date narrow the result. Without a year the
-- school's active year is used; without any year, the last 90 days. The
-- period never runs past today. A requested year or term that a school has
-- not configured gives that school no period (start_date is null).
create or replace function public.reporting_windows(p_school_ids uuid[], p_filters jsonb)
returns table (school_id uuid, academic_year_id uuid, academic_year_name text, start_date date, end_date date)
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select
      nullif(btrim(p_filters ->> 'academic_year'), '') as year_name,
      nullif(p_filters ->> 'term', '')::int as term_seq,
      nullif(p_filters ->> 'start_date', '')::date as start_d,
      nullif(p_filters ->> 'end_date', '')::date as end_d
  ),
  yr as (
    select distinct on (s.id) s.id as school_id, y.id as year_id, y.name as year_name, y.start_date, y.end_date
    from unnest(p_school_ids) as s(id)
    cross join f
    left join public.academic_years y
      on y.school_id = s.id
     and (case when f.year_name is not null then lower(btrim(y.name)) = lower(f.year_name) else y.is_active end)
    order by s.id, y.start_date desc nulls last
  ),
  tm as (
    select yr.school_id, t.start_date, t.end_date
    from yr cross join f
    join public.terms t on t.academic_year_id = yr.year_id and t.sequence = f.term_seq
  )
  select
    yr.school_id,
    yr.year_id,
    yr.year_name,
    case
      when (f.year_name is not null and yr.year_id is null) or (f.term_seq is not null and tm.school_id is null) then null
      else greatest(coalesce(tm.start_date, yr.start_date, current_date - 90), coalesce(f.start_d, date '0001-01-01'))
    end,
    case
      when (f.year_name is not null and yr.year_id is null) or (f.term_seq is not null and tm.school_id is null) then null
      else least(coalesce(tm.end_date, yr.end_date, current_date), coalesce(f.end_d, date '9999-12-31'), current_date)
    end
  from yr
  cross join f
  left join tm on tm.school_id = yr.school_id
$$;

-- One row per learner enrolled (status 'enrolled') in the reporting year
-- of their school, with attendance and assessment totals for the period.
-- Optional filter key grade (a grade name) and class_id.
create or replace function public.reporting_learner_stats(p_school_ids uuid[], p_filters jsonb)
returns table (
  school_id uuid, learner_id uuid, grade_id uuid, grade_name text, grade_sort int, class_id uuid,
  present int, late int, absent int, excused int,
  results int, pct_sum numeric, below_pass int,
  open_interventions int, overdue_interventions int
)
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select
      nullif(btrim(p_filters ->> 'grade'), '') as grade_name,
      nullif(p_filters ->> 'class_id', '')::uuid as class_id,
      coalesce(nullif(p_filters ->> 'performance_threshold', '')::numeric, 50) as perf_thr
  ),
  w as (select * from public.reporting_windows(p_school_ids, p_filters)),
  en as materialized (
    select e.school_id, e.learner_id, e.grade_id, g.name as grade_name, g.sort_order as grade_sort, e.class_id,
           w.start_date, w.end_date
    from public.learner_enrollments e
    join w on w.school_id = e.school_id and e.academic_year_id = w.academic_year_id
    join public.learners l on l.id = e.learner_id and l.status in ('enrolled', 'active')
    join public.grades g on g.id = e.grade_id
    cross join f
    where e.enrollment_status = 'enrolled'
      and (f.grade_name is null or lower(btrim(g.name)) = lower(f.grade_name))
      and (f.class_id is null or e.class_id = f.class_id)
  )
  -- Per-learner totals as indexed lookups. Joining pre-aggregated CTEs
  -- here made the planner choose nested loops over 6,000 x 6,000 rows
  -- (54 s for a 20-school district in testing); LATERAL keeps it linear.
  select en.school_id, en.learner_id, en.grade_id, en.grade_name, en.grade_sort, en.class_id,
         att.present, att.late, att.absent, att.excused,
         res.results, coalesce(res.pct_sum, 0) as pct_sum, res.below_pass,
         iv.open_iv as open_interventions, iv.overdue_iv as overdue_interventions
  from en
  cross join f
  cross join lateral (
    select count(*) filter (where a.status = 'present')::int as present,
           count(*) filter (where a.status = 'late')::int as late,
           count(*) filter (where a.status = 'absent')::int as absent,
           count(*) filter (where a.status = 'excused')::int as excused
    from public.attendance_records a
    where a.learner_id = en.learner_id and a.school_id = en.school_id
      and a.attendance_date between en.start_date and en.end_date
  ) att
  cross join lateral (
    select count(*)::int as results,
           sum(r.mark::numeric * 100 / s.max_mark) as pct_sum,
           count(*) filter (where r.mark::numeric * 100 / s.max_mark < f.perf_thr)::int as below_pass
    -- OFFSET 0 keeps this a separate step, so it starts from the learner's
    -- own few results instead of every assessment in the period.
    from (
      select r.assessment_id, r.mark from public.assessment_results r
      where r.learner_id = en.learner_id and r.school_id = en.school_id
      offset 0
    ) r
    join public.assessments s on s.id = r.assessment_id and s.active and s.max_mark > 0
    where s.assessment_date between en.start_date and en.end_date
  ) res
  cross join lateral (
    select count(*) filter (where i.status <> 'resolved')::int as open_iv,
           count(*) filter (where i.status <> 'resolved' and i.target_date < current_date)::int as overdue_iv
    from public.academic_interventions i
    where i.learner_id = en.learner_id and i.school_id = en.school_id
  ) iv
$$;

revoke execute on function public.reporting_resolve_schools(jsonb) from public, anon, authenticated;
revoke execute on function public.reporting_windows(uuid[], jsonb) from public, anon, authenticated;
revoke execute on function public.reporting_learner_stats(uuid[], jsonb) from public, anon, authenticated;

-- Rounds a ratio to one decimal place as a percentage; null when there is
-- nothing to compute it from.
create or replace function public.reporting_rate(p_num numeric, p_den numeric)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case when coalesce(p_den, 0) = 0 then null else round(p_num * 100 / p_den, 1) end
$$;

revoke execute on function public.reporting_rate(numeric, numeric) from public, anon;
grant execute on function public.reporting_rate(numeric, numeric) to authenticated;

-- The caller's reporting scope, for filter pickers: areas, schools, grade
-- names, academic year names and term numbers that exist in scope.
create or replace function public.get_reporting_scope()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind text := public.reporting_caller_kind();
  v_schools uuid[];
  v_areas uuid[];
begin
  if v_kind is null then
    raise exception 'insufficient_privilege: no reporting access';
  end if;
  v_schools := public.reporting_school_ids();
  v_areas := public.reporting_visible_area_ids();

  return jsonb_build_object(
    'caller_kind', v_kind,
    'learner_detail', (
      select coalesce(bool_or(public.reporting_learner_detail_allowed(id)), false) from unnest(v_schools) as t(id)
    ),
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'level', a.level, 'parent_id', a.parent_id, 'name', a.name, 'code', a.code)
                       order by a.level, a.name)
      from public.education_areas a where a.id = any (v_areas)
    ), '[]'::jsonb),
    'schools', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'emis_number', s.emis_number,
                                          'education_area_id', s.education_area_id, 'status', s.status)
                       order by s.name)
      from public.schools s where s.id = any (v_schools)
    ), '[]'::jsonb),
    'grades', coalesce((
      select jsonb_agg(g.name order by g.sort_order, g.name)
      from (select distinct on (lower(btrim(name))) btrim(name) as name, min(sort_order) over (partition by lower(btrim(name))) as sort_order
            from public.grades where school_id = any (v_schools) and active) g
    ), '[]'::jsonb),
    'academic_years', coalesce((
      select jsonb_agg(y.name order by y.name desc)
      from (select distinct btrim(name) as name from public.academic_years where school_id = any (v_schools)) y
    ), '[]'::jsonb),
    'terms', coalesce((
      select jsonb_agg(t.sequence order by t.sequence)
      from (select distinct sequence from public.terms where school_id = any (v_schools)) t
    ), '[]'::jsonb)
  );
end;
$$;

-- The government report / district dashboard dataset.
--
-- p_filters keys (all optional): province_id, district_id, circuit_id,
-- school_id, grade, academic_year, term, start_date, end_date,
-- attendance_threshold (default 80), performance_threshold (default 50).
--
-- Rates are pooled (sum of present+late over sum of qualifying days, the
-- same definition as src/features/attendance/utils/calculations.ts), never
-- averages of averages. Groups covering fewer than 5 learners have their
-- rates suppressed unless the caller holds learner-level access for every
-- school in the group.
create or replace function public.get_government_report(p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_schools uuid[];
  v_att_thr numeric := coalesce(nullif(v_filters ->> 'attendance_threshold', '')::numeric, 80);
  v_perf_thr numeric := coalesce(nullif(v_filters ->> 'performance_threshold', '')::numeric, 50);
  v_min_cell int := 5;
  v_grade text := nullif(btrim(v_filters ->> 'grade'), '');
  v_result jsonb;
begin
  if v_att_thr not between 0 and 100 or v_perf_thr not between 0 and 100 then
    raise exception 'invalid_argument: thresholds must be between 0 and 100';
  end if;

  v_schools := public.reporting_resolve_schools(v_filters);

  with
  sch as (
    select s.id, s.name, s.emis_number, s.status, s.education_area_id,
           public.reporting_learner_detail_allowed(s.id) as detail
    from public.schools s where s.id = any (v_schools)
  ),
  area_chain as (
    select sch.id as school_id,
           case when a.level = 'circuit' then a.id end as circuit_id,
           case when a.level = 'circuit' then a.name end as circuit_name,
           case when a.level = 'circuit' then d.id else a.id end as district_id,
           case when a.level = 'circuit' then d.name else a.name end as district_name,
           p.id as province_id, p.name as province_name
    from sch
    left join public.education_areas a on a.id = sch.education_area_id
    left join public.education_areas d on d.id = a.parent_id and a.level = 'circuit'
    left join public.education_areas p on p.id = case when a.level = 'circuit' then d.parent_id else a.parent_id end
  ),
  w as (select * from public.reporting_windows(v_schools, v_filters)),
  ls as (select * from public.reporting_learner_stats(v_schools, v_filters)),
  gr as (
    select g.id, g.school_id from public.grades g
    where g.school_id = any (v_schools) and (v_grade is null or lower(btrim(g.name)) = lower(v_grade))
  ),
  cls as (
    select c.id, c.school_id, c.grade_id from public.classes c join gr on gr.id = c.grade_id where c.active
  ),
  edu as (
    select e.school_id,
           count(*) as staff,
           count(*) filter (
             where p.role in ('teacher', 'class_teacher', 'subject_teacher', 'department_head', 'principal', 'vice_principal')
                or exists (select 1 from public.class_teacher_assignments t
                           where t.teacher_profile_id = e.profile_id and t.school_id = e.school_id and t.active)
           ) as educators
    from public.employees e
    left join public.profiles p on p.id = e.profile_id
    where e.school_id = any (v_schools) and e.employment_status in ('active', 'on_leave')
    group by e.school_id
  ),
  reg as (
    select l.school_id, count(*) as learners_active
    from public.learners l where l.school_id = any (v_schools) and l.status in ('enrolled', 'active')
    group by l.school_id
  ),
  unenrolled as (
    select l.school_id, count(*) as n
    from public.learners l
    join w on w.school_id = l.school_id and w.academic_year_id is not null
    where l.status in ('enrolled', 'active')
      and not exists (select 1 from public.learner_enrollments e
                      where e.learner_id = l.id and e.academic_year_id = w.academic_year_id and e.enrollment_status = 'enrolled')
    group by l.school_id
  ),
  class_att as (
    select cls.school_id, count(*) filter (where not exists (
             select 1 from public.attendance_records a
             where a.class_id = cls.id and a.attendance_date between w.start_date and w.end_date)) as without_attendance,
           count(*) filter (where not exists (
             select 1 from public.assessments s
             where s.class_id = cls.id and s.active and s.assessment_date between w.start_date and w.end_date)) as without_assessments
    from cls join w on w.school_id = cls.school_id and w.start_date is not null
    group by cls.school_id
  ),
  incomplete as (
    select s.school_id, count(*) as n
    from public.assessments s
    join cls on cls.id = s.class_id
    join w on w.school_id = s.school_id and s.assessment_date between w.start_date and w.end_date
    where s.active
      and (select count(*) from public.assessment_results r where r.assessment_id = s.id)
        < (select count(*) from public.learner_enrollments e
           where e.class_id = s.class_id and e.academic_year_id = s.academic_year_id and e.enrollment_status = 'enrolled')
    group by s.school_id
  ),
  iv as (
    select i.school_id,
           count(*) filter (where i.status = 'open') as open,
           count(*) filter (where i.status = 'in_progress') as in_progress,
           count(*) filter (where i.status <> 'resolved' and i.target_date < current_date) as overdue,
           count(*) filter (where i.status = 'resolved' and i.resolved_at::date between w.start_date and w.end_date) as resolved
    from public.academic_interventions i
    join w on w.school_id = i.school_id
    where i.school_id = any (v_schools)
      and (w.academic_year_id is null or i.academic_year_id is null or i.academic_year_id = w.academic_year_id)
      and (v_grade is null or i.learner_id in (select learner_id from ls))
    group by i.school_id
  ),
  school_stats as (
    select ls.school_id,
           count(*) as enrolled,
           sum(ls.present + ls.late) as attended,
           sum(ls.present + ls.late + ls.absent) as qualifying,
           sum(ls.results) as results,
           sum(ls.pct_sum) as pct_sum,
           sum(ls.below_pass) as below_pass,
           count(*) filter (where
             (ls.present + ls.late + ls.absent > 0 and (ls.present + ls.late)::numeric * 100 / (ls.present + ls.late + ls.absent) < v_att_thr)
             or (ls.results > 0 and ls.pct_sum / ls.results < v_perf_thr)
             or ls.open_interventions > 0
           ) as needing_intervention
    from ls group by ls.school_id
  ),
  school_rows as (
    select sch.id, sch.name, sch.emis_number, sch.status, sch.detail,
           ac.province_id, ac.province_name, ac.district_id, ac.district_name, ac.circuit_id, ac.circuit_name,
           w.academic_year_name, w.start_date, w.end_date,
           coalesce(reg.learners_active, 0) as learners_active,
           coalesce(ss.enrolled, 0) as learners_enrolled,
           coalesce(edu.educators, 0) as educators,
           coalesce(edu.staff, 0) as staff,
           (select count(*) from cls where cls.school_id = sch.id) as classes,
           coalesce(ss.attended, 0) as attended,
           coalesce(ss.qualifying, 0) as qualifying,
           coalesce(ss.results, 0) as results,
           coalesce(ss.pct_sum, 0) as pct_sum,
           coalesce(ss.below_pass, 0) as below_pass,
           coalesce(ss.needing_intervention, 0) as needing_intervention,
           coalesce(iv.open, 0) as iv_open,
           coalesce(iv.in_progress, 0) as iv_in_progress,
           coalesce(iv.overdue, 0) as iv_overdue,
           coalesce(iv.resolved, 0) as iv_resolved,
           jsonb_strip_nulls(jsonb_build_object(
             'missing_emis_number', case when nullif(btrim(sch.emis_number), '') is null then true end,
             'not_linked_to_area', case when sch.education_area_id is null then true end,
             'no_academic_year', case when w.academic_year_id is null then true end,
             'period_not_configured', case when w.start_date is null and w.academic_year_id is not null then true end,
             'learners_not_enrolled', nullif(coalesce(un.n, 0), 0),
             'classes_without_attendance', nullif(coalesce(ca.without_attendance, 0), 0),
             'classes_without_assessments', nullif(coalesce(ca.without_assessments, 0), 0),
             'assessments_missing_marks', nullif(coalesce(inc.n, 0), 0)
           )) as data_quality
    from sch
    left join area_chain ac on ac.school_id = sch.id
    left join w on w.school_id = sch.id
    left join reg on reg.school_id = sch.id
    left join school_stats ss on ss.school_id = sch.id
    left join edu on edu.school_id = sch.id
    left join iv on iv.school_id = sch.id
    left join unenrolled un on un.school_id = sch.id
    left join class_att ca on ca.school_id = sch.id
    left join incomplete inc on inc.school_id = sch.id
  ),
  school_json as (
    select r.*,
           public.reporting_rate(r.attended, r.qualifying) as attendance_rate,
           case when r.results > 0 then round(r.pct_sum / r.results, 1) end as average_percent,
           public.reporting_rate(r.results - r.below_pass, r.results) as pass_rate,
           (select count(*) from jsonb_object_keys(r.data_quality)) as dq_count
    from school_rows r
  ),
  flagged as (
    select s.*,
           array_remove(array[
             case when s.attendance_rate < v_att_thr then 'low_attendance' end,
             case when s.average_percent < v_perf_thr then 'low_performance' end,
             case when s.iv_overdue > 0 then 'overdue_interventions' end,
             case when s.dq_count > 0 then 'data_quality' end
           ], null) as attention
    from school_json s
  ),
  grade_rows as (
    select lower(btrim(ls.grade_name)) as grade_key,
           min(btrim(ls.grade_name)) as grade_name,
           min(ls.grade_sort) as sort_order,
           count(*) as learners,
           count(distinct ls.school_id) as schools,
           count(distinct ls.class_id) as classes,
           sum(ls.present + ls.late) as attended,
           sum(ls.present + ls.late + ls.absent) as qualifying,
           sum(ls.results) as results,
           sum(ls.pct_sum) as pct_sum,
           sum(ls.below_pass) as below_pass,
           bool_and(sch.detail) as detail
    from ls join sch on sch.id = ls.school_id
    group by lower(btrim(ls.grade_name))
  ),
  subject_rows as (
    select lower(btrim(sub.name)) as subject_key,
           min(btrim(sub.name)) as subject_name,
           count(*) as results,
           count(distinct r.learner_id) as learners,
           count(distinct s.school_id) as schools,
           sum(r.mark::numeric * 100 / s.max_mark) as pct_sum,
           count(*) filter (where r.mark::numeric * 100 / s.max_mark < v_perf_thr) as below_pass,
           bool_and(sch.detail) as detail
    from public.assessment_results r
    join public.assessments s on s.id = r.assessment_id and s.active and s.max_mark > 0
    join public.subjects sub on sub.id = s.subject_id
    join ls on ls.learner_id = r.learner_id and ls.school_id = r.school_id
    join w on w.school_id = s.school_id and s.assessment_date between w.start_date and w.end_date
    join sch on sch.id = s.school_id
    group by lower(btrim(sub.name))
  ),
  att_trend as (
    select date_trunc('week', a.attendance_date)::date as period,
           count(*) filter (where a.status in ('present', 'late')) as attended,
           count(*) filter (where a.status in ('present', 'late', 'absent')) as qualifying
    from public.attendance_records a
    join ls on ls.learner_id = a.learner_id and ls.school_id = a.school_id
    join w on w.school_id = a.school_id and a.attendance_date between w.start_date and w.end_date
    group by 1
  ),
  perf_trend as (
    select date_trunc('month', s.assessment_date)::date as period,
           count(*) as results,
           sum(r.mark::numeric * 100 / s.max_mark) as pct_sum
    from public.assessment_results r
    join public.assessments s on s.id = r.assessment_id and s.active and s.max_mark > 0
    join ls on ls.learner_id = r.learner_id and ls.school_id = r.school_id
    join w on w.school_id = s.school_id and s.assessment_date between w.start_date and w.end_date
    group by 1
  ),
  area_rows as (
    select f.district_id, f.district_name, f.province_name,
           count(*) as schools,
           sum(f.learners_enrolled) as learners,
           sum(f.educators) as educators,
           sum(f.attended) as attended,
           sum(f.qualifying) as qualifying,
           sum(f.results) as results,
           sum(f.pct_sum) as pct_sum,
           count(*) filter (where cardinality(f.attention) > 0) as attention
    from flagged f
    group by f.district_id, f.district_name, f.province_name
  )
  select jsonb_build_object(
    'generated_at', now(),
    'filters', v_filters,
    'thresholds', jsonb_build_object('attendance', v_att_thr, 'performance', v_perf_thr, 'minimum_group_size', v_min_cell),
    'summary', (
      select jsonb_build_object(
        'schools', count(*),
        'learners_active', coalesce(sum(learners_active), 0),
        'learners_enrolled', coalesce(sum(learners_enrolled), 0),
        'educators', coalesce(sum(educators), 0),
        'staff', coalesce(sum(staff), 0),
        'classes', coalesce(sum(classes), 0),
        'attendance_rate', public.reporting_rate(sum(attended), sum(qualifying)),
        'attendance_records', coalesce(sum(qualifying), 0),
        'average_percent', case when sum(results) > 0 then round(sum(pct_sum) / sum(results), 1) end,
        'pass_rate', public.reporting_rate(sum(results) - sum(below_pass), sum(results)),
        'assessment_results', coalesce(sum(results), 0),
        'learners_requiring_intervention', coalesce(sum(needing_intervention), 0),
        'schools_requiring_attention', count(*) filter (where cardinality(attention) > 0),
        'schools_with_data_quality_issues', count(*) filter (where dq_count > 0),
        'interventions', jsonb_build_object(
          'open', coalesce(sum(iv_open), 0), 'in_progress', coalesce(sum(iv_in_progress), 0),
          'overdue', coalesce(sum(iv_overdue), 0), 'resolved', coalesce(sum(iv_resolved), 0))
      )
      from flagged
    ),
    'schools', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'name', f.name, 'emis_number', f.emis_number, 'status', f.status,
        'province', f.province_name, 'district_id', f.district_id, 'district', f.district_name,
        'circuit_id', f.circuit_id, 'circuit', f.circuit_name,
        'academic_year', f.academic_year_name, 'period_start', f.start_date, 'period_end', f.end_date,
        'learners_active', f.learners_active, 'learners_enrolled', f.learners_enrolled,
        'educators', f.educators, 'staff', f.staff, 'classes', f.classes,
        'learner_educator_ratio', case when f.educators > 0 then round(f.learners_enrolled::numeric / f.educators, 1) end,
        'attendance_rate', f.attendance_rate, 'attendance_records', f.qualifying,
        'average_percent', f.average_percent, 'pass_rate', f.pass_rate, 'assessment_results', f.results,
        'learners_requiring_intervention', f.needing_intervention,
        'interventions', jsonb_build_object('open', f.iv_open, 'in_progress', f.iv_in_progress,
                                            'overdue', f.iv_overdue, 'resolved', f.iv_resolved),
        'data_quality', f.data_quality,
        'attention', to_jsonb(f.attention),
        'learner_detail', f.detail
      ) order by f.name)
      from flagged f
    ), '[]'::jsonb),
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'district_id', a.district_id, 'district', a.district_name, 'province', a.province_name,
        'schools', a.schools, 'learners', a.learners, 'educators', a.educators,
        'attendance_rate', public.reporting_rate(a.attended, a.qualifying),
        'average_percent', case when a.results > 0 then round(a.pct_sum / a.results, 1) end,
        'schools_requiring_attention', a.attention
      ) order by a.province_name nulls last, a.district_name nulls last)
      from area_rows a
    ), '[]'::jsonb),
    'grades', coalesce((
      select jsonb_agg(jsonb_build_object(
        'grade', g.grade_name, 'learners', g.learners, 'schools', g.schools, 'classes', g.classes,
        'suppressed', g.learners < v_min_cell and not g.detail,
        'attendance_rate', case when g.learners < v_min_cell and not g.detail then null else public.reporting_rate(g.attended, g.qualifying) end,
        'average_percent', case when g.learners < v_min_cell and not g.detail then null
                                when g.results > 0 then round(g.pct_sum / g.results, 1) end,
        'pass_rate', case when g.learners < v_min_cell and not g.detail then null else public.reporting_rate(g.results - g.below_pass, g.results) end,
        'assessment_results', g.results
      ) order by g.sort_order nulls last, g.grade_name)
      from grade_rows g
    ), '[]'::jsonb),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject', s.subject_name, 'schools', s.schools, 'learners', s.learners, 'assessment_results', s.results,
        'suppressed', s.learners < v_min_cell and not s.detail,
        'average_percent', case when s.learners < v_min_cell and not s.detail then null else round(s.pct_sum / s.results, 1) end,
        'pass_rate', case when s.learners < v_min_cell and not s.detail then null else public.reporting_rate(s.results - s.below_pass, s.results) end
      ) order by s.subject_name)
      from subject_rows s
    ), '[]'::jsonb),
    'attendance_trend', coalesce((
      select jsonb_agg(jsonb_build_object('period', t.period, 'attendance_rate', public.reporting_rate(t.attended, t.qualifying),
                                          'records', t.qualifying) order by t.period)
      from att_trend t where t.qualifying > 0
    ), '[]'::jsonb),
    'performance_trend', coalesce((
      select jsonb_agg(jsonb_build_object('period', t.period, 'average_percent', round(t.pct_sum / t.results, 1),
                                          'results', t.results) order by t.period)
      from perf_trend t where t.results > 0
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

-- School drill-down: grade and class breakdown for one school in scope.
create or replace function public.get_school_report(p_school_id uuid, p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb) - 'school_id' - 'province_id' - 'district_id' - 'circuit_id';
  v_att_thr numeric := coalesce(nullif(v_filters ->> 'attendance_threshold', '')::numeric, 80);
  v_perf_thr numeric := coalesce(nullif(v_filters ->> 'performance_threshold', '')::numeric, 50);
  v_min_cell int := 5;
  v_detail boolean;
  v_schools uuid[];
  v_school public.schools;
  v_result jsonb;
begin
  if p_school_id is null then
    raise exception 'invalid_argument: school_id is required';
  end if;
  v_schools := public.reporting_resolve_schools(jsonb_build_object('school_id', p_school_id));
  select * into v_school from public.schools where id = p_school_id;
  v_detail := public.reporting_learner_detail_allowed(p_school_id);

  with
  w as (select * from public.reporting_windows(v_schools, v_filters)),
  ls as (select * from public.reporting_learner_stats(v_schools, v_filters)),
  cls as (
    select c.id, c.name, c.grade_id, g.name as grade_name, g.sort_order
    from public.classes c join public.grades g on g.id = c.grade_id
    where c.school_id = p_school_id and c.active
      and (nullif(btrim(v_filters ->> 'grade'), '') is null or lower(btrim(g.name)) = lower(btrim(v_filters ->> 'grade')))
  ),
  class_rows as (
    select cls.id, cls.name, cls.grade_name, cls.sort_order,
           count(ls.learner_id) as learners,
           coalesce(sum(ls.present + ls.late), 0) as attended,
           coalesce(sum(ls.present + ls.late + ls.absent), 0) as qualifying,
           coalesce(sum(ls.results), 0) as results,
           coalesce(sum(ls.pct_sum), 0) as pct_sum,
           coalesce(sum(ls.below_pass), 0) as below_pass,
           count(*) filter (where
             (ls.present + ls.late + ls.absent > 0 and (ls.present + ls.late)::numeric * 100 / (ls.present + ls.late + ls.absent) < v_att_thr)
             or (ls.results > 0 and ls.pct_sum / ls.results < v_perf_thr)
             or ls.open_interventions > 0
           ) as needing_intervention,
           (select max(a.attendance_date) from public.attendance_records a where a.class_id = cls.id) as last_attendance,
           (select count(*) from public.assessments s, w
             where s.class_id = cls.id and s.active and s.assessment_date between w.start_date and w.end_date) as assessments
    from cls left join ls on ls.class_id = cls.id
    group by cls.id, cls.name, cls.grade_name, cls.sort_order
  )
  select jsonb_build_object(
    'generated_at', now(),
    'school', jsonb_build_object('id', v_school.id, 'name', v_school.name, 'emis_number', v_school.emis_number,
                                 'status', v_school.status, 'education_area_id', v_school.education_area_id),
    'period', (select jsonb_build_object('academic_year', academic_year_name, 'start', start_date, 'end', end_date) from w),
    'learner_detail', v_detail,
    'thresholds', jsonb_build_object('attendance', v_att_thr, 'performance', v_perf_thr, 'minimum_group_size', v_min_cell),
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'grade', c.grade_name, 'learners', c.learners,
        'suppressed', c.learners < v_min_cell and not v_detail,
        'attendance_rate', case when c.learners < v_min_cell and not v_detail then null else public.reporting_rate(c.attended, c.qualifying) end,
        'average_percent', case when c.learners < v_min_cell and not v_detail then null
                                when c.results > 0 then round(c.pct_sum / c.results, 1) end,
        'pass_rate', case when c.learners < v_min_cell and not v_detail then null else public.reporting_rate(c.results - c.below_pass, c.results) end,
        'learners_requiring_intervention', case when c.learners < v_min_cell and not v_detail then null else c.needing_intervention end,
        'assessments', c.assessments,
        'last_attendance_date', c.last_attendance
      ) order by c.sort_order nulls last, c.grade_name, c.name)
      from class_rows c
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- Learner-level drill-down for one class. Requires learner-detail access to
-- the class's school, and every call is written to the audit log.
create or replace function public.get_class_learner_report(p_class_id uuid, p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb) - 'school_id' - 'province_id' - 'district_id' - 'circuit_id' - 'grade';
  v_att_thr numeric := coalesce(nullif(v_filters ->> 'attendance_threshold', '')::numeric, 80);
  v_perf_thr numeric := coalesce(nullif(v_filters ->> 'performance_threshold', '')::numeric, 50);
  v_class record;
  v_schools uuid[];
  v_result jsonb;
begin
  select c.id, c.name, c.school_id, g.name as grade_name
    into v_class
  from public.classes c join public.grades g on g.id = c.grade_id
  where c.id = p_class_id;

  if v_class.id is null then
    raise exception 'insufficient_privilege: this class is outside your reporting scope';
  end if;
  -- Raises for a school outside the caller's scope.
  v_schools := public.reporting_resolve_schools(jsonb_build_object('school_id', v_class.school_id));
  if not public.reporting_learner_detail_allowed(v_class.school_id) then
    raise exception 'insufficient_privilege: learner-level reporting is not granted for this school';
  end if;

  with ls as (
    select * from public.reporting_learner_stats(v_schools, v_filters || jsonb_build_object('class_id', p_class_id))
  )
  select jsonb_build_object(
    'generated_at', now(),
    'class', jsonb_build_object('id', v_class.id, 'name', v_class.name, 'grade', v_class.grade_name, 'school_id', v_class.school_id),
    'thresholds', jsonb_build_object('attendance', v_att_thr, 'performance', v_perf_thr),
    'learners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'learner_number', l.learner_number,
        'first_name', coalesce(l.preferred_name, l.first_name), 'last_name', l.last_name,
        'attendance_rate', public.reporting_rate(ls.present + ls.late, ls.present + ls.late + ls.absent),
        'absent_days', ls.absent,
        'average_percent', case when ls.results > 0 then round(ls.pct_sum / ls.results, 1) end,
        'assessment_results', ls.results,
        'open_interventions', ls.open_interventions,
        'overdue_interventions', ls.overdue_interventions,
        'requires_intervention',
          (ls.present + ls.late + ls.absent > 0 and (ls.present + ls.late)::numeric * 100 / (ls.present + ls.late + ls.absent) < v_att_thr)
          or (ls.results > 0 and ls.pct_sum / ls.results < v_perf_thr)
          or ls.open_interventions > 0
      ) order by l.last_name, l.first_name)
      from ls join public.learners l on l.id = ls.learner_id
    ), '[]'::jsonb)
  ) into v_result;

  perform public.write_audit_log(
    v_class.school_id, auth.uid(), 'government_report_learner_detail_viewed', 'classes', v_class.id,
    null, jsonb_build_object('caller_kind', public.reporting_caller_kind(),
                             'learners', jsonb_array_length(v_result -> 'learners'), 'filters', v_filters)
  );

  return v_result;
end;
$$;

-- Exports are built in the browser from data the caller was already
-- allowed to read; this records who exported what.
create or replace function public.record_government_report_export(p_report text, p_format text, p_filters jsonb default '{}'::jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_schools uuid[];
begin
  if p_format not in ('csv', 'excel_csv', 'pdf') then
    raise exception 'invalid_argument: unknown export format';
  end if;
  if p_report is null or char_length(p_report) not between 1 and 60 then
    raise exception 'invalid_argument: unknown report';
  end if;
  v_schools := public.reporting_resolve_schools(coalesce(p_filters, '{}'::jsonb));
  perform public.write_audit_log(
    case when cardinality(v_schools) = 1 then v_schools[1] end,
    auth.uid(), 'government_report_exported', 'profiles', auth.uid(), null,
    jsonb_build_object('report', p_report, 'format', p_format, 'caller_kind', public.reporting_caller_kind(),
                       'schools', cardinality(v_schools), 'filters', p_filters)
  );
end;
$$;

-- ===========================================================================
-- 6. Administration (platform administrators only, audited)
-- ===========================================================================

create or replace function public.upsert_education_area(
  p_id uuid, p_level public.education_area_level, p_parent_id uuid, p_name text, p_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can manage education areas';
  end if;
  if p_id is null then
    insert into public.education_areas (level, parent_id, name, code, created_by)
    values (p_level, p_parent_id, btrim(p_name), nullif(btrim(p_code), ''), auth.uid())
    returning id into v_id;
  else
    update public.education_areas
       set name = btrim(p_name), code = nullif(btrim(p_code), '')
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'not_found: education area';
    end if;
  end if;
  perform public.write_audit_log(null, auth.uid(), 'education_area_saved', 'education_areas', v_id, null,
    jsonb_build_object('level', p_level, 'parent_id', p_parent_id, 'name', p_name, 'code', p_code));
  return v_id;
end;
$$;

create or replace function public.set_school_education_area(p_school_id uuid, p_area_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can link schools to education areas';
  end if;
  select education_area_id into v_before from public.schools where id = p_school_id;
  if not found then
    raise exception 'not_found: school';
  end if;
  update public.schools set education_area_id = p_area_id where id = p_school_id;
  perform public.write_audit_log(p_school_id, auth.uid(), 'school_education_area_changed', 'schools', p_school_id,
    jsonb_build_object('education_area_id', v_before), jsonb_build_object('education_area_id', p_area_id));
end;
$$;

create or replace function public.provision_education_official(
  p_email text, p_first_name text, p_last_name text, p_phone text default null
)
returns table (user_id uuid, temporary_password text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_password text := encode(gen_random_bytes(18), 'base64');
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can create education official accounts';
  end if;
  perform public.check_rate_limit('account_provisioning', 20, interval '1 hour');
  if exists (select 1 from auth.users u where lower(u.email) = lower(btrim(p_email))) then
    raise exception 'email_taken: % is already registered', p_email;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', btrim(p_email),
    crypt(v_password, gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                       'role', 'education_official', 'tenant_id', null),
    jsonb_build_object('first_name', p_first_name, 'last_name', p_last_name),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, jsonb_build_object('sub', v_id::text, 'email', btrim(p_email)),
          'email', v_id::text, now(), now(), now());

  insert into public.profiles (id, tenant_id, first_name, last_name, email, phone, role, status)
  values (v_id, null, btrim(p_first_name), btrim(p_last_name), btrim(p_email), p_phone, 'education_official', 'active');

  perform public.write_audit_log(null, auth.uid(), 'education_official_provisioned', 'profiles', v_id, null,
    jsonb_build_object('email', btrim(p_email)));

  return query select v_id, v_password;
end;
$$;

create or replace function public.grant_education_official_access(
  p_profile_id uuid, p_area_id uuid, p_learner_detail boolean default false, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can grant reporting access';
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = p_profile_id and p.role = 'education_official' and p.status = 'active') then
    raise exception 'invalid_argument: access can only be granted to an active education official';
  end if;
  if not exists (select 1 from public.education_areas where id = p_area_id) then
    raise exception 'not_found: education area';
  end if;

  update public.education_official_assignments
     set can_view_learner_detail = coalesce(p_learner_detail, false), notes = p_notes
   where profile_id = p_profile_id and area_id = p_area_id and active
  returning id into v_id;

  if v_id is null then
    insert into public.education_official_assignments (profile_id, area_id, can_view_learner_detail, notes, granted_by)
    values (p_profile_id, p_area_id, coalesce(p_learner_detail, false), p_notes, auth.uid())
    returning id into v_id;
  end if;

  perform public.write_audit_log(null, auth.uid(), 'education_official_access_granted', 'education_official_assignments', v_id, null,
    jsonb_build_object('profile_id', p_profile_id, 'area_id', p_area_id, 'learner_detail', coalesce(p_learner_detail, false)));
  return v_id;
end;
$$;

create or replace function public.revoke_education_official_access(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege: only a platform administrator can revoke reporting access';
  end if;
  update public.education_official_assignments
     set active = false, revoked_at = now(), revoked_by = auth.uid()
   where id = p_assignment_id and active;
  if not found then
    raise exception 'not_found: active assignment';
  end if;
  perform public.write_audit_log(null, auth.uid(), 'education_official_access_revoked', 'education_official_assignments',
    p_assignment_id, null, null);
end;
$$;

-- ===========================================================================
-- 7. Grants
-- ===========================================================================

revoke execute on function public.is_education_official() from public, anon;
revoke execute on function public.official_area_ids() from public, anon;
revoke execute on function public.reporting_visible_area_ids() from public, anon;
revoke execute on function public.reporting_school_ids() from public, anon;
revoke execute on function public.reporting_caller_kind() from public, anon;
revoke execute on function public.reporting_learner_detail_allowed(uuid) from public, anon;
grant execute on function public.is_education_official() to authenticated;
grant execute on function public.official_area_ids() to authenticated;
grant execute on function public.reporting_visible_area_ids() to authenticated;
grant execute on function public.reporting_school_ids() to authenticated;
grant execute on function public.reporting_caller_kind() to authenticated;
grant execute on function public.reporting_learner_detail_allowed(uuid) to authenticated;

revoke execute on function public.get_reporting_scope() from public, anon;
revoke execute on function public.get_government_report(jsonb) from public, anon;
revoke execute on function public.get_school_report(uuid, jsonb) from public, anon;
revoke execute on function public.get_class_learner_report(uuid, jsonb) from public, anon;
revoke execute on function public.record_government_report_export(text, text, jsonb) from public, anon;
grant execute on function public.get_reporting_scope() to authenticated;
grant execute on function public.get_government_report(jsonb) to authenticated;
grant execute on function public.get_school_report(uuid, jsonb) to authenticated;
grant execute on function public.get_class_learner_report(uuid, jsonb) to authenticated;
grant execute on function public.record_government_report_export(text, text, jsonb) to authenticated;

revoke execute on function public.upsert_education_area(uuid, public.education_area_level, uuid, text, text) from public, anon;
revoke execute on function public.set_school_education_area(uuid, uuid) from public, anon;
revoke execute on function public.provision_education_official(text, text, text, text) from public, anon;
revoke execute on function public.grant_education_official_access(uuid, uuid, boolean, text) from public, anon;
revoke execute on function public.revoke_education_official_access(uuid) from public, anon;
grant execute on function public.upsert_education_area(uuid, public.education_area_level, uuid, text, text) to authenticated;
grant execute on function public.set_school_education_area(uuid, uuid) to authenticated;
grant execute on function public.provision_education_official(text, text, text, text) to authenticated;
grant execute on function public.grant_education_official_access(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.revoke_education_official_access(uuid) to authenticated;

-- Supporting indexes for the reporting joins.
create index if not exists attendance_records_school_date_idx on public.attendance_records (school_id, attendance_date);
create index if not exists attendance_records_class_date_idx on public.attendance_records (class_id, attendance_date);
create index if not exists learner_enrollments_class_year_idx on public.learner_enrollments (class_id, academic_year_id) where enrollment_status = 'enrolled';
create index if not exists assessments_school_date_idx on public.assessments (school_id, assessment_date) where active;
create index if not exists learner_enrollments_year_status_idx on public.learner_enrollments (academic_year_id, enrollment_status);
create index if not exists academic_interventions_school_status_idx on public.academic_interventions (school_id, status);

select public.rls_optimize_policies();
